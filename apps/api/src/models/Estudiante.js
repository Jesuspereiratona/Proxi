const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// rut_cifrado no se declara aquí: se lee/escribe siempre por repositories/estudiantes.repository.js
// con SQL crudo (pgp_sym_encrypt/pgp_sym_decrypt). Declararlo como columna normal invitaría a leerlo
// sin descifrar por accidente en cualquier consulta que use este modelo.
const Estudiante = sequelize.define(
  'Estudiante',
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuarioId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
    nombres: { type: DataTypes.TEXT, allowNull: false },
    apellidos: { type: DataTypes.TEXT, allowNull: false },
    // underscored:true no inserta un guion antes de un dígito (rutUltimos4 -> rut_ultimos4), pero la
    // columna real es rut_ultimos_4: hay que forzar el nombre en vez de confiar en el mapeo automático.
    rutUltimos4: { type: DataTypes.CHAR(4), allowNull: true, field: 'rut_ultimos_4' },
    carrera: { type: DataTypes.TEXT, allowNull: false },
    nivel: { type: DataTypes.INTEGER, allowNull: true },
    telefono: { type: DataTypes.TEXT, allowNull: true },
    cvArchivoId: { type: DataTypes.BIGINT, allowNull: true },
  },
  { tableName: 'estudiantes', underscored: true },
);

module.exports = Estudiante;
