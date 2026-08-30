import { obtener, obtenerAutenticado, enviar } from './cliente.js';

export const obtenerPerfilPublico = (id) => obtener(`/empresas/${encodeURIComponent(id)}`);
export const obtenerIndicadores = (id) => obtener(`/empresas/${encodeURIComponent(id)}/indicadores`);

// Panel de empresa (Fase 6 parte 4): perfil propio, no el público de arriba.
export const obtenerPropio = () => obtenerAutenticado('/empresas/perfil');
export const crearPerfil = (datos) => enviar('POST', '/empresas/perfil', datos, { autenticado: true });
export const actualizarPerfil = (datos) => enviar('PATCH', '/empresas/perfil', datos, { autenticado: true });

// Panel de coordinación (Fase 6 parte 5): todas las empresas, en cualquier estado.
export const listarTodas = () => obtenerAutenticado('/empresas');
// Distinto de obtenerIndicadores(id) de arriba: ese es el público de una empresa, con umbral
// mínimo; este es el panorama completo sin filtro (indicadoresService.listarTodos).
export const listarTodosLosIndicadores = () => obtenerAutenticado('/empresas/indicadores');
export const validar = (id) => enviar('POST', `/empresas/${encodeURIComponent(id)}/validacion`, undefined, { autenticado: true });
export const rechazar = (id, motivoRechazo) => enviar('POST', `/empresas/${encodeURIComponent(id)}/rechazo`, { motivoRechazo }, { autenticado: true });
export const suspender = (id, motivoSuspension) => enviar('POST', `/empresas/${encodeURIComponent(id)}/suspension`, { motivoSuspension }, { autenticado: true });
