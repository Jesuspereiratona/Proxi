import { protegerPagina } from '../componentes/proteger-pagina.js';
import { obtenerPropio, crearPerfil, actualizarPerfil } from '../api/empresas.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { logout } from '../api/sesion.js';
import { subirLogo, obtenerMiLogo, quitarMiLogo, urlLogo } from '../api/logos.js';

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

  // Lo asigna cargar(): la URL pública del logo lo necesita, y mirarlo por esa URL es la única
  // forma de ver exactamente lo mismo que ve la vitrina, en vez de una vista previa local.
  let empresaId = null;

  const cargar = async () => {
    try {
      const perfil = await obtenerPropio();
      perfilExiste = true;
      perfilActual = perfil;
      empresaId = perfil.id;
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

  // --- Logo -------------------------------------------------------------------------------
  const vistaLogo = document.getElementById('logo-vista');
  const estadoLogo = document.getElementById('logo-estado');
  const mensajeLogo = document.getElementById('mensaje-logo');
  const entradaLogo = document.getElementById('archivo-logo');
  const botonSubirLogo = document.getElementById('boton-subir-logo');
  const botonQuitarLogo = document.getElementById('boton-quitar-logo');

  const avisarLogo = (texto) => {
    mensajeLogo.textContent = texto;
    mensajeLogo.hidden = !texto;
  };

  const pintarLogo = async () => {
    vistaLogo.replaceChildren();
    botonQuitarLogo.hidden = true;
    try {
      const { logo } = await obtenerMiLogo();
      if (!logo) {
        estadoLogo.textContent = 'Todavía no subes un logo. Mientras tanto se muestra la inicial de tu razón social.';
        return;
      }
      botonQuitarLogo.hidden = false;
      if (logo.aprobado) {
        estadoLogo.textContent = 'Aprobado: se está mostrando en la vitrina.';
      } else if (logo.hayOtroAprobadoVisible) {
        estadoLogo.textContent = 'Tu logo nuevo espera revisión de coordinación. Mientras tanto la vitrina sigue mostrando el anterior.';
      } else {
        estadoLogo.textContent = 'Esperando revisión de coordinación. Todavía no se muestra en la vitrina.';
      }
      // Solo se puede pintar por URL el que ya es público; uno pendiente no se sirve sin sesión de
      // coordinación, así que se muestra la inicial en vez de un ícono roto.
      const pintarInicial = () => {
        vistaLogo.replaceChildren();
        vistaLogo.textContent = (formulario.razonSocial.value || '?').trim()[0]?.toUpperCase() ?? '?';
      };
      if (logo.aprobado) {
        const imagen = document.createElement('img');
        // El parámetro rompe la caché del navegador: sin esto, reemplazar el logo no se notaría en
        // esta pantalla hasta que venza.
        imagen.src = `${urlLogo(empresaId)}?v=${encodeURIComponent(logo.id)}`;
        imagen.alt = '';
        // Es el único <img> que apunta a la URL pública desde una pantalla con sesión: si la empresa
        // no está validada, esa URL da 404 y sin esto quedaba el ícono roto del navegador en su
        // propio panel (revisión de código).
        imagen.addEventListener('error', pintarInicial);
        vistaLogo.append(imagen);
      } else {
        pintarInicial();
      }
    } catch (error) {
      estadoLogo.textContent = error instanceof ErrorApi ? error.message : mensajeParaCodigo();
    }
  };

  botonSubirLogo.addEventListener('click', async () => {
    const archivo = entradaLogo.files?.[0];
    if (!archivo) {
      avisarLogo('Elige una imagen primero.');
      return;
    }
    botonSubirLogo.disabled = true;
    try {
      await subirLogo(archivo);
      entradaLogo.value = '';
      avisarLogo('Logo subido. Coordinación lo va a revisar antes de que se vea en la vitrina.');
      await pintarLogo();
    } catch (error) {
      avisarLogo(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    } finally {
      botonSubirLogo.disabled = false;
    }
  });

  botonQuitarLogo.addEventListener('click', async () => {
    botonQuitarLogo.disabled = true;
    try {
      await quitarMiLogo();
      avisarLogo('Logo quitado. Vuelve a mostrarse la inicial de tu razón social.');
      await pintarLogo();
    } catch (error) {
      avisarLogo(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    } finally {
      botonQuitarLogo.disabled = false;
    }
  });

  cargar().then(pintarLogo);
}
