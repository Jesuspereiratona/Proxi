// Proxy de /api/* hacia la API en Render, corriendo en el borde de Cloudflare delante del sitio.
//
// POR QUÉ EXISTE, que no es obvio: sin esto la web y la API quedan en dominios distintos, y la
// protección CSRF de Proxi es "doble envío" — el navegador manda la cookie `csrf` y el JavaScript
// tiene que LEER esa misma cookie y repetirla en un encabezado. Desde otro dominio no puede:
// `document.cookie` solo ve las del propio sitio. Resultado medido contra producción: iniciar
// sesión daba 200, y el POST /auth/refrescar de la página siguiente llegaba sin el encabezado y
// respondía 403 AUTH_CSRF_INVALIDO, así que la sesión rebotaba al formulario.
//
// En desarrollo no se nota: localhost:5173 y localhost:3000 comparten cookies porque el puerto no
// separa sitios. Solo aparece al desplegar en dominios de verdad.
//
// Con este proxy el navegador habla siempre con el dominio de la web: la cookie es de primera
// parte, el JavaScript la lee, y de paso desaparece CORS. La alternativa —debilitar el CSRF— era
// cambiar una defensa real por una comodidad de despliegue.
//
// Es `_worker.js` en la raíz de la carpeta publicada y no `functions/`: Cloudflare busca `functions`
// relativo al "root directory" del proyecto, que acá es la raíz del repositorio, no la carpeta
// publicada. Probado: con `apps/web/functions/` el proxy no se activaba y /api/v1/salud devolvía
// el index.html del sitio.
const ORIGEN_API = 'https://proxi-api.onrender.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const destino = new URL(url.pathname + url.search, ORIGEN_API);
      // new Request(destino, request) copia método, encabezados y cuerpo; fetch pone el Host. Las
      // cookies viajan en el encabezado `cookie` y las Set-Cookie vuelven tal cual: al salir por
      // este dominio, el navegador las guarda como propias. La respuesta no se toca — los
      // encabezados de seguridad que pone helmet tienen que llegar intactos.
      return fetch(new Request(destino, request));
    }

    // Todo lo demás lo sirve el sitio estático, con su propio manejo de rutas y 404.
    return env.ASSETS.fetch(request);
  },
};
