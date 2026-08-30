const cron = require('node-cron');
const cuentaService = require('../services/cuenta/cuenta.service');
const logger = require('../config/logger');

// Mismo patrón que las otras tres tareas: estado en memoria, expuesto en GET /salud.
const estado = { ultimaEjecucionAt: null, cantidadAvisadas: null, cantidadEliminadas: null, cantidadFallidas: null, huboError: false };

const ejecutar = async () => {
  try {
    const { avisadas, eliminadas, fallidas } = await cuentaService.procesarRetencion();
    estado.ultimaEjecucionAt = new Date();
    estado.cantidadAvisadas = avisadas;
    estado.cantidadEliminadas = eliminadas;
    estado.cantidadFallidas = fallidas;
    estado.huboError = false;
    logger.info({ avisadas, eliminadas, fallidas }, 'procesarRetencionCv: ejecutada');
  } catch (error) {
    estado.huboError = true;
    logger.error({ err: error.message }, 'procesarRetencionCv: falló');
  }
};

// 5am, una hora después de marcarSinRespuesta: ninguna corre al mismo minuto que otra.
const programar = () => cron.schedule('0 5 * * *', ejecutar);

const obtenerEstado = () => ({ ...estado });

module.exports = { programar, ejecutar, obtenerEstado };
