import { API_URL } from '../config.js';

// Traduce el {error:{codigo,mensaje}} de docs/04-manejo-de-errores.md a algo que una persona
// entienda: OFERTA_NO_VIGENTE es un código interno, nunca algo que se muestra tal cual.
const MENSAJES = {
  OFERTA_NO_ENCONTRADA: 'Esta oferta ya no está disponible.',
  OFERTA_NO_VIGENTE: 'Esta oferta ya no está disponible.',
  PERFIL_NO_ENCONTRADO: 'Esa empresa no existe.',
  VALIDACION_ENTRADA: 'Revisa los filtros e intenta de nuevo.',
  DEMASIADAS_SOLICITUDES: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
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

// Único lugar que llama fetch (docs/01-arquitectura.md: "nadie llama fetch fuera de aquí").
export const obtener = async (ruta, parametros = {}) => {
  const url = new URL(`${API_URL}${ruta}`);
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, valor);
  }

  let respuesta;
  try {
    respuesta = await fetch(url);
  } catch {
    throw new ErrorApi('ERROR_RED', MENSAJE_GENERICO);
  }

  if (!respuesta.ok) {
    let codigo = 'ERROR_INTERNO';
    try {
      const cuerpo = await respuesta.json();
      codigo = cuerpo?.error?.codigo || codigo;
    } catch {
      // sin cuerpo JSON legible: se queda con ERROR_INTERNO
    }
    throw new ErrorApi(codigo, mensajeParaCodigo(codigo));
  }

  return respuesta.json();
};
