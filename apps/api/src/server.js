const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const cerrarOfertasVencidas = require('./tareas/cerrarOfertasVencidas');
const marcarSinRespuesta = require('./tareas/marcarSinRespuesta');

process.on('unhandledRejection', (error) => {
  logger.fatal(error, 'unhandledRejection');
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  logger.fatal(error, 'uncaughtException');
  process.exit(1);
});

app.listen(env.puerto, () => {
  logger.info(`Proxi API escuchando en el puerto ${env.puerto}`);
});

cerrarOfertasVencidas.programar();
marcarSinRespuesta.programar();
