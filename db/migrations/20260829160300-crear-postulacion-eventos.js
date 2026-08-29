'use strict';

// Append-only: nunca se actualiza ni se borra, solo se inserta. Mismo patrón que oferta_eventos.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('postulacion_eventos', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      postulacion_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'postulaciones', key: 'id' },
        onDelete: 'CASCADE',
      },
      estado_anterior: { type: Sequelize.TEXT, allowNull: true },
      estado_nuevo: { type: Sequelize.TEXT, allowNull: false },
      // NULL = lo hizo el sistema (tarea marcarSinRespuesta), no una persona.
      actor_usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'SET NULL',
      },
      motivo: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('postulacion_eventos', ['postulacion_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('postulacion_eventos');
  },
};
