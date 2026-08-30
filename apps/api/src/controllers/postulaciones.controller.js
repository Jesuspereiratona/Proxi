const asyncHandler = require('../utils/async-handler');
const postulacionesService = require('../services/postulaciones/postulaciones.service');

const postular = asyncHandler(async (req, res) => {
  const postulacion = await postulacionesService.postular(req.usuario.id, req.body);
  res.status(201).json(postulacion);
});

const listarMias = asyncHandler(async (req, res) => {
  const postulaciones = await postulacionesService.listarDeEstudiante(req.usuario.id);
  res.json(postulaciones);
});

const listarDeOferta = asyncHandler(async (req, res) => {
  const postulaciones = await postulacionesService.listarDeOferta(req.usuario.id, req.params.id, req.ip, req.get('user-agent'));
  res.json(postulaciones);
});

const obtenerDetalle = asyncHandler(async (req, res) => {
  const postulacion = await postulacionesService.obtenerDetalle(req.usuario, req.params.id);
  res.json(postulacion);
});

const marcarEnRevision = asyncHandler(async (req, res) => {
  const postulacion = await postulacionesService.marcarEnRevision(req.usuario.id, req.params.id);
  res.json(postulacion);
});

const marcarEntrevista = asyncHandler(async (req, res) => {
  const postulacion = await postulacionesService.marcarEntrevista(req.usuario.id, req.params.id);
  res.json(postulacion);
});

const seleccionar = asyncHandler(async (req, res) => {
  const postulacion = await postulacionesService.seleccionar(req.usuario.id, req.params.id);
  res.json(postulacion);
});

const rechazar = asyncHandler(async (req, res) => {
  const postulacion = await postulacionesService.rechazar(req.usuario.id, req.params.id, req.body.motivo);
  res.json(postulacion);
});

const retirar = asyncHandler(async (req, res) => {
  const postulacion = await postulacionesService.retirar(req.usuario.id, req.params.id, req.body.motivo);
  res.json(postulacion);
});

module.exports = {
  postular,
  listarMias,
  listarDeOferta,
  obtenerDetalle,
  marcarEnRevision,
  marcarEntrevista,
  seleccionar,
  rechazar,
  retirar,
};
