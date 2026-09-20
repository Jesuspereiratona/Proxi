const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

// SQL crudo y no un `include` de Sequelize porque el camino archivos → empresas no es una asociación
// del modelo: `archivos.propietario_usuario_id` apunta a `usuarios`, y la empresa cuelga de ahí. Un
// include anidado (Archivo → Usuario → Empresa) expresa lo mismo con dos JOIN implícitos y deja la
// condición de validada más lejos de la de logo aprobado, que es justo lo que no queremos separar.

// Las tres condiciones que hacen "público" a un logo van en UNA consulta: aprobado, no retirado, y
// empresa VALIDADA. Partirlas en dos pasos encadenados invita a que alguien, más adelante, use solo
// la primera mitad y termine sirviendo el logo de una empresa suspendida en la vitrina.
const obtenerLogoPublico = async (empresaId) => {
  const [fila] = await sequelize.query(
    `SELECT a.id, a.mime, a.contenido, a.updated_at AS "actualizadoAt"
       FROM archivos a
       JOIN empresas e ON e.usuario_id = a.propietario_usuario_id
      WHERE e.id = $1::bigint
        AND e.estado_validacion = 'validada'
        AND a.tipo = 'logo'
        AND a.aprobado_at IS NOT NULL
        AND a.retirado_at IS NULL
      ORDER BY a.aprobado_at DESC
      LIMIT 1`,
    { bind: [empresaId], type: QueryTypes.SELECT },
  );
  return fila ?? null;
};

// Para el listado público de ofertas: cuáles de estas empresas tienen logo vigente. Una consulta
// para toda la página, no una por fila — la vitrina muestra veinte ofertas por página.
const idsDeEmpresasConLogo = async (empresaIds) => {
  if (empresaIds.length === 0) return new Set();
  const filas = await sequelize.query(
    `SELECT DISTINCT e.id
       FROM archivos a
       JOIN empresas e ON e.usuario_id = a.propietario_usuario_id
      WHERE e.id = ANY($1::bigint[])
        AND e.estado_validacion = 'validada'
        AND a.tipo = 'logo'
        AND a.aprobado_at IS NOT NULL
        AND a.retirado_at IS NULL`,
    { bind: [empresaIds.map(String)], type: QueryTypes.SELECT },
  );
  return new Set(filas.map((f) => String(f.id)));
};

// Los logos que esperan aprobación, con el nombre de la empresa para que coordinación sepa de quién
// es cada imagen. Sin los bytes: se piden aparte, uno por uno, al mostrarlos.
const listarLogosPendientes = () => sequelize.query(
  `SELECT a.id, a.mime, a.tamano_bytes AS "tamanoBytes", a.created_at AS "createdAt",
          e.id AS "empresaId", e.razon_social AS "razonSocial", e.estado_validacion AS "estadoValidacion"
     FROM archivos a
     JOIN empresas e ON e.usuario_id = a.propietario_usuario_id
    WHERE a.tipo = 'logo'
      AND a.aprobado_at IS NULL
      AND a.retirado_at IS NULL
    ORDER BY a.created_at ASC`,
  { type: QueryTypes.SELECT },
);

module.exports = { obtenerLogoPublico, idsDeEmpresasConLogo, listarLogosPendientes };
