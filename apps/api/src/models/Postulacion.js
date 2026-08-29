const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Postulacion = sequelize.define(
  'Postulacion',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    ofertaId: { type: DataTypes.BIGINT, allowNull: false },
    estudianteId: { type: DataTypes.BIGINT, allowNull: false },
    mensaje: { type: DataTypes.TEXT, allowNull: true },
    // Copia congelada del CV al momento de postular: no se actualiza si el estudiante sube uno
    // nuevo después (docs/02-modelo-de-datos.md).
    cvArchivoId: { type: DataTypes.BIGINT, allowNull: false },
    estado: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'recibida' },
    estadoActualizadoAt: { type: DataTypes.DATE, allowNull: false },
    respondidaPorEmpresa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: 'postulaciones', underscored: true },
);

module.exports = Postulacion;
