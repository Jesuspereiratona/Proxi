const { test, describe, after, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Empresa, Oferta, Postulacion, Estudiante, Archivo } = require('../src/models');
const { crearUsuarioActivo, generarRutValido } = require('./ayudas');
const { borrarUsuariosDePrueba } = require('./limpiar');

// specs/14-panorama-de-coordinacion/spec.md, un criterio por prueba.
const DOMINIO_PRUEBA = 'panorama.test';
const DIA_MS = 24 * 60 * 60 * 1000;
const RUTA = '/api/v1/panorama';

let coordinacion;
let estudianteToken;
let empresaToken;
let empresaId;
let estudianteId;
let cvArchivoId;
const ofertasCreadas = [];

// Una postulación no existe sin un CV congelado: es la regla del dominio, no un detalle del modelo
// (docs/02-modelo-de-datos.md). Estas pruebas insertan directo en la base para controlar fechas y
// estados, así que tienen que respetarla a mano.
const postular = (ofertaId, estado = 'recibida') => Postulacion.create({
  ofertaId, estudianteId, estado, cvArchivoId, estadoActualizadoAt: new Date(),
});

const crearOferta = async ({ area, estado = 'publicada', diasPublicada = 30 }) => {
  const oferta = await Oferta.create({
    empresaId,
    titulo: `Oferta de ${area}`,
    descripcion: 'x',
    requisitos: 'x',
    area,
    modalidad: 'remota',
    jornada: 'parcial',
    remunerada: false,
    cupos: 2,
    estado,
    fechaCierre: new Date(Date.now() + 60 * DIA_MS),
    fechaPublicacion: estado === 'publicada' ? new Date(Date.now() - diasPublicada * DIA_MS) : null,
  });
  ofertasCreadas.push(oferta.id);
  return oferta;
};

before(async () => {
  coordinacion = await crearUsuarioActivo('coordinacion', DOMINIO_PRUEBA);
  const empresa = await crearUsuarioActivo('empresa', DOMINIO_PRUEBA);
  empresaToken = empresa.accessToken;
  const estudiante = await crearUsuarioActivo('estudiante', DOMINIO_PRUEBA);
  estudianteToken = estudiante.accessToken;

  const perfilEmpresa = await Empresa.create({
    usuarioId: empresa.usuario.id,
    razonSocial: 'Empresa del panorama',
    rutEmpresa: generarRutValido(),
    contactoNombre: 'Contacto',
    contactoCargo: 'RR.HH.',
    estadoValidacion: 'validada',
  });
  empresaId = perfilEmpresa.id;

  const perfilEstudiante = await Estudiante.create({
    usuarioId: estudiante.usuario.id, nombres: 'Ana', apellidos: 'Panorama', carrera: 'Ingeniería Comercial',
  });
  estudianteId = perfilEstudiante.id;

  const cv = await Archivo.create({
    propietarioUsuarioId: estudiante.usuario.id,
    nombreOriginal: 'cv.pdf',
    nombreAlmacenado: `panorama-${Date.now()}.pdf`,
    mime: 'application/pdf',
    tamanoBytes: 10,
    tipo: 'cv',
    contenido: Buffer.from('%PDF-1.4 prueba'),
  });
  cvArchivoId = cv.id;
});

after(async () => {
  if (ofertasCreadas.length) {
    await Postulacion.destroy({ where: { ofertaId: ofertasCreadas } });
    await Oferta.destroy({ where: { id: ofertasCreadas } });
  }
  if (cvArchivoId) await Archivo.destroy({ where: { id: cvArchivoId } });
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

const pedirPanorama = () => request(app).get(RUTA).set('Authorization', `Bearer ${coordinacion.accessToken}`);

describe('quién puede ver el panorama', () => {
  test('un estudiante no', async () => {
    const r = await request(app).get(RUTA).set('Authorization', `Bearer ${estudianteToken}`);
    assert.equal(r.status, 403);
  });

  test('una empresa tampoco: le diría cuánta competencia tiene', async () => {
    const r = await request(app).get(RUTA).set('Authorization', `Bearer ${empresaToken}`);
    assert.equal(r.status, 403);
  });

  test('sin sesión, 401', async () => {
    assert.equal((await request(app).get(RUTA)).status, 401);
  });

  test('coordinación sí', async () => {
    assert.equal((await pedirPanorama()).status, 200);
  });
});

describe('qué trae el panorama', () => {
  test('no contiene ningún dato que identifique a un estudiante', async () => {
    // El estudiante de estas pruebas se llama Ana Panorama y postula más abajo. Se cuentan
    // postulaciones, nunca se nombran postulantes (regla 2 de la spec).
    const oferta = await crearOferta({ area: 'Privacidad' });
    await postular(oferta.id);

    const cuerpo = JSON.stringify((await pedirPanorama()).body);
    for (const prohibido of ['Ana', 'Panorama', '@', 'rut', 'telefono']) {
      assert.ok(!cuerpo.includes(prohibido), `el panorama expone "${prohibido}"`);
    }
  });

  test('agrupa por área contando ofertas y postulaciones', async () => {
    const oferta = await crearOferta({ area: 'Area con postulantes' });
    await postular(oferta.id);

    const { porArea } = (await pedirPanorama()).body;
    const fila = porArea.find((a) => a.area === 'Area con postulantes');
    assert.ok(fila, 'el área no aparece');
    assert.equal(fila.ofertas, 1);
    assert.equal(fila.postulaciones, 1);
  });

  test('un área con ofertas y cero postulantes aparece igual, con 0', async () => {
    // Es justo el caso que interesa ver: un INNER JOIN la haría desaparecer.
    await crearOferta({ area: 'Area desierta' });

    const { porArea } = (await pedirPanorama()).body;
    const fila = porArea.find((a) => a.area === 'Area desierta');
    assert.ok(fila, 'el área sin postulantes desapareció');
    assert.equal(fila.postulaciones, 0);
  });

  test('el embudo trae los siete estados aunque alguno esté en cero', async () => {
    const { embudo } = (await pedirPanorama()).body;
    assert.deepEqual(
      Object.keys(embudo).sort(),
      ['en_revision', 'entrevista', 'no_seleccionada', 'recibida', 'retirada', 'seleccionada', 'sin_respuesta'],
    );
  });

  test('el total de postulaciones es la suma del embudo', async () => {
    const { embudo, postulacionesTotal } = (await pedirPanorama()).body;
    assert.equal(Object.values(embudo).reduce((s, n) => s + n, 0), postulacionesTotal);
  });
});

describe('ofertas sin postulantes', () => {
  const buscar = (lista, titulo) => lista.find((o) => o.titulo === titulo);

  test('una publicada hace 20 días y sin postulaciones aparece', async () => {
    await crearOferta({ area: 'Abandonada', diasPublicada: 20 });

    const { ofertasSinPostulantes } = (await pedirPanorama()).body;
    const oferta = buscar(ofertasSinPostulantes, 'Oferta de Abandonada');
    assert.ok(oferta, 'no detectó la oferta sin postulantes');
    assert.ok(oferta.diasPublicada >= 20);
    assert.equal(oferta.empresa, 'Empresa del panorama');
  });

  test('una publicada hace 20 días CON una postulación no aparece', async () => {
    const oferta = await crearOferta({ area: 'Con interes', diasPublicada: 20 });
    await postular(oferta.id);

    const { ofertasSinPostulantes } = (await pedirPanorama()).body;
    assert.equal(buscar(ofertasSinPostulantes, 'Oferta de Con interes'), undefined);
  });

  test('una publicada hace 2 días no aparece: no le dio tiempo', async () => {
    await crearOferta({ area: 'Recien nacida', diasPublicada: 2 });

    const { ofertasSinPostulantes } = (await pedirPanorama()).body;
    assert.equal(buscar(ofertasSinPostulantes, 'Oferta de Recien nacida'), undefined);
  });

  test('un borrador nunca aparece, por viejo que sea', async () => {
    await crearOferta({ area: 'Borrador viejo', estado: 'borrador', diasPublicada: 90 });

    const { ofertasSinPostulantes } = (await pedirPanorama()).body;
    assert.equal(buscar(ofertasSinPostulantes, 'Oferta de Borrador viejo'), undefined);
  });
});
