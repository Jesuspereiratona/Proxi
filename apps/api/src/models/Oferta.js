const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Oferta = sequelize.define(
  'Oferta',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    empresaId: { type: DataTypes.BIGINT, allowNull: false },
    titulo: { type: DataTypes.TEXT, allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: false },
    requisitos: { type: DataTypes.TEXT, allowNull: false },
    area: { type: DataTypes.TEXT, allowNull: false },
    modalidad: { type: DataTypes.TEXT, allowNull: false },
    comuna: { type: DataTypes.TEXT, allowNull: true },
    jornada: { type: DataTypes.TEXT, allowNull: false },
    remunerada: { type: DataTypes.BOOLEAN, allowNull: false },
    montoMensual: { type: DataTypes.INTEGER, allowNull: true },
    cupos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    fechaPublicacion: { type: DataTypes.DATE, allowNull: true },
    // Solo puede ser NULL mientras estado='borrador' (CHECK a nivel de base).
    fechaCierre: { type: DataTypes.DATE, allowNull: true },
    estado: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'borrador' },
    motivoCierre: { type: DataTypes.TEXT, allowNull: true },
    resultadoDeclarado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    cerradaAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'ofertas', underscored: true },
);

module.exports = Oferta;
