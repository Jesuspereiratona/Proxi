const asyncHandler = require('../utils/async-handler');
const archivosService = require('../services/archivos/archivos.service');

const descargar = asyncHandler(async (req, res) => {
  const { contenido, nombreOriginal, mime } = await archivosService.descargar(req.params.id, req.usuario, req.ip, req.get('user-agent'));
  // res.attachment pone Content-Disposition: attachment con el nombre saneado (archivos.service.js
  // ya le forzó la extensión .pdf) y deduce el Content-Type de esa extensión; el setHeader de abajo
  // lo fija igual desde el mime guardado, que es el que se validó por número mágico al subir.
  res.attachment(nombreOriginal);
  res.setHeader('Content-Type', mime);
  // Un CV es el dato más sensible del proyecto: no se guarda en ninguna caché intermedia ni en el
  // disco del navegador de quien lo descarga más allá de esa descarga.
  res.setHeader('Cache-Control', 'no-store');
  res.send(contenido);
});

module.exports = { descargar };
