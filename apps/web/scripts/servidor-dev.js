import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Solo para `npm run dev`, nunca para producción (Fase 8 decide cómo se sirve apps/web en el
// hosting real). Sin dependencia nueva: http/fs de Node alcanzan para servir archivos estáticos.
const PUERTO = Number(process.env.PORT) || 5173;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PUERTO}`);
    let rutaPedida = decodeURIComponent(url.pathname);
    if (rutaPedida.endsWith('/')) rutaPedida += 'index.html';

    // Nunca servir fuera de RAIZ: sin esto, "/../.env" en la URL leería fuera del sitio estático.
    // path.relative (no startsWith) evita el caso "apps/web-backup" pasando el chequeo por tener
    // el mismo prefijo de texto que RAIZ sin ser realmente un subdirectorio (auditoría de Fase 6).
    const rutaAbsoluta = path.normalize(path.join(RAIZ, rutaPedida));
    const relativa = path.relative(RAIZ, rutaAbsoluta);
    if (relativa.startsWith('..') || path.isAbsolute(relativa)) {
      res.writeHead(403).end('Prohibido');
      return;
    }

    // realpath resuelve symlinks antes de servir: un enlace simbólico dentro de apps/web que
    // apunte afuera no debe poder saltarse el chequeo de arriba.
    const rutaReal = await realpath(rutaAbsoluta);
    const relativaReal = path.relative(RAIZ, rutaReal);
    if (relativaReal.startsWith('..') || path.isAbsolute(relativaReal)) {
      res.writeHead(403).end('Prohibido');
      return;
    }

    const contenido = await readFile(rutaReal);
    res.writeHead(200, {
      'Content-Type': TIPOS_MIME[path.extname(rutaReal)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(contenido);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
});

// Solo loopback: sin esto, el sitio de desarrollo queda expuesto a cualquiera en la misma red
// (p. ej. la red de la universidad) mientras corre `npm run dev` (auditoría de Fase 6).
servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Proxi web (desarrollo) escuchando en http://localhost:${PUERTO}`);
});
