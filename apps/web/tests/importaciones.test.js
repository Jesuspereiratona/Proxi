import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Comprueba que todo `import { x } from './y.js'` de apps/web importe algo que ese archivo de
// verdad exporta.
//
// Existe por un fallo real: portada.js importaba `usuarioActual` desde `sesion.js`, y esa función
// vive en `cliente.js`. El navegador lanza un SyntaxError que mata el módulo ENTERO antes de
// ejecutar una línea, así que la portada cargaba sin cifras, sin ícono y sin el enlace de sesión —
// una página que se ve casi bien y no funciona. Ninguna prueba lo veía: las de apps/web corren en
// Node y los archivos de página tocan `document` al cargarse, así que no se pueden importar acá.
// Esta prueba no los ejecuta, los lee.

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/js');

const archivosJs = (directorio) => readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
  const completo = path.join(directorio, entrada.name);
  if (entrada.isDirectory()) return archivosJs(completo);
  return entrada.name.endsWith('.js') ? [completo] : [];
});

// `export const x`, `export function x`, `export class x`, y `export { a, b as c }`.
const exportacionesDe = (rutaArchivo) => {
  const texto = readFileSync(rutaArchivo, 'utf8');
  const nombres = new Set();
  for (const m of texto.matchAll(/^export\s+(?:const|let|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    nombres.add(m[1]);
  }
  for (const m of texto.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const parte of m[1].split(',')) {
      // `a as b` se importa como `b`.
      const trozos = parte.trim().split(/\s+as\s+/);
      if (trozos[0]) nombres.add((trozos[1] ?? trozos[0]).trim());
    }
  }
  return nombres;
};

const importacionesDe = (rutaArchivo) => {
  const texto = readFileSync(rutaArchivo, 'utf8');
  return [...texto.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/gm)].map((m) => ({
    nombres: m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean),
    destino: m[2],
  }));
};

describe('importaciones entre módulos de apps/web', () => {
  const archivos = archivosJs(RAIZ);

  test('hay módulos que revisar (si esto falla, la prueba dejó de mirar nada)', () => {
    assert.ok(archivos.length >= 10, `solo encontré ${archivos.length} archivos`);
  });

  for (const archivo of archivos) {
    const relativo = path.relative(RAIZ, archivo).replace(/\\/g, '/');
    const importaciones = importacionesDe(archivo);
    if (importaciones.length === 0) continue;

    test(`${relativo} importa solo cosas que existen`, () => {
      for (const { nombres, destino } of importaciones) {
        const rutaDestino = path.resolve(path.dirname(archivo), destino);
        assert.ok(existsSync(rutaDestino), `${relativo} importa de "${destino}", que no existe`);

        const disponibles = exportacionesDe(rutaDestino);
        for (const nombre of nombres) {
          assert.ok(
            disponibles.has(nombre),
            `${relativo} importa "${nombre}" de "${destino}", que no lo exporta. `
            + `Ahí hay: ${[...disponibles].join(', ') || '(nada)'}`,
          );
        }
      }
    });
  }
});
