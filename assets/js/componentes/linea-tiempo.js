// Funciones puras: sin DOM, se prueban directo con node --test.

const TEXTO_ESTADO = {
  recibida: 'Recibida',
  en_revision: 'En revisión',
  entrevista: 'En proceso de entrevista',
  seleccionada: 'Seleccionada',
  no_seleccionada: 'No seleccionada',
  sin_respuesta: 'Sin respuesta',
  retirada: 'Retirada',
};

export const textoEstado = (estado) => TEXTO_ESTADO[estado] ?? estado;

// Quién mueve cada estado se deduce del propio estado, no de actorUsuarioId: los cuatro estados
// intermedios solo son alcanzables por la empresa (services/postulaciones/estados.js, Fase 4),
// "recibida" y "retirada" siempre son del estudiante, y "sin_respuesta" siempre del sistema — el
// mismo razonamiento que ya usa la vista materializada de indicadores (Fase 5) para no necesitar
// una columna de rol en postulacion_eventos.
const QUIEN_POR_ESTADO = {
  recibida: 'Tú',
  en_revision: 'La empresa',
  entrevista: 'La empresa',
  seleccionada: 'La empresa',
  no_seleccionada: 'La empresa',
  sin_respuesta: 'El sistema',
  retirada: 'Tú',
};

export const quienMovio = (estado) => QUIEN_POR_ESTADO[estado] ?? 'Alguien';

// Traduce la lista cruda de PostulacionEvento (Fase 6) a algo listo para pintar: texto, quién, y
// la fecha como Date real (no el string ISO crudo). Sin motivo ni actorUsuarioId a propósito: la
// API ya no los manda por este camino (auditoría del panel de estudiante — motivo es una nota
// pensada para coordinación o para quien la escribe, no para la otra parte de la postulación).
export const formatoLineaTiempo = (eventos = []) =>
  eventos.map((evento) => ({
    texto: textoEstado(evento.estadoNuevo),
    quien: quienMovio(evento.estadoNuevo),
    fecha: new Date(evento.createdAt),
  }));
