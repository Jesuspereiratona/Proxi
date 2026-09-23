import { pintarNavSesion } from './nav-sesion.js';
import { icono } from './iconos.js';

// La cabecera del sitio, una sola vez para las catorce páginas.
//
// Estaba copiada a mano en cada archivo y había divergido de la peor forma: dos páginas tenían la
// versión con navegación y doce se habían quedado con una barra que solo mostraba "Proxi". Y en
// celular no aparecía ninguna, porque los enlaces colgaban de `d-none d-md-flex` y nunca existió el
// botón que los desplegara — o sea, en teléfono el sitio no tenía navegación en absoluto.
//
// Se arma desde JS y no se copia en el HTML justamente para que esto no vuelva a pasar: un cambio
// acá alcanza a todas las páginas.

const ENLACES = [
  { clave: 'inicio', href: 'index.html', texto: 'Inicio' },
  { clave: 'ofertas', href: 'ofertas.html', texto: 'Ofertas' },
  { clave: 'como-funciona', href: 'index.html#como-funciona', texto: 'Cómo funciona' },
  { clave: 'metricas', href: 'index.html#metricas', texto: 'Métricas' },
];

const crear = (etiqueta, props = {}, hijos = []) => {
  const nodo = Object.assign(document.createElement(etiqueta), props);
  nodo.append(...hijos);
  return nodo;
};

const enlaceNav = ({ href, texto }, activo) => crear('a', {
  className: `enlace-nav${activo ? ' activo' : ''}`,
  href,
  textContent: texto,
  // aria-current y no solo el color naranja: marcar la página actual únicamente con un color no
  // llega a quien usa lector de pantalla (docs/08-guia-visual.md).
  ...(activo ? { ariaCurrent: 'page' } : {}),
});

export const pintarCabecera = (contenedor) => {
  const activo = contenedor.dataset.activo ?? '';

  const soyEmpresa = crear('a', {
    className: 'enlace-nav', href: 'registro.html', textContent: 'Soy una empresa',
  });

  const menu = crear('div', { className: 'menu-cabecera', id: 'menu-principal' }, [
    ...ENLACES.map((e) => enlaceNav(e, e.clave === activo)),
    soyEmpresa,
    crear('div', { className: 'nav-sesion d-flex align-items-center gap-3' }),
  ]);

  // El botón vive solo en celular (lo esconde el CSS a partir de md). `aria-expanded` se mantiene
  // sincronizado porque es lo único que le dice a un lector de pantalla si el menú está abierto:
  // la clase `abierto` no se la comunica a nadie.
  const boton = crear('button', {
    type: 'button',
    className: 'boton-menu d-md-none',
    ariaLabel: 'Abrir menú',
    ariaExpanded: 'false',
  }, [icono('menu')]);
  boton.setAttribute('aria-controls', 'menu-principal');
  boton.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', String(abierto));
    boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  });

  contenedor.replaceChildren(
    crear('nav', { className: 'navbar border-bottom bg-white' }, [
      crear('div', { className: 'container' }, [
        crear('a', { className: 'navbar-brand titular', href: 'index.html', textContent: 'Proxi' }),
        crear('span', { className: 'marca-facultad d-none d-lg-inline', textContent: 'FEN UAH' }),
        boton,
        menu,
      ]),
    ]),
  );

  // La sesión se pinta después y sin await: decide qué dice la cabecera, no si la página se ve. Si
  // la API está dormida (Render tarda hasta un minuto en despertar), el resto del sitio no espera.
  //
  // "Soy una empresa" solo tiene sentido para quien no entró: lleva a registrarse, y a alguien con
  // sesión iniciada le ofrece crear una cuenta que ya tiene. Se esconde después y no antes porque
  // saber si hay sesión exige ir a la API, y no vale la pena retrasar la cabecera por eso.
  pintarNavSesion(contenedor.querySelector('.nav-sesion'))
    .then((usuario) => { if (usuario) soyEmpresa.remove(); })
    .catch(() => {});
};

const contenedor = document.getElementById('cabecera');
if (contenedor) pintarCabecera(contenedor);
