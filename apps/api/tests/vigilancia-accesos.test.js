const { test, describe, after, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, AuditoriaAcceso } = require('../src/models');
const auditoriaService = require('../src/services/auditoria/auditoria.service');
const env = require('../src/config/env');
const { crearUsuarioActivo } = require('./ayudas');
const { borrarUsuariosDePrueba } = require('./limpiar');

// specs/12-vigilancia-de-accesos/spec.md, un criterio por prueba.
//
// La detección mira TODA la tabla, y `node --test` corre los archivos en paralelo: por eso cada
// prueba busca SU usuario dentro del resultado en vez de afirmar cuántas alertas hay en total.
const DOMINIO_PRUEBA = 'vigilancia-accesos.test';
const DIA_MS = 24 * 60 * 60 * 1000;

const idsUsuarios = [];

const crearUsuario = async (rol = 'coordinacion') => {
  const { usuario } = await crearUsuarioActivo(rol, DOMINIO_PRUEBA);
  idsUsuarios.push(usuario.id);
  return usuario;
};

// Inserción cruda: `createdAt` lo pone Sequelize automáticamente y acá hace falta controlarlo al
// día. Además evita 200 viajes a la base cuando una prueba necesita simular un pico.
const insertarAccesos = async (usuarioId, cantidad, { diasAtras = 0, accion = 'descargar_cv' } = {}) => {
  if (cantidad === 0) return;
  const cuando = new Date(Date.now() - diasAtras * DIA_MS - 60_000);
  await sequelize.query(
    `INSERT INTO auditoria_accesos (usuario_id, accion, entidad, entidad_id, created_at)
     SELECT $1::bigint, $2::text, 'archivo', 1, $3::timestamptz FROM generate_series(1, $4::int)`,
    { bind: [usuarioId, accion, cuando, cantidad] },
  );
};

// Reparte N accesos a lo largo de los 30 días de línea base, para que el promedio diario sea N/30.
const construirLineaBase = async (usuarioId, porDia) => {
  for (let dia = 2; dia <= 31; dia += 1) {
    await insertarAccesos(usuarioId, porDia, { diasAtras: dia });
  }
};

const alertaDe = (alertas, usuarioId) => alertas.find((a) => a.usuarioId === String(usuarioId));

before(async () => {
  // El piso es una constante del servicio: si alguien lo sube, estas pruebas tienen que seguir
  // siendo coherentes en vez de pasar por casualidad.
  assert.equal(auditoriaService.PISO_ABSOLUTO, 30, 'las cantidades de estas pruebas suponen un piso de 30');
});

after(async () => {
  if (idsUsuarios.length) {
    await AuditoriaAcceso.destroy({ where: { usuarioId: idsUsuarios } });
  }
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('vigilancia de accesos', () => {
  test('actividad normal no genera alerta', async () => {
    const usuario = await crearUsuario();
    await construirLineaBase(usuario.id, 3);
    await insertarAccesos(usuario.id, 3);

    const alertas = await auditoriaService.detectarAccesosAnomalos();
    assert.equal(alertaDe(alertas, usuario.id), undefined);
  });

  test('un pico muy por encima de su propio patrón sí genera alerta', async () => {
    const usuario = await crearUsuario();
    await construirLineaBase(usuario.id, 3);
    await insertarAccesos(usuario.id, 200);

    const alerta = alertaDe(await auditoriaService.detectarAccesosAnomalos(), usuario.id);
    assert.ok(alerta, 'no detectó el pico');
    assert.equal(alerta.accesos, 200);
    assert.equal(alerta.rol, 'coordinacion');
  });

  test('mucho volumen que ES su patrón normal no genera alerta', async () => {
    // El caso que hace inservible un umbral fijo: coordinación en temporada de prácticas.
    const usuario = await crearUsuario();
    await construirLineaBase(usuario.id, 180);
    await insertarAccesos(usuario.id, 200);

    const alertas = await auditoriaService.detectarAccesosAnomalos();
    assert.equal(alertaDe(alertas, usuario.id), undefined, 'alertó sobre actividad habitual');
  });

  test('un usuario sin historia con poca actividad no genera alerta', async () => {
    const usuario = await crearUsuario();
    await insertarAccesos(usuario.id, 5);

    const alertas = await auditoriaService.detectarAccesosAnomalos();
    assert.equal(alertaDe(alertas, usuario.id), undefined);
  });

  test('un usuario sin historia con mucha actividad sí genera alerta', async () => {
    const usuario = await crearUsuario();
    await insertarAccesos(usuario.id, 200);

    const alerta = alertaDe(await auditoriaService.detectarAccesosAnomalos(), usuario.id);
    assert.ok(alerta, 'no detectó a una cuenta nueva descargando en masa');
    assert.equal(alerta.lineaBase, 0);
  });

  test('las acciones de gestión no cuentan para el volumen', async () => {
    const usuario = await crearUsuario();
    await insertarAccesos(usuario.id, 500, { accion: 'retirar_logo' });
    await insertarAccesos(usuario.id, 500, { accion: 'eliminar_cuenta' });

    const alertas = await auditoriaService.detectarAccesosAnomalos();
    assert.equal(alertaDe(alertas, usuario.id), undefined, 'contó acciones de gestión como acceso a datos');
  });

  test('la alerta no lleva correo, RUT ni nombre', async () => {
    const usuario = await crearUsuario();
    await insertarAccesos(usuario.id, 200);

    const alerta = alertaDe(await auditoriaService.detectarAccesosAnomalos(), usuario.id);
    assert.deepEqual(Object.keys(alerta).sort(), ['accesos', 'lineaBase', 'rol', 'usuarioId']);
    // Defensa en profundidad: además de la lista exacta, que el correo no aparezca por ningún lado.
    assert.ok(!JSON.stringify(alerta).includes('@'), 'la alerta trae algo con forma de correo');
  });

  test('las cuatro acciones vigiladas son las que tocan datos de un estudiante', () => {
    assert.deepEqual(
      [...auditoriaService.ACCIONES_VIGILADAS].sort(),
      ['descargar_cv', 'exportar_datos', 'ver_postulantes', 'ver_rut'],
    );
  });
});

describe('por dónde sale la alerta', () => {
  test('GET /salud dice que la tarea corrió, pero NO si hubo alerta ni sobre quién', async () => {
    const respuesta = await request(app).get('/api/v1/salud');
    const tarea = respuesta.body.tareas.vigilarAccesos;
    assert.ok(tarea, 'la tarea no aparece en /salud');
    // /salud es público y sin autenticación: anunciar ahí "hoy detectamos un acceso anómalo" es
    // información útil justo para quien lo esté haciendo.
    assert.deepEqual(Object.keys(tarea).sort(), ['huboError', 'ultimaEjecucionAt']);
    assert.equal(tarea.alertas, undefined);
  });

  test('POST /tareas/ejecucion, que exige secreto, sí devuelve las alertas', async () => {
    const tokenOriginal = env.tareasToken;
    env.tareasToken = 'secreto-de-prueba-para-vigilancia-0123456789';
    try {
      const respuesta = await request(app).post('/api/v1/tareas/ejecucion').set('X-Tareas-Token', env.tareasToken);
      assert.equal(respuesta.status, 200);
      assert.ok('alertas' in respuesta.body.tareas.vigilarAccesos, 'no devuelve las alertas');
      assert.ok(Array.isArray(respuesta.body.tareas.vigilarAccesos.alertas));
    } finally {
      env.tareasToken = tokenOriginal;
    }
  });
});
