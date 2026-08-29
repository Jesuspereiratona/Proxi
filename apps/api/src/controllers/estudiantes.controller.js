const asyncHandler = require('../utils/async-handler');
const estudiantesService = require('../services/estudiantes/estudiantes.service');

const crearPerfil = asyncHandler(async (req, res) => {
  const perfil = await estudiantesService.crearPerfil(req.usuario.id, req.body);
  res.status(201).json(perfil);
});

const obtenerPropio = asyncHandler(async (req, res) => {
  const perfil = await estudiantesService.obtenerPropio(req.usuario.id);
  res.json(perfil);
});

const actualizarPropio = asyncHandler(async (req, res) => {
  const perfil = await estudiantesService.actualizarPropio(req.usuario.id, req.body);
  res.json(perfil);
});

const obtenerRut = asyncHandler(async (req, res) => {
  const rut = await estudiantesService.obtenerRutDescifrado(req.params.id);
  // Auditoría de acceso: quién descifró el RUT de quién y cuándo. Nunca el RUT en el log
  // (docs/03-seguridad.md). Sustituye a auditoria_accesos hasta que esa tabla llegue en Fase 4.
  req.log.info({ coordinadorId: req.usuario.id, estudianteId: req.params.id }, 'lectura de RUT descifrado');
  res.json({ rut });
});

module.exports = { crearPerfil, obtenerPropio, actualizarPropio, obtenerRut };
