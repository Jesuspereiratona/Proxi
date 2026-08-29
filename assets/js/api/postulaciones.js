import { obtenerAutenticado, enviar } from './cliente.js';

export const listarMias = () => obtenerAutenticado('/postulaciones/mias');
export const obtenerDetalle = (id) => obtenerAutenticado(`/postulaciones/${encodeURIComponent(id)}`);
export const postular = (ofertaId, mensaje) => enviar('POST', '/postulaciones', { ofertaId, mensaje }, { autenticado: true });
export const retirar = (id, motivo) => enviar('POST', `/postulaciones/${encodeURIComponent(id)}/retiro`, motivo ? { motivo } : {}, { autenticado: true });
