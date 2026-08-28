const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');

describe('GET /api/v1/salud', () => {
  test('responde con el estado de la app y de la base de datos', async () => {
    const respuesta = await request(app).get('/api/v1/salud');

    assert.ok([200, 503].includes(respuesta.status));
    assert.equal(typeof respuesta.body.estado, 'string');
    assert.equal(typeof respuesta.body.baseDeDatos.ok, 'boolean');
  });

  test('nunca revela detalles del error de base de datos fuera de desarrollo', async () => {
    const respuesta = await request(app).get('/api/v1/salud');

    if (!respuesta.body.baseDeDatos.ok && process.env.NODE_ENV === 'production') {
      assert.equal(respuesta.body.baseDeDatos.error, undefined);
    }
  });
});

describe('rutas no declaradas', () => {
  test('responden 404 con el formato de error estándar', async () => {
    const respuesta = await request(app).get('/api/v1/no-existe');

    assert.equal(respuesta.status, 404);
    assert.equal(respuesta.body.error.codigo, 'RUTA_NO_ENCONTRADA');
    assert.ok(respuesta.body.error.peticionId);
  });
});
