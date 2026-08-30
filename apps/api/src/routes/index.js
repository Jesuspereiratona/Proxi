const { Router } = require('express');
const saludRoutes = require('./salud.routes');
const authRoutes = require('./auth.routes');
const estudiantesRoutes = require('./estudiantes.routes');
const empresasRoutes = require('./empresas.routes');
const ofertasRoutes = require('./ofertas.routes');
const postulacionesRoutes = require('./postulaciones.routes');
const archivosRoutes = require('./archivos.routes');
const cuentaRoutes = require('./cuenta.routes');

const router = Router();

router.use('/salud', saludRoutes);
router.use('/auth', authRoutes);
router.use('/estudiantes', estudiantesRoutes);
router.use('/empresas', empresasRoutes);
router.use('/ofertas', ofertasRoutes);
router.use('/postulaciones', postulacionesRoutes);
router.use('/archivos', archivosRoutes);
router.use('/mi-cuenta', cuentaRoutes);

module.exports = router;
