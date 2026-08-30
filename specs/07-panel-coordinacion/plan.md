# Plan técnico · Panel de coordinación

## Backend: una pieza nueva, una ampliada
- **Nuevo** `GET /empresas` (coordinación): `empresasService.listarTodas()` — `Empresa.findAll()`
  sin filtro, todos los campos (solo lo llama coordinación, mismo criterio que `listarIndicadores`).
  Hace falta porque `listarPendientes()` (ya existe) solo trae `pendiente`; para suspender hay que
  encontrar antes una `validada`.
- **Ampliado** `listarPendientesRevision()` (`ofertas.service.js`): agrega
  `include: [{ model: Empresa, attributes: ['razonSocial'] }]` — hoy no dice de qué empresa es cada
  oferta, coordinación no podría decidir nada con eso.

## Frontend: una sola pantalla, tres secciones
Menos superficie que empresa/estudiante (sin formularios de creación, solo listar + accionar), así
que va en un archivo, no tres:
```
apps/web/
├── panel-coordinacion.html
├── assets/js/
│   ├── api/empresas.js       (extender) listarTodas, validar, rechazar, suspender
│   ├── api/ofertas.js        (extender) listarPendientesRevision, aprobar, rechazar
│   └── paginas/panel-coordinacion.js
```
Motivo de rechazo/suspensión por `prompt()`, mismo patrón ya usado en `postulantes.js` — acá sí es
obligatorio (a diferencia del rechazo de una postulación): si el `prompt()` vuelve vacío o cancelado,
no se manda la petición.

`protegerPagina('coordinacion')` tal cual, sin cambios.

## Pruebas
- Backend: `listarTodas` no necesita prueba propia (es un `findAll()` sin lógica); la prueba nueva
  es que `listarPendientesRevision` incluye la razón social.
- Sin funciones puras nuevas del lado del cliente — es listar y accionar, sin cálculo que valga la
  pena aislar.
- Smoke test con Chrome headless + curl para armar el estado de prueba: empresa pendiente, oferta
  en revisión, ver las tres secciones, aprobar una oferta, validar una empresa.

## Riesgos
Ninguno de datos personales (regla 3 de la spec) — todos los endpoints ya estaban probados con sus
pruebas de acceso desde las Fases 2, 3 y 5.
