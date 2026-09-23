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
          // Sin esto, nodemailer espera por defecto hasta 10 minutos al socket. El envío ocurre
          // DENTRO de la petición de registro, así que un SMTP lento dejaba a la persona mirando un
          // botón congelado sin ningún mensaje (visto al estrenar el correo en producción). Con
          // tiempos acotados, un proveedor que no responde falla rápido, la compensación borra la
          // cuenta a medias y quien se registra ve un error en vez de esperar sin saber.
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 20_000,
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

// Cierre común de los tres correos que manda Proxi. Existe por una razón concreta y no por
// prolijidad: Brevo reescribe el remitente a un dominio suyo con números (`@1223....brevosend.com`)
// porque el nuestro no está autenticado, así que quien recibe ve una dirección desconocida
// pidiéndole que haga clic en un enlace — la forma exacta de un phishing. El cuerpo tiene que decir
// de quién viene y dar una dirección real a la que escribir. Se va el día que haya dominio propio.
const FIRMA = `
—
Proxi · Portal de prácticas
Facultad de Economía y Negocios · Universidad Alberto Hurtado
¿Dudas? Escríbenos a uahmarketcl@gmail.com`;

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

module.exports = { enviarCorreo, FIRMA };
