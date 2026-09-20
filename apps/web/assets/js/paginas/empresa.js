import { obtenerPerfilPublico, obtenerIndicadores } from '../api/empresas.js';
import { ErrorApi, mensajeParaCodigo } from '../api/cliente.js';
import { icono } from '../componentes/iconos.js';
import { urlLogo } from '../api/logos.js';

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
  // Misma ranura de logo que la tarjeta de la vitrina: hasta que exista la subida de logos, la
  // inicial de la razón social. Que las dos pantallas muestren lo mismo importa — es la misma
  // empresa que la persona acaba de ver en el listado.
  const logo = document.getElementById('perfil-logo');
  const inicial = empresa.razonSocial?.trim()?.[0];
  const caerAInicial = () => {
    logo.replaceChildren();
    if (inicial) logo.textContent = inicial.toUpperCase();
    else logo.append(icono('edificio'));
  };

  if (empresa.tieneLogo) {
    const imagen = document.createElement('img');
    imagen.src = urlLogo(empresa.id);
    imagen.alt = '';
    // Si no carga (retirado justo ahora, red caída) se cae a la inicial en vez de dejar el ícono
    // roto del navegador encabezando el perfil.
    imagen.addEventListener('error', caerAInicial);
    logo.append(imagen);
  } else {
    caerAInicial();
  }

  // Cada dato se muestra solo si existe: una fila con el ícono de ubicación y nada al lado se lee
  // como un error de carga, no como "esta empresa no declaró comuna".
  if (empresa.comuna) {
    const item = document.getElementById('perfil-comuna-item');
    item.prepend(icono('pin'));
    document.getElementById('perfil-comuna').textContent = empresa.comuna;
    item.hidden = false;
  }

  const sitioSeguro = empresa.sitioWeb ? urlHttpSegura(empresa.sitioWeb) : null;
  if (sitioSeguro) {
    const item = document.getElementById('perfil-sitio-item');
    item.prepend(icono('edificio'));
    document.getElementById('perfil-sitio').href = sitioSeguro;
    item.hidden = false;
  }

  perfil.hidden = false;
};

// La cifra y la explicación se separan a propósito: son cuatro números que la persona compara entre
// empresas, y en una frase corrida ("Responde al 85% de las postulaciones que recibe") hay que leer
// el renglón entero para encontrarlo. La frase no se pierde, baja a nota al pie del número.
const pintarIndicador = (id, cifra, nota) => {
  const destino = document.getElementById(id);
  destino.replaceChildren();
  const valor = document.createElement('span');
  valor.className = 'cifra';
  valor.textContent = cifra;
  const aclaracion = document.createElement('span');
  aclaracion.className = 'nota';
  aclaracion.textContent = nota;
  destino.append(valor, aclaracion);
};

// Una raya y no un cero: "0%" diría que la empresa no responde nunca, que es lo contrario de
// "todavía no hay con qué calcularlo". El umbral por volumen viene del servidor (Fase 5).
const SIN_DATOS = '—';

const pintarIndicadores = (indicadores) => {
  if (!indicadores.suficienteHistorial) {
    document.getElementById('indicadores-sin-historial').hidden = false;
    return;
  }

  pintarIndicador('indicador-tasa-respuesta',
    indicadores.tasaRespuesta != null ? formatoPorcentaje(indicadores.tasaRespuesta) : SIN_DATOS,
    indicadores.tasaRespuesta != null
      ? 'de las postulaciones que recibe'
      : 'todavía sin suficientes postulaciones');

  pintarIndicador('indicador-dias-respuesta',
    indicadores.diasPromedioRespuesta != null ? `${indicadores.diasPromedioRespuesta} días` : SIN_DATOS,
    indicadores.diasPromedioRespuesta != null
      ? 'en promedio para responder'
      : 'todavía sin suficientes postulaciones');

  pintarIndicador('indicador-tasa-cierre',
    formatoPorcentaje(indicadores.tasaCierreDeclarado),
    'de sus cierres declara el resultado');

  pintarIndicador('indicador-ofertas-12m',
    String(indicadores.ofertasPublicadas12m),
    'en los últimos 12 meses');

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
