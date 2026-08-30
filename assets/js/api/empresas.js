import { obtener, obtenerAutenticado, enviar } from './cliente.js';

export const obtenerPerfilPublico = (id) => obtener(`/empresas/${encodeURIComponent(id)}`);
export const obtenerIndicadores = (id) => obtener(`/empresas/${encodeURIComponent(id)}/indicadores`);

// Panel de empresa (Fase 6 parte 4): perfil propio, no el público de arriba.
export const obtenerPropio = () => obtenerAutenticado('/empresas/perfil');
export const crearPerfil = (datos) => enviar('POST', '/empresas/perfil', datos, { autenticado: true });
export const actualizarPerfil = (datos) => enviar('PATCH', '/empresas/perfil', datos, { autenticado: true });
