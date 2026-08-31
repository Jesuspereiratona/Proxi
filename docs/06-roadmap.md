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
- [x] Migraciones de `usuarios`, `sesiones`, `consentimientos` (+ `tokens_verificacion`, ver `02-modelo-de-datos.md`)
- [x] Registro con verificación por correo y consentimiento explícito (correo real vía Ethereal en desarrollo)
- [x] Login con bcrypt, límite de 5 intentos por 15 min, bloqueo temporal
- [x] JWT de acceso + refresco rotativo en cookie httpOnly, con detección de reuso
- [x] Middlewares `autenticar` y `autorizar(...roles)`
- [x] Recuperación de contraseña con token de un solo uso
- [x] Ampliar `CAMPOS_CENSURADOS` de `config/logger.js`: agregados `clave`/`claveNueva` (los nombres
      reales de los esquemas de auth, no `password`) a nivel raíz y `req.body`
- [x] Pruebas: 42 pasan (credenciales inválidas, cuenta bloqueada, token expirado/reusado/inválido,
      rol equivocado, enumeración de usuarios, reuso de refresco)

**Listo cuando:** los tres roles pueden entrar y las rutas rechazan a quien no corresponde. **Cumplido
el 2026-08-29** — no hay todavía una ruta de negocio protegida para probar `autorizar` end-to-end
contra HTTP real; se probó con pruebas unitarias del middleware. La primera ruta de Fase 2 hereda esa
prueba de acceso cruzado a nivel de integración.

## Fase 2 · Perfiles y validación de empresas
- [x] Migraciones de `estudiantes` y `empresas`
- [x] Perfil de estudiante (RUT cifrado con pgcrypto) y de empresa
- [x] Flujo de validación: `pendiente` → `validada` / `rechazada` por coordinación (con reenvío
      automático a `pendiente` al editar un perfil rechazado)
- [x] Bloqueo: `services/empresas/reglas.js verificarValidada` listo para que Fase 3 lo use antes de
      publicar — todavía no hay ninguna ruta que la llame
- [x] Pruebas de acceso cruzado entre perfiles (73 pruebas, 0 fallas)

## Fase 3 · Ofertas y ciclo de vida ← el corazón del proyecto
Ver la especificación completa en `specs/01-ciclo-de-vida-oferta/`.

- [x] Migración de `ofertas` con las restricciones CHECK del modelo de datos
- [x] Migración de `oferta_eventos`
- [x] `services/ofertas/estados.js` con la tabla de transiciones
- [x] CRUD de borradores, envío a revisión, aprobación y rechazo
- [x] Cierre con motivo obligatorio y `resultado_declarado`
- [x] Bloqueo por cierres pendientes de declarar
- [x] Tarea `cerrarOfertasVencidas`, idempotente, con última ejecución expuesta en `GET /salud`
- [x] Listado público con filtros (área, modalidad, comuna, remunerada) y paginación
- [x] Pruebas: cada transición válida, cada transición inválida, vencimiento automático, condición de
      carrera entre transiciones simultáneas (198 pruebas, 0 fallas)
- [x] Extra sobre lo planeado: suspender una empresa (Fase 2) cierra en cascada sus ofertas publicadas
      y revierte a borrador las que estaban en revisión

**Listo cuando:** es imposible dejar una oferta publicada sin vigencia o cerrarla sin motivo.
**Cumplido el 2026-08-29** — garantizado por `CHECK` de base, no solo por código (ver bitácora).

## Fase 4 · Postulaciones
Ver la especificación completa en `specs/02-postulaciones/`.

- [x] Migraciones de `postulaciones`, `postulacion_eventos`, `archivos` — y `auditoria_accesos`,
      que estaba pendiente desde la Fase 2 sin caso de uso real hasta ahora
- [x] Subida de CV con validación de contenido real (número mágico `%PDF-`), nombre UUID, fuera del
      webroot (la API no sirve ningún directorio estático)
- [x] Descarga de CV por endpoint autorizado + registro en `auditoria_accesos`
- [x] Postular (única por oferta — `UNIQUE` de base, no solo de código —, congela el CV, solo a
      ofertas vigentes)
- [x] Cambio de estado por la empresa, con eventos (revisión, entrevista, selección, rechazo)
- [x] Retiro por el estudiante
- [x] Tarea `marcarSinRespuesta` según `SLA_RESPUESTA_DIAS`, idempotente, expuesta en `GET /salud`
- [x] Pruebas: duplicada (incluida en paralelo), oferta vencida, acceso cruzado a CV ajeno, SLA
      (215 pruebas nuevas, 378 en total, 0 fallas)
- [x] Extra sobre lo planeado: se conectó `estudiantes.controller.js obtenerRut` (Fase 2) a
      `auditoria_accesos`, que hasta ahora solo dejaba un rastro en el log

**Listo cuando:** ningún estudiante puede ver la postulación o el CV de otro, ninguna empresa puede
ver los de un estudiante que no le postuló, y ninguna postulación queda sin resolución si la
empresa no responde. **Cumplido el 2026-08-29** — auditado por `auditor-seguridad`, sin hallazgos
graves (ver bitácora).

## Fase 5 · Indicadores de transparencia
Ver la especificación completa en `specs/03-indicadores-transparencia/`.

- [x] Vista materializada `empresa_indicadores` + recálculo nocturno (`REFRESH ... CONCURRENTLY`,
      no bloquea lecturas mientras recalcula)
- [x] Endpoint público del perfil de empresa con indicadores — solo empresas validadas responden
      (pendiente/rechazada/suspendida dan 404, igual que una que no existe)
- [x] Umbral mínimo de 3 ofertas cerradas para mostrarlos
- [x] Panel de coordinación con el panorama general (API únicamente; el panel visual es Fase 6)
- [x] Extra sobre lo planeado: un segundo umbral por volumen de postulaciones (no solo de ofertas
      cerradas) para `tasaRespuesta`/`diasPromedioRespuesta` — encontrado por `auditor-seguridad`,
      ver bitácora

**Listo cuando:** una empresa con historial real muestra sus cuatro indicadores en público, una con
poco historial no muestra nada que pueda leerse como el trato de un caso puntual, y coordinación ve
el panorama completo sin ese filtro. **Cumplido el 2026-08-29.**

## Fase 6 · Cliente web

> **Esta fase todavía no está especificada. No empezar a programarla sin hacer esto primero.**
> A diferencia de la Fase 3, aquí solo hay una lista de casillas: falta el detalle de comportamiento.
> Antes de la primera pantalla, usar la skill `nueva-funcionalidad` y escribir:
> - `specs/04-vitrina-publica/` — qué se ve, cómo se filtra, qué muestra la tarjeta de una oferta,
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

Ver la especificación de la vitrina pública en `specs/04-vitrina-publica/`.

- [x] Vitrina pública responsiva con Bootstrap: tarjetas con "cierra en N días"
- [x] Detalle de oferta + perfil público de empresa con indicadores
- [x] Cliente HTTP central (`assets/js/api/`) — maneja 4xx/5xx/error de red con mensajes en
      español, y ya maneja 401 con refresco automático y reintento (ver login más abajo)
- [x] Login (`login.html`) y sesión: token de acceso solo en memoria (nunca `localStorage`), se
      repone en cada carga de página con la cookie `httpOnly` de Fase 1 — base para los tres
      paneles, ninguno puede empezar sin esto
- [x] Panel estudiante: perfil, CV, mis postulaciones con línea de tiempo de estados. Ver
      `specs/05-panel-estudiante/`
- [x] Panel empresa: mis ofertas, publicar, revisar postulantes, cerrar con motivo. Sin backend
      nuevo — todo ya existía desde las Fases 2 a 4, salvo el rastro de auditoría al ver postulantes
      y el include con nombre/carrera del postulante (whitelist explícita). Ver `specs/06-panel-empresa/`
- [x] Panel coordinación: validar empresas, moderar ofertas, ver indicadores. Última pantalla de
      Fase 6 — los tres roles ya pueden usar Proxi de punta a punta sin `curl`. Ver
      `specs/07-panel-coordinacion/`
- [x] Accesibilidad básica: verificada con capturas reales de Chrome headless en las cinco pantallas
      de la fase — labels, `aria-live`, foco visible por defecto de Bootstrap sin overrides, orden de
      tabulación natural del DOM
- [x] Extra sobre lo planeado: `GET /api/v1/empresas/:id` (perfil público de empresa), que
      ninguna fase anterior había expuesto
- [x] Extra sobre lo planeado: auditoría de seguridad de la primera entrega encontró y corrigió un
      XSS almacenado y un hueco de revisión humana (ver bitácora) — la vitrina fue la primera vez
      que el proyecto expuso un `href` construido con datos de un tercero
- [x] Extra sobre lo planeado: auditoría de seguridad de la sesión encontró y corrigió una carrera
      real entre refrescos de token que habría revocado sesiones de usuarios enteras (ver bitácora)
- [x] Extra sobre lo planeado: auditoría de seguridad del panel de estudiante encontró y corrigió una
      fuga de datos personales (nota de rechazo y actor interno visibles a la parte equivocada de una
      postulación) y un nombre de archivo sin sanear en la subida de CV (ver bitácora)
- [x] Extra sobre lo planeado: auditoría de seguridad del panel de empresa encontró y corrigió una
      falta de rastro de auditoría al ver datos de postulantes y un formulario que perdía en
      silencio el cambio de vaciar un campo opcional (ver bitácora)
- [x] Extra sobre lo planeado: auditoría de seguridad del panel de coordinación encontró y corrigió
      que coordinación aprobaba ofertas y validaba empresas sin ver el contenido que estaba
      moderando, un motivo de solo espacios que pasaba la validación en tres endpoints, y transiciones
      de empresa sin compare-and-set (ver bitácora)
- [x] Extra sobre lo planeado: registro público (`registro.html`, `verificar-correo.html`) — pantalla
      que faltaba desde que se abrió la fase; el backend (`POST /auth/registro`,
      `POST /auth/verificar-correo`) ya existía desde la Fase 1 sin tener desde dónde llamarse. Ver
      `specs/09-registro-web/`. La auditoría de seguridad encontró y corrigió, en el mismo paso, un
      hallazgo Grave introducido por la protección CSRF agregada en paralelo (la cookie `csrf`
      heredaba el path de la cookie de sesión y no era legible por ninguna página real, dejando
      `/auth/refrescar` y `/auth/logout` en 403 permanente), y cuatro hallazgos menores del propio
      registro: sin límite de tasa (permitía enumerar correos institucionales), la versión de la
      política de privacidad la fijaba el cliente en vez del servidor, el enlace del correo de
      verificación apuntaba a una URL que daba 404, y faltaba `Referrer-Policy` en la página que
      recibe el token por la URL (ver bitácora)

**Listo cuando:** los tres roles pueden usar Proxi de punta a punta sin `curl`, y cada pantalla que
toca autenticación, permisos o datos personales pasó por `auditor-seguridad` antes de subir.
**Cumplido el 2026-08-29** — cinco auditorías de seguridad a lo largo de la fase (vitrina, sesión,
panel de estudiante, panel de empresa, panel de coordinación), sin un solo hallazgo Alto o Grave que
llegara a producción sin corregir.

## Fase 7 · Datos personales
Ver la especificación de la parte de código en `specs/08-datos-personales/`.

- [x] `GET /mi-cuenta/datos` (portabilidad en JSON) — solo estudiantes; empresa/coordinación quedan
      fuera de este incremento (decisión explícita, ver spec)
- [x] `DELETE /mi-cuenta` (borra CV del disco, anonimiza perfil y el texto libre de postulaciones,
      inutiliza el correo, revoca sesiones)
- [x] Tarea de retención: aviso y eliminación tras inactividad (`RETENCION_CV_MESES`,
      `RETENCION_AVISO_DIAS`)
- [x] Procedimiento de brecha escrito y probado en seco — `docs/09-procedimiento-de-brecha.md`,
      simulacro del 30-08-2026 con 4 escenarios; encontró 7 huecos, repartidos abajo y en Fase 8
- [x] Hueco 2 del simulacro: revocación global de sesiones — `npm run revocar-sesiones -w apps/api`.
      A propósito no es un endpoint HTTP: uno autenticado por JWT sería vulnerable justo al escenario
      (secreto comprometido) que este script existe para responder
- [x] Hueco 4 del simulacro: correo de contacto de privacidad en la política y en el pie de las 13
      páginas. Dirección provisoria (`uahmarketcl@gmail.com`), marcada como tal hasta que la FEN asigne
      una casilla real
- [x] Hueco 7 del simulacro: columna `user_agent` en `auditoria_accesos` (migración reversible)
- [x] Borrador de política de privacidad publicado y versionado (`apps/web/politica-privacidad.html`,
      versión `2026-08-30-borrador`) — le da al registro un documento real al que apuntar; **no** es
      el texto final, ver bloqueados
- [x] Registro de actividades de tratamiento (`docs/legal/registro-actividades-tratamiento.md`) — la
      "responsabilidad proactiva" que exige la Ley 21.719: cada dato, su finalidad, base de licitud,
      plazo y destinatarios, levantado desde el código y no desde una plantilla
- [x] Borradores completos de política de privacidad y términos de uso en `docs/legal/`, más
      `00-que-debe-revisar-un-abogado.md`: diez decisiones concretas para la revisión legal, en vez
      de un "léete esto y dinos si está bien"
- [x] Extra sobre lo planeado: auditoría de seguridad encontró y corrigió dos hallazgos Graves (la
      tarea de retención podía eliminar una cuenta activa sin un aviso vigente para ese ciclo de
      inactividad) y uno Alto (el texto libre que el estudiante escribió — mensaje de postulación,
      motivo de un retiro — seguía visible para la empresa después de la supresión). Ver bitácora —
      es la auditoría más extensa del proyecto hasta ahora.

### Bloqueado — espera a un tercero, no a nosotros
No es lo mismo que "pendiente": nuestra parte está hecha y lo que falta no depende de este proyecto.
Mezclarlos en una sola lista esconde qué se puede avanzar hoy y qué no.

- [ ] **Política de privacidad, texto final** — bloqueado por revisión legal de la FEN. Nuestra parte
      está lista: borrador completo en `docs/legal/politica-privacidad.md` (`2026-08-30-borrador-3`)
      y versión reducida ya publicada y enlazada desde el registro y el pie.
- [ ] **Términos de uso, texto final** — bloqueado por lo mismo. Borrador completo en
      `docs/legal/terminos-de-uso.md` (`2026-08-30-borrador-2`), sin publicar todavía.
- [ ] **Las diez decisiones de `docs/legal/00-que-debe-revisar-un-abogado.md`.** Tres de ellas
      (consentimiento libre, estudiantes menores de edad, transferencia internacional) **bloquean
      código, no solo texto**: según la respuesta cambia el flujo de registro, hay que pedir la edad,
      o cambia el proveedor de hosting. No se pueden dejar para el final.

> **Plantillas disponibles como punto de partida** (fuera del repo, en `proyectos/Skills/Legal y
> Cumplimiento.zip`): `politica-privacidad`, `lista-cumplimiento-gdpr`, `acuerdo-procesamiento-datos`
> y `terminos-servicio`. Son genéricas y están escritas para marco GDPR/EE.UU., no para la Ley 21.719
> chilena: sirven como esqueleto, **nunca como texto final**. Si la plataforma opera con datos reales
> de estudiantes, estos documentos los revisa alguien con formación legal de la facultad.

El **DPA** ya no está en esta fase: se movió a Fase 8, donde vive la decisión de hosting de la que
depende. No se puede firmar un acuerdo de procesamiento con un proveedor que todavía no se eligió.

**Listo cuando (la parte de código):** un estudiante puede pedir y borrar sus propios datos sin
`curl`, el borrado es de verdad irreversible y no dañado por un fallo a mitad de camino, y nadie
queda eliminado sin haber recibido antes un aviso vigente. **Cumplido el 2026-08-29.**
**Fase cerrada por nuestra parte el 2026-08-30**: el procedimiento de brecha está escrito y probado
en seco, sus tres huecos accionables están tapados, y los documentos legales están redactados hasta
donde puede llegar un desarrollador. Lo que queda espera a la facultad — con la salvedad de que tres
de las diez decisiones legales bloquean código, así que la Fase 8 no debería cerrarse sin ellas.

## Fase 8 · Despliegue
- [ ] Base gestionada con respaldos automáticos y restauración **probada**
- [ ] Variables de entorno en el proveedor, secretos rotados
- [ ] DPA (acuerdo de procesamiento de datos) con el proveedor de hosting — venía de Fase 7; se movió
      acá porque depende de qué proveedor se elija, decisión que se toma en esta fase
- [ ] Apagado ordenado del servidor (`SIGTERM` + `server.close()` con temporizador) antes de que el
      supervisor del proveedor mate el proceso — hoy corta peticiones en vuelo en cada despliegue
- [ ] Lock distribuido para `tareas/cerrarOfertasVencidas.js` (`pg_advisory_lock` o similar) si se
      corre más de una instancia de la API — hoy el cron se programa por proceso, sin coordinación
      entre réplicas (auditoría de Fase 3; con una sola instancia no es un problema)
- [ ] HTTPS obligatorio, redirección desde HTTP
- [ ] Monitoreo del healthcheck con aviso ante caídas
- [ ] Hueco 1 del simulacro: vigilancia de `auditoria_accesos` — línea base y aviso por volumen anómalo
- [ ] Hueco 3 del simulacro: poder notificar por correo a N personas afectadas (hoy solo transaccional)
- [ ] Hueco 5 del simulacro: la llave de cifrado se respalda **separada** de la base
- [ ] Hueco 6 del simulacro: definir retención de logs (si la brecha se detecta tarde, tiene que haber con qué investigar)
- [ ] Retención de `auditoria_accesos`: hoy crece sin límite y guarda `usuario_id` + `ip` +
      `user_agent` para siempre, incluso de cuentas ya suprimidas — `eliminarCuenta` no la toca a
      propósito (es evidencia), pero el otro extremo quedó abierto. Fijar una ventana en
      `docs/03-seguridad.md` (12–24 meses cubre las 72 h de notificación y la revisión anual) y una
      tarea de purga con el patrón de `procesarRetencion`
- [ ] CI nunca ejercita el `down` de las migraciones: un `down` roto se descubre en producción, en el
      peor momento. Agregar `db:migrate:undo` + `db:migrate` después de `npm test` en `ci.yml`
- [ ] Runbook de operación en `07-operacion-y-mantenimiento.md`

---

## Riesgos conocidos
| Riesgo | Mitigación |
|---|---|
| Crecer el alcance sin terminar el núcleo | Nada entra a la v1 sin salir en el alcance de `00-vision-y-alcance.md` |
| Las tareas programadas fallan en silencio | Registran resultado y el healthcheck expone su última ejecución |
| El almacenamiento local de CVs se pierde | Los CVs se incluyen en el plan de respaldo desde la fase 4 |
| Falta de tiempo para la fase 7 | Es requisito legal, no un extra: si algo se recorta, se recorta la fase 5 |
