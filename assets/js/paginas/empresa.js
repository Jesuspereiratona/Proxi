import { obtenerPerfilPublico, obtenerIndicadores } from '../api/empresas.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';

const mensajeEstado = document.getElementById('mensaje-estado');
const perfil = document.getElementById('perfil');

const mostrarMensaje = (texto) => {
  mensajeEstado.textContent = texto;
  mensajeEstado.hidden = !texto;
};

const formatoPorcentaje = (fraccion) => `${Math.round(fraccion * 100)}%`;

// Defensa en profundidad: el esquema del servidor ya rechaza sitioWeb con protocolo distinto de
// http/https, pero un href nunca debe fijarse sin revalidar acá también (auditoría de Fase 6 —
// una URI javascript: asignada directo a href se ejecuta al hacer clic).
const urlHttpSegura = (valor) => {
  try {
    const url = new URL(valor);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const pintarPerfil = (empresa) => {
  document.getElementById('perfil-nombre').textContent = empresa.razonSocial;
  document.getElementById('perfil-giro').textContent = empresa.giro ?? '';
  document.getElementById('perfil-comuna').textContent = empresa.comuna ?? '';

  const enlaceSitio = document.getElementById('perfil-sitio');
  const sitioSeguro = empresa.sitioWeb ? urlHttpSegura(empresa.sitioWeb) : null;
  if (sitioSeguro) {
    enlaceSitio.href = sitioSeguro;
    enlaceSitio.textContent = 'Sitio web';
  } else {
    enlaceSitio.hidden = true;
  }

  perfil.hidden = false;
};

const pintarIndicadores = (indicadores) => {
  if (!indicadores.suficienteHistorial) {
    document.getElementById('indicadores-sin-historial').hidden = false;
    return;
  }

  document.getElementById('indicador-tasa-respuesta').textContent =
    indicadores.tasaRespuesta != null
      ? `Responde al ${formatoPorcentaje(indicadores.tasaRespuesta)} de las postulaciones que recibe`
      : 'Todavía sin suficientes postulaciones para calcularla';
  document.getElementById('indicador-dias-respuesta').textContent =
    indicadores.diasPromedioRespuesta != null ? `${indicadores.diasPromedioRespuesta} días en promedio` : 'Todavía sin suficientes postulaciones para calcularlo';
  document.getElementById('indicador-tasa-cierre').textContent = `Declara el resultado en el ${formatoPorcentaje(indicadores.tasaCierreDeclarado)} de sus cierres`;
  document.getElementById('indicador-ofertas-12m').textContent = `${indicadores.ofertasPublicadas12m} en los últimos 12 meses`;

  document.getElementById('indicadores-lista').hidden = false;
};

const cargar = async () => {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    mostrarMensaje('Falta indicar qué empresa ver.');
    return;
  }
  try {
    const empresa = await obtenerPerfilPublico(id);
    pintarPerfil(empresa);
    const indicadores = await obtenerIndicadores(id);
    pintarIndicadores(indicadores);
  } catch (error) {
    mostrarMensaje(error instanceof ErrorApi ? error.message : mensajeParaCodigo());
  }
};

cargar();
