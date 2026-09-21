const { Usuario } = require('../src/models');
const tokensService = require('../src/services/auth/tokens');
const passwords = require('../src/services/auth/passwords');

// Helpers compartidos entre archivos de prueba, al lado de `limpiar.js`, que ya sentó el precedente.
// Estaban copiados verbatim en seis archivos y habían empezado a divergir: unas versiones generaban
// el RUT con guion y otras sin él (revisión de código del 2026-09-20).
//
// Cada archivo de prueba usa SU PROPIO dominio de correo: `node --test` corre los archivos en
// paralelo contra la misma base, así que el borrado por dominio de `limpiar.js` tiene que poder
// distinguir las filas de un archivo de las de otro.

const CLAVE = 'claveDePrueba123456';

let contador = 0;
const correoUnico = (prefijo, dominio) => `${prefijo}.${Date.now()}.${contador++}@${dominio}`;

// Dígito verificador real, para que pase la validación de `utils/rut.js`. Sin guion: es la forma en
// que se guarda en `empresas.rut_empresa`.
const generarRutValido = () => {
  const cuerpo = String(10000000 + Math.floor(Math.random() * 89999999));
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return `${cuerpo}${dv}`;
};

// `overrides` lo usa cuenta.test.js para crear un usuario que ya nace con algún campo distinto
// (por ejemplo anonimizadoAt). `emailOriginal` también sale de ahí: el borrado de cuenta reescribe
// usuario.email con un marcador, así que después no hay forma de recuperar el correo con el que se
// creó, y varias pruebas lo necesitan para comprobar que ese correo ya no sirve para entrar.
const crearUsuarioActivo = async (rol, dominio, overrides = {}) => {
  const email = correoUnico(rol, dominio);
  const passwordHash = await passwords.hashear(CLAVE);
  const usuario = await Usuario.create({
    email, passwordHash, rol, estado: 'activo', emailVerificadoAt: new Date(), ...overrides,
  });
  const accessToken = tokensService.firmarAcceso({ sub: String(usuario.id), rol });
  return { usuario, accessToken, emailOriginal: email };
};

module.exports = { CLAVE, correoUnico, generarRutValido, crearUsuarioActivo };
