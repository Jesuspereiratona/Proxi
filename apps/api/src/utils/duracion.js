const UNIDADES_MS = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

// Solo lo que usan las TTL de auth: un número entero seguido de s/m/h/d (ej. "15m", "7d").
const aMilisegundos = (cadena) => {
  const coincidencia = /^(\d+)(s|m|h|d)$/.exec(cadena);
  if (!coincidencia) throw new Error(`Duración inválida: "${cadena}"`);
  const [, cantidad, unidad] = coincidencia;
  return Number(cantidad) * UNIDADES_MS[unidad];
};

module.exports = { aMilisegundos };
