const { AppError, ErrorValidacion } = require('../errors');
const { ERROR_INTERNO, JSON_INVALIDO, ARCHIVO_INVALIDO, CUERPO_DEMASIADO_GRANDE } = require('@proxi/errores');
const logger = require('../config/logger');

const manejadorErrores = (errorOriginal, req, res, next) => {
  if (res.headersSent) return next(errorOriginal);

  // express.json() lanza un SyntaxError con el cuerpo crudo de la petición adjunto (propiedad
  // `body`). Si se registrara tal cual, cualquier JSON mal formado filtraría al log lo que sea
  // que el cliente haya mandado sin necesidad de ningún endpoint que use esos datos todavía.
  const esJsonInvalido = errorOriginal instanceof SyntaxError && errorOriginal.status === 400 && 'body' in errorOriginal;
  // multer (subida de CV) lanza su propio MulterError -- tamaño excedido, campo inesperado, etc.
  // Sin este caso caía como 500 en vez de un 422 que el cliente pueda mostrar.
  const esErrorMulter = errorOriginal?.name === 'MulterError';
  // express.json({limit:'1mb'}) lanza esto para CUALQUIER petición (ni siquiera hace falta estar
  // autenticado) cuyo cuerpo supere el límite — sin este caso caía como 500 ERROR_INTERNO en vez de
  // un 422 operacional (pentester-api).
  const esCuerpoDemasiadoGrande = errorOriginal?.type === 'entity.too.large';
  const error = esJsonInvalido
    ? new ErrorValidacion(JSON_INVALIDO, 'El cuerpo de la petición no es JSON válido.')
    : esErrorMulter
      ? new ErrorValidacion(ARCHIVO_INVALIDO, 'El archivo no cumple los requisitos de tamaño o formato.')
      : esCuerpoDemasiadoGrande
        ? new ErrorValidacion(CUERPO_DEMASIADO_GRANDE, 'El cuerpo de la petición es demasiado grande.')
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
