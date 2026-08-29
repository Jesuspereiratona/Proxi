const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Sesion = require('./Sesion');
const Consentimiento = require('./Consentimiento');
const TokenVerificacion = require('./TokenVerificacion');

Usuario.hasMany(Sesion, { foreignKey: 'usuarioId' });
Sesion.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasMany(Consentimiento, { foreignKey: 'usuarioId' });
Consentimiento.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasMany(TokenVerificacion, { foreignKey: 'usuarioId' });
TokenVerificacion.belongsTo(Usuario, { foreignKey: 'usuarioId' });

module.exports = { sequelize, Usuario, Sesion, Consentimiento, TokenVerificacion };
