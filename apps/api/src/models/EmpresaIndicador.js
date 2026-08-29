const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Mapea la vista materializada, no una tabla: solo lectura. Nada en el código hace
// EmpresaIndicador.create/update/destroy — se repuebla completa con
// tareas/recalcularIndicadores.js (REFRESH MATERIALIZED VIEW).
const EmpresaIndicador = sequelize.define(
  'EmpresaIndicador',
  {
    empresaId: { type: DataTypes.BIGINT, primaryKey: true },
    tasaRespuesta: { type: DataTypes.DOUBLE, allowNull: true },
    diasPromedioRespuesta: { type: DataTypes.DOUBLE, allowNull: true },
    tasaCierreDeclarado: { type: DataTypes.DOUBLE, allowNull: true },
    ofertasCerradasTotal: { type: DataTypes.INTEGER, allowNull: false },
    // underscored:true no inserta un guion antes de un dígito (ofertasPublicadas12m ->
    // ofertas_publicadas12m), pero la columna real es ofertas_publicadas_12m: mismo bug que
    // rutUltimos4 en Estudiante.js (Fase 2), mismo arreglo: forzar el nombre real.
    ofertasPublicadas12m: { type: DataTypes.INTEGER, allowNull: false, field: 'ofertas_publicadas_12m' },
    // Internos: nunca los devuelve indicadores.service.js al público, solo deciden si
    // tasaRespuesta/diasPromedioRespuesta tienen base suficiente para publicarse (auditoría de Fase 5).
    postulacionesTerminales: { type: DataTypes.INTEGER, allowNull: false },
    postulacionesConMovimiento: { type: DataTypes.INTEGER, allowNull: false },
    calculadoAt: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: 'empresa_indicadores', underscored: true, timestamps: false },
);

module.exports = EmpresaIndicador;
