import { obtenerAutenticado, enviar } from './cliente.js';

export const listarMias = () => obtenerAutenticado('/postulaciones/mias');
export const obtenerDetalle = (id) => obtenerAutenticado(`/postulaciones/${encodeURIComponent(id)}`);
export const postular = (ofertaId, mensaje) => enviar('POST', '/postulaciones', { ofertaId, mensaje }, { autenticado: true });
export const retirar = (id, motivo) => enviar('POST', `/postulaciones/${encodeURIComponent(id)}/retiro`, motivo ? { motivo } : {}, { autenticado: true });

// Panel de empresa (Fase 6 parte 4): postulantes de una oferta propia y sus transiciones.
export const listarDeOferta = (ofertaId) => obtenerAutenticado(`/postulaciones/oferta/${encodeURIComponent(ofertaId)}`);
export const marcarEnRevision = (id) => enviar('POST', `/postulaciones/${encodeURIComponent(id)}/revision`, undefined, { autenticado: true });
export const marcarEntrevista = (id) => enviar('POST', `/postulaciones/${encodeURIComponent(id)}/entrevista`, undefined, { autenticado: true });
export const seleccionar = (id) => enviar('POST', `/postulaciones/${encodeURIComponent(id)}/seleccion`, undefined, { autenticado: true });
export const rechazar = (id, motivo) => enviar('POST', `/postulaciones/${encodeURIComponent(id)}/rechazo`, motivo ? { motivo } : {}, { autenticado: true });
