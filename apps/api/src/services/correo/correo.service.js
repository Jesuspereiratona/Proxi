const nodemailer = require('nodemailer');
const env = require('../../config/env');
const logger = require('../../config/logger');

let transportePromesa = null;

const obtenerTransporte = () => {
  if (transportePromesa) return transportePromesa;

  transportePromesa = env.smtp.host
    ? Promise.resolve(
        nodemailer.createTransport({
          host: env.smtp.host,
          port: env.smtp.port,
          auth: env.smtp.usuario ? { user: env.smtp.usuario, pass: env.smtp.password } : undefined,
        }),
      )
    : nodemailer.createTestAccount().then((cuenta) =>
        nodemailer.createTransport({
          host: cuenta.smtp.host,
          port: cuenta.smtp.port,
          secure: cuenta.smtp.secure,
          auth: { user: cuenta.user, pass: cuenta.pass },
        }),
      );

  // Sin esto, un tropiezo de red al crear el transporte deja cacheada una promesa YA RECHAZADA: toda
  // llamada posterior recibe el mismo rechazo y el envío de correo queda roto hasta reiniciar el
  // proceso, aunque la red se haya recuperado. Se olvida el intento fallido para que el siguiente
  // vuelva a probar.
  transportePromesa.catch(() => { transportePromesa = null; });

  return transportePromesa;
};

// En NODE_ENV=test no toca la red: ni SMTP real ni Ethereal. Las pruebas verifican que se generó
// el token correcto, no que un correo de verdad haya salido.
const enviarCorreo = async ({ para, asunto, texto }) => {
  // Nunca el correo del destinatario en el log (CLAUDE.md, regla dura): el asunto y la vista previa
  // ya bastan para depurar sin escribir un dato personal en un archivo que dura más que la sesión.
  if (env.nodeEnv === 'test') {
    logger.info({ asunto }, 'Correo simulado (NODE_ENV=test)');
    return;
  }

  const transporte = await obtenerTransporte();
  let info;
  try {
    info = await transporte.sendMail({ from: env.mailFrom, to: para, subject: asunto, text: texto });
  } catch (error) {
    // El mensaje de un error SMTP suele traer la dirección del destinatario ("550 no such user
    // <alguien@...>"), y ese error termina en el log con su stack vía manejadorErrores. Se registra
    // solo el código, que basta para depurar, y se relanza un error sin datos personales dentro.
    logger.error({ asunto, codigo: error.code, respuestaSmtp: error.responseCode }, 'Falló el envío de correo');
    throw new Error('No se pudo enviar el correo.');
  }

  if (!env.smtp.host) {
    logger.info({ asunto, vistaPrevia: nodemailer.getTestMessageUrl(info) }, 'Correo de desarrollo (Ethereal)');
  }
};

module.exports = { enviarCorreo };
