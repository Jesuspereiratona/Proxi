# Plan · Logo de empresa

## Lo que ya existe y no se toca

`docs/02-modelo-de-datos.md` definió la tabla `archivos` con `tipo CHECK ('cv','logo')` desde la Fase
4. **La mitad `logo` nunca se usó.** No hay tabla nueva que crear: hay una columna `tipo` esperando su
segundo valor desde hace un mes.

También se reutiliza tal cual:
- El patrón de validación por número mágico de `archivos.service.js` (hoy verifica `%PDF-`).
- `nombreArchivoSeguro()`, que ya sanea el nombre que manda el navegador.
- El límite de tamaño de multer y el manejo de `entity.too.large` → 422 del manejador de errores.
- `CAMPOS_IDENTIDAD` de `empresas.service.js`: el logo **no** entra ahí, a propósito (ver más abajo).

## Decisión 1 · Dónde se guardan los bytes

**En la base de datos, en una columna `bytea`.** No en disco.

El motivo es de despliegue, decidido el 2026-09-20: la plataforma donde va a vivir Proxi borra el
disco en cada reinicio. Un logo en disco desaparecería en el primer despliegue. Meter un servicio de
almacenamiento externo (S3, R2, Supabase Storage) resolvería lo mismo, pero suma una empresa más que
tiene nuestros datos —con el contrato y el registro de tratamiento que eso implica— y un servicio más
que mantener, para guardar imágenes de 200 KB.

Tamaño real: 512 KB por logo, una empresa por logo. Cien empresas son 50 MB en el peor caso y mucho
menos en la práctica. No es un problema a esta escala.

La columna se agrega a `archivos` y sirve también para migrar los CV más adelante (tarea aparte, ya
decidida): una sola migración, dos usos.

## Decisión 2 · El logo se aprueba antes de verse en público

**Es la decisión con alternativas reales de esta spec.**

La vitrina es la cara pública de una herramienta de la universidad. Un logo lo sube un tercero y
aparece ahí sin que nadie lo mire. Los dos extremos:

- **Sin moderación**: una empresa validada cambia su logo por cualquier imagen y sale al instante en
  la página pública de la FEN. Barato de programar, y el día que pase es un problema de la
  universidad, no de la empresa.
- **Tratar el logo como campo de identidad** (meterlo en `CAMPOS_IDENTIDAD`): cambiar el logo
  devolvería la empresa a `pendiente` **y cerraría todas sus ofertas publicadas**, que es lo que hace
  hoy ese camino. Desproporcionado: una empresa que actualiza su marca perdería sus ofertas.

**Se elige el medio**: el logo tiene su propia aprobación, de una sola acción, que no toca el estado
de la empresa ni sus ofertas. Cuesta una columna y un endpoint, y evita los dos extremos.

No es un ADR porque no cambia la arquitectura: es una regla de negocio acotada a un archivo.

## Modelo de datos

### Migración 1 — `archivos.contenido`
```
ALTER TABLE archivos ADD COLUMN contenido BYTEA;
```
Nullable a propósito: las filas de CV existentes no tienen bytes en la base (siguen en disco) y esta
migración no los mueve. El `down` la elimina.

### Migración 2 — aprobación del logo
```
ALTER TABLE archivos ADD COLUMN aprobado_at TIMESTAMPTZ;
ALTER TABLE archivos ADD COLUMN aprobado_por_usuario_id BIGINT REFERENCES usuarios(id);
ALTER TABLE archivos ADD COLUMN retirado_at TIMESTAMPTZ;
```
Tres timestamps en vez de una columna `estado` de texto: el estado se deduce
(`retirado_at` → retirado; si no, `aprobado_at` → aprobado; si no, pendiente) y además queda
registrado **cuándo** y **quién**, que es lo que un retiro por contenido inapropiado necesita poder
demostrar. La regla 7 de la spec exige justamente eso.

Índice parcial para la consulta que corre en cada carga de la vitrina:
```
CREATE INDEX archivos_logo_vigente ON archivos (propietario_usuario_id)
  WHERE tipo = 'logo' AND aprobado_at IS NOT NULL AND retirado_at IS NULL;
```

## Endpoints

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| `POST` | `/api/v1/empresas/mi-empresa/logo` | empresa | Sube o reemplaza. Queda pendiente |
| `DELETE` | `/api/v1/empresas/mi-empresa/logo` | empresa | Quita su propio logo |
| `GET` | `/api/v1/empresas/:id/logo` | público | Sirve los bytes. 404 si no hay logo vigente o la empresa no está validada |
| `GET` | `/api/v1/logos/pendientes` | coordinación | Los que esperan aprobación |
| `POST` | `/api/v1/logos/:id/aprobacion` | coordinación | Aprueba |
| `DELETE` | `/api/v1/logos/:id` | coordinación | Retira uno aprobado |

`mi-empresa` y no `:id` en los dos primeros: es el mismo patrón que ya usa `mi-cuenta`, y hace
imposible por construcción tocar el logo de otra empresa (regla 3 de la spec).

El listado público de ofertas y el perfil público de empresa suman un campo `logoUrl`, presente solo
cuando hay un logo vigente. El cliente no tiene que adivinar si existe: si no está el campo, pinta la
inicial.

## Seguridad — lo que hay que hacer bien

1. **Validación por contenido.** Firmas: PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`.
   El `mimetype` que manda el navegador se ignora por completo; el que se guarda se deriva de la
   firma encontrada.
2. **SVG rechazado explícitamente**, con su propio mensaje. Es la única imagen que es un documento
   ejecutable, y servirla desde nuestro dominio sería XSS almacenado en la página más pública. Al
   validar por firma queda fuera solo, pero el mensaje se escribe igual: quien lo intente merece
   saber por qué, y quien lea el código en un año merece ver que fue deliberado.
3. **Al servir**: `Content-Type` derivado de la firma guardada, nunca del nombre.
   `X-Content-Type-Options: nosniff` ya lo pone helmet globalmente — se verifica, no se asume.
   `Content-Disposition: inline` sin nombre de archivo.
4. **Sin sesión, pero con filtro de estado**: la consulta trae el logo *y* exige
   `empresas.estado_validacion = 'validada'`, en la misma consulta. No dos consultas encadenadas que
   alguien pueda separar después por error.
5. **Caché**: `Cache-Control: public, max-age=3600`. La vitrina pide un logo por fila; sin caché, cada
   recarga son N consultas a la base. Es público y aprobado: no hay nada que proteger de una caché.
   Un logo retirado puede seguir viéndose hasta una hora en un navegador que ya lo tenía — se acepta
   y se anota, porque el alternativo (sin caché) pega en cada carga de la página principal.
6. **Límite de tasa** en la subida, reutilizando el middleware que ya existe.
7. **Borrado de cuenta**: `cuenta.service.js` ya recorre los archivos del usuario. Al estar los bytes
   en la base, el borrado pasa a ser parte de la transacción en vez de un `fs.unlink` que —como dice
   el comentario que ya está en ese archivo— no participa del rollback. Es una mejora, no una deuda.

## Capas

Sin excepciones a `docs/01-arquitectura.md`:
- `routes/empresas.routes.js` y `routes/logos.routes.js` — multer + `autenticar` + `autorizar`.
- `controllers/logos.controller.js` — arma la respuesta, fija encabezados. No consulta la base.
- `services/archivos/logos.service.js` — validación de firma, reemplazo, aprobación, retiro. No
  conoce `req` ni `res`.
- `models/Archivo.js` — las columnas nuevas.

## Cliente

- `tarjeta-oferta.js` y `empresa.js`: si viene `logoUrl`, un `<img>`; si no, la inicial de hoy. El
  `<img>` lleva `alt=""` y `aria-hidden` porque la razón social ya está escrita al lado: anunciarlo
  sería repetir la misma palabra a quien usa lector de pantalla.
- `panel-empresa.html`: subida, vista previa y el aviso de que espera aprobación.
- `panel-coordinacion.html`: sección de logos pendientes, con la imagen visible — aprobar a ciegas
  sería exactamente el hallazgo que la auditoría de Fase 6 ya corrigió una vez.
- `uah-theme.css`: `.oferta-logo img { object-fit: contain }`, para que un logo apaisado no se
  deforme dentro del cuadrado.
