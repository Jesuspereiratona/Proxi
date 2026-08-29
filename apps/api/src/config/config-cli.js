// Config para sequelize-cli (migraciones/seeds), no para la app en tiempo de ejecución.
// Reutiliza env.js como única fuente de verdad: sequelize-cli exige un objeto por entorno, pero
// env.js ya resolvió las variables correctas del entorno activo, así que las tres apuntan a lo mismo.
const env = require('./env');

const config = {
  username: env.db.usuario,
  password: env.db.password,
  database: env.db.nombre,
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  dialectOptions: env.esProduccion ? { ssl: { require: true, rejectUnauthorized: true } } : {},
};

module.exports = { development: config, test: config, production: config };
