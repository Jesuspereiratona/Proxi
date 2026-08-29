const sequelize = require('../config/database');
const Usuario = require('./Usuario');
const Sesion = require('./Sesion');
const Consentimiento = require('./Consentimiento');
const TokenVerificacion = require('./TokenVerificacion');
const Estudiante = require('./Estudiante');
const Empresa = require('./Empresa');
const Oferta = require('./Oferta');
const OfertaEvento = require('./OfertaEvento');
const Archivo = require('./Archivo');
const Postulacion = require('./Postulacion');
const PostulacionEvento = require('./PostulacionEvento');
const AuditoriaAcceso = require('./AuditoriaAcceso');
const EmpresaIndicador = require('./EmpresaIndicador');

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

Usuario.hasMany(Archivo, { foreignKey: 'propietarioUsuarioId' });
Archivo.belongsTo(Usuario, { foreignKey: 'propietarioUsuarioId' });

Estudiante.hasMany(Postulacion, { foreignKey: 'estudianteId' });
Postulacion.belongsTo(Estudiante, { foreignKey: 'estudianteId' });

Oferta.hasMany(Postulacion, { foreignKey: 'ofertaId' });
Postulacion.belongsTo(Oferta, { foreignKey: 'ofertaId' });

Archivo.hasMany(Postulacion, { foreignKey: 'cvArchivoId' });
Postulacion.belongsTo(Archivo, { foreignKey: 'cvArchivoId' });

Postulacion.hasMany(PostulacionEvento, { foreignKey: 'postulacionId' });
PostulacionEvento.belongsTo(Postulacion, { foreignKey: 'postulacionId' });

Usuario.hasMany(AuditoriaAcceso, { foreignKey: 'usuarioId' });
AuditoriaAcceso.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Empresa.hasOne(EmpresaIndicador, { foreignKey: 'empresaId' });
EmpresaIndicador.belongsTo(Empresa, { foreignKey: 'empresaId' });

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
  Archivo,
  Postulacion,
  PostulacionEvento,
  AuditoriaAcceso,
  EmpresaIndicador,
};
