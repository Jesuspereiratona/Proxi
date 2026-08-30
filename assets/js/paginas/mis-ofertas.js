import { protegerPagina } from '../componentes/proteger-pagina.js';
import { obtenerPropio as obtenerPerfilEmpresa } from '../api/empresas.js';
import { listarMias, crear, editar, enviarARevision, cerrar } from '../api/ofertas.js';
import { textoEstadoOferta } from '../componentes/estado-oferta.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { logout } from '../api/sesion.js';

// Tocar cualquiera de estos en una oferta en_revision o publicada la manda de vuelta a borrador
// (mismo CAMPOS_CONTENIDO de ofertas.service.js) — se avisa antes de guardar.
const CAMPOS_CONTENIDO = ['titulo', 'descripcion', 'requisitos', 'area', 'modalidad', 'jornada', 'comuna', 'cupos'];
const CAMPOS_FORMULARIO = [...CAMPOS_CONTENIDO, 'remunerada', 'montoMensual', 'fechaCierre'];
// Si se vacían, hay que decírselo a la API con null explícito, no omitirlos del PATCH — son justo
// los dos campos que dejan de ser obligatorios según otro campo del mismo formulario (comuna al
// pasar a modalidad remota, montoMensual al dejar de ser remunerada). Omitirlos en vez de anularlos
// dejaba el valor viejo huérfano en la base con la oferta ya mostrando lo contrario (auditoría del
// panel de empresa).
const CAMPOS_ANULABLES = ['comuna', 'montoMensual'];
const MOTIVOS_CIERRE = { contratado: 'Contratado', cancelada: 'Cancelada', sin_candidatos: 'Sin candidatos' };

const usuario = await protegerPagina('empresa');
if (usuario) iniciar();

function iniciar() {
  const lista = document.getElementById('lista');
  const mensajeEstado = document.getElementById('mensaje-estado');
  const avisoNoValidada = document.getElementById('aviso-no-validada');
  const botonCerrarSesion = document.getElementById('boton-cerrar-sesion');
  const botonNueva = document.getElementById('boton-nueva');
  const seccionFormulario = document.getElementById('seccion-formulario');
  const tituloFormulario = document.getElementById('titulo-formulario');
  const formulario = document.getElementById('formulario-oferta');
  const botonCancelarFormulario = document.getElementById('boton-cancelar-formulario');

  let empresaValidada = false;
  let ofertaEnEdicion = null; // la oferta que se está editando (tal como la trajo la API), o null si es nueva

  const mostrarMensaje = (texto) => {
    mensajeEstado.textContent = texto;
    mensajeEstado.hidden = !texto;
  };

  const mensajeDeError = (error) => {
    if (!(error instanceof ErrorApi)) return mensajeParaCodigo();
    if (error.detalles?.length) return error.detalles.map((d) => d.mensaje).join(' ');
    return error.message;
  };

  // Compara contra el valor cargado por la API, no contra un formulario vacío: services/ofertas/
  // ofertas.service.js editar() reacciona a que un campo *venga* en el PATCH, no a que su valor
  // haya cambiado de verdad — si el cliente reenviara el formulario entero, editar sin tocar nada
  // igual mandaría una oferta publicada de vuelta a borrador. fechaCierre se compara solo por la
  // fecha (el input es <input type="date">, la API guarda fecha y hora).
  const normalizar = (campo, valor) => {
    if (valor === undefined || valor === null || valor === '') return undefined;
    if (campo === 'remunerada') return valor ? 'true' : 'false';
    if (campo === 'fechaCierre') return String(valor).slice(0, 10);
    return String(valor);
  };

  // Recorre CAMPOS_FORMULARIO, no Object.keys(datos): un campo que se vació (comuna, montoMensual)
  // ya no es una clave de datos a esta altura (el submit los borra si quedan vacíos, más abajo), así
  // que solo Object.keys(datos) nunca detectaba ese caso — el cambio se perdía en silencio
  // (auditoría del panel de empresa).
  const construirParche = (datos, original) => {
    const parche = {};
    for (const campo of CAMPOS_FORMULARIO) {
      const nuevo = normalizar(campo, datos[campo]);
      if (nuevo === normalizar(campo, original[campo])) continue;
      parche[campo] = nuevo === undefined && CAMPOS_ANULABLES.includes(campo) ? null : datos[campo];
    }
    return parche;
  };

  const abrirFormulario = (oferta = null) => {
    ofertaEnEdicion = oferta;
    formulario.reset();
    tituloFormulario.textContent = oferta ? 'Editar oferta' : 'Nueva oferta';
    if (oferta) {
      formulario.titulo.value = oferta.titulo;
      formulario.descripcion.value = oferta.descripcion;
      formulario.requisitos.value = oferta.requisitos;
      formulario.area.value = oferta.area;
      formulario.modalidad.value = oferta.modalidad;
      formulario.jornada.value = oferta.jornada;
      formulario.comuna.value = oferta.comuna ?? '';
      formulario.remunerada.checked = oferta.remunerada;
      formulario.montoMensual.value = oferta.montoMensual ?? '';
      formulario.cupos.value = oferta.cupos ?? 1;
      formulario.fechaCierre.value = oferta.fechaCierre ? oferta.fechaCierre.slice(0, 10) : '';
    }
    seccionFormulario.hidden = false;
    seccionFormulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cerrarFormulario = () => {
    seccionFormulario.hidden = true;
    ofertaEnEdicion = null;
    formulario.reset();
  };

  botonNueva.addEventListener('click', () => abrirFormulario());
  botonCancelarFormulario.addEventListener('click', cerrarFormulario);

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarMensaje('');
    const datos = Object.fromEntries(new FormData(formulario).entries());
    datos.remunerada = formulario.remunerada.checked;
    if (!datos.comuna) delete datos.comuna;
    if (datos.montoMensual) datos.montoMensual = Number(datos.montoMensual);
    else delete datos.montoMensual;
    if (datos.cupos) datos.cupos = Number(datos.cupos);
    else delete datos.cupos;
    if (!datos.fechaCierre) delete datos.fechaCierre;

    try {
      if (ofertaEnEdicion) {
        const parche = construirParche(datos, ofertaEnEdicion);
        if (Object.keys(parche).length === 0) {
          cerrarFormulario();
          return;
        }
        const tocaContenido = CAMPOS_CONTENIDO.some((campo) => parche[campo] !== undefined);
        if (tocaContenido && ['en_revision', 'publicada'].includes(ofertaEnEdicion.estado)) {
          const continuar = window.confirm(
            'Editar el contenido de una oferta en revisión o publicada la manda de vuelta a borrador, para que coordinación la revise de nuevo. ¿Continuar?',
          );
          if (!continuar) return;
        }
        await editar(ofertaEnEdicion.id, parche);
      } else {
        await crear(datos);
      }
      mostrarMensaje('Guardado.');
      cerrarFormulario();
      await cargar();
    } catch (error) {
      mostrarMensaje(mensajeDeError(error));
    }
  });

  const accionarEnviarARevision = async (oferta, boton) => {
    boton.disabled = true;
    try {
      await enviarARevision(oferta.id);
      await cargar();
    } catch (error) {
      mostrarMensaje(mensajeDeError(error));
      boton.disabled = false;
    }
  };

  // El cierre y la declaración tardía de resultado comparten el mismo endpoint (ofertas.service.js
  // cerrar()): una oferta ya "cerrada" sin resultado declarado (el sistema la cerró por vencimiento)
  // vuelve a pasar por acá con el mismo selector, no por una acción aparte.
  const crearBloqueCierre = (oferta, esDeclaracionTardia) => {
    const contenedor = document.createElement('div');
    // "d-flex" se agrega recién al abrir, no acá: es una utilidad con !important (Bootstrap 5), y
    // !important le gana al display:none que el propio navegador aplica a [hidden] — con las dos
    // clases puestas a la vez, contenedor.hidden = true no ocultaba nada (visto en una captura real
    // de Chrome headless, mismo tipo de bug de CSS que .card-body en Fase 6 parte 3).
    contenedor.className = 'mt-2 gap-2 align-items-center';
    contenedor.hidden = true;

    const select = document.createElement('select');
    select.className = 'form-select form-select-sm w-auto';
    // Placeholder deshabilitado y preseleccionado: sin esto, el primer motivo real ("Contratado")
    // queda elegido por defecto y dos clics rápidos ("Cerrar" → "Confirmar") registran una
    // contratación que puede no existir (auditoría del panel de empresa; regla 2 de la spec: cerrar
    // sin motivo elegido a propósito no debería ser posible desde la interfaz).
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Elige un motivo…';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.append(placeholder);
    for (const [valor, texto] of Object.entries(MOTIVOS_CIERRE)) {
      const opcion = document.createElement('option');
      opcion.value = valor;
      opcion.textContent = texto;
      select.append(opcion);
    }

    const botonConfirmar = document.createElement('button');
    botonConfirmar.type = 'button';
    botonConfirmar.className = 'btn btn-outline-danger btn-sm';
    botonConfirmar.textContent = 'Confirmar';
    botonConfirmar.disabled = true;
    select.addEventListener('change', () => { botonConfirmar.disabled = !select.value; });
    botonConfirmar.addEventListener('click', async () => {
      botonConfirmar.disabled = true;
      try {
        await cerrar(oferta.id, select.value);
        await cargar();
      } catch (error) {
        mostrarMensaje(mensajeDeError(error));
        botonConfirmar.disabled = false;
      }
    });

    const botonAbrir = document.createElement('button');
    botonAbrir.type = 'button';
    botonAbrir.className = esDeclaracionTardia ? 'btn btn-outline-secondary btn-sm' : 'btn btn-outline-danger btn-sm';
    botonAbrir.textContent = esDeclaracionTardia ? 'Declarar resultado' : 'Cerrar';
    botonAbrir.addEventListener('click', () => {
      contenedor.hidden = false;
      contenedor.classList.add('d-flex');
      botonAbrir.hidden = true;
    });

    contenedor.append(select, botonConfirmar);
    return { botonAbrir, contenedor };
  };

  const crearTarjeta = (oferta) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'card card-oferta';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body';

    const estado = textoEstadoOferta(oferta.estado);
    const insignia = document.createElement('span');
    insignia.className = `estado-oferta ${estado.clase}`;
    insignia.textContent = estado.texto;

    const titulo = document.createElement('h2');
    titulo.className = 'h5 mt-2 mb-1';
    titulo.textContent = oferta.titulo;

    const detalle = document.createElement('p');
    detalle.className = 'small text-body-secondary mb-2';
    const partes = [oferta.modalidad, oferta.comuna, oferta.remunerada ? `Remunerada ($${oferta.montoMensual ?? '—'})` : 'No remunerada'].filter(Boolean);
    if (oferta.fechaCierre) partes.push(`Cierra el ${new Date(oferta.fechaCierre).toLocaleDateString('es-CL')}`);
    detalle.textContent = partes.join(' · ');

    const acciones = document.createElement('div');
    acciones.className = 'd-flex flex-wrap gap-2';

    const enlacePostulantes = document.createElement('a');
    enlacePostulantes.className = 'btn btn-outline-secondary btn-sm';
    enlacePostulantes.href = `postulantes.html?ofertaId=${encodeURIComponent(oferta.id)}`;
    enlacePostulantes.textContent = 'Ver postulantes';
    acciones.append(enlacePostulantes);

    if (['borrador', 'en_revision', 'publicada'].includes(oferta.estado)) {
      const botonEditar = document.createElement('button');
      botonEditar.type = 'button';
      botonEditar.className = 'btn btn-outline-secondary btn-sm';
      botonEditar.textContent = 'Editar';
      botonEditar.addEventListener('click', () => abrirFormulario(oferta));
      acciones.append(botonEditar);
    }

    if (oferta.estado === 'borrador') {
      const botonEnviar = document.createElement('button');
      botonEnviar.type = 'button';
      botonEnviar.className = 'btn btn-primary btn-sm';
      botonEnviar.textContent = 'Enviar a revisión';
      botonEnviar.disabled = !empresaValidada;
      if (!empresaValidada) botonEnviar.title = 'Tu empresa todavía no está validada por coordinación.';
      botonEnviar.addEventListener('click', () => accionarEnviarARevision(oferta, botonEnviar));
      acciones.append(botonEnviar);
    }

    let bloqueCierre = null;
    if (oferta.estado === 'publicada' || (oferta.estado === 'cerrada' && !oferta.resultadoDeclarado)) {
      bloqueCierre = crearBloqueCierre(oferta, oferta.estado === 'cerrada');
      acciones.append(bloqueCierre.botonAbrir);
    }

    cuerpo.append(insignia, titulo, detalle, acciones);
    if (bloqueCierre) cuerpo.append(bloqueCierre.contenedor);
    tarjeta.append(cuerpo);
    return tarjeta;
  };

  const cargar = async () => {
    try {
      const ofertas = await listarMias();
      if (ofertas.length === 0) {
        lista.replaceChildren();
        mostrarMensaje('Todavía no tienes ofertas. Crea la primera con "Nueva oferta".');
        return;
      }
      mostrarMensaje('');
      lista.replaceChildren(...ofertas.map(crearTarjeta));
    } catch (error) {
      mostrarMensaje(mensajeDeError(error));
    }
  };

  botonCerrarSesion.addEventListener('click', async () => {
    await logout();
    window.location.href = 'index.html';
  });

  (async () => {
    try {
      const perfil = await obtenerPerfilEmpresa();
      empresaValidada = perfil.estadoValidacion === 'validada';
      if (!empresaValidada) {
        avisoNoValidada.textContent = 'Tu empresa todavía no está validada por coordinación: puedes preparar borradores, pero no enviarlos a revisión.';
        avisoNoValidada.hidden = false;
      }
      await cargar();
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'PERFIL_NO_ENCONTRADO') {
        botonNueva.disabled = true;
        mostrarMensaje('Todavía no tienes un perfil de empresa. Créalo primero en "Mi empresa".');
      } else {
        mostrarMensaje(mensajeDeError(error));
      }
    }
  })();
}
