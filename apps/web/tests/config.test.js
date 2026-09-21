import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// config.js decide a qué dirección apunta la web según el host desde el que se abrió. Estas pruebas
// existen por un fallo real: la rama de producción quedó como '/api/v1' (relativa) y el login murió
// en el navegador, porque cliente.js hace `new URL(`${API_URL}${ruta}`)` y `new URL()` sin base
// lanza TypeError con una ruta relativa. Las pruebas de entonces no lo vieron —corren en Node, con
// la rama local— y curl tampoco, porque no ejecuta este código.

const locationOriginal = globalThis.location;
afterEach(() => {
  if (locationOriginal === undefined) delete globalThis.location;
  else globalThis.location = locationOriginal;
});

// La consulta en el import fuerza una instancia nueva del módulo: los módulos ES se cachean, y sin
// esto la segunda importación devolvería la de la primera, ya resuelta con otro host.
const cargarConHost = async (hostname, origin, marca) => {
  globalThis.location = { hostname, origin };
  return import(`../assets/js/config.js?${marca}`);
};

describe('config.js', () => {
  test('en producción la URL es absoluta y sirve para construir un new URL()', async () => {
    const { API_URL } = await cargarConHost('proxi-88x.pages.dev', 'https://proxi-88x.pages.dev', 'prod');
    // Lo que de verdad importa: que esto no lance. Es la línea exacta que corre cliente.js.
    const url = new URL(`${API_URL}/auth/login`);
    assert.equal(url.origin, 'https://proxi-88x.pages.dev');
    assert.equal(url.pathname, '/api/v1/auth/login');
  });

  test('en producción apunta al MISMO dominio de la web, no a otro', async () => {
    // Si volviera a apuntar a otro dominio, la cookie csrf dejaría de ser de primera parte y la
    // sesión rebotaría al formulario de login (ver apps/web/_worker.js).
    const { API_URL } = await cargarConHost('ejemplo.pages.dev', 'https://ejemplo.pages.dev', 'otro');
    assert.ok(API_URL.startsWith('https://ejemplo.pages.dev/'), `apunta a ${API_URL}`);
  });

  test('en local sigue apuntando al puerto 3000', async () => {
    const { API_URL } = await cargarConHost('localhost', 'http://localhost:5173', 'local');
    assert.equal(API_URL, 'http://localhost:3000/api/v1');
  });

  test('sin location (las pruebas corren en Node) cae en la rama local sin reventar', async () => {
    delete globalThis.location;
    const { API_URL } = await import('../assets/js/config.js?sinlocation');
    assert.doesNotThrow(() => new URL(`${API_URL}/salud`));
  });
});
