const { sequelize, Usuario, Sesion, Consentimiento, TokenVerificacion } = require('../../models');
const { NoAutenticado, NoAutorizado, Conflicto, ErrorValidacion, ReglaDeNegocio } = require('../../errors');
const {
  AUTH_CORREO_YA_REGISTRADO,
  AUTH_CREDENCIALES_INVALIDAS,
  AUTH_TOKEN_EXPIRADO,
  AUTH_TOKEN_INVALIDO,
  AUTH_CUENTA_BLOQUEADA,
  AUTH_EMAIL_NO_VERIFICADO,
  CONSENTIMIENTO_REQUERIDO,
} = require('@proxi/errores');
const passwords = require('./passwords');
const tokens = require('./tokens');
const intentosLogin = require('./intentosLogin');
const correo = require('../correo/correo.service');
const env = require('../../config/env');
const { aMilisegundos } = require('../../utils/duracion');

// Hash fijo para comparar cuando el correo no existe: mantiene el tiempo de respuesta parecido al
// de un login real y evita que alguien mida la latencia para adivinar qué correos están registrados.
const HASH_DUMMY = '$2a$12$d0WPe/wryfw7e9mPOtx5MOSmpdoGEliUMYK1FeDjee8omvH8kBg6e';

const TTL_VERIFICACION_MS = aMilisegundos('24h'); // no configurable: no lo pidió nadie
const TTL_RESTABLECER_MS = 60 * 60 * 1000; // 1h, fija por docs/03-seguridad.md

const registrar = async ({ email, clave, rol, aceptaPolitica, versionPolitica }) => {
  if (!aceptaPolitica) {
    throw new ReglaDeNegocio(CONSENTIMIENTO_REQUERIDO, 'Debes aceptar la política de datos para registrarte.');
  }

  const existente = await Usuario.findOne({ where: { email } });
  if (existente) {
    throw new Conflicto(AUTH_CORREO_YA_REGISTRADO, 'Ese correo ya está registrado.');
  }

  return sequelize.transaction(async (t) => {
    const passwordHash = await passwords.hashear(clave);
    const usuario = await Usuario.create({ email, passwordHash, rol, estado: 'pendiente_verificacion' }, { transaction: t });

    await Consentimiento.create(
      { usuarioId: usuario.id, versionPolitica, otorgadoAt: new Date() },
      { transaction: t },
    );

    const { plano, hash } = tokens.generarTokenAleatorio();
    await TokenVerificacion.create(
      {
        usuarioId: usuario.id,
        tokenHash: hash,
        tipo: 'verificacion_correo',
        expiraAt: new Date(Date.now() + TTL_VERIFICACION_MS),
      },
      { transaction: t },
    );

    await correo.enviarCorreo({
      para: email,
      asunto: 'Confirma tu cuenta en Proxi',
      texto: `Confirma tu correo entrando a ${env.webUrl}/verificar-correo?token=${plano}`,
    });

    return { id: usuario.id, email: usuario.email, rol: usuario.rol, estado: usuario.estado };
  });
};

const verificarCorreo = async ({ token }) => {
  const hash = tokens.hashearToken(token);
  const fila = await TokenVerificacion.findOne({ where: { tokenHash: hash, tipo: 'verificacion_correo', usadoAt: null } });
  if (!fila) throw new ErrorValidacion(AUTH_TOKEN_INVALIDO, 'El enlace de verificación no es válido.');
  if (fila.expiraAt.getTime() < Date.now()) {
    throw new ErrorValidacion(AUTH_TOKEN_EXPIRADO, 'El enlace de verificación venció.');
  }

  await sequelize.transaction(async (t) => {
    await fila.update({ usadoAt: new Date() }, { transaction: t });
    await Usuario.update(
      { estado: 'activo', emailVerificadoAt: new Date() },
      { where: { id: fila.usuarioId }, transaction: t },
    );
  });
};

const crearSesion = async (usuario, { ip, userAgent }, transaction) => {
  const { plano, hash } = tokens.generarTokenAleatorio();
  await Sesion.create(
    {
      usuarioId: usuario.id,
      refreshTokenHash: hash,
      expiraAt: new Date(Date.now() + aMilisegundos(env.jwt.refreshTtl)),
      ip,
      userAgent,
    },
    { transaction },
  );
  const accessToken = tokens.firmarAcceso({ sub: usuario.id, rol: usuario.rol });
  return { accessToken, refreshToken: plano, usuario: { id: usuario.id, rol: usuario.rol } };
};

const login = async ({ email, clave, ip, userAgent }) => {
  const usuario = await Usuario.findOne({ where: { email } });

  if (!usuario) {
    await passwords.comparar(clave, HASH_DUMMY);
    throw new NoAutenticado(AUTH_CREDENCIALES_INVALIDAS, 'Correo o contraseña incorrectos.');
  }

  if (intentosLogin.estaBloqueado(usuario)) {
    throw new NoAutorizado(AUTH_CUENTA_BLOQUEADA, 'Demasiados intentos fallidos. Intenta de nuevo más tarde.');
  }

  const claveValida = await passwords.comparar(clave, usuario.passwordHash);
  if (!claveValida) {
    await usuario.update(intentosLogin.calcularTrasFallo(usuario));
    throw new NoAutenticado(AUTH_CREDENCIALES_INVALIDAS, 'Correo o contraseña incorrectos.');
  }

  if (usuario.estado === 'pendiente_verificacion') {
    throw new NoAutorizado(AUTH_EMAIL_NO_VERIFICADO, 'Verifica tu correo antes de iniciar sesión.');
  }

  return sequelize.transaction(async (t) => {
    await usuario.update({ ...intentosLogin.trasExito(), ultimoAccesoAt: new Date() }, { transaction: t });
    return crearSesion(usuario, { ip, userAgent }, t);
  });
};

const refrescar = async ({ refreshToken, ip, userAgent }) => {
  if (!refreshToken) throw new NoAutenticado(AUTH_TOKEN_INVALIDO, 'Falta el token de refresco.');

  const hash = tokens.hashearToken(refreshToken);
  const sesion = await Sesion.findOne({ where: { refreshTokenHash: hash } });
  if (!sesion) throw new NoAutenticado(AUTH_TOKEN_INVALIDO, 'Sesión inválida.');

  if (sesion.revocadaAt) {
    // Un refresco ya usado que reaparece es la señal de que alguien más lo tiene.
    await Sesion.update(
      { revocadaAt: new Date() },
      { where: { usuarioId: sesion.usuarioId, revocadaAt: null } },
    );
    throw new NoAutenticado(AUTH_TOKEN_INVALIDO, 'Sesión inválida.');
  }

  if (sesion.expiraAt.getTime() < Date.now()) {
    throw new NoAutenticado(AUTH_TOKEN_EXPIRADO, 'La sesión expiró, vuelve a iniciar sesión.');
  }

  const usuario = await Usuario.findByPk(sesion.usuarioId);
  if (!usuario) throw new NoAutenticado(AUTH_TOKEN_INVALIDO, 'Sesión inválida.');

  return sequelize.transaction(async (t) => {
    await sesion.update({ revocadaAt: new Date() }, { transaction: t });
    return crearSesion(usuario, { ip, userAgent }, t);
  });
};

const logout = async ({ refreshToken }) => {
  if (!refreshToken) return;
  const hash = tokens.hashearToken(refreshToken);
  await Sesion.update({ revocadaAt: new Date() }, { where: { refreshTokenHash: hash, revocadaAt: null } });
};

const pedirRecuperacion = async ({ email }) => {
  const usuario = await Usuario.findOne({ where: { email } });
  if (!usuario) return; // misma respuesta exista o no la cuenta: la decide el controller

  const { plano, hash } = tokens.generarTokenAleatorio();
  await TokenVerificacion.create({
    usuarioId: usuario.id,
    tokenHash: hash,
    tipo: 'restablecer_clave',
    expiraAt: new Date(Date.now() + TTL_RESTABLECER_MS),
  });

  await correo.enviarCorreo({
    para: email,
    asunto: 'Restablece tu contraseña en Proxi',
    texto: `Restablece tu contraseña entrando a ${env.webUrl}/restablecer-clave?token=${plano}`,
  });
};

const restablecerClave = async ({ token, claveNueva }) => {
  const hash = tokens.hashearToken(token);
  const fila = await TokenVerificacion.findOne({ where: { tokenHash: hash, tipo: 'restablecer_clave', usadoAt: null } });
  if (!fila) throw new ErrorValidacion(AUTH_TOKEN_INVALIDO, 'El enlace de restablecimiento no es válido.');
  if (fila.expiraAt.getTime() < Date.now()) {
    throw new ErrorValidacion(AUTH_TOKEN_EXPIRADO, 'El enlace de restablecimiento venció.');
  }

  const passwordHash = await passwords.hashear(claveNueva);

  await sequelize.transaction(async (t) => {
    await fila.update({ usadoAt: new Date() }, { transaction: t });
    // Probar la clave por correo también limpia el contador de intentos fallidos: quien la resetea
    // demostró ser el dueño de la cuenta, no tiene sentido dejarlo a un paso del bloqueo temporal.
    await Usuario.update(
      { passwordHash, ...intentosLogin.trasExito() },
      { where: { id: fila.usuarioId }, transaction: t },
    );
    // Cambiar la clave cierra el resto de las sesiones: si la cuenta estaba comprometida, esto la recupera.
    await Sesion.update(
      { revocadaAt: new Date() },
      { where: { usuarioId: fila.usuarioId, revocadaAt: null }, transaction: t },
    );
  });
};

module.exports = { registrar, verificarCorreo, login, refrescar, logout, pedirRecuperacion, restablecerClave };
