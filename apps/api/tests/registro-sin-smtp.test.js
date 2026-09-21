const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario } = require('../src/models');
const env = require('../src/config/env');
const { borrarUsuariosDePrueba } = require('./limpiar');

// Sin SMTP configurado, correo.service.js cae en Ethereal: una casilla falsa. Antes de este cambio,
// registrarse en producción sin SMTP devolvía 201, creaba la cuenta, y el enlace de verificación se
// iba a esa casilla — la persona no podía entrar NI volver a registrarse, porque su correo quedaba
// ocupado. Estas pruebas fijan que eso no vuelva a pasar en silencio.
const DOMINIO_PRUEBA = 'registro-sin-smtp.test';

after(async () => {
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

const registrar = (email) => request(app)
  .post('/api/v1/auth/registro')
  .send({ email, clave: 'claveDePrueba123456', rol: 'estudiante', aceptaPolitica: true });

describe('registro sin SMTP configurado', () => {
  test('en producción sin SMTP responde un error claro y NO crea la cuenta', async () => {
    const email = `sin.smtp.${Date.now()}@${DOMINIO_PRUEBA}`;
    const produccionOriginal = env.esProduccion;
    const smtpOriginal = env.smtp.host;
    env.esProduccion = true;
    env.smtp.host = '';
    try {
      const respuesta = await registrar(email);
      assert.equal(respuesta.status, 422);
      assert.equal(respuesta.body.error.codigo, 'REGISTRO_NO_DISPONIBLE');
      // Lo importante: el correo NO queda ocupado, así que la persona puede volver a intentarlo
      // cuando el correo esté configurado.
      assert.equal(await Usuario.count({ where: { email } }), 0);
    } finally {
      env.esProduccion = produccionOriginal;
      env.smtp.host = smtpOriginal;
    }
  });

  test('con SMTP configurado el registro sigue funcionando igual', async () => {
    const email = `con.smtp.${Date.now()}@${DOMINIO_PRUEBA}`;
    const produccionOriginal = env.esProduccion;
    const smtpOriginal = env.smtp.host;
    env.esProduccion = true;
    env.smtp.host = 'smtp.ejemplo.test';
    try {
      // NODE_ENV sigue siendo 'test', así que correo.service.js no toca la red: solo registra el
      // asunto. Lo que se comprueba acá es que la comprobación nueva no bloquea el camino normal.
      const respuesta = await registrar(email);
      assert.equal(respuesta.status, 201);
      assert.equal(await Usuario.count({ where: { email } }), 1);
    } finally {
      env.esProduccion = produccionOriginal;
      env.smtp.host = smtpOriginal;
    }
  });

  test('fuera de producción el registro no depende de SMTP', async () => {
    const email = `desarrollo.${Date.now()}@${DOMINIO_PRUEBA}`;
    const respuesta = await registrar(email);
    assert.equal(respuesta.status, 201);
  });
});
