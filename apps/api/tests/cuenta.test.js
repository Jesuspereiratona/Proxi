const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Estudiante, Empresa, Postulacion, PostulacionEvento, Archivo, Sesion } = require('../src/models');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');
const estudiantesService = require('../src/services/estudiantes/estudiantes.service');
const archivosService = require('../src/services/archivos/archivos.service');
const cuentaService = require('../src/services/cuenta/cuenta.service');
const env = require('../src/config/env');

// Dominio propio: node --test corre los archivos en paralelo contra la misma base.
const DOMINIO_PRUEBA = 'cuenta.uahurtado.test';
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

const crearUsuarioActivo = async (rol, overrides = {}) => {
  const email = correoUnico(rol);
  const passwordHash = await passwords.hashear('claveDePrueba123456');
  const usuario = await Usuario.create({ email, passwordHash, rol, estado: 'activo', emailVerificadoAt: new Date(), ...overrides });
  const accessToken = tokensService.firmarAcceso({ sub: String(usuario.id), rol });
  return { usuario, accessToken, emailOriginal: email };
};

const PDF_VALIDO = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('contenido de prueba')]);
const archivosSubidosEnDisco = [];

const crearEstudianteConPerfil = async (overrides = {}) => {
  const estudianteUsuario = await crearUsuarioActivo('estudiante');
  const rut = generarRutValido();
  await estudiantesService.crearPerfil(estudianteUsuario.usuario.id, {
    nombres: 'Ana',
    apellidos: 'Prueba',
    carrera: 'Contador Auditor',
    nivel: 5,
    telefono: '+56900000000',
    rut,
    ...overrides,
  });
  return { ...estudianteUsuario, rut: rut.replace(/[.\-]/g, '').toUpperCase() };
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

const crearOfertaPublicada = async (empresa) => {
  const creada = await request(app)
    .post('/api/v1/ofertas')
    .set('Authorization', `Bearer ${empresa.accessToken}`)
    .send({
      titulo: 'Práctica de prueba', descripcion: 'x', requisitos: 'x', area: 'x', modalidad: 'remota', jornada: 'completa', remunerada: false,
      fechaCierre: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  await request(app).post(`/api/v1/ofertas/${creada.body.id}/revision`).set('Authorization', `Bearer ${empresa.accessToken}`);
  await request(app).post(`/api/v1/ofertas/${creada.body.id}/aprobacion`).set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);
  return creada.body;
};

after(async () => {
  const { Op } = require('sequelize');
  await Usuario.destroy({ where: { email: { [Op.like]: `%@${DOMINIO_PRUEBA}` } } });
  await Promise.all(archivosSubidosEnDisco.map((nombre) => fs.unlink(path.join(env.uploadDir, nombre)).catch(() => {})));
  await sequelize.close();
});

describe('GET /mi-cuenta/datos', () => {
  test('un estudiante sin perfil recibe perfil:null, no un error', async () => {
    const estudiante = await crearUsuarioActivo('estudiante');
    const respuesta = await request(app).get('/api/v1/mi-cuenta/datos').set('Authorization', `Bearer ${estudiante.accessToken}`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.perfil, null);
    assert.equal(respuesta.body.cv, null);
    assert.deepEqual(respuesta.body.postulaciones, []);
  });

  test('un estudiante con perfil, CV y postulaciones recibe todo en un solo JSON, con su propio RUT', async () => {
    const estudiante = await crearEstudianteConPerfil();
    const archivo = await archivosService.subirCv(estudiante.usuario.id, { buffer: PDF_VALIDO, originalname: 'cv.pdf' });
    archivosSubidosEnDisco.push(archivo.nombreAlmacenado);

    const respuesta = await request(app).get('/api/v1/mi-cuenta/datos').set('Authorization', `Bearer ${estudiante.accessToken}`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.cuenta.email, estudiante.usuario.email);
    assert.equal(respuesta.body.perfil.nombres, 'Ana');
    assert.equal(respuesta.body.perfil.rut, estudiante.rut);
    assert.equal(respuesta.body.cv.nombreOriginal, 'cv.pdf');
  });

  test('una empresa no puede pedir mi-cuenta/datos: 403', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const respuesta = await request(app).get('/api/v1/mi-cuenta/datos').set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(respuesta.status, 403);
  });

  test('dos estudiantes piden sus propios datos y cada uno recibe solo lo suyo', async () => {
    const a = await crearEstudianteConPerfil({ nombres: 'Estudiante A' });
    const b = await crearEstudianteConPerfil({ nombres: 'Estudiante B' });

    const respuestaA = await request(app).get('/api/v1/mi-cuenta/datos').set('Authorization', `Bearer ${a.accessToken}`);
    const respuestaB = await request(app).get('/api/v1/mi-cuenta/datos').set('Authorization', `Bearer ${b.accessToken}`);

    assert.equal(respuestaA.body.perfil.nombres, 'Estudiante A');
    assert.equal(respuestaB.body.perfil.nombres, 'Estudiante B');
  });
});

describe('DELETE /mi-cuenta', () => {
  test('borra el CV del disco, anonimiza el perfil, conserva la postulación, y el correo original ya no sirve para entrar', async () => {
    const estudiante = await crearEstudianteConPerfil();
    const archivo = await archivosService.subirCv(estudiante.usuario.id, { buffer: PDF_VALIDO, originalname: 'cv.pdf' });
    const rutaArchivo = path.join(env.uploadDir, archivo.nombreAlmacenado);
    await fs.access(rutaArchivo); // confirma que existe antes de borrar

    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app)
      .post('/api/v1/postulaciones')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ ofertaId: oferta.id, mensaje: 'Hola, soy Ana, mi teléfono es +56900000000' });

    const respuesta = await request(app)
      .delete('/api/v1/mi-cuenta')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ clave: 'claveDePrueba123456' });
    assert.equal(respuesta.status, 204);

    // el archivo ya no está en disco
    await assert.rejects(() => fs.access(rutaArchivo));
    // y el mismo id ya no se sirve, aunque un respaldo restaurado repusiera los bytes con el mismo
    // nombre (expiraAt marca el archivo como suprimido, no solo el nombreOriginal)
    const archivoFinal = await Archivo.findByPk(archivo.id);
    assert.ok(archivoFinal.expiraAt && archivoFinal.expiraAt <= new Date());
    assert.equal(archivoFinal.nombreOriginal, 'cv-eliminado.pdf');

    // el perfil quedó anonimizado
    const estudianteFinal = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.equal(estudianteFinal.nombres, 'Estudiante eliminado');
    assert.equal(estudianteFinal.telefono, null);
    assert.equal(estudianteFinal.rutUltimos4, null);

    // la usuarios.anonimizado_at es la marca real de "ya se borró" (no un dato de perfil editable)
    const usuarioFinal = await Usuario.findByPk(estudiante.usuario.id);
    assert.ok(usuarioFinal.anonimizadoAt);

    // la postulación sigue existiendo, con el mismo estado, apuntando al perfil ya anonimizado —
    // pero el mensaje libre que escribió (podía traer datos personales) ya no
    const postulacionFinal = await Postulacion.findByPk(postulacion.body.id);
    assert.equal(postulacionFinal.estado, 'recibida');
    assert.equal(postulacionFinal.estudianteId, estudianteFinal.id);
    assert.equal(postulacionFinal.mensaje, null);

    // el correo original ya no sirve para iniciar sesión
    const login = await request(app).post('/api/v1/auth/login').send({ email: estudiante.emailOriginal, clave: 'claveDePrueba123456' });
    assert.equal(login.status, 401);
    assert.equal(login.body.error.codigo, 'AUTH_CREDENCIALES_INVALIDAS');
  });

  test('borrar la cuenta revoca las sesiones activas', async () => {
    const estudiante = await crearEstudianteConPerfil();
    await Sesion.create({ usuarioId: estudiante.usuario.id, refreshTokenHash: 'x'.repeat(64), expiraAt: new Date(Date.now() + 86400000) });

    await request(app)
      .delete('/api/v1/mi-cuenta')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ clave: 'claveDePrueba123456' });

    const sesiones = await Sesion.findAll({ where: { usuarioId: estudiante.usuario.id } });
    assert.ok(sesiones.every((s) => s.revocadaAt !== null));
  });

  test('borrar la cuenta de un estudiante sin CV ni perfil no falla', async () => {
    const estudiante = await crearUsuarioActivo('estudiante');
    const respuesta = await request(app)
      .delete('/api/v1/mi-cuenta')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ clave: 'claveDePrueba123456' });
    assert.equal(respuesta.status, 204);
  });

  test('sin la contraseña correcta, no borra nada (acción irreversible, token robado no alcanza)', async () => {
    const estudiante = await crearEstudianteConPerfil();
    const respuesta = await request(app)
      .delete('/api/v1/mi-cuenta')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ clave: 'una-clave-equivocada' });
    assert.equal(respuesta.status, 401);

    const estudianteFinal = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.equal(estudianteFinal.nombres, 'Ana', 'no debería haberse tocado');
  });

  test('sin mandar clave, responde 422 (validación de entrada), no un 500', async () => {
    const estudiante = await crearEstudianteConPerfil();
    const respuesta = await request(app).delete('/api/v1/mi-cuenta').set('Authorization', `Bearer ${estudiante.accessToken}`).send({});
    assert.equal(respuesta.status, 422);
  });

  test('una empresa no puede borrar su cuenta por esta ruta: 403', async () => {
    const empresa = await crearUsuarioActivo('empresa');
    const respuesta = await request(app)
      .delete('/api/v1/mi-cuenta')
      .set('Authorization', `Bearer ${empresa.accessToken}`)
      .send({ clave: 'claveDePrueba123456' });
    assert.equal(respuesta.status, 403);
  });

  test('el motivo de un retiro (texto libre del propio estudiante) también se anonimiza', async () => {
    const estudiante = await crearEstudianteConPerfil();
    const archivo = await archivosService.subirCv(estudiante.usuario.id, { buffer: PDF_VALIDO, originalname: 'cv.pdf' });
    archivosSubidosEnDisco.push(archivo.nombreAlmacenado);
    const empresa = await crearEmpresaValidada();
    const oferta = await crearOfertaPublicada(empresa);
    const postulacion = await request(app).post('/api/v1/postulaciones').set('Authorization', `Bearer ${estudiante.accessToken}`).send({ ofertaId: oferta.id });
    await request(app)
      .post(`/api/v1/postulaciones/${postulacion.body.id}/retiro`)
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ motivo: 'Me llamo Ana, ya no me interesa' });

    await request(app)
      .delete('/api/v1/mi-cuenta')
      .set('Authorization', `Bearer ${estudiante.accessToken}`)
      .send({ clave: 'claveDePrueba123456' });

    const eventos = await PostulacionEvento.findAll({ where: { postulacionId: postulacion.body.id, estadoNuevo: 'retirada' } });
    assert.ok(eventos.length > 0);
    assert.ok(eventos.every((e) => e.motivo === null));
  });

  test('borrar la cuenta dos veces seguidas no falla ni rehace el trabajo (idempotente)', async () => {
    const estudiante = await crearEstudianteConPerfil();
    await cuentaService.eliminarCuenta(estudiante.usuario.id);
    const anonimizadoAt1 = (await Usuario.findByPk(estudiante.usuario.id)).anonimizadoAt.getTime();

    await cuentaService.eliminarCuenta(estudiante.usuario.id);
    const usuarioFinal = await Usuario.findByPk(estudiante.usuario.id);
    assert.equal(usuarioFinal.anonimizadoAt.getTime(), anonimizadoAt1, 'la segunda llamada no debería rehacer nada');
  });
});

// Mismo cálculo que cuenta.service.js procesarRetencion(): setMonth() no equivale a "meses*30 días"
// (los meses no miden 30 días parejos), así que un cálculo aproximado en las pruebas caía a veces
// del lado equivocado del límite real. Se replica el cálculo exacto y se le da margen de sobra.
const limiteAviso = () => {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - env.retencionCvMeses);
  fecha.setDate(fecha.getDate() + env.retencionAvisoDias);
  return fecha;
};
const limiteEliminacion = () => {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() - env.retencionCvMeses);
  return fecha;
};
const diasAntes = (fecha, dias) => new Date(fecha.getTime() - dias * 24 * 60 * 60 * 1000);

describe('tarea de retención (procesarRetencion)', () => {
  test('avisa una sola vez a quien está a punto de cumplir el plazo, no antes ni dos veces', async () => {
    const estudiante = await crearEstudianteConPerfil();
    await Usuario.update({ ultimoAccesoAt: diasAntes(limiteAviso(), 5) }, { where: { id: estudiante.usuario.id } });

    await cuentaService.procesarRetencion();
    let fila = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.ok(fila.avisoRetencionEnviadoAt, 'debería haber avisado');
    const primerAviso = fila.avisoRetencionEnviadoAt.getTime();

    await cuentaService.procesarRetencion();
    fila = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.equal(fila.avisoRetencionEnviadoAt.getTime(), primerAviso, 'no debería reenviar el aviso');
    // Y tampoco debería haberla eliminado en la misma pasada en la que recién se le avisó — el aviso
    // previo tiene que valer los RETENCION_AVISO_DIAS completos, no cero (hallazgo real del
    // revisor de migraciones sobre esta misma columna).
    assert.equal(fila.nombres, 'Ana', 'un aviso recién enviado no debería disparar el borrado en la misma corrida');
  });

  test('elimina al cumplirse el plazo completo, con un aviso que ya tiene la antigüedad completa', async () => {
    const estudiante = await crearEstudianteConPerfil();
    await Usuario.update({ ultimoAccesoAt: diasAntes(limiteEliminacion(), 5) }, { where: { id: estudiante.usuario.id } });
    await Estudiante.update(
      { avisoRetencionEnviadoAt: diasAntes(new Date(), env.retencionAvisoDias + 5) },
      { where: { usuarioId: estudiante.usuario.id } },
    );

    await cuentaService.procesarRetencion();

    const fila = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.equal(fila.nombres, 'Estudiante eliminado');
  });

  test('un aviso enviado hace poco no dispara el borrado, aunque la inactividad ya cumpla el plazo completo', async () => {
    const estudiante = await crearEstudianteConPerfil();
    await Usuario.update({ ultimoAccesoAt: diasAntes(limiteEliminacion(), 5) }, { where: { id: estudiante.usuario.id } });
    await Estudiante.update({ avisoRetencionEnviadoAt: new Date() }, { where: { usuarioId: estudiante.usuario.id } });

    await cuentaService.procesarRetencion();

    const fila = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.equal(fila.nombres, 'Ana', 'el aviso todavía no cumple RETENCION_AVISO_DIAS, no debería haberse eliminado');
  });

  test('no reintenta sobre una cuenta ya anonimizada', async () => {
    const estudiante = await crearEstudianteConPerfil();
    await cuentaService.eliminarCuenta(estudiante.usuario.id);

    const { fallidas } = await cuentaService.procesarRetencion();
    assert.equal(fallidas, 0);
  });

  // Hallazgo real de la auditoría de Fase 7: sin este reset, a alguien que fue avisado, volvió a
  // entrar y siguió usando la plataforma un tiempo más, un ciclo de inactividad posterior lo
  // eliminaba sin ningún aviso vigente — el aviso "viejo" seguía contando como si acabara de mandarse.
  test('avisado, vuelve a iniciar sesión, y se inactiva de nuevo: no se elimina sin un aviso nuevo', async () => {
    const estudiante = await crearEstudianteConPerfil();
    await Usuario.update({ ultimoAccesoAt: diasAntes(limiteAviso(), 5) }, { where: { id: estudiante.usuario.id } });
    await cuentaService.procesarRetencion();
    let fila = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.ok(fila.avisoRetencionEnviadoAt, 'debería haber avisado la primera vez');

    // vuelve a entrar de verdad, por la ruta real
    await request(app).post('/api/v1/auth/login').send({ email: estudiante.usuario.email, clave: 'claveDePrueba123456' });
    fila = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.equal(fila.avisoRetencionEnviadoAt, null, 'el login debería limpiar el aviso');

    // y ahora se inactiva de nuevo por el plazo completo
    await Usuario.update({ ultimoAccesoAt: diasAntes(limiteEliminacion(), 5) }, { where: { id: estudiante.usuario.id } });
    await cuentaService.procesarRetencion();

    fila = await Estudiante.findOne({ where: { usuarioId: estudiante.usuario.id } });
    assert.equal(fila.nombres, 'Ana', 'no debería haberse eliminado sin un aviso vigente para este ciclo');
  });

  // El otro hallazgo real: una sesión web se sostiene solo con refrescos de token, nunca vuelve a
  // mandar la contraseña — sin esto, "última actividad" quedaba congelada en el primer login y una
  // persona que usa Proxi todas las semanas podía terminar eliminada igual.
  test('refrescar la sesión actualiza última actividad, no solo iniciar sesión con contraseña', async () => {
    const estudiante = await crearEstudianteConPerfil();
    const login = await request(app).post('/api/v1/auth/login').send({ email: estudiante.usuario.email, clave: 'claveDePrueba123456' });
    const cookie = login.headers['set-cookie'];

    await Usuario.update({ ultimoAccesoAt: diasAntes(new Date(), 1) }, { where: { id: estudiante.usuario.id } });
    await request(app).post('/api/v1/auth/refrescar').set('Cookie', cookie);

    const usuarioFinal = await Usuario.findByPk(estudiante.usuario.id);
    assert.ok(usuarioFinal.ultimoAccesoAt.getTime() > Date.now() - 60 * 1000, 'el refresco debería haber actualizado ultimoAccesoAt a ahora');
  });
});
