const crypto = require('crypto');
const { Op } = require('sequelize');
const { Archivo, Empresa, AuditoriaAcceso, sequelize } = require('../../models');
const logosRepo = require('../../repositories/logos.repository');
const { ErrorValidacion, NoEncontrado, Conflicto } = require('../../errors');
const { ARCHIVO_INVALIDO, ARCHIVO_NO_ENCONTRADO, PERFIL_NO_ENCONTRADO } = require('@proxi/errores');

// Un logo es una imagen chica en una fila de listado, no una foto. 512 KB es holgado para eso y
// acota lo que una empresa puede dejar guardado en la base.
const TAMANO_MAXIMO_BYTES = 512 * 1024;

// El tipo se decide por los primeros bytes del archivo, NUNCA por su extensión ni por el
// Content-Type que declara el navegador: los dos los controla quien sube (docs/03-seguridad.md).
// El mime que se guarda —y con el que después se sirve— sale de esta tabla, no del cliente.
const FIRMAS = [
  { mime: 'image/png', firma: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mime: 'image/jpeg', firma: Buffer.from([0xff, 0xd8, 0xff]) },
];

// WebP no es un prefijo fijo: son los bytes "RIFF", cuatro de tamaño, y recién ahí "WEBP".
const esWebp = (buffer) => buffer.length >= 12
  && buffer.subarray(0, 4).toString('latin1') === 'RIFF'
  && buffer.subarray(8, 12).toString('latin1') === 'WEBP';

// SVG se rechaza con su propio mensaje en vez de caer en el "formato no reconocido" genérico. Es la
// única imagen que además es un documento ejecutable: un SVG puede traer <script>, y servirlo desde
// nuestro dominio sería XSS almacenado en la vitrina, la página más pública del sitio. Al validar
// por firma quedaría fuera igual; el chequeo explícito existe para que quien lo intente sepa por qué
// y para que quien lea este archivo en un año vea que fue deliberado, no un olvido.
const pareceSvg = (buffer) => {
  const inicio = buffer.subarray(0, 512).toString('latin1').trimStart().toLowerCase();
  return inicio.startsWith('<svg') || (inicio.startsWith('<?xml') && inicio.includes('<svg'));
};

const detectarMime = (buffer) => {
  if (pareceSvg(buffer)) {
    throw new ErrorValidacion(ARCHIVO_INVALIDO, 'Un SVG no se acepta como logo. Sube un PNG, JPEG o WebP.');
  }
  const encontrada = FIRMAS.find(({ firma }) => buffer.subarray(0, firma.length).equals(firma));
  if (encontrada) return encontrada.mime;
  if (esWebp(buffer)) return 'image/webp';
  throw new ErrorValidacion(ARCHIVO_INVALIDO, 'El logo debe ser una imagen PNG, JPEG o WebP.');
};

const EXTENSION_POR_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

// El estado de validación va DENTRO de la consulta, no en un if después: mismo criterio que
// archivos.service.js. Una empresa rechazada o suspendida —por fraude, por ejemplo— no conserva
// escritura sobre `archivos`, no ocupa un puesto en la cola que coordinación tiene que descartar a
// mano, y no puede seguir dejando bytes en la base. Una pendiente sí: preparar el logo es parte de
// armar el perfil que después se revisa.
const empresaQuePuedeSubir = async (usuarioId) => {
  const empresa = await Empresa.findOne({
    where: { usuarioId, estadoValidacion: ['pendiente', 'validada'] },
  });
  if (!empresa) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'No tienes un perfil de empresa activo.');
  return empresa;
};

// El último logo que la empresa subió y que no está retirado, aprobado o no. Es lo que ve ella en su
// panel; el público pasa por obtenerPublico().
const logoVigenteDe = (propietarioUsuarioId, transaction) => Archivo.findOne({
  where: { propietarioUsuarioId, tipo: 'logo', retiradoAt: null },
  order: [['createdAt', 'DESC']],
  transaction,
});

// Retirar suelta SIEMPRE los bytes. La regla 7 de la spec pide conservar el registro de que un logo
// existió y fue retirado, no la imagen: guardarla sería lo contrario de minimizar, y en un retiro
// por contenido inapropiado sería guardar justamente eso. Sin esto —medido en la auditoría de
// seguridad— quince reemplazos dejaban 7,5 MB retenidos para una empresa que, según la spec, tiene
// a lo más un logo vigente.
const marcarRetirado = () => ({ retiradoAt: new Date(), contenido: null });

const subir = async (usuarioId, archivo) => {
  if (!archivo) throw new ErrorValidacion(ARCHIVO_INVALIDO, 'Falta el archivo del logo.');
  // Multer ya corta por tamaño antes de leer el archivo entero a memoria, así que por HTTP esto no
  // se alcanza. Se queda porque un límite de transporte y una regla de negocio no son lo mismo: si
  // mañana llama a este service un seed o una tarea, el tope sigue puesto.
  if (archivo.buffer.length > TAMANO_MAXIMO_BYTES) {
    throw new ErrorValidacion(ARCHIVO_INVALIDO, 'El logo no puede pesar más de 512 KB.');
  }
  const mime = detectarMime(archivo.buffer);
  await empresaQuePuedeSubir(usuarioId);

  // La regla "el público sigue viendo el anterior hasta que aprueben el nuevo" NO se cumple
  // retrasando el retiro, sino porque el nuevo entra sin aprobar y obtenerPublico() solo devuelve
  // aprobados. Por eso acá se retira únicamente el pendiente anterior, que nunca llegó a verse: el
  // aprobado se retira al aprobar el nuevo.
  return sequelize.transaction(async (t) => {
    const anterior = await logoVigenteDe(usuarioId, t);
    if (anterior && !anterior.aprobadoAt) {
      await anterior.update(marcarRetirado(), { transaction: t });
    }
    return Archivo.create({
      propietarioUsuarioId: usuarioId,
      nombreOriginal: `logo.${EXTENSION_POR_MIME[mime]}`,
      nombreAlmacenado: `${crypto.randomUUID()}.${EXTENSION_POR_MIME[mime]}`,
      mime,
      tamanoBytes: archivo.buffer.length,
      tipo: 'logo',
      contenido: archivo.buffer,
    }, { transaction: t });
  });
};

// Lo que ve la empresa en su propio panel. Nunca los bytes.
//
// Devuelve el último que subió Y si hay alguno aprobado visible, porque pueden ser distintos: una
// empresa con logo aprobado que sube uno nuevo tiene el nuevo pendiente y el viejo todavía en la
// vitrina. Mostrar solo "pendiente" la dejaría creyendo que el público no ve nada.
const obtenerPropio = async (usuarioId) => {
  const logo = await logoVigenteDe(usuarioId);
  if (!logo) return null;
  const aprobado = Boolean(logo.aprobadoAt);
  const hayOtroAprobadoVisible = aprobado
    ? false
    : (await Archivo.count({
      where: { propietarioUsuarioId: usuarioId, tipo: 'logo', retiradoAt: null, aprobadoAt: { [Op.ne]: null } },
    })) > 0;
  return { id: logo.id, aprobado, hayOtroAprobadoVisible };
};

// TODOS los no retirados, no solo el más nuevo. Con el criterio anterior, una empresa con un logo
// aprobado que subía otro y pulsaba "Quitar" retiraba el pendiente y dejaba el aprobado
// publicándose, mientras la pantalla le decía que lo había quitado (auditoría de seguridad: el
// DELETE devolvía 204 y el logo seguía sirviéndose en la vitrina).
const quitarPropio = async (usuarioId) => {
  const [cantidad] = await Archivo.update(
    marcarRetirado(),
    { where: { propietarioUsuarioId: usuarioId, tipo: 'logo', retiradoAt: null } },
  );
  if (cantidad === 0) throw new NoEncontrado(ARCHIVO_NO_ENCONTRADO, 'No tienes un logo cargado.');
};

const obtenerPublico = async (empresaId) => {
  const logo = await logosRepo.obtenerLogoPublico(empresaId);
  if (!logo) throw new NoEncontrado(ARCHIVO_NO_ENCONTRADO, 'Esa empresa no tiene logo.');
  return logo;
};

// Coordinación ve la imagen, no solo que "hay un logo pendiente": aprobar a ciegas fue exactamente
// el hallazgo que la auditoría del panel de coordinación corrigió en la Fase 6.
const listarPendientes = () => logosRepo.listarLogosPendientes();

// Los bytes de un logo pendiente, para que coordinación los vea antes de decidir. No es público:
// la ruta exige rol coordinación.
const obtenerParaRevision = async (logoId) => {
  const logo = await Archivo.findOne({
    where: { id: logoId, tipo: 'logo', retiradoAt: null },
    attributes: ['id', 'mime', 'contenido'],
  });
  if (!logo) throw new NoEncontrado(ARCHIVO_NO_ENCONTRADO, 'Ese logo no existe.');
  return logo;
};

const aprobar = (logoId, usuarioCoordinacionId) => sequelize.transaction(async (t) => {
  // Compare-and-set sobre aprobadoAt IS NULL: si la empresa sube otro logo mientras coordinación
  // mira éste, lo que queda aprobado es exactamente el que vio, y un segundo clic no reescribe la
  // marca de quién aprobó (caso borde de la spec).
  const [cantidad] = await Archivo.update(
    { aprobadoAt: new Date(), aprobadoPorUsuarioId: usuarioCoordinacionId },
    { where: { id: logoId, tipo: 'logo', aprobadoAt: null, retiradoAt: null }, transaction: t },
  );
  if (cantidad === 0) throw new Conflicto(ARCHIVO_NO_ENCONTRADO, 'Ese logo ya fue aprobado o retirado.');

  // En la misma transacción que el UPDATE de arriba: entre los dos hay un instante en que la empresa
  // tiene dos logos aprobados, y una caída justo ahí lo dejaría así para siempre.
  const logo = await Archivo.findByPk(logoId, { transaction: t });
  await Archivo.update(marcarRetirado(), {
    where: {
      propietarioUsuarioId: logo.propietarioUsuarioId,
      tipo: 'logo',
      retiradoAt: null,
      id: { [Op.ne]: logoId },
    },
    transaction: t,
  });
  return logo;
});

// La fila NO se borra: la regla 7 de la spec pide poder demostrar después que una empresa tuvo un
// logo y que fue retirado.
//
// El rastro de quién lo retiró va a auditoria_accesos y no a una columna nueva: `aprobado_at` tiene
// su `aprobado_por_usuario_id` porque se consulta en cada carga de la vitrina, mientras que un
// retiro se mira una vez, ante un reclamo. Sin esto, una empresa podía reclamar que le quitaron el
// logo sin motivo y no quedaba ni el quién ni la imagen (auditoría de seguridad).
const retirar = (logoId, usuarioCoordinacionId) => sequelize.transaction(async (t) => {
  const [cantidad] = await Archivo.update(
    marcarRetirado(),
    { where: { id: logoId, tipo: 'logo', retiradoAt: null }, transaction: t },
  );
  if (cantidad === 0) throw new NoEncontrado(ARCHIVO_NO_ENCONTRADO, 'Ese logo no existe o ya fue retirado.');

  await AuditoriaAcceso.create(
    { usuarioId: usuarioCoordinacionId, accion: 'retirar_logo', entidad: 'archivo', entidadId: logoId },
    { transaction: t },
  );
});

module.exports = {
  subir,
  obtenerPropio,
  quitarPropio,
  obtenerPublico,
  listarPendientes,
  obtenerParaRevision,
  aprobar,
  retirar,
  TAMANO_MAXIMO_BYTES,
};
