const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Archivo = sequelize.define(
  'Archivo',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    propietarioUsuarioId: { type: DataTypes.BIGINT, allowNull: false },
    nombreOriginal: { type: DataTypes.TEXT, allowNull: false },
    nombreAlmacenado: { type: DataTypes.TEXT, allowNull: false },
    mime: { type: DataTypes.TEXT, allowNull: false },
    tamanoBytes: { type: DataTypes.BIGINT, allowNull: false },
    tipo: { type: DataTypes.TEXT, allowNull: false },
    expiraAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'archivos', underscored: true },
);

module.exports = Archivo;
