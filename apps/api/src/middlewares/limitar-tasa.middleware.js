const rateLimit = require('express-rate-limit');
const { DemasiadasSolicitudes } = require('../errors');
const { DEMASIADAS_SOLICITUDES } = require('@proxi/errores');

const VENTANA_MS = 15 * 60 * 1000;
const MAX_PETICIONES = 300;

const limitarTasa = rateLimit({
  windowMs: VENTANA_MS,
  max: MAX_PETICIONES,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new DemasiadasSolicitudes(DEMASIADAS_SOLICITUDES, 'Demasiadas solicitudes, intenta más tarde.'));
  },
});

module.exports = limitarTasa;
