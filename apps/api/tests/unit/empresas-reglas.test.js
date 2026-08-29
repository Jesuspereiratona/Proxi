const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { verificarValidada } = require('../../src/services/empresas/reglas');
const { AppError } = require('../../src/errors');

describe('verificarValidada', () => {
  test('no lanza para una empresa validada', () => {
    assert.doesNotThrow(() => verificarValidada({ estadoValidacion: 'validada' }));
  });

  for (const estado of ['pendiente', 'rechazada', 'suspendida']) {
    test(`lanza EMPRESA_NO_VALIDADA para una empresa ${estado}`, () => {
      assert.throws(() => verificarValidada({ estadoValidacion: estado }), (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.codigo, 'EMPRESA_NO_VALIDADA');
        return true;
      });
    });
  }
});
