const asyncHandler = require('../utils/async-handler');
const { Conflicto } = require('../errors');
const { TAREAS_EN_CURSO } = require('@proxi/errores');
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
// Una corrida a la vez. Con el secreto en mano, N llamadas simultáneas ejecutaban las cuatro tareas
// en paralelo consigo mismas: comprobado con 8 POST a la vez, ocho 200 (auditoría de seguridad). La
// pasada de retención hace hasta 50 eliminarCuenta, cada uno con un bcrypt de costo 12, así que
// amplificar eso 300 veces por ventana tumba una instancia gratuita de un solo worker.
//
// Una bandera en memoria basta porque el plan gratuito corre UN proceso. El día que haya réplicas,
// esto necesita el mismo pg_advisory_lock que ya pide el roadmap para el cron interno.
let corriendo = false;

const ejecutar = asyncHandler(async (req, res) => {
  if (corriendo) throw new Conflicto(TAREAS_EN_CURSO, 'Las tareas ya se están ejecutando.');
  corriendo = true;
  try {
    const resultado = {};
    for (const [nombre, tarea] of Object.entries(TAREAS)) {
      await tarea.ejecutar();
      resultado[nombre] = tarea.obtenerEstado();
    }
    res.json({ tareas: resultado });
  } finally {
    // finally y no después del res.json: si una tarea lanzara pese a su propio catch, la bandera
    // quedaría en true y la ruta respondería 409 para siempre hasta reiniciar el proceso.
    corriendo = false;
  }
});

module.exports = { ejecutar };
