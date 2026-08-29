'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ofertas', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      empresa_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'empresas', key: 'id' },
        onDelete: 'CASCADE',
      },
      titulo: { type: Sequelize.TEXT, allowNull: false },
      descripcion: { type: Sequelize.TEXT, allowNull: false },
      requisitos: { type: Sequelize.TEXT, allowNull: false },
      area: { type: Sequelize.TEXT, allowNull: false },
      modalidad: { type: Sequelize.TEXT, allowNull: false },
      comuna: { type: Sequelize.TEXT, allowNull: true },
      jornada: { type: Sequelize.TEXT, allowNull: false },
      remunerada: { type: Sequelize.BOOLEAN, allowNull: false },
      monto_mensual: { type: Sequelize.INTEGER, allowNull: true },
      cupos: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      fecha_publicacion: { type: Sequelize.DATE, allowNull: true },
      // NULL solo se permite en 'borrador' (ver CHECK ofertas_fecha_cierre_borrador_check más abajo):
      // el criterio de aceptación "borrador sin fecha_cierre, se valida al enviar a revisión" exige
      // que la columna admita NULL a nivel de tipo, pero la base sigue garantizando que ninguna
      // oferta publicada quede sin ella.
      fecha_cierre: { type: Sequelize.DATE, allowNull: true },
      estado: { type: Sequelize.TEXT, allowNull: false, defaultValue: 'borrador' },
      motivo_cierre: { type: Sequelize.TEXT, allowNull: true },
      resultado_declarado: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      cerrada_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // Las tres de docs/02-modelo-de-datos.md, verbatim.
    await queryInterface.sequelize.query(
      'ALTER TABLE ofertas ADD CONSTRAINT ofertas_fecha_cierre_check CHECK (fecha_cierre > fecha_publicacion)',
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE ofertas ADD CONSTRAINT ofertas_motivo_cierre_requerido_check CHECK (estado <> 'cerrada' OR motivo_cierre IS NOT NULL)",
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE ofertas ADD CONSTRAINT ofertas_monto_mensual_check CHECK (NOT remunerada OR monto_mensual IS NOT NULL)',
    );

    // Enums de valores permitidos, mismo patrón que usuarios.rol / empresas.estado_validacion.
    await queryInterface.addConstraint('ofertas', {
      fields: ['modalidad'],
      type: 'check',
      name: 'ofertas_modalidad_check',
      where: { modalidad: ['presencial', 'hibrida', 'remota'] },
    });
    await queryInterface.addConstraint('ofertas', {
      fields: ['jornada'],
      type: 'check',
      name: 'ofertas_jornada_check',
      where: { jornada: ['completa', 'parcial'] },
    });
    await queryInterface.addConstraint('ofertas', {
      fields: ['estado'],
      type: 'check',
      name: 'ofertas_estado_check',
      where: { estado: ['borrador', 'en_revision', 'publicada', 'cerrada', 'archivada'] },
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE ofertas ADD CONSTRAINT ofertas_motivo_cierre_valores_check CHECK (motivo_cierre IS NULL OR motivo_cierre IN ('contratado','cancelada','sin_candidatos','vencida'))",
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE ofertas ADD CONSTRAINT ofertas_comuna_requerida_check CHECK (modalidad = 'remota' OR comuna IS NOT NULL)",
    );
    await queryInterface.sequelize.query('ALTER TABLE ofertas ADD CONSTRAINT ofertas_cupos_check CHECK (cupos > 0)');
    // "No existe oferta publicada sin vigencia" (CLAUDE.md) a nivel de base: la única excusa para
    // fecha_cierre NULL es seguir en borrador.
    await queryInterface.sequelize.query(
      "ALTER TABLE ofertas ADD CONSTRAINT ofertas_fecha_cierre_borrador_check CHECK (estado = 'borrador' OR fecha_cierre IS NOT NULL)",
    );

    await queryInterface.addIndex('ofertas', ['estado', 'fecha_cierre']);
    await queryInterface.addIndex('ofertas', ['empresa_id']);
    await queryInterface.addIndex('ofertas', ['area']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ofertas');
  },
};
