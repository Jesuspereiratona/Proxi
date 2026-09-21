const { Router } = require('express');
const autenticar = require('../middlewares/autenticar.middleware');
const autorizar = require('../middlewares/autorizar.middleware');
const controller = require('../controllers/panorama.controller');

const router = Router();

// Solo coordinación: es una vista de gestión de la facultad, no información pública. Los conteos
// por área o el embudo de postulaciones dirían a una empresa cuánta competencia tiene, y a nadie
// más le corresponde.
router.get('/', autenticar, autorizar('coordinacion'), controller.obtener);

module.exports = router;
