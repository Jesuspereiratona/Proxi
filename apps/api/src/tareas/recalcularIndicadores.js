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
const programar = () => cron.schedule('0 5 * * *', ejecutar);

const obtenerEstado = () => ({ ...estado });

module.exports = { programar, ejecutar, obtenerEstado };
