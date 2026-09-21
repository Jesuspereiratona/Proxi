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
- Diario automático de la base, retención 30 días.
- **Los CV entran completos en el respaldo**: desde el 2026-09-20 los bytes viven en
  `archivos.contenido`, no en un disco aparte. Un respaldo filtrado expone los CV enteros; tratarlo
  con el mismo cuidado que a la base (`docs/09-procedimiento-de-brecha.md`).
- **Restauración probada cada 3 meses.** Un respaldo que nunca se restauró no es un respaldo, es una
  esperanza. Se anota la fecha de la última prueba en la bitácora.

## Monitoreo
- `GET /api/v1/salud` devuelve: estado de la app, de la base, y última ejecución exitosa de cada tarea
  programada.
- Un servicio externo lo consulta cada 5 minutos y avisa si falla dos veces seguidas.
- Revisión semanal de logs `error` y `warn`: 401 repetidos desde una IP o picos de límite de tasa son
  señales de ataque, no ruido.

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
