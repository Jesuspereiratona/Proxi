const { Router } = require('express');
const controller = require('../controllers/archivos.controller');
const autenticar = require('../middlewares/autenticar.middleware');
const validarParams = require('../middlewares/validar-params.middleware');
const { idParamEsquema } = require('../schemas/comun.schemas');

const router = Router();

// El permiso no depende del rol solo (a diferencia de la mayoría de las rutas): lo resuelve
// archivos.service.js según quién es el dueño, si hay una postulación real de por medio, o si
// quien pide es coordinación.
router.get('/:id/descarga', autenticar, validarParams(idParamEsquema), controller.descargar);

module.exports = router;
