const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  Usuario,
  Estudiante,
  Archivo,
  Postulacion,
  Oferta,
  Empresa,
  PostulacionEvento,
  Sesion,
  Consentimiento,
  AuditoriaAcceso,
} = require('../../models');
const estudiantesRepo = require('../../repositories/estudiantes.repository');
const passwords = require('../auth/passwords');
const correoService = require('../correo/correo.service');
const logger = require('../../config/logger');
const env = require('../../config/env');
const { NoEncontrado, NoAutenticado } = require('../../errors');
const { PERFIL_NO_ENCONTRADO, AUTH_CREDENCIALES_INVALIDAS } = require('@proxi/errores');

const NOMBRE_ANONIMO = 'Estudiante eliminado';
const APELLIDOS_ANONIMOS = '(eliminado)';
const CARRERA_ANONIMA = '(eliminado)';
const NOMBRE_CV_ANONIMO = 'cv-eliminado.pdf';
// Sobre esta cifra, procesarRetencion aborta la pasada de eliminación y solo deja constancia en el
// log en vez de proceder: una tabla mal filtrada por un RETENCION_CV_MESES mal puesto (o negativo)
// no debe poder anonimizar la base entera de estudiantes en una sola corrida sin que nadie lo note
// (auditoría de Fase 7).
const LIMITE_ELIMINACIONES_POR_CORRIDA = 50;

// Portabilidad (Ley 21.719, docs/03-seguridad.md): todo lo propio en un solo JSON. El RUT va
// descifrado a propósito — es su propio dato, distinto del endpoint de coordinación (Fase 2) que
// audita el acceso porque ahí es un tercero mirando el RUT de otra persona. Igual queda su propio
// rastro en auditoria_accesos: un token robado que exporte todo de una sola vez debe dejar huella,
// igual que descargar un CV (auditoría de Fase 7).
const obtenerDatos = async (usuarioId, ip, userAgent) => {
  const usuario = await Usuario.findByPk(usuarioId);
  if (!usuario) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Esa cuenta no existe.');

  const estudiante = await Estudiante.findOne({ where: { usuarioId } });
  let perfil = null;
  let cv = null;
  let postulaciones = [];

  if (estudiante) {
    const rut = await estudiantesRepo.obtenerRutDescifradoPorId(estudiante.id);
    perfil = {
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      rut,
      carrera: estudiante.carrera,
      nivel: estudiante.nivel,
      telefono: estudiante.telefono,
    };

    if (estudiante.cvArchivoId) {
      const archivo = await Archivo.findByPk(estudiante.cvArchivoId);
      if (archivo) cv = { nombreOriginal: archivo.nombreOriginal, tamanoBytes: archivo.tamanoBytes, subidoAt: archivo.createdAt };
    }

    // Mismo attributes sin motivo/actorUsuarioId que postulaciones.service.js conEventos(): pedir
    // los propios datos no cambia la regla de Fase 6 parte 3 — motivo sigue siendo la nota de la
    // empresa, no algo que la portabilidad del estudiante deba destapar.
    const filas = await Postulacion.findAll({
      where: { estudianteId: estudiante.id },
      include: [
        { model: Oferta, as: 'Oferta', attributes: ['titulo'], include: [{ model: Empresa, attributes: ['razonSocial'] }] },
        { model: PostulacionEvento, attributes: ['estadoNuevo', 'createdAt'] },
      ],
      order: [['createdAt', 'ASC']],
    });
    postulaciones = filas.map((p) => ({
      oferta: p.Oferta?.titulo ?? null,
      empresa: p.Oferta?.Empresa?.razonSocial ?? null,
      estado: p.estado,
      mensaje: p.mensaje,
      creadaAt: p.createdAt,
      eventos: p.PostulacionEventos.map((e) => ({ estado: e.estadoNuevo, fecha: e.createdAt })),
    }));
  }

  const consentimientos = await Consentimiento.findAll({
    where: { usuarioId },
    attributes: ['versionPolitica', 'otorgadoAt', 'revocadoAt'],
    order: [['otorgadoAt', 'ASC']],
  });

  await AuditoriaAcceso.create({ usuarioId, accion: 'exportar_datos', entidad: 'usuario', entidadId: usuarioId, ip, userAgent });

  return {
    cuenta: {
      email: usuario.email,
      rol: usuario.rol,
      emailVerificadoAt: usuario.emailVerificadoAt,
      ultimoAccesoAt: usuario.ultimoAccesoAt,
      creadaAt: usuario.createdAt,
    },
    perfil,
    cv,
    postulaciones,
    consentimientos,
  };
};

// DELETE /mi-cuenta es irreversible: exige confirmar la contraseña actual antes de llamar a
// eliminarCuenta, para que un token de acceso robado (15 minutos de vida) no alcance por sí solo
// para destruir la cuenta (auditoría de Fase 7). La tarea de retención no pasa por acá — no hay
// nadie que teclee una contraseña en un cron, y no le hace falta: ya exige el aviso previo vencido.
const confirmarClave = async (usuarioId, clave) => {
  const usuario = await Usuario.findByPk(usuarioId);
  if (!usuario) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Esa cuenta no existe.');
  const valida = await passwords.comparar(clave, usuario.passwordHash);
  if (!valida) throw new NoAutenticado(AUTH_CREDENCIALES_INVALIDAS, 'Contraseña incorrecta.');
};

// Única función que anonimiza — la llaman tanto DELETE /mi-cuenta como la tarea de retención, para
// que "qué significa borrar una cuenta" viva en un solo lugar (docs/03-seguridad.md: supresión).
//
// Todo lo transaccional va primero; fs.unlink (irreversible, no participa de un rollback) va al
// final, después del commit — si algo dentro de la transacción falla, el archivo real todavía no se
// tocó. El orden anterior (borrar del disco y recién después abrir la transacción) dejaba un CV
// destruido con la cuenta intacta ante cualquier fallo a mitad de camino (auditoría de Fase 7).
const eliminarCuenta = async (usuarioId, ip, userAgent) => {
  const usuario = await Usuario.findByPk(usuarioId);
  if (!usuario) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Esa cuenta no existe.');
  // Idempotente: una cuenta ya suprimida no vuelve a pasar por bcrypt ni a generar un marcador
  // nuevo cada vez que alguien repita la petición (auditoría de Fase 7).
  if (usuario.anonimizadoAt) return;

  const estudiante = await Estudiante.findOne({ where: { usuarioId } });
  const archivos = estudiante ? await Archivo.findAll({ where: { propietarioUsuarioId: usuarioId, tipo: 'cv' } }) : [];

  await sequelize.transaction(async (t) => {
    if (estudiante) {
      await estudiante.update(
        { nombres: NOMBRE_ANONIMO, apellidos: APELLIDOS_ANONIMOS, carrera: CARRERA_ANONIMA, nivel: null, telefono: null, rutUltimos4: null },
        { transaction: t },
      );
      // rut_cifrado no tiene columna en el modelo (repositories/estudiantes.repository.js es el
      // único lugar que la toca) — anularla necesita el mismo camino de SQL crudo.
      await sequelize.query('UPDATE estudiantes SET rut_cifrado = NULL WHERE usuario_id = $1::bigint', {
        bind: [usuarioId],
        transaction: t,
      });

      if (archivos.length > 0) {
        // expiraAt marca el archivo como suprimido para archivos.service.js descargar(): un
        // respaldo restaurado dentro de la ventana de retención repone los bytes en disco con el
        // mismo nombre, y sin esta marca volvería a servirse (auditoría de Fase 7).
        await Archivo.update(
          { nombreOriginal: NOMBRE_CV_ANONIMO, expiraAt: new Date() },
          { where: { id: archivos.map((a) => a.id) }, transaction: t },
        );
      }

      // "Anonimiza postulaciones" (docs/03-seguridad.md) no es solo anonimizar a quien postuló: el
      // mensaje que el estudiante escribió y el motivo de su propio retiro son texto libre que puede
      // traer nombre, RUT, teléfono — quedaban intactos y visibles para la empresa aunque el perfil
      // ya no tuviera identidad (auditoría de Fase 7). El resto de la línea de tiempo (estados,
      // fechas) sí se conserva: es "el evento estadístico sin identidad" que pide la spec.
      await Postulacion.update({ mensaje: null }, { where: { estudianteId: estudiante.id }, transaction: t });
      await PostulacionEvento.update({ motivo: null }, { where: { actorUsuarioId: usuarioId }, transaction: t });
    }

    // Correo real reemplazado por un marcador único: Usuario.findOne({where:{email}}) del login no
    // vuelve a encontrar la fila, así que un intento con el correo original responde el mismo
    // AUTH_CREDENCIALES_INVALIDAS que un correo que nunca existió — sin un caso especial en
    // auth.service.js. La contraseña también se invalida, defensa en profundidad.
    const marcador = `eliminado-${usuarioId}-${crypto.randomBytes(4).toString('hex')}@proxi.invalid`;
    const passwordInservible = await passwords.hashear(crypto.randomBytes(32).toString('hex'));
    await usuario.update({ email: marcador, passwordHash: passwordInservible, anonimizadoAt: new Date() }, { transaction: t });

    await Sesion.update({ revocadaAt: new Date() }, { where: { usuarioId, revocadaAt: null }, transaction: t });

    await AuditoriaAcceso.create({ usuarioId, accion: 'eliminar_cuenta', entidad: 'usuario', entidadId: usuarioId, ip, userAgent }, { transaction: t });
  });

  // Recién acá, con la transacción ya confirmada: el disco no participa de un rollback, así que la
  // parte irreversible va al final, cuando ya no puede quedar huérfana de un fallo a mitad de camino.
  for (const archivo of archivos) {
    await fs.unlink(path.join(env.uploadDir, archivo.nombreAlmacenado)).catch(() => {});
  }
};

// Tarea de retención (docs/03-seguridad.md): dos pasadas, no aborta si una fila falla, mismo
// patrón que tareas/marcarSinRespuesta.js. ahora inyectable para las pruebas.
const procesarRetencion = async (ahora = new Date()) => {
  const limiteAviso = new Date(ahora);
  limiteAviso.setMonth(limiteAviso.getMonth() - env.retencionCvMeses);
  limiteAviso.setDate(limiteAviso.getDate() + env.retencionAvisoDias);

  const limiteEliminacion = new Date(ahora);
  limiteEliminacion.setMonth(limiteEliminacion.getMonth() - env.retencionCvMeses);

  let avisadas = 0;
  let eliminadas = 0;
  let fallidas = 0;

  // Usuario.anonimizadoAt, no un dato de perfil: nombres es editable por el propio estudiante
  // (PATCH /estudiantes/perfil) y no sirve como marca de "ya se procesó" (auditoría de Fase 7).
  const candidatosAviso = await Estudiante.findAll({
    where: { avisoRetencionEnviadoAt: null },
    include: [{ model: Usuario, required: true, where: { anonimizadoAt: null } }],
  });
  for (const estudiante of candidatosAviso) {
    try {
      // "Sin actividad" es COALESCE(ultimo_acceso_at, created_at): quien nunca inició sesión
      // también debe entrar en la cuenta, no quedar exento para siempre.
      const ultimaActividad = estudiante.Usuario.ultimoAccesoAt ?? estudiante.Usuario.createdAt;
      if (ultimaActividad >= limiteAviso) continue;
      await correoService.enviarCorreo({
        para: estudiante.Usuario.email,
        asunto: 'Tu cuenta en Proxi se eliminará por inactividad',
        texto: `No hemos visto actividad en tu cuenta en mucho tiempo. Si no vuelves a iniciar sesión en los próximos ${env.retencionAvisoDias} días, tu perfil y tu CV se eliminarán automáticamente, según la política de retención de datos.`,
      });
      await estudiante.update({ avisoRetencionEnviadoAt: ahora });
      avisadas += 1;
    } catch (error) {
      fallidas += 1;
      logger.warn({ estudianteId: estudiante.id, err: error.message }, 'procesarRetencion: no se pudo avisar');
    }
  }

  // El aviso solo cuenta si se mandó hace al menos retencionAvisoDias (Op.lt ya excluye null) y es
  // posterior a la última actividad conocida — auth.service.js login() limpia el aviso al volver a
  // entrar, así que en el camino normal esto ya no puede pasar, pero es la comprobación barata que
  // hace explícita la regla en vez de confiar solo en que nadie más la rompa desde otro lado
  // (auditoría de Fase 7: sin la primera parte de este filtro, alguien recién avisado calificaba
  // para eliminarse en la misma corrida, la misma noche — "aviso previo" en cero días reales).
  const limiteAvisoCumplido = new Date(ahora);
  limiteAvisoCumplido.setDate(limiteAvisoCumplido.getDate() - env.retencionAvisoDias);
  const candidatosEliminacion = await Estudiante.findAll({
    where: { avisoRetencionEnviadoAt: { [Op.lt]: limiteAvisoCumplido } },
    include: [{ model: Usuario, required: true, where: { anonimizadoAt: null } }],
  });

  if (candidatosEliminacion.length > LIMITE_ELIMINACIONES_POR_CORRIDA) {
    logger.error(
      { cantidad: candidatosEliminacion.length, limite: LIMITE_ELIMINACIONES_POR_CORRIDA },
      'procesarRetencion: demasiadas cuentas calificaron para eliminarse en una sola corrida, se aborta la pasada — revisar RETENCION_CV_MESES/RETENCION_AVISO_DIAS',
    );
    return { avisadas, eliminadas: 0, fallidas: fallidas + candidatosEliminacion.length };
  }

  for (const estudiante of candidatosEliminacion) {
    try {
      const ultimaActividad = estudiante.Usuario.ultimoAccesoAt ?? estudiante.Usuario.createdAt;
      if (ultimaActividad >= limiteEliminacion) continue;
      if (estudiante.avisoRetencionEnviadoAt <= ultimaActividad) continue;
      await eliminarCuenta(estudiante.usuarioId);
      eliminadas += 1;
    } catch (error) {
      fallidas += 1;
      logger.warn({ estudianteId: estudiante.id, err: error.message }, 'procesarRetencion: no se pudo eliminar');
    }
  }

  return { avisadas, eliminadas, fallidas };
};

module.exports = { obtenerDatos, confirmarClave, eliminarCuenta, procesarRetencion };
