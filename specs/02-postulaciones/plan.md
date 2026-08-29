# Plan técnico · Postulaciones

## Dependencia nueva
`multer` (`^2.3.0`) — Node no trae parser de `multipart/form-data`. Es el estándar de facto en
Express para subida de archivos; se usa en modo `memoryStorage()` (el buffer se valida antes de
tocar disco, nunca se confía en el nombre ni en el `mimetype` que manda el cliente). Aprobado por
el usuario antes de agregarlo, según `CLAUDE.md`.

## Cambios en el modelo de datos
Cuatro tablas nuevas, en este orden (cada una depende de la anterior):

1. **`archivos`** — ya descrita en `docs/02-modelo-de-datos.md`. `propietario_usuario_id` FK
   `usuarios` `onDelete: CASCADE`. `tipo` CHECK `cv`/`logo` (solo se usa `cv` en esta fase).
   `nombre_almacenado` UNIQUE.
2. **Alterar `estudiantes`**: agregar la FK de `cv_archivo_id` → `archivos.id` (`onDelete: SET
   NULL`) que la migración de Fase 2 dejó pendiente a propósito («la tabla archivos no existe hasta
   Fase 4»).
3. **`postulaciones`** — `UNIQUE(oferta_id, estudiante_id)` a nivel de base, no solo de código: es
   la defensa real contra la postulación duplicada en paralelo. `cv_archivo_id` FK `archivos`
   `onDelete: RESTRICT` — nunca se debe poder borrar un archivo que una postulación sigue
   necesitando. `oferta_id`/`estudiante_id` `onDelete: CASCADE`. CHECK de `estado` con los 7
   valores de la máquina de estados.
4. **`postulacion_eventos`** — mismo patrón append-only que `oferta_eventos` (Fase 3): sin
   `updated_at`, `actor_usuario_id` nullable con `onDelete: SET NULL`.
5. **`auditoria_accesos`** — la tabla que `docs/03-seguridad.md` exige desde la Fase 2 pero que no
   había ningún caso de uso real hasta ahora. `usuario_id` FK `usuarios` `onDelete: CASCADE`.

## Endpoints
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/v1/estudiantes/mi-cv` | estudiante | Sube (o reemplaza) el CV propio |
| GET | `/api/v1/archivos/:id/descarga` | cualquiera autenticado | Descarga con control de permiso dentro del servicio |
| POST | `/api/v1/postulaciones` | estudiante | Postula a una oferta |
| GET | `/api/v1/postulaciones/mias` | estudiante | Lista las postulaciones propias |
| GET | `/api/v1/postulaciones/oferta/:id` | empresa | Lista las postulaciones de una oferta propia |
| GET | `/api/v1/postulaciones/:id` | estudiante dueño / empresa dueña / coordinación | Detalle |
| POST | `/api/v1/postulaciones/:id/revision` | empresa | `recibida → en_revision` |
| POST | `/api/v1/postulaciones/:id/entrevista` | empresa | `en_revision → entrevista` |
| POST | `/api/v1/postulaciones/:id/seleccion` | empresa | `entrevista → seleccionada` |
| POST | `/api/v1/postulaciones/:id/rechazo` | empresa | `{recibida,en_revision,entrevista} → no_seleccionada` |
| POST | `/api/v1/postulaciones/:id/retiro` | estudiante | cualquier estado no terminal `→ retirada` |

Un endpoint por transición, no un `PATCH` genérico de estado — mismo patrón que
`services/ofertas/*` en Fase 3, por la misma razón: cada ruta declara su propio esquema de entrada
y su propio permiso, y ninguna permite un `update({estado})` suelto.

No hay ruta para GET del CV propio: el estudiante ya tiene `cvArchivoId` en `GET
/estudiantes/perfil` (Fase 2) y descarga con `GET /archivos/:id/descarga`, el mismo endpoint que
usa cualquiera con permiso.

## Servicios y reglas

### `services/postulaciones/estados.js`
Tabla de transiciones como datos, igual patrón que `services/ofertas/estados.js`:
```js
const TRANSICIONES = {
  recibida:      { en_revision: ['empresa'], no_seleccionada: ['empresa'], retirada: ['estudiante'], sin_respuesta: ['sistema'] },
  en_revision:   { entrevista: ['empresa'],  no_seleccionada: ['empresa'], retirada: ['estudiante'], sin_respuesta: ['sistema'] },
  entrevista:    { seleccionada: ['empresa'], no_seleccionada: ['empresa'], retirada: ['estudiante'], sin_respuesta: ['sistema'] },
  seleccionada: {}, no_seleccionada: {}, sin_respuesta: {}, retirada: {},
};
```

### `services/postulaciones/reglas.js`
`fechaLimiteSla(ahora)` — pura, con reloj inyectado (mismo patrón que
`fechaLimiteDeclaracion` de ofertas), para poder probar el SLA con fechas fijas.

### `services/postulaciones/postulaciones.service.js`
- `postular(usuarioId, {ofertaId, mensaje})`: valida CV del estudiante, vigencia de la oferta
  (reutiliza `ofertasReglas.verificarVigencia`, construida a propósito en Fase 3 para esto), crea
  la postulación + su primer evento en una transacción. Si la restricción `UNIQUE` de la base
  rechaza el `INSERT` (dos postulaciones en paralelo), se traduce a `POSTULACION_YA_EXISTE` en vez
  de dejar pasar el error crudo de Postgres — la misma idea que el compare-and-set de `ofertas`,
  pero apoyada en la restricción de unicidad porque acá la operación es un `CREATE`, no un
  `UPDATE`.
- `transicionar(...)`: mismo compare-and-set de `ofertas.service.js` — `UPDATE ... WHERE id=? AND
  estado=?`, 0 filas afectadas ⇒ `Conflicto`. Actualiza `estadoActualizadoAt` (base del cálculo de
  SLA) en cada cambio, y `respondidaPorEmpresa=true` cuando el actor es `'empresa'`.
  `sin_respuesta` (actor `sistema`) deja `respondidaPorEmpresa` en `false`: distingue una decisión
  real de un silencio, como exige `docs/02-modelo-de-datos.md`.
- `obtenerPropiaDeEmpresa(empresaId, id)`: pertenencia verificada con un `include` de `Oferta` con
  `where: {empresaId}` dentro de la misma consulta — no un `findByPk` seguido de un `if`.
- `marcarSinRespuesta(ahora)`: mismo patrón que `cerrarVencidas` de Fase 3 — recorre las vencidas,
  cada una en su propio `try/catch`, devuelve `{marcadas, fallidas}`, no aborta el lote completo
  por una fila problemática.

### `services/archivos/archivos.service.js`
- `subirCv(usuarioId, archivoMulter)`: valida el número mágico `%PDF-` sobre el buffer (nunca el
  `mimetype` del cliente), genera un nombre UUID, escribe a `env.uploadDir` (fuera de cualquier
  carpeta que la API sirva como estática — hoy no sirve ninguna), crea la fila `archivos` y
  actualiza `estudiante.cvArchivoId`. **No borra el archivo anterior**: puede seguir referenciado
  por postulaciones ya enviadas (la regla del CV congelado se cumple por construcción, no
  reemplazando nunca un archivo existente).
- `descargar(archivoId, usuarioActual, ip)`: resuelve permiso según rol —
  coordinación siempre, estudiante solo el propio, empresa solo si existe una `Postulacion` con
  ese `cvArchivoId` sobre una oferta de su propiedad (mismo `include`+`where` que
  `obtenerPropiaDeEmpresa`). Sin permiso o sin archivo ⇒ mismo `NoEncontrado` en ambos casos, para
  no confirmar si el id existe. Si hay permiso, inserta la fila en `auditoria_accesos` antes de
  devolver la ruta.

## Errores nuevos
`POSTULACION_NO_ENCONTRADA` (404), `POSTULACION_YA_EXISTE` (409), `POSTULACION_SIN_CV` (422,
`ReglaDeNegocio`), `POSTULACION_TRANSICION_INVALIDA` (409), `ARCHIVO_INVALIDO` (422),
`ARCHIVO_NO_ENCONTRADO` (404).

## Consideraciones de seguridad
- Las cuatro rutas de transición de empresa y la de retiro del estudiante verifican pertenencia
  dentro de la consulta, nunca con un `if` después de traer la fila.
- La descarga de CV es el punto de mayor riesgo de la fase (dato personal completo). Se prueba con
  los tres roles y con un cuarto caso: empresa sin relación con el estudiante.
- Toda descarga y toda lectura de RUT descifrado (Fase 2, hasta ahora solo en el log) pasan a
  quedar en `auditoria_accesos` — se aprovecha esta fase para conectar `estudiantes.controller.js
  obtenerRut` a la tabla real, cerrando la nota pendiente que dejó esa ruta.
- El contenido del PDF nunca se confía por nombre ni `Content-Type`; se valida el número mágico
  sobre el buffer recibido.
- `nombre_original` del archivo nunca se usa para construir una ruta de disco, solo se muestra.
- `cv` ya está en la lista de censura del logger desde Fase 2; se revisa que ningún log nuevo de
  esta fase pase el buffer, la ruta absoluta ni el contenido del archivo.
- Multer expone sus propios errores (`MulterError`, p. ej. archivo demasiado grande) al mismo
  middleware de errores central — se agrega un caso más junto al de `SyntaxError` de JSON que ya
  existe, no un manejador aparte.

## Pruebas
- Unitarias: matriz completa de `services/postulaciones/estados.js` (mismo patrón que
  `ofertas-estados.test.js`), y `fechaLimiteSla` con reloj fijo.
- Integración (`apps/api/tests/postulaciones.test.js`, dominio propio
  `postulaciones.uahurtado.test`):
  - Los 17 criterios de aceptación de `spec.md`.
  - Postulación duplicada real: dos `POST /postulaciones` simultáneos con `Promise.all`, se espera
    `[201, 409]` y exactamente una fila en la base.
  - Acceso cruzado: estudiante contra postulación ajena (404), empresa contra postulación de otra
    empresa (404), empresa contra CV de un estudiante que nunca le postuló (404).
  - SLA: postulación con `estadoActualizadoAt` forzado al pasado, corre la tarea, verifica
    `sin_respuesta` y `respondidaPorEmpresa=false`; correrla de nuevo no cambia nada.
  - Subida de CV: PDF real (acepta), texto plano renombrado `.pdf` (rechaza), sin importar el
    `Content-Type` declarado.

## Riesgos
- **Almacenamiento local de CVs.** `docs/06-roadmap.md` ya lo anota como riesgo conocido con
  mitigación en el plan de respaldo — no se resuelve en esta fase, se hereda tal cual.
- **Sin antivirus sobre el PDF** (`docs/03-seguridad.md`, riesgo aceptado documentado).
- Un solo directorio de almacenamiento sin rotación de espacio: con archivos de hasta 5 MB y el
  volumen esperado de un solo semestre, no es un problema todavía; se revisita si el disco del
  hosting lo exige (Fase 8).
