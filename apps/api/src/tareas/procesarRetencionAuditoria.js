const cron = require('node-cron');
const auditoriaService = require('../services/auditoria/auditoria.service');
const sesionesRetencion = require('../services/auth/sesiones-retencion');
const logger = require('../config/logger');

// Mismo patrón que las otras cuatro tareas: estado en memoria, expuesto en GET /salud.
const estado = { ultimaEjecucionAt: null, cantidadAnonimizadas: null, cantidadBorradas: null, cantidadSesionesPurgadas: null, huboError: false };

const ejecutar = async () => {
  try {
    const { anonimizadas, borradas } = await auditoriaService.procesarRetencion();
    // Las sesiones agotadas van en la misma tarea: las dos son retención del mismo tipo de dato de
    // red (ip, user_agent), corren a diario y no tiene sentido programar dos crons para eso.
    const sesionesPurgadas = await sesionesRetencion.purgarAgotadas();

    estado.ultimaEjecucionAt = new Date();
    estado.cantidadAnonimizadas = anonimizadas;
    estado.cantidadBorradas = borradas;
    estado.cantidadSesionesPurgadas = sesionesPurgadas;
    estado.huboError = false;
    logger.info({ anonimizadas, borradas, sesionesPurgadas }, 'procesarRetencionAuditoria: ejecutada');
  } catch (error) {
    estado.huboError = true;
    logger.error({ err: error.message }, 'procesarRetencionAuditoria: falló');
  }
};

// 6am, una hora después de procesarRetencionCv: ninguna corre al mismo minuto que otra.
// Se guarda la referencia para poder detenerla: en el apagado ordenado (server.js) las tareas se
// paran antes de cerrar la base, porque una que arranque justo en ese momento abriría una
// transacción contra conexiones que se están cerrando.
let programada = null;

const programar = () => {
  programada = cron.schedule('0 6 * * *', ejecutar);
  return programada;
};

const detener = () => {
  programada?.stop();
  programada = null;
};

// Solo ultimaEjecucionAt y huboError salen a /salud (salud.service.js estadoPublico): cuántas filas
// de auditoría se borraron es dato de gestión, y /salud es público y sin autenticación.
const obtenerEstado = () => ({ ...estado });

module.exports = { programar, detener, ejecutar, obtenerEstado };
