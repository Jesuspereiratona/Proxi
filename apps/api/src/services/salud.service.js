const sequelize = require('../config/database');
const env = require('../config/env');
const cerrarOfertasVencidas = require('../tareas/cerrarOfertasVencidas');
const marcarSinRespuesta = require('../tareas/marcarSinRespuesta');

const INICIO = Date.now();
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
    tiempoActivoSegundos: Math.floor((Date.now() - INICIO) / 1000),
    baseDeDatos,
    tareas: {
      cerrarOfertasVencidas: estadoPublico(cerrarOfertasVencidas),
      marcarSinRespuesta: estadoPublico(marcarSinRespuesta),
    },
  };
  cache = { momento: Date.now(), resultado };
  return resultado;
};

module.exports = { verificarSalud };
