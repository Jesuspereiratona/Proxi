# Plan técnico · Identidad

## Cambios en el modelo de datos
Migración `crear-usuarios`: tabla `usuarios` según `docs/02-modelo-de-datos.md`, más una columna que
el modelo no tenía: `intentos_fallidos_desde timestamptz NULL` — marca cuándo empezó la racha de
fallos actual. Sin ella, el bloqueo de 15 minutos no tiene desde cuándo contar sin reusar
`ultimo_acceso_at`, que ya tiene otro significado (política de retención). Se documenta como extensión
al modelo en este plan, no en `02-modelo-de-datos.md` directamente — eso se actualiza al cerrar la fase.
```sql
CHECK (rol IN ('estudiante','empresa','coordinacion'))
CHECK (estado IN ('pendiente_verificacion','activo','bloqueado'))
```
Índices: `email` (único), `rol`.

Migración `crear-sesiones`: tabla `sesiones` según el modelo — `usuario_id`, `refresh_token_hash`,
`expira_at`, `revocada_at`, `ip`, `user_agent`. Índice por `usuario_id` y por `refresh_token_hash`.

Migración `crear-consentimientos`: tabla `consentimientos` — `usuario_id`, `version_politica`,
`otorgado_at`, `revocado_at`.

Migración `crear-tokens-un-solo-uso`: tabla nueva `tokens_verificacion`, no descrita en
`02-modelo-de-datos.md` porque ese doc no bajó al detalle de verificación/recuperación. Sirve para
ambos flujos (verificar correo y restablecer clave) con una columna `tipo`:
| Columna | Tipo | Notas |
|---|---|---|
| usuario_id | bigint FK NOT NULL | |
| token_hash | text NOT NULL | se guarda el hash, nunca el token |
| tipo | text NOT NULL | CHECK: `verificacion_correo` · `restablecer_clave` |
| expira_at | timestamptz NOT NULL | 24h para verificación, 1h para restablecer |
| usado_at | timestamptz NULL | un solo uso: si no es NULL, el token ya sirvió |

Todas las migraciones con `up` y `down`.

## Endpoints
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/v1/auth/registro` | público | Crea usuario `estudiante`/`empresa` + consentimiento, envía verificación |
| POST | `/api/v1/auth/verificar-correo` | público | Token de verificación → `activo` |
| POST | `/api/v1/auth/login` | público | Credenciales → access token + cookie de refresco |
| POST | `/api/v1/auth/refrescar` | público (cookie) | Rota el refresco, emite access token nuevo |
| POST | `/api/v1/auth/logout` | autenticado | Revoca la sesión actual, limpia la cookie |
| POST | `/api/v1/auth/recuperar-clave` | público | Genera token de restablecimiento, respuesta uniforme |
| POST | `/api/v1/auth/restablecer-clave` | público | Token + clave nueva |

## Servicios
`services/auth/passwords.js` — `hashear(clave)` / `comparar(clave, hash)` sobre `bcryptjs`, con
`env.bcryptRounds`. `validarFortaleza(clave)`: mínimo 12 caracteres, sin reglas de composición.

`services/auth/tokens.js` — `firmarAcceso({sub, rol})`, `verificarAcceso(token)` con `jsonwebtoken`.
`generarTokenUnSoloUso()` produce el valor plano (se manda al correo) y su hash (se guarda); no hay
forma de recuperar el plano desde la base.

`services/auth/intentosLogin.js` — `registrarFallo(usuario)` y `estaBloqueado(usuario)`, sobre
`intentos_fallidos` / `intentos_fallidos_desde`. Reloj inyectado, sin `new Date()` suelto: se prueba
sin base de datos.

`services/auth/auth.service.js` — `registrar`, `verificarCorreo`, `login`, `refrescar`, `logout`,
`pedirRecuperacion`, `restablecerClave`. Cada uno hace una sola cosa y no conoce `req`/`res`.
`refrescar` implementa la detección de reuso: si el hash presentado corresponde a una fila con
`revocada_at` ya seteado, revoca todas las sesiones del usuario (`UPDATE sesiones SET revocada_at = now()
WHERE usuario_id = ? AND revocada_at IS NULL`) antes de responder 401.

`services/correo/correo.service.js` — `enviarCorreo({para, asunto, texto})`, con tres caminos según
el entorno:
- **`SMTP_HOST` configurado** (pensado para producción): transporte real de `nodemailer`.
- **Desarrollo sin `SMTP_HOST`**: cuenta de prueba de Ethereal (`nodemailer.createTestAccount()`,
  gratis, sin registro), creada una vez y cacheada en memoria. El correo "se manda" de verdad a esa
  casilla falsa y se loguea la URL de vista previa (`nodemailer.getTestMessageUrl`) para abrirla en el
  navegador — así el flujo de verificación/recuperación se puede probar de punta a punta sin cuenta
  real.
- **`NODE_ENV=test`**: no llama a ninguna red. Solo registra el mensaje a nivel `info`. Depender de
  Ethereal en cada corrida de `npm test`/CI sería lento y frágil si Ethereal está caído; las pruebas
  no necesitan ver el correo, solo que se haya generado el token correcto.

`middlewares/autenticar.middleware.js` — lee `Authorization: Bearer`, verifica el JWT, deja
`req.usuario = {id, rol}` o lanza `NoAutenticado`.

`middlewares/autorizar.middleware.js` — `autorizar(...roles)` devuelve un middleware que exige que
`req.usuario.rol` esté en la lista, o lanza `NoAutorizado`.

## Dependencias nuevas
Ninguna de las que ya trae el proyecto cubre JWT, hashing, cookies o correo. Se agregan cuatro:
- `jsonwebtoken` — firma y verificación de JWT.
- `bcryptjs` — hashing de contraseñas (la misma que usa `toolshare-api`, sin binarios nativos que
  compilar).
- `cookie-parser` — Express no lee cookies por sí solo; hace falta para leer el refresco en `req.cookies`.
- `nodemailer` — transporte de correo real y, en desarrollo, el cliente de la cuenta de prueba de
  Ethereal (incluida en el mismo paquete, sin dependencia aparte).
- `zod` — validación de esquema en el borde, tal como pide `docs/03-seguridad.md` ("esquema
  declarado, `express-validator` o `zod`"). Se usa desde un `middlewares/validar.middleware.js` nuevo
  y los esquemas viven en `schemas/auth.schemas.js`.

## Errores nuevos
`AUTH_CORREO_YA_REGISTRADO` (409) · `AUTH_TOKEN_INVALIDO` (401). Los demás
(`AUTH_CREDENCIALES_INVALIDAS`, `AUTH_TOKEN_EXPIRADO`, `AUTH_CUENTA_BLOQUEADA`,
`AUTH_EMAIL_NO_VERIFICADO`, `CONSENTIMIENTO_REQUERIDO`, `VALIDACION_ENTRADA`) ya están en
`docs/04-manejo-de-errores.md`, solo faltaba implementarlos. Se agregan a `packages/errores/codigos.js`.

## Consideraciones de seguridad
- Login y recuperación de clave: mismo mensaje exista o no la cuenta (`AUTH_CREDENCIALES_INVALIDAS`
  genérico; recuperación siempre 200).
- El JWT de acceso lleva `sub`/`rol`/`exp` únicamente. El refresco nunca sale del backend salvo en la
  cookie `httpOnly`+`secure`+`sameSite=strict`.
- Solo se guardan hashes: de la contraseña (bcrypt) y de los tokens de un solo uso y de refresco
  (sha256 basta ahí, no hace falta bcrypt para algo que ya es aleatorio de 32+ bytes).
- Límite de tasa específico en `/auth/login` y `/auth/recuperar-clave`, más estricto que el global:
  se implementa como un `express-rate-limit` adicional por IP, montado solo en esas dos rutas.
- `CAMPOS_CENSURADOS` de `config/logger.js` se amplía con lo que puede aparecer en el `req.body` real
  de estas rutas: ya cubre `password`/`correo`/`token` a nivel `req.body`, pero `registro` manda
  también `rol` y `contactoNombre` — ninguno sensible, no hace falta agregar nada ahí; se deja anotado
  que si `restablecer-clave` llega a loguear su payload alguna vez, `password` ya está cubierto.
- Auditoría de acceso (`auditoria_accesos`) no aplica todavía: esa tabla es para acceso a datos de
  *otro* usuario (CV, perfil), y en esta fase nadie ve datos ajenos.

## Pruebas
Unitarias: `passwords.js` (hash/compare/fortaleza), `tokens.js` (firmar/verificar, expiración),
`intentosLogin.js` (bloqueo y reseteo de ventana, con reloj inyectado).
Integración: un caso por criterio de aceptación de `spec.md`, más:
- acceso cruzado: un token de estudiante contra una ruta `autorizar('empresa')` → 403
- reuso de refresco → todas las sesiones de esa cuenta quedan revocadas
- registro con `rol=coordinacion` → 422

## Riesgos
| Riesgo | Detección |
|---|---|
| Reloj del servidor desalineado invalida tokens antes de tiempo | JWT usa `exp` relativo del propio proceso; se revisa en el runbook de despliegue (Fase 8) |
| Ethereal está caído justo cuando se prueba el flujo en desarrollo | No bloquea nada real: solo afecta la vista previa local. Se reintenta o se lee el token directo de la base |
| `correo.service.js` sigue sin credenciales SMTP reales al desplegar | Bloqueante para Fase 8: sin `SMTP_HOST`, la rama de producción no tiene transporte configurado y falla al enviar. Se anota como pendiente explícito |
| Alguien intenta 5 logins fallidos a propósito para bloquear la cuenta de otro (DoS dirigido) | Aceptado como riesgo conocido de este mecanismo; se documenta, no se resuelve en Fase 1 |
