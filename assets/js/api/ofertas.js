import { obtener } from './cliente.js';

export const listarPublicas = (filtros = {}) => obtener('/ofertas', filtros);
// encodeURIComponent: id viene de la URL de la página (?id=), nunca directo a la ruta sin escapar
// (auditoría de Fase 6 — hoy inofensivo porque cliente.js no manda credenciales, pero es el hábito
// correcto antes de que una fase futura le agregue sesión a este mismo cliente).
export const obtenerDetalle = (id) => obtener(`/ofertas/${encodeURIComponent(id)}`);
