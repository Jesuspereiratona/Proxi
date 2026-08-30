# Plan técnico · Panel de empresa

## Backend: nada nuevo
Primera vez en Fase 6 que un panel no le agrega ni una línea a la API. Todo lo que este panel
necesita ya existe y está probado desde las Fases 2 a 4:
`GET/POST/PATCH /empresas/perfil`, `GET /ofertas/mias`, `POST /ofertas`, `PATCH /ofertas/:id`,
`POST /ofertas/:id/{revision,cierre}`, `GET /postulaciones/oferta/:id`,
`POST /postulaciones/:id/{revision,entrevista,seleccion,rechazo}`.

## Estructura de archivos
```
apps/web/
├── panel-empresa.html              Perfil de empresa (crear/editar) + estado de validación
├── mis-ofertas.html                Lista de ofertas propias + crear/editar + enviar a revisión + cerrar
├── postulantes.html                Postulantes de una oferta (?ofertaId=) + transiciones + línea de tiempo
├── assets/js/
│   ├── api/empresas.js             (extender) obtenerPropio, crearPerfil, actualizarPerfil — ya
│   │                                tiene obtenerPerfilPublico/obtenerIndicadores de Fase 6 parte 1
│   ├── api/ofertas.js              (extender) listarMias, crear, editar, enviarARevision, cerrar
│   │                                — ya tiene listarPublicas/obtenerDetalle de la vitrina
│   ├── api/postulaciones.js        (extender) listarDeOferta, marcarEnRevision, marcarEntrevista,
│   │                                seleccionar, rechazar — ya tiene el lado estudiante
│   ├── paginas/panel-empresa.js
│   ├── paginas/mis-ofertas.js
│   └── paginas/postulantes.js
```
Un archivo por recurso ya existente se extiende, no se duplica (`api/empresas.js`, `api/ofertas.js`,
`api/postulaciones.js` ya existen desde vitrina/panel-estudiante). `proteger-pagina.js` se reusa tal
cual con `'empresa'`.

## Piezas de comportamiento nuevas en el cliente

### Advertencia antes de una reversión, no después
Dos acciones ya conocidas por la API revierten estado sin que el formulario lo anticipe hoy:
cambiar `razonSocial` o `rutEmpresa` de una empresa `validada` (vuelve a `pendiente`, cierra ofertas
en cascada — `CAMPOS_IDENTIDAD` de `empresas.service.js`) y editar el contenido de una oferta
`publicada` (vuelve a `borrador`). Ambos formularios comparan el valor nuevo contra el que trajo
`GET` al cargar la pantalla; si cambió y el estado actual es el que gatilla la reversión, se muestra
una confirmación explícita antes de enviar el `PATCH`. No es una regla de negocio nueva — la API ya
la aplica igual sin el aviso — es una sola comparación en el cliente para no sorprender a nadie.

### Botones de transición según el estado, no una lista fija
`mis-ofertas.js` y `postulantes.js` arman qué botones mostrar a partir del `estado` que devuelve la
API para cada fila, con una tabla local de "de qué estado a qué estado" que **refleja** —no
reimplementa— `services/ofertas/estados.js` y `services/postulaciones/estados.js`. Si el backend
rechaza igual una transición que el cliente ofreció (carrera entre pestañas), el 409 ya conocido
(`OFERTA_TRANSICION_INVALIDA`/`POSTULACION_TRANSICION_INVALIDA`) se traduce y no rompe la pantalla.

### Formulario de oferta: un componente, dos modos
Crear y editar una oferta comparten el mismo formulario (mismos campos: título, descripción,
requisitos, área, modalidad, jornada, comuna, remunerada, monto, cupos, fecha de cierre). Un mismo
archivo (`mis-ofertas.js`) decide `POST` o `PATCH` según si ya existe `id` — mismo patrón que
`panel-estudiante.js` decidiendo crear vs. editar perfil.

## Mensajes nuevos en el mapa de `cliente.js`
`EMPRESA_NO_VALIDADA`, `EMPRESA_TRANSICION_INVALIDA`, `EMPRESA_RUT_YA_REGISTRADO`,
`EMPRESA_CIERRES_PENDIENTES`, `OFERTA_SIN_FECHA_CIERRE`, `OFERTA_FECHA_CIERRE_INVALIDA`,
`OFERTA_TRANSICION_INVALIDA`, `OFERTA_CAMPO_NO_EDITABLE` — todos ya existen en el catálogo de la
API desde Fases 2 y 3; el panel de empresa es el primer cliente que puede provocarlos.

## Pruebas
- Funciones puras nuevas (tabla de transiciones válidas para pintar botones, si aplica como función
  aislada) con `node --test`, mismo patrón que `estado-oferta.js`/`linea-tiempo.js`.
- Extensiones de `api/*.js`: son wrappers de una línea sobre `obtenerAutenticado`/`enviar` ya
  probados — no repiten esas pruebas, solo se agregan si arman algo propio (p. ej. armar el query
  string de `ofertaId`).
- Smoke test real con Chrome headless contra la API real: crear perfil de empresa, crear oferta,
  editarla, enviarla a revisión (queda pendiente de aprobación de coordinación, que no existe en
  este panel — se aprueba por API para completar el flujo de prueba), publicarla, cerrarla con
  motivo, ver un postulante y transicionarlo. Datos inventados, limpiados después.

## Riesgos
- Aprobar una oferta es de coordinación (Fase 6 siguiente, todavía sin panel): el smoke test de
  este panel necesita una aprobación por API para poder probar "publicada" y "postulantes" de
  punta a punta — no es una limitación del panel, es orden de las fases.
- Ninguno nuevo del lado de datos personales: el CV de un postulante sigue el mismo camino ya
  auditado en Fase 4 (`descargarArchivo`, ya construido en el panel de estudiante), solo cambia
  quién lo pide.
