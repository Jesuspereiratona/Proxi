const { Op } = require('sequelize');
const { sequelize, Oferta, OfertaEvento, Empresa } = require('../../models');
const { puedeTransicionar } = require('./estados');
const ofertasReglas = require('./reglas');
const empresasService = require('../empresas/empresas.service');
const empresasReglas = require('../empresas/reglas');
const logger = require('../../config/logger');
const { NoEncontrado, Conflicto, ErrorValidacion } = require('../../errors');
const {
  OFERTA_NO_ENCONTRADA,
  OFERTA_TRANSICION_INVALIDA,
  OFERTA_SIN_FECHA_CIERRE,
  OFERTA_FECHA_CIERRE_INVALIDA,
  OFERTA_CAMPO_NO_EDITABLE,
  VALIDACION_ENTRADA,
} = require('@proxi/errores');

const CAMPOS_RESTRINGIDOS_PUBLICADA = ['remunerada', 'montoMensual'];
// Tocar cualquiera de estos en una oferta en_revision o publicada la manda de vuelta a borrador:
// son el contenido que coordinación revisó, no metadata incidental (auditoría de Fase 3 — sin esto,
// una empresa podía reescribir el texto de una oferta ya aprobada sin pasar de nuevo por revisión).
const CAMPOS_CONTENIDO = ['titulo', 'descripcion', 'requisitos', 'area', 'modalidad', 'jornada', 'comuna', 'cupos'];

// Cada cambio de estado + su evento van en una sola transacción: si falla el evento, no hay cambio
// de estado (docs/01-arquitectura.md). El UPDATE lleva el estado anterior en el WHERE (compare-and-set,
// no un SELECT-luego-UPDATE): si otra petición ya movió la oferta mientras esta se procesaba, afecta
// 0 filas y se rechaza en vez de pisar el cambio ajeno (auditoría de Fase 3, condición de carrera real
// entre p. ej. la empresa cerrando una oferta justo cuando corre la tarea nocturna).
const transicionar = (oferta, estadoNuevo, { actorUsuarioId = null, motivo = null, camposExtra = {}, transaction } = {}) => {
  const ejecutar = async (t) => {
    const estadoAnterior = oferta.estado;
    const [filas] = await Oferta.update(
      { estado: estadoNuevo, ...camposExtra },
      { where: { id: oferta.id, estado: estadoAnterior }, transaction: t },
    );
    if (filas === 0) {
      throw new Conflicto(OFERTA_TRANSICION_INVALIDA, 'La oferta cambió de estado mientras se procesaba la solicitud.');
    }
    await OfertaEvento.create({ ofertaId: oferta.id, estadoAnterior, estadoNuevo, actorUsuarioId, motivo }, { transaction: t });
    Object.assign(oferta, { estado: estadoNuevo, ...camposExtra });
    return oferta;
  };
  return transaction ? ejecutar(transaction) : sequelize.transaction(ejecutar);
};

// Declarar el resultado de una oferta que el sistema ya cerró (vencida) no es una transición de
// estado — sigue "cerrada" — así que no pasa por transicionar(). Mismo compare-and-set: solo afecta
// una fila que siga sin declarar.
const declararResultadoTardio = (oferta, motivoCierre, actorUsuarioId) =>
  sequelize.transaction(async (t) => {
    const [filas] = await Oferta.update(
      { motivoCierre, resultadoDeclarado: true },
      { where: { id: oferta.id, estado: 'cerrada', resultadoDeclarado: false }, transaction: t },
    );
    if (filas === 0) {
      throw new Conflicto(OFERTA_TRANSICION_INVALIDA, 'Esa oferta ya tiene un resultado declarado.');
    }
    await OfertaEvento.create(
      { ofertaId: oferta.id, estadoAnterior: 'cerrada', estadoNuevo: 'cerrada', actorUsuarioId, motivo: `declaración tardía: ${motivoCierre}` },
      { transaction: t },
    );
    Object.assign(oferta, { motivoCierre, resultadoDeclarado: true });
    return oferta;
  });

const obtenerPorId = async (ofertaId) => {
  const oferta = await Oferta.findByPk(ofertaId);
  if (!oferta) throw new NoEncontrado(OFERTA_NO_ENCONTRADA, 'Esa oferta no existe.');
  return oferta;
};

// La pertenencia se verifica dentro de la consulta, no con un if posterior (docs/03-seguridad.md):
// si la oferta es de otra empresa, esto no la trae a memoria, directamente no aparece.
const obtenerPropiaPorId = async (empresaId, ofertaId) => {
  const oferta = await Oferta.findOne({ where: { id: ofertaId, empresaId } });
  if (!oferta) throw new NoEncontrado(OFERTA_NO_ENCONTRADA, 'Esa oferta no existe.');
  return oferta;
};

const validarCruceResultante = (resultante) => {
  if (resultante.remunerada && resultante.montoMensual == null) {
    throw new ErrorValidacion(VALIDACION_ENTRADA, 'montoMensual es obligatorio si la oferta es remunerada.');
  }
  if (resultante.modalidad !== 'remota' && !resultante.comuna) {
    throw new ErrorValidacion(VALIDACION_ENTRADA, 'comuna es obligatoria salvo modalidad remota.');
  }
};

const crear = async (usuarioId, datos) => {
  const empresa = await empresasService.obtenerPropio(usuarioId);
  return Oferta.create({ ...datos, empresaId: empresa.id, estado: 'borrador' });
};

const editar = async (usuarioId, ofertaId, datos) => {
  const empresa = await empresasService.obtenerPropio(usuarioId);
  const oferta = await obtenerPropiaPorId(empresa.id, ofertaId);

  if (['cerrada', 'archivada'].includes(oferta.estado)) {
    throw new Conflicto(OFERTA_CAMPO_NO_EDITABLE, 'Una oferta cerrada o archivada ya no se puede editar.');
  }

  if (oferta.estado === 'publicada') {
    for (const campo of CAMPOS_RESTRINGIDOS_PUBLICADA) {
      if (datos[campo] !== undefined) {
        throw new Conflicto(OFERTA_CAMPO_NO_EDITABLE, `"${campo}" no se puede modificar en una oferta publicada.`);
      }
    }
    if (datos.fechaCierre && datos.fechaCierre < oferta.fechaCierre) {
      throw new Conflicto(OFERTA_CAMPO_NO_EDITABLE, 'No se puede acortar la fecha de cierre de una oferta publicada.');
    }
  }

  // Se valida sobre el objeto resultante (actual + parche), no sobre el parche solo: un PATCH parcial
  // que por sí solo se ve válido puede dejar la oferta inconsistente (ej. remunerada=true sin tocar
  // montoMensual). Antes esto llegaba crudo al CHECK de la base y salía como 500 (auditoría de Fase 3).
  const resultante = { ...oferta.get({ plain: true }), ...datos };
  validarCruceResultante(resultante);

  const tocaContenido = CAMPOS_CONTENIDO.some((campo) => datos[campo] !== undefined);
  if (tocaContenido && ['en_revision', 'publicada'].includes(oferta.estado)) {
    return transicionar(oferta, 'borrador', { actorUsuarioId: usuarioId, motivo: 'edición de contenido', camposExtra: datos });
  }

  await oferta.update(datos);
  return oferta;
};

const enviarARevision = async (usuarioId, ofertaId) => {
  const empresa = await empresasService.obtenerPropio(usuarioId);
  const oferta = await obtenerPropiaPorId(empresa.id, ofertaId);

  if (!puedeTransicionar(oferta.estado, 'en_revision', 'empresa')) {
    throw new Conflicto(OFERTA_TRANSICION_INVALIDA, `No se puede enviar a revisión desde "${oferta.estado}".`);
  }
  if (!oferta.fechaCierre) {
    throw new ErrorValidacion(OFERTA_SIN_FECHA_CIERRE, 'Falta la fecha de cierre.');
  }
  if (oferta.fechaCierre <= new Date()) {
    throw new ErrorValidacion(OFERTA_FECHA_CIERRE_INVALIDA, 'La fecha de cierre debe ser futura.');
  }
  empresasReglas.verificarValidada(empresa);
  await ofertasReglas.verificarCierresPendientes(empresa.id);

  return transicionar(oferta, 'en_revision', { actorUsuarioId: usuarioId });
};

const aprobar = async (ofertaId, coordinadorUsuarioId) => {
  const oferta = await obtenerPorId(ofertaId);
  // Puede haber pasado tiempo entre el envío a revisión y la aprobación: se revalida que la empresa
  // siga validada (pudo suspenderse mientras tanto) y que la fecha de cierre siga siendo futura, en
  // vez de confiar en el chequeo que se hizo al enviar a revisión (auditoría de Fase 3).
  const empresaDeLaOferta = await Empresa.findByPk(oferta.empresaId);
  empresasReglas.verificarValidada(empresaDeLaOferta);

  if (!puedeTransicionar(oferta.estado, 'publicada', 'coordinacion')) {
    throw new Conflicto(OFERTA_TRANSICION_INVALIDA, `No se puede aprobar una oferta "${oferta.estado}".`);
  }
  if (!oferta.fechaCierre || oferta.fechaCierre <= new Date()) {
    throw new ErrorValidacion(OFERTA_FECHA_CIERRE_INVALIDA, 'La fecha de cierre ya no es futura; edítala antes de aprobar.');
  }

  return transicionar(oferta, 'publicada', { actorUsuarioId: coordinadorUsuarioId, camposExtra: { fechaPublicacion: new Date() } });
};

const rechazar = async (ofertaId, coordinadorUsuarioId, motivo) => {
  const oferta = await obtenerPorId(ofertaId);
  if (!puedeTransicionar(oferta.estado, 'borrador', 'coordinacion')) {
    throw new Conflicto(OFERTA_TRANSICION_INVALIDA, `No se puede rechazar una oferta "${oferta.estado}".`);
  }
  return transicionar(oferta, 'borrador', { actorUsuarioId: coordinadorUsuarioId, motivo });
};

const cerrar = async (usuarioId, ofertaId, motivoCierre) => {
  const empresa = await empresasService.obtenerPropio(usuarioId);
  const oferta = await obtenerPropiaPorId(empresa.id, ofertaId);

  // Caso borde aprobado en la spec: una oferta que el sistema ya cerró por vencimiento (resultado sin
  // declarar) se puede "cerrar" de nuevo para completar la declaración, sin volver a cambiar de estado.
  if (oferta.estado === 'cerrada' && !oferta.resultadoDeclarado) {
    return declararResultadoTardio(oferta, motivoCierre, usuarioId);
  }

  if (!puedeTransicionar(oferta.estado, 'cerrada', 'empresa')) {
    throw new Conflicto(OFERTA_TRANSICION_INVALIDA, `No se puede cerrar una oferta "${oferta.estado}".`);
  }
  return transicionar(oferta, 'cerrada', {
    actorUsuarioId: usuarioId,
    motivo: motivoCierre,
    camposExtra: { motivoCierre, cerradaAt: new Date(), resultadoDeclarado: true },
  });
};

// Sistema: una oferta puntual, vencida. Idempotente — si ya no está publicada, no hace nada.
const cerrarPorVencimiento = async (oferta) => {
  if (!puedeTransicionar(oferta.estado, 'cerrada', 'sistema')) return oferta;
  return transicionar(oferta, 'cerrada', {
    actorUsuarioId: null,
    motivo: 'vencida',
    camposExtra: { motivoCierre: 'vencida', cerradaAt: new Date(), resultadoDeclarado: false },
  });
};

// La usa tareas/cerrarOfertasVencidas.js. Idempotente: correrla dos veces seguidas la segunda vez no
// encuentra nada que cerrar. Una oferta que falla no aborta el resto de la corrida (auditoría de
// Fase 3: antes, una sola fila problemática dejaba sin cerrar todas las que venían después, cada
// noche, hasta que alguien interviniera a mano).
const cerrarVencidas = async (ahora = new Date()) => {
  const vencidas = await Oferta.findAll({ where: { estado: 'publicada', fechaCierre: { [Op.lte]: ahora } } });
  let cerradas = 0;
  let fallidas = 0;
  for (const oferta of vencidas) {
    try {
      await cerrarPorVencimiento(oferta);
      cerradas += 1;
    } catch (error) {
      fallidas += 1;
      logger.warn({ ofertaId: oferta.id, err: error.message }, 'cerrarOfertasVencidas: no se pudo cerrar una oferta');
    }
  }
  return { cerradas, fallidas };
};

// Dos llamadores, mismo motivo: cualquier vez que una empresa deja de estar "validada" con
// ofertas todavía activas, esas ofertas no pueden seguir publicadas o en cola de revisión.
// empresas.service.suspender() la llama al suspender; empresas.service.actualizarPropio() la
// llama cuando un cambio de identidad revierte a "pendiente" (auditoría de Fase 6 — sin esto, la
// vitrina pública seguía mostrando la razón social nueva de una oferta que nadie había vuelto a
// revisar). Los dos pasan la MISMA transacción (transaction se pasa explícito): si el cierre en
// cascada falla a mitad de camino, el cambio de estado de la empresa también se revierte, en vez
// de dejarla sin validar con ofertas publicadas colgando (auditoría de Fase 3). Publicadas se
// cierran con "cancelada"; en_revision vuelve a borrador — no debe poder aprobarse una oferta de
// una empresa que ya no está validada.
const cerrarPorSuspension = async (empresaId, transaction) => {
  const afectables = await Oferta.findAll({
    where: { empresaId, estado: ['publicada', 'en_revision'] },
    transaction,
  });

  let procesadas = 0;
  for (const oferta of afectables) {
    if (oferta.estado === 'publicada') {
      await transicionar(oferta, 'cerrada', {
        actorUsuarioId: null,
        motivo: 'empresa suspendida',
        camposExtra: { motivoCierre: 'cancelada', cerradaAt: new Date(), resultadoDeclarado: false },
        transaction,
      });
    } else {
      await transicionar(oferta, 'borrador', { actorUsuarioId: null, motivo: 'empresa suspendida', transaction });
    }
    procesadas += 1;
  }
  return procesadas;
};

const listarPublicas = async ({ area, modalidad, comuna, remunerada, pagina = 1, limite = 20 } = {}) => {
  const where = { estado: 'publicada', fechaCierre: { [Op.gt]: new Date() } };
  if (area) where.area = area;
  if (modalidad) where.modalidad = modalidad;
  if (comuna) where.comuna = comuna;
  if (remunerada !== undefined) where.remunerada = remunerada;

  const { rows, count } = await Oferta.findAndCountAll({
    where,
    include: [{ model: Empresa, attributes: ['razonSocial'] }],
    limit: limite,
    offset: (pagina - 1) * limite,
    order: [['fechaCierre', 'ASC']],
  });
  return { ofertas: rows, total: count, pagina, limite };
};

const listarDeEmpresa = async (usuarioId) => {
  const empresa = await empresasService.obtenerPropio(usuarioId);
  return Oferta.findAll({ where: { empresaId: empresa.id }, order: [['createdAt', 'DESC']] });
};

// Empresa.razonSocial, si no coordinación no tendría forma de saber de quién es cada oferta al
// decidir si aprobarla (panel de coordinación, Fase 6 parte 5).
const listarPendientesRevision = () =>
  Oferta.findAll({
    where: { estado: 'en_revision' },
    include: [{ model: Empresa, attributes: ['razonSocial'] }],
    order: [['updatedAt', 'ASC']],
  });

// Público puede ver una oferta publicada. Si no está publicada, solo su dueña o coordinación — y a
// cualquier otro se le responde igual que si no existiera (no se confirma la existencia de borradores
// ajenos, docs/03-seguridad.md). La condición de pertenencia va dentro del WHERE, no en un if después
// de traer la fila a memoria (auditoría de Fase 3: importa más todavía cuando Fase 4 agregue CVs).
const obtenerDetalle = async (ofertaId, usuarioActual) => {
  if (usuarioActual?.rol === 'coordinacion') {
    return obtenerPorId(ofertaId);
  }

  let empresaId = null;
  if (usuarioActual?.rol === 'empresa') {
    const empresa = await Empresa.findOne({ where: { usuarioId: usuarioActual.id } });
    empresaId = empresa ? empresa.id : null;
  }

  const condiciones = [{ estado: 'publicada' }];
  if (empresaId) condiciones.push({ empresaId });

  const oferta = await Oferta.findOne({
    where: { id: ofertaId, [Op.or]: condiciones },
    include: [{ model: Empresa, attributes: ['razonSocial'] }],
  });
  if (!oferta) throw new NoEncontrado(OFERTA_NO_ENCONTRADA, 'Esa oferta no existe.');
  return oferta;
};

module.exports = {
  crear,
  editar,
  enviarARevision,
  aprobar,
  rechazar,
  cerrar,
  cerrarVencidas,
  cerrarPorSuspension,
  listarPublicas,
  listarDeEmpresa,
  listarPendientesRevision,
  obtenerDetalle,
};
