import { iniciarSesion } from '../api/sesion.js';
import { usuarioActual } from '../api/cliente.js';

// Guardián de sesión reusado por los tres paneles (Fase 6). Sin sesión vigente, a login.html; con
// sesión pero el rol equivocado, a la vitrina — no hay pantalla de "no autorizado" propia todavía,
// no vale la pena una para este alcance. Devuelve el usuario ({id, rol}) para que la página lo use.
export const protegerPagina = async (rolEsperado) => {
  const autenticado = await iniciarSesion();
  const usuario = autenticado ? usuarioActual() : null;

  if (!usuario) {
    window.location.href = 'login.html';
    return null;
  }
  if (rolEsperado && usuario.rol !== rolEsperado) {
    window.location.href = 'index.html';
    return null;
  }
  return usuario;
};
