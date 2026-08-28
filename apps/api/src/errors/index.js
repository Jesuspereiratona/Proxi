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

const clase = (httpStatus) => class extends AppError {
  constructor(codigo, mensaje, opciones = {}) {
    super(codigo, mensaje, { ...opciones, httpStatus });
  }
};

const ErrorValidacion = clase(422);
const NoAutenticado = clase(401);
const NoAutorizado = clase(403);
const NoEncontrado = clase(404);
const Conflicto = clase(409);
const ReglaDeNegocio = clase(422);
const DemasiadasSolicitudes = clase(429);

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
