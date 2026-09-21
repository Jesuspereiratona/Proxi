const { Op } = require('sequelize');
const { AuditoriaAcceso, sequelize } = require('../../models');
const env = require('../../config/env');

// Retención de `auditoria_accesos` en dos etapas (specs/11-retencion-de-auditoria/spec.md).
//
// Una fila de auditoría tiene dos partes con valor y vida útil distintos: "quién accedió a qué y
// cuándo" es evidencia que puede hacer falta durante años; la IP y el navegador solo sirven para
// investigar una brecha reciente. Borrar la fila entera a los 12 meses tiraría la evidencia junto
// con el dato de red; dejarla intacta guardaría la IP de una persona mucho después de que sirva
// para algo, incluso de alguien que ya ejerció su derecho de supresión.
//
// Por eso: primero se anula el dato de red, y mucho después se borra la fila.

const mesesAtras = (ahora, meses) => {
  const fecha = new Date(ahora);
  fecha.setMonth(fecha.getMonth() - meses);
  return fecha;
};

// `ahora` inyectable, mismo patrón que cuenta.service.js procesarRetencion: sin esto no hay forma
// de probar una ventana de 12 meses sin esperar 12 meses.
const procesarRetencion = async (ahora = new Date()) => {
  const limiteAnonimizar = mesesAtras(ahora, env.retencionAuditoriaMeses);
  const limiteBorrar = mesesAtras(ahora, env.borradoAuditoriaMeses);

  // El borrado va PRIMERO. Al revés, las filas más viejas se anonimizarían en la misma corrida en
  // que iban a borrarse, y el conteo de "anonimizadas" incluiría filas que ya no existen — un
  // número que no significa nada para quien lea el log.
  const borradas = await AuditoriaAcceso.destroy({ where: { createdAt: { [Op.lt]: limiteBorrar } } });

  // El WHERE exige que quede algo que anular: sin esto, cada corrida diaria reescribiría las mismas
  // filas ya anonimizadas para siempre, y el conteo nunca bajaría a cero (criterio 5 de la spec).
  const [anonimizadas] = await AuditoriaAcceso.update(
    { ip: null, userAgent: null },
    {
      where: {
        createdAt: { [Op.lt]: limiteAnonimizar },
        [Op.or]: [{ ip: { [Op.ne]: null } }, { userAgent: { [Op.ne]: null } }],
      },
    },
  );

  return { anonimizadas, borradas };
};

// --- Vigilancia de accesos (specs/12-vigilancia-de-accesos/spec.md) ---
//
// Hueco 1 del simulacro de brecha: la tabla es evidencia impecable DESPUÉS de que alguien avise, y
// nadie la mira antes. Si la cuenta de coordinación queda comprometida y alguien descarga 300 CV en
// una tarde, las 300 filas se escriben correctamente y no pasa nada. La Ley 21.719 da 72 horas
// desde que se DETECTA una brecha; un control que solo reconstruye los hechos no ayuda a detectarla.

// Solo las acciones que tocan datos personales de un estudiante. `eliminar_cuenta` y `retirar_logo`
// son gestión: su volumen no dice nada sobre una fuga.
const ACCIONES_VIGILADAS = ['descargar_cv', 'ver_rut', 'ver_postulantes', 'exportar_datos'];

// Piso absoluto. Sin esto, en un sistema recién estrenado —donde la historia está casi vacía—
// cualquier cosa parece un pico y la alerta se vuelve ruido que nadie mira.
const PISO_ABSOLUTO = 30;
// Cuántas veces su propio promedio diario tiene que superar alguien para llamar la atención.
const FACTOR = 5;
const DIAS_LINEA_BASE = 30;

const detectarAccesosAnomalos = async (ahora = new Date()) => {
  const inicioVentana = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const inicioLineaBase = new Date(inicioVentana.getTime() - DIAS_LINEA_BASE * 24 * 60 * 60 * 1000);

  // Una sola consulta: el conteo del último día y el promedio diario de los 30 anteriores, por
  // usuario. Hacerlo en dos viajes obligaría a unir en JavaScript dos listas que la base ya sabe
  // cruzar, y a traerse usuarios que no hicieron nada hoy.
  const [filas] = await sequelize.query(
    `SELECT a.usuario_id AS "usuarioId",
            u.rol AS rol,
            count(*) FILTER (WHERE a.created_at >= $2::timestamptz) AS accesos,
            count(*) FILTER (WHERE a.created_at < $2::timestamptz)::numeric / $4::numeric AS "lineaBase"
       FROM auditoria_accesos a
       JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.accion = ANY($1::text[])
        AND a.created_at >= $3::timestamptz
      GROUP BY a.usuario_id, u.rol
     HAVING count(*) FILTER (WHERE a.created_at >= $2::timestamptz) >= $5::bigint`,
    { bind: [ACCIONES_VIGILADAS, inicioVentana, inicioLineaBase, DIAS_LINEA_BASE, PISO_ABSOLUTO] },
  );

  // La alerta NO lleva correo, RUT ni nombre: solo el id, el rol y los números. La regla dura de
  // CLAUDE.md sobre qué no se registra no tiene una excepción para las alertas — y esto termina en
  // un log y en la respuesta de un endpoint.
  return filas
    .map((f) => ({
      usuarioId: String(f.usuarioId),
      rol: f.rol,
      accesos: Number(f.accesos),
      lineaBase: Math.round(Number(f.lineaBase) * 10) / 10,
    }))
    // Sin historia (lineaBase 0) basta el piso, que el HAVING ya garantizó. Con historia, además
    // hay que salirse del propio patrón: quien hace 200 al día todos los días no es una anomalía.
    .filter((f) => f.lineaBase === 0 || f.accesos >= f.lineaBase * FACTOR);
};

module.exports = { procesarRetencion, detectarAccesosAnomalos, ACCIONES_VIGILADAS, PISO_ABSOLUTO };
