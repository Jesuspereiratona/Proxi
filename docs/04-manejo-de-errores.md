# 04 · Manejo de errores

Un error mal manejado es un usuario perdido y una pista regalada a un atacante. La estrategia es una
sola: **los errores se lanzan como objetos tipados y se responden en un único lugar.**

## La regla
Nunca aparece un `res.status(500).json(...)` improvisado dentro de un controller o un service.
El código lanza una clase de error; el `manejadorErrores` la traduce a una respuesta HTTP.

Esto importa porque el formato de respuesta queda garantizado, el registro en el log ocurre una vez y
no diez, y el día que cambie el formato se cambia en un archivo.

## Jerarquía
```js
// apps/api/src/errors/AppError.js
class AppError extends Error {
  constructor(codigo, mensaje, { httpStatus = 400, detalles = null, causa = null } = {}) {
    super(mensaje);
    this.name = this.constructor.name;
    this.codigo = codigo;        // estable, para el cliente
    this.httpStatus = httpStatus;
    this.detalles = detalles;    // qué campo falló, nunca datos internos
    this.causa = causa;          // error original; se registra, no se responde
    this.esOperacional = true;   // lo esperábamos: no es un bug
    Error.captureStackTrace(this, this.constructor);
  }
}
```

| Clase | HTTP | Cuándo |
|---|---|---|
| `ErrorValidacion` | 422 | La entrada no cumple el esquema |
| `NoAutenticado` | 401 | Falta el token o expiró |
| `NoAutorizado` | 403 | Tiene sesión pero no permiso para esta acción |
| `NoEncontrado` | 404 | No existe, o existe pero no es suyo |
| `Conflicto` | 409 | Choca con el estado actual (duplicado, transición inválida) |
| `ReglaDeNegocio` | 422 | La operación es válida en forma pero prohibida por una regla |
| `DemasiadasSolicitudes` | 429 | Límite de tasa |
| `ErrorInterno` | 500 | Todo lo demás. Se registra completo, se responde genérico |

**`esOperacional` es la distinción clave:** un error operacional es una situación prevista (el usuario
mandó algo inválido). Un error no operacional es un bug nuestro. Los primeros se responden con su
mensaje; los segundos se registran con todo el detalle y al usuario se le dice "error interno" y un
identificador de la petición. Nunca se le muestra el stack a un desconocido.

## Formato de respuesta — siempre el mismo
```json
{
  "error": {
    "codigo": "OFERTA_TRANSICION_INVALIDA",
    "mensaje": "Una oferta cerrada no puede volver a publicarse.",
    "detalles": { "estadoActual": "cerrada", "estadoSolicitado": "publicada" },
    "peticionId": "01J8X2K..."
  }
}
```
`codigo` es contrato: el cliente decide qué hacer según el código, nunca leyendo el texto del mensaje.
`peticionId` aparece en la respuesta y en el log: el usuario reporta ese código y se encuentra el caso
exacto en segundos.

## Catálogo de códigos
Vive en `packages/errores/codigos.js`, compartido por API y web para que los mensajes al usuario se
traduzcan en un solo lugar.

| Código | Significado |
|---|---|
| `AUTH_CREDENCIALES_INVALIDAS` | Correo o contraseña incorrectos (mensaje idéntico en ambos casos, a propósito) |
| `AUTH_TOKEN_EXPIRADO` | El cliente debe refrescar |
| `AUTH_CUENTA_BLOQUEADA` | Demasiados intentos fallidos |
| `AUTH_EMAIL_NO_VERIFICADO` | Falta confirmar el correo |
| `EMPRESA_NO_VALIDADA` | Intenta publicar sin validación de coordinación |
| `EMPRESA_CIERRES_PENDIENTES` | Tiene ofertas cerradas sin declarar resultado |
| `OFERTA_SIN_FECHA_CIERRE` | Falta la fecha de vigencia |
| `OFERTA_FECHA_CIERRE_INVALIDA` | La fecha de cierre está en el pasado |
| `OFERTA_TRANSICION_INVALIDA` | Cambio de estado no permitido |
| `OFERTA_NO_VIGENTE` | Se intenta postular a una oferta cerrada o vencida |
| `POSTULACION_DUPLICADA` | Ya postuló a esa oferta |
| `POSTULACION_TRANSICION_INVALIDA` | Cambio de estado no permitido |
| `POSTULACION_SIN_CV` | El estudiante no tiene CV cargado |
| `ARCHIVO_TIPO_NO_PERMITIDO` | No es un PDF real |
| `ARCHIVO_DEMASIADO_GRANDE` | Supera el límite |
| `CONSENTIMIENTO_REQUERIDO` | Falta aceptar la política de datos vigente |
| `VALIDACION_ENTRADA` | Falla de esquema; `detalles` lista los campos |
| `ERROR_INTERNO` | Bug nuestro |

Agregar un código es parte de implementar la funcionalidad, no un trámite posterior.

## Cómo se propagan
```js
// service: lanza, no responde
if (!TRANSICIONES[oferta.estado]?.includes(nuevoEstado)) {
  throw new Conflicto('OFERTA_TRANSICION_INVALIDA',
    'Esa transición de estado no está permitida.',
    { detalles: { estadoActual: oferta.estado, estadoSolicitado: nuevoEstado } });
}

// controller: no atrapa nada; el envoltorio manda el error al manejador
router.post('/:id/cerrar', autenticar, autorizar('empresa'), asyncHandler(async (req, res) => {
  const oferta = await ofertasService.cerrar(req.params.id, req.body, req.usuario);
  res.json(oferta);
}));
```
Sobre `asyncHandler`: **Express 5 ya reenvía solo** los rechazos de una función `async` al manejador de
errores; en Express 4 no lo hacía y la petición quedaba colgada en silencio. Como usamos Express 5 no
es estrictamente necesario, pero se mantiene por dos razones: deja explícito en el código que ahí
puede lanzarse un error, y protege de un downgrade accidental de versión. Si prefieres omitirlo,
omítelo en **todas** las rutas: lo peligroso es la mezcla.

## Errores no atrapados
En `server.js`:
```js
process.on('unhandledRejection', (e) => { log.fatal(e); process.exit(1); });
process.on('uncaughtException',  (e) => { log.fatal(e); process.exit(1); });
```
Se registra y se muere. Un proceso que sigue vivo después de un error desconocido está en un estado
que nadie puede razonar; el reinicio limpio es más seguro. En producción, el supervisor lo levanta.

## Registro (logs)
`pino` con salida JSON, un `peticionId` por petición.

**Nunca se registran:** contraseñas, tokens, cookies, RUT, correos, contenido o nombre de un CV.
Existe una lista de campos censurados en la configuración de pino. Un log con datos personales es una
filtración esperando a que alguien lea el archivo.

Niveles: `error` (algo se rompió), `warn` (algo sospechoso: 401 repetidos, límite de tasa alcanzado),
`info` (arranque, tareas programadas, cambios de estado), `debug` (solo en desarrollo).

## En el cliente
El módulo `assets/js/api/cliente.js` centraliza:
- 401 → intenta refrescar una vez; si falla, cierra sesión y manda al login.
- 403 → mensaje de permiso, sin reintentar.
- 422 → pinta los errores campo por campo en el formulario, usando `detalles`.
- 429 → "demasiados intentos, espera un momento".
- 5xx → mensaje genérico + `peticionId` visible para que el usuario lo reporte.

Ninguna pantalla maneja esto por su cuenta.
