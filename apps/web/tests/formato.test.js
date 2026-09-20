import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatoMonto, formatoFechaCorta, formatoFechaLarga,
  etiquetaModalidad, etiquetaJornada, etiquetaRemuneracion, etiquetaArea, formatoRut,
} from '../assets/js/formato.js';

describe('formatoMonto', () => {
  test('separa los miles con punto y no pone decimales', () => {
    // En pesos chilenos nadie escribe "$300.000,00", y el formateador los agrega por defecto.
    assert.equal(formatoMonto(300000).replace(/ /g, ' '), '$300.000');
  });

  test('un monto que no es número da una raya, no "NaN" ni "$NaN"', () => {
    assert.equal(formatoMonto(null), '—');
    assert.equal(formatoMonto(undefined), '—');
  });
});

describe('etiquetas de dominio', () => {
  test('traduce los valores crudos de la base a español legible', () => {
    assert.equal(etiquetaModalidad('hibrida'), 'Híbrida');
    assert.equal(etiquetaJornada('parcial'), 'Jornada parcial');
  });

  test('un valor desconocido se devuelve tal cual, nunca vacío', () => {
    // Si el backend agrega una modalidad nueva, que se vea fea es mejor que desaparezca de la
    // pantalla sin que nadie lo note.
    assert.equal(etiquetaModalidad('presencial_rotativa'), 'presencial_rotativa');
  });

  test('sin valor devuelve cadena vacía, no "undefined"', () => {
    assert.equal(etiquetaModalidad(undefined), '');
    assert.equal(etiquetaJornada(null), '');
  });
});

describe('etiquetaRemuneracion', () => {
  test('no remunerada gana sobre cualquier monto que haya quedado en la base', () => {
    // Al pasar una oferta a no remunerada el monto puede quedar huérfano: mostrarlo sería mentir.
    assert.equal(etiquetaRemuneracion(false, 400000), 'No remunerada');
  });

  test('remunerada con monto lo dice completo', () => {
    assert.equal(etiquetaRemuneracion(true, 300000).replace(/ /g, ' '), '$300.000 al mes');
  });

  test('remunerada sin monto no inventa un cero', () => {
    assert.equal(etiquetaRemuneracion(true, null), 'Remunerada');
  });
});

describe('etiquetaArea', () => {
  test('le quita el aspecto de slug a un área escrita como slug', () => {
    assert.equal(etiquetaArea('control-gestion'), 'Control gestion');
    assert.equal(etiquetaArea('recursos_humanos'), 'Recursos humanos');
  });

  test('no toca un área ya escrita como texto', () => {
    assert.equal(etiquetaArea('Auditoría'), 'Auditoría');
  });

  test('vacío o ausente no revienta', () => {
    assert.equal(etiquetaArea(''), '');
    assert.equal(etiquetaArea(undefined), '');
  });
});

describe('fechas', () => {
  test('la corta abrevia el mes y la larga lo escribe entero', () => {
    const fecha = new Date('2026-09-25T15:00:00');
    assert.match(formatoFechaCorta(fecha), /^25 sept\.? 2026$/);
    assert.equal(formatoFechaLarga(fecha), '25 de septiembre de 2026');
  });

  test('acepta el string ISO que manda la API, no solo un Date', () => {
    assert.equal(formatoFechaLarga('2026-09-25T15:00:00'), '25 de septiembre de 2026');
  });
});

describe('formatoRut', () => {
  test('pone puntos y guion a un RUT que llega corrido', () => {
    // Coordinación lo contrasta contra un registro externo: nueve dígitos seguidos se leen mal.
    assert.equal(formatoRut('626178944'), '62.617.894-4');
    assert.equal(formatoRut('240127008'), '24.012.700-8');
  });

  test('acepta el dígito verificador K', () => {
    assert.equal(formatoRut('76543210K'), '76.543.210-K');
  });

  test('un RUT que ya viene formateado no se formatea dos veces', () => {
    assert.equal(formatoRut('76.543.210-K'), '76.543.210-K');
  });

  test('un valor que no tiene forma de RUT se devuelve tal cual', () => {
    // Inventarle formato a un RUT mal guardado lo haría parecer válido.
    assert.equal(formatoRut('abc'), 'abc');
    assert.equal(formatoRut('123'), '123');
  });

  test('vacío o ausente no revienta', () => {
    assert.equal(formatoRut(''), '');
    assert.equal(formatoRut(null), '');
  });
});
