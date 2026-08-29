const env = require('../../config/env');

// Pura, con reloj inyectado: se prueba con fechas fijas, mismo patrón que
// services/ofertas/reglas.js fechaLimiteDeclaracion.
const fechaLimiteSla = (ahora = new Date()) => new Date(ahora.getTime() - env.slaRespuestaDias * 24 * 60 * 60 * 1000);

module.exports = { fechaLimiteSla };
