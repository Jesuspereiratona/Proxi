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
    // Los bytes del archivo. Nulo en las filas de CV anteriores a la migración 20260920140000,
    // que siguen en disco (specs/10-logo-de-empresa/plan.md).
    contenido: { type: DataTypes.BLOB, allowNull: true },
    // El estado de un logo se deduce de estas tres marcas, no hay columna 'estado':
    // retiradoAt → retirado; si no, aprobadoAt → aprobado; si no, pendiente.
    aprobadoAt: { type: DataTypes.DATE, allowNull: true },
    aprobadoPorUsuarioId: { type: DataTypes.BIGINT, allowNull: true },
    retiradoAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'archivos', underscored: true },
);

module.exports = Archivo;
