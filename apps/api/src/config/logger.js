const pino = require('pino');
const env = require('./env');

// Nunca se registran: contraseñas, tokens, cookies, RUT, correos, contenido/nombre de CV (docs/03-seguridad.md).
const CAMPOS_CENSURADOS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.rut',
  '*.email',
  '*.correo',
  '*.cv',
];

const logger = pino({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  redact: { paths: CAMPOS_CENSURADOS, censor: '[censurado]' },
});

module.exports = logger;
