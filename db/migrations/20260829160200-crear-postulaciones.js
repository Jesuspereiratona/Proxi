'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('postulaciones', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      oferta_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'ofertas', key: 'id' },
        onDelete: 'CASCADE',
      },
      estudiante_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'estudiantes', key: 'id' },
        onDelete: 'CASCADE',
      },
      mensaje: { type: Sequelize.TEXT, allowNull: true },
      // RESTRICT a propósito: una postulación enviada necesita conservar exactamente el CV que la
      // empresa recibió (docs/02-modelo-de-datos.md). Nunca debe poder borrarse un archivo que
      // todavía esté referenciado desde acá.
      cv_archivo_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'archivos', key: 'id' },
        onDelete: 'RESTRICT',
      },
      estado: { type: Sequelize.TEXT, allowNull: false, defaultValue: 'recibida' },
      estado_actualizado_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      respondida_por_empresa: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // La defensa real contra la postulación duplicada en paralelo: no alcanza con revisar antes
    // de crear, dos peticiones simultáneas pueden pasar esa revisión al mismo tiempo.
    await queryInterface.addConstraint('postulaciones', {
      fields: ['oferta_id', 'estudiante_id'],
      type: 'unique',
      name: 'postulaciones_oferta_estudiante_unique',
    });
    await queryInterface.addConstraint('postulaciones', {
      fields: ['estado'],
      type: 'check',
      name: 'postulaciones_estado_check',
      where: {
        estado: ['recibida', 'en_revision', 'entrevista', 'seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada'],
      },
    });

    await queryInterface.addIndex('postulaciones', ['estudiante_id']);
    await queryInterface.addIndex('postulaciones', ['oferta_id']);
    await queryInterface.addIndex('postulaciones', ['estado', 'estado_actualizado_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('postulaciones');
  },
};
