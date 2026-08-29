import { obtenerAutenticado, enviar, enviarFormData } from './cliente.js';

export const obtenerPerfil = () => obtenerAutenticado('/estudiantes/perfil');
export const crearPerfil = (datos) => enviar('POST', '/estudiantes/perfil', datos, { autenticado: true });
export const actualizarPerfil = (datos) => enviar('PATCH', '/estudiantes/perfil', datos, { autenticado: true });

export const subirCv = (archivo) => {
  const formData = new FormData();
  formData.append('cv', archivo);
  return enviarFormData('/estudiantes/mi-cv', formData);
};
