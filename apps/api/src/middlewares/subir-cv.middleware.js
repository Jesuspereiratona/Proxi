const multer = require('multer');
const env = require('../config/env');

// En memoria, no en disco: archivos.service.js valida el contenido real (número mágico %PDF-)
// antes de escribir nada (docs/03-seguridad.md). Los errores de multer (tamaño excedido, campo
// inesperado) los traduce manejador-errores.middleware.js, no un catch acá.
//
// El formulario solo manda un archivo, sin campos de texto: sin `fields`/`parts`/`fieldSize`
// acotados, busboy los deja en Infinity por defecto y multer acumula cada campo de texto en
// memoria, así que una petición autenticada con miles de campos podía agotar la memoria del
// proceso antes de llegar siquiera al límite de tamaño del archivo (auditoría de Fase 4).
const subirCv = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploadMaxBytes,
    // files + fields ya acotan "a lo sumo un archivo, cero campos de texto" (parts, la suma de
    // ambos, quedó fuera: busboy la cuenta con un margen que rechazaba incluso una subida válida).
    files: 1,
    fields: 0,
    fieldNameSize: 64,
    fieldSize: 1024,
    fieldNestingDepth: 1,
    fieldArrayIndexLimit: 0,
  },
}).single('cv');

module.exports = subirCv;
