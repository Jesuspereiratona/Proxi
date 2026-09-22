const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, Sesion } = require('../src/models');
const { purgarAgotadas } = require('../src/services/auth/sesiones-retencion');
const env = require('../src/config/env');
const { crearUsuarioActivo } = require('./ayudas');
const { borrarUsuariosDePrueba } = require('./limpiar');

// `sesiones` guarda ip y user_agent —el mismo dato de red al que la auditoría tiene plazo— y no
// tenía ninguna regla: crecía para siempre (revisión de seguridad del 2026-09-22).
const DOMINIO_PRUEBA = 'retencion-sesiones.test';
const DIA_MS = 24 * 60 * 60 * 1000;

let usuarioId;
const creadas = [];

const crearSesion = async ({ diasAtras, revocada = false }) => {
  if (!usuarioId) usuarioId = (await crearUsuarioActivo('estudiante', DOMINIO_PRUEBA)).usuario.id;
  const fecha = new Date(Date.now() - diasAtras * DIA_MS);
  const sesion = await Sesion.create({
    usuarioId,
    refreshTokenHash: `hash-${Date.now()}-${Math.random()}`,
    expiraAt: revocada ? new Date(Date.now() + 7 * DIA_MS) : fecha,
    revocadaAt: revocada ? fecha : null,
    ip: '200.1.2.3',
    userAgent: 'Mozilla/5.0 (prueba)',
  });
  creadas.push(sesion.id);
  return sesion.id;
};

const sigueViva = async (id) => (await Sesion.findByPk(id)) !== null;

after(async () => {
  if (creadas.length) await Sesion.destroy({ where: { id: creadas } });
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('purga de sesiones agotadas', () => {
  test('una sesión vencida hace más del plazo se borra', async () => {
    const id = await crearSesion({ diasAtras: env.retencionSesionesDias + 10 });
    await purgarAgotadas();
    assert.equal(await sigueViva(id), false);
  });

  test('una sesión revocada hace más del plazo también se borra', async () => {
    const id = await crearSesion({ diasAtras: env.retencionSesionesDias + 10, revocada: true });
    await purgarAgotadas();
    assert.equal(await sigueViva(id), false);
  });

  test('una revocada AYER se conserva: sirve para investigar "me robaron la cuenta"', async () => {
    const id = await crearSesion({ diasAtras: 1, revocada: true });
    await purgarAgotadas();
    assert.equal(await sigueViva(id), true);
  });

  test('una sesión vigente no se toca, por vieja que sea la cuenta', async () => {
    const id = await crearSesion({ diasAtras: -7 }); // expira en el futuro
    await purgarAgotadas();
    assert.equal(await sigueViva(id), true);
  });

  test('es idempotente: la segunda corrida no encuentra nada', async () => {
    await crearSesion({ diasAtras: env.retencionSesionesDias + 5 });
    const primera = await purgarAgotadas();
    assert.ok(primera >= 1);
    assert.equal(await purgarAgotadas(), 0);
  });

  test('el plazo de sesiones es MUY menor que el de la auditoría', () => {
    // Una sesión no es evidencia de acceso a datos personales: eso vive en auditoria_accesos, que
    // tiene 24 meses. Si alguien iguala los dos plazos, se está guardando dato de red sin propósito.
    assert.ok(env.retencionSesionesDias < env.borradoAuditoriaMeses * 30,
      'la retención de sesiones no debería acercarse a la de la auditoría');
  });
});
