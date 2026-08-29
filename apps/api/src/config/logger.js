const pino = require('pino');
const env = require('./env');

// Nunca se registran: contraseñas, tokens, cookies, RUT, correos, contenido/nombre de CV (docs/03-seguridad.md).
// El comodín `*` de pino cubre un solo nivel de profundidad, no cualquier profundidad: por eso los
// mismos nombres de campo se listan a nivel raíz y bajo `req.body`, que son las dos formas en que un
// dato personal entra al logger (`log.info({ correo })` y el cuerpo de la petición). Esta lista es la
// segunda barrera, no la primera: la primera es no pasar nunca un objeto con datos personales al logger.
// "clave"/"claveNueva" son los nombres reales que usan los esquemas de auth.schemas.js, no "password".
const NOMBRES_SENSIBLES = [
  'password',
  'passwordHash',
  'clave',
  'claveNueva',
  'token',
  'accessToken',
  'refreshToken',
  'rut',
  'rutUltimos4',
  'rutCifradoKey',
  'email',
  'correo',
  'cv',
  'telefono',
  'nombres',
  'apellidos',
];
const CAMPOS_CENSURADOS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...NOMBRES_SENSIBLES,
  ...NOMBRES_SENSIBLES.map((campo) => `*.${campo}`),
  ...NOMBRES_SENSIBLES.map((campo) => `req.body.${campo}`),
];

const logger = pino({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  redact: { paths: CAMPOS_CENSURADOS, censor: '[censurado]' },
});

module.exports = logger;
