const VENTANA_MS = 15 * 60 * 1000;
const MAXIMO_INTENTOS = 5;

// Reloj inyectado (ahora, en vez de Date.now() suelto): se prueba sin esperar 15 minutos de verdad.
const estaBloqueado = (usuario, ahora = Date.now()) => {
  if (usuario.intentosFallidos < MAXIMO_INTENTOS) return false;
  if (!usuario.intentosFallidosDesde) return false;
  return ahora - new Date(usuario.intentosFallidosDesde).getTime() < VENTANA_MS;
};

const calcularTrasFallo = (usuario, ahora = Date.now()) => {
  const dentroDeVentana =
    usuario.intentosFallidosDesde && ahora - new Date(usuario.intentosFallidosDesde).getTime() < VENTANA_MS;

  if (dentroDeVentana) {
    return { intentosFallidos: usuario.intentosFallidos + 1, intentosFallidosDesde: usuario.intentosFallidosDesde };
  }
  return { intentosFallidos: 1, intentosFallidosDesde: new Date(ahora) };
};

const trasExito = () => ({ intentosFallidos: 0, intentosFallidosDesde: null });

module.exports = { estaBloqueado, calcularTrasFallo, trasExito, VENTANA_MS, MAXIMO_INTENTOS };
