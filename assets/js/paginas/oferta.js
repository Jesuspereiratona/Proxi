import { obtenerDetalle } from '../api/ofertas.js';
import { postular } from '../api/postulaciones.js';
import { calcularEstado } from '../componentes/estado-oferta.js';
import { ErrorApi, mensajeParaCodigo, usuarioActual } from '../api/cliente.js';
import { iniciarSesion } from '../api/sesion.js';

const MODALIDADES = { presencial: 'Presencial', hibrida: 'Híbrida', remota: 'Remota' };
const JORNADAS = { completa: 'Jornada completa', parcial: 'Jornada parcial' };

const mensajeEstado = document.getElementById('mensaje-estado');
const detalle = document.getElementById('detalle');
const mensajePostulacion = document.getElementById('mensaje-postulacion');
const botonPostular = document.getElementById('boton-postular');
const enlaceLogin = document.getElementById('enlace-login-postular');

const mostrarMensaje = (texto) => {
  mensajeEstado.textContent = texto;
  mensajeEstado.hidden = !texto;
};

const mostrarMensajePostulacion = (texto) => {
  mensajePostulacion.textContent = texto;
  mensajePostulacion.hidden = !texto;
};

const formatoMonto = (monto) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(monto);

const pintar = (oferta) => {
  const estado = calcularEstado(oferta.fechaCierre);
  const insignia = document.getElementById('detalle-estado');
  insignia.textContent = estado.texto;
  insignia.classList.add(estado.clase);

  document.getElementById('detalle-titulo').textContent = oferta.titulo;

  const enlaceEmpresa = document.getElementById('detalle-empresa-enlace');
  enlaceEmpresa.textContent = oferta.Empresa?.razonSocial ?? 'Empresa';
  enlaceEmpresa.href = `empresa.html?id=${oferta.empresaId}`;

  document.getElementById('detalle-modalidad').textContent = MODALIDADES[oferta.modalidad] ?? oferta.modalidad;
  document.getElementById('detalle-comuna').textContent = oferta.comuna ?? '—';
  document.getElementById('detalle-jornada').textContent = JORNADAS[oferta.jornada] ?? oferta.jornada;
  document.getElementById('detalle-remuneracion').textContent = oferta.remunerada
    ? formatoMonto(oferta.montoMensual)
    : 'No remunerada';
  document.getElementById('detalle-descripcion').textContent = oferta.descripcion;
  document.getElementById('detalle-requisitos').textContent = oferta.requisitos;

  detalle.hidden = false;
  return estado;
};

// Ver el detalle nunca exige sesión (es una página pública): reponer la sesión acá es solo para
// decidir qué botón mostrar, nunca bloqueante ni con redirección (a diferencia de
// proteger-pagina.js, que sí usan las páginas del panel).
const configurarPostulacion = async (oferta, estado) => {
  if (oferta.estado !== 'publicada' || estado.clase === 'vencida') return;

  const autenticado = await iniciarSesion();
  const usuario = autenticado ? usuarioActual() : null;

  if (!usuario) {
    enlaceLogin.hidden = false;
    return;
  }
  if (usuario.rol !== 'estudiante') return;

  botonPostular.hidden = false;
  botonPostular.addEventListener('click', async () => {
    botonPostular.disabled = true;
    try {
      await postular(oferta.id);
      mostrarMensajePostulacion('Postulación enviada. Puedes verla en "Mis postulaciones".');
      botonPostular.hidden = true;
    } catch (error) {
      mostrarMensajePostulacion(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
      botonPostular.disabled = false;
    }
  });
};

const cargar = async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    mostrarMensaje('Falta indicar qué oferta ver.');
    return;
  }
  try {
    const oferta = await obtenerDetalle(id);
    const estado = pintar(oferta);
    await configurarPostulacion(oferta, estado);
  } catch (error) {
    mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
  }
};

cargar();
