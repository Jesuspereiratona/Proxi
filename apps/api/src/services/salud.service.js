const sequelize = require('../config/database');
const env = require('../config/env');

const INICIO = Date.now();
const CACHE_MS = 5000; // /salud es pública y sin auth: sin esto, el límite de tasa (300/15min)
// permitiría abrir 300 conexiones a la base solo para responder el healthcheck.
let cache = null;

const verificarSalud = async () => {
  if (cache && Date.now() - cache.momento < CACHE_MS) return cache.resultado;

  let baseDeDatos;
  try {
    await sequelize.authenticate();
    baseDeDatos = { ok: true };
  } catch (error) {
    baseDeDatos = { ok: false, ...(env.esDesarrollo ? { error: error.message } : {}) };
  }

  const resultado = {
    estado: baseDeDatos.ok ? 'ok' : 'degradado',
    tiempoActivoSegundos: Math.floor((Date.now() - INICIO) / 1000),
    baseDeDatos,
  };
  cache = { momento: Date.now(), resultado };
  return resultado;
};

module.exports = { verificarSalud };
