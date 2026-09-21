import { obtenerAutenticado } from './cliente.js';

// Solo coordinación puede pedirlo: es una vista de gestión de la facultad, no información pública.
export const obtenerPanorama = () => obtenerAutenticado('/panorama');
