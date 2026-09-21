// Dónde está la API. No hay paso de compilación en apps/web —es HTML servido tal cual—, así que la
// URL no se puede inyectar por variable de entorno: se decide en el navegador, mirando desde qué
// host se abrió la página.
//
// En el hosting real (Cloudflare Pages, Vercel) la web y la API quedan en dominios distintos. Por
// eso la API declara WEB_URL en la lista blanca de CORS y la cookie de sesión va con
// SameSite=none: no son dos ajustes sueltos, son consecuencia de esta separación.
// globalThis.location y no window.location: las pruebas de apps/web importan estos módulos en Node,
// donde `window` no existe y una referencia directa revienta al cargar el archivo. Sin host —en las
// pruebas— cae en la rama local, que es la correcta ahí.
const HOST = globalThis.location?.hostname ?? '';
const EN_LOCAL = ['localhost', '127.0.0.1', ''].includes(HOST);

// Cambiar por el dominio real de la API al crear el servicio en Render. Es la ÚNICA línea que hay
// que tocar para apuntar la web a otro backend.
const API_EN_PRODUCCION = 'https://proxi-api.onrender.com/api/v1';

export const API_URL = EN_LOCAL ? 'http://localhost:3000/api/v1' : API_EN_PRODUCCION;
