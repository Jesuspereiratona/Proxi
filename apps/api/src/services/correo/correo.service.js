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

  return transportePromesa;
};

// En NODE_ENV=test no toca la red: ni SMTP real ni Ethereal. Las pruebas verifican que se generó
// el token correcto, no que un correo de verdad haya salido.
const enviarCorreo = async ({ para, asunto, texto }) => {
  if (env.nodeEnv === 'test') {
    logger.info({ correo: para, asunto }, 'Correo simulado (NODE_ENV=test)');
    return;
  }

  const transporte = await obtenerTransporte();
  const info = await transporte.sendMail({ from: env.mailFrom, to: para, subject: asunto, text: texto });

  if (!env.smtp.host) {
    logger.info({ correo: para, asunto, vistaPrevia: nodemailer.getTestMessageUrl(info) }, 'Correo de desarrollo (Ethereal)');
  }
};

module.exports = { enviarCorreo };
