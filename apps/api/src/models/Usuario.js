const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define(
  'Usuario',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    email: { type: DataTypes.CITEXT, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.TEXT, allowNull: false },
    rol: { type: DataTypes.TEXT, allowNull: false },
    estado: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'pendiente_verificacion' },
    emailVerificadoAt: { type: DataTypes.DATE, allowNull: true },
    ultimoAccesoAt: { type: DataTypes.DATE, allowNull: true },
    intentosFallidos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    intentosFallidosDesde: { type: DataTypes.DATE, allowNull: true },
    // Fase 7 (supresión): cuándo se anonimizó la cuenta. Es la única marca real de "ya se borró" —
    // ningún endpoint la expone para editar, a diferencia de un campo de perfil (auditoría de Fase 7).
    anonimizadoAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'usuarios', underscored: true },
);

module.exports = Usuario;
