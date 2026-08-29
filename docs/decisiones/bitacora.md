# Bitácora de decisiones

Registro cronológico, lo más reciente arriba. Aquí va lo que **no** es obvio leyendo el código: por qué
se eligió algo, qué se descartó, qué salió mal.

Se anota cuando: se toma una decisión técnica no evidente · se descarta una alternativa · se cambia
algo ya decidido · se resuelve un bug cuya causa costó encontrar · se instala una dependencia.

Formato:
```
## AAAA-MM-DD · Título corto
**Contexto:** qué situación lo provocó.
**Decisión:** qué se hizo.
**Motivo:** por qué, y qué se descartó.
**Consecuencia:** con qué hay que vivir ahora.
```

---

## 2026-08-29 · Fase 1 (Identidad): decisiones de la implementación
**Contexto:** `specs/02-identidad/` quedó aprobada con varias decisiones ya anotadas ahí (tabla
`tokens_verificacion`, columna `intentos_fallidos_desde`, Ethereal para correo). Durante la
implementación aparecieron otras, más chicas, que no estaban en el plan.
**Decisiones:**
- **Bloqueo de cuenta = 403, no 401.** Cinco fallos de login lanzan `NoAutorizado` (403), no
  `NoAutenticado` (401): la identidad puede ser correcta, lo que falta es permiso temporal. Es la
  única situación de Fase 1 donde se revela (a propósito) que una cuenta existe y está bloqueada.
- **Comparación de tiempo constante contra correos inexistentes.** `login()` corre
  `bcrypt.compare` contra un hash dummy fijo aunque el correo no exista, para que el tiempo de
  respuesta no delate qué correos están registrados.
- **`sequelize-cli` con un solo config para los tres entornos.** `config/config-cli.js` reexporta
  `config/env.js` bajo `development`/`test`/`production`: como `env.js` ya resolvió las variables
  reales del proceso, sequelize-cli no necesita (ni debe) tener su propia copia de la lógica de
  entorno.
- **`node --require ./scripts/entorno-prueba.js` fuerza `NODE_ENV=test` en `npm test` local.** Sin
  esto, correr pruebas localmente usa el `NODE_ENV=development` del `.env` y dispara Ethereal de
  verdad en cada corrida (lento, depende de red). CI ya lo hacía bien porque fija `NODE_ENV` como
  variable real del job; esto solo cierra la brecha local. Sin dependencias nuevas.
**Bugs encontrados probando a mano antes de escribir las pruebas automatizadas** (ver
`specs/02-identidad/`):
- El limitador de tasa de `/auth/login` y `/auth/recuperar-clave` era la **misma instancia** de
  `express-rate-limit`, así que compartían contador: agotar los 5 intentos en uno bloqueaba el otro
  para el mismo correo. Ahora `limitar-tasa-auth.middleware.js` exporta una fábrica y cada ruta
  monta la suya.
- `restablecerClave` no reseteaba `intentos_fallidos`: alguien a un fallo del bloqueo que
  recuperaba su clave por correo seguía con el contador viejo. Ahora se resetea en la misma
  transacción.
- El campo real de contraseña en los esquemas es `clave`/`claveNueva`, no `password`; no estaba en
  `CAMPOS_CENSURADOS` de `config/logger.js`. Se agregó y se verificó con una prueba manual que
  compara la salida del logger antes y después.
**Consecuencia:** las próximas fases que agreguen un límite de tasa específico por ruta deben usar el
mismo patrón de fábrica, no una instancia compartida entre rutas con distinto propósito.

## 2026-08-28 · Bug: la CI fallaba dos veces después del primer push
**Contexto:** al verificar el primer run de CI, dos problemas aparecieron uno detrás del otro.
**Decisión 1:** `WEB_URL` se agregó al bloque `env` de `ci.yml`. Había pasado a `REQUERIDAS` en
`config/env.js` en el commit de la auditoría, pero nadie actualizó el workflow — la CI nunca se había
corrido hasta ese punto, así que nada lo había detectado antes.
**Decisión 2, más sutil:** `npm run db:migrate --if-present` seguía fallando después de eso. Los
scripts `db:migrate`/`db:seed` de Fase 0 apuntaban a `npx sequelize-cli db:migrate` sin que existiera
`config/config.json` ni ninguna migración — `--if-present` solo salta un script que **no existe**, no
uno que existe y falla al correr. Se sacaron ambos scripts (raíz y `apps/api`) hasta que Fase 1 los
necesite de verdad, junto con la config real de `sequelize-cli`.
**Motivo:** son placeholders que nunca se probaron porque nada los ejecutaba en local (`npm test` no
pasa por ahí). Solo la CI, corriendo por primera vez, los expuso.
**Consecuencia:** cualquier script nuevo que dependa de una herramienta externa (sequelize-cli, algo de
Fase 4/5) se agrega junto con su configuración mínima funcionando, no antes — un script que falla al
correr es peor que uno ausente, porque `--if-present` no lo protege.

## 2026-08-28 · Auditoría de seguridad de Fase 0, antes del primer push
**Contexto:** primer código real a punto de subir a GitHub. `auditor-seguridad` revisó config, errores,
logger, middlewares y el healthcheck. Encontró 2 hallazgos altos activos ya (no hipotéticos) y varios
medios; el detalle completo del reporte no se guarda aquí, solo lo que cambió y por qué.
**Decisión — arreglado antes del push:**
- `manejadorErrores` traduce el `SyntaxError` de `express.json()` a `422 JSON_INVALIDO` y registra el
  error con una lista blanca de campos (`tipo`, `mensaje`, `codigo`, `stack`), nunca el objeto completo.
  Antes, un JSON mal formado dejaba el cuerpo crudo de la petición en el log tal cual, sin pasar por la
  censura del logger (que no cubre la propiedad `body` de un `SyntaxError`).
- `detalles` en la respuesta de error ahora exige `esOperacional`, igual que `mensaje`: antes un
  `ErrorInterno` con `detalles` los devolvía al cliente aunque el mensaje estuviera enmascarado.
- `WEB_URL` pasó a variable obligatoria: tenía un default silencioso a `localhost:5173` que, con
  `credentials: true`, es un hueco de CORS si se olvida configurar en un despliegue real.
- `NODE_ENV` se valida contra una lista blanca (`development`/`test`/`production`) y `env.esProduccion`
  / `env.esDesarrollo` reemplazan las comparaciones de string sueltas. Antes, un typo como
  `NODE_ENV=produccion` hacía que `/api/v1/salud` (pública, sin auth) devolviera el mensaje de error de
  Sequelize completo.
- `database.js` fuerza TLS (`ssl.require`) cuando `env.esProduccion`.
- `app.js`: `trust proxy` a 1 salto en producción (sin esto, el límite de tasa cuenta a todos los
  usuarios detrás del mismo proxy como una sola IP) y `peticionId` pasa a UUID en vez del contador
  incremental de pino-http (filtraba volumen de tráfico).
- Las 7 subclases de error generadas por el factory de `errors/index.js` tenían `error.name` vacío
  (las class expressions no heredan el nombre de la variable externa); se fija con
  `Object.defineProperty`.
- `salud.service.js` cachea el resultado 5 segundos: sin eso, el límite de tasa permitía 300
  `sequelize.authenticate()` por ventana contra un pool de 5 conexiones.
- `docker-compose.yml` publica Postgres en `127.0.0.1:5433`, no `0.0.0.0`: ya no es alcanzable desde
  otra máquina en la misma red.
**Motivo:** ninguno de estos requería una decisión de diseño nueva, solo cerrar huecos entre lo que el
código decía hacer (los comentarios y docs/03-seguridad.md) y lo que hacía. El de mayor impacto es el
del log: activa en Fase 0 sin que exista todavía ningún endpoint que reciba datos personales.
**Descartado por ahora:** apagado ordenado con `SIGTERM`/`server.close()` (Fase 8, cuando exista un
despliegue real que lo necesite) y redacción recursiva del logger por profundidad arbitraria (la lista
explícita a nivel raíz + `req.body` cubre los patrones que el código de hoy usa; se amplía cuando Fase 1
introduzca formas nuevas de loguear).
**Consecuencia:** cualquier `log.error`/`log.warn` nuevo debe pasar por una forma explícita (como
`errParaLog` en el manejador), no por el objeto de error completo. Cualquier variable de entorno nueva
que sea un control de seguridad (como `WEB_URL`) va a `REQUERIDAS`, nunca con default silencioso.

## 2026-08-28 · Bug: `npm test -w apps/api` no encontraba el `.env` de la raíz
**Contexto:** primer `npm test` real, con Docker ya corriendo. `config/env.js` moría diciendo que
faltaban las 8 variables obligatorias, aunque `.env` existía y estaba completo.
**Decisión:** `env.js` ahora resuelve la ruta del `.env` con `path.resolve(__dirname, '../../../../.env')`
en vez de `dotenv.config()` sin argumentos.
**Motivo:** `dotenv.config()` busca `.env` relativo a `process.cwd()`, y `npm test --workspaces` (y
`npm run dev -w apps/api`) cambian el cwd al directorio del workspace (`apps/api`), no la raíz del
monorepo donde vive el `.env` real. Como sí funcionaba corriendo `node src/server.js` a mano desde la
raíz, el bug solo aparecía a través de npm — costó un rato aislar que no era un problema de Docker ni
de las variables mismas.
**Consecuencia:** cualquier script nuevo en `apps/api/package.json` que dependa de `config/env.js`
sigue funcionando sin importar desde dónde se invoque. Puerto real usado en este arranque: Postgres en
`5433` (host) por conflicto con otro contenedor local — ya reflejado en `.env.example` y `docker-compose.yml`.

## 2026-08-28 · Fase 0: qué variables son obligatorias al arrancar
**Contexto:** `config/env.js` debe fallar al arrancar si falta una variable, pero `.env.example` tiene
17 claves y varias (SMTP, límites de negocio) no las usa todavía ningún código de esta fase.
**Decisión:** obligatorias solo `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — exactamente las que ya exige `.github/workflows/ci.yml`.
El resto tiene default en código (`PORT=3000`, `WEB_URL=http://localhost:5173`, etc.) hasta que una
fase futura las necesite de verdad.
**Motivo:** exigir SMTP o los plazos de negocio ahora impediría levantar la API sin sentido (nada los
lee todavía). Los secretos de auth sí se exigen desde ya, aunque el login no exista hasta la Fase 1,
porque es la clase de variable que no debe improvisarse nunca ni quedar con un valor de ejemplo.
**Consecuencia:** cuando la Fase 1/4/7 empiece a leer `SMTP_*`, `SLA_RESPUESTA_DIAS`, etc., hay que
sumarlas a `REQUERIDAS` en `apps/api/src/config/env.js` en el mismo commit que las usa por primera vez.

## 2026-08-28 · Catálogo de errores como paquete del workspace, no ruta relativa
**Contexto:** `docs/04-manejo-de-errores.md` dice que el catálogo de códigos vive en `packages/errores/`
porque lo comparten API y web.
**Decisión:** `packages/errores` es un paquete real del workspace (`@proxi/errores`, con su
`package.json`), no una carpeta a la que se llega con `../../../`. `apps/api` lo declara como
dependencia normal y hace `require('@proxi/errores')`.
**Motivo:** una ruta relativa profunda se rompe si algún día se mueve `apps/api/src/middlewares/`, y no
dice nada sobre que ese código es compartido. Con workspaces, `npm install` en la raíz lo enlaza solo.
**Consecuencia:** cualquier paquete nuevo en `packages/` (validaciones, constantes) sigue este mismo
patrón: `package.json` propio + `name` con prefijo `@proxi/`.

## 2026-08-28 · `/api/v1/salud` responde 503 si la base no contesta, y nunca expone el motivo en producción
**Contexto:** el roadmap solo pedía "estado de la app y de la base"; no especificaba el código HTTP ni
qué tan detallada debía ser la respuesta cuando la base falla.
**Decisión:** `salud.service.js` devuelve `baseDeDatos.error` con el mensaje real solo si
`NODE_ENV !== 'production'`; el controller responde `200` si la base contesta y `503` si no.
**Motivo:** un healthcheck en `200` aunque la base esté caída no sirve para monitoreo (Fase 8 pide
"aviso ante caídas"), y el mensaje de error de Sequelize puede filtrar detalles de la conexión a quien
golpee el endpoint desde afuera.
**Consecuencia:** cualquier monitor de uptime debe tratar `503` de `/salud` como caída real, no como
error transitorio a ignorar.

## 2026-08-28 · Método de trabajo: especificación antes que código, de forma selectiva
**Contexto:** proyecto de un solo desarrollador, asistido por IA. El asistente no recuerda nada entre
sesiones y el hilo del proyecto se perdía en el chat.
**Decisión:** lo que tiene reglas de negocio o riesgo se especifica en `specs/<n>-<nombre>/` (spec,
plan, tareas) antes de programarse. Lo rutinario va directo al código. Las decisiones no obvias se
anotan aquí.
**Motivo:** el repositorio pasa a ser la memoria del proyecto. Cualquier sesión futura, o cualquier
otra persona, reconstruye el contexto leyendo `CLAUDE.md` y `docs/`. Se descartó especificar todo:
en proyectos de una persona esa disciplina se abandona en semanas.
**Consecuencia:** cada funcionalidad con reglas cuesta un rato de escritura antes de empezar. A cambio,
el asistente deja de reinventar criterios en cada sesión.

## 2026-08-28 · Nombre del proyecto: Proxi
**Contexto:** hacía falta un nombre neutro, usable en la FEN UAH y en un portafolio personal.
**Decisión:** Proxi. Repositorio `proxi`, base `proxi_dev` / `proxi_prod`.
**Motivo:** corto, pronunciable, sin amarre institucional.
**Consecuencia:** ninguna marca de la universidad aparece en el código; si mañana se instala en otra
facultad, solo cambia la configuración.

## 2026-08-28 · Arquitectura: API REST + cliente separado, en un monorepo
**Contexto:** alternativas evaluadas: monolito con plantillas EJS, API + SPA en React, o híbrido.
**Decisión:** `apps/api` (Express) y `apps/web` (HTML/CSS/Bootstrap/JS sin framework), mismo repo.
**Motivo:** cubre los aprendizajes esperados de los módulos 2 al 8 de la currícula (incluido el
consumo de API con fetch y la seguridad con JWT del módulo 8), y deja una frontera explícita donde
concentrar CORS, tokens y límite de tasa. React se descartó por no estar en la currícula: no sería
defendible en la evaluación y agrega superficie de error.
**Consecuencia:** hay que mantener dos aplicaciones y un contrato entre ellas. Se mitiga compartiendo
validaciones y códigos de error en `packages/`.

## 2026-08-28 · El ciclo de vida es el producto
**Contexto:** el diagnóstico de mercado mostró que el problema no es publicar, es cerrar.
**Decisión:** `fecha_cierre` obligatoria a nivel de base de datos, cierre con motivo obligatorio,
bloqueo de publicación a empresas con cierres sin declarar, y estado terminal garantizado para toda
postulación.
**Motivo:** cerca del 30% de los avisos nunca lleva a contratación y el ghosting subió 120% en cinco
años. Si estas reglas fueran opcionales, nadie las usaría y seríamos un portal más.
**Consecuencia:** el modelo de datos es más estricto y hay dos tareas programadas que mantener. Se
acepta: es la razón de existir del proyecto.

## 2026-08-28 · Alinear Proxi con las convenciones de los proyectos previos
**Contexto:** se revisó la carpeta `BOOTCAMP PROYECTOS`. `toolshare-api` (módulo 8) ya tiene el
esqueleto `src/{app,server,config,controllers,middlewares,models,routes}` con nombres
`<recurso>.<capa>.js`, CommonJS y el stack Express + Sequelize + JWT.
**Decisión:** Proxi adopta esa estructura y esos nombres tal cual, en vez de imponer convenciones
nuevas. Se agregan solo cuatro diferencias: capa `services/`, manejo central de errores, códigos HTTP
correctos con rol en el token, y pruebas obligatorias de acceso cruzado.
**Motivo:** la estructura ya es correcta y ya es familiar. Cambiarla porque sí agrega carga de
aprendizaje sin beneficio, y todo lo que se aprende aquí sirve para defender los módulos del bootcamp.
Se descartó kebab-case en los archivos de capa por lo mismo.
**Consecuencia:** la documentación quedó ajustada (`CLAUDE.md`, `05-convenciones.md`). El detalle de
qué se hereda y qué cambia está en `docs/investigacion/referencia-proyectos-previos.md`.

## 2026-08-28 · Pruebas con el corredor nativo de Node
**Contexto:** hay que introducir pruebas automatizadas en un proyecto de una persona que casi no las
ha usado antes.
**Decisión:** `node --test` + supertest, no Jest. Detalle en `docs/adr/0003-herramienta-de-pruebas.md`.
**Motivo:** cero configuración y cero dependencias extra. Lo que se abandona no protege a nadie.
**Consecuencia:** los ejemplos que se encuentren en internet estarán escritos para Jest y hay que
traducir las afirmaciones.

## 2026-08-28 · Hallazgo: archivos .env versionados en proyectos previos
**Contexto:** `toolshare-api`, `libro_autor_lib_M8_L2` y `peliculas-actores` tienen `.env` junto al
código.
**Decisión:** en Proxi, `.env` en `.gitignore` desde el primer commit; `.env.example` documenta las
claves con valores vacíos.
**Motivo:** un secreto que entra a git queda en el historial aunque después se borre el archivo.
**Consecuencia:** si alguno de esos repos previos llegó a GitHub, esas credenciales deberían rotarse.

## 2026-08-28 · El cliente web queda sin especificar (deuda consciente)
**Contexto:** la Fase 3 tiene spec completa con criterios de aceptación; la Fase 6 (cliente web) solo
tiene una lista de casillas.
**Decisión:** se deja así por ahora, con la advertencia escrita en el roadmap y en `ARRANQUE.md`.
Antes de la primera pantalla hay que escribir `specs/02-vitrina-publica/` y `docs/08-guia-visual.md`.
**Motivo:** especificar pantallas antes de que la API devuelva datos reales lleva a rehacer. Pero la
deuda queda anotada donde se va a leer, no en la memoria de nadie.
**Consecuencia:** el riesgo es llegar a la Fase 6 con prisa y improvisar la interfaz. El punto crítico
a no improvisar es la representación visual de los estados: si `publicada`, `cierra pronto` y `cerrada`
no se distinguen de un vistazo, el diferenciador del producto no llega al usuario.
