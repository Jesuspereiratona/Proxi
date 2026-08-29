const { Router } = require('express');
const controller = require('../controllers/ofertas.controller');
const validar = require('../middlewares/validar.middleware');
const validarQuery = require('../middlewares/validar-query.middleware');
const validarParams = require('../middlewares/validar-params.middleware');
const autenticar = require('../middlewares/autenticar.middleware');
const autenticarOpcional = require('../middlewares/autenticar-opcional.middleware');
const autorizar = require('../middlewares/autorizar.middleware');
const esquemas = require('../schemas/ofertas.schemas');
const { idParamEsquema } = require('../schemas/comun.schemas');

const router = Router();

// Rutas literales antes que "/:id": si no, Express interpretaría "mias" o
// "pendientes-revision" como el valor de :id.
router.get('/mias', autenticar, autorizar('empresa'), controller.listarMias);
router.get('/pendientes-revision', autenticar, autorizar('coordinacion'), controller.listarPendientesRevision);

router.get('/', validarQuery(esquemas.filtrosListadoEsquema), controller.listarPublicas);
router.post('/', autenticar, autorizar('empresa'), validar(esquemas.crearEsquema), controller.crear);

router.get('/:id', validarParams(idParamEsquema), autenticarOpcional, controller.obtenerDetalle);
router.patch(
  '/:id',
  autenticar,
  autorizar('empresa'),
  validarParams(idParamEsquema),
  validar(esquemas.editarEsquema),
  controller.editar,
);

router.post('/:id/revision', autenticar, autorizar('empresa'), validarParams(idParamEsquema), controller.enviarARevision);
router.post('/:id/aprobacion', autenticar, autorizar('coordinacion'), validarParams(idParamEsquema), controller.aprobar);
router.post(
  '/:id/rechazo',
  autenticar,
  autorizar('coordinacion'),
  validarParams(idParamEsquema),
  validar(esquemas.rechazoEsquema),
  controller.rechazar,
);
router.post(
  '/:id/cierre',
  autenticar,
  autorizar('empresa'),
  validarParams(idParamEsquema),
  validar(esquemas.cierreEsquema),
  controller.cerrar,
);

module.exports = router;
