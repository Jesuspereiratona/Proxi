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
const programar = () => cron.schedule('0 4 * * *', ejecutar);

const obtenerEstado = () => ({ ...estado });

module.exports = { programar, ejecutar, obtenerEstado };
