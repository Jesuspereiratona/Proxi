const { z } = require('zod');

// z.string().url() sola no alcanza: new URL('javascript:alert(1)') es una URL válida para Zod
// (usa el mismo constructor por dentro). Fase 6 lo publica en /empresas/:id/indicadores sin
// autenticar y el cliente lo asigna directo a <a href> — sin el refine, cualquier empresa validada
// puede guardar un XSS almacenado sin que coordinación lo vuelva a revisar (auditoría de Fase 6).
const esUrlHttp = (valor) => {
  try {
    return ['http:', 'https:'].includes(new URL(valor).protocol);
  } catch {
    return false;
  }
};

const crearPerfilEsquema = z.object({
  razonSocial: z.string().min(1),
  rutEmpresa: z.string().min(1),
  giro: z.string().min(1).optional(),
  sitioWeb: z.string().url().max(200).refine(esUrlHttp, 'El sitio web debe empezar con http:// o https://').optional(),
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
