const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Prueba de a quién se notificó una brecha y cuándo (specs/13-notificacion-de-brecha/spec.md).
// Append-only, como auditoria_accesos: nadie la edita, solo se agregan filas.
const NotificacionBrecha = sequelize.define(
  'NotificacionBrecha',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    incidente: { type: DataTypes.TEXT, allowNull: false },
    usuarioId: { type: DataTypes.BIGINT, allowNull: false },
    // Nulo mientras el envío falló: la fila existe igual, con el error a la vista.
    enviadoAt: { type: DataTypes.DATE, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
  },
  { tableName: 'notificaciones_brecha', underscored: true, updatedAt: false },
);

module.exports = NotificacionBrecha;
