const { z } = require('zod');

// El esquema no declara "usuarioId" ni "id": zod descarta cualquier campo no declarado (lista
// blanca), así que un usuarioId forjado en el cuerpo nunca llega al service.
const crearPerfilEsquema = z.object({
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  rut: z.string().min(1),
  carrera: z.string().min(1),
  nivel: z.number().int().positive().optional(),
  telefono: z.string().min(1).optional(),
});

const actualizarPerfilEsquema = crearPerfilEsquema.partial();

module.exports = { crearPerfilEsquema, actualizarPerfilEsquema };
