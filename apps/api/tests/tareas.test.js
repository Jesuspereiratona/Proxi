const { test, describe, after, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const env = require('../src/config/env');

// El disparador externo de las tareas nocturnas (docs/07-operacion-y-mantenimiento.md). No usa JWT:
// lo llama un cron de GitHub Actions, que no es una persona y no tiene sesión. Estas pruebas cubren
// exactamente eso: que sin el secreto correcto la ruta se comporte como si no existiera.
const SECRETO = 'secreto-de-prueba-para-las-tareas-0123456789';
const RUTA = '/api/v1/tareas/ejecucion';

let tokenOriginal;
before(() => {
  tokenOriginal = env.tareasToken;
  env.tareasToken = SECRETO;
});

after(async () => {
  env.tareasToken = tokenOriginal;
  await sequelize.close();
});

describe('POST /tareas/ejecucion', () => {
  test('sin el encabezado responde 404, igual que una URL inventada', async () => {
    const respuesta = await request(app).post(RUTA);
    assert.equal(respuesta.status, 404);
    assert.equal(respuesta.body.error.codigo, 'RUTA_NO_ENCONTRADA');
    // El mensaje es idéntico al de cualquier ruta que no existe: no confirma que este endpoint esté
    // ahí esperando el secreto correcto.
    const inventada = await request(app).post('/api/v1/tareas/esto-no-existe');
    assert.equal(respuesta.body.error.mensaje, inventada.body.error.mensaje);
  });

  test('con un secreto equivocado responde 404, no 401', async () => {
    const respuesta = await request(app).post(RUTA).set('X-Tareas-Token', 'no-es-el-secreto');
    assert.equal(respuesta.status, 404);
  });

  test('un secreto del largo correcto pero distinto tampoco pasa', async () => {
    const casiIgual = `${SECRETO.slice(0, -1)}X`;
    const respuesta = await request(app).post(RUTA).set('X-Tareas-Token', casiIgual);
    assert.equal(respuesta.status, 404);
  });

  test('GET no está expuesto: solo POST dispara escrituras', async () => {
    const respuesta = await request(app).get(RUTA).set('X-Tareas-Token', SECRETO);
    assert.equal(respuesta.status, 404);
  });

  test('con el secreto correcto corre todas las tareas y devuelve el estado de cada una', async () => {
    const respuesta = await request(app).post(RUTA).set('X-Tareas-Token', SECRETO);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(
      Object.keys(respuesta.body.tareas).sort(),
      // Lista exacta a propósito: una tarea nueva que no se sume acá al disparador externo no
      // correría nunca en el plan gratuito, donde el cron interno duerme con el proceso.
      ['cerrarOfertasVencidas', 'marcarSinRespuesta', 'procesarRetencionAuditoria', 'procesarRetencionCv', 'recalcularIndicadores', 'vigilarAccesos'],
    );
    for (const [nombre, estado] of Object.entries(respuesta.body.tareas)) {
      assert.equal(estado.huboError, false, `${nombre} dejó huboError en true`);
      assert.ok(estado.ultimaEjecucionAt, `${nombre} no registró ultimaEjecucionAt`);
    }
  });

  test('es idempotente: dispararla dos veces seguidas no falla', async () => {
    const segunda = await request(app).post(RUTA).set('X-Tareas-Token', SECRETO);
    assert.equal(segunda.status, 200);
    assert.equal(segunda.body.tareas.cerrarOfertasVencidas.huboError, false);
  });

  test('dos disparos simultáneos: uno corre y el otro recibe 409, no se ejecutan en paralelo', async () => {
    // Con el secreto en mano, N llamadas a la vez ejecutaban las cuatro tareas en paralelo consigo
    // mismas (auditoría de seguridad: 8 POST simultáneos, ocho 200). La pasada de retención hace
    // hasta 50 eliminarCuenta, cada uno con un bcrypt de costo 12.
    const respuestas = await Promise.all(
      Array.from({ length: 4 }, () => request(app).post(RUTA).set('X-Tareas-Token', SECRETO)),
    );
    const codigos = respuestas.map((r) => r.status).sort();
    assert.equal(codigos.filter((c) => c === 200).length, 1, `se ejecutaron varias a la vez: ${codigos}`);
    assert.equal(codigos.filter((c) => c === 409).length, 3);
    assert.equal(respuestas.find((r) => r.status === 409).body.error.codigo, 'TAREAS_EN_CURSO');
  });

  test('después de un 409 la ruta vuelve a funcionar: la bandera no queda trabada', async () => {
    const respuesta = await request(app).post(RUTA).set('X-Tareas-Token', SECRETO);
    assert.equal(respuesta.status, 200);
  });

  test('sin TAREAS_TOKEN configurado la ruta no existe para nadie, ni con el secreto', async () => {
    env.tareasToken = '';
    try {
      const respuesta = await request(app).post(RUTA).set('X-Tareas-Token', SECRETO);
      assert.equal(respuesta.status, 404);
    } finally {
      env.tareasToken = SECRETO;
    }
  });
});
