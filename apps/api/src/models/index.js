const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Sesion = require('./Sesion');
const Consentimiento = require('./Consentimiento');
const TokenVerificacion = require('./TokenVerificacion');
const Estudiante = require('./Estudiante');
const Empresa = require('./Empresa');
const Oferta = require('./Oferta');
const OfertaEvento = require('./OfertaEvento');

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

Empresa.hasMany(Oferta, { foreignKey: 'empresaId' });
Oferta.belongsTo(Empresa, { foreignKey: 'empresaId' });

Oferta.hasMany(OfertaEvento, { foreignKey: 'ofertaId' });
OfertaEvento.belongsTo(Oferta, { foreignKey: 'ofertaId' });

module.exports = {
  sequelize,
  Usuario,
  Sesion,
  Consentimiento,
  TokenVerificacion,
  Estudiante,
  Empresa,
  Oferta,
  OfertaEvento,
};
