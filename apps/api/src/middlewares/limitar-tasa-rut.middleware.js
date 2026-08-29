const rateLimit = require('express-rate-limit');
const { DemasiadasSolicitudes } = require('../errors');
const { DEMASIADAS_SOLICITUDES } = require('@proxi/errores');

// GET /estudiantes/:id/rut descifra un dato personal sensible. El límite global (300/15min) no
// frena a una cuenta de coordinación comprometida recorriendo ids en secuencia; este es más
// estricto, específico de esta ruta (auditoría de Fase 2).
const limitarTasaRut = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new DemasiadasSolicitudes(DEMASIADAS_SOLICITUDES, 'Demasiadas consultas de RUT, espera unos minutos.'));
  },
});

module.exports = limitarTasaRut;
