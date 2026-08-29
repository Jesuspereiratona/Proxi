const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Empresa, Oferta, OfertaEvento } = require('../src/models');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');
const ofertasService = require('../src/services/ofertas/ofertas.service');

const DOMINIO_PRUEBA = 'ofertas.uahurtado.test';
let contador = 0;
const correoUnico = (prefijo) => `${prefijo}.${Date.now()}.${contador++}@${DOMINIO_PRUEBA}`;
const CLAVE = 'claveDePrueba123456';

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
  const passwordHash = await passwords.hashear(CLAVE);
  const usuario = await Usuario.create({ email, passwordHash, rol, estado: 'activo', emailVerificadoAt: new Date() });
  const accessToken = tokensService.firmarAcceso({ sub: String(usuario.id), rol });
  return { usuario, accessToken };
};

const crearEmpresaValidada = async () => {
  const empresa = await crearUsuarioActivo('empresa');
  const coordinacion = await crearUsuarioActivo('coordinacion');
  const perfil = await Empresa.create({
    usuarioId: empresa.usuario.id,
    razonSocial: 'Empresa de prueba',
    rutEmpresa: generarRutValido().replace(/[.\-]/g, ''),
    contactoNombre: 'Contacto',
    contactoCargo: 'RR.HH.',
    estadoValidacion: 'validada',
    validadaPorUsuarioId: coordinacion.usuario.id,
    validadaAt: new Date(),
  });
  return { ...empresa, empresaId: perfil.id, coordinacion };
};

const datosOferta = (overrides = {}) => ({
  titulo: 'Práctica de prueba',
  descripcion: 'Descripción de prueba',
  requisitos: 'Requisitos de prueba',
  area: 'contabilidad',
  modalidad: 'remota',
  jornada: 'completa',
  remunerada: false,
  fechaCierre: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

after(async () => {
  const { Op } = require('sequelize');
  await Usuario.destroy({ where: { email: { [Op.like]: `%@${DOMINIO_PRUEBA}` } } });
  await sequelize.close();
});

describe('creación y envío a revisión', () => {
  test('un borrador sin fecha_cierre responde 422 OFERTA_SIN_FECHA_CIERRE al enviarlo a revisión', async () => {
    const empresa = await crearEmpresaValidada();
    const sinFecha = datosOferta();
    delete sinFecha.fechaCierre;
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(sinFecha);
    assert.equal(creada.status, 201);
    assert.equal(creada.body.fechaCierre, null);

    const envio = await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(envio.status, 422);
    assert.equal(envio.body.error.codigo, 'OFERTA_SIN_FECHA_CIERRE');
  });

  test('una fecha de cierre pasada responde 422 OFERTA_FECHA_CIERRE_INVALIDA al enviar a revisión', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app)
      .post('/api/v1/ofertas')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send(datosOferta({ fechaCierre: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }));

    const envio = await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(envio.status, 422);
    assert.equal(envio.body.error.codigo, 'OFERTA_FECHA_CIERRE_INVALIDA');
  });

  test('una empresa pendiente responde 422 EMPRESA_NO_VALIDADA al enviar a revisión', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    await Empresa.create({
      usuarioId: empresa.usuario.id,
      razonSocial: 'Empresa pendiente',
      rutEmpresa: generarRutValido().replace(/[.\-]/g, ''),
      contactoNombre: 'x',
      contactoCargo: 'x',
      estadoValidacion: 'pendiente',
    });

    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    const envio = await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);

    assert.equal(envio.status, 422);
    assert.equal(envio.body.error.codigo, 'EMPRESA_NO_VALIDADA');
  });

  test('una empresa con un cierre sin declarar de más de 7 días responde 422 EMPRESA_CIERRES_PENDIENTES', async () => {
    const empresa = await crearEmpresaValidada();
    await Oferta.create({
      empresaId: empresa.empresaId,
      titulo: 'Vieja', descripcion: 'd', requisitos: 'r', area: 'x', modalidad: 'remota', jornada: 'completa',
      remunerada: false, estado: 'cerrada', motivoCierre: 'vencida', resultadoDeclarado: false,
      fechaCierre: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      cerradaAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    const envio = await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);

    assert.equal(envio.status, 422);
    assert.equal(envio.body.error.codigo, 'EMPRESA_CIERRES_PENDIENTES');
  });
});

describe('aprobación y publicación', () => {
  test('coordinación aprueba una oferta en_revision: queda publicada con fecha_publicacion y evento', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);

    const aprobada = await request(app)
      .post(`/api/v1/ofertas/${creada.body.id}/aprobacion`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    assert.equal(aprobada.status, 200);
    assert.equal(aprobada.body.estado, 'publicada');
    assert.ok(aprobada.body.fechaPublicacion);

    const eventos = await OfertaEvento.findAll({ where: { ofertaId: creada.body.id } });
    assert.ok(eventos.some((e) => e.estadoAnterior === 'en_revision' && e.estadoNuevo === 'publicada'));
  });

  test('coordinación no puede aprobar la oferta de una empresa que ya no está validada', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);

    // la empresa se suspende mientras la oferta sigue en_revision
    await request(app)
      .post(`/api/v1/empresas/${empresa.empresaId}/suspension`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`)
      .send({ motivoSuspension: 'Prueba' });

    const aprobada = await request(app)
      .post(`/api/v1/ofertas/${creada.body.id}/aprobacion`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    assert.equal(aprobada.status, 422);
    assert.equal(aprobada.body.error.codigo, 'EMPRESA_NO_VALIDADA');

    // y la suspensión ya devolvió la oferta a borrador, así que tampoco queda "en_revision" colgada
    const oferta = await Oferta.findByPk(creada.body.id);
    assert.equal(oferta.estado, 'borrador');
  });
});

describe('editar contenido de una oferta en revisión o publicada la manda de vuelta a borrador', () => {
  test('editar el título de una oferta en_revision la devuelve a borrador', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);

    const edicion = await request(app)
      .patch(`/api/v1/ofertas/${creada.body.id}`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ titulo: 'Título corregido' });

    assert.equal(edicion.status, 200);
    assert.equal(edicion.body.estado, 'borrador');
    assert.equal(edicion.body.titulo, 'Título corregido');
  });

  test('editar el título de una oferta publicada la devuelve a borrador (deja de verse en el listado público)', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta({ area: 'area-edicion-unica' }));
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    const edicion = await request(app)
      .patch(`/api/v1/ofertas/${creada.body.id}`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ descripcion: 'Descripción reescrita' });
    assert.equal(edicion.body.estado, 'borrador');

    const listado = await request(app).get('/api/v1/ofertas').query({ area: 'area-edicion-unica' });
    assert.equal(listado.body.ofertas.length, 0);
  });

  test('editar solo la fecha de cierre (no es contenido) de una oferta publicada no cambia el estado', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    const nuevaFecha = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const edicion = await request(app)
      .patch(`/api/v1/ofertas/${creada.body.id}`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ fechaCierre: nuevaFecha });

    assert.equal(edicion.status, 200);
    assert.equal(edicion.body.estado, 'publicada');
  });
});

describe('cierre', () => {
  test('cerrar sin motivo responde 422', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    const cierre = await request(app).post(`/api/v1/ofertas/${creada.body.id}/cierre`).set('Authorization', `Bearer ${empresa.accessToken}`).send({});
    assert.equal(cierre.status, 422);
  });

  test('cerrar con motivo contratado deja resultado_declarado en true', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    const cierre = await request(app)
      .post(`/api/v1/ofertas/${creada.body.id}/cierre`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ motivoCierre: 'contratado' });

    assert.equal(cierre.status, 200);
    assert.equal(cierre.body.estado, 'cerrada');
    assert.equal(cierre.body.resultadoDeclarado, true);
  });

  test('una oferta cerrada no puede volver a publicarse: 409 OFERTA_TRANSICION_INVALIDA', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);
    await request(app)
      .post(`/api/v1/ofertas/${creada.body.id}/cierre`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ motivoCierre: 'contratado' });

    const reintento = await request(app)
      .post(`/api/v1/ofertas/${creada.body.id}/aprobacion`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    assert.equal(reintento.status, 409);
    assert.equal(reintento.body.error.codigo, 'OFERTA_TRANSICION_INVALIDA');
  });

  test('una empresa B no puede enviar a revisión ni cerrar una oferta de la empresa A', async () => {
    const empresaA = await crearEmpresaValidada();
    const empresaB = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresaA.accessToken}`).send(datosOferta());

    const revision = await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresaB.accessToken}`);
    assert.equal(revision.status, 404);

    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresaA.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresaA.coordinacion.accessToken}`);

    const cierre = await request(app)
      .post(`/api/v1/ofertas/${creada.body.id}/cierre`)
      .set('Authorization', `Bearer ${empresaB.accessToken}`)
      .send({ motivoCierre: 'contratado' });
    assert.equal(cierre.status, 404);
  });

  test('declarar el resultado de una oferta que el sistema ya cerró por vencimiento no cambia cerradaAt', async () => {
    const empresa = await crearEmpresaValidada();
    const oferta = await Oferta.create({
      empresaId: empresa.empresaId,
      titulo: 'Vencida', descripcion: 'd', requisitos: 'r', area: 'x', modalidad: 'remota', jornada: 'completa',
      remunerada: false, estado: 'cerrada', motivoCierre: 'vencida', resultadoDeclarado: false,
      fechaCierre: new Date(Date.now() - 24 * 60 * 60 * 1000), cerradaAt: new Date('2026-01-01T00:00:00Z'),
    });

    const declaracion = await request(app)
      .post(`/api/v1/ofertas/${oferta.id}/cierre`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ motivoCierre: 'sin_candidatos' });

    assert.equal(declaracion.status, 200);
    assert.equal(declaracion.body.estado, 'cerrada');
    assert.equal(declaracion.body.resultadoDeclarado, true);
    assert.equal(declaracion.body.motivoCierre, 'sin_candidatos');
    assert.equal(new Date(declaracion.body.cerradaAt).toISOString(), '2026-01-01T00:00:00.000Z');

    const segundaDeclaracion = await request(app)
      .post(`/api/v1/ofertas/${oferta.id}/cierre`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ motivoCierre: 'contratado' });
    assert.equal(segundaDeclaracion.status, 409);
  });
});

describe('condición de carrera entre dos transiciones simultáneas', () => {
  test('si la oferta ya cambió de estado, la segunda transición responde 409 en vez de pisar la primera', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    // dos cierres "simultáneos": el primero gana, el segundo debe encontrar que el estado ya cambió.
    const [primero, segundo] = await Promise.all([
      request(app).post(`/api/v1/ofertas/${creada.body.id}/cierre`).set('Authorization', `Bearer ${empresa.accessToken}`).send({ motivoCierre: 'contratado' }),
      request(app).post(`/api/v1/ofertas/${creada.body.id}/cierre`).set('Authorization', `Bearer ${empresa.accessToken}`).send({ motivoCierre: 'cancelada' }),
    ]);

    const estados = [primero.status, segundo.status].sort();
    assert.deepEqual(estados, [200, 409]);

    const eventos = await OfertaEvento.findAll({ where: { ofertaId: creada.body.id, estadoNuevo: 'cerrada' } });
    assert.equal(eventos.length, 1);
  });
});

describe('tarea cerrarOfertasVencidas', () => {
  test('cierra una oferta publicada vencida y es idempotente', async () => {
    const empresa = await crearEmpresaValidada();
    const oferta = await Oferta.create({
      empresaId: empresa.empresaId,
      titulo: 'Vence pronto', descripcion: 'd', requisitos: 'r', area: 'x', modalidad: 'remota', jornada: 'completa',
      remunerada: false, estado: 'publicada', fechaPublicacion: new Date(), fechaCierre: new Date(Date.now() + 1000),
    });

    const ahora = new Date(Date.now() + 2000);
    const primera = await ofertasService.cerrarVencidas(ahora);
    const segunda = await ofertasService.cerrarVencidas(ahora);

    assert.ok(primera.cerradas >= 1);
    assert.equal(primera.fallidas, 0);
    assert.equal(segunda.cerradas, 0);

    await oferta.reload();
    assert.equal(oferta.estado, 'cerrada');
    assert.equal(oferta.motivoCierre, 'vencida');
    assert.equal(oferta.resultadoDeclarado, false);
  });
});

describe('suspensión de empresa cierra sus ofertas publicadas', () => {
  test('suspender una empresa cierra sus ofertas publicadas con motivo cancelada', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    const suspension = await request(app)
      .post(`/api/v1/empresas/${empresa.empresaId}/suspension`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`)
      .send({ motivoSuspension: 'Prueba' });
    assert.equal(suspension.status, 200);

    const oferta = await Oferta.findByPk(creada.body.id);
    assert.equal(oferta.estado, 'cerrada');
    assert.equal(oferta.motivoCierre, 'cancelada');
    assert.equal(oferta.resultadoDeclarado, false);
  });
});

describe('acceso cruzado entre empresas', () => {
  test('la empresa B no puede consultar ni editar una oferta de la empresa A', async () => {
    const empresaA = await crearEmpresaValidada();
    const empresaB = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresaA.accessToken}`).send(datosOferta());

    const consulta = await request(app)
      .get(`/api/v1/ofertas/${creada.body.id}`)
      .set('Authorization', `Bearer ${empresaB.accessToken}`);
    const edicion = await request(app)
      .patch(`/api/v1/ofertas/${creada.body.id}`)
      .set('Authorization', `Bearer ${empresaB.accessToken}`)
      .send({ titulo: 'Intento de edición ajena' });

    assert.equal(consulta.status, 404);
    assert.equal(edicion.status, 404);

    const oferta = await Oferta.findByPk(creada.body.id);
    assert.equal(oferta.titulo, 'Práctica de prueba');
  });

  test('un visitante anónimo o un estudiante no ven una oferta en_revision ajena', async () => {
    const empresa = await crearEmpresaValidada();
    const estudiante = await crearUsuarioActivo('estudiante');
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);

    const anonimo = await request(app).get(`/api/v1/ofertas/${creada.body.id}`);
    const comoEstudiante = await request(app).get(`/api/v1/ofertas/${creada.body.id}`).set('Authorization', `Bearer ${estudiante.accessToken}`);

    assert.equal(anonimo.status, 404);
    assert.equal(comoEstudiante.status, 404);
  });

  test('un token con la firma alterada se trata como visitante anónimo, no rompe la petición', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);

    const respuesta = await request(app)
      .get(`/api/v1/ofertas/${creada.body.id}`)
      .set('Authorization', `Bearer ${empresa.accessToken}x`);

    assert.equal(respuesta.status, 404);
  });
});

describe('listado público', () => {
  test('solo devuelve ofertas publicadas con fecha de cierre futura', async () => {
    const empresa = await crearEmpresaValidada();

    const publicada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta({ area: 'area-publica-unica' }));
    await request(app).post(`/api/v1/ofertas/${publicada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${publicada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    // esta se queda en borrador, nunca debería aparecer en el listado público
    await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta({ area: 'area-publica-unica' }));

    const listado = await request(app).get('/api/v1/ofertas').query({ area: 'area-publica-unica' });
    assert.equal(listado.status, 200);
    assert.equal(listado.body.ofertas.length, 1);
    assert.equal(listado.body.ofertas[0].estado, 'publicada');
  });

  test('el listado y el detalle incluyen la razón social de la empresa (Fase 6, vitrina)', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    const detalle = await request(app).get(`/api/v1/ofertas/${creada.body.id}`);
    assert.equal(detalle.body.Empresa.razonSocial, 'Empresa de prueba');

    const listado = await request(app).get('/api/v1/ofertas');
    const fila = listado.body.ofertas.find((o) => o.id === creada.body.id);
    assert.equal(fila.Empresa.razonSocial, 'Empresa de prueba');
  });
});

describe('rastro de auditoría en oferta_eventos', () => {
  test('cada transición ejecutada deja una fila con estado anterior, nuevo y actor', async () => {
    const empresa = await crearEmpresaValidada();
    const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    const eventos = await OfertaEvento.findAll({ where: { ofertaId: creada.body.id }, order: [['id', 'ASC']] });
    assert.equal(eventos.length, 2);
    assert.equal(eventos[0].estadoAnterior, 'borrador');
    assert.equal(eventos[0].estadoNuevo, 'en_revision');
    assert.equal(String(eventos[0].actorUsuarioId), String(empresa.usuario.id));
    assert.equal(eventos[1].estadoAnterior, 'en_revision');
    assert.equal(eventos[1].estadoNuevo, 'publicada');
    assert.equal(String(eventos[1].actorUsuarioId), String(empresa.coordinacion.usuario.id));
  });
});
