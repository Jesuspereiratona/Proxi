'use strict';

const NOMBRE = 'auditoria_accesos_usuario_id_fkey';

// La FK a `usuarios` tenía ON DELETE CASCADE: un DELETE de un usuario se llevaba su rastro de
// auditoría completo — exactamente la evidencia que la Ley 21.719 exige poder mostrar y que
// docs/09-procedimiento-de-brecha.md usa como única fuente para medir el alcance de una brecha.
//
// Hoy es latente (eliminarCuenta anonimiza, nunca borra), pero eso es una promesa del código, no una
// garantía de la base: un DELETE manual en medio de un incidente, o una limpieza futura, destruye la
// prueba en silencio. Con RESTRICT la base obliga a pasar por eliminarCuenta, que es lo que se quiere.
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint('auditoria_accesos', NOMBRE);
    await queryInterface.addConstraint('auditoria_accesos', {
      fields: ['usuario_id'],
      type: 'foreign key',
      name: NOMBRE,
      references: { table: 'usuarios', field: 'id' },
      onDelete: 'RESTRICT',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('auditoria_accesos', NOMBRE);
    await queryInterface.addConstraint('auditoria_accesos', {
      fields: ['usuario_id'],
      type: 'foreign key',
      name: NOMBRE,
      references: { table: 'usuarios', field: 'id' },
      onDelete: 'CASCADE',
    });
  },
};
