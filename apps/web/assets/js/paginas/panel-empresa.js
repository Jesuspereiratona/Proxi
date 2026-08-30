import { protegerPagina } from '../componentes/proteger-pagina.js';
import { obtenerPropio, crearPerfil, actualizarPerfil } from '../api/empresas.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { logout } from '../api/sesion.js';

// Campos que, si cambian en una empresa ya validada, la mandan de vuelta a "pendiente" y cierran
// en cascada sus ofertas publicadas (CAMPOS_IDENTIDAD de empresas.service.js) — se avisa antes de
// guardar, no después de que la empresa descubra que perdió sus ofertas.
const CAMPOS_IDENTIDAD = ['razonSocial', 'rutEmpresa'];

const TEXTO_VALIDACION = {
  pendiente: 'Tu empresa está pendiente de validación por coordinación.',
  validada: 'Tu empresa está validada.',
  rechazada: 'Tu empresa fue rechazada por coordinación.',
  suspendida: 'Tu empresa está suspendida.',
};

const usuario = await protegerPagina('empresa');
if (usuario) iniciar();

function iniciar() {
  const formulario = document.getElementById('formulario-perfil');
  const mensajeEstado = document.getElementById('mensaje-estado');
  const estadoValidacionEl = document.getElementById('estado-validacion');
  const botonCerrarSesion = document.getElementById('boton-cerrar-sesion');

  let perfilExiste = false;
  let perfilActual = null;

  const mostrarMensaje = (texto) => {
    mensajeEstado.textContent = texto;
    mensajeEstado.hidden = !texto;
  };

  const pintarEstadoValidacion = (perfil) => {
    let texto = TEXTO_VALIDACION[perfil.estadoValidacion] ?? perfil.estadoValidacion;
    if (perfil.estadoValidacion === 'rechazada' && perfil.motivoRechazo) texto += ` Motivo: ${perfil.motivoRechazo}`;
    if (perfil.estadoValidacion === 'suspendida' && perfil.motivoSuspension) texto += ` Motivo: ${perfil.motivoSuspension}`;
    estadoValidacionEl.textContent = texto;
  };

  const cargar = async () => {
    try {
      const perfil = await obtenerPropio();
      perfilExiste = true;
      perfilActual = perfil;
      formulario.razonSocial.value = perfil.razonSocial;
      formulario.rutEmpresa.value = perfil.rutEmpresa;
      formulario.giro.value = perfil.giro ?? '';
      formulario.sitioWeb.value = perfil.sitioWeb ?? '';
      formulario.comuna.value = perfil.comuna ?? '';
      formulario.contactoNombre.value = perfil.contactoNombre;
      formulario.contactoCargo.value = perfil.contactoCargo;
      pintarEstadoValidacion(perfil);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'PERFIL_NO_ENCONTRADO') {
        perfilExiste = false;
        estadoValidacionEl.textContent = 'Todavía no tienes un perfil de empresa. Crea uno para empezar.';
      } else {
        mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
      }
    }
  };

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarMensaje('');
    const datos = Object.fromEntries(new FormData(formulario).entries());
    for (const campo of ['giro', 'sitioWeb', 'comuna']) {
      if (!datos[campo]) delete datos[campo];
    }

    if (perfilExiste && perfilActual.estadoValidacion === 'validada') {
      const cambioDeIdentidad = CAMPOS_IDENTIDAD.some((campo) => datos[campo] && datos[campo] !== perfilActual[campo]);
      if (cambioDeIdentidad) {
        const continuar = window.confirm(
          'Cambiar la razón social o el RUT manda tu empresa de vuelta a revisión y cierra tus ofertas publicadas. ¿Continuar?',
        );
        if (!continuar) return;
      }
    }

    try {
      if (perfilExiste) await actualizarPerfil(datos);
      else await crearPerfil(datos);
      mostrarMensaje('Guardado.');
      await cargar();
    } catch (error) {
      mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    }
  });

  botonCerrarSesion.addEventListener('click', async () => {
    await logout();
    window.location.href = 'index.html';
  });

  cargar();
}
