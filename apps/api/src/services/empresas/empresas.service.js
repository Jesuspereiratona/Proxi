const { sequelize, Empresa } = require('../../models');
const { esRutValido, normalizarRut } = require('../../utils/rut');
const { puedeTransicionar } = require('./estados');
const { Conflicto, NoEncontrado, ErrorValidacion } = require('../../errors');
const {
  PERFIL_YA_EXISTE,
  PERFIL_NO_ENCONTRADO,
  RUT_INVALIDO,
  EMPRESA_RUT_YA_REGISTRADO,
  EMPRESA_TRANSICION_INVALIDA,
} = require('@proxi/errores');

const CAMPOS_EDITABLES = ['razonSocial', 'giro', 'sitioWeb', 'comuna', 'contactoNombre', 'contactoCargo'];
// Cambiar cualquiera de estos en una empresa ya validada la manda de vuelta a revisión: son los
// campos que identifican a la empresa, no datos de contacto incidentales (hallazgo de la auditoría
// de Fase 2: sin esto, una empresa validada podía cambiarse el RUT o la razón social sin que
// coordinación se enterara).
const CAMPOS_IDENTIDAD = ['razonSocial', 'rutEmpresa'];

const validarRutUnico = async (rut, usuarioIdAExcluir = null) => {
  if (!esRutValido(rut)) throw new ErrorValidacion(RUT_INVALIDO, 'El RUT de la empresa no es válido.');
  const rutEmpresa = normalizarRut(rut);
  const existente = await Empresa.findOne({ where: { rutEmpresa } });
  if (existente && existente.usuarioId !== usuarioIdAExcluir) {
    throw new Conflicto(EMPRESA_RUT_YA_REGISTRADO, 'Ese RUT de empresa ya está registrado.');
  }
  return rutEmpresa;
};

const crearPerfil = async (usuarioId, datos) => {
  const existente = await Empresa.findOne({ where: { usuarioId } });
  if (existente) throw new Conflicto(PERFIL_YA_EXISTE, 'Ya tienes un perfil de empresa.');

  const rutEmpresa = await validarRutUnico(datos.rutEmpresa);
  return Empresa.create({
    usuarioId,
    razonSocial: datos.razonSocial,
    rutEmpresa,
    giro: datos.giro,
    sitioWeb: datos.sitioWeb,
    comuna: datos.comuna,
    contactoNombre: datos.contactoNombre,
    contactoCargo: datos.contactoCargo,
    estadoValidacion: 'pendiente',
  });
};

const obtenerPropio = async (usuarioId) => {
  const empresa = await Empresa.findOne({ where: { usuarioId } });
  if (!empresa) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Todavía no tienes un perfil de empresa.');
  return empresa;
};

const actualizarPropio = async (usuarioId, datos) => {
  const empresa = await obtenerPropio(usuarioId);

  // Solo cambios reales: un PATCH vacío (o que repite los valores actuales) no debe reencolar nada.
  const cambios = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined && datos[campo] !== empresa[campo]) cambios[campo] = datos[campo];
  }
  if (datos.rutEmpresa) {
    const rutEmpresa = await validarRutUnico(datos.rutEmpresa, usuarioId);
    if (rutEmpresa !== empresa.rutEmpresa) cambios.rutEmpresa = rutEmpresa;
  }

  if (Object.keys(cambios).length === 0) return empresa;

  let vuelveAPendienteDesdeValidada = false;
  if (empresa.estadoValidacion === 'rechazada' && puedeTransicionar('rechazada', 'pendiente', 'empresa')) {
    cambios.estadoValidacion = 'pendiente';
    cambios.motivoRechazo = null;
  } else {
    const huboCambioDeIdentidad = CAMPOS_IDENTIDAD.some((campo) => cambios[campo] !== undefined);
    if (empresa.estadoValidacion === 'validada' && huboCambioDeIdentidad && puedeTransicionar('validada', 'pendiente', 'empresa')) {
      cambios.estadoValidacion = 'pendiente';
      cambios.validadaPorUsuarioId = null;
      cambios.validadaAt = null;
      vuelveAPendienteDesdeValidada = true;
    }
  }

  if (vuelveAPendienteDesdeValidada) {
    // Mismo problema que resolvió suspender(), encontrado recién en la auditoría de Fase 6: sin
    // esto, una empresa validada que cambia de identidad volvía a "pendiente" pero sus ofertas
    // seguían publicadas con el nombre nuevo, sin que nadie de coordinación lo hubiera revisado —
    // la vitrina pública terminaba mostrando una razón social que nunca pasó por validación.
    const ofertasService = require('../ofertas/ofertas.service');
    await sequelize.transaction(async (t) => {
      await empresa.update(cambios, { transaction: t });
      await ofertasService.cerrarPorSuspension(empresa.id, t);
    });
  } else {
    await empresa.update(cambios);
  }
  return obtenerPropio(usuarioId);
};

const listarPendientes = () => Empresa.findAll({ where: { estadoValidacion: 'pendiente' } });

// Sin filtro y sin lista blanca de columnas: solo la llama coordinación (panel de coordinación,
// Fase 6 parte 5), mismo criterio que listarIndicadores. Hace falta para poder suspender: sin esto
// no hay forma de encontrar una empresa ya validada, listarPendientes() solo trae 'pendiente'.
const listarTodas = () => Empresa.findAll({ order: [['estadoValidacion', 'ASC'], ['createdAt', 'DESC']] });

const obtenerPorId = async (id) => {
  const empresa = await Empresa.findByPk(id);
  if (!empresa) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Esa empresa no existe.');
  return empresa;
};

// Perfil público (Fase 6): solo una empresa validada es visible, con una lista blanca de campos —
// nunca rutEmpresa, contactoNombre/Cargo ni los motivos de rechazo/suspensión, que son de gestión
// interna. Misma condición dentro del where que indicadoresService.obtenerPublico (Fase 5): una
// empresa pendiente/rechazada/suspendida responde igual que una que no existe.
const obtenerPerfilPublico = async (id) => {
  const empresa = await Empresa.findOne({
    where: { id, estadoValidacion: 'validada' },
    attributes: ['id', 'razonSocial', 'giro', 'sitioWeb', 'comuna'],
  });
  if (!empresa) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Esa empresa no existe.');
  return empresa;
};

// Compare-and-set, mismo patrón que ofertas.service.js transicionar(): el estado anterior va en el
// WHERE, no un findByPk + if. Sin esto, dos coordinadores actuando a la vez sobre la misma empresa
// pendiente (uno "Validar", otro "Rechazar") pasaban los dos el chequeo de arriba y el segundo
// pisaba al primero sin aviso — antes solo alcanzable por curl, el panel de coordinación es lo
// primero que pone a dos personas haciendo clic en paralelo (auditoría del panel de coordinación).
const transicionarEstado = async (empresa, estadoNuevo, cambios, transaction) => {
  const [filas] = await Empresa.update(
    { estadoValidacion: estadoNuevo, ...cambios },
    { where: { id: empresa.id, estadoValidacion: empresa.estadoValidacion }, transaction },
  );
  if (filas === 0) {
    throw new Conflicto(EMPRESA_TRANSICION_INVALIDA, 'La empresa cambió de estado mientras se procesaba la solicitud.');
  }
  return Object.assign(empresa, { estadoValidacion: estadoNuevo, ...cambios });
};

const validar = async (id, coordinadorUsuarioId) => {
  const empresa = await obtenerPorId(id);
  if (!puedeTransicionar(empresa.estadoValidacion, 'validada', 'coordinacion')) {
    throw new Conflicto(EMPRESA_TRANSICION_INVALIDA, `No se puede pasar de "${empresa.estadoValidacion}" a "validada".`);
  }
  return transicionarEstado(empresa, 'validada', { validadaPorUsuarioId: coordinadorUsuarioId, validadaAt: new Date(), motivoRechazo: null });
};

const rechazar = async (id, motivoRechazo) => {
  const empresa = await obtenerPorId(id);
  if (!puedeTransicionar(empresa.estadoValidacion, 'rechazada', 'coordinacion')) {
    throw new Conflicto(EMPRESA_TRANSICION_INVALIDA, `No se puede pasar de "${empresa.estadoValidacion}" a "rechazada".`);
  }
  return transicionarEstado(empresa, 'rechazada', { motivoRechazo });
};

// Agregado tras la auditoría: sin esto, un fraude descubierto después de validar una empresa no
// tenía remedio salvo editar la base a mano. Reactivar una suspensión queda fuera de alcance por
// ahora (no hay flujo definido); se documenta como decisión explícita, no como olvido.
//
// La suspensión y el cierre en cascada de sus ofertas van en una sola transacción (auditoría de
// Fase 3): sin esto, si cerrarPorSuspension fallaba a mitad de camino, la empresa quedaba
// "suspendida" en la base con ofertas todavía publicadas — y sin forma de reintentar, porque
// estados.js no permite volver a llamar suspender() sobre una empresa ya suspendida.
const suspender = async (id, motivoSuspension) => {
  const empresa = await obtenerPorId(id);
  if (!puedeTransicionar(empresa.estadoValidacion, 'suspendida', 'coordinacion')) {
    throw new Conflicto(EMPRESA_TRANSICION_INVALIDA, `No se puede pasar de "${empresa.estadoValidacion}" a "suspendida".`);
  }

  // require() adentro de la función, no arriba del archivo: ofertas.service.js también requiere
  // este archivo (para obtenerPropio/verificarValidada), y un require circular a nivel de módulo
  // deja a uno de los dos con un module.exports vacío. Adentro de la función ya cargó completo.
  const ofertasService = require('../ofertas/ofertas.service');

  return sequelize.transaction(async (t) => {
    await transicionarEstado(empresa, 'suspendida', { motivoSuspension }, t);
    await ofertasService.cerrarPorSuspension(empresa.id, t);
    return empresa;
  });
};

module.exports = {
  crearPerfil,
  obtenerPropio,
  actualizarPropio,
  listarPendientes,
  listarTodas,
  obtenerPerfilPublico,
  validar,
  rechazar,
  suspender,
};
