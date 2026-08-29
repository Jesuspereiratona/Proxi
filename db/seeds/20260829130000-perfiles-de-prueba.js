'use strict';

// Datos de prueba INVENTADOS a propósito: el repo es público. Ningún RUT ni correo real.
// Los RUT usan el algoritmo de dígito verificador real (para que las pruebas de validación pasen)
// pero los cuerpos empiezan en 99: rango que el Registro Civil no asigna a personas naturales.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { QueryTypes } = require('sequelize');
const env = require('../../apps/api/src/config/env');

module.exports = {
  async up(queryInterface) {
    if (env.esProduccion) {
      throw new Error('Los seeds de demostración no se ejecutan en producción.');
    }

    // Contraseña generada en cada corrida, nunca un literal en el repo: la clave de una cuenta
    // coordinacion (o de cualquier cuenta activa) no puede quedar escrita en un archivo público.
    const claveDePrueba = crypto.randomBytes(12).toString('base64url');
    console.log(`Seed: clave de las cuentas de demo -> ${claveDePrueba}`);

    const passwordHash = await bcrypt.hash(claveDePrueba, env.bcryptRounds);
    const ahora = new Date();

    const usuarios = await queryInterface.sequelize.query(
      `INSERT INTO usuarios (email, password_hash, rol, estado, email_verificado_at, created_at, updated_at)
       VALUES
         ('estudiante.demo1@ejemplo-proxi.test', $1::text, 'estudiante', 'activo', $2::timestamptz, $2::timestamptz, $2::timestamptz),
         ('estudiante.demo2@ejemplo-proxi.test', $1::text, 'estudiante', 'activo', $2::timestamptz, $2::timestamptz, $2::timestamptz),
         ('empresa.demo1@ejemplo-proxi.test', $1::text, 'empresa', 'activo', $2::timestamptz, $2::timestamptz, $2::timestamptz),
         ('empresa.demo2@ejemplo-proxi.test', $1::text, 'empresa', 'activo', $2::timestamptz, $2::timestamptz, $2::timestamptz),
         ('coordinacion.demo@ejemplo-proxi.test', $1::text, 'coordinacion', 'activo', $2::timestamptz, $2::timestamptz, $2::timestamptz)
       RETURNING id, email`,
      { bind: [passwordHash, ahora], type: QueryTypes.SELECT, logging: false },
    );

    const idPorCorreo = Object.fromEntries(usuarios.map((u) => [u.email, u.id]));

    await queryInterface.sequelize.query(
      `INSERT INTO estudiantes (usuario_id, nombres, apellidos, rut_cifrado, rut_ultimos_4, carrera, nivel, telefono, created_at, updated_at)
       VALUES
         ($1::bigint, 'Estudiante', 'Demo Uno', pgp_sym_encrypt($3::text, $5::text), '0018', 'Contador Auditor', 6, '+56900000001', $6::timestamptz, $6::timestamptz),
         ($2::bigint, 'Estudiante', 'Demo Dos', pgp_sym_encrypt($4::text, $5::text), '0026', 'Ingeniería Comercial', 4, '+56900000002', $6::timestamptz, $6::timestamptz)`,
      {
        bind: [
          idPorCorreo['estudiante.demo1@ejemplo-proxi.test'],
          idPorCorreo['estudiante.demo2@ejemplo-proxi.test'],
          '990000018',
          '990000026',
          env.rutCifradoKey,
          ahora,
        ],
        logging: false,
      },
    );

    await queryInterface.bulkInsert('empresas', [
      {
        usuario_id: idPorCorreo['empresa.demo1@ejemplo-proxi.test'],
        razon_social: 'Empresa Demo Validada SpA',
        rut_empresa: '999000010',
        giro: 'Servicios de prueba',
        sitio_web: 'https://empresa-demo-validada.ejemplo-proxi.test',
        comuna: 'Santiago',
        contacto_nombre: 'Contacto Demo',
        contacto_cargo: 'Encargado de RR.HH.',
        estado_validacion: 'validada',
        validada_por_usuario_id: idPorCorreo['coordinacion.demo@ejemplo-proxi.test'],
        validada_at: ahora,
        created_at: ahora,
        updated_at: ahora,
      },
      {
        usuario_id: idPorCorreo['empresa.demo2@ejemplo-proxi.test'],
        razon_social: 'Empresa Demo Pendiente Ltda',
        rut_empresa: '999000029',
        giro: 'Comercio de prueba',
        sitio_web: 'https://empresa-demo-pendiente.ejemplo-proxi.test',
        comuna: 'Providencia',
        contacto_nombre: 'Otro Contacto Demo',
        contacto_cargo: 'Gerente General',
        estado_validacion: 'pendiente',
        created_at: ahora,
        updated_at: ahora,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM usuarios WHERE email LIKE '%@ejemplo-proxi.test'`,
    );
  },
};
