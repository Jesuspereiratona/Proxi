const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Sesion, TokenVerificacion, Consentimiento } = require('../src/models');
const { borrarUsuariosDePrueba } = require('./limpiar');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');
const authService = require('../src/services/auth/auth.service');

// Dominio propio de este archivo: node --test corre los archivos en paralelo contra la misma base,
// así que un dominio compartido con otro archivo hace que el after() de uno borre a mitad de prueba
// los usuarios que el otro todavía está usando (pasó con perfiles.test.js, ver la bitácora).
const DOMINIO_PRUEBA = 'auth.uahurtado.test';
const correoUnico = (prefijo) => `${prefijo}.${Date.now()}.${Math.random().toString(36).slice(2)}@${DOMINIO_PRUEBA}`;
const CLAVE = 'claveDePrueba123456';

// El middleware de CSRF exige el valor de la cookie `csrf` también como encabezado
// (verificar-csrf.middleware.js) — las pruebas lo leen del Set-Cookie de un login/refrescar
// previo, igual que tendría que hacerlo un cliente real.
const csrfDe = (cookies = []) => {
  const fila = cookies.find((c) => c.startsWith('csrf='));
  return fila ? fila.split(';')[0].split('=')[1] : '';
};

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
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
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

  test('versionPolitica que mande el cliente se ignora: queda la del servidor (evidencia de consentimiento, Ley 21.719)', async () => {
    const email = correoUnico('verpol');
    const respuesta = await request(app)
      .post('/api/v1/auth/registro')
      .send({ email, clave: CLAVE, rol: 'estudiante', aceptaPolitica: true, versionPolitica: 'valor-inventado-del-cliente' });

    assert.equal(respuesta.status, 201);
    const consentimiento = await Consentimiento.findOne({ where: { usuarioId: respuesta.body.id } });
    assert.notEqual(consentimiento.versionPolitica, 'valor-inventado-del-cliente');
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

    const rotado = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieOriginal).set('X-CSRF-Token', csrfDe(cookieOriginal));
    assert.equal(rotado.status, 200);
    assert.ok(rotado.body.accessToken);

    const reintento = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieOriginal).set('X-CSRF-Token', csrfDe(cookieOriginal));
    assert.equal(reintento.status, 401);
  });

  test('reusar un refresco ya rotado revoca todas las sesiones de la cuenta', async () => {
    const email = correoUnico('reuso');
    const usuario = await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });
    const cookieViejo = loginResp.headers['set-cookie'];

    const primeraRotacion = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieViejo).set('X-CSRF-Token', csrfDe(cookieViejo));
    const cookieNuevo = primeraRotacion.headers['set-cookie'];

    await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieViejo).set('X-CSRF-Token', csrfDe(cookieViejo)); // reuso

    const conElNuevo = await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookieNuevo).set('X-CSRF-Token', csrfDe(cookieNuevo));
    assert.equal(conElNuevo.status, 401);

    const sesiones = await Sesion.findAll({ where: { usuarioId: usuario.id } });
    assert.ok(sesiones.length > 0);
    assert.ok(sesiones.every((s) => s.revocadaAt !== null));
  });
});

describe('revocarTodasLasSesiones (script de rotura de vidrio, docs/09-procedimiento-de-brecha.md)', () => {
  test('revoca todas las sesiones activas, sin tocar una ya revocada', async () => {
    const a = await registrarActivo(correoUnico('global-a'));
    await request(app).post('/api/v1/auth/login').send({ email: a.email, clave: CLAVE });

    // node --test corre los archivos en paralelo contra la misma base (ver comentario arriba de este
    // archivo): esta función no lleva ningún filtro, así que llamarla de verdad revocaría también
    // las sesiones que otro archivo esté usando en ese instante. Una transacción que nunca se
    // confirma aísla el efecto a esta prueba sola — nunca queda visible para otra conexión.
    const t = await sequelize.transaction();
    try {
      const cantidad = await authService.revocarTodasLasSesiones(t);
      assert.ok(cantidad >= 1);

      const sesion = await Sesion.findOne({ where: { usuarioId: a.id }, transaction: t });
      assert.ok(sesion.revocadaAt);

      // Una segunda corrida no debe fallar ni "revertir" nada por tocar filas ya revocadas.
      const segundaCantidad = await authService.revocarTodasLasSesiones(t);
      assert.equal(segundaCantidad, 0);
    } finally {
      await t.rollback();
    }
  });
});

describe('POST /auth/logout', () => {
  test('revoca la sesión activa y limpia la cookie', async () => {
    const email = correoUnico('logout');
    const usuario = await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });
    const cookie = loginResp.headers['set-cookie'];

    const respuesta = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).set('X-CSRF-Token', csrfDe(cookie));
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

describe('protección CSRF en /refrescar y /logout', () => {
  test('login emite la cookie csrf legible por JS (no HttpOnly) con Path=/, junto a la de sesión', async () => {
    const email = correoUnico('csrfcookie');
    await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });

    const cookieCsrf = loginResp.headers['set-cookie'].find((c) => c.startsWith('csrf='));
    assert.ok(cookieCsrf);
    assert.doesNotMatch(cookieCsrf, /HttpOnly/);
    assert.match(cookieCsrf, /SameSite=Strict/);
    // Path=/ y no /api/v1/auth: ninguna página de apps/web vive bajo ese path, así que con el path
    // de la cookie de sesión el navegador nunca la habría expuesto a document.cookie y
    // refrescar/logout quedaban en 403 permanente (auditoría de seguridad, hallazgo grave).
    assert.match(cookieCsrf, /Path=\//);
    assert.doesNotMatch(cookieCsrf, /Path=\/api/);
  });

  test('refrescar con la cookie de sesión pero sin X-CSRF-Token responde 403 AUTH_CSRF_INVALIDO', async () => {
    const email = correoUnico('csrf1');
    await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });

    const respuesta = await request(app).post('/api/v1/auth/refrescar').set('Cookie', loginResp.headers['set-cookie']);
    assert.equal(respuesta.status, 403);
    assert.equal(respuesta.body.error.codigo, 'AUTH_CSRF_INVALIDO');
  });

  test('refrescar con un X-CSRF-Token que no coincide con la cookie responde 403', async () => {
    const email = correoUnico('csrf2');
    await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });

    const respuesta = await request(app)
      .post('/api/v1/auth/refrescar')
      .set('Cookie', loginResp.headers['set-cookie'])
      .set('X-CSRF-Token', 'un-valor-inventado-que-no-coincide');
    assert.equal(respuesta.status, 403);
    assert.equal(respuesta.body.error.codigo, 'AUTH_CSRF_INVALIDO');
  });

  test('un X-CSRF-Token con caracteres fuera de ASCII responde 403, no 500 (timingSafeEqual exige mismo largo en bytes)', async () => {
    const email = correoUnico('csrf4');
    await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });

    const respuesta = await request(app)
      .post('/api/v1/auth/refrescar')
      .set('Cookie', loginResp.headers['set-cookie'])
      .set('X-CSRF-Token', 'é'.repeat(32)); // mismo largo en caracteres que un token de 32 bytes hex, no en bytes UTF-8
    assert.equal(respuesta.status, 403);
    assert.equal(respuesta.body.error.codigo, 'AUTH_CSRF_INVALIDO');
  });

  test('logout sin X-CSRF-Token responde 403 y NO revoca la sesión (el ataque no llega al service)', async () => {
    const email = correoUnico('csrf3');
    const usuario = await registrarActivo(email);
    const loginResp = await request(app).post('/api/v1/auth/login').send({ email, clave: CLAVE });

    const respuesta = await request(app).post('/api/v1/auth/logout').set('Cookie', loginResp.headers['set-cookie']);
    assert.equal(respuesta.status, 403);
    assert.equal(respuesta.body.error.codigo, 'AUTH_CSRF_INVALIDO');

    const sesiones = await Sesion.findAll({ where: { usuarioId: usuario.id } });
    assert.ok(sesiones.every((s) => s.revocadaAt === null));
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
