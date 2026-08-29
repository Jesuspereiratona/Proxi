const bcrypt = require('bcryptjs');
const env = require('../../config/env');

const LARGO_MINIMO = 12;

const hashear = (clave) => bcrypt.hash(clave, env.bcryptRounds);

const comparar = (clave, hash) => bcrypt.compare(clave, hash);

const esFuerte = (clave) => typeof clave === 'string' && clave.length >= LARGO_MINIMO;

module.exports = { hashear, comparar, esFuerte, LARGO_MINIMO };
