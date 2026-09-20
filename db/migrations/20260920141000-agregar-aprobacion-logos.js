'use strict';

// Aprobación de un logo antes de mostrarlo en público (specs/10-logo-de-empresa/plan.md, decisión 2).
//
// Tres marcas de tiempo en vez de una columna `estado` de texto. El estado se deduce
// (retirado_at → retirado; si no, aprobado_at → aprobado; si no, pendiente) y además queda
// registrado CUÁNDO y QUIÉN, que es justo lo que un retiro por contenido inapropiado tiene que poder
// demostrar después. Una columna `estado` guardaría menos y no sería más simple de leer.
//
// aprobado_por_usuario_id va en ON DELETE SET NULL y no RESTRICT: si la cuenta de coordinación que
// aprobó se elimina algún día, el logo no debe quedar bloqueado ni desaparecer. Es distinto de
// auditoria_accesos, que es evidencia legal y por eso sí está en RESTRICT.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('archivos', 'aprobado_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('archivos', 'aprobado_por_usuario_id', {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: { model: 'usuarios', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addColumn('archivos', 'retirado_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Índice parcial: esta consulta corre una vez por fila en cada carga de la vitrina pública, que
    // es la página más visitada del sitio. Parcial y no completo porque solo interesan los logos
    // vigentes — los CV y los logos retirados no tienen por qué ocupar espacio en este índice.
    await queryInterface.sequelize.query(`
      CREATE INDEX archivos_logo_vigente
        ON archivos (propietario_usuario_id)
        WHERE tipo = 'logo' AND aprobado_at IS NOT NULL AND retirado_at IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS archivos_logo_vigente');
    await queryInterface.removeColumn('archivos', 'retirado_at');
    await queryInterface.removeColumn('archivos', 'aprobado_por_usuario_id');
    await queryInterface.removeColumn('archivos', 'aprobado_at');
  },
};
