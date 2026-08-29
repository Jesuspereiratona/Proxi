const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Sesion = require('./Sesion');
const Consentimiento = require('./Consentimiento');
const TokenVerificacion = require('./TokenVerificacion');
const Estudiante = require('./Estudiante');
const Empresa = require('./Empresa');

Usuario.hasMany(Sesion, { foreignKey: 'usuarioId' });
Sesion.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasMany(Consentimiento, { foreignKey: 'usuarioId' });
Consentimiento.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasMany(TokenVerificacion, { foreignKey: 'usuarioId' });
TokenVerificacion.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasOne(Estudiante, { foreignKey: 'usuarioId' });
Estudiante.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasOne(Empresa, { foreignKey: 'usuarioId' });
Empresa.belongsTo(Usuario, { foreignKey: 'usuarioId' });

module.exports = { sequelize, Usuario, Sesion, Consentimiento, TokenVerificacion, Estudiante, Empresa };
