const { AppError, ErrorValidacion } = require('../errors');
const { ERROR_INTERNO, JSON_INVALIDO } = require('@proxi/errores');
const logger = require('../config/logger');

const manejadorErrores = (errorOriginal, req, res, next) => {
  if (res.headersSent) return next(errorOriginal);

  // express.json() lanza un SyntaxError con el cuerpo crudo de la petición adjunto (propiedad
  // `body`). Si se registrara tal cual, cualquier JSON mal formado filtraría al log lo que sea
  // que el cliente haya mandado sin necesidad de ningún endpoint que use esos datos todavía.
  const esJsonInvalido = errorOriginal instanceof SyntaxError && errorOriginal.status === 400 && 'body' in errorOriginal;
  const error = esJsonInvalido
    ? new ErrorValidacion(JSON_INVALIDO, 'El cuerpo de la petición no es JSON válido.')
    : errorOriginal;

  const esAppError = error instanceof AppError;
  const status = esAppError ? error.httpStatus : 500;
  const codigo = esAppError ? error.codigo : ERROR_INTERNO;
  const mensaje = esAppError && error.esOperacional ? error.message : 'Ha ocurrido un error interno.';
  const log = req.log || logger;

  // Lista blanca, no el objeto de error completo: propiedades como `causa` o `detalles` pueden
  // traer SQL con parámetros o el cuerpo de una petición (docs/03-seguridad.md).
  const errParaLog = { tipo: error.name, mensaje: error.message, codigo, stack: error.stack };

  if (!esAppError || !error.esOperacional) {
    log.error({ err: errParaLog, peticionId: req.id }, 'Error no operacional');
  } else {
    log.warn({ codigo, peticionId: req.id }, error.message);
  }

  res.status(status).json({
    error: {
      codigo,
      mensaje,
      ...(esAppError && error.esOperacional && error.detalles ? { detalles: error.detalles } : {}),
      peticionId: req.id,
    },
  });
};

module.exports = manejadorErrores;
