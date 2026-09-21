# 07 · Operación y mantenimiento

Un proyecto que solo corre en el computador de quien lo escribió no está terminado.

## Entornos
| Entorno | Para qué | Base de datos |
|---|---|---|
| desarrollo | día a día | PostgreSQL en Docker, datos de prueba |
| pruebas | CI y suite automatizada | base efímera, se crea y destruye |
| producción | uso real | base gestionada con respaldos |

Las tres se configuran solo con variables de entorno. El código es idéntico. Si hay un `if (entorno
=== 'produccion')` con lógica de negocio adentro, está mal.

## Dónde corre cada cosa

Tres proveedores, todos en plan gratuito. La separación no es un capricho: cada uno está donde
está por un motivo concreto.

| Pieza | Dónde | Por qué ahí |
|---|---|---|
| API | Render (Docker, plan free) | Corre un contenedor de verdad, no una función. Las tareas programadas y las conexiones a Postgres necesitan un proceso, no un serverless que muere a los 10 s |
| Base de datos | Neon (plan free) | Soporta `pgcrypto`, que Proxi necesita para cifrar el RUT. El Postgres gratuito de Render **se borra a los 30 días**; el de Neon no caduca |
| Web | Cloudflare Pages o Vercel | Es HTML estático servido tal cual. No necesita servidor |
| Tareas nocturnas | GitHub Actions (cron) | En el plan gratuito el proceso duerme tras 15 min sin tráfico, y un `node-cron` dormido no corre nunca |

**La consecuencia más importante de esto:** la web y la API quedan en dominios distintos. De ahí
salen tres ajustes que parecen sueltos y son el mismo hecho — `WEB_URL` en la lista blanca de CORS,
`COOKIE_SAMESITE=none` en la cookie de sesión, y `API_EN_PRODUCCION` en
`apps/web/assets/js/config.js`.

Lo que **no** está en la nube y sigue siendo trabajo manual: respaldos probados, rotación de
secretos y el DPA con cada proveedor. Están en el roadmap de Fase 8, sin marcar.

## Despliegue

Automático: cada push a `main` dispara `.github/workflows/desplegar.yml`, que hace las migraciones
**antes** de levantar el código nuevo y espera a que `/salud` responda. Por eso el blueprint lleva
`autoDeploy: false` — con el autodespliegue de Render, el código nuevo arranca contra el esquema
viejo y falla en la primera petición.

```
push a main → CI en verde → db:migrate → deploy hook de Render → esperar /salud
```

Si algo sale mal, revertir es en el orden inverso: primero el proceso vuelve a la versión anterior
(Render guarda los despliegues previos), **después** `npm run db:migrate:undo -w apps/api`. El
porqué está tres párrafos más abajo.

### Primera vez: qué hay que crear a mano

1. **Neon**: proyecto nuevo, copiar la cadena de conexión y correr una vez
   `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
2. **Render**: nuevo Blueprint apuntando a este repositorio (lee `render.yaml`), cargar las
   variables marcadas `sync: false`, y copiar el *deploy hook*.
3. **Cloudflare Pages / Vercel**: sitio estático con raíz `apps/web`, sin paso de compilación.
   Después, poner ese dominio en `WEB_URL` (Render) y en `API_EN_PRODUCCION`
   (`apps/web/assets/js/config.js`).
4. **GitHub**: en *Settings → Secrets*, entorno `produccion`, cargar `DATABASE_URL`, los dos
   secretos JWT, `RUT_CIFRADO_KEY`, `WEB_URL`, `API_URL`, `TAREAS_TOKEN` y `RENDER_DEPLOY_HOOK`.

**El correo se puede dejar para después, y el registro queda explícitamente apagado mientras
tanto.** Sin `SMTP_HOST`, `correo.service.js` cae en Ethereal —una casilla falsa de desarrollo— y el
enlace de verificación se manda ahí: la cuenta se crearía, el registro devolvería 201, y la persona
no podría entrar NI volver a registrarse, porque su correo quedaría ocupado. Por eso
`POST /auth/registro` responde `REGISTRO_NO_DISPONIBLE` mientras falte SMTP, y no crea nada.

Todo lo demás —vitrina, sesiones, los tres paneles, postulaciones— funciona sin correo. Para mostrar
Proxi a la FEN alcanza con las cuentas de demostración (abajo). Cuando haya SMTP (Brevo, Resend o
Gmail con contraseña de aplicación), el registro se enciende solo: no hay que tocar código.

### Cuentas de demostración en un entorno público

`npm run db:seed:cuentas -w apps/api` crea las seis cuentas de los tres roles, ya verificadas. Fuera
de desarrollo **exige `CUENTAS_DEMO_CLAVE`**: la clave escrita en el seed está en un repositorio
público y no puede usarse en algo accesible desde internet. Se corre desde tu máquina apuntando a la
base real:

```bash
NODE_ENV=production DATABASE_URL='<la de Neon>' CUENTAS_DEMO_CLAVE='<una tuya, 12+>' WEB_URL='<la de la web>' JWT_ACCESS_SECRET='<...>' JWT_REFRESH_SECRET='<...>' RUT_CIFRADO_KEY='<...>' npm run db:seed:cuentas -w apps/api
```

Son cuentas de demostración, no de personas: **se borran en cuanto el proyecto reciba usuarios
reales.**

**`API_URL` es un secreto de GitHub, no una variable de la API.** La API no la lee (no existe en el
código); los flujos de Actions la usan para saber a qué dirección llamar. En Render no hay que
ponerla.

**`API_URL` es el origen pelado, sin `/api/v1`** (`https://proxi-api.onrender.com`). Los flujos le
agregan la ruta completa. Si se carga con el prefijo, los `curl` dan 404: el flujo falla ruidoso,
pero mientras nadie lo mire, la eliminación por retención —una obligación legal— deja de correr.

Los secretos se generan con `openssl rand -base64 32`, uno distinto por variable y distinto del de
desarrollo. Ver la skill `manejo-de-secretos`.

### Las tareas nocturnas

`.github/workflows/tareas-nocturnas.yml` corre a las 06:00 UTC: despierta la API con `/salud` (un
servicio dormido tarda ~50 s en responder el primer pedido) y recién después llama a
`POST /api/v1/tareas/ejecucion` con el secreto `TAREAS_TOKEN` en un encabezado, nunca en la URL.

Esa ruta **no usa JWT**: la llama un cron, que no es una persona y no tiene sesión. Sin
`TAREAS_TOKEN` configurado responde 404 —igual que cualquier URL inventada— y con un secreto
equivocado también: quien no lo trae no tiene por qué enterarse de que acertó la dirección.

El cron interno de la API sigue programado. Si algún día el proceso deja de dormir, las tareas
corren por los dos lados sin problema: son idempotentes.

### Migrar CV que quedaron en disco

Solo aplica a instalaciones anteriores al 2026-09-20, cuando los CV se guardaban en
`almacenamiento/cv`. `npm run migrar-cv -w apps/api` los sube a la base **y borra el archivo de
disco** en cuanto los bytes están guardados. Es idempotente y se corre a mano, en la máquina que
todavía tiene los archivos — no es una migración de Sequelize porque `db:migrate` corre en el
despliegue, donde ese disco no existe.

El borrado no es opcional: sin él, esa máquina queda con una copia en claro de todos los CV para
siempre, fuera de todo control de acceso y de `auditoria_accesos`. Cuando después esa persona ejerce
su derecho de supresión, la base se limpia y **la copia en disco sobrevive** — lo contrario de
suprimir (auditoría de seguridad del 2026-09-20). El script no toca archivos que no tengan fila en
`archivos`: los lista por nombre para que alguien los mire, porque borrar lo no referenciado es cómo
se pierden datos.

Antes de dar por terminada la migración, comprobar que no quedó ningún CV vigente sin bytes:

```sql
SELECT count(*) FROM archivos WHERE tipo = 'cv' AND contenido IS NULL AND expira_at IS NULL;
```

Si no da cero, esos CV responden 404 aunque el estudiante los vea listados en su panel (el nombre y
el tamaño salen de la fila, no de los bytes), y una empresa que abra una postulación anterior al
cambio no puede descargar el CV que sí recibió en su momento.

Migraciones: siempre reversibles (`up` y `down`), nunca destructivas en un solo paso. Para eliminar una
columna: primero dejar de usarla y desplegar, después borrarla en un despliegue posterior. Así un
retroceso no pierde datos.

**Revertir una migración es al revés que aplicarla: primero el proceso vuelve a la versión
anterior, después `db:migrate:undo`.** Un modelo de Sequelize declara sus columnas de forma
explícita — si el proceso nuevo sigue corriendo cuando se le quita una columna a la base, cualquier
`SELECT`/`INSERT`/`UPDATE` sobre esa tabla falla con un 500 hasta que también se revierte el código
(encontrado por `revisor-migraciones` al revisar la migración de retención de Fase 7).

## Respaldos

**Estado real, sin adornos:** el plan gratuito de Neon guarda **6 horas** de historial
(point-in-time restore) y no ofrece respaldos programados. Eso alcanza para deshacer un error que se
note en el momento, y para nada más. Un `DROP TABLE` descubierto al día siguiente es irrecuperable.

Lo que sí está automatizado es el **ensayo de restauración**
(`.github/workflows/ensayo-de-restauracion.yml`, domingos): saca el volcado de la base real, lo
restaura en una base vacía, y comprueba tablas, filas, claves foráneas y que un RUT cifrado se
vuelva a descifrar. No guarda el volcado en ninguna parte, a propósito — ver el comentario del
propio flujo. Prueba que el respaldo **sirve**, no que exista uno guardado.

Para sacar una copia a mano, desde una máquina de confianza:

```bash
pg_dump --no-owner --no-acl --format=custom --file=proxi-$(date +%F).dump "$DATABASE_URL"
```

Ese archivo tiene los CV y los RUT cifrados de todo el mundo. Tratarlo como el dato más sensible del
proyecto: cifrado en reposo, y borrado en cuanto deje de hacer falta.

- Diario automático de la base, retención 30 días. **Pendiente**: hoy no existe (ver arriba).
- **Los CV entran completos en el respaldo**: desde el 2026-09-20 los bytes viven en
  `archivos.contenido`, no en un disco aparte. Un respaldo filtrado expone los CV enteros; tratarlo
  con el mismo cuidado que a la base (`docs/09-procedimiento-de-brecha.md`).
- **Restauración probada cada 3 meses.** Un respaldo que nunca se restauró no es un respaldo, es una
  esperanza. Se anota la fecha de la última prueba en la bitácora.

## Cuando algo se cae: qué mirar y en qué orden

Escrito con los fallos que de verdad ocurrieron al estrenar el despliegue, no con casos
imaginarios. Los tres primeros son el 90% de lo que va a pasar.

**Lo primero, siempre:**

```bash
npm run revisar-despliegue -w apps/api -- https://proxi-88x.pages.dev <clave-demo>
```

39 comprobaciones por el mismo camino que usa el navegador. Dice qué funciona y qué no antes de que
empieces a adivinar.

### "Tarda como un minuto en cargar la primera vez"

**No está roto.** El plan gratuito de Render duerme el proceso tras 15 minutos sin tráfico, y
despertarlo tarda ~50 s. La segunda carga es instantánea. Se nota sobre todo en la primera visita
del día. Si molesta para una demostración, entra tú diez minutos antes.

### "Sale el error genérico al iniciar sesión"

Mira `/api/v1/salud` primero:

| Lo que dice | Qué pasa |
|---|---|
| no responde en 90 s | la API está caída o muy dormida; revisar los logs en Render |
| `"baseDeDatos":{"ok":false}` | Neon no responde o `DATABASE_URL` quedó mal |
| `"estado":"ok"` | el problema está en el navegador, sigue abajo |

Con `/salud` en `ok`, casi siempre es una de dos:

1. **JavaScript viejo en caché.** `Ctrl + Shift + R`. Pasa después de cada despliegue.
2. **`version` no coincide con el último commit.** El despliegue no llegó; ver abajo.

### "El despliegue dice que terminó pero los cambios no están"

Compara lo que corre con lo que subiste:

```bash
curl -s https://proxi-api.onrender.com/api/v1/salud | grep -o '"version":"[^"]*"'
git rev-parse --short=7 HEAD
```

Si no coinciden, el contenedor nuevo no levantó. El flujo `Desplegar` espera hasta ver ese commit,
así que si terminó en verde y no coincide, el que falló fue un despliegue posterior. Revisar los
logs de Render.

### La API responde pero la web no la alcanza

Síntoma: las páginas cargan, iniciar sesión da el error genérico, y `/salud` desde `curl` está en
`ok`. Casi siempre es el camino entre las dos, que pasa por el proxy del borde
(`apps/web/_worker.js`):

```bash
# ¿Devuelve JSON o el HTML del sitio?
curl -s https://proxi-88x.pages.dev/api/v1/salud | head -c 40
```

- Devuelve **HTML** → el proxy no está activo. El `_worker.js` tiene que quedar en la raíz de la
  carpeta publicada (`apps/web`), no en `functions/`.
- Devuelve **502 con `API_NO_DISPONIBLE`** → el proxy no alcanzó la API. Suele ser la API dormida:
  reintentar.
- Devuelve **JSON** → el proxy está bien; el problema es del cliente (caché, o `config.js`).

### Una cuenta no puede entrar

Antes de tocar nada, mira si es el límite de intentos:

```bash
curl -s -D - -o /dev/null -X POST https://proxi-88x.pages.dev/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"...","clave":"..."}' | grep -i ratelimit
```

Un `429` con `ratelimit-remaining: 0` **es la protección funcionando**, no una falla. El encabezado
`ratelimit-reset` dice cuántos segundos faltan.

### Las tareas nocturnas no corrieron

`ultimaEjecucionAt` en `/salud` **vuelve a null en cada reinicio del proceso**, a propósito: el
estado vive en memoria. Tras un despliegue está vacío y eso no significa nada. Dónde mirar de
verdad: la pestaña *Actions* del repositorio, flujo **Tareas nocturnas**. Si falló, el log dice
cuál tarea y por qué. Se puede disparar a mano con *Run workflow*.

Si el flujo da 404, `API_URL` en los secretos de GitHub tiene el prefijo `/api/v1` de más: debe ser
el origen pelado.

### Hay que revertir un despliegue

**El orden importa y es al revés que al desplegar.** Primero el código, después la base:

1. En Render, *Deploys* → buscar el despliegue anterior → **Rollback**.
2. Solo si el problema era una migración: `npm run db:migrate:undo -w apps/api` con
   `DATABASE_URL` apuntando a producción.

Al revés, el proceso nuevo sigue corriendo contra una base que ya perdió una columna, y cualquier
consulta a esa tabla falla con 500 hasta que también se revierte el código.

### Se perdieron datos

El plan gratuito de Neon guarda **6 horas** de historial. Dentro de esa ventana, *Restore* en el
panel de Neon vuelve a un punto anterior. Fuera de ella, **no hay de dónde recuperar**: ver la
sección de respaldos, que dice por qué y qué falta decidir.

## Monitoreo
- `GET /api/v1/salud` devuelve: estado de la app, de la base, y última ejecución exitosa de cada tarea
  programada.
- Un servicio externo lo consulta cada 5 minutos y avisa si falla dos veces seguidas.
- Revisión semanal de logs `error` y `warn`: 401 repetidos desde una IP o picos de límite de tasa son
  señales de ataque, no ruido.

## Retención de logs

Dos rastros distintos, con propósitos y plazos distintos. Confundirlos es lo que hace que un
incidente se investigue con las manos vacías.

| Rastro | Dónde vive | Cuánto dura | Para qué |
|---|---|---|---|
| Logs de aplicación | Render | **7 días** (plan gratuito) | operar: ver por qué algo falló hoy |
| `auditoria_accesos` | La base de datos | **24 meses** | investigar: quién accedió a datos de quién |

**La consecuencia, dicha claro:** si una brecha se detecta más de una semana después, los logs de
Render ya no existen y no hay forma de reconstruir qué peticiones hubo. Lo que sí sobrevive es
`auditoria_accesos`, y por eso esa tabla —no el log— es la fuente de la investigación
(`docs/09-procedimiento-de-brecha.md`). La vigilancia diaria
(`specs/12-vigilancia-de-accesos/`) existe justamente para que una brecha no se detecte con semanas
de retraso.

**Por qué no se alarga la retención de logs.** Alargarla exige mandarlos a un servicio externo de
registro, que es un tercero más con nuestros datos, con su contrato y su registro de tratamiento —
para guardar un rastro que en Proxi es redundante con la auditoría. Los logs de Proxi además están
censurados a propósito (`config/logger.js`: ni contraseñas, ni tokens, ni RUT, ni correos), así que
lo que conservarían es poco: horas, rutas y códigos de error.

**Lo que hay que hacer cuando se sospecha algo, dentro de los 7 días:** bajar los logs relevantes
desde el panel de Render antes de que caduquen, y guardarlos junto al informe del incidente en
`docs/incidentes/`. Es manual y es deliberado: automatizarlo significaría guardar todos los logs
siempre, que es lo que acabamos de decidir no hacer.

## Mantenimiento periódico
| Cada | Qué |
|---|---|
| Semana | Revisar logs de error y warn |
| Mes | `npm audit` y `npm outdated`; actualizar parches de seguridad |
| Trimestre | Probar restauración del respaldo; revisar accesos de coordinación; revisar la lista de `03-seguridad.md` |
| Semestre | Actualizar dependencias mayores en rama aparte, con pruebas |
| Año | Revisar política de privacidad y plazos de retención |

## Procedimiento ante una brecha de datos
La Ley 21.719 exige notificar a la Agencia y a los afectados **dentro de 72 horas** de detectada.

1. **Contener** (0–2 h): revocar sesiones, rotar secretos, cerrar el acceso comprometido.
2. **Evaluar** (2–12 h): qué datos, de cuántas personas, en qué ventana. Los logs y
   `auditoria_accesos` son la fuente.
3. **Notificar** (antes de 72 h): a la Agencia y a los titulares afectados, en lenguaje claro: qué
   pasó, qué datos, qué estamos haciendo, qué debe hacer la persona.
4. **Documentar**: informe en `docs/incidentes/AAAA-MM-DD-titulo.md` con línea de tiempo, causa raíz y
   qué cambió para que no se repita. Sin buscar culpables: buscar la falla del sistema.
5. **Corregir**: la corrección entra al roadmap con prioridad, no a una lista de deseos.

## Traspaso
Si otra persona toma el proyecto, debería bastarle con: `README.md` → `CLAUDE.md` → `docs/` en orden →
`docs/decisiones/bitacora.md` para entender el porqué de lo raro. Si algo no se entiende leyendo eso,
falta documentación, y esa es una tarea del roadmap como cualquier otra.
