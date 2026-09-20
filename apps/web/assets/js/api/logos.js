import { API_URL } from '../config.js';
import { obtenerAutenticado, enviar, enviarFormData, obtenerBlobAutenticado } from './cliente.js';

// La URL pública del logo de una empresa se arma acá y no la manda el servidor: el backend devuelve
// un booleano `tieneLogo` porque un service no conoce rutas HTTP (docs/01-arquitectura.md).
export const urlLogo = (empresaId) => `${API_URL}/empresas/${encodeURIComponent(empresaId)}/logo`;

export const subirLogo = (archivo) => {
  const formData = new FormData();
  formData.append('logo', archivo);
  return enviarFormData('/empresas/mi-logo', formData);
};

export const obtenerMiLogo = () => obtenerAutenticado('/empresas/mi-logo');
export const quitarMiLogo = () => enviar('DELETE', '/empresas/mi-logo', undefined, { autenticado: true });

export const listarPendientes = () => obtenerAutenticado('/logos/pendientes');
export const aprobarLogo = (id) => enviar('POST', `/logos/${encodeURIComponent(id)}/aprobacion`, undefined, { autenticado: true });
export const retirarLogo = (id) => enviar('DELETE', `/logos/${encodeURIComponent(id)}`, undefined, { autenticado: true });

// La imagen de un logo pendiente exige sesión de coordinación. El panel debe revocar la URL que
// devuelve esto al descartar el elemento.
export const urlImagenParaRevision = (id) => obtenerBlobAutenticado(`/logos/${encodeURIComponent(id)}/imagen`);
