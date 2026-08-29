'use strict';

// Append-only: nunca se actualiza ni se borra, solo se inserta (docs/02-modelo-de-datos.md).
// Por eso no lleva updated_at.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('oferta_eventos', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      oferta_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'ofertas', key: 'id' },
        onDelete: 'CASCADE',
      },
      estado_anterior: { type: Sequelize.TEXT, allowNull: true },
      estado_nuevo: { type: Sequelize.TEXT, allowNull: false },
      // NULL = lo hizo el sistema (tarea cerrarOfertasVencidas), no una persona.
      actor_usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'SET NULL',
      },
      motivo: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('oferta_eventos', ['oferta_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('oferta_eventos');
  },
};
