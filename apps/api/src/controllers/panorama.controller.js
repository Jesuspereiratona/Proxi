const asyncHandler = require('../utils/async-handler');
const panoramaService = require('../services/panorama/panorama.service');

const obtener = asyncHandler(async (req, res) => {
  res.json(await panoramaService.obtener());
});

module.exports = { obtener };
