import { calcularEstado } from './estado-oferta.js';

// textContent en todo, nunca innerHTML: el contenido viene del servidor (título, descripción de
// una oferta) y no se confía como si fuera HTML propio (docs/03-seguridad.md).
export const crearTarjetaOferta = (oferta) => {
  const estado = calcularEstado(oferta.fechaCierre);

  const columna = document.createElement('div');
  columna.className = 'col-12 col-md-6 col-lg-4';

  const enlace = document.createElement('a');
  enlace.href = `oferta.html?id=${oferta.id}`;
  enlace.className = 'text-decoration-none';

  const tarjeta = document.createElement('article');
  tarjeta.className = 'card card-oferta h-100';

  // .card-body, no hijos directos de .card: Bootstrap 5 define .card como
  // display:flex;flex-direction:column, así que un hijo directo se estira al ancho completo de
  // la tarjeta (align-items:stretch heredado) — se verificó con getComputedStyle que la insignia
  // medía el ancho entero de la tarjeta en vez de su contenido. .card-body no hereda ese flex.
  const cuerpo = document.createElement('div');
  cuerpo.className = 'card-body';

  const insignia = document.createElement('span');
  insignia.className = `estado-oferta ${estado.clase}`;
  insignia.textContent = estado.texto;

  const titulo = document.createElement('h2');
  titulo.className = 'h5 mt-2 mb-1 text-body';
  titulo.textContent = oferta.titulo;

  const empresa = document.createElement('p');
  empresa.className = 'small fw-medium mb-1';
  empresa.textContent = oferta.Empresa?.razonSocial ?? '';

  const detalle = document.createElement('p');
  detalle.className = 'small text-body-secondary mb-0';
  const partes = [oferta.modalidad, oferta.comuna, oferta.remunerada ? 'Remunerada' : 'No remunerada'].filter(Boolean);
  detalle.textContent = partes.join(' · ');

  cuerpo.append(insignia, titulo, empresa, detalle);
  tarjeta.append(cuerpo);
  enlace.append(tarjeta);
  columna.append(enlace);
  return columna;
};
