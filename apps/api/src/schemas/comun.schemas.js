const { z } = require('zod');

const idParamEsquema = z.object({ id: z.coerce.number().int().positive() });

module.exports = { idParamEsquema };
