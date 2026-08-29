const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const passwords = require('../../src/services/auth/passwords');

describe('passwords', () => {
  test('hashea y compara correctamente', async () => {
    const hash = await passwords.hashear('unaClaveDePrueba123');
    assert.equal(await passwords.comparar('unaClaveDePrueba123', hash), true);
    assert.equal(await passwords.comparar('otraClave', hash), false);
  });

  test('el hash nunca es igual al texto plano', async () => {
    const hash = await passwords.hashear('unaClaveDePrueba123');
    assert.notEqual(hash, 'unaClaveDePrueba123');
  });

  test('esFuerte rechaza claves cortas y acepta las de 12+ caracteres', () => {
    assert.equal(passwords.esFuerte('corta'), false);
    assert.equal(passwords.esFuerte('doceCaracteres'), true);
  });
});
