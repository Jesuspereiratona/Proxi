// Migración de una sola vez: sube a `archivos.contenido` los bytes de los CV que quedaron en disco
// antes de que el almacenamiento pasara a la base (bitácora 2026-09-20). Idempotente — solo mira las
// filas con contenido NULL, así que correrlo dos veces no hace nada la segunda.
// Uso: npm run migrar-cv -w apps/api
//
// No es una migración de Sequelize a propósito: `db:migrate` corre en el despliegue, donde el disco
// con los CV no existe. Esto se corre a mano, una vez, en la máquina que todavía tiene los archivos.
const path = require('path');
const fs = require('fs/promises');
const { sequelize, Archivo } = require('../src/models');
const env = require('../src/config/env');

const migrar = async () => {
  const pendientes = await Archivo.findAll({ where: { tipo: 'cv', contenido: null, expiraAt: null } });
  let migrados = 0;
  const sinArchivo = [];

  for (const archivo of pendientes) {
    let bytes;
    try {
      bytes = await fs.readFile(path.join(env.uploadDir, archivo.nombreAlmacenado));
    } catch {
      // El archivo ya no está: la fila queda con contenido NULL y descargar() responde 404, que es
      // lo mismo que pasaba antes cuando fs.access fallaba. Se informa, no se borra la fila: puede
      // estar congelada en una postulación y su historial tiene que conservarse.
      sinArchivo.push(archivo.id);
      continue;
    }
    await archivo.update({ contenido: bytes, tamanoBytes: bytes.length });
    migrados += 1;
  }

  console.log(`CV migrados a la base: ${migrados} de ${pendientes.length}`);
  if (sinArchivo.length > 0) console.log(`Sin archivo en disco, quedan en 404: ${sinArchivo.join(', ')}`);
};

migrar()
  .catch((error) => {
    console.error('No se pudo migrar:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
