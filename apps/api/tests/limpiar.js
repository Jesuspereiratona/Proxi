const { Op } = require('sequelize');
const { Usuario, AuditoriaAcceso } = require('../src/models');

// `auditoria_accesos` tiene la FK a usuarios en RESTRICT (migración 20260830191000): la base se
// niega a borrar un usuario que dejó rastro de auditoría, a propósito — esa fila es evidencia.
// En producción nadie borra usuarios (eliminarCuenta anonimiza), pero las pruebas sí necesitan
// dejar la base limpia, así que borran el rastro primero y el usuario después.
const borrarUsuariosDePrueba = async (dominio) => {
  const usuarios = await Usuario.findAll({ where: { email: { [Op.like]: `%@${dominio}` } }, attributes: ['id'] });
  if (usuarios.length === 0) return;
  const ids = usuarios.map((u) => u.id);
  await AuditoriaAcceso.destroy({ where: { usuarioId: ids } });
  await Usuario.destroy({ where: { id: ids } });
};

module.exports = { borrarUsuariosDePrueba };
