const asyncHandler = require('../utils/async-handler');
const panoramaService = require('../services/panorama/panorama.service');
const publicosService = require('../services/panorama/publicos.service');

const obtener = asyncHandler(async (req, res) => {
  res.json(await panoramaService.obtener());
});

// Las tres cifras de la portada. Públicas y sin sesión a propósito: son la promesa de Proxi puesta
// a la vista, y una promesa que no se puede comprobar no sirve de nada.
const obtenerPublicos = asyncHandler(async (req, res) => {
  res.json(await publicosService.obtener());
});

module.exports = { obtener, obtenerPublicos };
