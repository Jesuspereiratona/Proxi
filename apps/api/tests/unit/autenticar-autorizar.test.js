const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const autenticar = require('../../src/middlewares/autenticar.middleware');
const autorizar = require('../../src/middlewares/autorizar.middleware');
const tokens = require('../../src/services/auth/tokens');
const { NoAutenticado, NoAutorizado } = require('../../src/errors');

describe('autenticar', () => {
  test('sin encabezado Authorization, llama a next con NoAutenticado', () => {
    let error;
    autenticar({ headers: {} }, {}, (e) => { error = e; });
    assert.ok(error instanceof NoAutenticado);
  });

  test('con un token válido, deja req.usuario = {id, rol}', () => {
    const token = tokens.firmarAcceso({ sub: '7', rol: 'coordinacion' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    let siguiente = false;
    autenticar(req, {}, () => { siguiente = true; });
    assert.equal(siguiente, true);
    assert.deepEqual(req.usuario, { id: '7', rol: 'coordinacion' });
  });

  test('con un token con firma inválida, llama a next con NoAutenticado', () => {
    const req = { headers: { authorization: 'Bearer esto.no.es.un.jwt' } };
    let error;
    autenticar(req, {}, (e) => { error = e; });
    assert.ok(error instanceof NoAutenticado);
  });
});

describe('autorizar', () => {
  test('rechaza a un rol que no está en la lista', () => {
    let error;
    autorizar('coordinacion')({ usuario: { rol: 'estudiante' } }, {}, (e) => { error = e; });
    assert.ok(error instanceof NoAutorizado);
  });

  test('deja pasar a un rol permitido', () => {
    let siguiente = false;
    autorizar('empresa', 'coordinacion')({ usuario: { rol: 'empresa' } }, {}, () => { siguiente = true; });
    assert.equal(siguiente, true);
  });

  test('sin req.usuario (no pasó por autenticar), rechaza', () => {
    let error;
    autorizar('estudiante')({}, {}, (e) => { error = e; });
    assert.ok(error instanceof NoAutorizado);
  });
});
