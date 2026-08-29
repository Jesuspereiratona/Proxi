import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { textoEstado, quienMovio, formatoLineaTiempo } from '../assets/js/componentes/linea-tiempo.js';

describe('textoEstado', () => {
  test('traduce cada estado real a texto humano', () => {
    assert.equal(textoEstado('en_revision'), 'En revisión');
    assert.equal(textoEstado('sin_respuesta'), 'Sin respuesta');
  });

  test('un estado desconocido se muestra tal cual, no revienta', () => {
    assert.equal(textoEstado('algo_nuevo'), 'algo_nuevo');
  });
});

describe('quienMovio', () => {
  test('recibida y retirada son siempre del estudiante', () => {
    assert.equal(quienMovio('recibida'), 'Tú');
    assert.equal(quienMovio('retirada'), 'Tú');
  });

  test('los cuatro estados del proceso de selección son siempre de la empresa', () => {
    for (const estado of ['en_revision', 'entrevista', 'seleccionada', 'no_seleccionada']) {
      assert.equal(quienMovio(estado), 'La empresa');
    }
  });

  test('sin_respuesta es siempre del sistema', () => {
    assert.equal(quienMovio('sin_respuesta'), 'El sistema');
  });
});

describe('formatoLineaTiempo', () => {
  test('traduce la lista completa y convierte createdAt a Date real', () => {
    const eventos = [
      { estadoAnterior: null, estadoNuevo: 'recibida', actorUsuarioId: '5', motivo: null, createdAt: '2026-08-01T10:00:00.000Z' },
      { estadoAnterior: 'recibida', estadoNuevo: 'en_revision', actorUsuarioId: '9', motivo: null, createdAt: '2026-08-02T10:00:00.000Z' },
    ];
    const resultado = formatoLineaTiempo(eventos);
    assert.equal(resultado.length, 2);
    assert.equal(resultado[0].texto, 'Recibida');
    assert.equal(resultado[0].quien, 'Tú');
    assert.ok(resultado[0].fecha instanceof Date);
    assert.equal(resultado[1].quien, 'La empresa');
  });

  test('una lista vacía no revienta', () => {
    assert.deepEqual(formatoLineaTiempo([]), []);
    assert.deepEqual(formatoLineaTiempo(), []);
  });

  // El motivo (nota libre de la empresa o del estudiante) y actorUsuarioId (id interno) no
  // llegan por acá — la API los excluye a propósito (auditoría del panel de estudiante): motivo
  // está pensado para coordinación o para quien lo escribe, no para la otra parte, y el id interno
  // no le sirve a la interfaz para nada que quienMovio() no resuelva ya.
  test('nunca expone motivo ni actorUsuarioId, aunque el evento los traiga', () => {
    const [evento] = formatoLineaTiempo([
      { estadoNuevo: 'no_seleccionada', motivo: 'No cumple el perfil', actorUsuarioId: '9', createdAt: '2026-08-01T10:00:00.000Z' },
    ]);
    assert.deepEqual(Object.keys(evento).sort(), ['fecha', 'quien', 'texto']);
  });
});
