const { Op } = require('sequelize');
const { AuditoriaAcceso } = require('../../models');
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

module.exports = { procesarRetencion };
