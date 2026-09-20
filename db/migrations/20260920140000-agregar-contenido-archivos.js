'use strict';

// Los bytes de un archivo pasan a vivir en la base, no en el disco del servidor.
//
// El motivo es de despliegue (specs/10-logo-de-empresa/plan.md, decisión 1): la plataforma donde va
// a correr Proxi borra el disco en cada reinicio, así que un archivo guardado en `almacenamiento/`
// desaparecería en el primer despliegue. La alternativa —un servicio de almacenamiento externo—
// suma una empresa más que tiene nuestros datos, con el contrato y el registro de tratamiento que
// eso implica, para guardar imágenes de 200 KB.
//
// Nullable a propósito: las filas de CV que ya existen tienen sus bytes en disco y esta migración
// NO los mueve. Mientras `contenido` sea nulo, el código sigue leyendo del disco. La migración de
// los CV es una tarea aparte y deliberada, no un efecto colateral de esta.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('archivos', 'contenido', {
      type: Sequelize.BLOB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('archivos', 'contenido');
  },
};
