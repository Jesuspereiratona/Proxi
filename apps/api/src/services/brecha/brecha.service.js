const { Op } = require('sequelize');
const { sequelize, Usuario, NotificacionBrecha } = require('../../models');
const correo = require('../correo/correo.service');
const logger = require('../../config/logger');

// Notificación a las personas afectadas por una brecha (specs/13-notificacion-de-brecha/spec.md).
//
// `docs/09-procedimiento-de-brecha.md` tiene la carta escrita desde hace semanas y no se podía
// ejecutar: correo.service.js solo sabe mandar UN correo a UNA persona. El día que haya que avisarle
// a 300 estudiantes en menos de 72 horas, nadie debería estar escribiendo un script bajo presión.

// Tope por corrida. 200 y no 300: el plan gratuito de Brevo permite 300 diarios y los correos
// transaccionales normales de Proxi también consumen de esa cuota. Dejar margen evita que el
// proveedor corte la notificación a mitad, que es peor que tardar un día más.
const TOPE_POR_CORRIDA = 200;

const ASUNTO = 'Aviso importante sobre tus datos en Proxi';

// El texto vive acá y no se arma al vuelo: es el de docs/09-procedimiento-de-brecha.md, escrito en
// frío. Redactarlo durante el incidente es cómo salen los avisos que dicen poco y asustan mucho.
const cuerpo = ({ queOcurrio, queDatos, queHacer, contacto }) => `Hola:

Te escribimos porque ocurrió un incidente de seguridad que afecta datos tuyos en Proxi, la
plataforma de prácticas de la FEN.

Qué pasó: ${queOcurrio}

Qué datos tuyos están involucrados: ${queDatos}

Qué estamos haciendo: ya contuvimos el incidente y estamos revisando cómo ocurrió para que no se
repita. También notificamos a la Agencia de Protección de Datos Personales, como exige la ley.

Qué te recomendamos hacer: ${queHacer}

Si tienes dudas o quieres saber exactamente qué información tuya se vio afectada, escríbenos a
${contacto} y te respondemos.

Lamentamos que esto haya ocurrido.

Equipo Proxi — FEN, Universidad Alberto Hurtado`;

// Propone quiénes quedaron afectados por lo que hizo una cuenta en una ventana de tiempo. PROPONE:
// la decisión de notificar no se toma en solitario (docs/09, paso 3), así que esto alimenta una
// conversación, no dispara correos.
//
// Solo resuelve las dos acciones que apuntan a una persona concreta: descargar_cv (el dueño del
// archivo) y ver_rut (el estudiante). `ver_postulantes` apunta a una oferta y sus afectados salen
// de la lista de postulantes de esa oferta — deliberadamente fuera: son decisiones caso a caso que
// tiene que mirar una persona, no una consulta.
const afectadosPorActor = async (actorUsuarioId, desde, hasta) => {
  const [filas] = await sequelize.query(
    `SELECT DISTINCT afectado.id AS "usuarioId", a.accion
       FROM auditoria_accesos a
       LEFT JOIN archivos ar ON a.accion = 'descargar_cv' AND ar.id = a.entidad_id
       LEFT JOIN estudiantes e ON a.accion = 'ver_rut' AND e.id = a.entidad_id
       JOIN usuarios afectado
         ON afectado.id = COALESCE(ar.propietario_usuario_id, e.usuario_id)
      WHERE a.usuario_id = $1::bigint
        AND a.accion IN ('descargar_cv', 'ver_rut')
        AND a.created_at >= $2::timestamptz
        AND a.created_at <= $3::timestamptz
        AND afectado.id <> $1::bigint`,
    { bind: [actorUsuarioId, desde, hasta] },
  );
  return filas.map((f) => ({ usuarioId: String(f.usuarioId), accion: f.accion }));
};

// Manda el aviso a cada persona y registra que se mandó. Reanudable: quien ya tiene fila para este
// incidente se salta. No aborta si uno falla — con el reloj de 72 horas corriendo, que un correo
// rebote no puede dejar sin avisar a los otros 299.
const notificar = async (incidente, usuarioIds, textos, { tope = TOPE_POR_CORRIDA } = {}) => {
  const yaNotificados = await NotificacionBrecha.findAll({
    where: { incidente, usuarioId: usuarioIds },
    attributes: ['usuarioId'],
  });
  const hechos = new Set(yaNotificados.map((n) => String(n.usuarioId)));
  const pendientes = usuarioIds.map(String).filter((id) => !hechos.has(id));
  const deEstaCorrida = pendientes.slice(0, tope);

  // anonimizadoAt no nulo = cuenta suprimida: su email es un marcador @proxi.invalid y escribirle
  // sería mandar un correo al vacío y registrar que se le avisó, que es peor que no avisar.
  const destinatarios = await Usuario.findAll({
    where: { id: deEstaCorrida, anonimizadoAt: { [Op.is]: null } },
    attributes: ['id', 'email'],
  });

  let enviados = 0;
  let fallidos = 0;
  const mensaje = cuerpo(textos);

  for (const usuario of destinatarios) {
    try {
      await correo.enviarCorreo({ para: usuario.email, asunto: ASUNTO, texto: mensaje });
      await NotificacionBrecha.create({ incidente, usuarioId: usuario.id, enviadoAt: new Date() });
      enviados += 1;
    } catch (error) {
      // La fila se escribe IGUAL, con el error: así el reintento sabe que ya se intentó y por qué,
      // en vez de volver a chocar contra el mismo rebote. Nunca el correo en el log (CLAUDE.md):
      // se cuentan personas, no se nombran.
      await NotificacionBrecha.create({ incidente, usuarioId: usuario.id, error: String(error.message).slice(0, 500) });
      fallidos += 1;
    }
  }

  const suprimidos = deEstaCorrida.length - destinatarios.length;
  logger.info(
    { incidente, enviados, fallidos, suprimidos, pendientes: pendientes.length - deEstaCorrida.length },
    'notificarBrecha: corrida terminada',
  );

  return {
    enviados,
    fallidos,
    suprimidos,
    yaNotificados: hechos.size,
    pendientes: pendientes.length - deEstaCorrida.length,
  };
};

module.exports = { afectadosPorActor, notificar, TOPE_POR_CORRIDA, ASUNTO };
