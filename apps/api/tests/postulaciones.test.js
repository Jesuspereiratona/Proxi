const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Estudiante, Empresa, Postulacion, PostulacionEvento, AuditoriaAcceso, Archivo } = require('../src/models');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');
const archivosService = require('../src/services/archivos/archivos.service');
const postulacionesService = require('../src/services/postulaciones/postulaciones.service');
const env = require('../src/config/env');

// Dominio propio: node --test corre los archivos en paralelo contra la misma base (ver
// ofertas.test.js), así que cada archivo necesita el suyo.
const DOMINIO_PRUEBA = 'postulaciones.uahurtado.test';
let contador = 0;
const correoUnico = (prefijo) => `${prefijo}.${Date.now()}.${contador++}@${DOMINIO_PRUEBA}`;

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

// Crea, envía a revisión y aprueba: deja la oferta lista para recibir postulaciones.
const crearOfertaPublicada = async (empresa, overrides = {}) => {
  const creada = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta(overrides));
  await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
  await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);
  return creada.body;
};

// Firma real de un PDF: basta para pasar la validación de número mágico de archivos.service.js.
const PDF_VALIDO = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('contenido de prueba')]);
const NO_ES_PDF = Buffer.from('esto no es un pdf, aunque se llame cv.pdf');

const archivosSubidosEnDisco = [];

const crearEstudianteConCv = async () => {
  const estudianteUsuario = await crearUsuarioActivo('estudiante');
  const perfil = await Estudiante.create({
    usuarioId: estudianteUsuario.usuario.id,
    nombres: 'Ana',
    apellidos: 'Prueba',
    carrera: 'Contador Auditor',
    nivel: 5,
  });
  const archivo = await archivosService.subirCv(estudianteUsuario.usuario.id, { buffer: PDF_VALIDO, originalname: 'cv.pdf' });
  archivosSubidosEnDisco.push(archivo.nombreAlmacenado);
  return { ...estudianteUsuario, estudianteId: perfil.id, archivoId: archivo.id };
};

after(async () => {
  const { Op } = require('sequelize');
  await Usuario.destroy({ where: { email: { [Op.like]: `%@${DOMINIO_PRUEBA}` } } });
  await Promise.all(
    archivosSubidosEnDisco.map((nombre) => fs.unlink(path.join(env.uploadDir, nombre)).catch(() => {})),
  );
  await sequelize.close();
});

describe('postular', () => {
  test('un estudiante sin CV recibe 422 POSTULACION_SIN_CV', async () => {
    const estudiante = await crearUsuarioActivo('estudiante');
    await Estudiante.create({ usuarioId: estudiante.usuario.id, nombres: 'Sin', apellidos: 'CV', carrera: 'Ingeniería' });
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);

    const respuesta = await request(app)
      .post('/api/v1/postulaciones')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ ofertaId: oferta.id });

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'POSTULACION_SIN_CV');
  });

  test('un estudiante con CV postula a una oferta vigente: queda recibida con el CV actual congelado', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);

    const respuesta = await request(app)
      .post('/api/v1/postulaciones')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ ofertaId: oferta.id, mensaje: 'Muy interesado' });

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.estado, 'recibida');
    assert.equal(respuesta.body.cvArchivoId, estudiante.archivoId);

    const eventos = await PostulacionEvento.findAll({ where: { postulacionId: respuesta.body.id } });
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].estadoNuevo, 'recibida');
  });

  test('GET /postulaciones/mias incluye la oferta y la empresa (Fase 6, panel de estudiante)', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    const mias = await request(app).get('/api/v1/postulaciones/mias').set('Authorization', `Bearer ${estudiante.accessToken}`);
    assert.equal(mias.status, 200);
    assert.equal(mias.body.length, 1);
    assert.equal(mias.body[0].Oferta.titulo, oferta.titulo);
    assert.equal(mias.body[0].Oferta.Empresa.razonSocial, 'Empresa de prueba');
  });

  test('postular dos veces a la misma oferta responde 409 POSTULACION_YA_EXISTE', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);

    await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });
    const segunda = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    assert.equal(segunda.status, 409);
    assert.equal(segunda.body.error.codigo, 'POSTULACION_YA_EXISTE');
  });

  test('dos postulaciones simultáneas a la misma oferta: solo una crea fila', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);

    const [primera, segunda] = await Promise.all([
      request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id }),
      request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id }),
    ]);

    const estados = [primera.status, segunda.status].sort();
    assert.deepEqual(estados, [201, 409]);

    const filas = await Postulacion.findAll({ where: { ofertaId: oferta.id, estudianteId: estudiante.estudianteId } });
    assert.equal(filas.length, 1);
  });

  test('postular a una oferta vencida o no publicada responde 422 OFERTA_NO_VIGENTE', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const borrador = await request(app).post('/api/v1/ofertas').set('Authorization', `Bearer ${empresa.accessToken}`).send(datosOferta());

    const respuesta = await request(app)
      .post('/api/v1/postulaciones')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ ofertaId: borrador.body.id });

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'OFERTA_NO_VIGENTE');
  });

  test('reemplazar el CV no cambia el CV de una postulación ya enviada', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);

    const postulacion = await request(app)
      .post('/api/v1/postulaciones')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ ofertaId: oferta.id });
    const cvOriginal = postulacion.body.cvArchivoId;

    const nuevoArchivo = await archivosService.subirCv(estudiante.usuario.id, { buffer: PDF_VALIDO, originalname: 'cv-actualizado.pdf' });
    archivosSubidosEnDisco.push(nuevoArchivo.nombreAlmacenado);
    assert.notEqual(nuevoArchivo.id, cvOriginal);

    const detalle = await request(app)
      .get(`/api/v1/postulaciones/${postulacion.body.id}`)
      .set('Authorization', `Bearer ${estudiante.accessToken}`);
    assert.equal(detalle.body.cvArchivoId, cvOriginal);
  });
});

describe('proceso de selección (empresa)', () => {
  test('la empresa avanza revisión, entrevista y selección, con evento en cada paso', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });
    const id = postulacion.body.id;

    const revision = await request(app).post(`/api/v1/postulaciones/${id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(revision.status, 200);
    assert.equal(revision.body.estado, 'en_revision');

    const entrevista = await request(app).post(`/api/v1/postulaciones/${id}/entrevista`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(entrevista.body.estado, 'entrevista');

    const seleccion = await request(app).post(`/api/v1/postulaciones/${id}/seleccion`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(seleccion.status, 200);
    assert.equal(seleccion.body.estado, 'seleccionada');
    assert.equal(seleccion.body.respondidaPorEmpresa, true);

    const eventos = await PostulacionEvento.findAll({ where: { postulacionId: id }, order: [['id', 'ASC']] });
    assert.deepEqual(
      eventos.map((e) => e.estadoNuevo),
      ['recibida', 'en_revision', 'entrevista', 'seleccionada'],
    );
  });

  test('la empresa puede rechazar directamente desde recibida, con motivo opcional', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    const rechazo = await request(app)
      .post(`/api/v1/postulaciones/${postulacion.body.id}/rechazo`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ motivo: 'No cumple el perfil buscado' });

    assert.equal(rechazo.status, 200);
    assert.equal(rechazo.body.estado, 'no_seleccionada');
  });

  test('el detalle de una postulación incluye la línea de tiempo de eventos en orden (Fase 6, panel de estudiante)', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });
    const id = postulacion.body.id;
    await request(app).post(`/api/v1/postulaciones/${id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    await request(app).post(`/api/v1/postulaciones/${id}/entrevista`).set('Authorization', `Bearer ${empresa.accessToken}`);

    // actorUsuarioId nunca viaja, ni al estudiante ni a la empresa (id interno sin uso en la
    // interfaz). motivo tampoco al estudiante (auditoría del panel de estudiante) — pero sí a la
    // propia empresa, es su propia nota (auditoría del panel de empresa, Fase 6 parte 4).
    const clavesPorRol = { estudiante: ['createdAt', 'estadoAnterior', 'estadoNuevo'], empresa: ['createdAt', 'estadoAnterior', 'estadoNuevo', 'motivo'] };
    for (const [rol, token] of [['estudiante', estudiante.accessToken], ['empresa', empresa.accessToken]]) {
      const detalle = await request(app).get(`/api/v1/postulaciones/${id}`).set('Authorization', `Bearer ${token}`);
      assert.equal(detalle.status, 200);
      assert.deepEqual(
        detalle.body.PostulacionEventos.map((e) => e.estadoNuevo),
        ['recibida', 'en_revision', 'entrevista'],
      );
      for (const evento of detalle.body.PostulacionEventos) {
        assert.deepEqual(Object.keys(evento).sort(), clavesPorRol[rol]);
      }
    }
  });

  test('el motivo de un rechazo no se filtra al estudiante por la línea de tiempo, pero sí lo ve la propia empresa (Fase 6, panel de empresa)', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });
    await request(app)
      .post(`/api/v1/postulaciones/${postulacion.body.id}/rechazo`)
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ motivo: 'Nota interna: no contratar, mala actitud en la entrevista' });

    const detalleEstudiante = await request(app).get(`/api/v1/postulaciones/${postulacion.body.id}`).set('Authorization', `Bearer ${estudiante.accessToken}`);
    const cuerpoCrudo = JSON.stringify(detalleEstudiante.body);
    assert.ok(!cuerpoCrudo.includes('mala actitud'), 'el motivo del rechazo no debe llegar al estudiante');

    const detalleEmpresa = await request(app).get(`/api/v1/postulaciones/${postulacion.body.id}`).set('Authorization', `Bearer ${empresa.accessToken}`);
    const eventoRechazo = detalleEmpresa.body.PostulacionEventos.find((e) => e.estadoNuevo === 'no_seleccionada');
    assert.equal(eventoRechazo.motivo, 'Nota interna: no contratar, mala actitud en la entrevista');
    assert.equal(eventoRechazo.actorUsuarioId, undefined, 'actorUsuarioId sigue afuera incluso para la propia empresa');
  });

  test('una empresa B no puede mover una postulación de una oferta de la empresa A: 404', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresaA = await crearEmpresaValidada();
    const empresaB = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresaA);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    const intento = await request(app)
      .post(`/api/v1/postulaciones/${postulacion.body.id}/revision`)
      .set('Authorization', `Bearer ${empresaB.accessToken}`);
    assert.equal(intento.status, 404);

    const listado = await request(app)
      .get(`/api/v1/postulaciones/oferta/${oferta.id}`)
      .set('Authorization', `Bearer ${empresaB.accessToken}`);
    assert.equal(listado.status, 404);
  });

  test('la lista de postulantes de una oferta trae nombre y carrera, sin RUT ni teléfono (Fase 6, panel de empresa)', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    const listado = await request(app).get(`/api/v1/postulaciones/oferta/${oferta.id}`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(listado.status, 200);
    assert.equal(listado.body.length, 1);
    assert.deepEqual(listado.body[0].Estudiante, { nombres: 'Ana', apellidos: 'Prueba', carrera: 'Contador Auditor' });
    const cuerpoCrudo = JSON.stringify(listado.body);
    assert.ok(!cuerpoCrudo.includes('rut'), 'ningún RUT (cifrado o últimos 4) debe llegar a la lista de postulantes');
  });

  test('ver la lista de postulantes de una oferta deja rastro en auditoria_accesos (auditoría del panel de empresa)', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    await request(app).get(`/api/v1/postulaciones/oferta/${oferta.id}`).set('Authorization', `Bearer ${empresa.accessToken}`);

    const auditoria = await AuditoriaAcceso.findAll({ where: { usuarioId: empresa.usuario.id, accion: 'ver_postulantes', entidadId: oferta.id } });
    assert.equal(auditoria.length, 1);
  });

  test('mover una postulación desde un estado terminal responde 409 POSTULACION_TRANSICION_INVALIDA', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });
    await request(app).post(`/api/v1/postulaciones/${postulacion.body.id}/rechazo`).set('Authorization', `Bearer ${empresa.accessToken}`).send({});

    const reintento = await request(app).post(`/api/v1/postulaciones/${postulacion.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(reintento.status, 409);
    assert.equal(reintento.body.error.codigo, 'POSTULACION_TRANSICION_INVALIDA');
  });
});

describe('retiro (estudiante)', () => {
  test('el estudiante retira su postulación en curso', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    const retiro = await request(app)
      .post(`/api/v1/postulaciones/${postulacion.body.id}/retiro`)
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ motivo: 'Ya no me interesa' });

    assert.equal(retiro.status, 200);
    assert.equal(retiro.body.estado, 'retirada');
  });

  test('un estudiante no puede retirar la postulación de otro: 404', async () => {
    const estudianteA = await crearEstudianteConCv();
    const estudianteB = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudianteA.accessToken}`).send({ ofertaId: oferta.id });

    const intento = await request(app)
      .post(`/api/v1/postulaciones/${postulacion.body.id}/retiro`)
      .set('Authorization', `Bearer ${estudianteB.accessToken}`)
      .send({});
    assert.equal(intento.status, 404);
  });
});

describe('acceso cruzado al detalle', () => {
  test('un estudiante no puede ver la postulación de otro estudiante: 404', async () => {
    const estudianteA = await crearEstudianteConCv();
    const estudianteB = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudianteA.accessToken}`).send({ ofertaId: oferta.id });

    const intento = await request(app)
      .get(`/api/v1/postulaciones/${postulacion.body.id}`)
      .set('Authorization', `Bearer ${estudianteB.accessToken}`);
    assert.equal(intento.status, 404);
  });

  test('una empresa no puede ver el detalle de una postulación de una oferta ajena: 404', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresaA = await crearEmpresaValidada();
    const empresaB = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresaA);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    const intento = await request(app)
      .get(`/api/v1/postulaciones/${postulacion.body.id}`)
      .set('Authorization', `Bearer ${empresaB.accessToken}`);
    assert.equal(intento.status, 404);
  });
});

describe('empresa suspendida pierde el acceso', () => {
  test('no puede listar ni mover postulaciones de sus ofertas', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    await request(app)
      .post(`/api/v1/empresas/${empresa.empresaId}/suspension`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`)
      .send({ motivoSuspension: 'Prueba' });

    const listado = await request(app).get(`/api/v1/postulaciones/oferta/${oferta.id}`).set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(listado.status, 422);
    assert.equal(listado.body.error.codigo, 'EMPRESA_NO_VALIDADA');

    const transicion = await request(app)
      .post(`/api/v1/postulaciones/${postulacion.body.id}/revision`)
      .set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(transicion.status, 422);
    assert.equal(transicion.body.error.codigo, 'EMPRESA_NO_VALIDADA');
  });

  test('no puede descargar un CV que antes de suspenderse sí podía', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    await request(app)
      .post(`/api/v1/empresas/${empresa.empresaId}/suspension`)
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`)
      .send({ motivoSuspension: 'Prueba' });

    const descarga = await request(app)
      .get(`/api/v1/archivos/${estudiante.archivoId}/descarga`)
      .set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(descarga.status, 404);
  });
});

describe('tarea marcarSinRespuesta', () => {
  test('marca sin_respuesta una postulación sin movimiento dentro del SLA, y es idempotente', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    await Postulacion.update(
      { estadoActualizadoAt: new Date(Date.now() - (env.slaRespuestaDias + 1) * 24 * 60 * 60 * 1000) },
      { where: { id: postulacion.body.id } },
    );

    const primera = await postulacionesService.marcarSinRespuesta();
    const segunda = await postulacionesService.marcarSinRespuesta();

    assert.ok(primera.marcadas >= 1);
    assert.equal(primera.fallidas, 0);
    assert.equal(segunda.marcadas, 0);

    const fila = await Postulacion.findByPk(postulacion.body.id);
    assert.equal(fila.estado, 'sin_respuesta');
    assert.equal(fila.respondidaPorEmpresa, false);
  });
});

describe('subida de CV', () => {
  test('un PDF real se acepta', async () => {
    const estudiante = await crearUsuarioActivo('estudiante');
    await Estudiante.create({ usuarioId: estudiante.usuario.id, nombres: 'Con', apellidos: 'Pdf', carrera: 'Ingeniería' });

    const respuesta = await request(app)
      .post('/api/v1/estudiantes/mi-cv')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .attach('cv', PDF_VALIDO, { filename: 'cv.pdf', contentType: 'application/pdf' });

    assert.equal(respuesta.status, 201);
    // Lista blanca en la respuesta (auditoría del panel de estudiante): nombreAlmacenado es el
    // UUID interno en disco, el cliente no lo necesita.
    assert.deepEqual(Object.keys(respuesta.body).sort(), ['id', 'nombreOriginal', 'tamanoBytes']);
    assert.equal(respuesta.body.nombreOriginal, 'cv.pdf');

    const archivo = await Archivo.findByPk(respuesta.body.id);
    archivosSubidosEnDisco.push(archivo.nombreAlmacenado);
  });

  test('un archivo que no es un PDF real se rechaza aunque diga serlo', async () => {
    const estudiante = await crearUsuarioActivo('estudiante');
    await Estudiante.create({ usuarioId: estudiante.usuario.id, nombres: 'Sin', apellidos: 'PdfReal', carrera: 'Ingeniería' });

    const respuesta = await request(app)
      .post('/api/v1/estudiantes/mi-cv')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .attach('cv', NO_ES_PDF, { filename: 'cv.pdf', contentType: 'application/pdf' });

    assert.equal(respuesta.status, 422);
    assert.equal(respuesta.body.error.codigo, 'ARCHIVO_INVALIDO');
  });
});

describe('descarga de CV', () => {
  test('el estudiante descarga su propio CV y queda en auditoria_accesos', async () => {
    const estudiante = await crearEstudianteConCv();

    const descarga = await request(app)
      .get(`/api/v1/archivos/${estudiante.archivoId}/descarga`)
      .set('Authorization', `Bearer ${estudiante.accessToken}`);

    assert.equal(descarga.status, 200);
    assert.ok(descarga.headers['content-disposition'].includes('cv.pdf'));

    const auditoria = await AuditoriaAcceso.findAll({ where: { usuarioId: estudiante.usuario.id, accion: 'descargar_cv', entidadId: estudiante.archivoId } });
    assert.equal(auditoria.length, 1);
  });

  test('una empresa con una postulación real descarga el CV de ese postulante', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });

    const descarga = await request(app)
      .get(`/api/v1/archivos/${estudiante.archivoId}/descarga`)
      .set('Authorization', `Bearer ${empresa.accessToken}`);

    assert.equal(descarga.status, 200);
  });

  test('una empresa sin ninguna postulación de ese estudiante recibe 404', async () => {
    const estudiante = await crearEstudianteConCv();
    const empresa = await crearEmpresaValidada();

    const descarga = await request(app)
      .get(`/api/v1/archivos/${estudiante.archivoId}/descarga`)
      .set('Authorization', `Bearer ${empresa.accessToken}`);

    assert.equal(descarga.status, 404);
  });

  test('un estudiante no puede descargar el CV de otro estudiante: 404', async () => {
    const estudianteA = await crearEstudianteConCv();
    const estudianteB = await crearEstudianteConCv();

    const descarga = await request(app)
      .get(`/api/v1/archivos/${estudianteA.archivoId}/descarga`)
      .set('Authorization', `Bearer ${estudianteB.accessToken}`);

    assert.equal(descarga.status, 404);
  });

  test('coordinación descarga cualquier CV y queda registrado', async () => {
    const estudiante = await crearEstudianteConCv();
    const coordinacion = await crearUsuarioActivo('coordinacion');

    const descarga = await request(app)
      .get(`/api/v1/archivos/${estudiante.archivoId}/descarga`)
      .set('Authorization', `Bearer ${coordinacion.accessToken}`);

    assert.equal(descarga.status, 200);
    const auditoria = await AuditoriaAcceso.findAll({ where: { usuarioId: coordinacion.usuario.id, accion: 'descargar_cv', entidadId: estudiante.archivoId } });
    assert.equal(auditoria.length, 1);
  });
});
