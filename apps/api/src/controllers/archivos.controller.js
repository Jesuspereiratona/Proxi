const asyncHandler = require('../utils/async-handler');
const archivosService = require('../services/archivos/archivos.service');

const descargar = asyncHandler(async (req, res) => {
  const { ruta, nombreOriginal } = await archivosService.descargar(req.params.id, req.usuario, req.ip, req.get('user-agent'));
  res.download(ruta, nombreOriginal);
});

module.exports = { descargar };
