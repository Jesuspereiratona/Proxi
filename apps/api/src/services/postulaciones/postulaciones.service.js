const { Op } = require('sequelize');
const { sequelize, Postulacion, PostulacionEvento, Oferta, Estudiante, Empresa } = require('../../models');
const { puedeTransicionar } = require('./estados');
const reglas = require('./reglas');
const ofertasReglas = require('../ofertas/reglas');
const empresasService = require('../empresas/empresas.service');
const empresasReglas = require('../empresas/reglas');
const estudiantesService = require('../estudiantes/estudiantes.service');
const logger = require('../../config/logger');
const { NoEncontrado, Conflicto, ReglaDeNegocio } = require('../../errors');
const {
  POSTULACION_NO_ENCONTRADA,
  POSTULACION_YA_EXISTE,
  POSTULACION_SIN_CV,
  POSTULACION_TRANSICION_INVALIDA,
  OFERTA_NO_ENCONTRADA,
} = require('@proxi/errores');

// Mismo compare-and-set que ofertas.service.js: el UPDATE lleva el estado anterior en el WHERE,
// 0 filas afectadas significa que otra petición ya movió la postulación mientras esta se procesaba.
const transicionar = (postulacion, estadoNuevo, { actorUsuarioId = null, motivo = null, respondidaPorEmpresa = false, transaction } = {}) => {
  const ejecutar = async (t) => {
    const estadoAnterior = postulacion.estado;
    const cambios = { estado: estadoNuevo, estadoActualizadoAt: new Date() };
    if (respondidaPorEmpresa) cambios.respondidaPorEmpresa = true;

    const [filas] = await Postulacion.update(cambios, {
      where: { id: postulacion.id, estado: estadoAnterior },
      transaction: t,
    });
    if (filas === 0) {
      throw new Conflicto(POSTULACION_TRANSICION_INVALIDA, 'La postulación cambió de estado mientras se procesaba la solicitud.');
    }
    await PostulacionEvento.create(
      { postulacionId: postulacion.id, estadoAnterior, estadoNuevo, actorUsuarioId, motivo },
      { transaction: t },
    );
    Object.assign(postulacion, cambios);
    return postulacion;
  };
  return transaction ? ejecutar(transaction) : sequelize.transaction(ejecutar);
};

// Orden de la línea de tiempo (Fase 6, panel de estudiante). Solo obtenerDetalle la pide —
// retirar()/empresaTransita() usan estas mismas funciones para leer antes de escribir y no
// necesitan los eventos, así que el include queda detrás de una opción, no siempre encendido.
//
// attributes explícito, sin motivo ni actorUsuarioId (auditoría del panel de estudiante): la
// línea de tiempo que pide la spec es "qué pasó, cuándo, y si fue la empresa o el sistema" — eso
// ya se deduce del propio estadoNuevo (linea-tiempo.js, en el cliente). motivo es una nota libre
// que la empresa/el estudiante escriben pensando en coordinación o en sí mismos, no en la otra
// parte; exponerla cambia de destinatario un campo sin que nadie lo haya decidido. actorUsuarioId
// es el id interno del usuario de la empresa, no hace falta para nada que la interfaz muestre.
const conEventos = (incluirEventos) =>
  incluirEventos
    ? {
        include: [{ model: PostulacionEvento, attributes: ['estadoAnterior', 'estadoNuevo', 'createdAt'] }],
        order: [[PostulacionEvento, 'createdAt', 'ASC']],
      }
    : {};

const obtenerPorId = async (id, { incluirEventos = false } = {}) => {
  const postulacion = await Postulacion.findByPk(id, conEventos(incluirEventos));
  if (!postulacion) throw new NoEncontrado(POSTULACION_NO_ENCONTRADA, 'Esa postulación no existe.');
  return postulacion;
};

// Pertenencia dentro de la consulta, no un findByPk seguido de un if (docs/03-seguridad.md).
const obtenerPropiaDeEstudiante = async (estudianteId, id, { incluirEventos = false } = {}) => {
  const postulacion = await Postulacion.findOne({ where: { id, estudianteId }, ...conEventos(incluirEventos) });
  if (!postulacion) throw new NoEncontrado(POSTULACION_NO_ENCONTRADA, 'Esa postulación no existe.');
  return postulacion;
};

const obtenerPropiaDeEmpresa = async (empresaId, id, { incluirEventos = false } = {}) => {
  const postulacion = await Postulacion.findOne({
    where: { id },
    include: [
      { model: Oferta, as: 'Oferta', where: { empresaId }, attributes: [] },
      ...(incluirEventos ? [{ model: PostulacionEvento, attributes: ['estadoAnterior', 'estadoNuevo', 'createdAt'] }] : []),
    ],
    ...(incluirEventos ? { order: [[PostulacionEvento, 'createdAt', 'ASC']] } : {}),
  });
  if (!postulacion) throw new NoEncontrado(POSTULACION_NO_ENCONTRADA, 'Esa postulación no existe.');
  return postulacion;
};

const postular = async (usuarioId, { ofertaId, mensaje }) => {
  const estudiante = await estudiantesService.obtenerPropio(usuarioId);
  if (!estudiante.cvArchivoId) {
    throw new ReglaDeNegocio(POSTULACION_SIN_CV, 'Debes subir tu CV antes de postular.');
  }

  const oferta = await Oferta.findByPk(ofertaId);
  if (!oferta) throw new NoEncontrado(OFERTA_NO_ENCONTRADA, 'Esa oferta no existe.');
  ofertasReglas.verificarVigencia(oferta);

  try {
    return await sequelize.transaction(async (t) => {
      const postulacion = await Postulacion.create(
        {
          ofertaId: oferta.id,
          estudianteId: estudiante.id,
          mensaje: mensaje ?? null,
          cvArchivoId: estudiante.cvArchivoId,
          estado: 'recibida',
          estadoActualizadoAt: new Date(),
        },
        { transaction: t },
      );
      await PostulacionEvento.create(
        { postulacionId: postulacion.id, estadoAnterior: null, estadoNuevo: 'recibida', actorUsuarioId: usuarioId, motivo: null },
        { transaction: t },
      );
      return postulacion;
    });
  } catch (error) {
    // Defensa real contra la postulación duplicada en paralelo: dos peticiones simultáneas pueden
    // llegar las dos hasta acá antes de que ninguna haya insertado (mismo espíritu que el
    // compare-and-set de ofertas, pero acá la operación es un CREATE, no un UPDATE). Se ancla al
    // nombre de la restricción, no solo al tipo de error: un futuro índice UNIQUE en cualquiera de
    // las dos tablas no debe caer también en "ya postulaste".
    if (error.name === 'SequelizeUniqueConstraintError' && error.parent?.constraint === 'postulaciones_oferta_estudiante_unique') {
      throw new Conflicto(POSTULACION_YA_EXISTE, 'Ya postulaste a esta oferta.');
    }
    throw error;
  }
};

// Incluye la oferta (y su empresa): "mis postulaciones" (Fase 6) necesita mostrar a qué oferta
// corresponde cada una, y una oferta ya cerrada deja de ser visible por el endpoint público
// (ofertas.service.obtenerDetalle) — sin este include, el panel no tendría ninguna forma de
// mostrar la postulación a una oferta que ya cerró.
const listarDeEstudiante = async (usuarioId) => {
  const estudiante = await estudiantesService.obtenerPropio(usuarioId);
  return Postulacion.findAll({
    where: { estudianteId: estudiante.id },
    include: [{ model: Oferta, as: 'Oferta', attributes: ['id', 'titulo', 'empresaId'], include: [{ model: Empresa, attributes: ['razonSocial'] }] }],
    order: [['createdAt', 'DESC']],
  });
};

const listarDeOferta = async (usuarioId, ofertaId) => {
  const empresa = await empresasService.obtenerPropio(usuarioId);
  // Una empresa suspendida (p. ej. por fraude) no debe seguir viendo quién le postuló: la
  // suspensión ya le cierra las ofertas en cascada (Fase 3), pero eso no bloqueaba esta ruta
  // (auditoría de Fase 4).
  empresasReglas.verificarValidada(empresa);
  const oferta = await Oferta.findOne({ where: { id: ofertaId, empresaId: empresa.id } });
  if (!oferta) throw new NoEncontrado(OFERTA_NO_ENCONTRADA, 'Esa oferta no existe.');
  return Postulacion.findAll({ where: { ofertaId: oferta.id }, order: [['createdAt', 'ASC']] });
};

const obtenerDetalle = async (usuarioActual, id) => {
  if (usuarioActual.rol === 'coordinacion') return obtenerPorId(id, { incluirEventos: true });
  if (usuarioActual.rol === 'estudiante') {
    const estudiante = await Estudiante.findOne({ where: { usuarioId: usuarioActual.id } });
    if (!estudiante) throw new NoEncontrado(POSTULACION_NO_ENCONTRADA, 'Esa postulación no existe.');
    return obtenerPropiaDeEstudiante(estudiante.id, id, { incluirEventos: true });
  }
  return obtenerPropiaDeEmpresa((await empresasService.obtenerPropio(usuarioActual.id)).id, id, { incluirEventos: true });
};

const empresaTransita = async (usuarioId, id, estadoNuevo, motivo = null) => {
  const empresa = await empresasService.obtenerPropio(usuarioId);
  empresasReglas.verificarValidada(empresa);
  const postulacion = await obtenerPropiaDeEmpresa(empresa.id, id);
  if (!puedeTransicionar(postulacion.estado, estadoNuevo, 'empresa')) {
    throw new Conflicto(POSTULACION_TRANSICION_INVALIDA, `No se puede pasar de "${postulacion.estado}" a "${estadoNuevo}".`);
  }
  return transicionar(postulacion, estadoNuevo, { actorUsuarioId: usuarioId, motivo, respondidaPorEmpresa: true });
};

const marcarEnRevision = (usuarioId, id) => empresaTransita(usuarioId, id, 'en_revision');
const marcarEntrevista = (usuarioId, id) => empresaTransita(usuarioId, id, 'entrevista');
const seleccionar = (usuarioId, id) => empresaTransita(usuarioId, id, 'seleccionada');
const rechazar = (usuarioId, id, motivo) => empresaTransita(usuarioId, id, 'no_seleccionada', motivo);

const retirar = async (usuarioId, id, motivo) => {
  const estudiante = await estudiantesService.obtenerPropio(usuarioId);
  const postulacion = await obtenerPropiaDeEstudiante(estudiante.id, id);
  if (!puedeTransicionar(postulacion.estado, 'retirada', 'estudiante')) {
    throw new Conflicto(POSTULACION_TRANSICION_INVALIDA, 'Esta postulación ya no se puede retirar.');
  }
  return transicionar(postulacion, 'retirada', { actorUsuarioId: usuarioId, motivo });
};

// La usa tareas/marcarSinRespuesta.js. Idempotente y tolerante a fallos por fila, mismo patrón que
// ofertas.service.cerrarVencidas (Fase 3).
const marcarSinRespuesta = async (ahora = new Date()) => {
  const limite = reglas.fechaLimiteSla(ahora);
  const vencidas = await Postulacion.findAll({
    where: { estado: ['recibida', 'en_revision', 'entrevista'], estadoActualizadoAt: { [Op.lt]: limite } },
  });

  let marcadas = 0;
  let fallidas = 0;
  for (const postulacion of vencidas) {
    try {
      // Los estados cambian solo por las transiciones que declara estados.js, ninguna excepción
      // para la tarea programada (CLAUDE.md) — aunque hoy el filtro de arriba ya solo trae estados
      // no terminales, así que esto es cinturón y tirantes, no una corrección de un bug real.
      if (!puedeTransicionar(postulacion.estado, 'sin_respuesta', 'sistema')) continue;
      await transicionar(postulacion, 'sin_respuesta', { actorUsuarioId: null, motivo: 'sin respuesta dentro del SLA' });
      marcadas += 1;
    } catch (error) {
      fallidas += 1;
      logger.warn({ postulacionId: postulacion.id, err: error.message }, 'marcarSinRespuesta: no se pudo marcar una postulación');
    }
  }
  return { marcadas, fallidas };
};

module.exports = {
  postular,
  listarDeEstudiante,
  listarDeOferta,
  obtenerDetalle,
  marcarEnRevision,
  marcarEntrevista,
  seleccionar,
  rechazar,
  retirar,
  marcarSinRespuesta,
};
