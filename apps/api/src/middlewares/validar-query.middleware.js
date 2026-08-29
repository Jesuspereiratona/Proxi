const { ErrorValidacion } = require('../errors');
const { VALIDACION_ENTRADA } = require('@proxi/errores');

// Mismo patrón que validar.middleware.js pero para req.query (filtros de listados públicos). En
// Express 5, req.query es un getter sin setter: reasignarlo (req.query = ...) no lanza error, pero
// tampoco hace nada — queda con las strings crudas de la URL, silenciosamente. Por eso el resultado
// coercionado se deja en req.filtros, no en req.query.
const validarQuery = (esquema) => (req, res, next) => {
  const resultado = esquema.safeParse(req.query);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return next(new ErrorValidacion(VALIDACION_ENTRADA, 'Los filtros no son válidos.', { detalles }));
  }
  req.filtros = resultado.data;
  next();
};

module.exports = validarQuery;
