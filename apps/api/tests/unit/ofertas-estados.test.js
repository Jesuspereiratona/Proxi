const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { TRANSICIONES, puedeTransicionar } = require('../../src/services/ofertas/estados');

const TODOS_LOS_ESTADOS = Object.keys(TRANSICIONES);
const TODOS_LOS_ACTORES = ['empresa', 'coordinacion', 'sistema'];

describe('matriz completa de transiciones de oferta', () => {
  for (const desde of TODOS_LOS_ESTADOS) {
    for (const hacia of TODOS_LOS_ESTADOS) {
      for (const actor of TODOS_LOS_ACTORES) {
        const esperado = Boolean(TRANSICIONES[desde]?.[hacia]?.includes(actor));
        test(`${desde} -> ${hacia} por ${actor} es ${esperado}`, () => {
          assert.equal(puedeTransicionar(desde, hacia, actor), esperado);
        });
      }
    }
  }
});

describe('casos concretos', () => {
  test('la empresa envía un borrador a revisión', () => {
    assert.equal(puedeTransicionar('borrador', 'en_revision', 'empresa'), true);
  });

  test('coordinación aprueba y publica', () => {
    assert.equal(puedeTransicionar('en_revision', 'publicada', 'coordinacion'), true);
  });

  test('coordinación rechaza de vuelta a borrador', () => {
    assert.equal(puedeTransicionar('en_revision', 'borrador', 'coordinacion'), true);
  });

  test('la empresa o el sistema cierran una oferta publicada', () => {
    assert.equal(puedeTransicionar('publicada', 'cerrada', 'empresa'), true);
    assert.equal(puedeTransicionar('publicada', 'cerrada', 'sistema'), true);
  });

  test('el sistema archiva una oferta cerrada', () => {
    assert.equal(puedeTransicionar('cerrada', 'archivada', 'sistema'), true);
  });

  test('una empresa no puede aprobar su propia oferta', () => {
    assert.equal(puedeTransicionar('en_revision', 'publicada', 'empresa'), false);
  });

  test('una oferta cerrada no puede volver a publicarse', () => {
    assert.equal(puedeTransicionar('cerrada', 'publicada', 'empresa'), false);
    assert.equal(puedeTransicionar('cerrada', 'publicada', 'coordinacion'), false);
  });

  test('una oferta archivada no tiene transiciones salientes', () => {
    assert.equal(puedeTransicionar('archivada', 'cerrada', 'sistema'), false);
  });

  test('la empresa puede devolver a borrador una oferta en revisión o publicada (edición de contenido)', () => {
    assert.equal(puedeTransicionar('en_revision', 'borrador', 'empresa'), true);
    assert.equal(puedeTransicionar('publicada', 'borrador', 'empresa'), true);
  });

  test('el sistema puede devolver a borrador una oferta en revisión (cascada de suspensión)', () => {
    assert.equal(puedeTransicionar('en_revision', 'borrador', 'sistema'), true);
  });

  test('el sistema no puede devolver a borrador una oferta ya publicada', () => {
    assert.equal(puedeTransicionar('publicada', 'borrador', 'sistema'), false);
  });
});
