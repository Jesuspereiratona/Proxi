# Plan técnico · Indicadores de transparencia

## Cambios en el modelo de datos
Una vista materializada nueva, tal como la describe `docs/02-modelo-de-datos.md`. Sin tablas
nuevas: todo el cálculo se apoya en `ofertas`, `postulaciones` y `postulacion_eventos`, ya
construidas en Fases 3 y 4.

**`empresa_indicadores`** (vista materializada, una fila por empresa, incluidas las que todavía no
tienen ninguna oferta):
| Columna | Cálculo |
|---|---|
| `empresa_id` | PK de la vista (índice único, requisito de `REFRESH ... CONCURRENTLY`) |
| `tasa_respuesta` | postulaciones en estado terminal con `respondida_por_empresa` / total en estado terminal, de esa empresa. `NULL` si el denominador es 0 |
| `dias_promedio_respuesta` | promedio de días entre `postulaciones.created_at` y el primer evento cuyo `estado_nuevo` sea `en_revision`, `entrevista`, `seleccionada` o `no_seleccionada` — los cuatro estados que la tabla de transiciones de `services/postulaciones/estados.js` solo permite alcanzar por actor `empresa`, así que no hace falta una columna de rol en `postulacion_eventos` para distinguir "lo movió la empresa" de "lo movió el sistema o el estudiante". `NULL` si nunca hubo un movimiento así |
| `tasa_cierre_declarado` | ofertas `cerrada` con `resultado_declarado` / total `cerrada`, de esa empresa. `NULL` si el denominador es 0 |
| `ofertas_cerradas_total` | conteo de ofertas `cerrada` — no es uno de los cuatro indicadores públicos, es el dato que decide el umbral de visibilidad |
| `ofertas_publicadas_12m` | ofertas con `fecha_publicacion` en los últimos 12 meses |
| `postulaciones_terminales` | conteo interno: postulaciones de la empresa en estado terminal. Nunca se devuelve al público — decide si `tasa_respuesta` tiene base suficiente (auditoría de Fase 5, ver más abajo) |
| `postulaciones_con_movimiento` | conteo interno: postulaciones con al menos un movimiento de la empresa. Nunca se devuelve al público — decide si `dias_promedio_respuesta` tiene base suficiente |
| `calculado_at` | `now()` evaluado en el momento del `REFRESH`, para que coordinación sepa qué tan fresco es el dato |

Índice único en `empresa_id`, obligatorio para poder refrescar con `CONCURRENTLY` (no bloquea
lecturas mientras recalcula de noche).

## Endpoints
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/v1/empresas/:id/indicadores` | público | Indicadores de una empresa, solo si supera el umbral |
| GET | `/api/v1/empresas/indicadores` | coordinación | Todas las empresas, sin el filtro de umbral |

`/indicadores` (ruta literal) se declara antes que `/:id/...` en `empresas.routes.js`, mismo motivo
que el resto de las rutas del proyecto con ese patrón.

## Servicios y reglas
`services/empresas/indicadores.service.js`:
- `UMBRAL_OFERTAS_CERRADAS = 3` y `UMBRAL_POSTULACIONES = 5`, constantes del módulo — reglas de
  negocio fijas de la spec, no variables de entorno: no hay ningún escenario donde deban
  configurarse por ambiente.
- `obtenerPublico(empresaId)`: confirma que la empresa existe **y está validada** (`Empresa.findOne`
  con `estadoValidacion:'validada'` en el mismo `where`, `attributes:['id']` para no traer más de lo
  necesario — una empresa pendiente/rechazada/suspendida responde 404, igual que una que no existe;
  hallazgo de la auditoría de Fase 5, antes cualquier empresa registrada respondía 200), lee la fila
  de la vista (`EmpresaIndicador.findByPk`, puede no existir todavía si la empresa se creó después
  del último `REFRESH` — se trata igual que 0 ofertas cerradas), y devuelve `{ suficienteHistorial:
  false }` o las cifras según dos umbrales independientes: `ofertasCerradasTotal >=
  UMBRAL_OFERTAS_CERRADAS` para mostrar algo en absoluto (protege `tasaCierreDeclarado` y
  `ofertasPublicadas12m`, cuyo denominador son ofertas cerradas), y por separado
  `postulacionesTerminales`/`postulacionesConMovimiento >= UMBRAL_POSTULACIONES` para
  `tasaRespuesta`/`diasPromedioRespuesta` respectivamente, cuyo denominador son postulaciones — una
  empresa puede cumplir el primer umbral con una sola postulación recibida, y sin el segundo umbral
  esas dos cifras describirían el trato de ese caso puntual (auditoría de Fase 5). Las cifras
  publicadas se redondean (2 decimales las tasas, 1 los días): la precisión completa de punto
  flotante devuelve el denominador exacto y, en el caso de los días, reconstruye el instante del
  evento con precisión de sub-segundo.
- `listarTodos()`: para coordinación, `EmpresaIndicador.findAll` con la `Empresa` asociada (para
  poder mostrar la razón social), sin filtro de umbral.

Sin capa de reglas de transición: esta fase no mueve ningún estado, es puramente de lectura.

`tareas/recalcularIndicadores.js`: mismo patrón que `cerrarOfertasVencidas.js` y
`marcarSinRespuesta.js` — `node-cron`, estado en memoria expuesto en `GET /salud` (solo
`ultimaEjecucionAt`/`huboError`, igual que las otras dos tareas desde la auditoría de Fase 4), un
`REFRESH MATERIALIZED VIEW CONCURRENTLY empresa_indicadores` por corrida. Programada a las 5am, una
hora después de `marcarSinRespuesta` (4am) y dos después de `cerrarOfertasVencidas` (3am).

## Errores nuevos
Ninguno. `PERFIL_NO_ENCONTRADO` (Fase 2) cubre el caso de empresa inexistente; `NO_AUTORIZADO`
(Fase 1) cubre el 403 de `autorizar('coordinacion')`.

## Consideraciones de seguridad
- El endpoint público no requiere autenticación y no expone nada que no sea ya público (una
  empresa validada es, por definición, visible en la vitrina de ofertas). No hay dato personal
  involucrado: los indicadores son agregados sobre ofertas y postulaciones, nunca sobre estudiantes
  individuales.
- El endpoint de coordinación sí requiere `autorizar('coordinacion')`: el panorama sin el filtro de
  umbral incluye empresas con muy pocos casos, que identifican indirectamente el comportamiento de
  postulaciones puntuales si se cruza con otra información — por eso no es público.
- El `REFRESH ... CONCURRENTLY` no bloquea lecturas de la vista mientras recalcula: el endpoint
  público sigue respondiendo con los datos de la noche anterior durante el recálculo, nunca un
  error ni una tabla bloqueada.

## Pruebas
- Integración (`apps/api/tests/indicadores.test.js`, dominio propio
  `indicadores.uahurtado.test`): construye ofertas y postulaciones con fechas conocidas
  directamente por modelo (mismo patrón que `ofertas.test.js`/`postulaciones.test.js`, sin pasar
  por HTTP para controlar `createdAt`/`fechaCierre`/`fechaPublicacion` con precisión), llama
  `recalcularIndicadores.ejecutar()` y verifica cada cifra contra el cálculo hecho a mano.
  - Los 11 criterios de aceptación de `spec.md`.
  - Idempotencia: correr `ejecutar()` dos veces seguidas sobre los mismos datos da el mismo
    resultado.
  - 403 sin rol coordinación en el endpoint de panorama general.
  - 404 en el endpoint público con un id de empresa que no existe.

## Riesgos
- El cálculo de `diasPromedioRespuesta` asume que `postulacion_eventos.created_at` es confiable
  para medir tiempo de respuesta real (no hay reloj distinto en el proyecto). Ya es la fuente de
  verdad para todo lo demás en Fases 3 y 4, así que no es un riesgo nuevo.
- Una empresa con historial grande podría hacer el `REFRESH` nocturno más lento con el tiempo. No
  es un problema medido todavía (`docs/01-arquitectura.md`, "qué NO se hace en la v1"); se revisita
  si el volumen real de la facultad lo justifica.
