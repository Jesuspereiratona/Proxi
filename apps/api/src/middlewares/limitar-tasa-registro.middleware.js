const rateLimit = require('express-rate-limit');
const { DemasiadasSolicitudes } = require('../errors');
const { DEMASIADAS_SOLICITUDES } = require('@proxi/errores');

// A diferencia de limitar-tasa-auth.middleware.js (clave IP+correo, pensada para frenar el intento
// sobre UNA cuenta), acá la clave es solo la IP: quien enumera correos institucionales cambia el
// correo en cada intento, así que una clave que lo incluyera le daría un contador nuevo cada vez
// (auditoría de seguridad — /auth/registro sin límite propio permitía sondear si un correo existe
// a la velocidad del límite global, y cada sondeo manda un correo real a un tercero).
const VENTANA_MS = 60 * 60 * 1000;
const MAX_INTENTOS = 10;

const limitarTasaRegistro = rateLimit({
  windowMs: VENTANA_MS,
  max: MAX_INTENTOS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new DemasiadasSolicitudes(DEMASIADAS_SOLICITUDES, 'Demasiados intentos, espera unos minutos.'));
  },
});

module.exports = limitarTasaRegistro;
