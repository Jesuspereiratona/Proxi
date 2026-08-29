const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Append-only: nada en el código actualiza ni borra filas de esta tabla, solo se crean.
const OfertaEvento = sequelize.define(
  'OfertaEvento',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    ofertaId: { type: DataTypes.BIGINT, allowNull: false },
    estadoAnterior: { type: DataTypes.TEXT, allowNull: true },
    estadoNuevo: { type: DataTypes.TEXT, allowNull: false },
    actorUsuarioId: { type: DataTypes.BIGINT, allowNull: true },
    motivo: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'oferta_eventos', underscored: true, updatedAt: false },
);

module.exports = OfertaEvento;
