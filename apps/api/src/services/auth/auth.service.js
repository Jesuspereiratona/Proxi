const { sequelize, Usuario, Sesion, Consentimiento, TokenVerificacion, Estudiante } = require('../../models');
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

// Misma versión que apps/web/politica-privacidad.html (marca al pie de esa página) y que
// apps/web/assets/js/paginas/registro.js VERSION_POLITICA — sin un paquete compartido para un solo
// valor, se duplica con la fuente anotada, igual que LARGO_MINIMO_CLAVE del lado del cliente. El
// cliente ya no manda este valor (auditoría de seguridad): la fila de consentimientos es evidencia
// legal (Ley 21.719) y su versión la decide el servidor, no quien arma el POST.
const VERSION_POLITICA = '2026-08-30-borrador';

const registrar = async ({ email, clave, rol, aceptaPolitica }) => {
  if (!aceptaPolitica) {
    throw new ReglaDeNegocio(CONSENTIMIENTO_REQUERIDO, 'Debes aceptar la política de datos para registrarte.');
  }

  const existente = await Usuario.findOne({ where: { email } });
  if (existente) {
    throw new Conflicto(AUTH_CORREO_YA_REGISTRADO, 'Ese correo ya está registrado.');
  }

  const { usuario, plano } = await sequelize.transaction(async (t) => {
    const passwordHash = await passwords.hashear(clave);
    const nuevo = await Usuario.create({ email, passwordHash, rol, estado: 'pendiente_verificacion' }, { transaction: t });

    await Consentimiento.create(
      { usuarioId: nuevo.id, versionPolitica: VERSION_POLITICA, otorgadoAt: new Date() },
      { transaction: t },
    );

    const { plano: tokenPlano, hash } = tokens.generarTokenAleatorio();
    await TokenVerificacion.create(
      {
        usuarioId: nuevo.id,
        tokenHash: hash,
        tipo: 'verificacion_correo',
        expiraAt: new Date(Date.now() + TTL_VERIFICACION_MS),
      },
      { transaction: t },
    );

    return { usuario: nuevo, plano: tokenPlano };
  });

  // El correo se manda con la transacción YA confirmada. Adentro, una llamada de red a un servicio
  // externo mantenía abierta la transacción todo lo que tardara el SMTP — con un servidor lento
  // agota el pool de conexiones, y con uno caído ningún registro se podía completar.
  try {
    await correo.enviarCorreo({
      para: email,
      asunto: 'Confirma tu cuenta en Proxi',
      // .html: apps/web/scripts/servidor-dev.js sirve por path exacto, no agrega la extensión
      // (auditoría de seguridad — sin esto el enlace del correo daba 404 y no había forma de
      // verificar la cuenta salvo activarla a mano desde la base).
      texto: `Confirma tu correo entrando a ${env.webUrl}/verificar-correo.html?token=${plano}`,
    });
  } catch (error) {
    // Sin el correo la cuenta no sirve para nada — no hay reenvío de verificación — y encima deja
    // ocupado ese email, así que la persona no puede ni volver a registrarse. Se deshace para que
    // reintentar funcione. Es seguro: recién creada no tiene sesiones, perfil ni auditoría, y
    // consentimientos/tokens_verificacion caen en cascada.
    await usuario.destroy();
    throw error;
  }

  return { id: usuario.id, email: usuario.email, rol: usuario.rol, estado: usuario.estado };
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
    // Reabre el ciclo de aviso de retención (Fase 7): sin esto, a quien se le avisó una vez y volvió
    // a usar la plataforma se le podía eliminar la cuenta en un ciclo de inactividad posterior sin
    // recibir nunca un aviso vigente — el aviso viejo seguía "cumpliendo" el plazo de
    // RETENCION_AVISO_DIAS aunque fuera de hace un año (auditoría de Fase 7). No falla si el usuario
    // no es estudiante: el where no encuentra filas y el update simplemente no afecta ninguna.
    await Estudiante.update({ avisoRetencionEnviadoAt: null }, { where: { usuarioId: usuario.id }, transaction: t });
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
    // Sin esto, una sesión web (que se sostiene solo con refrescos, nunca vuelve a mandar la
    // contraseña) nunca actualizaba "última actividad" — la tarea de retención de Fase 7 podía
    // marcar como inactiva y eventualmente eliminar la cuenta de alguien que usa Proxi todas las
    // semanas (auditoría de Fase 7).
    await usuario.update({ ultimoAccesoAt: new Date() }, { transaction: t });
    return crearSesion(usuario, { ip, userAgent }, t);
  });
};

const logout = async ({ refreshToken }) => {
  if (!refreshToken) return;
  const hash = tokens.hashearToken(refreshToken);
  await Sesion.update({ revocadaAt: new Date() }, { where: { refreshTokenHash: hash, revocadaAt: null } });
};

// Rotura de vidrio ante un secreto comprometido (docs/09-procedimiento-de-brecha.md, hueco 2): a
// diferencia de logout/restablecerClave, que revocan por usuario, esto corta TODAS las sesiones de
// golpe. Solo mata el refresco — un accessToken ya emitido sigue siendo válido hasta sus 15 minutos
// de TTL (JWT sin estado, no hay lista de revocación); ese margen acotado es justamente el motivo de
// que el TTL sea corto. Se llama solo desde scripts/revocar-todas-las-sesiones.js, nunca por HTTP: un
// endpoint autenticado por JWT sería vulnerable exactamente al escenario que esto existe para atajar.
const revocarTodasLasSesiones = async (transaction) => {
  const [cantidad] = await Sesion.update({ revocadaAt: new Date() }, { where: { revocadaAt: null }, transaction });
  return cantidad;
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

module.exports = { registrar, verificarCorreo, login, refrescar, logout, revocarTodasLasSesiones, pedirRecuperacion, restablecerClave };
