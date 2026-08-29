const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { puedeTransicionar } = require('../../src/services/empresas/estados');

describe('transiciones de empresa', () => {
  test('coordinación puede validar una empresa pendiente', () => {
    assert.equal(puedeTransicionar('pendiente', 'validada', 'coordinacion'), true);
  });

  test('coordinación puede rechazar una empresa pendiente', () => {
    assert.equal(puedeTransicionar('pendiente', 'rechazada', 'coordinacion'), true);
  });

  test('la empresa puede volver de rechazada a pendiente', () => {
    assert.equal(puedeTransicionar('rechazada', 'pendiente', 'empresa'), true);
  });

  test('una empresa no se puede validar a sí misma', () => {
    assert.equal(puedeTransicionar('pendiente', 'validada', 'empresa'), false);
  });

  test('una empresa validada no puede rechazarse directamente', () => {
    assert.equal(puedeTransicionar('validada', 'rechazada', 'coordinacion'), false);
  });

  test('la empresa puede volver de validada a pendiente (al cambiar identidad, automático)', () => {
    assert.equal(puedeTransicionar('validada', 'pendiente', 'empresa'), true);
  });

  test('coordinación no puede volver una validada a pendiente directamente (eso es automático al editar identidad)', () => {
    assert.equal(puedeTransicionar('validada', 'pendiente', 'coordinacion'), false);
  });

  test('coordinación puede suspender una empresa validada', () => {
    assert.equal(puedeTransicionar('validada', 'suspendida', 'coordinacion'), true);
  });

  test('una empresa suspendida no tiene transiciones salientes todavía', () => {
    assert.equal(puedeTransicionar('suspendida', 'pendiente', 'coordinacion'), false);
  });

  test('coordinación no puede volver una rechazada a pendiente (eso es automático al editar)', () => {
    assert.equal(puedeTransicionar('rechazada', 'pendiente', 'coordinacion'), false);
  });
});
