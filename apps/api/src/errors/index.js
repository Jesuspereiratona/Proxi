class AppError extends Error {
  constructor(codigo, mensaje, { httpStatus = 400, detalles = null, causa = null, esOperacional = true } = {}) {
    super(mensaje);
    this.name = this.constructor.name;
    this.codigo = codigo;
    this.httpStatus = httpStatus;
    this.detalles = detalles;
    this.causa = causa;
    this.esOperacional = esOperacional;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Class expressions no heredan el nombre de la variable externa: sin esto, error.name
// (usado en logs y auditoría) queda vacío para las nueve subclases.
const clase = (nombre, httpStatus) => {
  const Clase = class extends AppError {
    constructor(codigo, mensaje, opciones = {}) {
      super(codigo, mensaje, { ...opciones, httpStatus });
    }
  };
  Object.defineProperty(Clase, 'name', { value: nombre });
  return Clase;
};

const ErrorValidacion = clase('ErrorValidacion', 422);
const NoAutenticado = clase('NoAutenticado', 401);
const NoAutorizado = clase('NoAutorizado', 403);
const NoEncontrado = clase('NoEncontrado', 404);
const Conflicto = clase('Conflicto', 409);
const ReglaDeNegocio = clase('ReglaDeNegocio', 422);
const DemasiadasSolicitudes = clase('DemasiadasSolicitudes', 429);

class ErrorInterno extends AppError {
  constructor(mensaje = 'Ha ocurrido un error interno.', opciones = {}) {
    super('ERROR_INTERNO', mensaje, { ...opciones, httpStatus: 500, esOperacional: false });
  }
}

module.exports = {
  AppError,
  ErrorValidacion,
  NoAutenticado,
  NoAutorizado,
  NoEncontrado,
  Conflicto,
  ReglaDeNegocio,
  DemasiadasSolicitudes,
  ErrorInterno,
};
