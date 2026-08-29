const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sesion = sequelize.define(
  'Sesion',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.BIGINT, allowNull: false },
    refreshTokenHash: { type: DataTypes.TEXT, allowNull: false },
    expiraAt: { type: DataTypes.DATE, allowNull: false },
    revocadaAt: { type: DataTypes.DATE, allowNull: true },
    ip: { type: DataTypes.TEXT, allowNull: true },
    userAgent: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'sesiones', underscored: true },
);

module.exports = Sesion;
