'use strict';

// Vista materializada, no una tabla: se recalcula de noche (tareas/recalcularIndicadores.js), no
// en cada consulta (docs/02-modelo-de-datos.md). El índice único en empresa_id es obligatorio para
// poder refrescarla con CONCURRENTLY, que no bloquea lecturas mientras recalcula.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE MATERIALIZED VIEW empresa_indicadores AS
      WITH postulaciones_empresa AS (
        SELECT p.id, p.estado, p.respondida_por_empresa, p.created_at, o.empresa_id
        FROM postulaciones p
        JOIN ofertas o ON o.id = p.oferta_id
      ),
      -- Los cuatro estados de acá solo se alcanzan por actor 'empresa' (services/postulaciones/estados.js):
      -- no hace falta una columna de rol en postulacion_eventos para saber "lo movió la empresa".
      primer_movimiento_empresa AS (
        SELECT postulacion_id, MIN(created_at) AS ocurrido_at
        FROM postulacion_eventos
        WHERE estado_nuevo IN ('en_revision', 'entrevista', 'seleccionada', 'no_seleccionada')
        GROUP BY postulacion_id
      ),
      respuestas AS (
        SELECT
          pe.empresa_id,
          CASE WHEN COUNT(*) FILTER (WHERE pe.estado IN ('seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada')) > 0
            THEN (COUNT(*) FILTER (WHERE pe.estado IN ('seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada') AND pe.respondida_por_empresa))::double precision
               / COUNT(*) FILTER (WHERE pe.estado IN ('seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada'))
            ELSE NULL
          END AS tasa_respuesta,
          (AVG(EXTRACT(EPOCH FROM (pm.ocurrido_at - pe.created_at)) / 86400.0))::double precision AS dias_promedio_respuesta,
          -- Denominadores propios de tasa_respuesta/dias_promedio_respuesta: el umbral de "3 ofertas
          -- cerradas" no los cubre (audita una empresa con esas 3 ofertas y una sola postulación:
          -- tasa_respuesta=1 y dias_promedio_respuesta revelan el trato de ese caso puntual). El
          -- servicio los usa para un segundo umbral y nunca los devuelve al público.
          COUNT(*) FILTER (WHERE pe.estado IN ('seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada'))::integer AS postulaciones_terminales,
          COUNT(pm.ocurrido_at)::integer AS postulaciones_con_movimiento
        FROM postulaciones_empresa pe
        LEFT JOIN primer_movimiento_empresa pm ON pm.postulacion_id = pe.id
        GROUP BY pe.empresa_id
      ),
      cierres AS (
        SELECT
          empresa_id,
          COUNT(*) FILTER (WHERE estado = 'cerrada') AS ofertas_cerradas_total,
          CASE WHEN COUNT(*) FILTER (WHERE estado = 'cerrada') > 0
            THEN (COUNT(*) FILTER (WHERE estado = 'cerrada' AND resultado_declarado))::double precision
               / COUNT(*) FILTER (WHERE estado = 'cerrada')
            ELSE NULL
          END AS tasa_cierre_declarado
        FROM ofertas
        GROUP BY empresa_id
      ),
      publicadas AS (
        SELECT empresa_id, COUNT(*) AS ofertas_publicadas_12m
        FROM ofertas
        WHERE fecha_publicacion IS NOT NULL AND fecha_publicacion >= now() - interval '12 months'
        GROUP BY empresa_id
      )
      SELECT
        e.id AS empresa_id,
        respuestas.tasa_respuesta,
        respuestas.dias_promedio_respuesta,
        cierres.tasa_cierre_declarado,
        -- ::integer, no bigint: COUNT(*) es bigint en Postgres y node-pg lo devuelve como string
        -- para no perder precisión — a esta escala (ofertas de una facultad) integer alcanza de
        -- sobra, y evita que el JSON de respuesta mande "0" en vez de 0.
        COALESCE(cierres.ofertas_cerradas_total, 0)::integer AS ofertas_cerradas_total,
        COALESCE(publicadas.ofertas_publicadas_12m, 0)::integer AS ofertas_publicadas_12m,
        COALESCE(respuestas.postulaciones_terminales, 0)::integer AS postulaciones_terminales,
        COALESCE(respuestas.postulaciones_con_movimiento, 0)::integer AS postulaciones_con_movimiento,
        now() AS calculado_at
      FROM empresas e
      LEFT JOIN respuestas ON respuestas.empresa_id = e.id
      LEFT JOIN cierres ON cierres.empresa_id = e.id
      LEFT JOIN publicadas ON publicadas.empresa_id = e.id;
    `);

    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX empresa_indicadores_empresa_id_idx ON empresa_indicadores (empresa_id);',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP MATERIALIZED VIEW IF EXISTS empresa_indicadores;');
  },
};
