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

// Clase CSS de la insignia de estado (docs/08-guia-visual.md, sección "Postulación") — tres de los
// siete estados comparten la misma insignia neutra ("en curso"): para quien mira la tarjeta, antes
// de la entrevista no hay una distinción visual que valga la pena, todas son "todavía sin resolver".
const CLASE_POR_ESTADO = {
  recibida: 'en-curso',
  en_revision: 'en-curso',
  entrevista: 'en-curso',
  seleccionada: 'seleccionada',
  no_seleccionada: 'no-seleccionada',
  sin_respuesta: 'sin-respuesta',
  retirada: 'retirada',
};

export const claseEstadoPostulacion = (estado) => CLASE_POR_ESTADO[estado] ?? 'en-curso';

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

// Pintado de la línea de tiempo, compartido por el panel de estudiante y el de postulantes de la
// empresa. Las dos páginas tenían la suya, y las dos eran una lista de texto corrido
// ("Recibida — Tú — 21 sept 2026, 12:31") con un borde a la izquierda: ahí no se distingue dónde
// termina un evento y empieza el siguiente (feedback del profesor, 23-09).
//
// Es <ol> y no <ul> porque el orden ES el dato: son los estados por los que pasó la postulación.
// El punto de cada hito lo dibuja el CSS; acá solo va la estructura.
export const pintarLineaTiempo = (eventos, formatoFechaHora) => {
  const lista = document.createElement('ol');
  lista.className = 'linea-tiempo';

  for (const evento of eventos) {
    const item = document.createElement('li');

    const fecha = document.createElement('time');
    fecha.className = 'lt-fecha';
    fecha.dateTime = evento.fecha.toISOString();
    fecha.textContent = formatoFechaHora(evento.fecha);

    const texto = document.createElement('p');
    texto.className = 'lt-texto';
    texto.textContent = evento.texto;

    const quien = document.createElement('span');
    quien.className = 'lt-quien';
    quien.textContent = evento.quien;
    texto.append(' ', quien);

    item.append(fecha, texto);

    if (evento.motivo) {
      const motivo = document.createElement('p');
      motivo.className = 'lt-motivo';
      motivo.textContent = evento.motivo;
      item.append(motivo);
    }
    lista.append(item);
  }
  return lista;
};
