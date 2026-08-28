const { AppError } = require('../errors');
const { ERROR_INTERNO } = require('@proxi/errores');
const logger = require('../config/logger');

// eslint-disable-next-line no-unused-vars
const manejadorErrores = (error, req, res, next) => {
  const esAppError = error instanceof AppError;
  const status = esAppError ? error.httpStatus : 500;
  const codigo = esAppError ? error.codigo : ERROR_INTERNO;
  const mensaje = esAppError && error.esOperacional ? error.message : 'Ha ocurrido un error interno.';
  const log = req.log || logger;

  if (!esAppError || !error.esOperacional) {
    log.error({ err: error, peticionId: req.id }, 'Error no operacional');
  } else {
    log.warn({ codigo, peticionId: req.id }, error.message);
  }

  res.status(status).json({
    error: {
      codigo,
      mensaje,
      ...(esAppError && error.detalles ? { detalles: error.detalles } : {}),
      peticionId: req.id,
    },
  });
};

module.exports = manejadorErrores;
