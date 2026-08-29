import { enviar, refrescarSesion, fijarToken, limpiarToken } from './cliente.js';

// Toda página protegida llama esto al cargar: repone el accessToken desde la cookie httpOnly
// (nunca desde almacenamiento legible por JS). false si no hay sesión vigente — la página decide
// qué hacer (normalmente redirigir a login.html).
export const iniciarSesion = () => refrescarSesion();

export const login = async (email, clave) => {
  const { accessToken, usuario } = await enviar('POST', '/auth/login', { email, clave }, { credenciales: true });
  fijarToken(accessToken);
  return usuario;
};

export const logout = async () => {
  await enviar('POST', '/auth/logout', undefined, { autenticado: true, credenciales: true }).catch(() => {});
  limpiarToken();
};
