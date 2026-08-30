import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { obtener, obtenerAutenticado, enviar, enviarFormData, descargarArchivo, fijarToken, limpiarToken, ErrorApi, mensajeParaCodigo } from '../assets/js/api/cliente.js';

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  limpiarToken(); // el token vive en una variable de módulo: sin esto, un test deja sesión puesta para el siguiente
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

describe('sesión: token en memoria, nunca en localStorage/sessionStorage', () => {
  test('obtenerAutenticado manda el token fijado en el header Authorization', async () => {
    fijarToken('token-de-prueba');
    let encabezados;
    globalThis.fetch = async (url, opciones) => {
      encabezados = opciones.headers;
      return respuestaFalsa(200, { ok: true });
    };
    await obtenerAutenticado('/estudiantes/perfil');
    assert.equal(encabezados.Authorization, 'Bearer token-de-prueba');
  });

  test('sin token fijado, no manda header Authorization', async () => {
    let encabezados;
    globalThis.fetch = async (url, opciones) => {
      encabezados = opciones.headers;
      return respuestaFalsa(200, {});
    };
    await obtenerAutenticado('/estudiantes/perfil');
    assert.equal(encabezados.Authorization, undefined);
  });

  test('un 401 en una petición autenticada intenta refrescar una vez y reintenta con el token nuevo', async () => {
    fijarToken('token-vencido');
    let intentos = 0;
    globalThis.fetch = async (url) => {
      const ruta = url instanceof URL ? url.pathname : url;
      if (ruta.endsWith('/auth/refrescar')) return respuestaFalsa(200, { accessToken: 'token-nuevo' });
      intentos += 1;
      if (intentos === 1) return respuestaFalsa(401, { error: { codigo: 'AUTH_TOKEN_EXPIRADO' } });
      return respuestaFalsa(200, { ok: true });
    };
    const resultado = await obtenerAutenticado('/estudiantes/perfil');
    assert.deepEqual(resultado, { ok: true });
    assert.equal(intentos, 2);
  });

  test('dos peticiones autenticadas en paralelo con el token vencido disparan un solo refresco (auditoría de sesión web)', async () => {
    // El backend rota el token de refresco (Fase 1): dos refrescos en paralelo con la misma
    // cookie se leen como reuso y revocan TODAS las sesiones del usuario. Sin serializar,
    // "refrescos" daría 2 acá.
    fijarToken('token-vencido');
    let refrescos = 0;
    const intentosPorRuta = {};
    globalThis.fetch = async (url) => {
      const ruta = url instanceof URL ? url.pathname : url;
      if (ruta.endsWith('/auth/refrescar')) {
        refrescos += 1;
        return respuestaFalsa(200, { accessToken: 'token-nuevo' });
      }
      intentosPorRuta[ruta] = (intentosPorRuta[ruta] || 0) + 1;
      if (intentosPorRuta[ruta] === 1) return respuestaFalsa(401, { error: { codigo: 'AUTH_TOKEN_EXPIRADO' } });
      return respuestaFalsa(200, { ok: ruta });
    };

    const [a, b] = await Promise.all([obtenerAutenticado('/a'), obtenerAutenticado('/b')]);
    assert.deepEqual(a, { ok: '/api/v1/a' });
    assert.deepEqual(b, { ok: '/api/v1/b' });
    assert.equal(refrescos, 1);
  });

  test('si el refresco también falla, se rinde con el error de sesión traducido', async () => {
    fijarToken('token-vencido');
    globalThis.fetch = async (url) => {
      const ruta = url instanceof URL ? url.pathname : url;
      if (ruta.endsWith('/auth/refrescar')) return respuestaFalsa(401, {});
      return respuestaFalsa(401, { error: { codigo: 'AUTH_TOKEN_EXPIRADO' } });
    };
    await assert.rejects(
      () => obtenerAutenticado('/estudiantes/perfil'),
      (error) => {
        assert.equal(error.codigo, 'AUTH_TOKEN_EXPIRADO');
        assert.equal(error.message, 'Tu sesión expiró. Inicia sesión de nuevo.');
        return true;
      },
    );
  });

  test('enviar manda el cuerpo como JSON con Content-Type', async () => {
    let cuerpoEnviado;
    let encabezados;
    globalThis.fetch = async (url, opciones) => {
      cuerpoEnviado = opciones.body;
      encabezados = opciones.headers;
      return respuestaFalsa(200, { accessToken: 'x', usuario: {} });
    };
    await enviar('POST', '/auth/login', { email: 'a@b.test', clave: 'x' }, { credenciales: true });
    assert.equal(encabezados['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(cuerpoEnviado), { email: 'a@b.test', clave: 'x' });
  });

  test('una respuesta 204 se resuelve como null, no intenta parsear JSON vacío', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 204 });
    const resultado = await enviar('POST', '/auth/logout', undefined, { autenticado: true, credenciales: true });
    assert.equal(resultado, null);
  });
});

describe('CSRF: doble-submit cookie en peticiones con credenciales (verificar-csrf.middleware.js)', () => {
  afterEach(() => { delete globalThis.document; });

  test('con credenciales:true manda X-CSRF-Token si hay cookie csrf', async () => {
    globalThis.document = { cookie: 'csrf=token-de-prueba; otra=x' };
    let encabezados;
    globalThis.fetch = async (url, opciones) => {
      encabezados = opciones.headers;
      return respuestaFalsa(200, {});
    };
    await enviar('POST', '/auth/logout', undefined, { autenticado: true, credenciales: true });
    assert.equal(encabezados['X-CSRF-Token'], 'token-de-prueba');
  });

  test('sin cookie csrf (nunca hubo sesión), no manda el encabezado', async () => {
    let encabezados;
    globalThis.fetch = async (url, opciones) => {
      encabezados = opciones.headers;
      return respuestaFalsa(200, {});
    };
    await enviar('POST', '/auth/logout', undefined, { autenticado: true, credenciales: true });
    assert.equal(encabezados['X-CSRF-Token'], undefined);
  });

  test('sin credenciales:true, no manda el encabezado aunque haya cookie', async () => {
    globalThis.document = { cookie: 'csrf=token-de-prueba' };
    let encabezados;
    globalThis.fetch = async (url, opciones) => {
      encabezados = opciones.headers;
      return respuestaFalsa(200, { ofertas: [], total: 0 });
    };
    await obtener('/ofertas');
    assert.equal(encabezados['X-CSRF-Token'], undefined);
  });

  test('el refresco automático ante un 401 también manda X-CSRF-Token si hay cookie', async () => {
    globalThis.document = { cookie: 'csrf=token-refresco' };
    fijarToken('token-vencido');
    let encabezadosRefrescar;
    let intentos = 0;
    globalThis.fetch = async (url, opciones) => {
      const ruta = url instanceof URL ? url.pathname : url;
      if (ruta.endsWith('/auth/refrescar')) {
        encabezadosRefrescar = opciones.headers;
        return respuestaFalsa(200, { accessToken: 'token-nuevo' });
      }
      intentos += 1;
      if (intentos === 1) return respuestaFalsa(401, { error: { codigo: 'AUTH_TOKEN_EXPIRADO' } });
      return respuestaFalsa(200, { ok: true });
    };
    await obtenerAutenticado('/estudiantes/perfil');
    assert.equal(encabezadosRefrescar['X-CSRF-Token'], 'token-refresco');
  });
});

describe('enviarFormData (subida de archivos)', () => {
  test('manda el FormData tal cual, sin forzar Content-Type ni JSON.stringify', async () => {
    fijarToken('token-de-prueba');
    let cuerpoEnviado;
    let encabezados;
    globalThis.fetch = async (url, opciones) => {
      cuerpoEnviado = opciones.body;
      encabezados = opciones.headers;
      return respuestaFalsa(201, { id: 1 });
    };
    const datos = new FormData();
    datos.append('cv', 'contenido-de-prueba');
    const resultado = await enviarFormData('/estudiantes/mi-cv', datos);

    assert.deepEqual(resultado, { id: 1 });
    assert.equal(encabezados['Content-Type'], undefined);
    assert.equal(encabezados.Authorization, 'Bearer token-de-prueba');
    assert.ok(cuerpoEnviado instanceof FormData);
  });

  test('traduce ARCHIVO_INVALIDO a un mensaje humano', async () => {
    fijarToken('token-de-prueba');
    globalThis.fetch = async () => respuestaFalsa(422, { error: { codigo: 'ARCHIVO_INVALIDO' } });
    await assert.rejects(
      () => enviarFormData('/estudiantes/mi-cv', new FormData()),
      (error) => {
        assert.equal(error.codigo, 'ARCHIVO_INVALIDO');
        assert.equal(error.message, 'El archivo no es un PDF válido o supera los 5 MB.');
        return true;
      },
    );
  });
});

describe('descargarArchivo', () => {
  test('escapa el id en la ruta', async () => {
    fijarToken('token-de-prueba');
    let urlUsada;
    globalThis.fetch = async (url) => {
      urlUsada = url;
      return { ok: false, status: 404, json: async () => ({ error: { codigo: 'ARCHIVO_NO_ENCONTRADO' } }) };
    };
    await assert.rejects(() => descargarArchivo('../../auth/sesiones'));
    assert.equal(urlUsada.pathname, '/api/v1/archivos/..%2F..%2Fauth%2Fsesiones/descarga');
  });

  test('un id que no existe se traduce a un mensaje humano, sin llegar al blob', async () => {
    fijarToken('token-de-prueba');
    globalThis.fetch = async () => respuestaFalsa(404, { error: { codigo: 'ARCHIVO_NO_ENCONTRADO' } });
    await assert.rejects(
      () => descargarArchivo('999'),
      (error) => {
        assert.equal(error.codigo, 'ARCHIVO_NO_ENCONTRADO');
        assert.equal(error.message, 'Ese archivo no existe.');
        return true;
      },
    );
  });
});
