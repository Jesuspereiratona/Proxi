const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { sequelize } = require('./models');
const cerrarOfertasVencidas = require('./tareas/cerrarOfertasVencidas');
const marcarSinRespuesta = require('./tareas/marcarSinRespuesta');
const recalcularIndicadores = require('./tareas/recalcularIndicadores');
const procesarRetencionCv = require('./tareas/procesarRetencionCv');
const procesarRetencionAuditoria = require('./tareas/procesarRetencionAuditoria');

process.on('unhandledRejection', (error) => {
  logger.fatal(error, 'unhandledRejection');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.fatal(error, 'uncaughtException');
  process.exit(1);
});

const servidor = app.listen(env.puerto, () => {
  logger.info(`Proxi API escuchando en el puerto ${env.puerto}`);
});

const tareas = [cerrarOfertasVencidas, marcarSinRespuesta, recalcularIndicadores, procesarRetencionCv, procesarRetencionAuditoria];
tareas.forEach((tarea) => tarea.programar());

// Apagado ordenado. El supervisor del proveedor (Render, Fly, systemd, Kubernetes) manda SIGTERM y
// espera unos segundos antes de matar el proceso a la fuerza. Sin esto, cada despliegue cortaba las
// peticiones en vuelo: alguien subiendo un CV veía un error de red a mitad de la subida, y una
// transacción abierta quedaba esperando el timeout de Postgres en vez de cerrarse.
//
// El margen es de 10 segundos, por debajo de los ~30 que dan los proveedores: la idea es terminar
// antes de que nos maten, no al mismo tiempo.
const MARGEN_APAGADO_MS = 10_000;
let apagando = false;

const apagar = async (senal) => {
  // Docker manda SIGTERM al contenedor y algunos supervisores lo repiten: sin esta guarda, la
  // segunda señal reentra mientras la primera todavía cierra y deja un error en el log del apagado.
  if (apagando) return;
  apagando = true;
  logger.info({ senal }, 'Apagando: no se aceptan peticiones nuevas');

  // El temporizador se arma ANTES de cerrar. Si una petición queda colgada, el proceso igual termina
  // en 10 segundos en vez de esperar para siempre a que el socket se libere. unref() para que este
  // temporizador no sea, él mismo, la razón de que el proceso siga vivo.
  const plazo = setTimeout(() => {
    logger.error('El apagado ordenado no terminó a tiempo: saliendo a la fuerza');
    process.exit(1);
  }, MARGEN_APAGADO_MS);
  plazo.unref();

  try {
    // Las tareas programadas primero: si una arranca justo ahora, abre una transacción contra una
    // base que estamos por cerrar.
    tareas.forEach((tarea) => tarea.detener());

    // close() deja de aceptar conexiones nuevas pero espera a que terminen las que están en curso.
    await new Promise((listo, fallo) => servidor.close((error) => (error ? fallo(error) : listo())));
    logger.info('Peticiones en vuelo terminadas');

    // La base al final: mientras haya una petición viva puede necesitarla.
    await sequelize.close();
    logger.info('Conexiones a la base cerradas. Adiós');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Falló el apagado ordenado');
    process.exit(1);
  }
};

['SIGTERM', 'SIGINT'].forEach((senal) => process.on(senal, () => apagar(senal)));
