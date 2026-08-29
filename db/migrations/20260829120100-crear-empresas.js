'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('empresas', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        unique: true,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      razon_social: { type: Sequelize.TEXT, allowNull: false },
      rut_empresa: { type: Sequelize.TEXT, allowNull: false, unique: true },
      giro: { type: Sequelize.TEXT, allowNull: true },
      sitio_web: { type: Sequelize.TEXT, allowNull: true },
      comuna: { type: Sequelize.TEXT, allowNull: true },
      contacto_nombre: { type: Sequelize.TEXT, allowNull: false },
      contacto_cargo: { type: Sequelize.TEXT, allowNull: false },
      estado_validacion: { type: Sequelize.TEXT, allowNull: false, defaultValue: 'pendiente' },
      validada_por_usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'SET NULL',
      },
      validada_at: { type: Sequelize.DATE, allowNull: true },
      motivo_rechazo: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addConstraint('empresas', {
      fields: ['estado_validacion'],
      type: 'check',
      name: 'empresas_estado_validacion_check',
      where: { estado_validacion: ['pendiente', 'validada', 'rechazada', 'suspendida'] },
    });
    await queryInterface.addIndex('empresas', ['estado_validacion']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('empresas');
  },
};
