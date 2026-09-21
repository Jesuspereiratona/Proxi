const cron = require('node-cron');
const auditoriaService = require('../services/auditoria/auditoria.service');
const logger = require('../config/logger');

// Mismo patrón que las otras cinco tareas: estado en memoria.
//
// `alertas` NO sale por GET /salud (ver salud.service.js estadoPublico): /salud es público y sin
// autenticación, y anunciar en abierto "hoy detectamos un acceso anómalo" es información útil justo
// para quien lo esté haciendo. Sí sale por POST /tareas/ejecucion, que exige el secreto.
const estado = { ultimaEjecucionAt: null, alertas: [], huboError: false };

const ejecutar = async () => {
  try {
    const alertas = await auditoriaService.detectarAccesosAnomalos();
    estado.ultimaEjecucionAt = new Date();
    estado.alertas = alertas;
    estado.huboError = false;

    if (alertas.length > 0) {
      // Nivel error, no warn: el aviso que de verdad llega hoy es que el flujo de GitHub Actions
      // falle de forma ruidosa, y eso se decide por este campo. Un warn se pierde en el log.
      // Los objetos solo traen usuarioId, rol y números — nunca correo, RUT ni nombre.
      logger.error({ alertas }, 'vigilarAccesos: volumen de accesos a datos personales fuera de lo normal');
    } else {
      logger.info('vigilarAccesos: sin anomalías');
    }
  } catch (error) {
    estado.huboError = true;
    logger.error({ err: error.message }, 'vigilarAccesos: falló');
  }
};

// 7am, una hora después de procesarRetencionAuditoria: ninguna corre al mismo minuto que otra, y
// esta va al final para mirar el día ya cerrado.
let programada = null;

const programar = () => {
  programada = cron.schedule('0 7 * * *', ejecutar);
  return programada;
};

const detener = () => {
  programada?.stop();
  programada = null;
};

const obtenerEstado = () => ({ ...estado });

module.exports = { programar, detener, ejecutar, obtenerEstado };
