const { Router } = require('express');
const controller = require('../controllers/empresas.controller');
const validar = require('../middlewares/validar.middleware');
const validarParams = require('../middlewares/validar-params.middleware');
const autenticar = require('../middlewares/autenticar.middleware');
const autorizar = require('../middlewares/autorizar.middleware');
const esquemas = require('../schemas/empresas.schemas');
const { idParamEsquema } = require('../schemas/comun.schemas');

const router = Router();

router.post('/perfil', autenticar, autorizar('empresa'), validar(esquemas.crearPerfilEsquema), controller.crearPerfil);
router.get('/perfil', autenticar, autorizar('empresa'), controller.obtenerPropio);
router.patch(
  '/perfil',
  autenticar,
  autorizar('empresa'),
  validar(esquemas.actualizarPerfilEsquema),
  controller.actualizarPropio,
);

router.get('/pendientes', autenticar, autorizar('coordinacion'), controller.listarPendientes);
router.post(
  '/:id/validacion',
  autenticar,
  autorizar('coordinacion'),
  validarParams(idParamEsquema),
  controller.validar,
);
router.post(
  '/:id/rechazo',
  autenticar,
  autorizar('coordinacion'),
  validarParams(idParamEsquema),
  validar(esquemas.rechazoEsquema),
  controller.rechazar,
);
router.post(
  '/:id/suspension',
  autenticar,
  autorizar('coordinacion'),
  validarParams(idParamEsquema),
  validar(esquemas.suspensionEsquema),
  controller.suspender,
);

module.exports = router;
