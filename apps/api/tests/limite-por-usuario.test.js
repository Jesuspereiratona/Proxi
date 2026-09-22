const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { claveDeLimite } = require('../src/middlewares/limitar-tasa.middleware');
const tokens = require('../src/services/auth/tokens');

// El límite de tasa se cuenta por usuario cuando hay sesión válida, y por IP cuando no.
//
// Existe por un problema concreto de esta universidad: con la IP como única clave, toda la red del
// campus comparte presupuesto y treinta estudiantes se bloquean entre ellos. Y la parte delicada es
// la otra: si el `sub` se leyera sin verificar la firma, cualquiera tendría presupuesto infinito
// inventando un `sub` distinto en cada petición.

const peticion = (encabezado, ip = '200.1.2.3') => ({
  headers: encabezado ? { authorization: encabezado } : {},
  ip,
});

describe('clave del límite de tasa', () => {
  test('sin sesión, la clave es la IP', () => {
    assert.equal(claveDeLimite(peticion(null)), 'ip:200.1.2.3');
  });

  test('con un token válido, la clave es el usuario y no la IP', () => {
    const token = tokens.firmarAcceso({ sub: '42', rol: 'estudiante' });
    assert.equal(claveDeLimite(peticion(`Bearer ${token}`)), 'usuario:42');
  });

  test('dos personas distintas en la MISMA IP tienen presupuestos separados', () => {
    // El caso que motivó el cambio: la red del campus.
    const unaIp = '146.155.1.1';
    const ana = tokens.firmarAcceso({ sub: '1', rol: 'estudiante' });
    const beto = tokens.firmarAcceso({ sub: '2', rol: 'estudiante' });

    const claveAna = claveDeLimite(peticion(`Bearer ${ana}`, unaIp));
    const claveBeto = claveDeLimite(peticion(`Bearer ${beto}`, unaIp));
    assert.notEqual(claveAna, claveBeto, 'comparten cubo: se bloquearían entre ellos');
  });

  test('un token FALSIFICADO no consigue su propio presupuesto', () => {
    // Firmado con otra clave: si esto pasara, alguien tendría límite infinito inventando un sub
    // distinto en cada petición. Tiene que caer al cubo de la IP.
    const falso = jwt.sign({ sub: '999', rol: 'coordinacion' }, 'una-clave-que-no-es-la-nuestra');
    assert.equal(claveDeLimite(peticion(`Bearer ${falso}`)), 'ip:200.1.2.3');
  });

  test('un token vencido tampoco: cae a la IP', () => {
    const vencido = jwt.sign({ sub: '7', rol: 'estudiante' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '-1s' });
    assert.equal(claveDeLimite(peticion(`Bearer ${vencido}`)), 'ip:200.1.2.3');
  });

  test('basura en el encabezado cae a la IP, no revienta', () => {
    for (const encabezado of ['Bearer', 'Bearer ...', 'Basic abc', 'cualquier cosa', 'Bearer a.b.c']) {
      assert.equal(claveDeLimite(peticion(encabezado)), 'ip:200.1.2.3', `falló con "${encabezado}"`);
    }
  });

  test('el mismo usuario desde dos IP distintas comparte su presupuesto', () => {
    // Al revés del caso del campus: cambiar de red no debe regalar un cubo nuevo.
    const token = tokens.firmarAcceso({ sub: '55', rol: 'empresa' });
    assert.equal(
      claveDeLimite(peticion(`Bearer ${token}`, '1.1.1.1')),
      claveDeLimite(peticion(`Bearer ${token}`, '2.2.2.2')),
    );
  });
});
