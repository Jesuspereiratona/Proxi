import { registrar } from '../api/auth.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { icono } from '../componentes/iconos.js';

// Mismo mínimo que apps/api/src/services/auth/passwords.js LARGO_MINIMO: no hay forma de
// importarlo del backend sin un paquete compartido nuevo solo para un número, así que se duplica
// acá con la fuente anotada. Validar antes de enviar evita un viaje al servidor solo para fallar.
const LARGO_MINIMO_CLAVE = 12;

const formulario = document.getElementById('formulario-registro');
const mensajeError = document.getElementById('mensaje-error');
const panelFormulario = document.getElementById('panel-formulario');
const confirmacion = document.getElementById('confirmacion');
const confirmacionCorreo = document.getElementById('confirmacion-correo');
const yaTienesCuenta = document.getElementById('ya-tienes-cuenta');
const boton = formulario.querySelector('button[type="submit"]');

document.getElementById('confirmacion-icono').append(icono('sobre'));

const mostrarError = (texto) => {
  mensajeError.textContent = texto;
  mensajeError.hidden = !texto;
};

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarError('');
  const datos = new FormData(formulario);
  const clave = datos.get('clave');

  // Validaciones que ya puede hacer el propio formulario, sin gastar una petición para fallar:
  // el servidor las revalida igual (nunca hay que confiar solo en el cliente), esto es solo UX.
  if (clave.length < LARGO_MINIMO_CLAVE) {
    mostrarError(`La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
    return;
  }
  if (clave !== datos.get('claveConfirmar')) {
    mostrarError('Las contraseñas no coinciden.');
    return;
  }
  if (!datos.get('aceptaPolitica')) {
    mostrarError('Debes aceptar la política de privacidad.');
    return;
  }

  boton.disabled = true;
  const email = datos.get('email');
  try {
    await registrar({
      email,
      clave,
      rol: datos.get('rol'),
      aceptaPolitica: true,
    });
    // Se oculta el PANEL entero, no solo el <form>: el panel tiene relleno propio, así que ocultar
    // el formulario dentro dejaba una tarjeta blanca vacía flotando sobre el mensaje.
    panelFormulario.hidden = true;
    yaTienesCuenta.hidden = true;
    confirmacionCorreo.textContent = email;
    confirmacion.hidden = false;
    // Sin esto el foco se queda en el botón que ya no está en pantalla y quien navega con teclado o
    // lector de pantalla no recibe nada: el `role="status"` anuncia, pero no mueve el foco.
    confirmacion.setAttribute('tabindex', '-1');
    confirmacion.focus();
  } catch (error) {
    mostrarError(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    boton.disabled = false;
  }
});
