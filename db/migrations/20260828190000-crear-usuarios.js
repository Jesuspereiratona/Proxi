'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS citext;');

    await queryInterface.createTable('usuarios', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      email: { type: 'CITEXT', unique: true, allowNull: false },
      password_hash: { type: Sequelize.TEXT, allowNull: false },
      rol: { type: Sequelize.TEXT, allowNull: false },
      estado: { type: Sequelize.TEXT, allowNull: false, defaultValue: 'pendiente_verificacion' },
      email_verificado_at: { type: Sequelize.DATE, allowNull: true },
      ultimo_acceso_at: { type: Sequelize.DATE, allowNull: true },
      intentos_fallidos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      // No estaba en docs/02-modelo-de-datos.md: sin esta columna el bloqueo temporal de 15 minutos
      // no tiene desde cuándo contar sin reusar ultimo_acceso_at, que ya significa otra cosa.
      intentos_fallidos_desde: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addConstraint('usuarios', {
      fields: ['rol'],
      type: 'check',
      name: 'usuarios_rol_check',
      where: { rol: ['estudiante', 'empresa', 'coordinacion'] },
    });
    await queryInterface.addConstraint('usuarios', {
      fields: ['estado'],
      type: 'check',
      name: 'usuarios_estado_check',
      where: { estado: ['pendiente_verificacion', 'activo', 'bloqueado'] },
    });
    await queryInterface.addIndex('usuarios', ['rol']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuarios');
  },
};
