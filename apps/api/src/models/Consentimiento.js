const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Consentimiento = sequelize.define(
  'Consentimiento',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.BIGINT, allowNull: false },
    versionPolitica: { type: DataTypes.TEXT, allowNull: false },
    otorgadoAt: { type: DataTypes.DATE, allowNull: false },
    revocadoAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'consentimientos', underscored: true },
);

module.exports = Consentimiento;
