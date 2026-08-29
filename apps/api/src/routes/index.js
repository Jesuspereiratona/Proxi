const { Router } = require('express');
const saludRoutes = require('./salud.routes');
const authRoutes = require('./auth.routes');

const router = Router();

router.use('/salud', saludRoutes);
router.use('/auth', authRoutes);

module.exports = router;
