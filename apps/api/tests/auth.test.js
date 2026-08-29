const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Sesion, TokenVerificacion } = require('../src/models');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');

const DOMINIO_PRUEBA = 'test.uahurtado.cl';
const correoUnico = (prefijo) => `${prefijo}.${Date.now()}.${Math.random().toString(36).slice(2)}@${DOMINIO_PRUEBA}`;
const CLAVE = 'claveDePrueba123456';

const registrarActivo = async (email, clave = CLAVE, rol = 'estudiante') => {
  const passwordHash = await passwords.hashear(clave);
  return Usuario.create({ email, passwordHash, rol, estado: 'activo', emailVerificadoAt: new Date() });
};

const crearTokenUnSoloUso = async (usuarioId, tipo, { expirado = false } = {}) => {
  const { plano, hash } = tokensService.generarTokenAleatorio();
  await TokenVerificacion.create({
    usuarioId,
    tokenHash: hash,
    tipo,
    expiraAt: new Date(Date.now() + (expirado ? -1000 : 60_000)),
  });
  return plano;
};

after(async () => {
  await Usuario.destroy({ where: { email: { [require('sequelize').Op.like]: `%@${DOMINIO_PRUEBA}` } } });
  await sequelize.close();
});

describe('POST /auth/registro', () => {
  test('crea la cuenta pendiente_verificacion y no expone el hash de la clave', async () => {
    const email = correoUnico('reg');
    const respuesta = await request(app)
      .post('/api/v1/auth/registro')
      .send({ email, clave: CLAVE, rol: 'estudiante', aceptaPolitica: true, versionPolitica: 'v1' });

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.estado, 'pendiente_verificacion');
    assert.equal(respuesta.body.passwordHash, undefined);
  });

  test('sin aceptar la política, responde 422 CONSENTIMIENTO_REQUERIDO', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/registro')
      .send({ email: correoUnico('sinc'), clave: CLAVE, rol: 'estudiante', aceptaPolitica: false, versionPolitica: 'v1' });

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'CONSENTIMIENTO_REQUERIDO');
  });

  test('un correo ya registrado responde 409 AUTH_CORREO_YA_REGISTRADO', async () => {
    const email = correoUnico('dup');
    const payload = { email, clave: CLAVE, rol: 'estudiante', aceptaPolitica: true, versionPolitica: 'v1' };
    await request(app).post('/api/v1/auth/registro').send(payload);

    const respuesta = await request(app).post('/api/v1/auth/registro').send(payload);
    assert.equal(respuesta.status, 409);
    assert.equal(respuesta.body.error.codigo, 'AUTH_CORREO_YA_REGISTRADO');
  });

  test('rol=coordinacion se rechaza: el registro público no lo permite', async () => {
    const respuesta = await request(app)
      .post('/api/v1/auth/registro')
      .send({ email: correoUnico('coord'), clave: CLAVE, rol: 'coordinacion', aceptaPolitica: true, versionPolitica: 'v1' });

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'VALIDACION_ENTRADA');
  });
});

describe('verificación de correo', () => {
  test('un token válido activa la cuenta', async () => {
    const usuario = await registrarActivo(correoUnico('ver'));
    await usuario.update({ estado: 'pendiente_verificacion', emailVerificadoAt: null });
    const token = await crearTokenUnSoloUso(usuario.id, 'verificacion_correo');

    const respuesta = await request(app).post('/api/v1/auth/verificar-correo').send({ token });
    assert.equal(respuesta.status, 204);

    await usuario.reload();
    assert.equal(usuario.estado, 'activo');
    assert.ok(usuario.emailVerificadoAt);
  });

  test('el mismo token usado dos veces: la segunda responde 422 AUTH_TOKEN_INVALIDO', async () => {
    const usuario = await registrarActivo(correoUnico('ver2'));
    const token = await crearTokenUnSoloUso(usuario.id, 'verificacion_correo');

    await request(app).post('/api/v1/auth/verificar-correo').send({ token });
    const segunda = await request(app).post('/api/v1/auth/verificar-correo').send({ token });

    assert.equal(segunda.status, 422);
    assert.equal(segunda.body.error.codigo, 'AUTH_TOKEN_INVALIDO');
  });

  test('un token vencido responde 422 AUTH_TOKEN_EXPIRADO', async () => {
    const usuario = await registrarActivo(correoUnico('ver3'));
    const token = await crearTokenUnSoloUso(usuario.id, 'verificacion_correo', { expirado: true });

    const respuesta = await request(app).post('/api/v1/auth/verificar-correo').send({ token });
    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'AUTH_TOKEN_EXPIRADO');
  });
});

describe('POST /auth/login', () => {
  test('credenciales correctas y cuenta activa: 200 con accessToken y cookie de refresco httpOnly', async () => {
    const email = correoUnico('login');
    await registrarActivo(email);

    const respuesta = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });

    assert.equal(respuesta.status, 200);
    assert.ok(respuesta.body.accessToken);
    const cookie = respuesta.headers['set-cookie']?.[0] || '';
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
  });

  test('cuenta pendiente_verificacion con clave correcta: 403 AUTH_EMAIL_NO_VERIFICADO', async () => {
    const email = correoUnico('pend');
    const usuario = await registrarActivo(email);
    await usuario.update({ estado: 'pendiente_verificacion' });

    const respuesta = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });
    assert.equal(respuesta.status, 403);
    assert.equal(respuesta.body.error.codigo, 'AUTH_EMAIL_NO_VERIFICADO');
  });

  test('correo inexistente y clave incorrecta responden el mismo error', async () => {
    const email = correoUnico('malaclave');
    await registrarActivo(email);

    const inexistente = await request(app).post('/api/v1/auth/login').send({ email: correoUnico('fantasma'), clave: CLAVE });
    const malaClave = await request(app).post('/api/v1/auth/login').send({ email, clave: 'otraClaveDistinta1' });

    assert.equal(inexistente.status, 401);
    assert.equal(malaClave.status, 401);
    assert.equal(inexistente.body.error.codigo, 'AUTH_CREDENCIALES_INVALIDAS');
    assert.equal(inexistente.body.error.mensaje, malaClave.body.error.mensaje);
  });

  test('5 fallos en la ventana bloquean el sexto intento aunque la clave sea correcta', async () => {
    const email = correoUnico('bloqueo');
    const usuario = await registrarActivo(email);
    await usuario.update({ intentosFallidos: 5, intentosFallidosDesde: new Date() });

    const respuesta = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });
    assert.equal(respuesta.status, 403);
    assert.equal(respuesta.body.error.codigo, 'AUTH_CUENTA_BLOQUEADA');
  });
});

describe('rotación y reuso del refresco', () => {
  test('un refresco válido rota: el nuevo funciona, el usado ya no', async () => {
    const email = correoUnico('rot');
    await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });
    const cookieOriginal = loginResp.headers['set-cookie'];

    const rotado = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieOriginal);
    assert.equal(rotado.status, 200);
    assert.ok(rotado.body.accessToken);

    const reintento = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieOriginal);
    assert.equal(reintento.status, 401);
  });

  test('reusar un refresco ya rotado revoca todas las sesiones de la cuenta', async () => {
    const email = correoUnico('reuso');
    const usuario = await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });
    const cookieViejo = loginResp.headers['set-cookie'];

    const primeraRotacion = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieViejo);
    const cookieNuevo = primeraRotacion.headers['set-cookie'];

    await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieViejo); // reuso

    const conElNuevo = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieNuevo);
    assert.equal(conElNuevo.status, 401);

    const sesiones = await Sesion.findAll({ where: { usuarioId: usuario.id } });
    assert.ok(sesiones.length > 0);
    assert.ok(sesiones.every((s) => s.revocadaAt !== null));
  });
});

describe('POST /auth/logout', () => {
  test('revoca la sesión activa y limpia la cookie', async () => {
    const email = correoUnico('logout');
    const usuario = await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });
    const cookie = loginResp.headers['set-cookie'];

    const respuesta = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    assert.equal(respuesta.status, 204);
    assert.match(respuesta.headers['set-cookie'][0], /Expires=Thu, 01 Jan 1970/);

    const sesiones = await Sesion.findAll({ where: { usuarioId: usuario.id } });
    assert.ok(sesiones.every((s) => s.revocadaAt !== null));
  });

  test('sin sesión activa, igual responde 204', async () => {
    const respuesta = await request(app).post('/api/v1/auth/logout');
    assert.equal(respuesta.status, 204);
  });
});

describe('recuperación y restablecimiento de clave', () => {
  test('correo inexistente responde 200 con el mismo cuerpo que uno existente', async () => {
    const email = correoUnico('rec');
    await registrarActivo(email);

    const inexistente = await request(app).post('/api/v1/auth/recuperar-clave').send({ email: correoUnico('fantasma') });
    const existente = await request(app).post('/api/v1/auth/recuperar-clave').send({ email });

    assert.equal(inexistente.status, 200);
    assert.equal(existente.status, 200);
    assert.deepEqual(inexistente.body, existente.body);
  });

  test('un token de restablecimiento válido cambia la clave y no sirve una segunda vez', async () => {
    const email = correoUnico('rest');
    const usuario = await registrarActivo(email);
    const token = await crearTokenUnSoloUso(usuario.id, 'restablecer_clave');
    const claveNueva = 'unaClaveNuevaSegura1';

    const primera = await request(app).post('/api/v1/auth/restablecer-clave').send({ token, claveNueva });
    assert.equal(primera.status, 204);

    const loginConNueva = await request(app).post('/api/v1/auth/login').send({ email, clave: claveNueva });
    assert.equal(loginConNueva.status, 200);

    const segunda = await request(app).post('/api/v1/auth/restablecer-clave').send({ token, claveNueva: 'otraClaveMas12345' });
    assert.equal(segunda.status, 422);
    assert.equal(segunda.body.error.codigo, 'AUTH_TOKEN_INVALIDO');
  });

  test('restablecer la clave también resetea los intentos fallidos', async () => {
    const email = correoUnico('resetintentos');
    const usuario = await registrarActivo(email);
    await usuario.update({ intentosFallidos: 4, intentosFallidosDesde: new Date() });
    const token = await crearTokenUnSoloUso(usuario.id, 'restablecer_clave');

    await request(app).post('/api/v1/auth/restablecer-clave').send({ token, claveNueva: 'otraClaveNueva12345' });

    await usuario.reload();
    assert.equal(usuario.intentosFallidos, 0);
  });
});

describe('rutas no declaradas dentro de /auth', () => {
  test('404 con el formato de error estándar', async () => {
    const respuesta = await request(app).post('/api/v1/auth/no-existe');
    assert.equal(respuesta.status, 404);
  });
});
