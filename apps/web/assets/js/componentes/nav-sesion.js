import { usuarioActual } from '../api/cliente.js';
import { iniciarSesion, logout } from '../api/sesion.js';
import { icono } from './iconos.js';

// El lado derecho de la cabecera, compartido por la portada y la vitrina. Estaba duplicado en las
// dos páginas y ya había empezado a divergir: una mostraba un enlace pelado y la otra un botón.

// A dónde manda el enlace de sesión según el rol. Los destinos y los textos son los que ya usaba
// la vitrina: al extraer este componente estuve a punto de cambiarlos sin darme cuenta, y mandar a
// una empresa a su perfil en vez de a sus ofertas es un cambio de comportamiento, no un detalle.
const PANEL_POR_ROL = {
  estudiante: { href: 'panel-estudiante.html', texto: 'Mi perfil' },
  empresa: { href: 'mis-ofertas.html', texto: 'Mis ofertas' },
  coordinacion: { href: 'panel-coordinacion.html', texto: 'Panel de coordinación' },
};

const botonEntrar = () => {
  const enlace = document.createElement('a');
  // Borde, no relleno naranja: el naranja de esta página es del botón "Ver ofertas vigentes", que
  // es la acción que de verdad queremos que ocurra. Dos rellenos naranjas competirían.
  enlace.className = 'btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2';
  enlace.href = 'login.html';
  enlace.append(icono('candado'), document.createTextNode('Iniciar sesión'));
  return enlace;
};

// Público y no bloqueante: reponer la sesión acá solo decide qué dice la cabecera. Nunca redirige
// ni impide ver la página — mismo criterio que ya usaban la vitrina y oferta.js.
export const pintarNavSesion = async (contenedor) => {
  const usuario = (await iniciarSesion()) ? usuarioActual() : null;

  if (!usuario) {
    contenedor.replaceChildren(botonEntrar());
    return;
  }

  const partes = [];
  const panel = PANEL_POR_ROL[usuario.rol];
  if (panel) {
    const enlace = document.createElement('a');
    enlace.className = 'enlace-nav';
    enlace.href = panel.href;
    enlace.textContent = panel.texto;
    partes.push(enlace);
  }

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn btn-link p-0 enlace-nav';
  boton.textContent = 'Cerrar sesión';
  boton.addEventListener('click', async () => {
    await logout();
    window.location.href = 'index.html';
  });
  partes.push(boton);

  contenedor.replaceChildren(...partes);
};
