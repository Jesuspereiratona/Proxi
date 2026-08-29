const { Router } = require('express');
const saludRoutes = require('./salud.routes');
const authRoutes = require('./auth.routes');
const estudiantesRoutes = require('./estudiantes.routes');
const empresasRoutes = require('./empresas.routes');

const router = Router();

router.use('/salud', saludRoutes);
router.use('/auth', authRoutes);
router.use('/estudiantes', estudiantesRoutes);
router.use('/empresas', empresasRoutes);

module.exports = router;
