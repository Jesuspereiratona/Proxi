const { ErrorValidacion } = require('../errors');
const { VALIDACION_ENTRADA } = require('@proxi/errores');

// Mismo patrón que validar.middleware.js pero para req.params: un :id no numérico no debe llegar
// al service como un 500 (ver auditoría de Fase 2).
const validarParams = (esquema) => (req, res, next) => {
  const resultado = esquema.safeParse(req.params);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return next(new ErrorValidacion(VALIDACION_ENTRADA, 'El parámetro de la ruta no es válido.', { detalles }));
  }
  req.params = resultado.data;
  next();
};

module.exports = validarParams;
