import { registrar } from '../api/auth.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';

// Mismo mínimo que apps/api/src/services/auth/passwords.js LARGO_MINIMO: no hay forma de
// importarlo del backend sin un paquete compartido nuevo solo para un número, así que se duplica
// acá con la fuente anotada. Validar antes de enviar evita un viaje al servidor solo para fallar.
const LARGO_MINIMO_CLAVE = 12;

const formulario = document.getElementById('formulario-registro');
const mensajeError = document.getElementById('mensaje-error');
const mensajeExito = document.getElementById('mensaje-exito');
const boton = formulario.querySelector('button[type="submit"]');

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
  try {
    await registrar({
      email: datos.get('email'),
      clave,
      rol: datos.get('rol'),
      aceptaPolitica: true,
    });
    formulario.hidden = true;
    mensajeExito.textContent = 'Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.';
    mensajeExito.hidden = false;
  } catch (error) {
    mostrarError(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    boton.disabled = false;
  }
});
