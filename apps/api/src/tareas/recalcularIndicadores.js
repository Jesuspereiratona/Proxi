const cron = require('node-cron');
const { sequelize } = require('../models');
const logger = require('../config/logger');

// Mismo patrón que las otras tareas nocturnas: estado en memoria, expuesto en GET /salud.
const estado = { ultimaEjecucionAt: null, huboError: false };

const ejecutar = async () => {
  try {
    // CONCURRENTLY: no bloquea lecturas de la vista mientras recalcula (requiere el índice único
    // en empresa_id de la migración). Sin esto, el endpoint público quedaría bloqueado durante el
    // recálculo nocturno.
    await sequelize.query('REFRESH MATERIALIZED VIEW CONCURRENTLY empresa_indicadores');
    estado.ultimaEjecucionAt = new Date();
    estado.huboError = false;
    logger.info('recalcularIndicadores: ejecutada');
  } catch (error) {
    estado.huboError = true;
    logger.error({ err: error.message }, 'recalcularIndicadores: falló');
  }
};

// 5am: una hora después de marcarSinRespuesta (4am), dos después de cerrarOfertasVencidas (3am).
// Se guarda la referencia para poder detenerla: en el apagado ordenado (server.js) las tareas se
// paran antes de cerrar la base, porque una que arranque justo en ese momento abriría una
// transacción contra conexiones que se están cerrando.
let programada = null;

const programar = () => {
  programada = cron.schedule('0 5 * * *', ejecutar);
  return programada;
};

const detener = () => {
  programada?.stop();
  programada = null;
};

const obtenerEstado = () => ({ ...estado });

module.exports = { programar, detener, ejecutar, obtenerEstado };
