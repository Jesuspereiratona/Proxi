import { enviar } from './cliente.js';

export const registrar = (datos) => enviar('POST', '/auth/registro', datos);
export const verificarCorreo = (token) => enviar('POST', '/auth/verificar-correo', { token });
