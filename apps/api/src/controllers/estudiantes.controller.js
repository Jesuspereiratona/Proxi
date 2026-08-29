const asyncHandler = require('../utils/async-handler');
const estudiantesService = require('../services/estudiantes/estudiantes.service');
const archivosService = require('../services/archivos/archivos.service');
const { AuditoriaAcceso } = require('../models');

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
  // Auditoría de acceso real, ya con la tabla que trajo la Fase 4 (antes solo quedaba en el log).
  await AuditoriaAcceso.create({
    usuarioId: req.usuario.id,
    accion: 'ver_rut',
    entidad: 'estudiante',
    entidadId: req.params.id,
    ip: req.ip,
  });
  res.json({ rut });
});

const subirCv = asyncHandler(async (req, res) => {
  const archivo = await archivosService.subirCv(req.usuario.id, req.file);
  res.status(201).json(archivo);
});

module.exports = { crearPerfil, obtenerPropio, actualizarPropio, obtenerRut, subirCv };
