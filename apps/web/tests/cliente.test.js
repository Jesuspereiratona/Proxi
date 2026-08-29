import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { obtener, ErrorApi, mensajeParaCodigo } from '../assets/js/api/cliente.js';

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const respuestaFalsa = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

describe('obtener', () => {
  test('devuelve el JSON tal cual cuando la respuesta es exitosa', async () => {
    globalThis.fetch = async () => respuestaFalsa(200, { ofertas: [], total: 0 });
    const resultado = await obtener('/ofertas');
    assert.deepEqual(resultado, { ofertas: [], total: 0 });
  });

  test('arma la URL con los filtros como query string, descartando valores vacíos', async () => {
    let urlUsada;
    globalThis.fetch = async (url) => {
      urlUsada = url;
      return respuestaFalsa(200, {});
    };
    await obtener('/ofertas', { area: 'contabilidad', comuna: '', modalidad: undefined });
    assert.equal(urlUsada.searchParams.get('area'), 'contabilidad');
    assert.equal(urlUsada.searchParams.has('comuna'), false);
    assert.equal(urlUsada.searchParams.has('modalidad'), false);
  });

  test('traduce un código de error conocido de la API a un mensaje humano', async () => {
    globalThis.fetch = async () => respuestaFalsa(422, { error: { codigo: 'OFERTA_NO_VIGENTE' } });
    await assert.rejects(
      () => obtener('/ofertas/1'),
      (error) => {
        assert.ok(error instanceof ErrorApi);
        assert.equal(error.codigo, 'OFERTA_NO_VIGENTE');
        assert.equal(error.message, 'Esta oferta ya no está disponible.');
        return true;
      },
    );
  });

  test('un código de error desconocido usa el mensaje genérico', () => {
    assert.equal(mensajeParaCodigo('ALGO_QUE_NO_EXISTE'), 'Ocurrió un problema. Intenta de nuevo en un momento.');
  });

  test('un fallo de red se traduce igual, nunca deja pasar el error crudo de fetch', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    await assert.rejects(
      () => obtener('/ofertas'),
      (error) => {
        assert.ok(error instanceof ErrorApi);
        assert.equal(error.codigo, 'ERROR_RED');
        return true;
      },
    );
  });
});
