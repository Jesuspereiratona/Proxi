// Migración de una sola vez: sube a `archivos.contenido` los bytes de los CV que quedaron en disco
// antes de que el almacenamiento pasara a la base (bitácora 2026-09-20), y **borra el archivo de
// disco** en cuanto los bytes están guardados. Idempotente: correrlo de nuevo no hace nada.
// Uso: npm run migrar-cv -w apps/api
//
// No es una migración de Sequelize a propósito: `db:migrate` corre en el despliegue, donde el disco
// con los CV no existe. Esto se corre a mano, una vez, en la máquina que todavía tiene los archivos.
//
// Por qué borra: sin eso la máquina donde se corrió queda con una copia en claro de todos los CV
// para siempre, fuera de todo control de acceso y de `auditoria_accesos`. Cuando después esa persona
// ejerce su derecho de supresión, `eliminarCuenta` anula los bytes de la base y la copia en disco
// sobrevive — que es justo lo contrario de suprimir (auditoría de seguridad del 2026-09-20).
const path = require('path');
const fs = require('fs/promises');
const { sequelize, Archivo } = require('../src/models');
const env = require('../src/config/env');

// Falla en silencio a propósito: si el archivo ya no está, el objetivo (que no quede copia) está
// cumplido igual. Lo que no puede pasar es que un error acá deje los bytes sin migrar.
const borrarDeDisco = (nombreAlmacenado) => fs
  .unlink(path.join(env.uploadDir, nombreAlmacenado))
  .then(() => true)
  .catch(() => false);

const migrar = async () => {
  // Los expirados no entran: son CV ya suprimidos. Si quedó un archivo suyo en disco, se borra igual
  // más abajo, pero sus bytes NO vuelven a la base.
  const filas = await Archivo.findAll({ where: { tipo: 'cv' }, attributes: ['id', 'nombreAlmacenado', 'contenido', 'expiraAt'] });
  let migrados = 0;
  let borrados = 0;
  const sinArchivo = [];

  for (const archivo of filas) {
    const yaTieneBytes = Boolean(archivo.contenido);
    const suprimido = Boolean(archivo.expiraAt);

    if (!yaTieneBytes && !suprimido) {
      let bytes;
      try {
        bytes = await fs.readFile(path.join(env.uploadDir, archivo.nombreAlmacenado));
      } catch {
        // El archivo ya no está: la fila queda con contenido NULL y descargar() responde 404, lo
        // mismo que pasaba antes cuando fs.access fallaba. La fila NO se borra: puede estar
        // congelada en una postulación, y ese historial no se toca.
        sinArchivo.push(archivo.id);
        continue;
      }
      await archivo.update({ contenido: bytes, tamanoBytes: bytes.length });
      migrados += 1;
    }

    // Recién con los bytes ya guardados (o con la fila suprimida, que no los quiere de vuelta).
    if (await borrarDeDisco(archivo.nombreAlmacenado)) borrados += 1;
  }

  // rmdir y no rm -rf: solo borra el directorio si quedó vacío. Este script recorre FILAS de la
  // base, así que un archivo sin fila nunca se toca — borrar archivos no referenciados es cómo se
  // pierden datos. Se listan por nombre para que quien opere decida.
  const vacio = await fs.rmdir(env.uploadDir).then(() => true).catch(() => false);
  const huerfanos = vacio ? [] : await fs.readdir(env.uploadDir).catch(() => []);

  console.log(`CV migrados a la base: ${migrados}`);
  console.log(`Archivos borrados del disco: ${borrados}`);
  if (sinArchivo.length > 0) console.log(`Sin archivo en disco, quedan en 404: ${sinArchivo.join(', ')}`);
  if (vacio) {
    console.log(`Directorio ${env.uploadDir} eliminado: no queda ninguna copia en claro.`);
  } else {
    console.log(`
OJO: quedaron ${huerfanos.length} archivo(s) SIN fila en \`archivos\` en ${env.uploadDir}:`);
    huerfanos.forEach((nombre) => console.log(`   ${nombre}`));
    console.log('Este script no los borra: no sabe qué son. Revisarlos y eliminarlos a mano.');
  }
};

migrar()
  .catch((error) => {
    console.error('No se pudo migrar:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
