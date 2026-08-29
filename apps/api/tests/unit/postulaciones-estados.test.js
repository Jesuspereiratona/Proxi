const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { TRANSICIONES, puedeTransicionar } = require('../../src/services/postulaciones/estados');

const TODOS_LOS_ESTADOS = Object.keys(TRANSICIONES);
const TODOS_LOS_ACTORES = ['empresa', 'estudiante', 'sistema'];

describe('matriz completa de transiciones de postulación', () => {
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
  test('la empresa avanza el proceso completo: recibida -> en_revision -> entrevista -> seleccionada', () => {
    assert.equal(puedeTransicionar('recibida', 'en_revision', 'empresa'), true);
    assert.equal(puedeTransicionar('en_revision', 'entrevista', 'empresa'), true);
    assert.equal(puedeTransicionar('entrevista', 'seleccionada', 'empresa'), true);
  });

  test('la empresa puede rechazar desde cualquiera de los tres estados no terminales', () => {
    assert.equal(puedeTransicionar('recibida', 'no_seleccionada', 'empresa'), true);
    assert.equal(puedeTransicionar('en_revision', 'no_seleccionada', 'empresa'), true);
    assert.equal(puedeTransicionar('entrevista', 'no_seleccionada', 'empresa'), true);
  });

  test('la empresa no puede saltarse un paso', () => {
    assert.equal(puedeTransicionar('recibida', 'entrevista', 'empresa'), false);
    assert.equal(puedeTransicionar('recibida', 'seleccionada', 'empresa'), false);
    assert.equal(puedeTransicionar('en_revision', 'seleccionada', 'empresa'), false);
  });

  test('el estudiante puede retirarse desde cualquier estado no terminal', () => {
    assert.equal(puedeTransicionar('recibida', 'retirada', 'estudiante'), true);
    assert.equal(puedeTransicionar('en_revision', 'retirada', 'estudiante'), true);
    assert.equal(puedeTransicionar('entrevista', 'retirada', 'estudiante'), true);
  });

  test('el estudiante no puede mover el proceso de selección', () => {
    assert.equal(puedeTransicionar('recibida', 'en_revision', 'estudiante'), false);
    assert.equal(puedeTransicionar('entrevista', 'seleccionada', 'estudiante'), false);
  });

  test('el sistema puede marcar sin_respuesta desde cualquier estado no terminal', () => {
    assert.equal(puedeTransicionar('recibida', 'sin_respuesta', 'sistema'), true);
    assert.equal(puedeTransicionar('en_revision', 'sin_respuesta', 'sistema'), true);
    assert.equal(puedeTransicionar('entrevista', 'sin_respuesta', 'sistema'), true);
  });

  test('ningún estado terminal tiene transiciones salientes', () => {
    for (const terminal of ['seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada']) {
      for (const actor of TODOS_LOS_ACTORES) {
        assert.equal(puedeTransicionar(terminal, 'recibida', actor), false);
      }
    }
  });
});
