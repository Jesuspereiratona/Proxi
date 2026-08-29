const { Router } = require('express');
const controller = require('../controllers/estudiantes.controller');
const validar = require('../middlewares/validar.middleware');
const validarParams = require('../middlewares/validar-params.middleware');
const autenticar = require('../middlewares/autenticar.middleware');
const autorizar = require('../middlewares/autorizar.middleware');
const limitarTasaRut = require('../middlewares/limitar-tasa-rut.middleware');
const esquemas = require('../schemas/estudiantes.schemas');
const { idParamEsquema } = require('../schemas/comun.schemas');

const router = Router();

router.post('/perfil', autenticar, autorizar('estudiante'), validar(esquemas.crearPerfilEsquema), controller.crearPerfil);
router.get('/perfil', autenticar, autorizar('estudiante'), controller.obtenerPropio);
router.patch(
  '/perfil',
  autenticar,
  autorizar('estudiante'),
  validar(esquemas.actualizarPerfilEsquema),
  controller.actualizarPropio,
);
router.get(
  '/:id/rut',
  autenticar,
  autorizar('coordinacion'),
  validarParams(idParamEsquema),
  limitarTasaRut,
  controller.obtenerRut,
);

module.exports = router;
