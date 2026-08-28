const { Sequelize } = require('sequelize');
const env = require('./env');
const logger = require('./logger');

const sequelize = new Sequelize(env.db.nombre, env.db.usuario, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.esDesarrollo ? (sql) => logger.debug(sql) : false,
  dialectOptions: env.esProduccion ? { ssl: { require: true, rejectUnauthorized: true } } : {},
});

module.exports = sequelize;
