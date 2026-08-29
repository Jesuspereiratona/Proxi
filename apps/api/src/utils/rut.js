const normalizarRut = (rut) => String(rut).replace(/[.\-\s]/g, '').toUpperCase();

const calcularDigitoVerificador = (cuerpo) => {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
};

const esRutValido = (rut) => {
  const normalizado = normalizarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(normalizado)) return false;
  const cuerpo = normalizado.slice(0, -1);
  const dv = normalizado.slice(-1);
  return calcularDigitoVerificador(cuerpo) === dv;
};

module.exports = { normalizarRut, esRutValido };
