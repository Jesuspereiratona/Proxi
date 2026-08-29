const { Router } = require('express');
const controller = require('../controllers/postulaciones.controller');
const validar = require('../middlewares/validar.middleware');
const validarParams = require('../middlewares/validar-params.middleware');
const autenticar = require('../middlewares/autenticar.middleware');
const autorizar = require('../middlewares/autorizar.middleware');
const esquemas = require('../schemas/postulaciones.schemas');
const { idParamEsquema } = require('../schemas/comun.schemas');

const router = Router();

// Rutas literales antes que "/:id", mismo motivo que ofertas.routes.js: si no, Express
// interpretaría "mias" como el valor de :id.
router.post('/', autenticar, autorizar('estudiante'), validar(esquemas.crearEsquema), controller.postular);
router.get('/mias', autenticar, autorizar('estudiante'), controller.listarMias);
router.get('/oferta/:id', autenticar, autorizar('empresa'), validarParams(idParamEsquema), controller.listarDeOferta);

router.get('/:id', autenticar, validarParams(idParamEsquema), controller.obtenerDetalle);
router.post('/:id/revision', autenticar, autorizar('empresa'), validarParams(idParamEsquema), controller.marcarEnRevision);
router.post('/:id/entrevista', autenticar, autorizar('empresa'), validarParams(idParamEsquema), controller.marcarEntrevista);
router.post('/:id/seleccion', autenticar, autorizar('empresa'), validarParams(idParamEsquema), controller.seleccionar);
router.post(
  '/:id/rechazo',
  autenticar,
  autorizar('empresa'),
  validarParams(idParamEsquema),
  validar(esquemas.motivoOpcionalEsquema),
  controller.rechazar,
);
router.post(
  '/:id/retiro',
  autenticar,
  autorizar('estudiante'),
  validarParams(idParamEsquema),
  validar(esquemas.motivoOpcionalEsquema),
  controller.retirar,
);

module.exports = router;
