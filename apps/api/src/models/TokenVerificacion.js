const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TokenVerificacion = sequelize.define(
  'TokenVerificacion',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.BIGINT, allowNull: false },
    tokenHash: { type: DataTypes.TEXT, allowNull: false },
    tipo: { type: DataTypes.TEXT, allowNull: false },
    expiraAt: { type: DataTypes.DATE, allowNull: false },
    usadoAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'tokens_verificacion', underscored: true },
);

module.exports = TokenVerificacion;
