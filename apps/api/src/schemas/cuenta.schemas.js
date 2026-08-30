const { z } = require('zod');

// DELETE /mi-cuenta es irreversible (docs/03-seguridad.md: supresión) — pedir la contraseña actual
// es la misma defensa que ya existe para cambiarla (restablecerClaveEsquema), acá contra un token de
// acceso robado con 15 minutos de vida que alcanzarían para destruir la cuenta sin que su dueño real
// haya confirmado nada (auditoría de Fase 7).
const eliminarCuentaEsquema = z.object({
  clave: z.string().min(1, 'Debes confirmar tu contraseña actual.'),
});

module.exports = { eliminarCuentaEsquema };
