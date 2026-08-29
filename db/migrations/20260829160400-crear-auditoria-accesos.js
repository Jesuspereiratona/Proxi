'use strict';

// Exigida por la Ley 21.719 (docs/03-seguridad.md): quién vio o descargó datos personales de
// quién. Append-only, igual que los eventos de oferta/postulación.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auditoria_accesos', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      accion: { type: Sequelize.TEXT, allowNull: false },
      entidad: { type: Sequelize.TEXT, allowNull: false },
      entidad_id: { type: Sequelize.BIGINT, allowNull: false },
      ip: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('auditoria_accesos', ['usuario_id']);
    await queryInterface.addIndex('auditoria_accesos', ['entidad', 'entidad_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auditoria_accesos');
  },
};
