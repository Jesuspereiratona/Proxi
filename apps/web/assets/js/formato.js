// Un solo lugar para convertir datos crudos de la API en texto para leer. Antes cada página
// improvisaba el suyo: el monto salía "$300000" en el panel de empresa y "$300.000" en el detalle
// de una oferta, y la modalidad salía "hibrida", sin tilde, en la vitrina (docs/08-guia-visual.md).

const MODALIDADES = { presencial: 'Presencial', hibrida: 'Híbrida', remota: 'Remota' };
// Solo estos dos: el CHECK ofertas_jornada_check de la migración no acepta otro valor.
const JORNADAS = { completa: 'Jornada completa', parcial: 'Jornada parcial' };

// Sin decimales: en pesos chilenos nadie escribe "$300.000,00", y el formateador los pone por
// defecto. maximumFractionDigits sin minimumFractionDigits lanza RangeError cuando el monto es
// redondo, así que van los dos.
const MONEDA = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

export const formatoMonto = (monto) => (Number.isFinite(monto) ? MONEDA.format(monto) : '—');

// "16 de sep, 2026" — el formato de la vitrina. Mes abreviado para que la fecha no gane peso
// visual sobre el título de la oferta, que es lo que la persona está escaneando.
export const formatoFechaCorta = (fecha) => new Date(fecha)
  .toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });

// "16 de septiembre de 2026" — para el detalle de una oferta, donde ya se está leyendo, no escaneando.
export const formatoFechaLarga = (fecha) => new Date(fecha)
  .toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

// Con hora: líneas de tiempo de postulaciones, donde el orden dentro de un mismo día importa.
export const formatoFechaHora = (fecha) => new Date(fecha)
  .toLocaleString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Valor desconocido: se devuelve tal cual en vez de "—". Si el backend agrega una modalidad nueva,
// que se vea fea es mejor que desaparezca de la pantalla sin que nadie lo note.
export const etiquetaModalidad = (valor) => MODALIDADES[valor] ?? valor ?? '';
export const etiquetaJornada = (valor) => JORNADAS[valor] ?? valor ?? '';

export const etiquetaRemuneracion = (remunerada, montoMensual) => {
  if (!remunerada) return 'No remunerada';
  return Number.isFinite(montoMensual) ? `${formatoMonto(montoMensual)} al mes` : 'Remunerada';
};

// El área es texto libre en la API (z.string(), no un enum), así que llega como la escribió la
// empresa: "control-gestion", "Auditoria", "marketing". No se puede traducir con un diccionario sin
// mentir en los valores que no estén en él, así que solo se le quita el aspecto de slug.
// El arreglo de fondo es una lista controlada de áreas en el backend — anotado en el roadmap.
export const etiquetaArea = (valor) => {
  if (!valor) return '';
  const limpio = valor.replace(/[-_]+/g, ' ').trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
};

// RUT chileno con puntos y guion: 626178944 -> 62.617.894-4. El dato llega sin formato desde la
// API, y coordinación lo usa para contrastar contra un registro externo — nueve dígitos corridos se
// leen mal y se transcriben peor.
// Un valor que no calza con la forma esperada se devuelve tal cual, sin intentar arreglarlo:
// inventarle un formato a un RUT mal guardado lo haría parecer válido.
export const formatoRut = (valor) => {
  if (!valor) return '';
  const limpio = String(valor).replace(/[.\-]/g, '').toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return String(valor);
  const cuerpo = limpio.slice(0, -1);
  const verificador = limpio.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${verificador}`;
};
