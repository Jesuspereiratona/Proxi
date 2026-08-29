const { ErrorValidacion } = require('../errors');
const { VALIDACION_ENTRADA } = require('@proxi/errores');

// Lista blanca: lo que no está declarado en el esquema se descarta, no se ignora (docs/03-seguridad.md).
const validar = (esquema) => (req, res, next) => {
  const resultado = esquema.safeParse(req.body);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return next(new ErrorValidacion(VALIDACION_ENTRADA, 'La entrada no cumple el formato esperado.', { detalles }));
  }
  req.body = resultado.data;
  next();
};

module.exports = validar;
