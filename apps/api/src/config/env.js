const path = require('path');

// No depender de process.cwd(): npm cambia el cwd al workspace al correr `npm test -w apps/api`,
// pero el .env vive en la raíz del monorepo (junto a docker-compose.yml).
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

// Sin valor por defecto seguro: si falta alguna, la app no debe arrancar.
const REQUERIDAS = [
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

const faltantes = REQUERIDAS.filter((clave) => !process.env[clave]);
if (faltantes.length > 0) {
  throw new Error(`Faltan variables de entorno obligatorias: ${faltantes.join(', ')}`);
}

const puerto = Number(process.env.PORT) || 3000;

const env = {
  nodeEnv: process.env.NODE_ENV,
  puerto,
  apiUrl: process.env.API_URL || `http://localhost:${puerto}`,
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    nombre: process.env.DB_NAME,
    usuario: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
};

module.exports = env;
