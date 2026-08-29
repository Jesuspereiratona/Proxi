const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../../config/env');

const firmarAcceso = ({ sub, rol }) =>
  jwt.sign({ sub, rol }, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });

// Lanza TokenExpiredError / JsonWebTokenError: el llamador decide el código de error HTTP.
const verificarAcceso = (token) => jwt.verify(token, env.jwt.accessSecret);

// Mismo mecanismo para refresco, verificación de correo y restablecimiento de clave: un valor
// aleatorio que se entrega una vez (cookie o correo) y un hash que se guarda en la base. El plano
// no se puede reconstruir a partir del hash.
const generarTokenAleatorio = () => {
  const plano = crypto.randomBytes(32).toString('hex');
  return { plano, hash: hashearToken(plano) };
};

const hashearToken = (plano) => crypto.createHash('sha256').update(plano).digest('hex');

module.exports = { firmarAcceso, verificarAcceso, generarTokenAleatorio, hashearToken };
