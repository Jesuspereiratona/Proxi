const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');

const env = require('./config/env');
const logger = require('./config/logger');
const limitarTasa = require('./middlewares/limitar-tasa.middleware');
const manejadorErrores = require('./middlewares/manejador-errores.middleware');
const { NoEncontrado } = require('./errors');
const { RUTA_NO_ENCONTRADA } = require('@proxi/errores');
const rutas = require('./routes');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.webUrl, credentials: true }));
app.use(pinoHttp({ logger }));
app.use(limitarTasa);
app.use(express.json({ limit: '1mb' }));

app.use('/api/v1', rutas);

app.use((req, res, next) => {
  next(new NoEncontrado(RUTA_NO_ENCONTRADA, 'El recurso solicitado no existe.'));
});

app.use(manejadorErrores);

module.exports = app;
