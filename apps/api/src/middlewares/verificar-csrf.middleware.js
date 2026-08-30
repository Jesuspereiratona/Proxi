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
  // timingSafeEqual exige dos buffers del MISMO LARGO EN BYTES: comparar .length (caracteres
  // UTF-16) no lo garantiza si algún valor trae caracteres fuera de ASCII, y revienta con
  // ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH (auditoría de seguridad). Hashear ambos lados a un digest
  // de largo fijo antes de comparar evita el error de raíz, sin reintroducir el canal de tiempo por
  // longitud que timingSafeEqual existe para evitar.
  const digerir = (valor) => crypto.createHash('sha256').update(valor).digest();
  const coincide = cookieCsrf.length > 0
    && crypto.timingSafeEqual(digerir(cookieCsrf), digerir(encabezado));

  if (!coincide) {
    return next(new NoAutorizado(AUTH_CSRF_INVALIDO, 'Falta o no coincide el token CSRF.'));
  }
  next();
};

module.exports = verificarCsrf;
