const { z } = require('zod');
const { LARGO_MINIMO } = require('../services/auth/passwords');

const claveEsquema = z.string().min(LARGO_MINIMO, `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres`);

// .invalid es el dominio que cuenta.service.js usa para marcar una cuenta ya suprimida
// (eliminado-<id>-<random>@proxi.invalid) — sin este refine, alguien podía registrarse con ese
// patrón y quedar indistinguible de una cuenta anonimizada en una revisión manual (auditoría de
// Fase 7). No es una superficie de ataque real (anonimizado_at, no el correo, decide qué está
// suprimido), pero confunde sin necesidad.
const registroEsquema = z.object({
  email: z.string().email().refine((valor) => !valor.toLowerCase().endsWith('.invalid'), 'Ese dominio de correo no está permitido.'),
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
