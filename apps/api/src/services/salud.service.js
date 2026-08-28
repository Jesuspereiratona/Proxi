const sequelize = require('../config/database');
const env = require('../config/env');

const INICIO = Date.now();

const verificarSalud = async () => {
  let baseDeDatos;
  try {
    await sequelize.authenticate();
    baseDeDatos = { ok: true };
  } catch (error) {
    baseDeDatos = { ok: false, ...(env.nodeEnv !== 'production' ? { error: error.message } : {}) };
  }

  return {
    estado: baseDeDatos.ok ? 'ok' : 'degradado',
    tiempoActivoSegundos: Math.floor((Date.now() - INICIO) / 1000),
    baseDeDatos,
  };
};

module.exports = { verificarSalud };
