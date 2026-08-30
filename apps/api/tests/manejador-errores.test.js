const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

// Pruebas del manejador de errores global, no de un recurso puntual: un cliente que manda un
// cuerpo raro debería recibir siempre un error operacional (422), nunca el 500 genérico que
// implica que algo se rompió del lado del servidor.
describe('manejador de errores: cuerpos de petición raros', () => {
  test('JSON mal formado responde 422 JSON_INVALIDO, no 500', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "roto"'); // JSON incompleto a propósito

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'JSON_INVALIDO');
  });

  test('un cuerpo de más de 1 MB responde 422 CUERPO_DEMASIADO_GRANDE, no 500 (pentester-api)', async () => {
    // Petición sin autenticar a propósito: el límite de express.json() corre antes que cualquier
    // middleware de auth, así que cualquiera puede provocarlo (pentester-api probó exactamente esto
    // contra /auth/login).
    const cuerpoEnorme = { email: 'a@b.test', clave: 'x'.repeat(1_100_000) };

    const respuesta = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(cuerpoEnorme);

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'CUERPO_DEMASIADO_GRANDE');
  });
});
