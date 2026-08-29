import { API_URL } from '../config.js';

// Traduce el {error:{codigo,mensaje}} de docs/04-manejo-de-errores.md a algo que una persona
// entienda: OFERTA_NO_VIGENTE es un código interno, nunca algo que se muestra tal cual.
const MENSAJES = {
  OFERTA_NO_ENCONTRADA: 'Esta oferta ya no está disponible.',
  OFERTA_NO_VIGENTE: 'Esta oferta ya no está disponible.',
  PERFIL_NO_ENCONTRADO: 'Esa empresa no existe.',
  VALIDACION_ENTRADA: 'Revisa los datos e intenta de nuevo.',
  DEMASIADAS_SOLICITUDES: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
  AUTH_CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
  // Mismo texto que AUTH_CREDENCIALES_INVALIDAS a propósito (auditoría de sesión web): el backend
  // lanza este código solo cuando el correo existe, antes de revisar la contraseña. Un mensaje
  // propio aquí reintroduce la enumeración de usuarios que docs/03-seguridad.md prohíbe
  // explícitamente ("respuestas idénticas en correo no existe y contraseña incorrecta") — el
  // riesgo es real con correos institucionales de la FEN como blanco de phishing dirigido.
  AUTH_CUENTA_BLOQUEADA: 'Correo o contraseña incorrectos.',
  AUTH_EMAIL_NO_VERIFICADO: 'Todavía no verificas tu correo.',
  AUTH_TOKEN_EXPIRADO: 'Tu sesión expiró. Inicia sesión de nuevo.',
  AUTH_TOKEN_INVALIDO: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  NO_AUTORIZADO: 'No tienes permiso para ver esto.',
};
const MENSAJE_GENERICO = 'Ocurrió un problema. Intenta de nuevo en un momento.';

export class ErrorApi extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
  }
}

export const mensajeParaCodigo = (codigo) => MENSAJES[codigo] || MENSAJE_GENERICO;

// El token de acceso vive solo en esta variable de módulo, nunca en localStorage ni
// sessionStorage (docs/03-seguridad.md): ningún script de la página puede leerlo entre recargas
// porque no persiste en absoluto. Cada página protegida lo repone al cargar llamando a
// sesion.js iniciarSesion(), que se apoya en la cookie httpOnly que ya emite el login (Fase 1).
let accessToken = null;
export const fijarToken = (token) => { accessToken = token; };
export const limpiarToken = () => { accessToken = null; };

const cuerpoDeError = async (respuesta) => {
  let codigo = 'ERROR_INTERNO';
  try {
    const cuerpo = await respuesta.json();
    codigo = cuerpo?.error?.codigo || codigo;
  } catch {
    // sin cuerpo JSON legible: se queda con ERROR_INTERNO
  }
  throw new ErrorApi(codigo, mensajeParaCodigo(codigo));
};

// POST /auth/refrescar no lleva Authorization (no autenticado): se apoya solo en la cookie
// httpOnly, por eso usa fetch directo y no pasa por peticion() — evita que un refresco fallido
// dispare otro intento de refresco.
const refrescarUnaVez = async () => {
  try {
    const respuesta = await fetch(`${API_URL}/auth/refrescar`, { method: 'POST', credentials: 'include' });
    if (!respuesta.ok) {
      limpiarToken();
      return false;
    }
    const { accessToken: nuevo } = await respuesta.json();
    if (!nuevo) {
      limpiarToken();
      return false;
    }
    fijarToken(nuevo);
    return true;
  } catch {
    limpiarToken();
    return false;
  }
};

// El refresco rota el token de refresco en el backend (Fase 1): dos llamadas en paralelo con la
// misma cookie parecen un reuso y revocan TODAS las sesiones del usuario, no solo esta pestaña
// (auditoría de sesión web — es el mecanismo que existe justamente para detectar un token robado,
// así que dispararlo por una carrera del cliente lo vuelve inservible como señal real). Se
// serializa en dos niveles: dentro de la pestaña con un promise compartido, entre pestañas del
// mismo origen con Web Locks (todas comparten la misma cookie).
let refrescoEnCurso = null;
export const refrescarSesion = () => {
  if (refrescoEnCurso) return refrescoEnCurso;
  // typeof, no navigator?.locks: en un entorno sin el global `navigator` en absoluto (Node en las
  // pruebas), el encadenamiento opcional no protege contra la ReferenceError de un identificador
  // que no existe, solo contra un valor null/undefined.
  const tieneWebLocks = typeof navigator !== 'undefined' && navigator.locks;
  const ejecucion = tieneWebLocks
    ? navigator.locks.request('proxi:refresco-sesion', refrescarUnaVez)
    : refrescarUnaVez();
  refrescoEnCurso = ejecucion.finally(() => { refrescoEnCurso = null; });
  return refrescoEnCurso;
};

const construirUrl = (ruta, parametros) => {
  const url = new URL(`${API_URL}${ruta}`);
  if (parametros) {
    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
    }
  }
  return url;
};

// Único lugar que llama fetch (docs/01-arquitectura.md: "nadie llama fetch fuera de aquí").
// `autenticado` agrega el header; `credenciales` manda la cookie httpOnly (login, refresco,
// logout la necesitan; el resto de rutas públicas no manda cookies a propósito).
const peticion = async (metodo, ruta, { cuerpo, autenticado = false, credenciales = false, reintentar = true, parametros } = {}) => {
  const encabezados = {};
  if (cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';
  if (autenticado && accessToken) encabezados.Authorization = `Bearer ${accessToken}`;

  let respuesta;
  try {
    respuesta = await fetch(construirUrl(ruta, parametros), {
      method: metodo,
      headers: encabezados,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      credentials: credenciales ? 'include' : 'same-origin',
    });
  } catch {
    throw new ErrorApi('ERROR_RED', MENSAJE_GENERICO);
  }

  // El access token dura 15 minutos (Fase 1): un 401 en una petición autenticada no es
  // necesariamente el fin de la sesión, puede ser solo que venció a mitad de una visita larga. Se
  // intenta reponerlo una vez con la cookie antes de rendirse (reintentar:false corta el loop).
  if (respuesta.status === 401 && autenticado && reintentar) {
    const repuesto = await refrescarSesion();
    if (repuesto) return peticion(metodo, ruta, { cuerpo, autenticado, credenciales, reintentar: false, parametros });
  }

  if (!respuesta.ok) return cuerpoDeError(respuesta);
  return respuesta.status === 204 ? null : respuesta.json();
};

export const obtener = (ruta, parametros = {}) => peticion('GET', ruta, { parametros });
export const obtenerAutenticado = (ruta) => peticion('GET', ruta, { autenticado: true });
export const enviar = (metodo, ruta, cuerpo, opciones = {}) => peticion(metodo, ruta, { ...opciones, cuerpo });
