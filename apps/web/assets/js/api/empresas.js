import { obtener } from './cliente.js';

export const obtenerPerfilPublico = (id) => obtener(`/empresas/${encodeURIComponent(id)}`);
export const obtenerIndicadores = (id) => obtener(`/empresas/${encodeURIComponent(id)}/indicadores`);
