const { z } = require('zod');

const MODALIDADES = ['presencial', 'hibrida', 'remota'];
const JORNADAS = ['completa', 'parcial'];

const camposBase = {
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  requisitos: z.string().min(1),
  area: z.string().min(1),
  modalidad: z.enum(MODALIDADES),
  comuna: z.string().min(1).optional(),
  jornada: z.enum(JORNADAS),
  remunerada: z.boolean(),
  montoMensual: z.number().int().positive().optional(),
  cupos: z.number().int().positive().optional(),
  // Fecha de cierre es opcional: un borrador puede no tenerla todavía (se exige recién al enviar a
  // revisión, ver services/ofertas/ofertas.service.js).
  // z.coerce.date() solo, sin el z.union() de adelante, acepta cualquier cosa que Date() acepte:
  // null -> 1970-01-01, true -> 1970-01-01T00:00:00.001Z, 0 -> epoch (auditoría de Fase 3). El union
  // limita la entrada a string o Date antes de coercionar, y el refine pone un tope razonable.
  fechaCierre: z
    .union([z.string(), z.date()])
    .pipe(z.coerce.date())
    .refine((fecha) => fecha.getFullYear() < 2100, { message: 'La fecha de cierre no es razonable.' })
    .optional(),
};

// Cruce de campos que la base también exige (CHECK), pero acá se valida antes para dar un mensaje
// de campo claro en vez de un error de Postgres.
const validarCruces = (datos, ctx) => {
  if (datos.remunerada && datos.montoMensual === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['montoMensual'], message: 'Obligatorio si la oferta es remunerada.' });
  }
  if (datos.modalidad && datos.modalidad !== 'remota' && !datos.comuna) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['comuna'], message: 'Obligatoria salvo modalidad remota.' });
  }
};

const crearEsquema = z.object(camposBase).superRefine(validarCruces);

const editarEsquema = z.object(camposBase).partial();

const rechazoEsquema = z.object({
  motivo: z.string().min(1, 'El motivo de rechazo es obligatorio.'),
});

// "vencida" no está acá a propósito: ese motivo lo pone el sistema (cerrarOfertasVencidas), nunca
// el cliente.
const cierreEsquema = z.object({
  motivoCierre: z.enum(['contratado', 'cancelada', 'sin_candidatos'], {
    errorMap: () => ({ message: 'motivoCierre debe ser contratado, cancelada o sin_candidatos.' }),
  }),
});

const filtrosListadoEsquema = z.object({
  area: z.string().min(1).optional(),
  modalidad: z.enum(MODALIDADES).optional(),
  comuna: z.string().min(1).optional(),
  // z.coerce.boolean() es Boolean(valor): "false" -> true (auditoría de Fase 3). Un filtro público
  // que hace lo contrario de lo que pide no es un problema de seguridad, pero sigue siendo un bug.
  remunerada: z.enum(['true', 'false']).transform((valor) => valor === 'true').optional(),
  pagina: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().max(100).optional(),
});

module.exports = { crearEsquema, editarEsquema, rechazoEsquema, cierreEsquema, filtrosListadoEsquema };
