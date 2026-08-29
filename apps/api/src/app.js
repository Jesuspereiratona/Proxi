const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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
// Un solo proxy inverso delante (nginx/plataforma de hosting). Sin esto, express-rate-limit usa la
// IP del proxy para todo el mundo y una sola persona puede agotar el límite para todos.
if (env.esProduccion) app.set('trust proxy', 1);
app.use(helmet());
// exposedHeaders: por defecto CORS oculta Content-Disposition al JS del navegador aunque la
// respuesta la traiga (docs/03-seguridad.md, descarga de CV) — sin esto, el cliente web no puede
// leer el nombre real del archivo al descargarlo con fetch (Fase 6, panel de estudiante).
app.use(cors({ origin: env.webUrl, credentials: true, exposedHeaders: ['Content-Disposition'] }));
app.use(pinoHttp({ logger, genReqId: () => crypto.randomUUID() }));
app.use(limitarTasa);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/v1', rutas);

app.use((req, res, next) => {
  next(new NoEncontrado(RUTA_NO_ENCONTRADA, 'El recurso solicitado no existe.'));
});

app.use(manejadorErrores);

module.exports = app;
