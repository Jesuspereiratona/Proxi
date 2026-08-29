import { protegerPagina } from '../componentes/proteger-pagina.js';
import { obtenerPerfil, crearPerfil, actualizarPerfil, subirCv } from '../api/estudiantes.js';
import { descargarArchivo, ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { logout } from '../api/sesion.js';

const usuario = await protegerPagina('estudiante');
if (usuario) iniciar();

function iniciar() {
  const formulario = document.getElementById('formulario-perfil');
  const mensajeEstado = document.getElementById('mensaje-estado');
  const rutActual = document.getElementById('rut-actual');
  const cvEstado = document.getElementById('cv-estado');
  const botonDescargarCv = document.getElementById('boton-descargar-cv');
  const inputArchivoCv = document.getElementById('archivo-cv');
  const botonSubirCv = document.getElementById('boton-subir-cv');
  const botonCerrarSesion = document.getElementById('boton-cerrar-sesion');

  let perfilExiste = false;
  let cvArchivoId = null;

  const mostrarMensaje = (texto) => {
    mensajeEstado.textContent = texto;
    mensajeEstado.hidden = !texto;
  };

  const pintarCv = () => {
    if (cvArchivoId) {
      cvEstado.textContent = 'Tienes un CV subido.';
      botonDescargarCv.hidden = false;
    } else {
      cvEstado.textContent = 'Todavía no tienes CV subido. Súbelo antes de postular a una oferta.';
      botonDescargarCv.hidden = true;
    }
  };

  const cargar = async () => {
    try {
      const perfil = await obtenerPerfil();
      perfilExiste = true;
      formulario.nombres.value = perfil.nombres;
      formulario.apellidos.value = perfil.apellidos;
      formulario.carrera.value = perfil.carrera;
      formulario.nivel.value = perfil.nivel ?? '';
      formulario.telefono.value = perfil.telefono ?? '';
      if (perfil.rutUltimos4) {
        rutActual.textContent = `Tu RUT termina en ${perfil.rutUltimos4}. Deja el campo vacío si no quieres cambiarlo.`;
        rutActual.hidden = false;
      }
      cvArchivoId = perfil.cvArchivoId;
      pintarCv();
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'PERFIL_NO_ENCONTRADO') {
        perfilExiste = false;
        pintarCv();
      } else {
        mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
      }
    }
  };

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarMensaje('');
    const datos = Object.fromEntries(new FormData(formulario).entries());
    if (!datos.rut) delete datos.rut;
    if (datos.nivel) datos.nivel = Number(datos.nivel);
    else delete datos.nivel;
    if (!datos.telefono) delete datos.telefono;

    // Al crear, el RUT es obligatorio (la API lo exige) — se valida acá para un mensaje claro en
    // vez de esperar el 422 genérico de VALIDACION_ENTRADA.
    if (!perfilExiste && !datos.rut) {
      mostrarMensaje('El RUT es obligatorio para crear tu perfil.');
      return;
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

  botonDescargarCv.addEventListener('click', () => {
    descargarArchivo(cvArchivoId, 'cv.pdf').catch((error) => {
      mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    });
  });

  botonSubirCv.addEventListener('click', async () => {
    const archivo = inputArchivoCv.files[0];
    if (!archivo) {
      mostrarMensaje('Elige un archivo PDF primero.');
      return;
    }
    mostrarMensaje('');
    try {
      const nuevoArchivo = await subirCv(archivo);
      cvArchivoId = nuevoArchivo.id;
      pintarCv();
      inputArchivoCv.value = '';
      mostrarMensaje('CV actualizado.');
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
