// Función pura: sin DOM, se prueba directo con node --test (docs/08-guia-visual.md).
export const UMBRAL_URGENTE_DIAS = 3;

const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const formatoFecha = (fecha) => fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });

export const calcularEstado = (fechaCierre, ahora = new Date()) => {
  const cierre = fechaCierre instanceof Date ? fechaCierre : new Date(fechaCierre);

  // "Cierra hoy" tiene prioridad sobre "vencida": aunque ya haya pasado la hora exacta, mientras
  // sigue siendo el mismo día calendario no se le dice a nadie que ya venció.
  if (mismoDia(cierre, ahora)) {
    return { texto: 'Cierra hoy', clase: 'urgente', urgente: true };
  }
  if (cierre <= ahora) {
    return { texto: 'Vencida', clase: 'vencida', urgente: false };
  }

  const diasRestantes = Math.ceil((cierre - ahora) / (24 * 60 * 60 * 1000));
  if (diasRestantes <= UMBRAL_URGENTE_DIAS) {
    return { texto: `Cierra en ${diasRestantes} días`, clase: 'urgente', urgente: true };
  }
  return { texto: `Cierra el ${formatoFecha(cierre)}`, clase: 'normal', urgente: false };
};

// Estado de flujo de una oferta (panel de empresa, Fase 6 parte 4) — distinto de calcularEstado()
// de arriba, que es la vigencia de una oferta ya publicada que ve la vitrina pública. Reusa las
// mismas tres clases visuales (.normal/.urgente/.vencida de uah-theme.css) en vez de inventar
// colores nuevos: "publicada" es el estado activo (igual que "vigente"), "en_revision" es el que
// necesita atención (igual que "urgente"), y "borrador"/"cerrada"/"archivada" son neutros.
const ESTADOS_OFERTA = {
  borrador: { texto: 'Borrador', clase: 'vencida' },
  en_revision: { texto: 'En revisión', clase: 'urgente' },
  publicada: { texto: 'Publicada', clase: 'normal' },
  cerrada: { texto: 'Cerrada', clase: 'vencida' },
  archivada: { texto: 'Archivada', clase: 'vencida' },
};

export const textoEstadoOferta = (estado) => ESTADOS_OFERTA[estado] ?? { texto: estado, clase: 'vencida' };
