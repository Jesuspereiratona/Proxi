'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sesiones', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      refresh_token_hash: { type: Sequelize.TEXT, allowNull: false },
      expira_at: { type: Sequelize.DATE, allowNull: false },
      revocada_at: { type: Sequelize.DATE, allowNull: true },
      ip: { type: Sequelize.TEXT, allowNull: true },
      user_agent: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('sesiones', ['usuario_id']);
    await queryInterface.addIndex('sesiones', ['refresh_token_hash']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sesiones');
  },
};
