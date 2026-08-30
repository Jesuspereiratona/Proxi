import { protegerPagina } from '../componentes/proteger-pagina.js';
import { listarTodas, validar, rechazar as rechazarEmpresa, suspender, listarTodosLosIndicadores } from '../api/empresas.js';
import { listarPendientesRevision, aprobar, rechazarOferta } from '../api/ofertas.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { logout } from '../api/sesion.js';

const TEXTO_ESTADO_EMPRESA = { pendiente: 'Pendiente', validada: 'Validada', rechazada: 'Rechazada', suspendida: 'Suspendida' };

const usuario = await protegerPagina('coordinacion');
if (usuario) iniciar();

function iniciar() {
  const listaEmpresas = document.getElementById('lista-empresas');
  const listaOfertas = document.getElementById('lista-ofertas');
  const tablaIndicadores = document.getElementById('tabla-indicadores');
  const mensajeEstado = document.getElementById('mensaje-estado');
  const botonCerrarSesion = document.getElementById('boton-cerrar-sesion');

  const mostrarMensaje = (texto) => {
    mensajeEstado.textContent = texto;
    mensajeEstado.hidden = !texto;
  };

  const mensajeDeError = (error) => (error instanceof ErrorApi ? error.message : mensajeParaCodigo());

  // Motivo obligatorio (regla 2 de la spec): un prompt() vacío o cancelado no manda nada — a
  // diferencia del rechazo de una postulación (Fase 6 parte 4), acá la API sí lo exige
  // (rechazoEsquema/suspensionEsquema), así que el cliente tampoco deja pasar un motivo en blanco.
  const pedirMotivo = (etiqueta) => {
    const motivo = window.prompt(etiqueta, '');
    if (motivo === null) return null;
    return motivo.trim() || null;
  };

  const crearFilaEmpresa = (empresa) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'card card-oferta';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body';

    const titulo = document.createElement('h3');
    titulo.className = 'h6 mb-1';
    titulo.textContent = empresa.razonSocial;

    // Sin esto, validar es un trámite por el nombre y nada más — RUT, sitio y contacto son
    // justo lo que permite verificar que la empresa existe de verdad (docs/03-seguridad.md §5,
    // auditoría del panel de coordinación).
    const detalle = document.createElement('p');
    detalle.className = 'small text-body-secondary mb-1';
    detalle.textContent = [
      `RUT: ${empresa.rutEmpresa}`,
      empresa.giro,
      empresa.sitioWeb,
      empresa.comuna,
      `Contacto: ${empresa.contactoNombre} (${empresa.contactoCargo})`,
    ]
      .filter(Boolean)
      .join(' · ');

    const estado = document.createElement('p');
    estado.className = 'mb-2';
    let textoEstado = TEXTO_ESTADO_EMPRESA[empresa.estadoValidacion] ?? empresa.estadoValidacion;
    if (empresa.estadoValidacion === 'rechazada' && empresa.motivoRechazo) textoEstado += ` — ${empresa.motivoRechazo}`;
    if (empresa.estadoValidacion === 'suspendida' && empresa.motivoSuspension) textoEstado += ` — ${empresa.motivoSuspension}`;
    estado.textContent = `Estado: ${textoEstado}`;

    const acciones = document.createElement('div');
    acciones.className = 'd-flex flex-wrap gap-2';

    if (empresa.estadoValidacion === 'pendiente') {
      const botonValidar = document.createElement('button');
      botonValidar.type = 'button';
      botonValidar.className = 'btn btn-primary btn-sm';
      botonValidar.textContent = 'Validar';
      botonValidar.addEventListener('click', async () => {
        botonValidar.disabled = true;
        try {
          await validar(empresa.id);
          await cargarEmpresas();
        } catch (error) {
          mostrarMensaje(mensajeDeError(error));
          botonValidar.disabled = false;
        }
      });

      const botonRechazar = document.createElement('button');
      botonRechazar.type = 'button';
      botonRechazar.className = 'btn btn-outline-danger btn-sm';
      botonRechazar.textContent = 'Rechazar';
      botonRechazar.addEventListener('click', async () => {
        const motivo = pedirMotivo('Motivo del rechazo (obligatorio):');
        if (!motivo) return;
        botonRechazar.disabled = true;
        try {
          await rechazarEmpresa(empresa.id, motivo);
          await cargarEmpresas();
        } catch (error) {
          mostrarMensaje(mensajeDeError(error));
          botonRechazar.disabled = false;
        }
      });
      acciones.append(botonValidar, botonRechazar);
    } else if (empresa.estadoValidacion === 'validada') {
      const botonSuspender = document.createElement('button');
      botonSuspender.type = 'button';
      botonSuspender.className = 'btn btn-outline-danger btn-sm';
      botonSuspender.textContent = 'Suspender';
      botonSuspender.addEventListener('click', async () => {
        const motivo = pedirMotivo('Motivo de la suspensión (obligatorio):');
        if (!motivo) return;
        botonSuspender.disabled = true;
        try {
          await suspender(empresa.id, motivo);
          await cargarEmpresas();
        } catch (error) {
          mostrarMensaje(mensajeDeError(error));
          botonSuspender.disabled = false;
        }
      });
      acciones.append(botonSuspender);
    }

    cuerpo.append(titulo, detalle, estado, acciones);
    tarjeta.append(cuerpo);
    return tarjeta;
  };

  const crearFilaOferta = (oferta) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'card card-oferta';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'card-body';

    const titulo = document.createElement('h3');
    titulo.className = 'h6 mb-1';
    titulo.textContent = oferta.titulo;

    const empresaNombre = document.createElement('p');
    empresaNombre.className = 'small fw-medium mb-1';
    empresaNombre.textContent = oferta.Empresa?.razonSocial ?? '';

    // Sin esto, aprobar era un trámite por el título y nada más: el control humano que
    // docs/03-seguridad.md §5 pide para cortar spam/fraude necesita ver lo que de verdad va a
    // publicarse (auditoría del panel de coordinación) — listarPendientesRevision() ya trae la
    // oferta entera, no hace falta una petición aparte.
    const detalle = document.createElement('p');
    detalle.className = 'small text-body-secondary mb-1';
    const partes = [
      oferta.modalidad,
      oferta.comuna,
      oferta.jornada,
      oferta.remunerada ? `Remunerada ($${oferta.montoMensual ?? '—'})` : 'No remunerada',
    ].filter(Boolean);
    if (oferta.fechaCierre) partes.push(`Cierra el ${new Date(oferta.fechaCierre).toLocaleDateString('es-CL')}`);
    detalle.textContent = partes.join(' · ');

    const descripcion = document.createElement('p');
    descripcion.className = 'small mb-1';
    descripcion.textContent = oferta.descripcion;

    const requisitos = document.createElement('p');
    requisitos.className = 'small text-body-secondary mb-2';
    requisitos.textContent = `Requisitos: ${oferta.requisitos}`;

    const acciones = document.createElement('div');
    acciones.className = 'd-flex flex-wrap gap-2';

    const botonAprobar = document.createElement('button');
    botonAprobar.type = 'button';
    botonAprobar.className = 'btn btn-primary btn-sm';
    botonAprobar.textContent = 'Aprobar';
    botonAprobar.addEventListener('click', async () => {
      botonAprobar.disabled = true;
      try {
        await aprobar(oferta.id);
        await cargarOfertas();
      } catch (error) {
        mostrarMensaje(mensajeDeError(error));
        botonAprobar.disabled = false;
      }
    });

    const botonRechazar = document.createElement('button');
    botonRechazar.type = 'button';
    botonRechazar.className = 'btn btn-outline-danger btn-sm';
    botonRechazar.textContent = 'Rechazar';
    botonRechazar.addEventListener('click', async () => {
      const motivo = pedirMotivo('Motivo del rechazo (obligatorio):');
      if (!motivo) return;
      botonRechazar.disabled = true;
      try {
        await rechazarOferta(oferta.id, motivo);
        await cargarOfertas();
      } catch (error) {
        mostrarMensaje(mensajeDeError(error));
        botonRechazar.disabled = false;
      }
    });

    acciones.append(botonAprobar, botonRechazar);
    cuerpo.append(titulo, empresaNombre, detalle, descripcion, requisitos, acciones);
    tarjeta.append(cuerpo);
    return tarjeta;
  };

  const formatoPorcentaje = (valor) => (valor == null ? '—' : `${Math.round(valor * 100)}%`);

  const crearFilaIndicador = (indicador) => {
    const fila = document.createElement('tr');
    // La vista materializada (Fase 5) se repuebla completa cada noche, no al momento: una empresa
    // eliminada entre un recálculo y el siguiente deja una fila sin Empresa asociada. No pasa hoy
    // (nada borra una empresa todavía), pero Fase 7 sí lo hará, así que no se asume que siempre viene.
    const celdas = [
      indicador.Empresa?.razonSocial ?? '(empresa eliminada)',
      formatoPorcentaje(indicador.tasaRespuesta),
      indicador.diasPromedioRespuesta == null ? '—' : Math.round(indicador.diasPromedioRespuesta),
      formatoPorcentaje(indicador.tasaCierreDeclarado),
      indicador.ofertasCerradasTotal,
      indicador.ofertasPublicadas12m,
    ];
    for (const valor of celdas) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.append(celda);
    }
    return fila;
  };

  const cargarEmpresas = async () => {
    try {
      const empresas = await listarTodas();
      listaEmpresas.replaceChildren(...(empresas.length ? empresas.map(crearFilaEmpresa) : [document.createTextNode('No hay empresas registradas todavía.')]));
    } catch (error) {
      mostrarMensaje(mensajeDeError(error));
    }
  };

  const cargarOfertas = async () => {
    try {
      const ofertas = await listarPendientesRevision();
      listaOfertas.replaceChildren(...(ofertas.length ? ofertas.map(crearFilaOferta) : [document.createTextNode('No hay ofertas por revisar.')]));
    } catch (error) {
      mostrarMensaje(mensajeDeError(error));
    }
  };

  const filaVacia = (texto) => {
    const fila = document.createElement('tr');
    const celda = document.createElement('td');
    celda.colSpan = 6;
    celda.className = 'text-body-secondary';
    celda.textContent = texto;
    fila.append(celda);
    return fila;
  };

  const cargarIndicadores = async () => {
    try {
      const indicadores = await listarTodosLosIndicadores();
      tablaIndicadores.replaceChildren(...(indicadores.length ? indicadores.map(crearFilaIndicador) : [filaVacia('Todavía no hay indicadores calculados.')]));
    } catch (error) {
      mostrarMensaje(mensajeDeError(error));
    }
  };

  botonCerrarSesion.addEventListener('click', async () => {
    await logout();
    window.location.href = 'index.html';
  });

  cargarEmpresas();
  cargarOfertas();
  cargarIndicadores();
}
