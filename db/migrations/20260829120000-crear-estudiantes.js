'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    await queryInterface.createTable('estudiantes', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      nombres: { type: Sequelize.TEXT, allowNull: false },
      apellidos: { type: Sequelize.TEXT, allowNull: false },
      rut_cifrado: { type: Sequelize.BLOB, allowNull: true },
      rut_ultimos_4: { type: Sequelize.CHAR(4), allowNull: true },
      carrera: { type: Sequelize.TEXT, allowNull: false },
      nivel: { type: Sequelize.INTEGER, allowNull: true },
      telefono: { type: Sequelize.TEXT, allowNull: true },
      // Sin FK todavía: la tabla "archivos" no existe hasta Fase 4. Se agrega la referencia ahí.
      cv_archivo_id: { type: Sequelize.BIGINT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('estudiantes');
  },
};
