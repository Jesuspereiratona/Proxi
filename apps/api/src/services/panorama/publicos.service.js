const { sequelize } = require('../../models');

// Las tres cifras de la portada. Son públicas y sin sesión: es la promesa de Proxi puesta a la
// vista —"ninguna oferta sin vigencia, ninguna postulación sin respuesta"— y una promesa que no se
// puede comprobar no sirve de nada.
//
// No exponen a nadie: son conteos agregados, sin nombres, sin empresas, sin postulantes.

// Misma disciplina que indicadores.service.js para el perfil de una empresa: por debajo de esto, un
// promedio dice más sobre el azar que sobre el comportamiento. Con tres postulaciones respondidas,
// "1 día promedio" solo significa que alguien estaba conectado ese martes. Se devuelve null y la
// portada no dibuja la cifra, en vez de publicar un número que aparenta precisión.
const UMBRAL_POSTULACIONES = 5;

const obtener = async () => {
  const [[fila]] = await sequelize.query(
    `SELECT
       (SELECT count(*) FROM ofertas
         WHERE estado = 'publicada' AND fecha_cierre > now())::int AS "ofertasVigentes",
       (SELECT count(*) FROM postulaciones WHERE estado = 'sin_respuesta')::int AS "sinRespuesta",
       -- Solo las que la empresa efectivamente movió: incluir las que murieron en sin_respuesta
       -- mezclaría el plazo del SLA con el tiempo que tardó una persona en contestar, y el promedio
       -- diría cualquier cosa.
       (SELECT count(*) FROM postulaciones
         WHERE estado IN ('en_revision', 'entrevista', 'seleccionada', 'no_seleccionada'))::int AS "respondidas",
       (SELECT avg(EXTRACT(EPOCH FROM (p.estado_actualizado_at - p.created_at)) / 86400)
          FROM postulaciones p
         WHERE p.estado IN ('en_revision', 'entrevista', 'seleccionada', 'no_seleccionada')) AS "diasPromedio"`,
  );

  const hayHistorial = fila.respondidas >= UMBRAL_POSTULACIONES;
  return {
    ofertasVigentes: fila.ofertasVigentes,
    // null, no cero: "todavía no hay datos" y "cero postulaciones sin respuesta" son cosas
    // distintas, y la segunda es justamente el logro que la portada quiere mostrar.
    postulacionesSinRespuesta: hayHistorial ? fila.sinRespuesta : null,
    diasPromedioRespuesta: hayHistorial && fila.diasPromedio != null
      ? Math.round(Number(fila.diasPromedio) * 10) / 10
      : null,
    suficienteHistorial: hayHistorial,
  };
};

module.exports = { obtener, UMBRAL_POSTULACIONES };
