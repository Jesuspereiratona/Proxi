const asyncHandler = require('../utils/async-handler');
const logosService = require('../services/archivos/logos.service');

// Cinco minutos, no una hora: la ventana de caché no solo retrasa un retiro por contenido —eso ya
// estaba asumido en el plan— sino también una suspensión y, sobre todo, un borrado de cuenta, que es
// el ejercicio de un derecho (auditoría de seguridad). Cinco minutos siguen absorbiendo casi todas
// las recargas de la vitrina y acotan la ventana a algo defendible.
const CACHE_LOGO = 'public, max-age=300';

// Los bytes se escriben con el mime DERIVADO DE LA FIRMA al subir, nunca con el que declaró el
// navegador ni con la extensión del nombre. nosniff lo pone helmet globalmente (app.js) — aun así
// el Content-Type correcto es la primera línea de defensa, no la segunda.
const responderImagen = (res, logo, cacheControl) => {
  res.setHeader('Content-Type', logo.mime);
  res.setHeader('Cache-Control', cacheControl);
  // Sin nombre de archivo: `inline` a secas basta para mostrarla y no le sugiere al navegador
  // ningún nombre que venga de datos de un tercero.
  res.setHeader('Content-Disposition', 'inline');
  // helmet pone Cross-Origin-Resource-Policy: same-origin en TODA respuesta, y con eso el navegador
  // se niega a pintar esta imagen dentro de la web, que corre en otro origen (otro puerto en
  // desarrollo, otro subdominio en producción). Verificado con curl contra la API real, no supuesto.
  // Se relaja solo acá: es una imagen pública y ya aprobada, exactamente el caso para el que
  // cross-origin existe. El resto de la API conserva same-origin.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(logo.contenido);
};

const subir = asyncHandler(async (req, res) => {
  const logo = await logosService.subir(req.usuario.id, req.file);
  res.status(201).json({ id: logo.id, mime: logo.mime, aprobado: false });
});

const obtenerPropio = asyncHandler(async (req, res) => {
  res.json({ logo: await logosService.obtenerPropio(req.usuario.id) });
});

const quitarPropio = asyncHandler(async (req, res) => {
  await logosService.quitarPropio(req.usuario.id);
  res.status(204).end();
});

const obtenerPublico = asyncHandler(async (req, res) => {
  const logo = await logosService.obtenerPublico(req.params.id);
  responderImagen(res, logo, CACHE_LOGO);
});

const listarPendientes = asyncHandler(async (req, res) => {
  res.json({ logos: await logosService.listarPendientes() });
});

const obtenerParaRevision = asyncHandler(async (req, res) => {
  const logo = await logosService.obtenerParaRevision(req.params.id);
  // Sin caché: coordinación mira una imagen que está por aprobar o rechazar, y una versión cacheada
  // de un logo que la empresa ya reemplazó la llevaría a aprobar algo que no es lo que hay.
  responderImagen(res, logo, 'no-store');
});

const aprobar = asyncHandler(async (req, res) => {
  const logo = await logosService.aprobar(req.params.id, req.usuario.id);
  res.json({ id: logo.id, aprobado: true });
});

const retirar = asyncHandler(async (req, res) => {
  await logosService.retirar(req.params.id, req.usuario.id);
  res.status(204).end();
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
};
