import { protegerPagina } from '../componentes/proteger-pagina.js';
import { obtenerDetallePropio } from '../api/ofertas.js';
import { listarDeOferta, obtenerDetalle, marcarEnRevision, marcarEntrevista, seleccionar, rechazar } from '../api/postulaciones.js';
import { textoEstado, claseEstadoPostulacion, formatoLineaTiempo } from '../componentes/linea-tiempo.js';
import { descargarArchivo, ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { logout } from '../api/sesion.js';

// Qué transición ofrecer desde cada estado, reflejo de services/postulaciones/estados.js para el
// actor 'empresa' — no una copia de la regla, solo de qué botón mostrar (el servidor decide si de
// verdad se puede, esto es UI: en una carrera entre dos pestañas el 409 ya conocido se traduce).
const SIGUIENTE_PASO = {
  recibida: { accion: marcarEnRevision, texto: 'Pasar a revisión' },
  en_revision: { accion: marcarEntrevista, texto: 'Pasar a entrevista' },
  entrevista: { accion: seleccionar, texto: 'Seleccionar' },
};
const ESTADOS_CON_RECHAZO = ['recibida', 'en_revision', 'entrevista'];

const usuario = await protegerPagina('empresa');
if (usuario) iniciar();

function iniciar() {
  const ofertaId = new URLSearchParams(window.location.search).get('ofertaId');
  const tituloOferta = document.getElementById('titulo-oferta');
  const lista = document.getElementById('lista');
  const mensajeEstado = document.getElementById('mensaje-estado');
  const botonCerrarSesion = document.getElementById('boton-cerrar-sesion');

  const mostrarMensaje = (texto) => {
    mensajeEstado.textContent = texto;
    mensajeEstado.hidden = !texto;
  };

  const mensajeDeError = (error) => (error instanceof ErrorApi ? error.message : mensajeParaCodigo());

  const cargarLineaTiempo = async (postulacionId, contenedor) => {
    try {
      const detalle = await obtenerDetalle(postulacionId);
      const eventos = formatoLineaTiempo(detalle.PostulacionEventos, 'empresa');
      const listaEventos = document.createElement('ul');
      listaEventos.className = 'list-unstyled small border-start ps-3 mb-0';
      for (const evento of eventos) {
        const item = document.createElement('li');
        item.className = 'mb-1';
        item.textContent = `${evento.texto} — ${evento.quien} — ${evento.fecha.toLocaleString('es-CL')}`;
        if (evento.motivo) item.textContent += ` — "${evento.motivo}"`;
        listaEventos.append(item);
      }
      contenedor.append(listaEventos);
    } catch (error) {
      contenedor.textContent = mensajeDeError(error);
    }
  };

  const crearTarjeta = (postulacion) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'card card-oferta';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body';

    const nombre = document.createElement('h2');
    nombre.className = 'h5 mb-1';
    const estudiante = postulacion.Estudiante;
    nombre.textContent = estudiante ? `${estudiante.nombres} ${estudiante.apellidos}` : 'Estudiante';

    const carrera = document.createElement('p');
    carrera.className = 'small fw-medium mb-1';
    carrera.textContent = estudiante?.carrera ?? '';

    // Insignia con color, no "Estado: texto" plano (docs/08-guia-visual.md).
    const estadoEl = document.createElement('p');
    estadoEl.className = 'mb-2';
    const insigniaEstado = document.createElement('span');
    insigniaEstado.className = `estado-postulacion ${claseEstadoPostulacion(postulacion.estado)}`;
    insigniaEstado.textContent = textoEstado(postulacion.estado);
    estadoEl.append(insigniaEstado);

    const acciones = document.createElement('div');
    acciones.className = 'd-flex flex-wrap gap-2 mb-2';

    const botonCv = document.createElement('button');
    botonCv.type = 'button';
    botonCv.className = 'btn btn-outline-secondary btn-sm';
    botonCv.textContent = 'Descargar CV';
    botonCv.addEventListener('click', () => {
      descargarArchivo(postulacion.cvArchivoId, 'cv.pdf').catch((error) => mostrarMensaje(mensajeDeError(error)));
    });
    acciones.append(botonCv);

    const paso = SIGUIENTE_PASO[postulacion.estado];
    if (paso) {
      const botonAvanzar = document.createElement('button');
      botonAvanzar.type = 'button';
      botonAvanzar.className = 'btn btn-primary btn-sm';
      botonAvanzar.textContent = paso.texto;
      botonAvanzar.addEventListener('click', async () => {
        botonAvanzar.disabled = true;
        try {
          // La propia respuesta ya trae el estado nuevo (controllers/postulaciones.controller.js
          // devuelve la postulación actualizada) — no hace falta un segundo viaje a obtenerDetalle.
          const actualizada = await paso.accion(postulacion.id);
          tarjeta.replaceWith(crearTarjeta({ ...postulacion, estado: actualizada.estado }));
        } catch (error) {
          mostrarMensaje(mensajeDeError(error));
          botonAvanzar.disabled = false;
        }
      });
      acciones.append(botonAvanzar);
    }

    if (ESTADOS_CON_RECHAZO.includes(postulacion.estado)) {
      const botonRechazar = document.createElement('button');
      botonRechazar.type = 'button';
      botonRechazar.className = 'btn btn-outline-danger btn-sm';
      botonRechazar.textContent = 'Rechazar';
      botonRechazar.addEventListener('click', async () => {
        const motivo = window.prompt('Motivo del rechazo (opcional, solo lo ves tú en la línea de tiempo):', '');
        if (motivo === null) return;
        botonRechazar.disabled = true;
        try {
          await rechazar(postulacion.id, motivo || undefined);
          tarjeta.replaceWith(crearTarjeta({ ...postulacion, estado: 'no_seleccionada' }));
        } catch (error) {
          mostrarMensaje(mensajeDeError(error));
          botonRechazar.disabled = false;
        }
      });
      acciones.append(botonRechazar);
    }

    const contenedorTimeline = document.createElement('div');
    contenedorTimeline.className = 'mt-2';
    contenedorTimeline.hidden = true;

    const botonTimeline = document.createElement('button');
    botonTimeline.type = 'button';
    botonTimeline.className = 'btn btn-outline-secondary btn-sm';
    botonTimeline.textContent = 'Ver línea de tiempo';
    botonTimeline.addEventListener('click', async () => {
      contenedorTimeline.hidden = !contenedorTimeline.hidden;
      if (!contenedorTimeline.hidden && contenedorTimeline.childElementCount === 0) {
        await cargarLineaTiempo(postulacion.id, contenedorTimeline);
      }
    });
    acciones.append(botonTimeline);

    cuerpo.append(nombre, carrera, estadoEl, acciones, contenedorTimeline);
    tarjeta.append(cuerpo);
    return tarjeta;
  };

  const cargar = async () => {
    try {
      const postulaciones = await listarDeOferta(ofertaId);
      if (postulaciones.length === 0) {
        mostrarMensaje('Todavía no tienes postulantes para esta oferta.');
        return;
      }
      mostrarMensaje('');
      lista.replaceChildren(...postulaciones.map(crearTarjeta));
    } catch (error) {
      mostrarMensaje(mensajeDeError(error));
    }
  };

  botonCerrarSesion.addEventListener('click', async () => {
    await logout();
    window.location.href = 'index.html';
  });

  if (!ofertaId) {
    mostrarMensaje('Falta indicar la oferta.');
    return;
  }

  obtenerDetallePropio(ofertaId)
    .then((oferta) => { tituloOferta.textContent = `Postulantes de "${oferta.titulo}"`; })
    .catch(() => {}); // el título es cosmético; si falla, la lista de abajo igual intenta cargar
  cargar();
}
