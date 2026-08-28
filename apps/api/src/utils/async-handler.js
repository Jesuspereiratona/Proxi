// Express 5 ya reenvía los rechazos de una función async al manejador de errores.
// Se mantiene explícito por si baja la versión sin querer (docs/04-manejo-de-errores.md).
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
