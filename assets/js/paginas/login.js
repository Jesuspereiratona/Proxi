import { login } from '../api/sesion.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';

// Coordinación no tiene panel propio todavía (Fase 6 sigue después de empresa) — vuelve a la
// vitrina, igual que antes.
const PAGINA_POR_ROL = { estudiante: 'panel-estudiante.html', empresa: 'mis-ofertas.html' };

const formulario = document.getElementById('formulario-login');
const mensajeError = document.getElementById('mensaje-error');
const boton = formulario.querySelector('button[type="submit"]');

const mostrarError = (texto) => {
  mensajeError.textContent = texto;
  mensajeError.hidden = !texto;
};

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('');
  boton.disabled = true;
  try {
    const datos = new FormData(formulario);
    const usuario = await login(datos.get('email'), datos.get('clave'));
    window.location.href = PAGINA_POR_ROL[usuario.rol] ?? 'index.html';
  } catch (error) {
    mostrarError(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    boton.disabled = false;
  }
});
