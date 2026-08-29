const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { Archivo, Estudiante, Postulacion, Oferta, Empresa, AuditoriaAcceso } = require('../../models');
const { ErrorValidacion, NoEncontrado } = require('../../errors');
const { ARCHIVO_INVALIDO, ARCHIVO_NO_ENCONTRADO, PERFIL_NO_ENCONTRADO } = require('@proxi/errores');
const env = require('../../config/env');

// El número mágico real de un PDF, no la extensión del nombre ni el Content-Type que manda el
// cliente: ambos los controla quien sube el archivo (docs/03-seguridad.md).
const FIRMA_PDF = Buffer.from('%PDF-');

const subirCv = async (usuarioId, archivo) => {
  if (!archivo) throw new ErrorValidacion(ARCHIVO_INVALIDO, 'Falta el archivo del CV.');
  if (!archivo.buffer.subarray(0, FIRMA_PDF.length).equals(FIRMA_PDF)) {
    throw new ErrorValidacion(ARCHIVO_INVALIDO, 'El CV debe ser un PDF válido.');
  }

  const estudiante = await Estudiante.findOne({ where: { usuarioId } });
  if (!estudiante) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Todavía no tienes un perfil de estudiante.');

  const nombreAlmacenado = `${crypto.randomUUID()}.pdf`;
  // 0o700/0o600: el directorio y el archivo no deben ser legibles por otras cuentas del sistema
  // (auditoría de Fase 4) — un CV es el dato más sensible del proyecto.
  await fs.mkdir(env.uploadDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(env.uploadDir, nombreAlmacenado), archivo.buffer, { mode: 0o600 });

  // El CV anterior (si existía) no se borra: puede seguir referenciado por postulaciones ya
  // enviadas, que tienen que conservar exactamente el CV que la empresa recibió.
  const nuevoArchivo = await Archivo.create({
    propietarioUsuarioId: usuarioId,
    // Se muestra tal cual, nunca se usa como ruta — pero se acota igual: sin tope, un nombre de
    // archivo arbitrariamente largo queda guardado en una columna TEXT sin límite y vuelve tal
    // cual en la respuesta (auditoría de Fase 4).
    nombreOriginal: archivo.originalname.slice(0, 255),
    nombreAlmacenado,
    mime: 'application/pdf',
    tamanoBytes: archivo.buffer.length,
    tipo: 'cv',
  });
  await estudiante.update({ cvArchivoId: nuevoArchivo.id });
  return nuevoArchivo;
};

// archivoId + la condición de dueño van juntas en el WHERE cuando el rol es estudiante, no un
// findByPk seguido de un if (docs/03-seguridad.md) — evita depender de una comparación === entre
// el id del JWT y el BIGINT que devuelve Sequelize para decidir el acceso.
const puedeVer = (archivoId, usuarioActual) => {
  if (usuarioActual.rol === 'estudiante') {
    return Archivo.findOne({ where: { id: archivoId, propietarioUsuarioId: usuarioActual.id } });
  }
  return Archivo.findByPk(archivoId);
};

const tienePermisoEmpresa = async (archivoId, usuarioActual) => {
  // Una empresa suspendida (p. ej. por fraude) no debe conservar el acceso a los CV que recibió
  // (auditoría de Fase 4): estadoValidacion va en el WHERE, no en un if aparte.
  const empresa = await Empresa.findOne({ where: { usuarioId: usuarioActual.id, estadoValidacion: 'validada' } });
  if (!empresa) return false;
  // Solo puede ver el CV de un estudiante que realmente le postuló, y solo el CV congelado de esa
  // postulación — no cualquier CV vigente del estudiante.
  const postulacion = await Postulacion.findOne({
    where: { cvArchivoId: archivoId },
    include: [{ model: Oferta, where: { empresaId: empresa.id }, attributes: [] }],
  });
  return Boolean(postulacion);
};

const descargar = async (archivoId, usuarioActual, ip) => {
  let archivo;
  if (usuarioActual.rol === 'coordinacion' || usuarioActual.rol === 'estudiante') {
    archivo = await puedeVer(archivoId, usuarioActual);
  } else if (usuarioActual.rol === 'empresa' && (await tienePermisoEmpresa(archivoId, usuarioActual))) {
    archivo = await Archivo.findByPk(archivoId);
  }
  // Mismo NoEncontrado tanto si el archivo no existe como si no hay permiso: no se confirma la
  // existencia de un CV ajeno (docs/03-seguridad.md).
  if (!archivo) throw new NoEncontrado(ARCHIVO_NO_ENCONTRADO, 'Ese archivo no existe.');

  const ruta = path.join(env.uploadDir, archivo.nombreAlmacenado);
  // Si el archivo ya no está en disco, se corta acá: ni se registra un acceso que nunca ocurrió,
  // ni la ruta absoluta llega a un log de error no operacional (auditoría de Fase 4).
  try {
    await fs.access(ruta);
  } catch {
    throw new NoEncontrado(ARCHIVO_NO_ENCONTRADO, 'Ese archivo no existe.');
  }

  await AuditoriaAcceso.create({ usuarioId: usuarioActual.id, accion: 'descargar_cv', entidad: 'archivo', entidadId: archivo.id, ip });

  return { ruta, nombreOriginal: archivo.nombreOriginal };
};

module.exports = { subirCv, descargar };
