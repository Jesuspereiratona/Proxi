const { z } = require('zod');

// El esquema no declara "usuarioId" ni "id": zod descarta cualquier campo no declarado (lista
// blanca), así que un usuarioId forjado en el cuerpo nunca llega al service.
const crearPerfilEsquema = z.object({
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  rut: z.string().min(1),
  carrera: z.string().min(1),
  // .max(): mismo defecto que cupos/montoMensual de ofertas.schemas.js — un valor entre
  // 2.147.483.648 y Number.MAX_SAFE_INTEGER pasaba .int().positive() y reventaba en la columna
  // int4 de Postgres con 500 en vez de 422 (pentester-api).
  nivel: z.number().int().positive().max(20).optional(),
  telefono: z.string().min(1).optional(),
});

const actualizarPerfilEsquema = crearPerfilEsquema.partial();

module.exports = { crearPerfilEsquema, actualizarPerfilEsquema };
