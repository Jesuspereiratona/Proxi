import { obtener, obtenerAutenticado, enviar } from './cliente.js';

export const listarPublicas = (filtros = {}) => obtener('/ofertas', filtros);
// encodeURIComponent: id viene de la URL de la página (?id=), nunca directo a la ruta sin escapar
// (auditoría de Fase 6 — hoy inofensivo porque cliente.js no manda credenciales, pero es el hábito
// correcto antes de que una fase futura le agregue sesión a este mismo cliente).
export const obtenerDetalle = (id) => obtener(`/ofertas/${encodeURIComponent(id)}`);

// Panel de empresa (Fase 6 parte 4): las propias, en cualquier estado.
export const listarMias = () => obtenerAutenticado('/ofertas/mias');
// Mismo GET /ofertas/:id de arriba, pero autenticado: obtenerDetalle() (anónimo) solo ve una oferta
// publicada; su dueña necesita ver también su propio borrador o una en revisión (postulantes.html
// muestra el título de la oferta aunque ya no esté publicada).
export const obtenerDetallePropio = (id) => obtenerAutenticado(`/ofertas/${encodeURIComponent(id)}`);
export const crear = (datos) => enviar('POST', '/ofertas', datos, { autenticado: true });
export const editar = (id, datos) => enviar('PATCH', `/ofertas/${encodeURIComponent(id)}`, datos, { autenticado: true });
export const enviarARevision = (id) => enviar('POST', `/ofertas/${encodeURIComponent(id)}/revision`, undefined, { autenticado: true });
export const cerrar = (id, motivoCierre) => enviar('POST', `/ofertas/${encodeURIComponent(id)}/cierre`, { motivoCierre }, { autenticado: true });

// Panel de coordinación (Fase 6 parte 5): moderar ofertas en cola de revisión.
export const listarPendientesRevision = () => obtenerAutenticado('/ofertas/pendientes-revision');
export const aprobar = (id) => enviar('POST', `/ofertas/${encodeURIComponent(id)}/aprobacion`, undefined, { autenticado: true });
export const rechazarOferta = (id, motivo) => enviar('POST', `/ofertas/${encodeURIComponent(id)}/rechazo`, { motivo }, { autenticado: true });
