const asyncHandler = require('../utils/async-handler');
const cerrarOfertasVencidas = require('../tareas/cerrarOfertasVencidas');
const marcarSinRespuesta = require('../tareas/marcarSinRespuesta');
const recalcularIndicadores = require('../tareas/recalcularIndicadores');
const procesarRetencionCv = require('../tareas/procesarRetencionCv');

// Mismo orden que en server.js. Una por una y no en paralelo: comparten la base y una de ellas
// (retención) borra cuentas — no conviene que corra mientras otra está leyendo esas mismas filas.
const TAREAS = {
  cerrarOfertasVencidas,
  marcarSinRespuesta,
  recalcularIndicadores,
  procesarRetencionCv,
};

// El disparador externo existe porque en un plan gratuito el proceso duerme, y un `node-cron`
// dormido no corre nunca. La diferencia central de Proxi es que ninguna oferta queda publicada sin
// vigencia y ninguna postulación sin respuesta: las dos las sostienen estas tareas.
//
// Cada `ejecutar()` ya atrapa su propio error y lo deja en su estado (nunca relanza), así que una
// tarea que falle no impide que corran las demás, igual que cuando las dispara el cron interno.
const ejecutar = asyncHandler(async (req, res) => {
  const resultado = {};
  for (const [nombre, tarea] of Object.entries(TAREAS)) {
    await tarea.ejecutar();
    resultado[nombre] = tarea.obtenerEstado();
  }
  res.json({ tareas: resultado });
});

module.exports = { ejecutar };
