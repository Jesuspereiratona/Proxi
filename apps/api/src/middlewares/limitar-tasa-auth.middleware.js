const rateLimit = require('express-rate-limit');
const { DemasiadasSolicitudes } = require('../errors');
const { DEMASIADAS_SOLICITUDES } = require('@proxi/errores');

// Más estricto que el límite global: 5 intentos por 15 min, por IP+correo (docs/03-seguridad.md).
// Es un mecanismo distinto del bloqueo de cuenta de intentosLogin.js: este frena a nivel de red,
// aquel persiste en la base y sobrevive a un cambio de IP.
const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 5;

// Fábrica, no una instancia compartida: /login y /recuperar-clave necesitan cada uno su propio
// contador. Con una sola instancia, agotar los 5 intentos en una ruta bloquea la otra para el mismo
// correo, que no es lo que pide docs/03-seguridad.md.
const crearLimitarTasaAuth = () =>
  rateLimit({
    windowMs: VENTANA_MS,
    max: MAX_INTENTOS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
    handler: (req, res, next) => {
      next(new DemasiadasSolicitudes(DEMASIADAS_SOLICITUDES, 'Demasiados intentos, espera unos minutos.'));
    },
  });

module.exports = crearLimitarTasaAuth;
