import { obtenerDetalle } from '../api/ofertas.js';
import { calcularEstado } from '../componentes/estado-oferta.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';

const MODALIDADES = { presencial: 'Presencial', hibrida: 'Híbrida', remota: 'Remota' };
const JORNADAS = { completa: 'Jornada completa', parcial: 'Jornada parcial' };

const mensajeEstado = document.getElementById('mensaje-estado');
const detalle = document.getElementById('detalle');

const mostrarMensaje = (texto) => {
  mensajeEstado.textContent = texto;
  mensajeEstado.hidden = !texto;
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
};

const cargar = async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    mostrarMensaje('Falta indicar qué oferta ver.');
    return;
  }
  try {
    const oferta = await obtenerDetalle(id);
    pintar(oferta);
  } catch (error) {
    mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
  }
};

cargar();
