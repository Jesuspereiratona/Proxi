const crypto = require('crypto');
const asyncHandler = require('../utils/async-handler');
const authService = require('../services/auth/auth.service');
const env = require('../config/env');
const { aMilisegundos } = require('../utils/duracion');

const NOMBRE_COOKIE = 'refresco';
const NOMBRE_COOKIE_CSRF = 'csrf';
const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: env.esProduccion,
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: aMilisegundos(env.jwt.refreshTtl),
};
// No httpOnly, a propósito: el cliente tiene que poder leerla para devolverla en el encabezado
// X-CSRF-Token (verificar-csrf.middleware.js) — no protege un secreto, prueba que quien pide
// refrescar/logout puede leer una cookie del mismo origen, algo que un sitio ajeno no puede.
const OPCIONES_COOKIE_CSRF = { ...OPCIONES_COOKIE, httpOnly: false };

// login y refrescar emiten el mismo par de cookies cada vez que rotan la sesión — un solo lugar
// para no repetir las dos llamadas ni arriesgar que una futura cambie una y no la otra.
const fijarCookiesSesion = (res, refreshToken) => {
  res.cookie(NOMBRE_COOKIE, refreshToken, OPCIONES_COOKIE);
  res.cookie(NOMBRE_COOKIE_CSRF, crypto.randomBytes(32).toString('hex'), OPCIONES_COOKIE_CSRF);
};

const registro = asyncHandler(async (req, res) => {
  const usuario = await authService.registrar(req.body);
  res.status(201).json(usuario);
});

const verificarCorreo = asyncHandler(async (req, res) => {
  await authService.verificarCorreo(req.body);
  res.status(204).end();
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, usuario } = await authService.login({
    ...req.body,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  fijarCookiesSesion(res, refreshToken);
  res.json({ accessToken, usuario });
});

const refrescar = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await authService.refrescar({
    refreshToken: req.cookies?.[NOMBRE_COOKIE],
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  fijarCookiesSesion(res, refreshToken);
  res.json({ accessToken });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout({ refreshToken: req.cookies?.[NOMBRE_COOKIE] });
  res.clearCookie(NOMBRE_COOKIE, { path: OPCIONES_COOKIE.path });
  res.clearCookie(NOMBRE_COOKIE_CSRF, { path: OPCIONES_COOKIE.path });
  res.status(204).end();
});

const recuperarClave = asyncHandler(async (req, res) => {
  await authService.pedirRecuperacion(req.body);
  res.json({ mensaje: 'Si el correo existe, se envió un enlace de recuperación.' });
});

const restablecerClave = asyncHandler(async (req, res) => {
  await authService.restablecerClave(req.body);
  res.status(204).end();
});

module.exports = { registro, verificarCorreo, login, refrescar, logout, recuperarClave, restablecerClave };
