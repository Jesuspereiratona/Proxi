# Plan técnico · Vitrina pública

## Decisión de arquitectura: módulos ES nativos en `apps/web`
`CLAUDE.md` dice "CommonJS, no mezclar con ESM" pensando en `apps/api` (Node). Un navegador no
puede ejecutar `require()`/`module.exports` sin un bundler, y el proyecto no quiere paso de build
(`docs/01-arquitectura.md`, "qué NO se hace en la v1"). `apps/web` usa `<script type="module">`
con `import`/`export` reales — todo navegador moderno lo soporta nativo, sin ninguna herramienta —
y `apps/api` sigue en CommonJS puro. Son dos runtimes que solo se hablan por HTTP
(`docs/01-arquitectura.md`), así que no hay mezcla real: nunca un `import` de `apps/web` toca un
`require` de `apps/api`. Decisión y motivo van a `docs/decisiones/bitacora.md`.

## Estructura de archivos
Seguí `docs/01-arquitectura.md` al pie. Las páginas públicas (sin sesión) viven en la raíz de
`web/`; `paginas/` queda reservado para los paneles autenticados que llegan después en la misma
Fase 6.

```
apps/web/
├── package.json          "type": "module", script "dev" (servidor estático propio, sin dependencia nueva)
├── index.html             Vitrina: filtros + listado de ofertas vigentes
├── oferta.html             Detalle de una oferta (?id=)
├── empresa.html            Perfil público de una empresa (?id=)
├── scripts/servidor-dev.js Servidor estático mínimo (http + fs de Node, cero dependencias)
├── assets/css/uah-theme.css   Tokens de docs/08-guia-visual.md sobre Bootstrap (CDN, sin build)
├── assets/js/
│   ├── config.js               window fijo con la URL base de la API (editable a mano por ahora)
│   ├── api/cliente.js           fetch central: arma la URL, traduce errores de la API a mensajes humanos
│   ├── api/ofertas.js           listarPublicas(filtros), obtenerDetalle(id)
│   ├── api/empresas.js          obtenerIndicadores(id)
│   ├── componentes/estado-oferta.js   pura: fechaCierre + ahora -> {texto, clase, urgente}
│   ├── componentes/tarjeta-oferta.js  arma el DOM de una tarjeta (textContent, nunca innerHTML)
│   └── paginas/vitrina.js, oferta.js, empresa.js   controlador de cada página
└── tests/estado-oferta.test.js, cliente.test.js    node --test sobre las funciones puras
```

Bootstrap 5 y Bootstrap Icons se cargan por CDN (`cdn.jsdelivr.net`, ya en la lista blanca del
proyecto para artefactos; para `apps/web` no hay CSP propia todavía — se documenta como pendiente
de Fase 8 si el hosting la exige). Sin dependencia nueva de npm: nada se instala para `apps/web`.

## Cliente HTTP central (`assets/js/api/cliente.js`)
Un único punto que llama `fetch`, igual que exige `docs/01-arquitectura.md` ("nadie llama fetch
fuera de aquí"). Arma la URL con `config.js`, y traduce la respuesta de error del formato
`{error:{codigo,mensaje}}` (`docs/04-manejo-de-errores.md`) a un mensaje en español para la
persona, con un mapa de códigos conocidos y un mensaje genérico para el resto:

| Código de la API | Mensaje humano |
|---|---|
| `OFERTA_NO_ENCONTRADA`, `OFERTA_NO_VIGENTE` | "Esta oferta ya no está disponible." |
| `PERFIL_NO_ENCONTRADO` | "Esa empresa no existe." |
| `VALIDACION_ENTRADA` | "Revisa los filtros e intenta de nuevo." |
| `DEMASIADAS_SOLICITUDES` | "Demasiadas solicitudes. Espera un momento e intenta de nuevo." |
| Cualquier otro / error de red | "Ocurrió un problema. Intenta de nuevo en un momento." |

## `estado-oferta.js` — el corazón visual de la fase
Función pura `calcularEstado(fechaCierre, ahora = new Date())`:
- Vencida (no debería llegar de la API pública, pero la función es defensiva): `{texto:'Vencida',
  clase:'vencida'}`.
- Cierra hoy (mismo día calendario que `ahora`, comparando año/mes/día, no restando milisegundos —
  evita el bug de "cierra en 0 días" cuando faltan solo unas horas): `{texto:'Cierra hoy',
  clase:'urgente', urgente:true}`.
- Cierra en ≤ `UMBRAL_URGENTE_DIAS` días (constante del módulo, 3): `{texto:'Cierra en N días',
  clase:'urgente', urgente:true}`.
- Resto: `{texto:'Cierra el DD de mes', clase:'normal', urgente:false}`.

## Adición de backend descubierta al planificar el frontend
Ninguna fase anterior expone el perfil público de una empresa (razón social, comuna, sitio web) —
Fase 5 solo expone sus indicadores. Se agrega `GET /api/v1/empresas/:id` (público, sin
autenticar), mismo patrón que `indicadoresService.obtenerPublico`: solo responde para una empresa
`estadoValidacion:'validada'` (404 para cualquier otra, igual que un id inexistente — no se
confirma qué empresas registradas no son públicas), y una lista blanca explícita de campos
(`razonSocial`, `giro`, `sitioWeb`, `comuna`) — nunca `rutEmpresa`, `contactoNombre`,
`contactoCargo`, `motivoRechazo` ni `motivoSuspension`, que son datos de gestión interna de
coordinación, no del perfil público.

De paso, `ofertas.service.js listarPublicas`/`obtenerDetalle` agregan un `include` de `Empresa`
(`attributes: ['razonSocial']`) para que la tarjeta y el detalle de una oferta puedan mostrar quién
la publica sin una segunda llamada — la tarjeta lo necesita según `spec.md`.

## Perfil público de empresa
`empresa.js` llama `GET /empresas/:id/indicadores`. Si `suficienteHistorial` es `false`, muestra un
texto fijo explicando el porqué ("Todavía no tiene suficiente historial de ofertas cerradas para
mostrar indicadores"), nunca una sección vacía. Si es `true`, cada indicador se muestra con su
etiqueta explicada (p. ej. "Responde al 67% de las postulaciones que recibe", no solo "67%").

## Pruebas
`apps/web/package.json` agrega un script `test` (`node --test`), que el `npm test` raíz ya
recoge (`--workspaces --if-present`). Sin DOM ni dependencia de testing nueva: se prueban las
funciones puras (`estado-oferta.js`, el mapa de traducción de errores de `cliente.js`), no el
renderizado. El `<script type="module">` del navegador y el `import` de Node son el mismo
JavaScript — no hace falta transformar nada para probarlo con `node --test`.

## Riesgos
- Sin CSP propia para `apps/web` todavía: el `helmet()` de Fase 0 protege la API, no el HTML
  estático. Se revisita en Fase 8 según qué exija el hosting.
- El servidor estático de desarrollo (`scripts/servidor-dev.js`) es solo para `npm run dev`, nunca
  para producción — Fase 8 decide cómo se sirve `apps/web` en el hosting real (puede ser un CDN de
  archivos estáticos, no necesariamente este script).
