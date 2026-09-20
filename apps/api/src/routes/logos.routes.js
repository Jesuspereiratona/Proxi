const { Router } = require('express');
const controller = require('../controllers/logos.controller');
const validarParams = require('../middlewares/validar-params.middleware');
const autenticar = require('../middlewares/autenticar.middleware');
const autorizar = require('../middlewares/autorizar.middleware');
const { idParamEsquema } = require('../schemas/comun.schemas');

const router = Router();

// Solo coordinación. Los bytes de un logo pendiente no son públicos: todavía no los revisó nadie, y
// servirlos sin sesión sería una forma de publicarlo antes de tiempo.
router.get('/pendientes', autenticar, autorizar('coordinacion'), controller.listarPendientes);
router.get(
  '/:id/imagen',
  autenticar,
  autorizar('coordinacion'),
  validarParams(idParamEsquema),
  controller.obtenerParaRevision,
);
router.post(
  '/:id/aprobacion',
  autenticar,
  autorizar('coordinacion'),
  validarParams(idParamEsquema),
  controller.aprobar,
);
router.delete('/:id', autenticar, autorizar('coordinacion'), validarParams(idParamEsquema), controller.retirar);

module.exports = router;
