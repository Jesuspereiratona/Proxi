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

      // El cuerpo se lee entero antes de reenviarlo, en vez de pasar el flujo tal cual: reenviar
      // `request.body` como flujo devolvía 502 en los POST (medido contra producción — GET pasaba,
      // login no). Lo más grande que sube Proxi es un CV de 5 MB, que cabe de sobra en la memoria
      // de un Worker.
      const cuerpo = request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer();

      try {
        // Las cookies viajan en el encabezado `cookie` y las Set-Cookie vuelven tal cual: al salir
        // por este dominio, el navegador las guarda como propias. La respuesta no se toca — los
        // encabezados de seguridad que pone helmet tienen que llegar intactos.
        return await fetch(destino, {
          method: request.method,
          headers: request.headers,
          body: cuerpo,
          // Una redirección de la API es decisión del navegador, no de este proxy.
          redirect: 'manual',
        });
      } catch (error) {
        // Sin esto, cualquier tropiezo sale como un 502 pelado de Cloudflare, imposible de
        // diagnosticar. El servicio gratuito de Render duerme a los 15 minutos y la primera
        // petición tarda ~50 s: este es el caso que más va a aparecer.
        return new Response(
          JSON.stringify({ error: { codigo: 'API_NO_DISPONIBLE', mensaje: `No se pudo contactar la API: ${error.message}` } }),
          { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } },
        );
      }
    }

    // Todo lo demás lo sirve el sitio estático, con su propio manejo de rutas y 404.
    return env.ASSETS.fetch(request);
  },
};
