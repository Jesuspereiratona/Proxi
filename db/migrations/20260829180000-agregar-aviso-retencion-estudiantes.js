'use strict';

// La tarea de retención (Fase 7) necesita saber a quién ya le avisó, para no mandar el correo todos
// los días hasta que se cumpla el plazo completo de RETENCION_CV_MESES.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('estudiantes', 'aviso_retencion_enviado_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('estudiantes', 'aviso_retencion_enviado_at');
  },
};
