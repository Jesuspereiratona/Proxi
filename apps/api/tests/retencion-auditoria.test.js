const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, AuditoriaAcceso } = require('../src/models');
const auditoriaService = require('../src/services/auditoria/auditoria.service');
const env = require('../src/config/env');
const { crearUsuarioActivo } = require('./ayudas');
const { borrarUsuariosDePrueba } = require('./limpiar');

// specs/11-retencion-de-auditoria/spec.md, un criterio por prueba.
//
// Cada archivo de prueba usa su propio dominio: `node --test` corre los archivos en paralelo contra
// la misma base, y estas pruebas borran filas de auditoria_accesos por fecha — sin acotarlas a sus
// propias filas, arrasarían con las de los otros archivos a mitad de corrida.
const DOMINIO_PRUEBA = 'retencion-auditoria.test';

let usuarioId;
const idsCreados = [];

const crearFila = async (mesesAtras, { ip = '200.1.2.3', userAgent = 'Mozilla/5.0 (prueba)' } = {}) => {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - mesesAtras);
  const fila = await AuditoriaAcceso.create({
    usuarioId,
    accion: 'descargar_cv',
    entidad: 'archivo',
    entidadId: 1,
    ip,
    userAgent,
    // createdAt no se puede pasar en create() con timestamps automáticos: se fuerza después.
  });
  await AuditoriaAcceso.update({ createdAt: fecha }, { where: { id: fila.id }, silent: true });
  idsCreados.push(fila.id);
  return fila.id;
};

// La tarea mira TODA la tabla, así que cada prueba parte de sus propias filas y solo comprueba las
// suyas. Las filas de otros archivos de prueba son recientes y nunca califican.
beforeEach(async () => {
  if (idsCreados.length) {
    await AuditoriaAcceso.destroy({ where: { id: idsCreados.splice(0) } });
  }
  if (!usuarioId) {
    const { usuario } = await crearUsuarioActivo('coordinacion', DOMINIO_PRUEBA);
    usuarioId = usuario.id;
  }
});

after(async () => {
  if (idsCreados.length) await AuditoriaAcceso.destroy({ where: { id: idsCreados } });
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('retención de auditoria_accesos', () => {
  test('a los 13 meses se anula la IP y el navegador, y el resto de la fila sobrevive', async () => {
    const id = await crearFila(13);
    await auditoriaService.procesarRetencion();

    const fila = await AuditoriaAcceso.findByPk(id);
    assert.ok(fila, 'la fila se borró cuando solo debía anonimizarse');
    assert.equal(fila.ip, null);
    assert.equal(fila.userAgent, null);
    // Lo que tiene que quedar: la evidencia de quién accedió a qué y cuándo.
    assert.equal(fila.usuarioId, usuarioId);
    assert.equal(fila.accion, 'descargar_cv');
    assert.equal(fila.entidad, 'archivo');
    assert.ok(fila.createdAt);
  });

  test('a los 11 meses no se toca', async () => {
    const id = await crearFila(11);
    await auditoriaService.procesarRetencion();

    const fila = await AuditoriaAcceso.findByPk(id);
    assert.equal(fila.ip, '200.1.2.3');
    assert.equal(fila.userAgent, 'Mozilla/5.0 (prueba)');
  });

  test('a los 25 meses la fila ya no existe', async () => {
    const id = await crearFila(25);
    await auditoriaService.procesarRetencion();

    assert.equal(await AuditoriaAcceso.findByPk(id), null);
  });

  test('es idempotente: la segunda corrida no encuentra nada que hacer', async () => {
    await crearFila(13);
    await crearFila(25);

    const primera = await auditoriaService.procesarRetencion();
    assert.ok(primera.anonimizadas >= 1, 'la primera corrida no anonimizó nada');
    assert.ok(primera.borradas >= 1, 'la primera corrida no borró nada');

    // Sin el filtro "que quede algo que anular", cada corrida diaria reescribiría para siempre las
    // mismas filas ya anonimizadas y este conteo nunca bajaría a cero.
    const segunda = await auditoriaService.procesarRetencion();
    assert.equal(segunda.anonimizadas, 0);
    assert.equal(segunda.borradas, 0);
  });

  test('una cuenta suprimida no exime a su auditoría: tiene la misma fecha de vencimiento', async () => {
    const { usuario } = await crearUsuarioActivo('estudiante', DOMINIO_PRUEBA);
    await usuario.update({ anonimizadoAt: new Date() });

    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() - 13);
    const fila = await AuditoriaAcceso.create({
      usuarioId: usuario.id, accion: 'ver_datos', entidad: 'estudiante', entidadId: 1, ip: '1.2.3.4', userAgent: 'x',
    });
    await AuditoriaAcceso.update({ createdAt: fecha }, { where: { id: fila.id }, silent: true });
    idsCreados.push(fila.id);

    await auditoriaService.procesarRetencion();
    const despues = await AuditoriaAcceso.findByPk(fila.id);
    assert.equal(despues.ip, null);
    assert.ok(despues, 'la evidencia de una cuenta suprimida tampoco se borra antes de tiempo');
  });

  test('la ventana se respeta con `ahora` inyectado, sin esperar 12 meses reales', async () => {
    const id = await crearFila(0); // creada hoy
    const dentroDeUnAnio = new Date();
    dentroDeUnAnio.setMonth(dentroDeUnAnio.getMonth() + env.retencionAuditoriaMeses + 1);

    await auditoriaService.procesarRetencion(dentroDeUnAnio);
    const fila = await AuditoriaAcceso.findByPk(id);
    assert.equal(fila.ip, null, 'no se anonimizó con la fecha futura');
  });
});

describe('GET /salud publica la tarea nueva', () => {
  test('aparece con su estado, y sin los conteos', async () => {
    const respuesta = await request(app).get('/api/v1/salud');
    const tarea = respuesta.body.tareas.procesarRetencionAuditoria;
    assert.ok(tarea, 'la tarea no aparece en /salud');
    assert.deepEqual(Object.keys(tarea).sort(), ['huboError', 'ultimaEjecucionAt']);
    // Cuántas filas de auditoría se borraron es dato de gestión, y /salud es público sin auth.
    assert.equal(tarea.cantidadBorradas, undefined);
  });
});
