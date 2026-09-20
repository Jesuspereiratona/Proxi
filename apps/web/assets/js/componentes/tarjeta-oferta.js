import { calcularEstado } from './estado-oferta.js';
import { icono } from './iconos.js';
import { etiquetaModalidad, etiquetaJornada, etiquetaRemuneracion, etiquetaArea } from '../formato.js';
import { urlLogo } from '../api/logos.js';

// textContent en todo, nunca innerHTML: el contenido viene del servidor (título de una oferta,
// razón social de una empresa) y no se confía como si fuera HTML propio (docs/03-seguridad.md).

// Qué icono lleva cada estado de vigencia. Vive acá y no en estado-oferta.js a propósito:
// calcularEstado() es una función pura que se prueba sin DOM, y meterle un icono la ataría al
// navegador (docs/08-guia-visual.md).
const ICONO_ESTADO = { urgente: 'reloj', normal: 'calendario', vencida: 'archivado' };

export const crearInsigniaEstado = (estado) => {
  const insignia = document.createElement('span');
  insignia.className = `estado-oferta ${estado.clase}`;
  insignia.append(icono(ICONO_ESTADO[estado.clase] ?? 'calendario'));
  insignia.append(document.createTextNode(estado.texto));
  return insignia;
};

const crearDato = (nombreIcono, texto) => {
  const item = document.createElement('li');
  item.append(icono(nombreIcono));
  item.append(document.createTextNode(texto));
  return item;
};

const crearEtiqueta = (texto) => {
  const item = document.createElement('li');
  item.className = 'etiqueta';
  item.textContent = texto;
  return item;
};

// Ranura del logo de la empresa. Si la empresa subió uno y coordinación lo aprobó, va la imagen;
// si no, la inicial de la razón social, que al menos distingue una empresa de otra al escanear.
//
// aria-hidden en toda la ranura: la razón social está escrita al lado en texto, así que anunciar
// además "logo de X" le repite la misma palabra a quien usa lector de pantalla. Por lo mismo el
// alt del <img> va vacío, que es lo correcto para una imagen decorativa.
const crearLogo = (razonSocial, empresaId, tieneLogo) => {
  const caja = document.createElement('div');
  caja.className = 'oferta-logo';
  caja.setAttribute('aria-hidden', 'true');

  const inicial = razonSocial?.trim()?.[0];
  const pintarInicial = () => {
    caja.replaceChildren();
    if (inicial) caja.textContent = inicial.toUpperCase();
    else caja.append(icono('edificio'));
  };

  if (!tieneLogo) {
    pintarInicial();
    return caja;
  }

  const imagen = document.createElement('img');
  imagen.src = urlLogo(empresaId);
  imagen.alt = '';
  // loading=lazy: la vitrina trae veinte filas y el logo de la número dieciocho no hace falta hasta
  // que alguien baje hasta ella.
  imagen.loading = 'lazy';
  // Si no carga (retirado justo ahora, red caída) se cae a la inicial, no al ícono roto del
  // navegador en medio de la fila.
  imagen.addEventListener('error', pintarInicial);
  caja.append(imagen);
  return caja;
};

export const crearTarjetaOferta = (oferta) => {
  const estado = calcularEstado(oferta.fechaCierre);
  const razonSocial = oferta.Empresa?.razonSocial ?? '';

  const tarjeta = document.createElement('article');
  tarjeta.className = 'card-oferta';

  const cuerpo = document.createElement('div');
  cuerpo.className = 'oferta-cuerpo';

  // El título es el enlace, no la tarjeta entera: la tarjeta ya contiene un botón, y un <a>
  // dentro de otro <a> es HTML inválido y deja el botón inalcanzable por teclado.
  const titulo = document.createElement('h2');
  titulo.className = 'oferta-titulo';
  const enlace = document.createElement('a');
  enlace.href = `oferta.html?id=${oferta.id}`;
  enlace.textContent = oferta.titulo;
  titulo.append(enlace);

  const empresa = document.createElement('p');
  empresa.className = 'oferta-empresa';
  empresa.textContent = razonSocial;

  const meta = document.createElement('ul');
  meta.className = 'oferta-meta';
  if (oferta.comuna) meta.append(crearDato('pin', oferta.comuna));
  if (oferta.modalidad) meta.append(crearDato('modalidad', etiquetaModalidad(oferta.modalidad)));
  if (oferta.jornada) meta.append(crearDato('maletin', etiquetaJornada(oferta.jornada)));
  meta.append(crearDato('moneda', etiquetaRemuneracion(oferta.remunerada, oferta.montoMensual)));
  if (oferta.cupos > 1) meta.append(crearDato('personas', `${oferta.cupos} cupos`));

  const etiquetas = document.createElement('ul');
  etiquetas.className = 'oferta-etiquetas';
  if (oferta.area) etiquetas.append(crearEtiqueta(etiquetaArea(oferta.area)));

  cuerpo.append(titulo, empresa, meta);
  if (etiquetas.childElementCount > 0) cuerpo.append(etiquetas);

  const lateral = document.createElement('div');
  lateral.className = 'oferta-lateral';
  const boton = document.createElement('a');
  boton.href = `oferta.html?id=${oferta.id}`;
  // Contorno y no relleno: la insignia de urgencia ya usa el naranja sólido, y dos naranjas en la
  // misma fila compiten hasta que ninguno destaca. La urgencia es lo único que debe llamar la
  // atención en una tarjeta (identidad-visual, 'Restricción').
  boton.className = 'btn btn-outline-primary btn-sm';
  // El botón repite el destino del título, así que para un lector de pantalla queda "Ver y
  // postular" sin decir a qué: el aria-label le devuelve el contexto sin ensuciar la pantalla.
  boton.setAttribute('aria-label', `Ver y postular a ${oferta.titulo}`);
  boton.textContent = 'Ver y postular';
  lateral.append(crearInsigniaEstado(estado), boton);

  tarjeta.append(crearLogo(razonSocial, oferta.empresaId, oferta.tieneLogo), cuerpo, lateral);
  return tarjeta;
};
