const multer = require('multer');
const env = require('../config/env');
const logosService = require('../services/archivos/logos.service');

// En memoria, no en disco: el servicio valida el contenido real (número mágico) antes de guardar
// nada (docs/03-seguridad.md). Los errores de multer (tamaño excedido, campo inesperado) los
// traduce manejador-errores.middleware.js, no un catch acá.
//
// El formulario solo manda un archivo, sin campos de texto: sin `fields`/`parts`/`fieldSize`
// acotados, busboy los deja en Infinity por defecto y multer acumula cada campo de texto en
// memoria, así que una petición autenticada con miles de campos podía agotar la memoria del
// proceso antes de llegar siquiera al límite de tamaño del archivo (auditoría de Fase 4).
const crearSubida = ({ campo, maxBytes }) => multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxBytes,
    // files + fields ya acotan "a lo sumo un archivo, cero campos de texto" (parts, la suma de
    // ambos, quedó fuera: busboy la cuenta con un margen que rechazaba incluso una subida válida).
    files: 1,
    fields: 0,
    fieldNameSize: 64,
    fieldSize: 1024,
    fieldNestingDepth: 1,
    fieldArrayIndexLimit: 0,
  },
}).single(campo);

// Dos usos, con el mismo endurecimiento y distinto tope: un CV son 5 MB de PDF; un logo, 512 KB de
// imagen para una fila de listado. El tope de multer corta antes de leer el archivo entero a
// memoria; el del servicio vuelve a comprobarlo sobre el buffer ya armado, porque un límite de
// transporte y una regla de negocio no son lo mismo y no deben depender uno del otro.
const subirCv = crearSubida({ campo: 'cv', maxBytes: env.uploadMaxBytes });
const subirLogo = crearSubida({ campo: 'logo', maxBytes: logosService.TAMANO_MAXIMO_BYTES });

module.exports = { subirCv, subirLogo };
