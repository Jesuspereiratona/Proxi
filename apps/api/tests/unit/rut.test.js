const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarRut, esRutValido } = require('../../src/utils/rut');

describe('normalizarRut', () => {
  test('quita puntos, guion y espacios, y pasa a mayúscula', () => {
    assert.equal(normalizarRut('11.111.111-1'), '111111111');
    assert.equal(normalizarRut('1000005-k'), '1000005K');
  });
});

describe('esRutValido', () => {
  test('acepta un RUT inventado con dígito verificador correcto', () => {
    assert.equal(esRutValido('11.111.111-1'), true);
  });

  test('rechaza el mismo cuerpo con el dígito verificador equivocado', () => {
    assert.equal(esRutValido('11.111.111-2'), false);
  });

  test('acepta un dígito verificador K', () => {
    assert.equal(esRutValido('1000005-K'), true);
  });

  test('rechaza un cuerpo demasiado corto', () => {
    assert.equal(esRutValido('1-9'), false);
  });

  test('rechaza texto que no es un RUT', () => {
    assert.equal(esRutValido('no-es-un-rut'), false);
  });
});
