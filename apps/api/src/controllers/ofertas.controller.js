const asyncHandler = require('../utils/async-handler');
const ofertasService = require('../services/ofertas/ofertas.service');

const listarPublicas = asyncHandler(async (req, res) => {
  const resultado = await ofertasService.listarPublicas(req.filtros);
  res.json(resultado);
});

const obtenerDetalle = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.obtenerDetalle(req.params.id, req.usuario);
  res.json(oferta);
});

const crear = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.crear(req.usuario.id, req.body);
  res.status(201).json(oferta);
});

const editar = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.editar(req.usuario.id, req.params.id, req.body);
  res.json(oferta);
});

const listarMias = asyncHandler(async (req, res) => {
  const ofertas = await ofertasService.listarDeEmpresa(req.usuario.id);
  res.json(ofertas);
});

const listarPendientesRevision = asyncHandler(async (req, res) => {
  const ofertas = await ofertasService.listarPendientesRevision();
  res.json(ofertas);
});

const enviarARevision = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.enviarARevision(req.usuario.id, req.params.id);
  res.json(oferta);
});

const aprobar = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.aprobar(req.params.id, req.usuario.id);
  res.json(oferta);
});

const rechazar = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.rechazar(req.params.id, req.usuario.id, req.body.motivo);
  res.json(oferta);
});

const cerrar = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.cerrar(req.usuario.id, req.params.id, req.body.motivoCierre);
  res.json(oferta);
});

module.exports = {
  listarPublicas,
  obtenerDetalle,
  crear,
  editar,
  listarMias,
  listarPendientesRevision,
  enviarARevision,
  aprobar,
  rechazar,
  cerrar,
};
