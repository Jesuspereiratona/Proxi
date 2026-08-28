# 06 · Roadmap

Ocho fases en orden de dependencia. Cada fase termina con algo que se puede probar y mostrar.
No se empieza una fase con la anterior a medias: así es como se acumulan bugs que nadie encuentra.

Marcar el avance aquí mismo: `[ ]` → `[x]`, y anotar en la bitácora lo que valga la pena recordar.

---

## Fase 0 · Fundaciones
Sin esto, todo lo demás se construye sobre arena.

- [x] `git init`, primer commit con la documentación
- [x] Estructura de `apps/api/src` según `01-arquitectura.md`
- [x] `config/` que valide las variables de entorno y **falle al arrancar** si falta una
- [x] Conexión a PostgreSQL con Sequelize y `docker compose up db` funcionando
- [x] `GET /api/v1/salud` respondiendo estado de la app y de la base
- [x] Clases de error + `manejadorErrores` + `asyncHandler`
- [x] Logger pino con `peticionId` y censura de campos sensibles
- [x] `helmet`, `cors` con lista blanca, límite de tasa global
- [x] `node --test` + supertest corriendo con una prueba del healthcheck (ver ADR 0003, se reemplazó Jest)
- [x] CI en GitHub Actions: instalar, lint, pruebas, `npm audit` — verde en `github.com/Jesuspereiratona/Proxi`, run `056b9fa`

**Listo cuando:** `npm test` pasa en CI y `/api/v1/salud` responde 200. **Cumplido el 2026-08-28.**

## Fase 1 · Identidad
- [ ] Migraciones de `usuarios`, `sesiones`, `consentimientos`
- [ ] Registro con verificación por correo y consentimiento explícito
- [ ] Login con bcrypt, límite de 5 intentos por 15 min, bloqueo temporal
- [ ] JWT de acceso + refresco rotativo en cookie httpOnly
- [ ] Middlewares `autenticar` y `autorizar(...roles)`
- [ ] Recuperación de contraseña con token de un solo uso
- [ ] Ampliar `CAMPOS_CENSURADOS` de `config/logger.js` a las formas reales que tomen los payloads de
      login/registro antes de loguear nada de esas rutas (hoy solo cubre raíz y `req.body`, un nivel)
- [ ] Pruebas: credenciales inválidas, token expirado, rol equivocado, enumeración de usuarios

**Listo cuando:** los tres roles pueden entrar y las rutas rechazan a quien no corresponde.

## Fase 2 · Perfiles y validación de empresas
- [ ] Migraciones de `estudiantes` y `empresas`
- [ ] Perfil de estudiante (RUT cifrado) y de empresa
- [ ] Flujo de validación: `pendiente` → `validada` / `rechazada` por coordinación
- [ ] Bloqueo: empresa no validada no puede publicar
- [ ] Pruebas de acceso cruzado entre perfiles

## Fase 3 · Ofertas y ciclo de vida ← el corazón del proyecto
Ver la especificación completa en `specs/01-ciclo-de-vida-oferta/`.

- [ ] Migración de `ofertas` con las restricciones CHECK del modelo de datos
- [ ] Migración de `oferta_eventos`
- [ ] `services/ofertas/estados.js` con la tabla de transiciones
- [ ] CRUD de borradores, envío a revisión, aprobación y rechazo
- [ ] Cierre con motivo obligatorio y `resultado_declarado`
- [ ] Bloqueo por cierres pendientes de declarar
- [ ] Tarea `cerrarOfertasVencidas`, idempotente
- [ ] Listado público con filtros (área, modalidad, comuna) y paginación
- [ ] Pruebas: cada transición válida, cada transición inválida, vencimiento automático

**Listo cuando:** es imposible dejar una oferta publicada sin vigencia o cerrarla sin motivo.

## Fase 4 · Postulaciones
- [ ] Migraciones de `postulaciones`, `postulacion_eventos`, `archivos`
- [ ] Subida de CV con validación de contenido real, nombre UUID, fuera del webroot
- [ ] Descarga de CV por endpoint autorizado + registro en `auditoria_accesos`
- [ ] Postular (única por oferta, congela el CV, solo a ofertas vigentes)
- [ ] Cambio de estado por la empresa, con eventos
- [ ] Retiro por el estudiante
- [ ] Tarea `marcarSinRespuesta` según SLA
- [ ] Pruebas: duplicada, oferta vencida, acceso cruzado a CV ajeno, SLA

## Fase 5 · Indicadores de transparencia
- [ ] Vista materializada `empresa_indicadores` + recálculo nocturno
- [ ] Endpoint público del perfil de empresa con indicadores
- [ ] Umbral mínimo de 3 ofertas cerradas para mostrarlos
- [ ] Panel de coordinación con el panorama general

## Fase 6 · Cliente web

> **Esta fase todavía no está especificada. No empezar a programarla sin hacer esto primero.**
> A diferencia de la Fase 3, aquí solo hay una lista de casillas: falta el detalle de comportamiento.
> Antes de la primera pantalla, usar la skill `nueva-funcionalidad` y escribir:
> - `specs/02-vitrina-publica/` — qué se ve, cómo se filtra, qué muestra la tarjeta de una oferta,
>   qué pasa cuando no hay resultados, cómo se comunica "cierra en 3 días" frente a "vencida".
> - `docs/08-guia-visual.md` — sistema visual mínimo sobre Bootstrap: colores, tipografía y sobre todo
>   **cómo se ve cada estado**. El estado es el producto: si `publicada`, `cierra pronto` y `cerrada`
>   no se distinguen de un vistazo, el diferenciador del proyecto se pierde en la pantalla.
> - Los textos de error en lenguaje humano. `OFERTA_NO_VIGENTE` es un código interno; al estudiante se
>   le dice "esta oferta cerró el 12 de septiembre".
> - Accesibilidad como criterio de aceptación, no como casilla suelta: etiquetas en los formularios,
>   foco visible, contraste suficiente, navegación completa por teclado.
>
> Se dejó para después a propósito: especificar pantallas antes de que exista la API es dibujar sobre
> datos que todavía no existen. Pero "después" no es "nunca".

- [ ] Vitrina pública responsiva con Bootstrap: tarjetas con "cierra en N días"
- [ ] Detalle de oferta + perfil público de empresa con indicadores
- [ ] Cliente HTTP central (`assets/js/api/`) con manejo de 401/403/422/429/5xx
- [ ] Panel estudiante: perfil, CV, mis postulaciones con línea de tiempo de estados
- [ ] Panel empresa: mis ofertas, publicar, revisar postulantes, cerrar con motivo
- [ ] Panel coordinación: validar empresas, moderar ofertas, ver indicadores
- [ ] Accesibilidad básica: etiquetas, foco visible, contraste, navegación por teclado

## Fase 7 · Datos personales
- [ ] `GET /mi-cuenta/datos` (portabilidad en JSON)
- [ ] `DELETE /mi-cuenta` (borra CV, anonimiza postulaciones)
- [ ] Tarea de retención: aviso y eliminación tras inactividad
- [ ] Política de privacidad versionada y visible
- [ ] Procedimiento de brecha escrito y probado en seco

## Fase 8 · Despliegue
- [ ] Base gestionada con respaldos automáticos y restauración **probada**
- [ ] Variables de entorno en el proveedor, secretos rotados
- [ ] Apagado ordenado del servidor (`SIGTERM` + `server.close()` con temporizador) antes de que el
      supervisor del proveedor mate el proceso — hoy corta peticiones en vuelo en cada despliegue
- [ ] HTTPS obligatorio, redirección desde HTTP
- [ ] Monitoreo del healthcheck con aviso ante caídas
- [ ] Runbook de operación en `07-operacion-y-mantenimiento.md`

---

## Riesgos conocidos
| Riesgo | Mitigación |
|---|---|
| Crecer el alcance sin terminar el núcleo | Nada entra a la v1 sin salir en el alcance de `00-vision-y-alcance.md` |
| Las tareas programadas fallan en silencio | Registran resultado y el healthcheck expone su última ejecución |
| El almacenamiento local de CVs se pierde | Los CVs se incluyen en el plan de respaldo desde la fase 4 |
| Falta de tiempo para la fase 7 | Es requisito legal, no un extra: si algo se recorta, se recorta la fase 5 |
