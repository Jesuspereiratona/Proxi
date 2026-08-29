const { Empresa } = require('../../models');
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

  if (empresa.estadoValidacion === 'rechazada' && puedeTransicionar('rechazada', 'pendiente', 'empresa')) {
    cambios.estadoValidacion = 'pendiente';
    cambios.motivoRechazo = null;
  } else {
    const huboCambioDeIdentidad = CAMPOS_IDENTIDAD.some((campo) => cambios[campo] !== undefined);
    if (empresa.estadoValidacion === 'validada' && huboCambioDeIdentidad && puedeTransicionar('validada', 'pendiente', 'empresa')) {
      cambios.estadoValidacion = 'pendiente';
      cambios.validadaPorUsuarioId = null;
      cambios.validadaAt = null;
    }
  }

  await empresa.update(cambios);
  return obtenerPropio(usuarioId);
};

const listarPendientes = () => Empresa.findAll({ where: { estadoValidacion: 'pendiente' } });

const obtenerPorId = async (id) => {
  const empresa = await Empresa.findByPk(id);
  if (!empresa) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Esa empresa no existe.');
  return empresa;
};

const validar = async (id, coordinadorUsuarioId) => {
  const empresa = await obtenerPorId(id);
  if (!puedeTransicionar(empresa.estadoValidacion, 'validada', 'coordinacion')) {
    throw new Conflicto(EMPRESA_TRANSICION_INVALIDA, `No se puede pasar de "${empresa.estadoValidacion}" a "validada".`);
  }
  await empresa.update({
    estadoValidacion: 'validada',
    validadaPorUsuarioId: coordinadorUsuarioId,
    validadaAt: new Date(),
    motivoRechazo: null,
  });
  return empresa;
};

const rechazar = async (id, motivoRechazo) => {
  const empresa = await obtenerPorId(id);
  if (!puedeTransicionar(empresa.estadoValidacion, 'rechazada', 'coordinacion')) {
    throw new Conflicto(EMPRESA_TRANSICION_INVALIDA, `No se puede pasar de "${empresa.estadoValidacion}" a "rechazada".`);
  }
  await empresa.update({ estadoValidacion: 'rechazada', motivoRechazo });
  return empresa;
};

// Agregado tras la auditoría: sin esto, un fraude descubierto después de validar una empresa no
// tenía remedio salvo editar la base a mano. Reactivar una suspensión queda fuera de alcance por
// ahora (no hay flujo definido); se documenta como decisión explícita, no como olvido.
const suspender = async (id, motivoSuspension) => {
  const empresa = await obtenerPorId(id);
  if (!puedeTransicionar(empresa.estadoValidacion, 'suspendida', 'coordinacion')) {
    throw new Conflicto(EMPRESA_TRANSICION_INVALIDA, `No se puede pasar de "${empresa.estadoValidacion}" a "suspendida".`);
  }
  await empresa.update({ estadoValidacion: 'suspendida', motivoSuspension });
  return empresa;
};

module.exports = { crearPerfil, obtenerPropio, actualizarPropio, listarPendientes, validar, rechazar, suspender };
