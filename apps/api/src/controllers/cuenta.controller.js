const asyncHandler = require('../utils/async-handler');
const cuentaService = require('../services/cuenta/cuenta.service');

const obtenerDatos = asyncHandler(async (req, res) => {
  const datos = await cuentaService.obtenerDatos(req.usuario.id, req.ip);
  // Nunca en caché intermedia ni del navegador: lleva el RUT descifrado (auditoría de Fase 7).
  res.set('Cache-Control', 'no-store');
  res.json(datos);
});

const eliminar = asyncHandler(async (req, res) => {
  await cuentaService.confirmarClave(req.usuario.id, req.body.clave);
  await cuentaService.eliminarCuenta(req.usuario.id, req.ip);
  res.status(204).send();
});

module.exports = { obtenerDatos, eliminar };
