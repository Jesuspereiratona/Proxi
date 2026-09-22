const rateLimit = require('express-rate-limit');
const { DemasiadasSolicitudes } = require('../errors');
const { DEMASIADAS_SOLICITUDES } = require('@proxi/errores');
const tokens = require('../services/auth/tokens');

const VENTANA_MS = 15 * 60 * 1000;
const MAX_PETICIONES = 300;

// La clave del límite es el USUARIO cuando hay sesión válida, y la IP solo cuando no la hay.
//
// Por qué: con la IP como única clave, toda la red de la universidad comparte un presupuesto. Treinta
// estudiantes usando Proxi desde el campus agotaban entre todos los 300 de la ventana y se bloqueaban
// mutuamente — y el bloqueo lo sufre quien no hizo nada raro, que es el peor resultado posible para
// un límite pensado para frenar abusos.
//
// El token se VERIFICA acá, no solo se lee. Confiar en el `sub` de un token sin comprobar la firma
// sería regalar el límite: cualquiera podría inventar un `sub` distinto en cada petición y tener
// presupuesto infinito. Verificar es un HMAC-SHA256 sobre una cadena corta; el middleware de
// autenticación lo vuelve a hacer después, y esa repetición es más barata que la alternativa.
const claveDeLimite = (req) => {
  const [esquema, token] = (req.headers.authorization || '').split(' ');
  if (esquema === 'Bearer' && token) {
    try {
      return `usuario:${tokens.verificarAcceso(token).sub}`;
    } catch {
      // Token vencido, falsificado o mal formado: cae a la IP. Un atacante no gana nada mandando
      // basura en el encabezado, porque termina en el mismo cubo que si no mandara nada.
    }
  }
  // `req.ip` respeta `trust proxy` (app.js lo activa en producción), así que es la IP real de quien
  // llama y no la del proxy del proveedor.
  return `ip:${req.ip}`;
};

const limitarTasa = rateLimit({
  windowMs: VENTANA_MS,
  max: MAX_PETICIONES,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: claveDeLimite,
  handler: (req, res, next) => {
    next(new DemasiadasSolicitudes(DEMASIADAS_SOLICITUDES, 'Demasiadas solicitudes, intenta más tarde.'));
  },
});

module.exports = limitarTasa;
module.exports.claveDeLimite = claveDeLimite;
