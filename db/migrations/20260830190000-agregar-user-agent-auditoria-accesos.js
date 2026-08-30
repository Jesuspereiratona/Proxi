'use strict';

// Estaba en el modelo de datos original (docs/02-modelo-de-datos.md) y se implementó sin ella en la
// Fase 4. El simulacro de brecha (docs/09-procedimiento-de-brecha.md, hueco 7) la marcó como falta:
// sin esto no se puede distinguir, al investigar un acceso indebido, si dos accesos vinieron del
// mismo cliente o de uno distinto con la misma IP (una red compartida, un proxy).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('auditoria_accesos', 'user_agent', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('auditoria_accesos', 'user_agent');
  },
};
