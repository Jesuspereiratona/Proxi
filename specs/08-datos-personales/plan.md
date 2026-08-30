# Plan técnico · Portabilidad, borrado y retención

## Archivos nuevos
```
apps/api/src/
├── services/cuenta/cuenta.service.js   obtenerDatos, eliminarCuenta, procesarRetencion
├── controllers/cuenta.controller.js
├── routes/cuenta.routes.js             GET /mi-cuenta/datos, DELETE /mi-cuenta
└── tareas/procesarRetencionCv.js       diario, mismo patrón que las otras tres tareas
db/migrations/
└── 20260829180000-agregar-aviso-retencion-estudiantes.js   aviso_retencion_enviado_at
```
`eliminarCuenta()` es la única función que anonimiza — la llaman tanto `DELETE /mi-cuenta` como la
tarea de retención, para que "qué significa borrar una cuenta" viva en un solo lugar.

## `eliminarCuenta(usuarioId)`
1. Todos los `Archivo` con `propietarioUsuarioId = usuarioId, tipo:'cv'`: `fs.unlink` (best-effort,
   `catch(() => {})` — mismo criterio que el resto del proyecto con archivos que pueden no estar) y
   `nombreOriginal` pasa a un valor genérico (`'cv-eliminado.pdf'`). La fila de `Archivo` no se
   borra: `postulaciones.cv_archivo_id` tiene `onDelete:'RESTRICT'`, un intento de `DELETE` fallaría
   con una FK y además el archivo puede seguir "vivo" para otra postulación entre las varias que
   Fase 4 permite acumular.
2. `Estudiante` se actualiza en el lugar: `nombres`/`apellidos`/`carrera` a un texto fijo (son
   `NOT NULL`, no se puede dejarlos en blanco), `nivel`/`telefono`/`rutUltimos4` a `null`, y
   `rut_cifrado` a `NULL` por una consulta cruda (es la única columna que no tiene modelo Sequelize
   normal, se toca siempre por `repositories/estudiantes.repository.js` o SQL directo).
3. `Usuario.email` se reemplaza por un marcador único (`eliminado-<id>-<random>@proxi.invalid`) y
   `passwordHash` por el hash de una contraseña aleatoria que nadie conoce. **No se toca `estado`**:
   agregar un valor nuevo a su `CHECK` (`usuarios_estado_check`) es una migración aparte para una
   señal que el cambio de correo ya da sola — el correo real deja de existir en la tabla, así que
   `Usuario.findOne({where:{email}})` en el login no encuentra la fila y responde exactamente el
   mismo `AUTH_CREDENCIALES_INVALIDAS` que un correo que nunca existió, sin ningún caso especial.
4. Todas las `Sesion` con `revocadaAt: null` de ese usuario pasan a `revocadaAt: now()` — cierra
   cualquier sesión que ya tuviera la cookie de refresco puesta, no solo bloquea logins nuevos.

Pasos 2-4 van en una sola `sequelize.transaction`; el `fs.unlink` del paso 1 queda fuera (igual que
`archivos.service.js subirCv`, que tampoco envuelve el disco en la transacción de la base).

`Consentimiento` y `AuditoriaAcceso` no se tocan: el primero es el registro de que hubo consentimiento
(vale la pena conservarlo tal cual para cumplimiento), el segundo es el rastro de accesos que exige
`docs/03-seguridad.md` — borrarlo sería destruir la prueba de que el control existió.

## `procesarRetencion(ahora)`
Dos pasadas, una función, mismo patrón que `cerrarOfertasVencidas`/`marcarSinRespuesta` (idempotente,
una fila que falla no aborta el resto):
- **Avisar:** `Estudiante` sin `avisoRetencionEnviadoAt`, con `Usuario.ultimoAccesoAt` (o
  `createdAt` si nunca inició sesión) más viejo que `retencionCvMeses - retencionAvisoDias` →
  `correo.service.enviarCorreo(...)` → `avisoRetencionEnviadoAt = ahora`.
- **Eliminar:** `Estudiante` con `avisoRetencionEnviadoAt` puesto, más viejo que `retencionCvMeses`
  completos, y todavía no anonimizado (`nombres` distinto del texto fijo del paso 2 de arriba) →
  `eliminarCuenta(usuario.id)`.
El filtro "todavía no anonimizado" es lo que hace que la tarea no reintente para siempre sobre una
cuenta que ya se borró (nunca vuelve a tener actividad porque no puede volver a iniciar sesión).

## `GET /mi-cuenta/datos`
Una consulta a `Estudiante` + `repositories/estudiantes.repository.js obtenerRutDescifradoPorId`
(la misma función que ya usa el endpoint de coordinación, acá con el propio id) + `Archivo` del
`cvArchivoId` vigente + `Postulacion` con `Oferta`/`Empresa`/`PostulacionEvento` (mismo `attributes`
whitelist sin `motivo` que ya usa `postulaciones.service.js conEventos()` — no se repite código, se
llama a `postulacionesService.listarDeEstudiante` para la lista y un include propio con eventos para
la línea de tiempo).

## Config nueva
`env.retencionCvMeses` (`RETENCION_CV_MESES`, default 12 — ya estaba en `.env`/`.env.example` desde
una fase anterior sin que nada la leyera) y `env.retencionAvisoDias` (`RETENCION_AVISO_DIAS`, default
30, nueva) — regla de negocio con default, mismo criterio que
`slaRespuestaDias`/`plazoDeclararCierreDias`, no van en `REQUERIDAS`.

**El plazo de eliminación se cuenta desde que el aviso mismo cumple `retencionAvisoDias`, no desde
la fecha de inactividad directamente contra el total de `retencionCvMeses`.** La primera versión de
`procesarRetencion` comparaba la inactividad contra `retencionCvMeses` en las dos pasadas por
separado — un estudiante recién avisado en la primera pasada de una ejecución ya cumplía la
condición de la segunda en la misma corrida, y el "aviso previo" quedaba en cero días reales
(encontrado por `revisor-migraciones` al revisar la columna que sostiene este filtro, antes de
aplicar la migración). La segunda pasada filtra por la antigüedad del propio
`avisoRetencionEnviadoAt`, no por la inactividad total otra vez.

## Arreglo de paso, encontrado al revisar `correo.service.js`
`enviarCorreo()` registraba el correo del destinatario en el log (`logger.info({correo: para, ...})`)
en dos lugares — viola la regla dura de `CLAUDE.md` ("Nunca se registra en logs: ... correo"),
preexistente de Fase 1. Se corrige de paso porque esta tarea es la primera en llamar `enviarCorreo`
fuera del flujo de registro/recuperación, y no tiene sentido dejarlo para otra vez habiéndolo visto.

## Pruebas
- `cuenta.service.js`: exportación con perfil/CV/postulaciones, y con cada uno ausente; borrado
  verifica archivo fuera de disco, estudiante anonimizado, postulación intacta, login posterior con
  el correo real falla, sesión anterior queda revocada.
- `procesarRetencion`: con `ahora` inyectado (como las otras tareas) — avisa una vez, no dos; elimina
  al cumplirse el plazo completo; no reintenta sobre una cuenta ya anonimizada.
- Acceso cruzado: `GET /mi-cuenta/datos` y `DELETE /mi-cuenta` no llevan `:id` (siempre son "los
  propios"), así que la prueba de pertenencia es que dos estudiantes distintos consultando cada uno
  reciben solo lo suyo.

## Riesgos
Ninguno nuevo de permisos (las dos rutas nuevas actúan siempre sobre `req.usuario.id`, nunca sobre un
id de la URL). El riesgo real es de negocio: una vez anonimizado, no hay forma de deshacerlo — mismo
criterio ya aceptado para `suspender()` de empresas en Fase 2 (reactivar queda fuera de alcance,
documentado, no un olvido).
