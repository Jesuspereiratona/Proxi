'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tokens_verificacion', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      token_hash: { type: Sequelize.TEXT, allowNull: false },
      tipo: { type: Sequelize.TEXT, allowNull: false },
      expira_at: { type: Sequelize.DATE, allowNull: false },
      usado_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addConstraint('tokens_verificacion', {
      fields: ['tipo'],
      type: 'check',
      name: 'tokens_verificacion_tipo_check',
      where: { tipo: ['verificacion_correo', 'restablecer_clave'] },
    });
    await queryInterface.addIndex('tokens_verificacion', ['usuario_id']);
    await queryInterface.addIndex('tokens_verificacion', ['token_hash']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tokens_verificacion');
  },
};
