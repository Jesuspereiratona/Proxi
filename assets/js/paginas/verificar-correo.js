import { verificarCorreo } from '../api/auth.js';
import { ErrorApi } from '../api/cliente.js';

// Mensajes propios de esta página, no el mapa genérico de cliente.js: ahí "AUTH_TOKEN_EXPIRADO"
// dice "tu sesión expiró", que no aplica acá — este enlace nunca inició una sesión, es de un correo.
const MENSAJES_VERIFICACION = {
  AUTH_TOKEN_INVALIDO: 'Este enlace de verificación no es válido. Puede que ya lo hayas usado.',
  AUTH_TOKEN_EXPIRADO: 'Este enlace de verificación venció. Vuelve a registrarte para recibir uno nuevo.',
};

const mensajeEstado = document.getElementById('mensaje-estado');
const enlaceLogin = document.getElementById('enlace-login');

const token = new URLSearchParams(window.location.search).get('token');
// Ya se leyó el token de la URL: sacarlo de la barra de direcciones y del historial de la sesión
// del navegador (auditoría de seguridad — importa en un computador compartido, p. ej. el
// laboratorio de la FEN). No afecta la verificación, que ya se hace con el valor guardado arriba.
if (token) window.history.replaceState({}, '', window.location.pathname);

if (!token) {
  mensajeEstado.textContent = 'Falta el enlace de verificación completo. Revisa el correo y ábrelo tal cual llegó.';
} else {
  try {
    await verificarCorreo(token);
    mensajeEstado.textContent = 'Tu correo quedó verificado. Ya puedes iniciar sesión.';
    enlaceLogin.hidden = false;
  } catch (error) {
    mensajeEstado.textContent = error instanceof ErrorApi
      ? (MENSAJES_VERIFICACION[error.codigo] ?? error.message)
      : 'Ocurrió un problema. Intenta de nuevo en un momento.';
  }
}
