// Iconos como SVG inline: sin fuente de iconos ni paquete nuevo (CLAUDE.md, economía de código).
// Son trazos de 24×24 con stroke-width 2 y currentColor, así que heredan el color y el tamaño de
// fuente del texto al que acompañan y no hay que mantener una paleta aparte.
//
// Existen porque el estado de una oferta no puede comunicarse solo con color: uno de cada doce
// hombres no distingue rojo de verde, y el estado es el producto (identidad-visual, "Semántica de
// estado"). Cada insignia lleva icono + texto + color, nunca uno solo de los tres.

const TRAZOS = {
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  calendario: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  archivado: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  maletin: 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z',
  modalidad: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5',
  personas: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.9M17 2.1a4 4 0 0 1 0 7.8',
  moneda: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 6v12M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.9-2.5 2s1.1 2 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5',
  lupa: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  edificio: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M4 21h16M8 7h4M8 11h4M8 15h4',
  // Escudo con visto: acompania a "coordinacion revisa cada oferta antes de publicarla" en la
  // portada. Revision previa, no aprobacion generica — por eso escudo y no solo un visto.
  revisado: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 11.5l2 2 4-4',
  // Candado del boton de iniciar sesion: refuerza que ahi se entra a algo privado.
  candado: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  // Sobre de la pantalla "revisa tu correo". Sobre cerrado y no un visto: la cuenta todavia no
  // esta verificada, y un visto ahi diria que el tramite termino cuando falta el paso del correo.
  sobre: 'M3 7.5 12 13l9-5.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// aria-hidden siempre: el icono acompaña a un texto que ya dice lo mismo. Anunciarlo por separado
// le repite la palabra a quien usa lector de pantalla.
export const icono = (nombre, { clase = 'icono' } = {}) => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', clase);
  const trazo = document.createElementNS(SVG_NS, 'path');
  trazo.setAttribute('d', TRAZOS[nombre] ?? TRAZOS.calendario);
  svg.append(trazo);
  return svg;
};

export const NOMBRES_ICONO = Object.keys(TRAZOS);
