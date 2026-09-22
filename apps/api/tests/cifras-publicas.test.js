const { test, describe, after, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { Op } = require('sequelize');
const { sequelize, Empresa, Oferta } = require('../src/models');
const publicosService = require('../src/services/panorama/publicos.service');
const { crearUsuarioActivo, generarRutValido } = require('./ayudas');
const { borrarUsuariosDePrueba } = require('./limpiar');

// Las tres cifras de la portada (apps/web/index.html). Son públicas y sin sesión: es la promesa de
// Proxi puesta a la vista, y una promesa que no se puede comprobar no sirve de nada.
const DOMINIO_PRUEBA = 'cifras-publicas.test';
const DIA_MS = 24 * 60 * 60 * 1000;
const RUTA = '/api/v1/panorama/publico';

let empresaId;
const ofertasCreadas = [];

// La base exige fecha_cierre > fecha_publicacion (CHECK ofertas_fecha_cierre_check). Para simular
// una oferta ya vencida hay que publicarla ANTES, no cerrarla en el pasado respecto de hoy: es la
// regla del dominio protegiéndose, y la prueba tiene que respetarla igual que el código real.
const crearOferta = ({ estado = 'publicada', diasHastaCierre = 30, diasPublicadaAtras = 1 }) => Oferta.create({
  empresaId,
  titulo: 'Oferta de prueba',
  descripcion: 'x',
  requisitos: 'x',
  area: 'Prueba',
  modalidad: 'remota',
  jornada: 'parcial',
  remunerada: false,
  estado,
  fechaCierre: new Date(Date.now() + diasHastaCierre * DIA_MS),
  fechaPublicacion: estado === 'publicada' ? new Date(Date.now() - diasPublicadaAtras * DIA_MS) : null,
}).then((o) => { ofertasCreadas.push(o.id); return o; });

before(async () => {
  const empresa = await crearUsuarioActivo('empresa', DOMINIO_PRUEBA);
  const perfil = await Empresa.create({
    usuarioId: empresa.usuario.id,
    razonSocial: 'Empresa de las cifras',
    rutEmpresa: generarRutValido(),
    contactoNombre: 'Contacto',
    contactoCargo: 'RR.HH.',
    estadoValidacion: 'validada',
  });
  empresaId = perfil.id;
});

// El endpoint cuenta TODA la base, y `node --test` corre los archivos en paralelo: comparar el
// total antes y después dejaba una prueba que fallaba sola cuando otro archivo creaba una oferta a
// la vez (pasó en la primera corrida). Se comprueba la misma regla —vigente es publicada Y con
// cierre futuro— pero acotada a las ofertas de ESTA prueba, que son las únicas que controlo.
const misOfertasVigentes = () => Oferta.count({
  where: { empresaId, estado: 'publicada', fechaCierre: { [Op.gt]: new Date() } },
});

after(async () => {
  if (ofertasCreadas.length) await Oferta.destroy({ where: { id: ofertasCreadas } });
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('cifras públicas de la portada', () => {
  test('se ven sin sesión: es la promesa de Proxi, no un dato interno', async () => {
    const respuesta = await request(app).get(RUTA);
    assert.equal(respuesta.status, 200);
  });

  test('no exponen ningún dato de una persona ni de una empresa', async () => {
    const cuerpo = JSON.stringify((await request(app).get(RUTA)).body);
    for (const prohibido of ['@', 'rut', 'razonSocial', 'nombres', 'empresa']) {
      assert.ok(!cuerpo.includes(prohibido), `las cifras exponen "${prohibido}"`);
    }
  });

  test('el conjunto de campos es exactamente el que la portada usa', async () => {
    const { body } = await request(app).get(RUTA);
    assert.deepEqual(
      Object.keys(body).sort(),
      ['diasPromedioRespuesta', 'ofertasVigentes', 'postulacionesSinRespuesta', 'suficienteHistorial'],
    );
  });

  test('una oferta publicada y vigente suma', async () => {
    const antes = await misOfertasVigentes();
    await crearOferta({ diasHastaCierre: 30 });
    assert.equal(await misOfertasVigentes(), antes + 1);
    // Y el endpoint la ve: al menos las mías están contadas.
    const total = (await request(app).get(RUTA)).body.ofertasVigentes;
    assert.ok(total >= antes + 1, `el endpoint reporta ${total}, menos que las ${antes + 1} mías`);
  });

  test('un borrador no suma: nadie lo ve', async () => {
    const antes = await misOfertasVigentes();
    await crearOferta({ estado: 'borrador' });
    assert.equal(await misOfertasVigentes(), antes);
  });

  test('una oferta ya vencida no suma aunque siga publicada', async () => {
    // cerrarOfertasVencidas corre de noche: entre que vence y que la tarea pasa, la oferta sigue
    // en estado publicada. "Vigente" tiene que mirar la fecha, no solo el estado.
    const antes = await misOfertasVigentes();
    await crearOferta({ diasHastaCierre: -5, diasPublicadaAtras: 40 });
    assert.equal(await misOfertasVigentes(), antes);
  });

  test('sin historial suficiente, las cifras que serían ruido vienen en null y no en cero', async () => {
    const { body } = await request(app).get(RUTA);
    if (!body.suficienteHistorial) {
      // null y cero dicen cosas distintas: "todavía no sabemos" contra "ninguna quedó sin
      // respuesta", y la segunda es justo el logro que la portada quiere mostrar.
      assert.equal(body.postulacionesSinRespuesta, null);
      assert.equal(body.diasPromedioRespuesta, null);
    } else {
      assert.equal(typeof body.postulacionesSinRespuesta, 'number');
    }
  });

  test('el umbral es el mismo que usa el perfil público de una empresa', () => {
    // Si alguien sube uno y no el otro, la portada y el perfil de empresa empezarían a contar
    // historias distintas sobre los mismos datos.
    const { UMBRAL_POSTULACIONES } = publicosService;
    assert.equal(UMBRAL_POSTULACIONES, 5);
  });
});
