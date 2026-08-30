import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calcularEstado, textoEstadoOferta, UMBRAL_URGENTE_DIAS } from '../assets/js/componentes/estado-oferta.js';

const DIA_MS = 24 * 60 * 60 * 1000;

describe('calcularEstado', () => {
  test('una fecha pasada, otro día calendario, es "Vencida"', () => {
    const ahora = new Date('2026-03-15T12:00:00');
    const cierre = new Date('2026-03-10T12:00:00');
    assert.deepEqual(calcularEstado(cierre, ahora), { texto: 'Vencida', clase: 'vencida', urgente: false });
  });

  test('cierra el mismo día calendario, aunque ya haya pasado la hora exacta: "Cierra hoy"', () => {
    const ahora = new Date('2026-03-15T18:00:00');
    const cierre = new Date('2026-03-15T09:00:00');
    assert.deepEqual(calcularEstado(cierre, ahora), { texto: 'Cierra hoy', clase: 'urgente', urgente: true });
  });

  test(`cierra en ${UMBRAL_URGENTE_DIAS} días o menos: urgente, con el número exacto de días`, () => {
    const ahora = new Date('2026-03-15T09:00:00');
    const cierre = new Date(ahora.getTime() + 2 * DIA_MS);
    assert.deepEqual(calcularEstado(cierre, ahora), { texto: 'Cierra en 2 días', clase: 'urgente', urgente: true });
  });

  test('cierra en más días que el umbral: normal, con fecha en lenguaje humano', () => {
    const ahora = new Date('2026-03-15T09:00:00');
    const cierre = new Date('2026-04-01T09:00:00');
    const resultado = calcularEstado(cierre, ahora);
    assert.equal(resultado.clase, 'normal');
    assert.equal(resultado.urgente, false);
    assert.ok(resultado.texto.startsWith('Cierra el'));
  });

  test('acepta un string ISO además de un Date', () => {
    const ahora = new Date('2026-03-15T09:00:00');
    const resultado = calcularEstado('2026-03-15T20:00:00', ahora);
    assert.equal(resultado.texto, 'Cierra hoy');
  });
});

describe('textoEstadoOferta (panel de empresa)', () => {
  test('traduce cada estado de flujo real a texto humano', () => {
    assert.deepEqual(textoEstadoOferta('borrador'), { texto: 'Borrador', clase: 'vencida' });
    assert.deepEqual(textoEstadoOferta('en_revision'), { texto: 'En revisión', clase: 'urgente' });
    assert.deepEqual(textoEstadoOferta('publicada'), { texto: 'Publicada', clase: 'normal' });
  });

  test('un estado desconocido se muestra tal cual, no revienta', () => {
    assert.deepEqual(textoEstadoOferta('algo_nuevo'), { texto: 'algo_nuevo', clase: 'vencida' });
  });
});
