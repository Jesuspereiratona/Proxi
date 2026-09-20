const cron = require('node-cron');
const ofertasService = require('../services/ofertas/ofertas.service');
const logger = require('../config/logger');

// Estado en memoria, no una tabla: alcanza para exponer "cuándo corrió por última vez y cuántas
// cerró" en /salud (docs/01-arquitectura.md). Si el proceso reinicia, vuelve a null hasta la
// próxima corrida — es honesto, no hace falta persistirlo para una tarea idempotente.
const estado = { ultimaEjecucionAt: null, cantidadCerradas: null, cantidadFallidas: null, huboError: false };

const ejecutar = async () => {
  try {
    const { cerradas, fallidas } = await ofertasService.cerrarVencidas();
    estado.ultimaEjecucionAt = new Date();
    estado.cantidadCerradas = cerradas;
    estado.cantidadFallidas = fallidas;
    estado.huboError = false;
    logger.info({ cerradas, fallidas }, 'cerrarOfertasVencidas: ejecutada');
  } catch (error) {
    estado.huboError = true;
    logger.error({ err: error.message }, 'cerrarOfertasVencidas: falló');
  }
};

// Se guarda la referencia para poder detenerla: en el apagado ordenado (server.js) las tareas se
// paran antes de cerrar la base, porque una que arranque justo en ese momento abriría una
// transacción contra conexiones que se están cerrando.
let programada = null;

const programar = () => {
  programada = cron.schedule('0 3 * * *', ejecutar);
  return programada;
};

const detener = () => {
  programada?.stop();
  programada = null;
};

// Nunca el mensaje de error crudo: /salud es público y sin autenticación (auditoría de Fase 3). Un
// error de Sequelize/Postgres suele traer nombres de tabla, columna o el detalle de la constraint
// violada — reconocimiento gratis para quien lo mire desde afuera.
const obtenerEstado = () => ({ ...estado });

module.exports = { programar, detener, ejecutar, obtenerEstado };
