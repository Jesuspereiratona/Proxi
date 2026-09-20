import { listarPublicas } from '../api/ofertas.js';
import { crearTarjetaOferta } from '../componentes/tarjeta-oferta.js';
import { ErrorApi, mensajeParaCodigo, usuarioActual } from '../api/cliente.js';
import { iniciarSesion, logout } from '../api/sesion.js';

// A dónde manda "Mi panel" según el rol de la sesión.
const PANEL_POR_ROL = {
  estudiante: { href: 'panel-estudiante.html', texto: 'Mi perfil' },
  empresa: { href: 'mis-ofertas.html', texto: 'Mis ofertas' },
  coordinacion: { href: 'panel-coordinacion.html', texto: 'Panel de coordinación' },
};

const formulario = document.getElementById('filtros');
const listado = document.getElementById('listado');
const mensajeEstado = document.getElementById('mensaje-estado');
const navSesion = document.getElementById('nav-sesion');
const contador = document.getElementById('contador');
const botonLimpiar = document.getElementById('limpiar-filtros');

// La vitrina es pública (no exige sesión): reponerla acá es solo para decidir qué mostrar en el
// nav, nunca bloqueante ni con redirección — mismo criterio no bloqueante que oferta.js.
const pintarNavSesion = async () => {
  const autenticado = await iniciarSesion();
  const usuario = autenticado ? usuarioActual() : null;
  if (!usuario) {
    navSesion.replaceChildren();
    const enlace = document.createElement('a');
    enlace.href = 'login.html';
    enlace.textContent = 'Iniciar sesión';
    navSesion.append(enlace);
    return;
  }
  navSesion.replaceChildren();
  const panel = PANEL_POR_ROL[usuario.rol];
  if (panel) {
    const enlace = document.createElement('a');
    enlace.href = panel.href;
    enlace.textContent = panel.texto;
    navSesion.append(enlace);
  }
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'btn btn-link p-0';
  boton.textContent = 'Cerrar sesión';
  boton.addEventListener('click', async () => {
    await logout();
    window.location.reload();
  });
  navSesion.append(boton);
};

const mostrarMensaje = (texto) => {
  mensajeEstado.textContent = texto;
  mensajeEstado.hidden = !texto;
};

const leerFiltros = () => {
  const datos = new FormData(formulario);
  return Object.fromEntries([...datos.entries()].filter(([, valor]) => valor !== ''));
};

// Un "no hay resultados" a secas no dice qué hacer. Nombrar el filtro que está de más convierte una
// pantalla vacía en una instrucción (identidad-visual, "Estados completos").
const ETIQUETA_FILTRO = {
  area: 'el área', modalidad: 'la modalidad', comuna: 'la comuna', remunerada: 'el filtro de remuneración',
};

const mensajeSinResultados = (filtros) => {
  const activos = Object.keys(filtros).map((clave) => ETIQUETA_FILTRO[clave]).filter(Boolean);
  if (activos.length === 0) return 'Todavía no hay ofertas de práctica publicadas. Vuelve a mirar en unos días.';
  if (activos.length === 1) return `No hay ofertas vigentes con ese filtro. Prueba quitando ${activos[0]}.`;
  return 'No hay ofertas vigentes con esa combinación de filtros. Prueba quitando alguno.';
};

// Contador de la última petición disparada: si una respuesta lenta llega después de una más
// nueva, se descarta en vez de pisar el resultado del filtro que la persona ya cambió (auditoría
// de Fase 6).
let peticionActual = 0;

const cargar = async () => {
  const numeroPeticion = ++peticionActual;
  const filtros = leerFiltros();
  listado.replaceChildren();
  contador.textContent = '';
  mostrarMensaje('Cargando…');
  try {
    const { ofertas, total } = await listarPublicas(filtros);
    if (numeroPeticion !== peticionActual) return;
    if (ofertas.length === 0) {
      mostrarMensaje(mensajeSinResultados(filtros));
      return;
    }
    mostrarMensaje('');
    contador.textContent = total === 1 ? '1 oferta encontrada' : `${total} ofertas encontradas`;
    listado.append(...ofertas.map((oferta) => crearTarjetaOferta(oferta)));
  } catch (error) {
    if (numeroPeticion !== peticionActual) return;
    mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
  }
};

// Debounce: sin esto, escribir "contabilidad" en el filtro de área dispara una petición por
// tecla contra el límite de tasa global, compartido por IP — en la red de la universidad, unas
// pocas personas usando la vitrina normalmente agotaban el límite para todos (auditoría de Fase 6).
let temporizador;
const cargarConDebounce = () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(cargar, 300);
};

formulario.addEventListener('input', cargarConDebounce);
// submit además de input: en un formulario, Enter dispara submit y recargaría la página entera
// perdiendo los filtros. Se intercepta y se recarga solo el listado.
formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  cargar();
});
botonLimpiar.addEventListener('click', () => {
  formulario.reset();
  cargar();
});

cargar();
pintarNavSesion();
