const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const intentosLogin = require('../../src/services/auth/intentosLogin');

describe('intentosLogin', () => {
  test('no bloquea con menos de 5 fallos', () => {
    const usuario = { intentosFallidos: 4, intentosFallidosDesde: new Date() };
    assert.equal(intentosLogin.estaBloqueado(usuario), false);
  });

  test('bloquea con 5 fallos dentro de la ventana de 15 minutos', () => {
    const ahora = Date.now();
    const usuario = { intentosFallidos: 5, intentosFallidosDesde: new Date(ahora - 60_000) };
    assert.equal(intentosLogin.estaBloqueado(usuario, ahora), true);
  });

  test('deja de bloquear pasados los 15 minutos', () => {
    const ahora = Date.now();
    const usuario = { intentosFallidos: 5, intentosFallidosDesde: new Date(ahora - 16 * 60_000) };
    assert.equal(intentosLogin.estaBloqueado(usuario, ahora), false);
  });

  test('calcularTrasFallo acumula dentro de la ventana', () => {
    const ahora = Date.now();
    const usuario = { intentosFallidos: 2, intentosFallidosDesde: new Date(ahora - 60_000) };
    const resultado = intentosLogin.calcularTrasFallo(usuario, ahora);
    assert.equal(resultado.intentosFallidos, 3);
  });

  test('calcularTrasFallo reinicia la racha si la ventana anterior ya expiró', () => {
    const ahora = Date.now();
    const usuario = { intentosFallidos: 5, intentosFallidosDesde: new Date(ahora - 20 * 60_000) };
    const resultado = intentosLogin.calcularTrasFallo(usuario, ahora);
    assert.equal(resultado.intentosFallidos, 1);
  });

  test('trasExito resetea el contador', () => {
    const resultado = intentosLogin.trasExito();
    assert.equal(resultado.intentosFallidos, 0);
    assert.equal(resultado.intentosFallidosDesde, null);
  });
});
