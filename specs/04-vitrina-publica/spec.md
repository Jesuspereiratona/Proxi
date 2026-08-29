# Spec · Vitrina pública

- **Estado:** implementada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** Fase 6

## Problema
La API de las Fases 3–5 ya puede listar ofertas vigentes, mostrar el detalle de una y exponer los
indicadores de una empresa. Hoy nadie puede verlo: no existe ninguna pantalla. Un estudiante sin
sesión — el caso de uso más frecuente del proyecto, según `docs/00-vision-y-alcance.md` — no tiene
forma de buscar dónde postular.

## Quién la usa
Cualquier persona sin sesión iniciada: estudiantes buscando dónde postular, y cualquiera
verificando el historial de una empresa antes de postular ahí. No requiere rol ni login.

## Comportamiento esperado
- Una portada lista las ofertas **vigentes** (publicadas, con fecha de cierre futura) con
  filtros por área, modalidad, comuna y si es remunerada.
- Cada tarjeta de oferta muestra: título, empresa, modalidad, comuna (si no es remota), si es
  remunerada, y cuánto falta para el cierre — en lenguaje humano, nunca una fecha ISO cruda.
- El detalle de una oferta agrega descripción completa, requisitos, y un enlace al perfil público
  de la empresa.
- El perfil público de una empresa muestra sus datos de contacto y, si tiene historial suficiente
  (`suficienteHistorial: true` de `GET /empresas/:id/indicadores`), sus cuatro indicadores. Si no,
  un mensaje que explica por qué no hay cifras todavía — nunca una sección vacía sin explicación.
- Todo texto de error o de estado vacío está en lenguaje humano. `OFERTA_NO_VIGENTE` es un código
  interno; a quien mira la pantalla se le dice "esta oferta ya cerró", no el código.
- El estado de vigencia de una oferta se distingue **de un vistazo**, sin tener que leer el texto:
  color e ícono, según `docs/08-guia-visual.md`.

## Reglas que no se pueden romper
1. La vitrina nunca muestra una oferta que no esté `publicada` y vigente — la API pública ya lo
   garantiza (`ofertas.service.listarPublicas`/`obtenerDetalle`), la pantalla no debe intentar
   mostrar nada que la API no devuelva.
2. Ningún código de error interno (`OFERTA_NO_VIGENTE`, `PERFIL_NO_ENCONTRADO`, etc.) llega a la
   pantalla sin traducirse primero.
3. Ningún indicador de empresa se muestra si la API respondió `suficienteHistorial: false` — la
   pantalla no debe inventar un cero ni ocultar el campo en silencio, tiene que explicar por qué.
4. Toda información de estado se comunica con texto, nunca solo con color (accesibilidad —
   `docs/06-roadmap.md`).

## Casos borde
- Ningún filtro produce resultados → mensaje explícito ("no hay ofertas con esos filtros ahora
  mismo"), nunca una tabla vacía sin contexto.
- Una oferta que estaba vigente cierra justo mientras el estudiante la tiene abierta en el detalle
  → al intentar cualquier acción downstream (esto lo maneja Fase 6 completa cuando llegue el panel
  de estudiante; en la vitrina pública alcanza con no romper si `GET /ofertas/:id` empieza a
  devolver 404 en un refresco).
- Una oferta cierra "hoy" (fecha de cierre es hoy pero todavía no pasó la hora exacta) → sigue
  vigente y se muestra como tal; el texto dice "cierra hoy", no "cierra en 0 días".
- Una empresa con exactamente 3 ofertas cerradas → sí muestra indicadores (el umbral es "3 o más").
- Un `GET /empresas/:id/indicadores` a un id que no existe → la pantalla de perfil de empresa
  muestra "esta empresa no existe" y un enlace de vuelta a la vitrina, no una pantalla en blanco.
- JavaScript deshabilitado o `fetch` falla por red → la página no debe quedar en blanco sin
  explicación; un mensaje de error visible basta para esta fase (no se exige funcionar sin JS).

## Criterios de aceptación
- [ ] Dado que hay ofertas vigentes, cuando se abre la vitrina, entonces se listan solo las
      `publicada` con `fechaCierre` futura.
- [ ] Dado un filtro por área/modalidad/comuna/remunerada, cuando se aplica, entonces la lista se
      actualiza usando los parámetros de consulta que ya acepta `GET /ofertas`.
- [ ] Dado que ningún filtro produce resultados, cuando se aplican, entonces se muestra un mensaje
      explícito, no una lista vacía sin contexto.
- [ ] Dado una oferta que cierra en 2 días, cuando se muestra su tarjeta, entonces el texto dice
      "cierra en 2 días" con un color/ícono de urgencia distinto al de una oferta con más tiempo.
- [ ] Dado una oferta que cierra hoy, cuando se muestra su tarjeta, entonces el texto dice "cierra
      hoy", no "cierra en 0 días".
- [ ] Dado el detalle de una oferta, cuando se abre, entonces muestra descripción, requisitos, y un
      enlace al perfil público de la empresa.
- [ ] Dado una empresa con `suficienteHistorial: true`, cuando se ve su perfil público, entonces se
      muestran sus cuatro indicadores con el texto explicativo de qué significa cada uno.
- [ ] Dado una empresa con `suficienteHistorial: false`, cuando se ve su perfil, entonces se
      muestra un mensaje que explica por qué no hay indicadores todavía, no una sección vacía.
- [ ] Dado un id de empresa que no existe, cuando se intenta ver su perfil, entonces se muestra un
      mensaje de "no existe" con un enlace de vuelta, no una pantalla rota.
- [ ] Dado cualquier error de la API (4xx/5xx), cuando ocurre, entonces el texto que ve la persona
      está en lenguaje humano, nunca el código interno crudo.
- [ ] Dado un teclado sin mouse, cuando se navega la vitrina, entonces todos los filtros, tarjetas y
      enlaces son alcanzables y el foco es visible en todo momento.

## Fuera de alcance
- Los paneles autenticados (estudiante, empresa, coordinación) — Fase 6 los cubre después de la
  vitrina, con specs propias si el comportamiento lo amerita (la mayoría es CRUD sobre endpoints ya
  probados, sin reglas nuevas que especificar).
- Postular desde la vitrina — requiere sesión, vive en el panel de estudiante.
- Cualquier funcionalidad de búsqueda por texto libre — los filtros de `GET /ofertas` son
  estructurados (área, modalidad, comuna, remunerada), no hay búsqueda de texto en la API.
