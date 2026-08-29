const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { fechaLimiteDeclaracion, verificarVigencia } = require('../../src/services/ofertas/reglas');
const { AppError } = require('../../src/errors');
const env = require('../../src/config/env');

describe('fechaLimiteDeclaracion', () => {
  test('resta exactamente PLAZO_DECLARAR_CIERRE_DIAS días', () => {
    const ahora = new Date('2026-01-15T12:00:00Z');
    const limite = fechaLimiteDeclaracion(ahora);
    const diasReales = (ahora.getTime() - limite.getTime()) / (24 * 60 * 60 * 1000);
    assert.equal(diasReales, env.plazoDeclararCierreDias);
  });
});

describe('verificarVigencia', () => {
  const ahora = new Date('2026-01-15T12:00:00Z');

  test('no lanza para una oferta publicada con fecha de cierre futura', () => {
    const oferta = { estado: 'publicada', fechaCierre: new Date('2026-02-01T00:00:00Z') };
    assert.doesNotThrow(() => verificarVigencia(oferta, ahora));
  });

  test('lanza OFERTA_NO_VIGENTE si la fecha de cierre ya pasó', () => {
    const oferta = { estado: 'publicada', fechaCierre: new Date('2026-01-01T00:00:00Z') };
    assert.throws(() => verificarVigencia(oferta, ahora), (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.codigo, 'OFERTA_NO_VIGENTE');
      return true;
    });
  });

  test('lanza OFERTA_NO_VIGENTE justo en el instante de cierre (el borde no cuenta como vigente)', () => {
    const oferta = { estado: 'publicada', fechaCierre: ahora };
    assert.throws(() => verificarVigencia(oferta, ahora));
  });

  test('lanza OFERTA_NO_VIGENTE si el estado no es publicada', () => {
    const oferta = { estado: 'cerrada', fechaCierre: new Date('2026-02-01T00:00:00Z') };
    assert.throws(() => verificarVigencia(oferta, ahora));
  });

  test('lanza OFERTA_NO_VIGENTE si no tiene fecha de cierre (borrador)', () => {
    const oferta = { estado: 'borrador', fechaCierre: null };
    assert.throws(() => verificarVigencia(oferta, ahora));
  });
});
