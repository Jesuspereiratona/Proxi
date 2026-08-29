const { Estudiante } = require('../../models');
const repositorio = require('../../repositories/estudiantes.repository');
const { esRutValido } = require('../../utils/rut');
const { Conflicto, NoEncontrado, ErrorValidacion } = require('../../errors');
const { PERFIL_YA_EXISTE, PERFIL_NO_ENCONTRADO, RUT_INVALIDO } = require('@proxi/errores');

const CAMPOS_EDITABLES = ['nombres', 'apellidos', 'carrera', 'nivel', 'telefono'];

const validarRut = (rut) => {
  if (!esRutValido(rut)) throw new ErrorValidacion(RUT_INVALIDO, 'El RUT no es válido.');
};

const crearPerfil = async (usuarioId, datos) => {
  const existente = await Estudiante.findOne({ where: { usuarioId } });
  if (existente) throw new Conflicto(PERFIL_YA_EXISTE, 'Ya tienes un perfil de estudiante.');

  validarRut(datos.rut);
  // usuarioId al final del spread a propósito: aunque el esquema ya descarta cualquier usuarioId
  // que venga en el cuerpo, que la seguridad no dependa únicamente de eso (defensa en profundidad,
  // auditoría de Fase 2).
  return repositorio.crearConRutCifrado({ ...datos, usuarioId });
};

const obtenerPropio = async (usuarioId) => {
  const estudiante = await Estudiante.findOne({ where: { usuarioId } });
  if (!estudiante) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Todavía no tienes un perfil de estudiante.');
  return estudiante;
};

const actualizarPropio = async (usuarioId, datos) => {
  const estudiante = await obtenerPropio(usuarioId);

  if (datos.rut) {
    validarRut(datos.rut);
    await repositorio.actualizarRut({ usuarioId, rut: datos.rut });
  }

  const cambios = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (datos[campo] !== undefined) cambios[campo] = datos[campo];
  }
  if (Object.keys(cambios).length > 0) await estudiante.update(cambios);

  return obtenerPropio(usuarioId);
};

// Solo para coordinación, desde una ruta con autorizar('coordinacion') explícito. Recibe el id
// propio de "estudiantes", no el usuario_id (ver nota en el repositorio).
const obtenerRutDescifrado = async (estudianteId) => {
  const estudiante = await Estudiante.findByPk(estudianteId);
  if (!estudiante) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Ese estudiante no tiene perfil.');
  return repositorio.obtenerRutDescifradoPorId(estudianteId);
};

module.exports = { crearPerfil, obtenerPropio, actualizarPropio, obtenerRutDescifrado };
