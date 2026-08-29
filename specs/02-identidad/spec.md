# Spec · Identidad

- **Estado:** aprobada
- **Fecha:** 2026-08-28
- **Fase del roadmap:** 1

## Problema
Hoy no existe forma de entrar a Proxi. Sin identidad no hay "esta oferta es tuya", no hay "esta
postulación es tuya", no hay quién declare un cierre ni quién valide una empresa. Todo lo que sigue
en el roadmap depende de saber quién está haciendo la petición y qué puede hacer.

## Quién la usa
- **Visitante:** se registra como estudiante o empresa, verifica su correo, recupera su clave.
- **Estudiante / empresa / coordinación:** inicia sesión, se mantiene autenticado mientras usa el
  sistema, cierra sesión.
- **Sistema:** rota el token de refresco en cada uso, detecta su reutilización, expira sesiones.

## Comportamiento esperado
Cualquier visitante se registra con correo, contraseña y un rol: **estudiante** o **empresa**.
`coordinación` no se autorregistra — esas cuentas las crea coordinación misma (fuera de esta spec: la
primera se siembra a mano). El registro exige aceptar la política de datos vigente; sin eso no hay
cuenta. La cuenta nace `pendiente_verificacion` y no puede iniciar sesión hasta confirmar el correo
con el enlace que se le envía.

Iniciar sesión con credenciales correctas y cuenta activa entrega un token de acceso de vida corta (15
minutos) y un token de refresco de 7 días en una cookie `httpOnly`. Cuando el de acceso expira,
el cliente usa el de refresco para obtener uno nuevo; ese uso **rota** el refresco: el viejo queda
inválido y se emite uno nuevo. Si alguna vez reaparece un refresco ya usado, es la señal de que alguien
más lo tiene — se cierran todas las sesiones de esa cuenta de inmediato.

Cinco intentos de login fallidos seguidos en 15 minutos bloquean temporalmente los intentos siguientes
para esa cuenta, aunque la contraseña del sexto intento sea correcta. El bloqueo se libera solo, pasada
la ventana. Esto es distinto del estado `bloqueado` de la cuenta, que es una acción administrativa y no
la toca esta funcionalidad.

Quien olvida su contraseña pide un enlace de recuperación. El sistema responde igual exista o no ese
correo, para no revelar qué cuentas existen. El enlace es de un solo uso y expira en una hora.

Cada ruta protegida exige un token de acceso válido (`autenticar`) y, cuando corresponde, un rol
específico (`autorizar(...roles)`). Sin el rol correcto, 403. Sin sesión, 401.

## Reglas que no se pueden romper
1. El registro público solo acepta `rol` estudiante o empresa. `coordinacion` nunca se crea por esta vía.
2. Sin una fila vigente en `consentimientos`, no se crea la cuenta.
3. La cuenta nace `pendiente_verificacion`; ninguna cuenta en ese estado puede iniciar sesión.
4. La contraseña se guarda únicamente como hash bcrypt (costo ≥ 12) y se compara con `bcrypt.compare`,
   nunca con `===`.
5. El JWT de acceso lleva solo `sub`, `rol` y `exp`. Nunca correo, nombre ni RUT.
6. El refresco vive en cookie `httpOnly`, `secure`, `sameSite=strict`. Nunca en el cuerpo de la
   respuesta ni en `localStorage`.
7. En la base se guarda el hash del refresco, nunca el token.
8. Usar un refresco rota la sesión: el usado queda revocado, se emite uno nuevo.
9. Un refresco ya revocado que reaparece revoca **todas** las sesiones activas de esa cuenta.
10. Login y recuperación de clave responden lo mismo exista o no la cuenta: no se enumeran usuarios.
11. Cinco fallos de login en 15 minutos bloquean los intentos siguientes hasta que la ventana expira.
12. El token de restablecimiento de clave es de un solo uso, expira en 1 hora y se guarda hasheado.

## Casos borde
| Situación | Qué pasa |
|---|---|
| Se registra un correo que ya existe | 409 `AUTH_CORREO_YA_REGISTRADO` |
| Se registra con `rol=coordinacion` | 422 `VALIDACION_ENTRADA` |
| Login con correo inexistente | 401 `AUTH_CREDENCIALES_INVALIDAS`, mismo mensaje que clave incorrecta |
| Login con cuenta `pendiente_verificacion` y clave correcta | 403 `AUTH_EMAIL_NO_VERIFICADO` |
| Sexto intento de login con clave correcta, dentro de la ventana de bloqueo | 403 `AUTH_CUENTA_BLOQUEADA` |
| Login exitoso después de una racha de fallos | El contador de intentos se resetea a 0 |
| Se usa el enlace de verificación dos veces | La segunda vez, 422 `AUTH_TOKEN_INVALIDO` |
| Se pide recuperar clave para un correo que no existe | 200, mismo cuerpo que si existiera |
| Se usa el token de restablecimiento después de una hora | 422 `AUTH_TOKEN_EXPIRADO` |
| Se usa el token de restablecimiento dos veces | La segunda vez, 422 `AUTH_TOKEN_INVALIDO` |
| Se llama `/auth/refrescar` sin cookie o con una inválida | 401, no se emite nada |
| Se llama `/auth/logout` sin sesión activa | 204 igual: cerrar sesión sin sesión no es un error |
| Un estudiante autenticado entra a una ruta `autorizar('coordinacion')` | 403 |

## Criterios de aceptación
- [ ] Dado un correo nuevo, contraseña válida, rol `estudiante` y consentimiento aceptado, cuando se
      registra, entonces responde 201 y la cuenta queda `pendiente_verificacion`
- [ ] Dado un registro sin marcar el consentimiento, cuando se envía, entonces responde 422 `CONSENTIMIENTO_REQUERIDO`
- [ ] Dado un correo ya registrado, cuando se intenta registrar de nuevo, entonces responde 409 `AUTH_CORREO_YA_REGISTRADO`
- [ ] Dada una cuenta `pendiente_verificacion`, cuando se usa su token de verificación, entonces queda `activo` con `email_verificado_at` lleno
- [ ] Dado ese mismo token de verificación, cuando se reutiliza, entonces responde 422 `AUTH_TOKEN_INVALIDO`
- [ ] Dadas credenciales correctas y cuenta `activo`, cuando hace login, entonces responde con un access token y una cookie de refresco `httpOnly`
- [ ] Dada una cuenta `pendiente_verificacion` con credenciales correctas, cuando hace login, entonces responde 403 `AUTH_EMAIL_NO_VERIFICADO`
- [ ] Dado un correo inexistente, cuando se intenta login, entonces responde 401 `AUTH_CREDENCIALES_INVALIDAS`
- [ ] Dados 5 intentos fallidos en 15 minutos, cuando se intenta un sexto con la clave correcta, entonces responde 403 `AUTH_CUENTA_BLOQUEADA`
- [ ] Dado un refresco válido, cuando se usa en `/auth/refrescar`, entonces se emite uno nuevo y el usado queda revocado en `sesiones`
- [ ] Dado un refresco ya usado, cuando se reutiliza, entonces todas las sesiones de esa cuenta quedan revocadas y responde 401
- [ ] Dada una ruta protegida, cuando no llega token de acceso o llegó vencido, entonces responde 401
- [ ] Dada una ruta `autorizar('coordinacion')`, cuando entra un estudiante autenticado, entonces responde 403
- [ ] Dado `/auth/logout` con sesión activa, cuando se llama, entonces la fila de `sesiones` queda revocada y la cookie se limpia
- [ ] Dado `/auth/recuperar-clave` con un correo que no existe, cuando se llama, entonces responde 200 con el mismo cuerpo que si existiera
- [ ] Dado un token de restablecimiento válido, cuando se usa, entonces la clave cambia y una segunda vez responde 422 `AUTH_TOKEN_INVALIDO`

## Fuera de alcance
Perfiles de estudiante y empresa (`estudiantes`, `empresas` — Fase 2), cuenta SMTP real de producción
(en desarrollo el correo se ve vía Ethereal, una casilla de prueba gratuita; el `SMTP_HOST` real es
tarea de Fase 8), 2FA, login con proveedores externos (Google/Microsoft), la primera cuenta de
coordinación (se siembra a mano, fuera de código), y el estado administrativo `bloqueado` de una
cuenta (acción manual de coordinación, no definida todavía).
