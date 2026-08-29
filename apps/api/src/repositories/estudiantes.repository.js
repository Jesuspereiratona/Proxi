const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');
const env = require('../config/env');
const { normalizarRut } = require('../utils/rut');

// Único lugar del proyecto donde se llama pgp_sym_encrypt/pgp_sym_decrypt. Usa `bind`, no
// `replacements`: en Sequelize los `replacements` se interpolan en el texto del SQL antes de
// enviarlo (útil para nombres de tabla/columna, nunca para un valor secreto), mientras que `bind`
// viaja como parámetro real del protocolo y nunca toca la cadena de la sentencia. Con
// `replacements` el RUT en claro y RUT_CIFRADO_KEY completos quedaban en el SQL que loguea
// `config/database.js` en desarrollo, y en el log de errores de Postgres ante cualquier fallo
// (violación de unicidad, etc.) incluso en producción. `logging: false` es una segunda barrera por
// si algo reactiva el logging de consultas más adelante.
const COLUMNAS_SIN_RUT = `
  id, usuario_id AS "usuarioId", nombres, apellidos, rut_ultimos_4 AS "rutUltimos4",
  carrera, nivel, telefono, cv_archivo_id AS "cvArchivoId",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const crearConRutCifrado = async ({ usuarioId, nombres, apellidos, rut, carrera, nivel, telefono }) => {
  const rutNormalizado = normalizarRut(rut);
  const rutUltimos4 = rutNormalizado.slice(-4);

  const [fila] = await sequelize.query(
    `INSERT INTO estudiantes (usuario_id, nombres, apellidos, rut_cifrado, rut_ultimos_4, carrera, nivel, telefono, created_at, updated_at)
     VALUES ($1::bigint, $2::text, $3::text, pgp_sym_encrypt($4::text, $5::text), $6::text, $7::text, $8::int, $9::text, now(), now())
     RETURNING ${COLUMNAS_SIN_RUT}`,
    {
      bind: [usuarioId, nombres, apellidos, rutNormalizado, env.rutCifradoKey, rutUltimos4, carrera, nivel ?? null, telefono ?? null],
      type: QueryTypes.SELECT,
      logging: false,
    },
  );
  return fila;
};

const actualizarRut = async ({ usuarioId, rut }) => {
  const rutNormalizado = normalizarRut(rut);
  const rutUltimos4 = rutNormalizado.slice(-4);

  await sequelize.query(
    `UPDATE estudiantes
     SET rut_cifrado = pgp_sym_encrypt($1::text, $2::text), rut_ultimos_4 = $3::text, updated_at = now()
     WHERE usuario_id = $4::bigint`,
    { bind: [rutNormalizado, env.rutCifradoKey, rutUltimos4, usuarioId], logging: false },
  );
};

// Por el id propio de "estudiantes" (no el usuario_id): es la clave con la que el resto del modelo
// de datos referencia a un estudiante (p. ej. postulaciones.estudiante_id en Fase 4).
const obtenerRutDescifradoPorId = async (estudianteId) => {
  const [fila] = await sequelize.query(
    `SELECT pgp_sym_decrypt(rut_cifrado, $1::text) AS rut FROM estudiantes WHERE id = $2::bigint`,
    { bind: [env.rutCifradoKey, estudianteId], type: QueryTypes.SELECT, logging: false },
  );
  return fila ? fila.rut : null;
};

module.exports = { crearConRutCifrado, actualizarRut, obtenerRutDescifradoPorId };
