const { Router } = require('express');
const controller = require('../controllers/auth.controller');
const validar = require('../middlewares/validar.middleware');
const crearLimitarTasaAuth = require('../middlewares/limitar-tasa-auth.middleware');
const esquemas = require('../schemas/auth.schemas');

const router = Router();

router.post('/registro', validar(esquemas.registroEsquema), controller.registro);
router.post('/verificar-correo', validar(esquemas.verificarCorreoEsquema), controller.verificarCorreo);
router.post('/login', crearLimitarTasaAuth(), validar(esquemas.loginEsquema), controller.login);
router.post('/refrescar', controller.refrescar);
router.post('/logout', controller.logout);
router.post(
  '/recuperar-clave',
  crearLimitarTasaAuth(),
  validar(esquemas.recuperarClaveEsquema),
  controller.recuperarClave,
);
router.post('/restablecer-clave', validar(esquemas.restablecerClaveEsquema), controller.restablecerClave);

module.exports = router;
