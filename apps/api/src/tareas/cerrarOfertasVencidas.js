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

const programar = () => cron.schedule('0 3 * * *', ejecutar);

// Nunca el mensaje de error crudo: /salud es público y sin autenticación (auditoría de Fase 3). Un
// error de Sequelize/Postgres suele traer nombres de tabla, columna o el detalle de la constraint
// violada — reconocimiento gratis para quien lo mire desde afuera.
const obtenerEstado = () => ({ ...estado });

module.exports = { programar, ejecutar, obtenerEstado };
