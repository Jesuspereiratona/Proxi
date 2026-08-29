import { login } from '../api/sesion.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';

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
    await login(datos.get('email'), datos.get('clave'));
    // Sin panel propio todavía por rol (Fase 6 sigue en construcción): vuelve a la vitrina, que
    // es la única pantalla que existe hasta ahora.
    window.location.href = 'index.html';
  } catch (error) {
    mostrarError(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    boton.disabled = false;
  }
});
