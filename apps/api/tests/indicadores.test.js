const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, Usuario, Estudiante, Empresa, Oferta, Postulacion, PostulacionEvento, Archivo } = require('../src/models');
const { borrarUsuariosDePrueba } = require('./limpiar');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');
const recalcularIndicadores = require('../src/tareas/recalcularIndicadores');

// Dominio propio: node --test corre los archivos en paralelo contra la misma base (ver
// ofertas.test.js / postulaciones.test.js).
const DOMINIO_PRUEBA = 'indicadores.uahurtado.test';
let contador = 0;
const correoUnico = (prefijo) => `${prefijo}.${Date.now()}.${contador++}@${DOMINIO_PRUEBA}`;
const DIA_MS = 24 * 60 * 60 * 1000;

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

const datosOfertaBase = {
  titulo: 't', descripcion: 'd', requisitos: 'r', area: 'x', modalidad: 'remota', jornada: 'completa', remunerada: false,
};

// Una oferta 'cerrada' exige fecha_cierre no nula (CHECK de base, Fase 3): se completa sola salvo
// que el test la pase explícita.
const crearOferta = (empresaId, overrides = {}) => {
  const datos = { ...datosOfertaBase, empresaId, ...overrides };
  if (datos.estado === 'cerrada' && !datos.fechaCierre) {
    datos.fechaCierre = new Date(Date.now() - DIA_MS);
  }
  return Oferta.create(datos);
};

const crearEstudianteConArchivo = async () => {
  const estudiante = await crearUsuarioActivo('estudiante');
  const perfil = await Estudiante.create({ usuarioId: estudiante.usuario.id, nombres: 'A', apellidos: 'B', carrera: 'Ingeniería' });
  const archivo = await Archivo.create({
    propietarioUsuarioId: estudiante.usuario.id,
    nombreOriginal: 'cv.pdf',
    nombreAlmacenado: `${crypto.randomUUID()}.pdf`,
    mime: 'application/pdf',
    tamanoBytes: 100,
    tipo: 'cv',
  });
  return { ...estudiante, estudianteId: perfil.id, archivoId: archivo.id };
};

// Crea una postulación directo por modelo (sin pasar por el servicio) para controlar createdAt con
// precisión, y opcionalmente su primer evento de empresa a una fecha exacta.
const crearPostulacion = async (oferta, estudiante, { creadaHaceDias = 0, estado = 'recibida', respondidaPorEmpresa = false, primerMovimientoHaceDias = null } = {}) => {
  const creadaAt = new Date(Date.now() - creadaHaceDias * DIA_MS);
  const postulacion = await Postulacion.create({
    ofertaId: oferta.id,
    estudianteId: estudiante.estudianteId,
    cvArchivoId: estudiante.archivoId,
    estado,
    estadoActualizadoAt: creadaAt,
    respondidaPorEmpresa,
    createdAt: creadaAt,
  });
  if (primerMovimientoHaceDias !== null) {
    await PostulacionEvento.create({
      postulacionId: postulacion.id,
      estadoAnterior: 'recibida',
      estadoNuevo: 'en_revision',
      actorUsuarioId: null,
      createdAt: new Date(Date.now() - primerMovimientoHaceDias * DIA_MS),
    });
  }
  return postulacion;
};

after(async () => {
  await borrarUsuariosDePrueba(DOMINIO_PRUEBA);
  await sequelize.close();
});

describe('umbral de visibilidad pública', () => {
  test('menos de 3 ofertas cerradas: suficienteHistorial false, sin cifras', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await recalcularIndicadores.ejecutar();

    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.suficienteHistorial, false);
    assert.equal(respuesta.body.tasaRespuesta, undefined);
  });

  test('3 ofertas cerradas o más: suficienteHistorial true, tasaCierreDeclarado exacta', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'sin_candidatos', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'vencida', resultadoDeclarado: false });
    await recalcularIndicadores.ejecutar();

    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.suficienteHistorial, true);
    // Redondeado a 2 decimales antes de publicarse (auditoría de Fase 5): la precisión completa
    // de punto flotante revela el denominador exacto.
    assert.equal(respuesta.body.tasaCierreDeclarado, 0.67);
  });

  test('una empresa que no existe responde 404', async () => {
    const respuesta = await request(app).get('/api/v1/empresas/9999999/indicadores');
    assert.equal(respuesta.status, 404);
  });

  test('una empresa pendiente, rechazada o suspendida responde 404, igual que si no existiera', async () => {
    for (const estadoValidacion of ['pendiente', 'rechazada', 'suspendida']) {
      const usuario = await crearUsuarioActivo('empresa');
      const perfil = await Empresa.create({
        usuarioId: usuario.usuario.id,
        razonSocial: 'Empresa no pública',
        rutEmpresa: generarRutValido().replace(/[.\-]/g, ''),
        contactoNombre: 'x',
        contactoCargo: 'x',
        estadoValidacion,
      });
      const respuesta = await request(app).get(`/api/v1/empresas/${perfil.id}/indicadores`);
      assert.equal(respuesta.status, 404, `estadoValidacion=${estadoValidacion}`);
    }
  });

  test('el endpoint público nunca devuelve ofertasCerradasTotal, aunque suficienteHistorial sea true', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await recalcularIndicadores.ejecutar();

    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.body.suficienteHistorial, true);
    assert.equal(respuesta.body.ofertasCerradasTotal, undefined);
  });

  test('una empresa creada después del último recálculo (sin fila todavía en la vista) responde 200 sin cifras', async () => {
    const empresa = await crearEmpresaValidada();
    // sin llamar recalcularIndicadores.ejecutar(): la empresa no tiene fila en empresa_indicadores.
    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.suficienteHistorial, false);
  });
});

describe('tasaRespuesta', () => {
  test('se calcula sobre el total en estado terminal, no sobre todas las postulaciones', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    const oferta = await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });

    // 3 terminales respondidas, 2 terminales sin respuesta (5 terminales, cruza UMBRAL_POSTULACIONES),
    // 1 no terminal que no debe contar en el denominador.
    await crearPostulacion(oferta, await crearEstudianteConArchivo(), { estado: 'seleccionada', respondidaPorEmpresa: true });
    await crearPostulacion(oferta, await crearEstudianteConArchivo(), { estado: 'no_seleccionada', respondidaPorEmpresa: true });
    await crearPostulacion(oferta, await crearEstudianteConArchivo(), { estado: 'no_seleccionada', respondidaPorEmpresa: true });
    await crearPostulacion(oferta, await crearEstudianteConArchivo(), { estado: 'sin_respuesta', respondidaPorEmpresa: false });
    await crearPostulacion(oferta, await crearEstudianteConArchivo(), { estado: 'retirada', respondidaPorEmpresa: false });
    await crearPostulacion(oferta, await crearEstudianteConArchivo(), { estado: 'recibida', respondidaPorEmpresa: false });

    await recalcularIndicadores.ejecutar();
    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.body.tasaRespuesta, 0.6);
  });

  test('con menos postulaciones en estado terminal que el umbral, tasaRespuesta y diasPromedioRespuesta quedan ausentes aunque tasaCierreDeclarado sí se muestre', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    const oferta = await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });

    // Una sola postulación: sin el umbral por separado, tasaRespuesta=1 y diasPromedioRespuesta
    // describirían exactamente el trato de este caso puntual (auditoría de Fase 5).
    await crearPostulacion(oferta, await crearEstudianteConArchivo(), {
      creadaHaceDias: 10, primerMovimientoHaceDias: 6, estado: 'no_seleccionada', respondidaPorEmpresa: true,
    });

    await recalcularIndicadores.ejecutar();
    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.body.suficienteHistorial, true);
    assert.equal(respuesta.body.tasaCierreDeclarado, 1);
    assert.equal(respuesta.body.tasaRespuesta, undefined);
    assert.equal(respuesta.body.diasPromedioRespuesta, undefined);
  });
});

describe('diasPromedioRespuesta', () => {
  test('promedia los días entre recibida y el primer movimiento de la empresa', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    const oferta = await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });

    // 5 postulaciones con movimiento (cruza UMBRAL_POSTULACIONES): tiempos de respuesta 4,6,5,6,1 -> promedio 4.4
    const tiempos = [[10, 6], [8, 2], [10, 5], [10, 4], [10, 9]];
    for (const [creadaHaceDias, primerMovimientoHaceDias] of tiempos) {
      await crearPostulacion(oferta, await crearEstudianteConArchivo(), { creadaHaceDias, primerMovimientoHaceDias, estado: 'en_revision', respondidaPorEmpresa: true });
    }

    await recalcularIndicadores.ejecutar();
    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(typeof respuesta.body.diasPromedioRespuesta, 'number');
    assert.ok(Math.abs(respuesta.body.diasPromedioRespuesta - 4.4) < 0.05);
  });

  test('queda ausente si ninguna postulación tuvo un movimiento propio de la empresa', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    const oferta = await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    for (let i = 0; i < 5; i++) {
      await crearPostulacion(oferta, await crearEstudianteConArchivo(), { estado: 'sin_respuesta', respondidaPorEmpresa: false });
    }

    await recalcularIndicadores.ejecutar();
    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.body.diasPromedioRespuesta, undefined);
  });
});

describe('ofertasPublicadas12m', () => {
  test('cuenta solo lo publicado en los últimos 12 meses', async () => {
    const empresa = await crearEmpresaValidada();
    // el umbral público exige 3 cerradas: se agregan para poder leer las cifras
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });

    await crearOferta(empresa.empresaId, { fechaPublicacion: new Date(Date.now() - 11 * 30 * DIA_MS) });
    await crearOferta(empresa.empresaId, { fechaPublicacion: new Date(Date.now() - 13 * 30 * DIA_MS) });

    await recalcularIndicadores.ejecutar();
    const respuesta = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    assert.equal(respuesta.body.ofertasPublicadas12m, 1);
  });
});

describe('recálculo idempotente', () => {
  test('correrlo dos veces seguidas sobre los mismos datos da el mismo resultado', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: false });

    await recalcularIndicadores.ejecutar();
    const primera = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);
    await recalcularIndicadores.ejecutar();
    const segunda = await request(app).get(`/api/v1/empresas/${empresa.empresaId}/indicadores`);

    assert.equal(primera.body.tasaCierreDeclarado, segunda.body.tasaCierreDeclarado);
    assert.equal(primera.body.ofertasPublicadas12m, segunda.body.ofertasPublicadas12m);
  });
});

describe('panorama de coordinación', () => {
  test('coordinación ve todas las empresas, incluidas las que no llegan al umbral', async () => {
    const empresa = await crearEmpresaValidada();
    await crearOferta(empresa.empresaId, { estado: 'cerrada', motivoCierre: 'contratado', resultadoDeclarado: true });
    await recalcularIndicadores.ejecutar();

    const respuesta = await request(app)
      .get('/api/v1/empresas/indicadores')
      .set('Authorization', `Bearer ${empresa.coordinacion.accessToken}`);

    assert.equal(respuesta.status, 200);
    const fila = respuesta.body.find((f) => String(f.empresaId) === String(empresa.empresaId));
    assert.ok(fila);
    assert.equal(fila.ofertasCerradasTotal, 1);
    // Regresión: el include de Empresa debe traer solo razonSocial, nunca rutEmpresa/motivoRechazo/
    // motivoSuspension (auditoría de Fase 5).
    assert.deepEqual(Object.keys(fila.Empresa), ['razonSocial']);
  });

  test('un usuario sin rol coordinación recibe 403', async () => {
    const empresa = await crearEmpresaValidada();
    const respuesta = await request(app).get('/api/v1/empresas/indicadores').set('Authorization', `Bearer ${empresa.accessToken}`);
    assert.equal(respuesta.status, 403);
  });
});
