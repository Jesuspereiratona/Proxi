const crypto = require('crypto');
const { NoAutorizado } = require('../errors');
const { AUTH_CSRF_INVALIDO } = require('@proxi/errores');

const NOMBRE_COOKIE_CSRF = 'csrf';
const ENCABEZADO_CSRF = 'x-csrf-token';

// Doble-submit cookie, capa extra sobre SameSite=Strict (auth.controller.js): esa cookie ya evita
// que el navegador mande la sesión en una petición cross-site, pero eso depende de que el
// navegador respete el atributo. Esto no — exige que quien pide /refrescar o /logout demuestre
// que puede LEER una cookie del mismo origen (un sitio ajeno no puede). Solo se exige cuando ya
// hay una cookie de sesión que proteger; sin ella, el endpoint ya rechaza por su cuenta.
const verificarCsrf = (req, res, next) => {
  if (!req.cookies?.refresco) return next();

  const cookieCsrf = req.cookies?.[NOMBRE_COOKIE_CSRF] || '';
  const encabezado = req.get(ENCABEZADO_CSRF) || '';
  // timingSafeEqual exige buffers del mismo largo, por eso la comparación de longitud va antes y
  // corta ahí — nunca le llega un largo distinto.
  const coincide = cookieCsrf.length > 0
    && cookieCsrf.length === encabezado.length
    && crypto.timingSafeEqual(Buffer.from(cookieCsrf), Buffer.from(encabezado));

  if (!coincide) {
    return next(new NoAutorizado(AUTH_CSRF_INVALIDO, 'Falta o no coincide el token CSRF.'));
  }
  next();
};

module.exports = verificarCsrf;
