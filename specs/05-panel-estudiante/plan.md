# Plan técnico · Panel de estudiante

## Backend: una pieza que faltaba
Ninguna ruta expone `postulacion_eventos` todavía — necesario para "línea de tiempo de estados".
`postulaciones.service.js obtenerDetalle` (las tres ramas: coordinación, estudiante propio, empresa
propia) agrega `include: [{ model: PostulacionEvento, order: [['createdAt', 'ASC']] }]` a sus
tres consultas. Mismo patrón que el `include` de `Empresa` que ya se agregó a `ofertas.service.js`
en la primera entrega de Fase 6 — una línea por consulta, sin nueva ruta.

Ningún código nuevo de reglas: es lectura de datos que el servicio ya escribe desde Fase 4.

## Dos piezas técnicas nuevas en el cliente

### 1. `enviarFormData` — subir el CV es `multipart/form-data`, no JSON
`cliente.js` hoy siempre serializa el cuerpo con `JSON.stringify` y fija
`Content-Type: application/json`. Subir un archivo necesita mandar un `FormData` sin ese header
(el navegador arma el `boundary` solo; fijarlo a mano rompe el parseo). Se agrega una función
paralela a `enviar`, no una rama con `if` dentro de `peticion`: `enviarFormData(ruta, formData)`
hace `fetch` directo con `Authorization` pero sin `Content-Type` ni `JSON.stringify`, y reusa
`cuerpoDeError`/`refrescarSesion` — mismo manejo de 401 con reintento que el resto.

### 2. `descargarArchivo` — un `<a href>` no puede llevar `Authorization`
Un enlace HTML no manda encabezados. Para descargar el CV con sesión, `cliente.js` agrega
`descargarArchivo(id)`: hace `fetch(.../archivos/:id/descarga, {headers:{Authorization}})`, lee la
respuesta como `blob()`, arma un `URL.createObjectURL(blob)` y dispara la descarga con un `<a>`
temporal (`download` con el nombre real, tomado de la cabecera `Content-Disposition` si el
navegador la expone, si no un nombre genérico). Se revoca el object URL después
(`URL.revokeObjectURL`) para no acumular memoria en una sesión larga.

## Estructura de archivos
```
apps/web/
├── panel-estudiante.html          Perfil + CV (una sola pantalla: crear o editar según exista perfil)
├── postulaciones.html              Mis postulaciones (lista) + línea de tiempo (detalle inline)
├── assets/js/
│   ├── api/estudiantes.js          obtenerPerfil, crearPerfil, actualizarPerfil, subirCv
│   ├── api/postulaciones.js        listarMias, obtenerDetalle, postular, retirar
│   ├── componentes/proteger-pagina.js   guardián de sesión + rol, reusado por los tres paneles
│   ├── componentes/linea-tiempo.js      arma el DOM de la línea de tiempo desde los eventos
│   ├── paginas/panel-estudiante.js
│   └── paginas/postulaciones.js
└── oferta.html / paginas/oferta.js   se les agrega el botón "Postular" condicional a la sesión
```

`proteger-pagina.js`: `await protegerPagina('estudiante')` al principio de cada página del panel —
llama `iniciarSesion()`; si falla, redirige a `login.html`; si el rol de la sesión no es el
esperado, redirige a `index.html` (no hay una pantalla de "no autorizado" todavía, y no vale la
pena una para este alcance). Se construye ahora porque los tres paneles la van a reusar tal cual.

## Errores nuevos en el mapa de `cliente.js`
`POSTULACION_SIN_CV`, `POSTULACION_YA_EXISTE`, `POSTULACION_TRANSICION_INVALIDA`, `ARCHIVO_INVALIDO`
— los cuatro ya existen en el catálogo de la API (Fase 4), solo faltaba su traducción en el cliente.

## Pruebas
- `linea-tiempo.js` y el helper de traducción de estado a texto humano: funciones puras, con
  `node --test` igual que `estado-oferta.js`.
- `enviarFormData`/`descargarArchivo`: con `fetch` mockeado, mismo patrón que las pruebas de sesión
  — confirmar que no fijan `Content-Type` en el primero y que el segundo arma la URL de blob y la
  revoca.
- Smoke test real con Chrome headless contra la API real: perfil (crear y editar), subir un PDF
  real, postular, ver la línea de tiempo, retirar. Datos inventados, limpiados después.

## Riesgos
- El botón "Postular" en `oferta.html` necesita saber el rol de la sesión sin duplicar lógica de
  `proteger-pagina.js`: esa página es pública (no exige sesión para verse), así que llama a
  `iniciarSesion()` de forma no bloqueante — si hay sesión de estudiante, muestra el botón; si no,
  el enlace a login; ningún otro rol ve ninguno de los dos.
- Ninguno nuevo del lado de datos personales: el CV sigue el mismo camino ya auditado en Fase 4,
  solo cambia quién lo pide (el cliente web en vez de `curl`).
