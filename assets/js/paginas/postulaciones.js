import { protegerPagina } from '../componentes/proteger-pagina.js';
import { listarMias, obtenerDetalle, retirar } from '../api/postulaciones.js';
import { textoEstado, claseEstadoPostulacion, formatoLineaTiempo } from '../componentes/linea-tiempo.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { logout } from '../api/sesion.js';

const ESTADOS_TERMINALES = ['seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada'];

const usuario = await protegerPagina('estudiante');
if (usuario) iniciar();

function iniciar() {
  const lista = document.getElementById('lista');
  const mensajeEstado = document.getElementById('mensaje-estado');
  const botonCerrarSesion = document.getElementById('boton-cerrar-sesion');

  const mostrarMensaje = (texto) => {
    mensajeEstado.textContent = texto;
    mensajeEstado.hidden = !texto;
  };

  const cargarLineaTiempo = async (postulacionId, contenedor) => {
    try {
      const detalle = await obtenerDetalle(postulacionId);
      const eventos = formatoLineaTiempo(detalle.PostulacionEventos);
      const listaEventos = document.createElement('ul');
      listaEventos.className = 'list-unstyled small border-start ps-3 mb-0';
      for (const evento of eventos) {
        const item = document.createElement('li');
        item.className = 'mb-1';
        const fecha = evento.fecha.toLocaleString('es-CL');
        item.textContent = `${evento.texto} — ${evento.quien} — ${fecha}`;
        listaEventos.append(item);
      }
      contenedor.append(listaEventos);
    } catch (error) {
      contenedor.textContent = error instanceof ErrorApi ? error.message : mensajeParaCodigo();
    }
  };

  const crearTarjeta = (postulacion) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'card card-oferta';

    // .card-body, no hijos directos de .card: .card es flex-column en Bootstrap 5, así que un
    // hijo directo (un botón, acá) se estira al ancho completo en vez de quedarse en su tamaño
    // natural (mismo bug encontrado y corregido en tarjeta-oferta.js).
    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body';

    const titulo = document.createElement('h2');
    titulo.className = 'h5 mb-1';
    titulo.textContent = postulacion.Oferta?.titulo ?? 'Oferta';

    const empresa = document.createElement('p');
    empresa.className = 'small fw-medium mb-1';
    empresa.textContent = postulacion.Oferta?.Empresa?.razonSocial ?? '';

    // Insignia con color, no "Estado: texto" plano (docs/08-guia-visual.md): los estados son el
    // producto, tienen que distinguirse de un vistazo, no solo leerse.
    const estado = document.createElement('p');
    estado.className = 'mb-2';
    const insigniaEstado = document.createElement('span');
    insigniaEstado.className = `estado-postulacion ${claseEstadoPostulacion(postulacion.estado)}`;
    insigniaEstado.textContent = textoEstado(postulacion.estado);
    estado.append(insigniaEstado);

    const contenedorTimeline = document.createElement('div');
    contenedorTimeline.className = 'mt-2';
    contenedorTimeline.hidden = true;

    const botonTimeline = document.createElement('button');
    botonTimeline.type = 'button';
    botonTimeline.className = 'btn btn-outline-secondary btn-sm me-2';
    botonTimeline.textContent = 'Ver línea de tiempo';
    botonTimeline.addEventListener('click', async () => {
      contenedorTimeline.hidden = !contenedorTimeline.hidden;
      if (!contenedorTimeline.hidden && contenedorTimeline.childElementCount === 0) {
        await cargarLineaTiempo(postulacion.id, contenedorTimeline);
      }
    });

    cuerpo.append(titulo, empresa, estado, botonTimeline);

    if (!ESTADOS_TERMINALES.includes(postulacion.estado)) {
      const botonRetirar = document.createElement('button');
      botonRetirar.type = 'button';
      botonRetirar.className = 'btn btn-outline-danger btn-sm';
      botonRetirar.textContent = 'Retirar';
      botonRetirar.addEventListener('click', async () => {
        botonRetirar.disabled = true;
        try {
          await retirar(postulacion.id);
          insigniaEstado.className = `estado-postulacion ${claseEstadoPostulacion('retirada')}`;
          insigniaEstado.textContent = textoEstado('retirada');
          botonRetirar.remove();
        } catch (error) {
          mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
          botonRetirar.disabled = false;
        }
      });
      cuerpo.append(botonRetirar);
    }

    cuerpo.append(contenedorTimeline);
    tarjeta.append(cuerpo);
    return tarjeta;
  };

  const cargar = async () => {
    mostrarMensaje('Cargando…');
    try {
      const postulaciones = await listarMias();
      if (postulaciones.length === 0) {
        mostrarMensaje('Todavía no tienes postulaciones.');
        return;
      }
      mostrarMensaje('');
      lista.replaceChildren(...postulaciones.map(crearTarjeta));
    } catch (error) {
      mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    }
  };

  botonCerrarSesion.addEventListener('click', async () => {
    await logout();
    window.location.href = 'index.html';
  });

  cargar();
}
