const cron = require('node-cron');
const postulacionesService = require('../services/postulaciones/postulaciones.service');
const logger = require('../config/logger');

// Mismo patrón que tareas/cerrarOfertasVencidas.js: estado en memoria, no una tabla, expuesto en
// GET /salud. Nunca el mensaje de error crudo (/salud es pública y sin autenticación).
const estado = { ultimaEjecucionAt: null, cantidadMarcadas: null, cantidadFallidas: null, huboError: false };

const ejecutar = async () => {
  try {
    const { marcadas, fallidas } = await postulacionesService.marcarSinRespuesta();
    estado.ultimaEjecucionAt = new Date();
    estado.cantidadMarcadas = marcadas;
    estado.cantidadFallidas = fallidas;
    estado.huboError = false;
    logger.info({ marcadas, fallidas }, 'marcarSinRespuesta: ejecutada');
  } catch (error) {
    estado.huboError = true;
    logger.error({ err: error.message }, 'marcarSinRespuesta: falló');
  }
};

// 4am, una hora después de cerrarOfertasVencidas: evita que ambas tareas corran al mismo minuto.
// Se guarda la referencia para poder detenerla: en el apagado ordenado (server.js) las tareas se
// paran antes de cerrar la base, porque una que arranque justo en ese momento abriría una
// transacción contra conexiones que se están cerrando.
let programada = null;

const programar = () => {
  programada = cron.schedule('0 4 * * *', ejecutar);
  return programada;
};

const detener = () => {
  programada?.stop();
  programada = null;
};

const obtenerEstado = () => ({ ...estado });

module.exports = { programar, detener, ejecutar, obtenerEstado };
