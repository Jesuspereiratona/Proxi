const asyncHandler = require('../utils/async-handler');
const saludService = require('../services/salud.service');

const obtenerSalud = asyncHandler(async (req, res) => {
  const salud = await saludService.verificarSalud();
  res.status(salud.baseDeDatos.ok ? 200 : 503).json(salud);
});

module.exports = { obtenerSalud };
