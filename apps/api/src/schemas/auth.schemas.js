const { z } = require('zod');
const { LARGO_MINIMO } = require('../services/auth/passwords');

const claveEsquema = z.string().min(LARGO_MINIMO, `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres`);

const registroEsquema = z.object({
  email: z.string().email(),
  clave: claveEsquema,
  rol: z.enum(['estudiante', 'empresa']),
  aceptaPolitica: z.boolean(),
  versionPolitica: z.string().min(1),
});

const loginEsquema = z.object({
  email: z.string().email(),
  clave: z.string().min(1),
});

const verificarCorreoEsquema = z.object({ token: z.string().min(1) });

const recuperarClaveEsquema = z.object({ email: z.string().email() });

const restablecerClaveEsquema = z.object({
  token: z.string().min(1),
  claveNueva: claveEsquema,
});

module.exports = {
  registroEsquema,
  loginEsquema,
  verificarCorreoEsquema,
  recuperarClaveEsquema,
  restablecerClaveEsquema,
};
