const { z } = require('zod');

const crearEsquema = z.object({
  ofertaId: z.coerce.number().int().positive(),
  mensaje: z.string().min(1).max(2000).optional(),
});

// Compartido por rechazo (empresa) y retiro (estudiante): en ambos el motivo es un texto libre
// opcional, nunca obligatorio como el motivo_cierre de ofertas.
const motivoOpcionalEsquema = z.object({
  motivo: z.string().min(1).max(500).optional(),
});

module.exports = { crearEsquema, motivoOpcionalEsquema };
