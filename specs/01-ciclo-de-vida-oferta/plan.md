# Plan técnico · Ciclo de vida de una oferta

## Modelo de datos
Migración `crear-ofertas`: tabla `ofertas` según `docs/02-modelo-de-datos.md`, con
`fecha_cierre timestamptz NOT NULL` y los tres CHECK. Índice `(estado, fecha_cierre)` para la vitrina.

Migración `crear-oferta-eventos`: tabla append-only, índice por `oferta_id`.

Migración `agregar-resultado-declarado`: `resultado_declarado boolean NOT NULL DEFAULT false`.

Todas con `up` y `down`.

## Endpoints
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/v1/ofertas` | público | Solo publicadas y vigentes. Filtros: `area`, `modalidad`, `comuna`, `remunerada`. Paginado |
| GET | `/api/v1/ofertas/:id` | público | Detalle. Si no está publicada, solo su dueña o coordinación |
| POST | `/api/v1/ofertas` | empresa | Crea borrador |
| PATCH | `/api/v1/ofertas/:id` | empresa | Edita. Campos permitidos según estado |
| GET | `/api/v1/ofertas/mias` | empresa | Todas sus ofertas, cualquier estado |
| POST | `/api/v1/ofertas/:id/revision` | empresa | Borrador → en revisión |
| POST | `/api/v1/ofertas/:id/aprobacion` | coordinación | En revisión → publicada |
| POST | `/api/v1/ofertas/:id/rechazo` | coordinación | En revisión → borrador, exige motivo |
| POST | `/api/v1/ofertas/:id/cierre` | empresa | Publicada → cerrada, exige motivo |
| GET | `/api/v1/ofertas/pendientes-revision` | coordinación | Cola de moderación |

## Servicios
`services/ofertas/estados.js` — la tabla de transiciones como **datos**, no como cadena de `if`:
```js
const TRANSICIONES = {
  borrador:    { en_revision: ['empresa'] },
  en_revision: { publicada: ['coordinacion'], borrador: ['coordinacion'] },
  publicada:   { cerrada: ['empresa', 'sistema'] },
  cerrada:     { archivada: ['sistema'] },
  archivada:   {},
};
```
Una sola función `puedeTransicionar(desde, hacia, actor)` la consulta. Agregar un estado nuevo es
agregar una fila, no editar lógica dispersa. Se prueba sola, sin base de datos.

`services/ofertas/ofertas.service.js` — `crear`, `editar`, `enviarARevision`, `aprobar`, `rechazar`,
`cerrar`, `listarPublicas`, `listarDeEmpresa`. Cada cambio de estado corre **dentro de una
transacción** junto con la inserción en `oferta_eventos`: si falla el evento, no hay cambio de estado.
Sin eso los indicadores mienten.

`services/ofertas/reglas.js` — `verificarCierresPendientes(empresaId)` y
`verificarVigencia(oferta)`. Se usan también desde el servicio de postulaciones: la regla vive en un
solo lugar.

`tareas/cerrarOfertasVencidas.js` — corre a las 03:00, usa `ofertas.service.cerrar` con actor
`sistema`. Idempotente. Registra cuántas cerró y deja la marca de tiempo que expone el healthcheck.

## Errores nuevos
`OFERTA_SIN_FECHA_CIERRE` · `OFERTA_FECHA_CIERRE_INVALIDA` · `OFERTA_TRANSICION_INVALIDA` ·
`OFERTA_NO_VIGENTE` · `EMPRESA_NO_VALIDADA` · `EMPRESA_CIERRES_PENDIENTES` ·
`OFERTA_CAMPO_NO_EDITABLE`. Se agregan a `packages/errores/codigos.js` y a la tabla de
`docs/04-manejo-de-errores.md`.

## Seguridad
- Todas las rutas de escritura: `autenticar` + `autorizar(rol)`.
- La pertenencia se verifica **dentro de la consulta**:
  `Oferta.findOne({ where: { id, empresaId: req.usuario.empresaId } })`, y si no hay resultado, 404.
- `GET /ofertas/:id` de una oferta no publicada devuelve 404 a cualquiera que no sea su dueña o
  coordinación: no se confirma la existencia de borradores ajenos.
- El listado público nunca expone datos de contacto directo ni el borrador de nadie.
- Los cambios de estado hechos por coordinación quedan en `oferta_eventos` con su `actor_usuario_id`.

## Pruebas
Unitarias de `estados.js`: matriz completa de transiciones válidas e inválidas por actor.
Unitarias de `reglas.js`: cierres pendientes y vigencia, con fechas fijas (reloj inyectado, nada de
`new Date()` suelto dentro de la regla).
Integración: un caso por criterio de aceptación, más la prueba de acceso cruzado entre empresas.
Tarea nocturna: se corre dos veces seguidas y se verifica que el segundo pase no cambie nada.

## Riesgos
| Riesgo | Detección |
|---|---|
| La tarea nocturna falla en silencio | El healthcheck expone su última ejecución exitosa |
| Zonas horarias: cerrar un día antes o después | Todo en UTC en la base; la conversión ocurre solo al mostrar. Hay una prueba con una fecha límite en el borde del día |
| Empresas irritadas por el bloqueo | El mensaje de error dice exactamente qué ofertas debe declarar y con un enlace directo |
