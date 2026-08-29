'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('consentimientos', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      version_politica: { type: Sequelize.TEXT, allowNull: false },
      otorgado_at: { type: Sequelize.DATE, allowNull: false },
      revocado_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('consentimientos', ['usuario_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('consentimientos');
  },
};
