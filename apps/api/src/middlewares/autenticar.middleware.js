const { NoAutenticado } = require('../errors');
const { AUTH_TOKEN_EXPIRADO, AUTH_TOKEN_INVALIDO } = require('@proxi/errores');
const tokens = require('../services/auth/tokens');

const autenticar = (req, res, next) => {
  const encabezado = req.headers.authorization || '';
  const [esquema, token] = encabezado.split(' ');
  if (esquema !== 'Bearer' || !token) {
    return next(new NoAutenticado(AUTH_TOKEN_INVALIDO, 'Falta el token de acceso.'));
  }

  try {
    const payload = tokens.verificarAcceso(token);
    req.usuario = { id: payload.sub, rol: payload.rol };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new NoAutenticado(AUTH_TOKEN_EXPIRADO, 'El token de acceso expiró.'));
    }
    next(new NoAutenticado(AUTH_TOKEN_INVALIDO, 'El token de acceso no es válido.'));
  }
};

module.exports = autenticar;
