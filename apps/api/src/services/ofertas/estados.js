// Tabla de transiciones como datos, no como cadena de if (docs/01-arquitectura.md, mismo patrón que
// services/empresas/estados.js). Agregar un estado nuevo es agregar una fila, no editar lógica dispersa.
//
// "publicada -> borrador" y "en_revision -> borrador" por actor 'empresa' no tienen ruta propia: los
// dispara automáticamente ofertas.service.editar() cuando se toca contenido (no solo fechas/cupos)
// de una oferta que ya está en revisión o publicada — auditoría de Fase 3, sin esto una empresa podía
// reescribir una oferta aprobada sin que coordinación la revisara de nuevo.
// "en_revision -> borrador" por 'sistema' la usa cerrarPorSuspension(): una oferta que estaba en cola
// de revisión cuando su empresa se suspende no debe poder aprobarse después.
const TRANSICIONES = {
  borrador: { en_revision: ['empresa'] },
  en_revision: { publicada: ['coordinacion'], borrador: ['coordinacion', 'empresa', 'sistema'] },
  publicada: { cerrada: ['empresa', 'sistema'], borrador: ['empresa'] },
  cerrada: { archivada: ['sistema'] },
  archivada: {},
};

const puedeTransicionar = (desde, hacia, actor) => Boolean(TRANSICIONES[desde]?.[hacia]?.includes(actor));

module.exports = { TRANSICIONES, puedeTransicionar };
