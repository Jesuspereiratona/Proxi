// Tarjetas fantasma mientras carga la vitrina.
//
// Reemplazan a un "Cargando…" suelto por una razón concreta de ESTE despliegue: el plan gratuito
// duerme el servidor a los 15 minutos, y despertarlo tarda hasta 50 segundos. Una palabra sola en
// una página vacía durante 50 segundos parece que la plataforma está rota. Manteniendo la forma de
// la lista, la página se siente viva y quien mira entiende que algo va a aparecer ahí.

const LINEAS = [
  { ancho: '55%', alto: '1.15rem' },
  { ancho: '35%', alto: '0.85rem' },
  { ancho: '70%', alto: '0.75rem' },
];

const bloque = ({ ancho, alto }) => {
  const div = document.createElement('div');
  div.className = 'esqueleto-bloque';
  div.style.width = ancho;
  div.style.height = alto;
  return div;
};

const tarjeta = () => {
  const card = document.createElement('div');
  // Misma clase que una tarjeta real: hereda el alto, el espaciado y el apilado en móvil sin
  // duplicar nada. Si la tarjeta cambia de forma, el esqueleto la sigue solo.
  card.className = 'card-oferta esqueleto';
  card.setAttribute('aria-hidden', 'true');

  const logo = document.createElement('div');
  logo.className = 'oferta-logo esqueleto-bloque';

  const cuerpo = document.createElement('div');
  cuerpo.className = 'oferta-cuerpo d-flex flex-column gap-2';
  cuerpo.append(...LINEAS.map(bloque));

  card.append(logo, cuerpo);
  return card;
};

// aria-hidden en cada tarjeta y el anuncio de verdad en el mensaje de estado, que ya es aria-live:
// un lector de pantalla no tiene nada que decir sobre tres rectángulos grises.
export const esqueletoDeLista = (cantidad = 3) => Array.from({ length: cantidad }, tarjeta);
