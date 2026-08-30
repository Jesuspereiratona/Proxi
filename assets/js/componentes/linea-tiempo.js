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
const ROL_POR_ESTADO = {
  recibida: 'estudiante',
  en_revision: 'empresa',
  entrevista: 'empresa',
  seleccionada: 'empresa',
  no_seleccionada: 'empresa',
  sin_respuesta: 'sistema',
  retirada: 'estudiante',
};

const NOMBRE_ROL = { estudiante: 'El estudiante', empresa: 'La empresa', sistema: 'El sistema' };

// rolPropio decide quién se lee a sí mismo como "Tú" (panel de estudiante y panel de empresa
// comparten esta función, Fase 6 parte 4 — cada uno mira la misma línea de tiempo desde su propio
// lado). Por defecto 'estudiante': la primera pantalla que existió y sigue siendo la más usada.
export const quienMovio = (estado, rolPropio = 'estudiante') => {
  const rol = ROL_POR_ESTADO[estado];
  if (!rol) return 'Alguien';
  return rol === rolPropio ? 'Tú' : NOMBRE_ROL[rol];
};

// Traduce la lista cruda de PostulacionEvento (Fase 6) a algo listo para pintar: texto, quién, y
// la fecha como Date real (no el string ISO crudo). Sin actorUsuarioId nunca: no le sirve a
// ninguna interfaz para nada que quienMovio() no resuelva ya. motivo solo se agrega cuando
// rolPropio es 'empresa' y el evento lo trae — es la nota que la propia empresa escribió
// (postulaciones.service.js obtenerPropiaDeEmpresa la incluye solo en ese camino); al estudiante
// nunca le llega por acá (auditoría del panel de estudiante y del panel de empresa).
export const formatoLineaTiempo = (eventos = [], rolPropio = 'estudiante') =>
  eventos.map((evento) => {
    const base = {
      texto: textoEstado(evento.estadoNuevo),
      quien: quienMovio(evento.estadoNuevo, rolPropio),
      fecha: new Date(evento.createdAt),
    };
    return rolPropio === 'empresa' && evento.motivo ? { ...base, motivo: evento.motivo } : base;
  });
