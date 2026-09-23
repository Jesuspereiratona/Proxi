import { usuarioActual } from '../api/cliente.js';
import { iniciarSesion, logout } from '../api/sesion.js';
import { icono } from './iconos.js';

// El lado derecho de la cabecera, compartido por la portada y la vitrina. Estaba duplicado en las
// dos páginas y ya había empezado a divergir: una mostraba un enlace pelado y la otra un botón.

// A dónde manda el enlace de sesión según el rol. Los destinos y los textos son los que ya usaba
// la vitrina: al extraer este componente estuve a punto de cambiarlos sin darme cuenta, y mandar a
// una empresa a su perfil en vez de a sus ofertas es un cambio de comportamiento, no un detalle.
//
// Son listas y no un enlace suelto porque cada rol tiene DOS áreas, y hasta ahora cada página
// enlazaba a mano solo la otra: desde "Mis postulaciones" se llegaba al perfil, pero desde la
// vitrina no se llegaba a las postulaciones. El primero de cada lista es el que ya se mostraba,
// para no cambiar a dónde va quien viene de la portada.
const PANELES_POR_ROL = {
  estudiante: [
    { href: 'panel-estudiante.html', texto: 'Mi perfil' },
    { href: 'postulaciones.html', texto: 'Mis postulaciones' },
  ],
  empresa: [
    { href: 'mis-ofertas.html', texto: 'Mis ofertas' },
    { href: 'panel-empresa.html', texto: 'Mi empresa' },
  ],
  coordinacion: [
    { href: 'panel-coordinacion.html', texto: 'Panel de coordinación' },
  ],
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
    return null;
  }

  // La página en la que ya estás no se repite en su propia cabecera.
  const aqui = window.location.pathname.split('/').pop() || 'index.html';
  const partes = (PANELES_POR_ROL[usuario.rol] ?? [])
    .filter((panel) => panel.href !== aqui)
    .map((panel) => {
      const enlace = document.createElement('a');
      enlace.className = 'enlace-nav';
      enlace.href = panel.href;
      enlace.textContent = panel.texto;
      return enlace;
    });

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
  // Devuelve quién es para que la cabecera decida qué más mostrar.
  return usuario;
};
