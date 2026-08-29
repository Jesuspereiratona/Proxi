const { NoAutorizado } = require('../errors');
const { NO_AUTORIZADO } = require('@proxi/errores');

const autorizar = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol)) {
    return next(new NoAutorizado(NO_AUTORIZADO, 'No tienes permiso para esta acción.'));
  }
  next();
};

module.exports = autorizar;
