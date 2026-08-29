const asyncHandler = require('../utils/async-handler');
const empresasService = require('../services/empresas/empresas.service');
const indicadoresService = require('../services/empresas/indicadores.service');

const crearPerfil = asyncHandler(async (req, res) => {
  const perfil = await empresasService.crearPerfil(req.usuario.id, req.body);
  res.status(201).json(perfil);
});

const obtenerPropio = asyncHandler(async (req, res) => {
  const perfil = await empresasService.obtenerPropio(req.usuario.id);
  res.json(perfil);
});

const actualizarPropio = asyncHandler(async (req, res) => {
  const perfil = await empresasService.actualizarPropio(req.usuario.id, req.body);
  res.json(perfil);
});

const listarPendientes = asyncHandler(async (req, res) => {
  const pendientes = await empresasService.listarPendientes();
  res.json(pendientes);
});

const validar = asyncHandler(async (req, res) => {
  const empresa = await empresasService.validar(req.params.id, req.usuario.id);
  res.json(empresa);
});

const rechazar = asyncHandler(async (req, res) => {
  const empresa = await empresasService.rechazar(req.params.id, req.body.motivoRechazo);
  res.json(empresa);
});

const suspender = asyncHandler(async (req, res) => {
  const empresa = await empresasService.suspender(req.params.id, req.body.motivoSuspension);
  res.json(empresa);
});

const obtenerIndicadores = asyncHandler(async (req, res) => {
  const indicadores = await indicadoresService.obtenerPublico(req.params.id);
  res.json(indicadores);
});

const listarIndicadores = asyncHandler(async (req, res) => {
  const indicadores = await indicadoresService.listarTodos();
  res.json(indicadores);
});

module.exports = {
  crearPerfil,
  obtenerPropio,
  actualizarPropio,
  listarPendientes,
  validar,
  rechazar,
  suspender,
  obtenerIndicadores,
  listarIndicadores,
};
