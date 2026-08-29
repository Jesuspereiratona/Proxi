const { ReglaDeNegocio } = require('../../errors');
const { EMPRESA_NO_VALIDADA } = require('@proxi/errores');

// La usará Fase 3 antes de publicar una oferta. Se prueba sola, sin rutas ni base de datos.
const verificarValidada = (empresa) => {
  if (empresa.estadoValidacion !== 'validada') {
    throw new ReglaDeNegocio(EMPRESA_NO_VALIDADA, 'La empresa todavía no está validada por coordinación.');
  }
};

module.exports = { verificarValidada };
