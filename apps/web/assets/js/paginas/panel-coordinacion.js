import { protegerPagina } from '../componentes/proteger-pagina.js';
import { listarTodas, validar, rechazar as rechazarEmpresa, suspender, listarTodosLosIndicadores } from '../api/empresas.js';
import { listarPendientesRevision, aprobar, rechazarOferta } from '../api/ofertas.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { listarPendientes as listarLogosPendientes, aprobarLogo, retirarLogo, urlImagenParaRevision } from '../api/logos.js';
import { etiquetaModalidad, etiquetaJornada, etiquetaRemuneracion, etiquetaArea, formatoFechaCorta, formatoRut } from '../formato.js';
import { obtenerPanorama } from '../api/panorama.js';
import { textoEstado } from '../componentes/linea-tiempo.js';

// Texto y clase de insignia van juntos a propósito (docs/08-guia-visual.md, sección "Empresa"): la
// misma idea de "el color nunca es la única señal" que ya usan las insignias de oferta/postulación.
const ESTADO_EMPRESA = {
  pendiente: { texto: 'Pendiente', clase: 'pendiente' },
  validada: { texto: 'Validada', clase: 'validada' },
  rechazada: { texto: 'Rechazada', clase: 'rechazada' },
  suspendida: { texto: 'Suspendida', clase: 'suspendida' },
};

const usuario = await protegerPagina('coordinacion');
if (usuario) iniciar();

function iniciar() {
  const listaEmpresas = document.getElementById('lista-empresas');
  const listaOfertas = document.getElementById('lista-ofertas');
  const listaLogos = document.getElementById('lista-logos');
  const tablaIndicadores = document.getElementById('tabla-indicadores');
  const mensajeEstado = document.getElementById('mensaje-estado');

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
    tarjeta.className = 'card-oferta';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'oferta-cuerpo';

    const titulo = document.createElement('h3');
    titulo.className = 'h6 mb-1';
    titulo.textContent = empresa.razonSocial;

    // Sin esto, validar es un trámite por el nombre y nada más — RUT, sitio y contacto son
    // justo lo que permite verificar que la empresa existe de verdad (docs/03-seguridad.md §5,
    // auditoría del panel de coordinación).
    const detalle = document.createElement('p');
    detalle.className = 'small text-body-secondary mb-1';
    detalle.textContent = [
      `RUT: ${formatoRut(empresa.rutEmpresa)}`,
      empresa.giro,
      empresa.sitioWeb,
      empresa.comuna,
      `Contacto: ${empresa.contactoNombre} (${empresa.contactoCargo})`,
    ]
      .filter(Boolean)
      .join(' · ');

    const estadoInfo = ESTADO_EMPRESA[empresa.estadoValidacion] ?? { texto: empresa.estadoValidacion, clase: 'pendiente' };
    const estado = document.createElement('p');
    estado.className = 'mb-2';
    const insigniaEstado = document.createElement('span');
    insigniaEstado.className = `estado-empresa ${estadoInfo.clase}`;
    insigniaEstado.textContent = estadoInfo.texto;
    estado.append(insigniaEstado);
    const motivo = empresa.estadoValidacion === 'rechazada' ? empresa.motivoRechazo : empresa.estadoValidacion === 'suspendida' ? empresa.motivoSuspension : null;
    if (motivo) {
      const motivoEl = document.createElement('span');
      motivoEl.className = 'text-body-secondary small ms-2';
      motivoEl.textContent = motivo;
      estado.append(motivoEl);
    }

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
    tarjeta.className = 'card-oferta';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'oferta-cuerpo';

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
      etiquetaModalidad(oferta.modalidad),
      oferta.comuna,
      etiquetaJornada(oferta.jornada),
      etiquetaRemuneracion(oferta.remunerada, oferta.montoMensual),
    ].filter(Boolean);
    if (oferta.fechaCierre) partes.push(`Cierra el ${formatoFechaCorta(oferta.fechaCierre)}`);
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


  // Las URLs de objeto de los logos que se están mostrando. Se revocan antes de repintar: sin esto
  // cada recarga de la lista deja los blobs anteriores retenidos por toda la vida de la pestaña.
  const urlsEnUso = new Set();
  const soltarUrls = () => {
    urlsEnUso.forEach((url) => URL.revokeObjectURL(url));
    urlsEnUso.clear();
  };

  const crearFilaLogo = async (logo) => {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'card-oferta';

    // La imagen a la vista, no solo el nombre de la empresa: aprobar a ciegas fue exactamente el
    // hallazgo que la auditoría de este panel corrigió en la Fase 6. Si no se puede cargar, se dice
    // explícitamente en vez de mostrar un hueco que se lea como "no hay nada raro".
    const caja = document.createElement('div');
    caja.className = 'oferta-logo';
    try {
      const url = await urlImagenParaRevision(logo.id);
      urlsEnUso.add(url);
      const imagen = document.createElement('img');
      imagen.src = url;
      imagen.alt = `Logo propuesto por ${logo.razonSocial}`;
      caja.append(imagen);
    } catch {
      caja.textContent = '!';
      caja.title = 'No se pudo cargar la imagen';
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'oferta-cuerpo';
    const titulo = document.createElement('h3');
    titulo.className = 'oferta-titulo mb-1';
    titulo.textContent = logo.razonSocial;
    const detalle = document.createElement('p');
    detalle.className = 'oferta-empresa mb-2';
    // Bajo 1 KB se muestran los bytes: Math.round(n/1024) dejaba "0 KB" en un ícono chico, que se
    // lee como un archivo vacío o roto justo cuando hay que decidir si aprobarlo.
    const bytes = Number(logo.tamanoBytes);
    const peso = bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
    detalle.textContent = `${logo.mime} · ${peso} · empresa ${logo.estadoValidacion}`;

    const acciones = document.createElement('div');
    acciones.className = 'd-flex flex-wrap gap-2';
    const aprobar = document.createElement('button');
    aprobar.type = 'button';
    aprobar.className = 'btn btn-primary btn-sm';
    aprobar.textContent = 'Aprobar';
    aprobar.addEventListener('click', async () => {
      aprobar.disabled = true;
      try {
        await aprobarLogo(logo.id);
        await cargarLogos();
      } catch (error) {
        mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
        aprobar.disabled = false;
      }
    });
    const retirar = document.createElement('button');
    retirar.type = 'button';
    retirar.className = 'btn btn-outline-danger btn-sm';
    retirar.textContent = 'Rechazar';
    retirar.addEventListener('click', async () => {
      retirar.disabled = true;
      try {
        await retirarLogo(logo.id);
        await cargarLogos();
      } catch (error) {
        mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
        retirar.disabled = false;
      }
    });
    acciones.append(aprobar, retirar);

    cuerpo.append(titulo, detalle, acciones);
    tarjeta.append(caja, cuerpo);
    return tarjeta;
  };

  const cargarLogos = async () => {
    soltarUrls();
    try {
      const { logos } = await listarLogosPendientes();
      listaLogos.replaceChildren(...(logos.length
        ? await Promise.all(logos.map(crearFilaLogo))
        : [document.createTextNode('No hay logos esperando revisión.')]));
    } catch (error) {
      mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    }
  };


  // --- Panorama (specs/14-panorama-de-coordinacion) ---

  const resumen = document.getElementById('panorama-resumen');
  const listaSinPostulantes = document.getElementById('panorama-sin-postulantes');
  const embudoContenedor = document.getElementById('panorama-embudo');
  const tablaAreas = document.getElementById('panorama-areas');

  const indicador = (titulo, valor, detalle) => {
    const div = document.createElement('div');
    div.className = 'indicador';
    const dl = document.createElement('dl');
    dl.className = 'mb-0';
    const dt = document.createElement('dt');
    dt.textContent = titulo;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    dl.append(dt, dd);
    if (detalle) {
      const p = document.createElement('p');
      p.className = 'small text-body-secondary mb-0 mt-1';
      p.textContent = detalle;
      dl.append(p);
    }
    div.append(dl);
    return div;
  };

  // El embudo se dibuja con barras proporcionales y NO con un gráfico: la proporción se lee de un
  // vistazo y el número exacto sigue ahí al lado. Un gráfico que nadie sabe leer es peor que una
  // cifra clara (spec, fuera de alcance).
  const filaEmbudo = (estado, cantidad, total) => {
    const fila = document.createElement('div');
    fila.className = 'd-flex align-items-center gap-2 mb-1';

    const nombre = document.createElement('span');
    nombre.className = 'small';
    nombre.style.minWidth = '9rem';
    nombre.textContent = textoEstado(estado);

    const canal = document.createElement('div');
    canal.className = 'flex-grow-1 rounded';
    canal.style.height = '0.6rem';
    canal.style.background = 'var(--uah-blanco-3)';

    const barra = document.createElement('div');
    barra.className = 'rounded';
    barra.style.height = '100%';
    barra.style.width = total > 0 ? `${Math.round((cantidad / total) * 100)}%` : '0%';
    // Naranja solo para sin_respuesta: es el estado que la plataforma existe para evitar, y el
    // naranja está reservado para lo que pide atención (docs/08-guia-visual.md).
    barra.style.background = estado === 'sin_respuesta' ? 'var(--uah-naranja)' : 'var(--uah-marengo-2)';
    canal.append(barra);

    const numero = document.createElement('span');
    numero.className = 'small text-body-secondary';
    numero.style.minWidth = '2.5rem';
    numero.style.textAlign = 'right';
    numero.textContent = String(cantidad);

    fila.append(nombre, canal, numero);
    return fila;
  };

  const tarjetaSinPostulantes = (oferta) => {
    const div = document.createElement('div');
    div.className = 'card-oferta';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'oferta-cuerpo';

    const titulo = document.createElement('p');
    titulo.className = 'oferta-titulo mb-1';
    titulo.textContent = oferta.titulo;

    const meta = document.createElement('p');
    meta.className = 'oferta-meta mb-0';
    meta.textContent = `${oferta.empresa} · ${etiquetaArea(oferta.area)} · ${oferta.diasPublicada} días publicada · cierra el ${formatoFechaCorta(oferta.fechaCierre)}`;

    cuerpo.append(titulo, meta);
    div.append(cuerpo);
    return div;
  };

  const cargarPanorama = async () => {
    try {
      const datos = await obtenerPanorama();

      resumen.replaceChildren(
        indicador('Ofertas publicadas', datos.ofertas.publicada),
        indicador('Postulaciones', datos.postulacionesTotal),
        indicador('Sin respuesta', datos.embudo.sin_respuesta, 'La plataforma existe para que esto sea cero'),
        indicador('Empresas por validar', datos.empresas.pendiente),
      );

      listaSinPostulantes.replaceChildren(...(datos.ofertasSinPostulantes.length
        ? datos.ofertasSinPostulantes.map(tarjetaSinPostulantes)
        : [document.createTextNode(`Ninguna oferta lleva más de ${datos.diasSinPostulantes} días sin postulantes.`)]));

      embudoContenedor.replaceChildren(...Object.entries(datos.embudo)
        .map(([estado, cantidad]) => filaEmbudo(estado, cantidad, datos.postulacionesTotal)));

      tablaAreas.replaceChildren(...datos.porArea.map((area) => {
        const tr = document.createElement('tr');
        // Postulaciones por cupo: la cifra que dice de un vistazo dónde sobra gente y dónde falta.
        const porCupo = area.cupos > 0 ? (area.postulaciones / area.cupos).toFixed(1) : '—';
        for (const [valor, alineado] of [[etiquetaArea(area.area), false], [area.ofertas, true],
          [area.cupos, true], [area.postulaciones, true], [porCupo, true]]) {
          const td = document.createElement('td');
          if (alineado) td.className = 'text-end';
          td.textContent = String(valor);
          tr.append(td);
        }
        return tr;
      }));
    } catch (error) {
      mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
    }
  };

  cargarEmpresas();
  cargarLogos();
  cargarOfertas();
  cargarIndicadores();
  cargarPanorama();
}
