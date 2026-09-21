// Proxy de /api/* hacia la API en Render. Corre en el borde de Cloudflare, delante del sitio.
//
// POR QUÉ EXISTE, que no es obvio: sin esto la web y la API quedan en dominios distintos, y la
// protección CSRF de Proxi es "doble envío" — el navegador manda la cookie `csrf` y el JavaScript
// tiene que LEER esa misma cookie y repetirla en un encabezado. Desde otro dominio no puede leerla:
// `document.cookie` solo ve las del propio sitio. Resultado: POST /auth/refrescar llegaba sin el
// encabezado y la API respondía 403 AUTH_CSRF_INVALIDO, así que iniciar sesión funcionaba pero la
// página siguiente rebotaba de vuelta al formulario.
//
// En desarrollo no se notaba: localhost:5173 y localhost:3000 comparten cookies, porque el puerto
// no separa sitios. Solo aparece al desplegar en dominios de verdad.
//
// Con este proxy el navegador habla siempre con proxi-88x.pages.dev: la cookie es de primera parte,
// el JavaScript la lee, y de paso desaparece CORS. La alternativa —debilitar el CSRF— era cambiar
// una defensa real por una comodidad de despliegue.
const ORIGEN_API = 'https://proxi-api.onrender.com';

export const onRequest = async ({ request, params }) => {
  const entrante = new URL(request.url);
  const ruta = Array.isArray(params.ruta) ? params.ruta.join('/') : (params.ruta ?? '');
  const destino = new URL(`/api/${ruta}${entrante.search}`, ORIGEN_API);

  // new Request(destino, request) copia método, encabezados y cuerpo. El Host lo pone fetch solo.
  // Las cookies viajan en el encabezado `cookie` como en cualquier petición, y las Set-Cookie de la
  // respuesta vuelven tal cual: al salir por este dominio, el navegador las guarda como propias.
  // La respuesta se devuelve tal cual: los encabezados de seguridad que pone helmet (nosniff,
  // CSP, Cross-Origin-Resource-Policy) tienen que llegar intactos al navegador. Este proxy no
  // decide nada sobre la respuesta, solo la transporta.
  return fetch(new Request(destino, request));
};
