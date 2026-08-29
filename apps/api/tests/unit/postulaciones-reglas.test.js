const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { fechaLimiteSla } = require('../../src/services/postulaciones/reglas');
const env = require('../../src/config/env');

describe('fechaLimiteSla', () => {
  test('resta exactamente SLA_RESPUESTA_DIAS días', () => {
    const ahora = new Date('2026-01-15T12:00:00Z');
    const limite = fechaLimiteSla(ahora);
    const diasReales = (ahora.getTime() - limite.getTime()) / (24 * 60 * 60 * 1000);
    assert.equal(diasReales, env.slaRespuestaDias);
  });

  test('usa la fecha actual si no se le inyecta un reloj', () => {
    const antes = Date.now();
    const limite = fechaLimiteSla();
    const despues = Date.now();
    const diasEnMs = env.slaRespuestaDias * 24 * 60 * 60 * 1000;
    assert.ok(limite.getTime() >= antes - diasEnMs);
    assert.ok(limite.getTime() <= despues - diasEnMs);
  });
});
