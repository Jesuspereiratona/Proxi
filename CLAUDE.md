# CLAUDE.md — Proxi

## El proyecto
Plataforma donde empresas publican ofertas de práctica y estudiantes de la FEN UAH postulan.
Diferencia central: **ninguna oferta queda publicada sin vigencia ni ninguna postulación queda sin respuesta.**

Stack: Node 20 LTS + Express 5 (API REST) / PostgreSQL 15 + Sequelize (ORM) / HTML+CSS+Bootstrap+JS vanilla (web, consume la API con fetch) / JWT para auth.
Módulos **CommonJS** (`require` / `module.exports`), igual que el resto de tus proyectos. No mezclar con ESM.
Correr: `npm run dev -w apps/api` y `npm run dev -w apps/web`. Probar: `npm test`. DB local: `docker compose up db`.

## Arquitectura (no reexplicar, solo referenciar)
Monorepo con workspaces. `apps/api` (backend REST), `apps/web` (cliente), `packages/*` (código compartido), `db/` (migraciones y seeds).
Capas de la API, en un solo sentido: **routes → middlewares → controllers → services → repositories/models**.
- Un controller NO consulta la base de datos.
- Un service NO conoce `req` ni `res`.
- Toda regla de negocio vive en `services/`.
Detalle en `docs/01-arquitectura.md`. Modelo de datos en `docs/02-modelo-de-datos.md`.

## Reglas duras del dominio
- Toda oferta tiene `fecha_cierre` obligatoria. No existe oferta publicada sin vigencia.
- Cerrar una oferta exige `motivo_cierre`. Sin eso la empresa no publica una nueva.
- Toda postulación termina en un estado terminal. El silencio es un estado explícito (`sin_respuesta`), no un vacío.
- Los estados cambian solo por las transiciones definidas en `services/*/estados.js`. Nada de `update({estado})` suelto.
- Datos personales de estudiantes (CV, RUT, correo): minimización, retención definida y borrado. Ver `docs/03-seguridad.md`.
- Nunca se registra en logs: contraseñas, tokens, RUT, correo, contenido de CV.
- Contraseñas: bcrypt (cost >= 12). Nunca MD5/SHA sin sal.
- Fechas: siempre `timestamptz` en UTC en la DB; se formatean en la capa de presentación.

## Convenciones
- Español para dominio y docs, inglés para palabras clave del lenguaje. `snake_case` en DB, `camelCase` en JS, plural y sin verbos en las rutas URL.
- Archivos con la convención que ya usas: `<recurso>.<capa>.js` → `ofertas.controller.js`, `ofertas.service.js`, `ofertas.routes.js`, `auth.middleware.js`. Modelos en PascalCase singular: `Oferta.js`.
- Rutas: `/api/v1/ofertas`, `/api/v1/postulaciones`. Plural, sin verbos.
- Errores: se lanzan clases de `apps/api/src/errors/`, nunca `res.status(500).json(...)` improvisado. Un solo `errorHandler` responde.
- Toda respuesta de error: `{ error: { codigo, mensaje, detalles? } }`. `codigo` es estable y documentado.
- Commits: `tipo(alcance): mensaje` (feat, fix, docs, refactor, test, chore).

## Cómo respondes
Sin preámbulo. Código primero; explicación en máx. 3 renglones y solo si el porqué no es obvio.
Edita, no reescribas: muéstrame solo las líneas que cambian, con 2 de contexto.
Ante un error: causa en una línea, arreglo abajo.
Si no lo puedes verificar, dilo con esas palabras en vez de asumir.

## Antes de decir "listo"
- Corre las pruebas relevantes y pega la salida real si algo falla.
- Si el cambio toca auth, permisos, datos personales o transiciones de estado, dilo explícitamente aunque no se pregunte.
- Si el cambio tomó una decisión no obvia, anótala en `docs/decisiones/bitacora.md`.

Lo que pida en el chat gana sobre este archivo.
