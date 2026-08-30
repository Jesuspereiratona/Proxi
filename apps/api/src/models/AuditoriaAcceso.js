const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Append-only, exigida por la Ley 21.719 (docs/03-seguridad.md).
const AuditoriaAcceso = sequelize.define(
  'AuditoriaAcceso',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.BIGINT, allowNull: false },
    accion: { type: DataTypes.TEXT, allowNull: false },
    entidad: { type: DataTypes.TEXT, allowNull: false },
    entidadId: { type: DataTypes.BIGINT, allowNull: false },
    ip: { type: DataTypes.TEXT, allowNull: true },
    userAgent: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'auditoria_accesos', underscored: true, updatedAt: false },
);

module.exports = AuditoriaAcceso;
