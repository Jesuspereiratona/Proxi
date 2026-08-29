// Tabla de transiciones como datos, no como cadena de if (mismo patrón previsto para
// services/ofertas/estados.js en Fase 3). "rechazada -> pendiente" y "validada -> pendiente" no
// tienen ruta propia: actualizarPropio() las dispara automáticamente al editar un perfil rechazado,
// o al cambiar razón social / RUT de una empresa ya validada (auditoría de Fase 2: sin esto, una
// empresa validada podía cambiarse la identidad sin que nadie volviera a revisarla).
const TRANSICIONES = {
  pendiente: { validada: ['coordinacion'], rechazada: ['coordinacion'] },
  validada: { pendiente: ['empresa'], suspendida: ['coordinacion'] },
  rechazada: { pendiente: ['empresa'] },
  suspendida: {},
};

const puedeTransicionar = (desde, hacia, actor) => Boolean(TRANSICIONES[desde]?.[hacia]?.includes(actor));

module.exports = { TRANSICIONES, puedeTransicionar };
