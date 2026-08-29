const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Empresa = sequelize.define(
  'Empresa',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
    razonSocial: { type: DataTypes.TEXT, allowNull: false },
    rutEmpresa: { type: DataTypes.TEXT, allowNull: false, unique: true },
    giro: { type: DataTypes.TEXT, allowNull: true },
    sitioWeb: { type: DataTypes.TEXT, allowNull: true },
    comuna: { type: DataTypes.TEXT, allowNull: true },
    contactoNombre: { type: DataTypes.TEXT, allowNull: false },
    contactoCargo: { type: DataTypes.TEXT, allowNull: false },
    estadoValidacion: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'pendiente' },
    validadaPorUsuarioId: { type: DataTypes.BIGINT, allowNull: true },
    validadaAt: { type: DataTypes.DATE, allowNull: true },
    motivoRechazo: { type: DataTypes.TEXT, allowNull: true },
    motivoSuspension: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'empresas', underscored: true },
);

module.exports = Empresa;
