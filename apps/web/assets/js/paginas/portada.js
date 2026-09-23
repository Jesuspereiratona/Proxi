import { obtener } from '../api/cliente.js';
import { icono } from '../componentes/iconos.js';

// Portada pública: explica qué es Proxi a alguien que llega sin contexto. Antes, el enlace que
// circulaba llevaba directo a una lista de ofertas y quien no supiera qué era Proxi tenía que
// deducirlo de la lista.

const contenedorCifras = document.getElementById('cifras');

document.getElementById('icono-revision').append(icono('revisado'));

const cifra = (numero, etiqueta) => {
  const div = document.createElement('div');
  div.className = 'cifra';
  const valor = document.createElement('p');
  valor.className = 'cifra-valor titular';
  valor.textContent = numero;
  const texto = document.createElement('p');
  texto.className = 'cifra-etiqueta';
  texto.textContent = etiqueta;
  div.append(valor, texto);
  return div;
};

// Las tres cifras salen de la base, no están escritas a mano. Y cuando todavía no hay historial
// suficiente, la API devuelve null y acá simplemente no se dibuja esa cifra: publicar "0 días
// promedio" con tres postulaciones respondidas sería inventar precisión.
const pintarCifras = async () => {
  try {
    const datos = await obtener('/panorama/publico');
    const cifras = [cifra(datos.ofertasVigentes, 'ofertas vigentes')];
    if (datos.diasPromedioRespuesta !== null) {
      cifras.push(cifra(datos.diasPromedioRespuesta, 'días promedio de respuesta'));
    }
    if (datos.postulacionesSinRespuesta !== null) {
      cifras.push(cifra(datos.postulacionesSinRespuesta, 'postulaciones sin respuesta'));
    }
    contenedorCifras.replaceChildren(...cifras);
  } catch {
    // Que las cifras no carguen no puede romper la portada: es información de apoyo, no el
    // contenido. Se deja el hueco vacío y el resto de la página funciona igual.
    contenedorCifras.replaceChildren();
  }
};

pintarCifras();
