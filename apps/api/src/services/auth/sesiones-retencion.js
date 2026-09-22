const { Op } = require('sequelize');
const { Sesion } = require('../../models');
const env = require('../../config/env');

// Purga de sesiones agotadas (revisión de seguridad del 2026-09-22).
//
// `sesiones` guarda `ip` y `user_agent` — exactamente el mismo dato de red al que
// specs/11-retencion-de-auditoria le puso un plazo en `auditoria_accesos`— y no tenía ninguna
// regla: la tabla crecía para siempre. Guardar la IP de alguien indefinidamente en una tabla
// contradice la minimización tan directamente en `sesiones` como contradecía en la auditoría.
//
// Por qué acá el borrado es de una sola etapa y no de dos: una sesión NO es evidencia de acceso a
// datos personales. Lo que hay que poder demostrar —quién vio el CV de quién— vive en
// `auditoria_accesos`, que tiene su propio plazo de 24 meses. Una sesión ya vencida o revocada solo
// sirve para investigar un incidente reciente; pasada esa ventana es dato de red sin propósito.
const purgarAgotadas = async (ahora = new Date()) => {
  const limite = new Date(ahora);
  limite.setDate(limite.getDate() - env.retencionSesionesDias);

  // Vencida O revocada, y además vieja. Una sesión revocada ayer sigue sirviendo para investigar
  // "me robaron la cuenta el martes"; una vencida hace medio año, no.
  return Sesion.destroy({
    where: {
      [Op.and]: [
        { [Op.or]: [{ expiraAt: { [Op.lt]: limite } }, { revocadaAt: { [Op.lt]: limite } }] },
      ],
    },
  });
};

module.exports = { purgarAgotadas };
