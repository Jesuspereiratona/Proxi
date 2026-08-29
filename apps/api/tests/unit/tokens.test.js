const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const tokens = require('../../src/services/auth/tokens');

describe('tokens de acceso', () => {
  test('firma y verifica, con sub y rol', () => {
    const token = tokens.firmarAcceso({ sub: '42', rol: 'estudiante' });
    const payload = tokens.verificarAcceso(token);
    assert.equal(payload.sub, '42');
    assert.equal(payload.rol, 'estudiante');
  });

  test('el payload no lleva nada más que sub/rol/iat/exp', () => {
    const token = tokens.firmarAcceso({ sub: '1', rol: 'empresa' });
    const payload = tokens.verificarAcceso(token);
    assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'rol', 'sub']);
  });

  test('un token alterado no verifica', () => {
    const token = tokens.firmarAcceso({ sub: '1', rol: 'estudiante' });
    assert.throws(() => tokens.verificarAcceso(`${token}x`));
  });
});

describe('tokens de un solo uso', () => {
  test('el plano y el hash son distintos, y el hash es reproducible desde el plano', () => {
    const { plano, hash } = tokens.generarTokenAleatorio();
    assert.notEqual(plano, hash);
    assert.equal(tokens.hashearToken(plano), hash);
  });

  test('dos tokens generados no se repiten', () => {
    const a = tokens.generarTokenAleatorio();
    const b = tokens.generarTokenAleatorio();
    assert.notEqual(a.plano, b.plano);
  });
});
