const { Router } = require('express');
const autenticarTareas = require('../middlewares/autenticar-tareas.middleware');
const controller = require('../controllers/tareas.controller');

const router = Router();

// POST y no GET: dispara escrituras (cierra ofertas, marca sin respuesta, elimina cuentas vencidas).
// Un GET lo podría disparar un prefetch del navegador o un crawler que encuentre la URL en un log.
router.post('/ejecucion', autenticarTareas, controller.ejecutar);

module.exports = router;
