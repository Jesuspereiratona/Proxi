'use strict';

// Registro de a quién se le notificó una brecha y cuándo (specs/13-notificacion-de-brecha/spec.md).
//
// Existe por dos motivos que no se pueden cubrir con un log:
// 1. Es la prueba. La Agencia puede preguntar a quién se notificó; "mandamos los correos" no lo es.
// 2. Hace el envío reanudable. Una notificación a 300 personas se puede cortar en la 150, y bajo el
//    reloj de 72 horas volver a empezar significa escribirle dos veces a media lista.
//
// usuario_id en RESTRICT, igual que auditoria_accesos y por la misma razón: es evidencia legal. Si
// alguien intenta borrar un usuario que tiene una notificación de brecha, la base se niega. En
// producción nadie borra usuarios (eliminarCuenta anonimiza), así que esto no estorba a nadie.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notificaciones_brecha', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      // Identificador del incidente, el mismo que nombra su informe en docs/incidentes/.
      // Texto y no una FK: el incidente vive en un documento, no en una tabla.
      incidente: { type: Sequelize.TEXT, allowNull: false },
      usuario_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'usuarios', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      // Nulo mientras el envío falla: la fila se escribe igual para no reintentar a ciegas, y el
      // error queda a la vista para decidir si se reintenta o se avisa por otra vía.
      enviado_at: { type: Sequelize.DATE, allowNull: true },
      error: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    // La restricción que hace el reintento seguro: una persona aparece una sola vez por incidente.
    // Sin esto, la reanudación dependería de que el script consulte antes de insertar, y dos
    // corridas en paralelo —alguien nervioso abriendo dos terminales— duplicarían los avisos.
    await queryInterface.addConstraint('notificaciones_brecha', {
      fields: ['incidente', 'usuario_id'],
      type: 'unique',
      name: 'notificaciones_brecha_incidente_usuario_unico',
    });
  },

  async down(queryInterface) {
    // La restricción se va con la tabla; borrarla aparte fallaría si la tabla ya no está.
    await queryInterface.dropTable('notificaciones_brecha');
  },
};
