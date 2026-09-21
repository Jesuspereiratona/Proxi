const sequelize = require('../config/database');
const env = require('../config/env');
const cerrarOfertasVencidas = require('../tareas/cerrarOfertasVencidas');
const marcarSinRespuesta = require('../tareas/marcarSinRespuesta');
const recalcularIndicadores = require('../tareas/recalcularIndicadores');
const procesarRetencionCv = require('../tareas/procesarRetencionCv');
const procesarRetencionAuditoria = require('../tareas/procesarRetencionAuditoria');
const vigilarAccesos = require('../tareas/vigilarAccesos');

const INICIO = Date.now();

// El commit que está corriendo de verdad. Render lo inyecta como RENDER_GIT_COMMIT; fuera de Render
// queda null y no se publica la clave.
//
// Existe por una razón concreta: el flujo de despliegue terminaba en verde apenas /salud respondía,
// pero quien respondía era la instancia VIEJA —el contenedor nuevo tarda minutos— así que el paso
// llamado "esperar a que la API responda con el código nuevo" no comprobaba nada. Con esto, el flujo
// espera hasta ver ESTE commit. Publicarlo no filtra nada: el repositorio es público.
const VERSION = (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null;
const CACHE_MS = 5000; // /salud es pública y sin auth: sin esto, el límite de tasa (300/15min)
// permitiría abrir 300 conexiones a la base solo para responder el healthcheck.
let cache = null;

// /salud no requiere autenticación: cuánto cerró o marcó cada tarea la última vez que corrió es
// dato de gestión (docs/03-seguridad.md), no algo para publicar sin auth. Cuándo corrió y si falló
// alcanza para el monitoreo externo (auditoría de Fase 4).
const estadoPublico = (tarea) => {
  const { ultimaEjecucionAt, huboError } = tarea.obtenerEstado();
  return { ultimaEjecucionAt, huboError };
};

const verificarSalud = async () => {
  if (cache && Date.now() - cache.momento < CACHE_MS) return cache.resultado;

  let baseDeDatos;
  try {
    await sequelize.authenticate();
    baseDeDatos = { ok: true };
  } catch (error) {
    baseDeDatos = { ok: false, ...(env.esDesarrollo ? { error: error.message } : {}) };
  }

  const resultado = {
    estado: baseDeDatos.ok ? 'ok' : 'degradado',
    version: VERSION,
    tiempoActivoSegundos: Math.floor((Date.now() - INICIO) / 1000),
    baseDeDatos,
    tareas: {
      cerrarOfertasVencidas: estadoPublico(cerrarOfertasVencidas),
      marcarSinRespuesta: estadoPublico(marcarSinRespuesta),
      recalcularIndicadores: estadoPublico(recalcularIndicadores),
      procesarRetencionCv: estadoPublico(procesarRetencionCv),
      procesarRetencionAuditoria: estadoPublico(procesarRetencionAuditoria),
      vigilarAccesos: estadoPublico(vigilarAccesos),
    },
  };
  cache = { momento: Date.now(), resultado };
  return resultado;
};

module.exports = { verificarSalud };
