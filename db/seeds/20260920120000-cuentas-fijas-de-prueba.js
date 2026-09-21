'use strict';

// Cuentas FIJAS de prueba: mismo correo y misma clave en cada corrida.
//
// El otro seed (20260829130000) genera una clave al azar y la imprime una sola vez. Es lo correcto
// para datos de demostración, pero inservible para probar a mano: la clave se pierde apenas se
// cierra la terminal. Estas cuentas existen para lo contrario — entrar rápido a los tres roles sin
// tener que buscar nada.
//
// LA CLAVE ESCRITA ACÁ SOLO VALE EN DESARROLLO, porque este repositorio es público. Fuera de
// desarrollo/prueba el seed exige `CUENTAS_DEMO_CLAVE`, que solo conoce quien despliega: no alcanza
// con "no es producción", porque un entorno de staging accesible desde internet tampoco puede tener
// cuentas con una clave que cualquiera lee en GitHub.
//
// Estas cuentas existen en un entorno público por una razón concreta: mostrar Proxi funcionando a
// la FEN sin depender de que el envío de correo esté configurado. No son cuentas de personas
// reales; cuando el proyecto reciba usuarios de verdad, se borran.
//
// Los RUT usan el algoritmo de dígito verificador real (para que pasen la validación) pero con
// cuerpos que empiezan en 99, rango que el Registro Civil no asigna a personas naturales. El
// dominio .test está reservado por la RFC 2606 y no resuelve: ninguno de estos correos puede
// llegarle a una persona real.

const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const env = require('../../apps/api/src/config/env');

const CLAVE_PUBLICA = 'ProxiFEN2026'; // 12 caracteres, el mínimo que exige services/auth/passwords.js

// En producción la clave NO puede ser la de arriba: está escrita en un repositorio público. Se toma
// de CUENTAS_DEMO_CLAVE, que solo conoce quien despliega. Sin esa variable, el seed se sigue
// negando a correr fuera de desarrollo, igual que antes.
const claveParaEsteEntorno = () => {
  if (env.nodeEnv === 'development' || env.nodeEnv === 'test') return CLAVE_PUBLICA;

  const propia = process.env.CUENTAS_DEMO_CLAVE;
  if (!propia) {
    throw new Error(
      `Con NODE_ENV=${env.nodeEnv} hay que pasar CUENTAS_DEMO_CLAVE: la clave escrita en este archivo `
      + 'está en un repositorio público y no puede usarse en un entorno accesible desde internet.',
    );
  }
  if (propia.length < 12) {
    throw new Error('CUENTAS_DEMO_CLAVE debe tener al menos 12 caracteres.');
  }
  if (propia === CLAVE_PUBLICA) {
    throw new Error('CUENTAS_DEMO_CLAVE no puede ser la clave que está escrita en el repositorio.');
  }
  return propia;
};
const DOMINIO = 'cuentas-proxi.test';

const CUENTAS = [
  { correo: `estudiante@${DOMINIO}`, rol: 'estudiante', nota: 'perfil completo, con RUT' },
  { correo: `estudiante2@${DOMINIO}`, rol: 'estudiante', nota: 'el segundo, para probar que no ve lo del primero' },
  { correo: `empresa@${DOMINIO}`, rol: 'empresa', nota: 'validada — puede publicar' },
  { correo: `empresa.pendiente@${DOMINIO}`, rol: 'empresa', nota: 'esperando validación' },
  { correo: `empresa.suspendida@${DOMINIO}`, rol: 'empresa', nota: 'suspendida por coordinación' },
  { correo: `coordinacion@${DOMINIO}`, rol: 'coordinacion', nota: 'valida empresas y modera ofertas' },
];

// Borra las cuentas anteriores y todo lo que cuelga de ellas. Hace falta por dos razones: el
// proyecto no configura seederStorage, así que `db:seed:all` reejecuta este archivo en cada corrida
// y sin esto chocaría con el UNIQUE de email; y auditoria_accesos tiene su FK en RESTRICT a
// propósito (es evidencia legal, no se borra en cascada), así que hay que vaciarla explícitamente
// y en orden de dependencia.
const borrarCuentas = async (queryInterface) => {
  const s = queryInterface.sequelize;
  const mios = `SELECT id FROM usuarios WHERE email LIKE '%@${DOMINIO}'`;
  const misOfertas = `SELECT o.id FROM ofertas o JOIN empresas em ON em.id = o.empresa_id WHERE em.usuario_id IN (${mios})`;
  const misPostulaciones = `SELECT p.id FROM postulaciones p JOIN estudiantes e ON e.id = p.estudiante_id WHERE e.usuario_id IN (${mios})
                            UNION SELECT p.id FROM postulaciones p WHERE p.oferta_id IN (${misOfertas})`;

  await s.query(`DELETE FROM postulacion_eventos WHERE postulacion_id IN (${misPostulaciones})`, { logging: false });
  await s.query(`DELETE FROM postulaciones WHERE id IN (${misPostulaciones})`, { logging: false });
  await s.query(`DELETE FROM oferta_eventos WHERE oferta_id IN (${misOfertas})`, { logging: false });
  await s.query(`DELETE FROM ofertas WHERE id IN (${misOfertas})`, { logging: false });
  await s.query(`DELETE FROM auditoria_accesos WHERE usuario_id IN (${mios})`, { logging: false });
  await s.query(`DELETE FROM sesiones WHERE usuario_id IN (${mios})`, { logging: false });
  await s.query(`DELETE FROM estudiantes WHERE usuario_id IN (${mios})`, { logging: false });
  // La empresa validada apunta a la cuenta de coordinación: sin soltar esa referencia, borrar
  // coordinación falla por la FK.
  await s.query(`UPDATE empresas SET validada_por_usuario_id = NULL WHERE validada_por_usuario_id IN (${mios})`, { logging: false });
  await s.query(`DELETE FROM empresas WHERE usuario_id IN (${mios})`, { logging: false });
  await s.query(`DELETE FROM usuarios WHERE email LIKE '%@${DOMINIO}'`, { logging: false });
};

module.exports = {
  async up(queryInterface) {
    const CLAVE = claveParaEsteEntorno();

    await borrarCuentas(queryInterface);

    const passwordHash = await bcrypt.hash(CLAVE, env.bcryptRounds);
    const ahora = new Date();

    const filas = CUENTAS.map(
      (c) => `('${c.correo}', $1::text, '${c.rol}', 'activo', $2::timestamptz, $2::timestamptz, $2::timestamptz)`,
    );
    const usuarios = await queryInterface.sequelize.query(
      `INSERT INTO usuarios (email, password_hash, rol, estado, email_verificado_at, created_at, updated_at)
       VALUES ${filas.join(', ')} RETURNING id, email`,
      { bind: [passwordHash, ahora], type: QueryTypes.SELECT, logging: false },
    );
    const id = Object.fromEntries(usuarios.map((u) => [u.email, u.id]));

    await queryInterface.sequelize.query(
      `INSERT INTO estudiantes (usuario_id, nombres, apellidos, rut_cifrado, rut_ultimos_4, carrera, nivel, telefono, created_at, updated_at)
       VALUES
         ($1::bigint, 'Camila', 'Rojas Pérez', pgp_sym_encrypt($3::text, $5::text), '0011', 'Ingeniería Comercial', 8, '+56911110001', $6::timestamptz, $6::timestamptz),
         ($2::bigint, 'Matías', 'Fuentes Soto', pgp_sym_encrypt($4::text, $5::text), '0038', 'Contador Auditor', 7, '+56911110002', $6::timestamptz, $6::timestamptz)`,
      {
        bind: [
          id[`estudiante@${DOMINIO}`],
          id[`estudiante2@${DOMINIO}`],
          '991000011',
          '991000038',
          env.rutCifradoKey,
          ahora,
        ],
        logging: false,
      },
    );

    const base = { contacto_cargo: 'Jefatura de Personas', created_at: ahora, updated_at: ahora };
    await queryInterface.bulkInsert('empresas', [
      {
        ...base,
        usuario_id: id[`empresa@${DOMINIO}`],
        razon_social: 'Altiplano Consultores SpA',
        rut_empresa: '999000037',
        giro: 'Consultoría financiera',
        sitio_web: 'https://altiplano.cuentas-proxi.test',
        comuna: 'Santiago',
        contacto_nombre: 'Paula Herrera',
        estado_validacion: 'validada',
        validada_por_usuario_id: id[`coordinacion@${DOMINIO}`],
        validada_at: ahora,
      },
      {
        ...base,
        usuario_id: id[`empresa.pendiente@${DOMINIO}`],
        razon_social: 'Litoral Servicios Ltda',
        rut_empresa: '999000045',
        giro: 'Servicios contables',
        comuna: 'Valparaíso',
        contacto_nombre: 'Rodrigo Muñoz',
        estado_validacion: 'pendiente',
      },
      {
        ...base,
        usuario_id: id[`empresa.suspendida@${DOMINIO}`],
        razon_social: 'Bosque Norte SpA',
        rut_empresa: '999000053',
        giro: 'Comercio mayorista',
        comuna: 'Las Condes',
        contacto_nombre: 'Ignacia Vidal',
        estado_validacion: 'suspendida',
      },
    ]);

    // La clave se imprime solo cuando es la pública, que ya está en el repositorio. La de
    // producción la pasó quien corrió esto y no tiene por qué quedar en el log del despliegue.
    const claveMostrada = CLAVE === CLAVE_PUBLICA ? CLAVE : 'la que pasaste en CUENTAS_DEMO_CLAVE';
    console.log(`\n  Cuentas fijas de prueba listas. Clave para todas: ${claveMostrada}`);
    CUENTAS.forEach((c) => console.log(`   ${c.correo.padEnd(40)}${c.rol.padEnd(14)}${c.nota}`));
    console.log('');
  },

  async down(queryInterface) {
    await borrarCuentas(queryInterface);
  },
};
