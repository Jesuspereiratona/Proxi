const { test, describe, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, NotificacionBrecha, AuditoriaAcceso, Archivo, Estudiante } = require('../src/models');
const brechaService = require('../src/services/brecha/brecha.service');
const correo = require('../src/services/correo/correo.service');
const { crearUsuarioActivo } = require('./ayudas');
const { borrarUsuariosDePrueba } = require('./limpiar');

// specs/13-notificacion-de-brecha/spec.md, un criterio por prueba.
const DOMINIO_PRUEBA = 'brecha.test';

const TEXTOS = {
  queOcurrio: 'Una cuenta interna quedó comprometida.',
  queDatos: 'Tu CV.',
  queHacer: 'Nada por ahora.',
  contacto: 'privacidad@ejemplo.test',
};

const enviarOriginal = correo.enviarCorreo;
const idsUsuarios = [];
let enviadosA = [];

const crearUsuario = async (rol = 'estudiante') => {
  const { usuario } = await crearUsuarioActivo(rol, DOMINIO_PRUEBA);
  idsUsuarios.push(usuario.id);
  return usuario;
};

beforeEach(() => {
  enviadosA = [];
  // El correo se simula acá y no se deja en el modo test de correo.service.js porque estas pruebas
  // necesitan contar a cuántos se mandó y provocar un fallo concreto.
  correo.enviarCorreo = async ({ para }) => { enviadosA.push(para); };
});

after(async () => {
  correo.enviarCorreo = enviarOriginal;
  if (idsUsuarios.length) {
    await NotificacionBrecha.destroy({ where: { usuarioId: idsUsuarios } });
    await AuditoriaAcceso.destroy({ where: { usuarioId: idsUsuarios } });
  }
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('notificar una brecha', () => {
  test('notificar a tres personas registra tres filas del mismo incidente', async () => {
    const incidente = `2026-09-21-prueba-${Date.now()}`;
    const ids = [(await crearUsuario()).id, (await crearUsuario()).id, (await crearUsuario()).id];

    const resultado = await brechaService.notificar(incidente, ids, TEXTOS);

    assert.equal(resultado.enviados, 3);
    assert.equal(enviadosA.length, 3);
    assert.equal(await NotificacionBrecha.count({ where: { incidente } }), 3);
  });

  test('volver a correrlo con el mismo incidente no manda nada', async () => {
    const incidente = `2026-09-21-repetido-${Date.now()}`;
    const ids = [(await crearUsuario()).id, (await crearUsuario()).id];

    await brechaService.notificar(incidente, ids, TEXTOS);
    enviadosA = [];
    const segunda = await brechaService.notificar(incidente, ids, TEXTOS);

    assert.equal(segunda.enviados, 0, 'escribió dos veces a la misma gente');
    assert.equal(segunda.yaNotificados, 2);
    assert.equal(enviadosA.length, 0);
  });

  test('otro incidente sí vuelve a notificar a las mismas personas', async () => {
    const marca = Date.now();
    const usuario = await crearUsuario();

    await brechaService.notificar(`incidente-a-${marca}`, [usuario.id], TEXTOS);
    enviadosA = [];
    const segunda = await brechaService.notificar(`incidente-b-${marca}`, [usuario.id], TEXTOS);

    assert.equal(segunda.enviados, 1, 'un incidente distinto es un aviso distinto');
  });

  test('con tope, manda hasta el tope y dice cuántos quedan', async () => {
    const incidente = `2026-09-21-tope-${Date.now()}`;
    const ids = [];
    for (let i = 0; i < 5; i += 1) ids.push((await crearUsuario()).id);

    // El proveedor gratuito corta a los 300 diarios: con más afectados, la notificación abarca
    // más de un día POR DISEÑO, y hay que saberlo antes, no a mitad.
    const resultado = await brechaService.notificar(incidente, ids, TEXTOS, { tope: 2 });

    assert.equal(resultado.enviados, 2);
    assert.equal(resultado.pendientes, 3);
    assert.equal(enviadosA.length, 2);
  });

  test('si un envío falla, los demás igual reciben el aviso', async () => {
    const incidente = `2026-09-21-fallo-${Date.now()}`;
    const ids = [(await crearUsuario()).id, (await crearUsuario()).id, (await crearUsuario()).id];

    let llamadas = 0;
    correo.enviarCorreo = async ({ para }) => {
      llamadas += 1;
      if (llamadas === 2) throw new Error('rebote simulado');
      enviadosA.push(para);
    };

    const resultado = await brechaService.notificar(incidente, ids, TEXTOS);

    assert.equal(resultado.enviados, 2);
    assert.equal(resultado.fallidos, 1);
    // La fila del fallido se escribe igual, con el error: el reintento sabe que ya se intentó.
    const fallida = await NotificacionBrecha.findOne({ where: { incidente, enviadoAt: null } });
    assert.ok(fallida, 'no quedó registro del fallo');
    assert.match(fallida.error, /rebote simulado/);
  });

  test('una cuenta ya suprimida no recibe correo', async () => {
    const incidente = `2026-09-21-suprimido-${Date.now()}`;
    const vivo = await crearUsuario();
    const suprimido = await crearUsuario();
    await suprimido.update({ anonimizadoAt: new Date(), email: `eliminado-${suprimido.id}@proxi.invalid` });

    const resultado = await brechaService.notificar(incidente, [vivo.id, suprimido.id], TEXTOS);

    assert.equal(resultado.enviados, 1);
    assert.equal(resultado.suprimidos, 1);
    assert.ok(!enviadosA.some((e) => e.includes('proxi.invalid')), 'escribió a un marcador de cuenta borrada');
  });
});

describe('proponer quiénes quedaron afectados', () => {
  test('resuelve los dueños de los CV descargados y no incluye al actor', async () => {
    const actor = await crearUsuario('coordinacion');
    const duenoDelCv = await crearUsuario();

    const archivo = await Archivo.create({
      propietarioUsuarioId: duenoDelCv.id,
      nombreOriginal: 'cv.pdf',
      nombreAlmacenado: `${Date.now()}.pdf`,
      mime: 'application/pdf',
      tamanoBytes: 10,
      tipo: 'cv',
    });
    await AuditoriaAcceso.create({
      usuarioId: actor.id, accion: 'descargar_cv', entidad: 'archivo', entidadId: archivo.id,
    });
    // El actor mirando algo suyo no lo convierte en afectado de sí mismo.
    await AuditoriaAcceso.create({
      usuarioId: actor.id, accion: 'descargar_cv', entidad: 'archivo', entidadId: archivo.id,
    });

    const desde = new Date(Date.now() - 60_000);
    const hasta = new Date(Date.now() + 60_000);
    const afectados = await brechaService.afectadosPorActor(actor.id, desde, hasta);

    const ids = afectados.map((a) => a.usuarioId);
    assert.ok(ids.includes(String(duenoDelCv.id)), 'no encontró al dueño del CV');
    assert.ok(!ids.includes(String(actor.id)), 'incluyó al propio actor como afectado');

    await Archivo.destroy({ where: { id: archivo.id } });
  });

  test('resuelve también a quien le descifraron el RUT', async () => {
    const actor = await crearUsuario('coordinacion');
    const estudianteUsuario = await crearUsuario();
    const perfil = await Estudiante.create({
      usuarioId: estudianteUsuario.id, nombres: 'Ana', apellidos: 'Prueba', carrera: 'Ingeniería Comercial',
    });
    await AuditoriaAcceso.create({
      usuarioId: actor.id, accion: 'ver_rut', entidad: 'estudiante', entidadId: perfil.id,
    });

    const afectados = await brechaService.afectadosPorActor(
      actor.id, new Date(Date.now() - 60_000), new Date(Date.now() + 60_000),
    );

    assert.ok(afectados.some((a) => a.usuarioId === String(estudianteUsuario.id) && a.accion === 'ver_rut'));
  });

  test('lo de fuera de la ventana no cuenta', async () => {
    const actor = await crearUsuario('coordinacion');
    const estudianteUsuario = await crearUsuario();
    const perfil = await Estudiante.create({
      usuarioId: estudianteUsuario.id, nombres: 'Beto', apellidos: 'Prueba', carrera: 'Contador Auditor',
    });
    await AuditoriaAcceso.create({
      usuarioId: actor.id, accion: 'ver_rut', entidad: 'estudiante', entidadId: perfil.id,
    });

    // Ventana que terminó antes de que ocurriera el acceso.
    const afectados = await brechaService.afectadosPorActor(
      actor.id, new Date(Date.now() - 120_000), new Date(Date.now() - 60_000),
    );

    assert.equal(afectados.length, 0);
  });
});
