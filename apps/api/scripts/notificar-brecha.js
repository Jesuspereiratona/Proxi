// Rotura de vidrio: notificar a las personas afectadas por una brecha
// (docs/09-procedimiento-de-brecha.md, paso 4 — specs/13-notificacion-de-brecha/spec.md).
//
// A propósito NO es un endpoint HTTP: una ruta capaz de escribirle a todos los usuarios es un arma
// si las credenciales se filtran. Mismo criterio que revocar-todas-las-sesiones.js.
//
// Dos modos:
//   Proponer a quién avisar, sin mandar nada:
//     node apps/api/scripts/notificar-brecha.js --proponer <actorUsuarioId> <desdeISO> <hastaISO>
//   Notificar, a partir de un archivo con un id de usuario por línea:
//     node apps/api/scripts/notificar-brecha.js --notificar <incidente> <archivo-de-ids> [tope]
//
// La lista se pasa en un archivo y no se calcula sola al vuelo: la decisión de a quién notificar no
// se toma en solitario (docs/09, paso 3). Se propone, la mira una persona, y recién ahí se manda.
const fs = require('fs');
const { sequelize } = require('../src/models');
const brechaService = require('../src/services/brecha/brecha.service');

// Los cuatro textos que cambian en cada incidente. Se piden por variable de entorno para que no
// queden escritos en el historial de la terminal junto al resto del comando.
const textosDelIncidente = () => ({
  queOcurrio: process.env.BRECHA_QUE_OCURRIO || 'Un tercero pudo acceder a datos guardados en la plataforma.',
  queDatos: process.env.BRECHA_QUE_DATOS || 'Los datos de tu perfil y tu currículum.',
  queHacer: process.env.BRECHA_QUE_HACER || 'No necesitas hacer nada por ahora. Si usas la misma contraseña en otros sitios, cámbiala.',
  contacto: process.env.BRECHA_CONTACTO || 'uahmarketcl@gmail.com',
});

const proponer = async ([actorId, desde, hasta]) => {
  if (!actorId || !desde || !hasta) throw new Error('Uso: --proponer <actorUsuarioId> <desdeISO> <hastaISO>');
  const afectados = await brechaService.afectadosPorActor(actorId, new Date(desde), new Date(hasta));

  // Se imprimen ids, nunca correos ni nombres: este listado termina pegado en un chat o en un
  // informe, y la regla de CLAUDE.md no tiene excepción para un incidente.
  console.log(`\nAfectados por lo que hizo el usuario ${actorId} entre ${desde} y ${hasta}:\n`);
  const porAccion = {};
  for (const { usuarioId, accion } of afectados) {
    (porAccion[accion] ??= []).push(usuarioId);
  }
  for (const [accion, ids] of Object.entries(porAccion)) {
    console.log(`  ${accion}: ${ids.length} persona(s)`);
  }
  const ids = [...new Set(afectados.map((a) => a.usuarioId))];
  console.log(`\nTotal, sin repetir: ${ids.length}`);
  console.log('\nGuarda estos ids en un archivo, revísalos con coordinación FEN, y después notifica:');
  console.log(ids.join('\n'));
};

const notificar = async ([incidente, archivo, tope]) => {
  if (!incidente || !archivo) throw new Error('Uso: --notificar <incidente> <archivo-de-ids> [tope]');
  const ids = fs.readFileSync(archivo, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error(`${archivo} no tiene ningún id.`);
  if (ids.some((id) => !/^\d+$/.test(id))) throw new Error('El archivo debe tener un id numérico por línea, nada más.');

  console.log(`\nIncidente "${incidente}": ${ids.length} persona(s) en la lista.`);
  const resultado = await brechaService.notificar(incidente, ids, textosDelIncidente(), {
    tope: tope ? Number(tope) : undefined,
  });

  console.log(`\n  avisadas ahora:      ${resultado.enviados}`);
  console.log(`  ya estaban avisadas: ${resultado.yaNotificados}`);
  console.log(`  cuentas suprimidas:  ${resultado.suprimidos} (su correo ya no existe)`);
  console.log(`  fallaron:            ${resultado.fallidos}`);
  if (resultado.pendientes > 0) {
    console.log(`\n  QUEDAN ${resultado.pendientes} POR AVISAR (se llegó al tope de la corrida).`);
    console.log('  Vuelve a correr el mismo comando: continúa donde quedó, no reenvía a nadie.');
  }
  if (resultado.fallidos > 0) {
    console.log('\n  Los fallidos quedaron registrados con su error. Revisa la tabla notificaciones_brecha');
    console.log('  y decide si se reintenta o si hay que avisarles por otra vía.');
  }
};

const [modo, ...resto] = process.argv.slice(2);
const acciones = { '--proponer': proponer, '--notificar': notificar };

if (!acciones[modo]) {
  console.error('Uso:');
  console.error('  node apps/api/scripts/notificar-brecha.js --proponer <actorUsuarioId> <desdeISO> <hastaISO>');
  console.error('  node apps/api/scripts/notificar-brecha.js --notificar <incidente> <archivo-de-ids> [tope]');
  process.exitCode = 1;
} else {
  acciones[modo](resto)
    .catch((error) => {
      console.error(`\nFalló: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}
