const { sequelize } = require('../models');

// SQL crudo y no el ORM: son cuatro agregaciones sobre tres tablas, y escribirlas con `group` y
// `literal` de Sequelize daría el mismo SQL con más ruido alrededor. Mismo criterio que
// logos.repository.js.
//
// Ninguna consulta de acá toca `estudiantes` ni `usuarios`: se cuentan postulaciones, nunca se
// nombran postulantes (specs/14-panorama-de-coordinacion, regla 2).

const contarOfertasPorEstado = async () => {
  const [filas] = await sequelize.query(
    'SELECT estado, count(*)::int AS cantidad FROM ofertas GROUP BY estado',
  );
  return Object.fromEntries(filas.map((f) => [f.estado, f.cantidad]));
};

const contarEmpresasPorEstado = async () => {
  const [filas] = await sequelize.query(
    'SELECT estado_validacion AS estado, count(*)::int AS cantidad FROM empresas GROUP BY estado_validacion',
  );
  return Object.fromEntries(filas.map((f) => [f.estado, f.cantidad]));
};

// Por área, solo ofertas publicadas: las áreas de un borrador que nadie aprobó no son demanda real.
// El LEFT JOIN es lo que permite que un área con ofertas y cero postulaciones aparezca con un 0 en
// vez de desaparecer — que es justamente el caso que interesa ver.
const resumirPorArea = async () => {
  const [filas] = await sequelize.query(
    `SELECT o.area,
            count(DISTINCT o.id)::int AS ofertas,
            coalesce(sum(o.cupos), 0)::int AS cupos,
            count(p.id)::int AS postulaciones
       FROM ofertas o
       LEFT JOIN postulaciones p ON p.oferta_id = o.id
      WHERE o.estado = 'publicada'
      GROUP BY o.area
      ORDER BY count(p.id) DESC, o.area ASC`,
  );
  return filas.map((f) => ({ ...f, area: f.area }));
};

// Dónde ESTÁN las postulaciones, no por cuántos pasos pasaron: interesa el atasco, no el recorrido.
const contarEmbudo = async () => {
  const [filas] = await sequelize.query(
    'SELECT estado, count(*)::int AS cantidad FROM postulaciones GROUP BY estado',
  );
  return Object.fromEntries(filas.map((f) => [f.estado, f.cantidad]));
};

// La consulta más accionable del panorama: una oferta publicada hace semanas sin una sola
// postulación suele significar algo arreglable —requisitos imposibles, área mal escrita, no
// remunerada— y hoy nadie se entera hasta que cierra vacía.
const ofertasSinPostulantes = async (diasMinimos) => {
  const [filas] = await sequelize.query(
    `SELECT o.id, o.titulo, o.area, e.razon_social AS empresa,
            o.fecha_cierre AS "fechaCierre",
            EXTRACT(DAY FROM now() - o.fecha_publicacion)::int AS "diasPublicada"
       FROM ofertas o
       JOIN empresas e ON e.id = o.empresa_id
      WHERE o.estado = 'publicada'
        AND o.fecha_publicacion <= now() - ($1::int * INTERVAL '1 day')
        AND NOT EXISTS (SELECT 1 FROM postulaciones p WHERE p.oferta_id = o.id)
      ORDER BY o.fecha_publicacion ASC`,
    { bind: [diasMinimos] },
  );
  return filas.map((f) => ({ ...f, id: String(f.id) }));
};

module.exports = {
  contarOfertasPorEstado,
  contarEmpresasPorEstado,
  resumirPorArea,
  contarEmbudo,
  ofertasSinPostulantes,
};
