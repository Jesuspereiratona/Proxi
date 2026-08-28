const { Router } = require('express');
const saludRoutes = require('./salud.routes');

const router = Router();

router.use('/salud', saludRoutes);

module.exports = router;
