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
  POSTULACION_SIN_CV: 'Debes subir tu CV antes de postular.',
  POSTULACION_YA_EXISTE: 'Ya postulaste a esta oferta.',
  POSTULACION_NO_ENCONTRADA: 'Esa postulación no existe.',
  POSTULACION_TRANSICION_INVALIDA: 'Esta postulación ya no admite ese cambio.',
  ARCHIVO_INVALIDO: 'El archivo no es un PDF válido o supera los 5 MB.',
  ARCHIVO_NO_ENCONTRADO: 'Ese archivo no existe.',
  RUT_INVALIDO: 'El RUT no es válido.',
  PERFIL_YA_EXISTE: 'Ya tienes un perfil creado.',
  // Panel de empresa (Fase 6 parte 4).
  EMPRESA_NO_VALIDADA: 'Todavía no estás validado por coordinación.',
  EMPRESA_TRANSICION_INVALIDA: 'Esta empresa ya no admite ese cambio.',
  EMPRESA_RUT_YA_REGISTRADO: 'Ese RUT de empresa ya está registrado.',
  EMPRESA_CIERRES_PENDIENTES: 'Tienes ofertas cerradas sin declarar su resultado. Decláralo antes de enviar una nueva a revisión.',
  OFERTA_SIN_FECHA_CIERRE: 'Falta la fecha de cierre.',
  OFERTA_FECHA_CIERRE_INVALIDA: 'La fecha de cierre debe ser futura.',
  OFERTA_TRANSICION_INVALIDA: 'Esta oferta ya no admite ese cambio.',
  OFERTA_CAMPO_NO_EDITABLE: 'Ese campo ya no se puede editar en esta oferta.',
  // Registro (Fase 6, pieza pendiente).
  AUTH_CORREO_YA_REGISTRADO: 'Ese correo ya tiene una cuenta.',
  CONSENTIMIENTO_REQUERIDO: 'Debes aceptar la política de privacidad para registrarte.',
};
const MENSAJE_GENERICO = 'Ocurrió un problema. Intenta de nuevo en un momento.';

export class ErrorApi extends Error {
  constructor(codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.codigo = codigo;
    // Detalle por campo (validar.middleware.js: [{campo, mensaje}]) — casi ningún formulario lo
    // necesita (el mensaje genérico de VALIDACION_ENTRADA alcanza), pero el de oferta del panel de
    // empresa tiene varias reglas cruzadas (Fase 6 parte 4) y perder el mensaje específico que la
    // API ya calculó, a cambio de uno genérico, es peor experiencia sin ninguna ganancia real.
    this.detalles = detalles;
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

// El payload del JWT es {sub, rol, exp} (Fase 1) — nada sensible. Decodificarlo acá es solo para
// decidir qué mostrar (qué panel, qué botones): nunca autoriza nada de verdad, cada petición real
// la revalida el servidor con la firma completa. Sirve para protegerPagina() al cargar una página
// (después de refrescarSesion(), que no devuelve el usuario, solo el token).
export const usuarioActual = () => {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    const decodificado = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return { id: decodificado.sub, rol: decodificado.rol };
  } catch {
    return null;
  }
};

// `document` no existe en las pruebas (node --test, sin DOM) — mismo motivo que tieneWebLocks más
// abajo: typeof, no encadenamiento opcional, porque el identificador no existe en absoluto.
const leerCookie = (nombre) => {
  if (typeof document === 'undefined') return '';
  const fila = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`));
  return fila ? decodeURIComponent(fila.slice(nombre.length + 1)) : '';
};

const cuerpoDeError = async (respuesta) => {
  let codigo = 'ERROR_INTERNO';
  let detalles;
  try {
    const cuerpo = await respuesta.json();
    codigo = cuerpo?.error?.codigo || codigo;
    detalles = cuerpo?.error?.detalles;
  } catch {
    // sin cuerpo JSON legible: se queda con ERROR_INTERNO
  }
  throw new ErrorApi(codigo, mensajeParaCodigo(codigo), detalles);
};

// POST /auth/refrescar no lleva Authorization (no autenticado): se apoya solo en la cookie
// httpOnly, por eso usa fetch directo y no pasa por fetchConReintento() — evita que un refresco
// fallido dispare otro intento de refresco.
const refrescarUnaVez = async () => {
  try {
    const csrf = leerCookie('csrf');
    const respuesta = await fetch(`${API_URL}/auth/refrescar`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    });
    if (!respuesta.ok) {
      // Solo 401/403 significan de verdad "no hay sesión" — limpiarToken() ahí. Un 429 (límite de
      // tasa global compartido, oferta.html lo llama en cada visita pública) o un 500 transitorio
      // no prueban que la sesión murió; borrar el token igual mandaba a un estudiante con sesión
      // válida a re-escribir su clave por un error del servidor (auditoría del panel de estudiante).
      if (respuesta.status === 401 || respuesta.status === 403) limpiarToken();
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
    // Fallo de red: ambiguo, no borra el token por la misma razón de arriba.
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

// Único punto que llama fetch (docs/01-arquitectura.md: "nadie llama fetch fuera de aquí").
// Devuelve la Response cruda: quien llama decide cómo leer el cuerpo (JSON, blob, nada) — así
// tanto peticion() como enviarFormData()/descargarArchivo() comparten el mismo manejo de sesión
// sin que ninguno le imponga al otro un formato de respuesta.
const fetchConReintento = async (metodo, ruta, { encabezados = {}, cuerpo, autenticado = false, credenciales = false, reintentar = true, parametros } = {}) => {
  const encabezadosFinales = { ...encabezados };
  if (autenticado && accessToken) encabezadosFinales.Authorization = `Bearer ${accessToken}`;
  // Doble-submit CSRF (apps/api/.../verificar-csrf.middleware.js): solo /auth/refrescar y
  // /auth/logout la exigen, pero mandarla siempre que hay cookies de por medio es más simple que
  // acoplar este cliente genérico a rutas específicas — el servidor la ignora en el resto.
  if (credenciales) {
    const csrf = leerCookie('csrf');
    if (csrf) encabezadosFinales['X-CSRF-Token'] = csrf;
  }

  let respuesta;
  try {
    respuesta = await fetch(construirUrl(ruta, parametros), {
      method: metodo,
      headers: encabezadosFinales,
      body: cuerpo,
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
    if (repuesto) return fetchConReintento(metodo, ruta, { encabezados, cuerpo, autenticado, credenciales, reintentar: false, parametros });
  }
  return respuesta;
};

const peticion = async (metodo, ruta, { cuerpo, autenticado = false, credenciales = false, parametros } = {}) => {
  const respuesta = await fetchConReintento(metodo, ruta, {
    encabezados: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {},
    cuerpo: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    autenticado,
    credenciales,
    parametros,
  });
  if (!respuesta.ok) return cuerpoDeError(respuesta);
  return respuesta.status === 204 ? null : respuesta.json();
};

export const obtener = (ruta, parametros = {}) => peticion('GET', ruta, { parametros });
export const obtenerAutenticado = (ruta) => peticion('GET', ruta, { autenticado: true });
export const enviar = (metodo, ruta, cuerpo, opciones = {}) => peticion(metodo, ruta, { ...opciones, cuerpo });

// FormData (subir el CV): el navegador arma el Content-Type con el boundary solo — fijarlo a mano
// rompe el parseo multipart del servidor. Nunca pasa por JSON.stringify.
export const enviarFormData = async (ruta, formData) => {
  const respuesta = await fetchConReintento('POST', ruta, { cuerpo: formData, autenticado: true });
  if (!respuesta.ok) return cuerpoDeError(respuesta);
  return respuesta.json();
};

// Un <a href> no puede llevar Authorization: el archivo se pide con fetch, se arma un object URL
// del blob recibido y se dispara la descarga con un <a> temporal — el CV nunca se sirve por un
// enlace público (docs/03-seguridad.md). El nombre real viene de Content-Disposition si el
// servidor lo expone (app.js exposedHeaders); si no, se usa el sugerido.
export const descargarArchivo = async (id, nombreSugerido = 'archivo.pdf') => {
  const respuesta = await fetchConReintento('GET', `/archivos/${encodeURIComponent(id)}/descarga`, { autenticado: true });
  if (!respuesta.ok) return cuerpoDeError(respuesta);

  const disposicion = respuesta.headers.get('Content-Disposition') || '';
  const nombre = disposicion.match(/filename="([^"]+)"/)?.[1] || nombreSugerido;

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Revocar de inmediato puede cortar la descarga en algunos navegadores antes de que termine de
  // guardarla; un pequeño margen es la práctica estándar para este patrón.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
