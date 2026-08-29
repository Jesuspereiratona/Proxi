'use strict';

// La columna cv_archivo_id ya existe desde la migración de Fase 2 (crear-estudiantes), sin FK
// porque la tabla "archivos" no existía todavía. Se completa la referencia acá.
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('estudiantes', {
      fields: ['cv_archivo_id'],
      type: 'foreign key',
      name: 'estudiantes_cv_archivo_id_fkey',
      references: { table: 'archivos', field: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('estudiantes', 'estudiantes_cv_archivo_id_fkey');
  },
};
