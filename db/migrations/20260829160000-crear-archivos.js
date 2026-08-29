'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('archivos', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      propietario_usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Se muestra, nunca se usa como ruta de disco (docs/03-seguridad.md).
      nombre_original: { type: Sequelize.TEXT, allowNull: false },
      // UUID generado por el servidor. Es lo único que toca el sistema de archivos.
      nombre_almacenado: { type: Sequelize.TEXT, allowNull: false, unique: true },
      mime: { type: Sequelize.TEXT, allowNull: false },
      tamano_bytes: { type: Sequelize.BIGINT, allowNull: false },
      tipo: { type: Sequelize.TEXT, allowNull: false },
      expira_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addConstraint('archivos', {
      fields: ['tipo'],
      type: 'check',
      name: 'archivos_tipo_check',
      // Solo 'cv' tiene endpoint en esta fase; 'logo' queda reservado porque ya está en el modelo
      // de datos (docs/02-modelo-de-datos.md), no porque haya código que lo use todavía.
      where: { tipo: ['cv', 'logo'] },
    });
    await queryInterface.addIndex('archivos', ['propietario_usuario_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('archivos');
  },
};
