const { Router } = require('express');
const controller = require('../controllers/cuenta.controller');
const validar = require('../middlewares/validar.middleware');
const autenticar = require('../middlewares/autenticar.middleware');
const autorizar = require('../middlewares/autorizar.middleware');
const { eliminarCuentaEsquema } = require('../schemas/cuenta.schemas');

const router = Router();

// Siempre sobre req.usuario.id, nunca un :id de la URL (docs/03-seguridad.md): no hay pertenencia
// que verificar porque la ruta no puede pedir los datos de nadie más.
router.get('/datos', autenticar, autorizar('estudiante'), controller.obtenerDatos);
router.delete('/', autenticar, autorizar('estudiante'), validar(eliminarCuentaEsquema), controller.eliminar);

module.exports = router;
