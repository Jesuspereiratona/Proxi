// Tabla de transiciones como datos, mismo patrón que services/ofertas/estados.js.
//
// "no_seleccionada" desde cualquiera de los tres estados no terminales: la empresa puede rechazar
// en cualquier punto del proceso, no solo al final (docs/02-modelo-de-datos.md).
// "retirada" por 'estudiante' desde cualquier estado no terminal.
// "sin_respuesta" por 'sistema' desde cualquier estado no terminal: lo dispara
// tareas/marcarSinRespuesta.js cuando pasa el SLA sin que la empresa mueva la postulación.
const TRANSICIONES = {
  recibida: { en_revision: ['empresa'], no_seleccionada: ['empresa'], retirada: ['estudiante'], sin_respuesta: ['sistema'] },
  en_revision: { entrevista: ['empresa'], no_seleccionada: ['empresa'], retirada: ['estudiante'], sin_respuesta: ['sistema'] },
  entrevista: { seleccionada: ['empresa'], no_seleccionada: ['empresa'], retirada: ['estudiante'], sin_respuesta: ['sistema'] },
  seleccionada: {},
  no_seleccionada: {},
  sin_respuesta: {},
  retirada: {},
};

const puedeTransicionar = (desde, hacia, actor) => Boolean(TRANSICIONES[desde]?.[hacia]?.includes(actor));

module.exports = { TRANSICIONES, puedeTransicionar };
