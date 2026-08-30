'use strict';

// Auditoría de Fase 7: la primera versión de eliminarCuenta() usaba estudiantes.nombres === 'Estudiante
// eliminado' para reconocer una cuenta ya anonimizada — un campo que el propio usuario puede editar
// (PATCH /estudiantes/perfil) y que además no cubre nunca a empresas/coordinación. Una columna propia
// en "usuarios", que ningún endpoint expone para editar, es la marca real.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuarios', 'anonimizado_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuarios', 'anonimizado_at');
  },
};
