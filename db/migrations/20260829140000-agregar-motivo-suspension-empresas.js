'use strict';

// Agregado durante la auditoría de seguridad de Fase 2: sin una forma de suspender una empresa
// validada, un fraude descubierto después de la validación no tenía remedio salvo editar la base a
// mano. motivo_rechazo es específico de la transición pendiente->rechazada; se necesita una columna
// propia para no mezclar los dos motivos.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('empresas', 'motivo_suspension', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('empresas', 'motivo_suspension');
  },
};
