const { z } = require('zod');

const crearPerfilEsquema = z.object({
  razonSocial: z.string().min(1),
  rutEmpresa: z.string().min(1),
  giro: z.string().min(1).optional(),
  sitioWeb: z.string().min(1).optional(),
  comuna: z.string().min(1).optional(),
  contactoNombre: z.string().min(1),
  contactoCargo: z.string().min(1),
});

const actualizarPerfilEsquema = crearPerfilEsquema.partial();

const rechazoEsquema = z.object({
  motivoRechazo: z.string().min(1, 'El motivo de rechazo es obligatorio.'),
});

const suspensionEsquema = z.object({
  motivoSuspension: z.string().min(1, 'El motivo de suspensión es obligatorio.'),
});

module.exports = { crearPerfilEsquema, actualizarPerfilEsquema, rechazoEsquema, suspensionEsquema };
