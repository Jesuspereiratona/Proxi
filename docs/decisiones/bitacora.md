# Bitácora de decisiones

Registro cronológico, lo más reciente arriba. Aquí va lo que **no** es obvio leyendo el código: por qué
se eligió algo, qué se descartó, qué salió mal.

Se anota cuando: se toma una decisión técnica no evidente · se descarta una alternativa · se cambia
algo ya decidido · se resuelve un bug cuya causa costó encontrar · se instala una dependencia.

Formato:
```
## AAAA-MM-DD · Título corto
**Contexto:** qué situación lo provocó.
**Decisión:** qué se hizo.
**Motivo:** por qué, y qué se descartó.
**Consecuencia:** con qué hay que vivir ahora.
```

---

## 2026-08-29 · Auditoría de seguridad de Fase 5, antes del push
**Contexto:** fase pequeña frente a Fase 3/4 — una vista materializada de solo lectura y dos
endpoints de reporte, sin estados nuevos ni escritura. El auditor levantó la base local y ejecutó
los endpoints con datos reales controlados (no solo leyó el código) para confirmar cada hallazgo
con la respuesta real del servidor.
**Arreglado:**
- **[Medio] El umbral de 3 ofertas cerradas no protegía `tasaRespuesta` ni
  `diasPromedioRespuesta`, que tienen su propio denominador.** Una empresa con 3 ofertas cerradas
  (umbral cumplido) y **una sola postulación** mostraba `tasaRespuesta:1` y
  `diasPromedioRespuesta:"4.2000001157407407"` en el endpoint público, sin sesión — el trato exacto
  de esa postulación puntual, con precisión de sub-segundo por la falta de redondeo. Es el mismo
  riesgo que `specs/03-indicadores-transparencia/plan.md` ya invocaba para justificar por qué el
  panorama de coordinación no es público, pero el propio endpoint público lo reproducía por el lado
  de las postulaciones. Arreglado con un segundo umbral independiente
  (`UMBRAL_POSTULACIONES = 5`): la vista ahora calcula dos conteos internos,
  `postulaciones_terminales` y `postulaciones_con_movimiento` (nunca expuestos), y
  `indicadores.service.js` solo publica `tasaRespuesta`/`diasPromedioRespuesta` si el conteo
  correspondiente alcanza el umbral. Las cifras que sí se publican se redondean (2 decimales las
  tasas, 1 los días): la precisión completa de punto flotante revelaba el denominador exacto.
- **[Medio-bajo] El endpoint público respondía 200 para cualquier empresa registrada, validada o
  no.** `obtenerPublico` nunca miraba `estadoValidacion`; una empresa `pendiente`, `rechazada` o
  `suspendida` —que nunca aparece en la vitrina— sí respondía en este endpoint, permitiendo
  distinguir por 200-vs-404 qué empresas registradas todavía no son públicas (dato de gestión, no
  público por diseño). Arreglado: `Empresa.findOne({ where: { id, estadoValidacion: 'validada' },
  attributes: ['id'] } )` — la condición de validación queda dentro de la misma consulta, y una
  empresa no validada responde 404, igual que una que no existe.
- **[Bajo] `Empresa.findByPk` traía la fila completa a memoria para usar solo el id.** Sin
  filtrar `attributes`, cualquier cambio futuro del tipo `{ ...empresa.toJSON(), ...cifras }`
  filtraría `rutEmpresa`, `motivoRechazo` o `motivoSuspension` desde el único endpoint sin
  autenticar de la fase. Cerrado de paso por el `attributes:['id']` del punto anterior.
- **[Bajo, correctitud] `diasPromedioRespuesta` se servía como string de precisión completa.**
  `AVG(EXTRACT(EPOCH FROM ...))` es `numeric` en Postgres (a diferencia de las otras dos tasas, ya
  `double precision`), y node-pg entrega `numeric` como string — el modelo declaraba `DOUBLE`, pero
  el JSON mandaba `"4.2000001157407407"`. Arreglado con un cast explícito `::double precision` en
  la vista, igual que ya se hacía para las otras cifras.
**Pruebas agregadas:** empresa con 3 cerradas y 1 sola postulación (las dos cifras quedan ausentes,
`tasaCierreDeclarado` no); empresa pendiente/rechazada/suspendida (404); regresión de la lista
blanca del endpoint público (`ofertasCerradasTotal` nunca presente); regresión del `include` de
coordinación (`Object.keys(fila.Empresa)` es exactamente `['razonSocial']`); empresa creada después
del último `REFRESH` (200 con `suficienteHistorial:false`, no error).
**Confirmado sin cambios:** sin superficie de inyección SQL (la vista y el `REFRESH` no interpolan
nada, se verificó con grep); el `include` de coordinación sí limita realmente los campos de
`Empresa`; el manejo de errores de la tarea nocturna no filtra el objeto de error completo ni mata
el proceso; dos `REFRESH ... CONCURRENTLY` solapados se serializan en Postgres sin corromper nada
(no puede pasar hoy con una sola instancia y una tarea diaria, pero se revisó igual).

## 2026-08-29 · Fase 5 (Indicadores de transparencia): decisiones y bugs
**Contexto:** primera fase puramente de lectura — sin escritura, sin estados, sin roles nuevos.
**Decisiones:**
- **`UMBRAL_POSTULACIONES = 5`**, agregado tras la auditoría (ver arriba): protege
  `tasaRespuesta`/`diasPromedioRespuesta` con el mismo espíritu que `UMBRAL_OFERTAS_CERRADAS = 3`
  protege las otras dos cifras — ambos son constantes del módulo, no variables de entorno, porque
  son reglas de negocio fijas de la spec, no configuración por ambiente.
- **`dias_promedio_respuesta` se calcula sin una columna de rol en `postulacion_eventos`.** Los
  cuatro estados que puede alcanzar una postulación por acción de la empresa
  (`en_revision`/`entrevista`/`seleccionada`/`no_seleccionada`) solo son alcanzables por el actor
  `'empresa'` según `services/postulaciones/estados.js` — así que "el primer evento con uno de esos
  `estado_nuevo`" ya identifica sin ambigüedad "el primer movimiento de la empresa", sin necesitar
  guardar quién disparó cada evento más allá de lo que Fase 4 ya guarda.
- **Cifras redondeadas antes de publicarse, nunca en punto flotante crudo.** Ver la entrada de
  auditoría arriba: no es solo estética, la precisión completa filtraba el denominador exacto y, en
  el caso de los días, el instante del evento.
**Bugs encontrados al probar:**
- **`ofertasPublicadas12m` fallaba con `column "ofertas_publicadas12m" does not exist`.** Mismo bug
  que `rutUltimos4` en `Estudiante.js` (Fase 2): `underscored:true` no inserta un guion antes de un
  dígito, así que el mapeo automático buscaba `ofertas_publicadas12m` en vez de la columna real
  `ofertas_publicadas_12m`. Arreglado con `field: 'ofertas_publicadas_12m'` explícito en el modelo,
  mismo patrón que la vez anterior.
- **Los conteos de la vista (`COUNT(*)`) llegaban como string, no como número**, porque `COUNT(*)`
  es `bigint` en Postgres y node-pg lo devuelve como string para no perder precisión. Arreglado con
  `::integer` explícito en la vista — a esta escala (ofertas de una facultad) alcanza de sobra, y
  evita que el JSON mande `"0"` en vez de `0`.

## 2026-08-29 · Auditoría de seguridad de Fase 4, antes del push
**Contexto:** primera fase donde el sistema le sirve un dato personal completo (el CV) a un
tercero — la empresa — y no solo al dueño o a coordinación. `auditor-seguridad` no encontró
hallazgos graves: confirmó explícitamente que el control de acceso al CV (el punto de mayor riesgo
señalado de antemano) está bien resuelto, incluido el detalle de que el `include`+`where` de
Sequelize genera un INNER JOIN real dentro de la consulta, no un post-filtro en memoria. Encontró 3
medios y 2 bajos, todos reales.
**Arreglado:**
- **[Medio] Una empresa suspendida seguía pudiendo descargar CVs y mover postulaciones de sus
  ofertas.** La suspensión (Fase 2/3) corta la publicación de ofertas nuevas, pero
  `archivos.service.puedeDescargar` y `postulaciones.service.listarDeOferta`/`empresaTransita`
  nunca miraban `estadoValidacion`. Una empresa marcada por fraude conservaba acceso a los CV
  completos de todos los que alguna vez le postularon. Arreglado: `Empresa.findOne` para la rama
  empresa de la descarga ahora exige `estadoValidacion:'validada'` dentro del mismo `where`, y
  `listarDeOferta`/`empresaTransita` llaman a `empresasReglas.verificarValidada()` — la misma regla
  que ya usa `ofertas.service.js` desde Fase 3.
- **[Medio] `subir-cv.middleware.js` solo acotaba `fileSize`.** Sin límite de `fields`/`fieldSize`,
  una petición autenticada con miles de campos de texto agotaba la memoria del proceso antes de
  llegar siquiera al límite de tamaño del archivo. Arreglado con
  `files:1, fields:0, fieldNameSize:64, fieldSize:1024, fieldNestingDepth:1,
  fieldArrayIndexLimit:0`. `parts:1` se probó primero y se descartó: busboy lo cuenta con un margen
  que rechazaba incluso una subida de un solo archivo válida — bug real, ver la entrada de abajo.
- **[Medio-bajo] Los CV se escribían en disco con permisos por defecto del sistema** (típicamente
  0644/0755), legibles por cualquier otra cuenta de la máquina. Arreglado:
  `archivos.service.subirCv` crea el directorio con `mode:0o700` y el archivo con `mode:0o600`.
- **[Bajo] La comprobación de dueño en `archivos.service.descargar` (rama estudiante) era un
  `findByPk` seguido de un `if`.** Funcionaba porque Sequelize devuelve BIGINT como string, igual
  que el `sub` del JWT, pero es una comparación `===` a través de una frontera de tipos, frágil
  ante un cambio futuro en cualquiera de los dos lados. Se movió a
  `Archivo.findOne({ where: { id, propietarioUsuarioId } })`, la misma consulta que ya usa
  `obtenerPropiaDeEstudiante` en `postulaciones.service.js`.
- **[Bajo] Faltaba la prueba de acceso cruzado obligatoria de `GET /postulaciones/:id`**
  (`docs/03-seguridad.md`). Estaban las de `/revision`, `/retiro`, `/oferta/:id` y las de descarga,
  pero no la del propio `obtenerDetalle`, la única ruta con `:id` de la fase con tres ramas de
  visibilidad distintas según el rol. Agregada: estudiante contra postulación ajena, empresa contra
  postulación de una oferta ajena.
**Registrado sin cambiar código:**
- `postular()` responde 404 `OFERTA_NO_ENCONTRADA` si el id no existe y 422 `OFERTA_NO_VIGENTE` si
  existe pero no está publicada, lo que deja inferir la existencia de una oferta ajena en borrador
  o en revisión recorriendo ids. Se deja así a propósito: es el criterio de aceptación aprobado en
  `specs/02-postulaciones/spec.md`, y el costo es bajo (solo confirma que un id existe, nunca su
  contenido).
- `GET /salud` (pública, sin autenticación) exponía `cantidadCerradas`/`cantidadMarcadas` de las
  dos tareas nocturnas. Se recortó a `{ultimaEjecucionAt, huboError}` para ambas — afecta también a
  `cerrarOfertasVencidas` de Fase 3, no solo a la tarea nueva: el volumen de actividad nocturna es
  dato de gestión, no algo para publicar sin auth.
- `nombre_original` del CV se guardaba sin tope de longitud; se acotó a 255 caracteres al subir.
- Si el archivo ya no está en disco al momento de descargar, ahora se corta antes de escribir en
  `auditoria_accesos` (evita una fila de "descarga" que nunca ocurrió) y antes de que la ruta
  absoluta llegue al log de errores no operacionales.

## 2026-08-29 · Fase 4 (Postulaciones): decisiones y bugs
**Contexto:** cuarta fase, primera que combina un dato personal completo (el CV) con acceso de un
tercero — la empresa — a ese dato, no solo del dueño o de coordinación.
**Decisiones:**
- **`multer` como dependencia nueva**, consultada y aprobada explícitamente antes de instalarla
  (regla dura de `CLAUDE.md`: ninguna dependencia nueva sin preguntar). Modo `memoryStorage()`: el
  buffer se valida (número mágico `%PDF-`) antes de tocar disco, nunca se confía en `mimetype` ni
  en el nombre que manda el cliente.
- **El CV nunca se borra al reemplazarlo.** Subir un CV nuevo crea una fila y un archivo nuevos y
  solo actualiza `estudiante.cv_archivo_id`; el archivo anterior queda huérfano pero intacto. Es la
  forma más simple de cumplir "el CV se congela" (`docs/02-modelo-de-datos.md`): las postulaciones
  ya enviadas siguen apuntando al archivo original sin ningún mecanismo adicional. El costo
  (archivos huérfanos acumulándose) se resuelve con la política de retención de Fase 7, no antes.
- **`postulaciones.cv_archivo_id` usa `onDelete:'RESTRICT'`**, no `SET NULL` como el resto de las
  FK nullable del proyecto: acá la columna es `NOT NULL` (una postulación sin CV no tiene sentido),
  así que la base debe impedir borrar un archivo todavía referenciado en vez de dejar la fila en un
  estado inconsistente.
- **Un endpoint por transición de postulación** (`/revision`, `/entrevista`, `/seleccion`,
  `/rechazo`, `/retiro`), no un `PATCH` genérico de estado — mismo patrón que `services/ofertas/*`
  de Fase 3 y mismo motivo: cada ruta declara su propio esquema de entrada y su propio permiso.
- **La FK de `estudiantes.cv_archivo_id` se completó en una migración aparte**
  (`20260829160100-agregar-fk-cv-archivo-estudiantes`) en vez de dentro de la de `crear-archivos`:
  la migración de Fase 2 ya había dejado la columna sin referencia a propósito, con un comentario
  que decía literalmente "se agrega la referencia en Fase 4".
**Bugs encontrados al probar:**
- **`multer` con `limits.parts:1` rechazaba una subida de un solo archivo válida**
  (`LIMIT_PART_COUNT`), aunque `files:1` + `fields:0` ya cubrían la misma protección contra
  agotamiento de memoria. Se aisló con un script mínimo que probó cada límite por separado contra
  el mismo request real; se descartó `parts` y se dejaron los demás.
- **ESLint no tenía `Buffer` en sus globals** (`eslint.config.js`): ningún archivo anterior lo
  usaba por nombre directamente. Se agregó al listado manual de globals, mismo patrón que las
  demás incorporaciones puntuales desde Fase 0.

## 2026-08-29 · Auditoría de seguridad de Fase 3, antes del push
**Contexto:** el "corazón del proyecto" — ciclo de vida de ofertas. `auditor-seguridad` encontró 2
hallazgos graves y 2 altos, todos reales, más varios medios y bajos. A diferencia de Fase 0/1/2, esta
vez confirmó explícitamente que **no hay IDOR**: la pertenencia por `:id` está bien implementada en
todo el módulo.
**Arreglado:**
- **[Grave] Una empresa podía reescribir el contenido de una oferta ya aprobada sin nueva revisión.**
  `editar()` solo bloqueaba `remunerada`/`montoMensual` en estado `publicada`; título, descripción,
  requisitos, área, modalidad, comuna y cupos se sobrescribían en caliente, incluso con la oferta ya
  en el listado público, sin dejar rastro en `oferta_eventos`. Arreglado: tocar cualquier campo de
  contenido (`CAMPOS_CONTENIDO`) en una oferta `en_revision` o `publicada` la manda de vuelta a
  `borrador` automáticamente (mismo mecanismo que ya existía para empresas rechazadas/validadas), con
  su evento correspondiente. Se agregaron las transiciones `en_revision→borrador` y
  `publicada→borrador` por actor `empresa` a `services/ofertas/estados.js`.
- **[Grave] Coordinación podía aprobar la oferta de una empresa que mientras tanto quedó suspendida.**
  `aprobar()` nunca consultaba el estado de la empresa dueña, solo el de la oferta. Arreglado:
  `aprobar()` carga la `Empresa` y llama `verificarValidada()` antes de aprobar. Además,
  `cerrarPorSuspension()` ahora también revierte a `borrador` las ofertas `en_revision` de la empresa
  suspendida (antes solo cerraba las `publicada`), para que no queden colgadas en la cola de revisión
  esperando que alguien las apruebe.
- **[Alto] Suspender una empresa no era atómico.** Si `cerrarPorSuspension` fallaba a mitad de camino,
  la empresa quedaba `suspendida` con ofertas todavía publicadas, y `estados.js` no permite reintentar
  (`suspendida` no tiene transiciones salientes, así que un segundo `POST .../suspension` da 409).
  Arreglado: `empresas.service.suspender()` envuelve la actualización de la empresa y el cierre en
  cascada en una sola `sequelize.transaction`, pasando la `transaction` explícita a
  `cerrarPorSuspension`. `transicionar()` en `ofertas.service.js` ahora acepta una `transaction`
  externa opcional para poder participar de una transacción ya abierta por el llamador.
- **[Alto] Una oferta cerrada por vencimiento bloqueaba a su empresa para siempre.** La spec ya
  aprobaba el caso borde "la empresa cierra una oferta que ya cerró el sistema: completa la
  declaración", pero `cerrada` no tenía ninguna transición de salida utilizable por `empresa`, y sin
  declarar el resultado, `verificarCierresPendientes` bloqueaba cualquier envío a revisión futuro
  indefinidamente. Arreglado: `cerrar()` detecta el caso `estado==='cerrada' && !resultadoDeclarado` y
  llama a una función nueva, `declararResultadoTardio`, que actualiza `motivoCierre`/
  `resultadoDeclarado` sin cambiar de estado (no es una transición real, así que no pasa por
  `estados.js`) y conserva el `cerradaAt` original.
- **[Medio] Condición de carrera real entre transiciones simultáneas.** `transicionar()` leía la
  oferta, decidía si la transición era válida, y recién después escribía — sin nada que impidiera que
  dos peticiones (ej. la empresa cerrando una oferta justo cuando corre `cerrarOfertasVencidas`)
  hicieran la misma secuencia sobre la misma fila y una pisara a la otra en silencio. Arreglado con
  compare-and-set: el `UPDATE` ahora lleva `WHERE id = ? AND estado = <estado que se leyó>`; si 0
  filas se actualizan (porque alguien más ya cambió el estado), se lanza `OFERTA_TRANSICION_INVALIDA`
  (409) en vez de sobrescribir. Se agregó una prueba con dos cierres disparados en paralelo
  (`Promise.all`) que confirma un 200 y un 409, nunca dos "cerrada" en `oferta_eventos`.
- **[Medio] `cerrarVencidas` abortaba toda la corrida en la primera oferta que fallara.** Sin
  `try/catch` por elemento, una sola fila problemática dejaba sin cerrar todas las que venían después,
  cada noche, hasta que alguien interviniera a mano. Arreglado: cada oferta se cierra en su propio
  `try/catch`, acumulando `{ cerradas, fallidas }` (antes devolvía solo un número). Cambia la forma de
  retorno de `cerrarVencidas()` — se actualizaron `tareas/cerrarOfertasVencidas.js` y sus pruebas.
- **[Medio-bajo] `/api/v1/salud` filtraba el mensaje de error interno de la tarea nocturna, sin la
  guarda de entorno que ya protege el error de conexión a la base.** Arreglado en el origen:
  `cerrarOfertasVencidas.obtenerEstado()` ahora expone `huboError: boolean`, nunca el texto del error
  — no hay guardar-y-filtrar-después que se pueda olvidar, el dato sensible no sale del módulo.
- **[Bajo] `editarEsquema` no validaba cruces de campos (remunerada↔montoMensual, modalidad↔comuna).**
  Un `PATCH` parcial que por sí solo se veía válido podía dejar la oferta inconsistente y reventar
  contra el `CHECK` de la base como un 500 crudo. Arreglado: `ofertas.service.editar()` valida el
  objeto **resultante** (actual + parche fusionado), no el parche aislado, y responde 422 con el
  campo señalado.
- **[Bajo] `z.coerce.date()` convertía `null`/`true`/`0` en 1970-01-01 en vez de rechazarlos**, y el
  filtro `?remunerada=false` devolvía las remuneradas (`Boolean("false") === true`). Ambos arreglados
  en `schemas/ofertas.schemas.js` con tipos de entrada más estrictos.
- `services/ofertas/ofertas.service.js obtenerDetalle()` se reescribió para resolver la pertenencia
  dentro del `WHERE` de una sola consulta, en vez de traer la fila completa a memoria y decidir
  después — hoy es inofensivo (`Oferta` no tiene datos personales) pero importa cuando Fase 4 agregue
  un `include` de postulaciones con CVs.
**Descartado por ahora, anotado para Fase 8:** el cron de `cerrarOfertasVencidas` se programa por
proceso (`server.js`), sin lock distribuido — con más de una instancia de la API corriendo a la vez,
todas ejecutarían la tarea a las 03:00 sobre el mismo conjunto. No es un problema con una sola
instancia (el despliegue actual), y `cerrarPorVencimiento` es idempotente por fila gracias al
compare-and-set de arriba, así que el peor caso hoy es trabajo duplicado, no datos incorrectos. Se
anota como algo a resolver (`pg_advisory_lock` o similar) cuando Fase 8 defina cuántas instancias corren.
**Fuera de alcance, anotado como deuda:** una capa de serialización (`Oferta` se devuelve completa en
toda respuesta, incluidos campos de gestión interna) y el registro de un evento en la creación misma
de una oferta (`crear()` no deja fila en `oferta_eventos`, la traza empieza en `borrador→en_revision`).
Ninguno de los dos es una vulneración hoy; se dejan para cuando Fase 4 agregue datos personales
colgando del modelo de ofertas.

## 2026-08-29 · Fase 3 (Ofertas y ciclo de vida): decisiones y bugs
**Contexto:** `specs/01-ciclo-de-vida-oferta/` se escribió en el planteamiento original, antes de que
existiera el código real de Fase 1/2. Aparecieron ajustes y un par de bugs reales al implementar.
**Decisión — `fecha_cierre` pasa a NULLable con CHECK condicional, no `NOT NULL` puro.**
`docs/02-modelo-de-datos.md` decía `fecha_cierre timestamptz NOT NULL` sin excepción, pero el
criterio de aceptación de la spec exige que pueda existir "un borrador sin fecha_cierre" que recién
se valida al enviar a revisión — con `NOT NULL` puro ese borrador no se puede ni crear, el criterio
sería imposible de probar. Se resolvió con `fecha_cierre` NULLable a nivel de columna más
`CHECK (estado = 'borrador' OR fecha_cierre IS NOT NULL)`: la frase que más se repite en el
planteamiento ("no existe oferta **publicada** sin vigencia", no "ninguna fila sin vigencia") sigue
garantizada por la base, y el borrador puede omitirla. `docs/02-modelo-de-datos.md` queda desactualizado
en ese detalle; se corrige cuando se revise el modelo completo.
**Decisión — `EMPRESA_NO_VALIDADA` responde 422, no 403 como decía la spec original.**
`services/empresas/reglas.js` (Fase 2) ya la lanza como `ReglaDeNegocio` (422), igual que
`EMPRESA_CIERRES_PENDIENTES` — son la misma clase de bloqueo (precondición de negocio, no un problema
de rol o pertenencia) y no tenía sentido que una respondiera 403 y la otra 422. Se ajustó la spec al
código ya existente, no al revés.
**Decisión — `require()` adentro de la función, no arriba del archivo, para conectar Fase 2 y Fase 3.**
`empresas.service.suspender()` necesita cerrar las ofertas publicadas de la empresa
(`ofertas.service.cerrarPorSuspension`), pero `ofertas.service.js` también requiere
`empresas.service.js` (para `obtenerPropio`). Un `require` circular a nivel de módulo deja a uno de
los dos con un `module.exports` vacío (CommonJS resuelve el ciclo con lo que el módulo alcanzó a
exportar hasta ese punto). Se resolvió con un `require('../ofertas/ofertas.service')` **dentro** del
cuerpo de `suspender()`: para cuando la función corre, ambos módulos ya terminaron de cargar.
**Bug encontrado probando a mano: `req.query` es de solo lectura en Express 5.**
`validar-query.middleware.js` hacía `req.query = resultado.data` (el mismo patrón que
`validar.middleware.js` usa con `req.body`, que sí funciona). En Express 5, `req.query` es un getter
sin setter: la reasignación no lanza error — simplemente no hace nada, en silencio. El síntoma:
`GET /ofertas?pagina=1&limite=10` devolvía `"pagina":"1"` (string) en vez de `"pagina":1` (number)
pese a que el esquema zod usa `z.coerce.number()`. Se verificó con un servidor Express mínimo aparte
que ni la reasignación completa ni la mutación en el lugar (`req.query.a = 42`) funcionan; `req.params`
sí es escribible (se probó igual). Arreglo: el resultado validado se guarda en `req.filtros`, una
propiedad nueva, no en `req.query`.
**Consecuencia:** cualquier middleware de validación futuro que toque `req.query` debe escribir en una
propiedad propia (`req.filtros`, o similar), nunca reasignar `req.query` directamente — Express 5 lo
deja pasar sin avisar.

## 2026-08-29 · Auditoría de seguridad de Fase 2, antes del push
**Contexto:** primera vez que Proxi guarda datos personales reales (RUT cifrado, teléfono, carrera).
`auditor-seguridad` revisó todo el código de perfiles y validación de empresas antes de comitear.
Encontró 2 hallazgos graves, 1 alto y 2 medios, todos reales y activos, no hipotéticos.
**Arreglado:**
- **[Grave] El RUT en claro y `RUT_CIFRADO_KEY` completa se filtraban al log.**
  `repositories/estudiantes.repository.js` usaba `replacements` en vez de `bind`. En Sequelize,
  `replacements` se interpolan en el texto del SQL *antes* de enviarlo (pensado para nombres de
  tabla/columna, nunca para un valor secreto); `bind` viaja como parámetro real del protocolo y
  nunca toca la cadena de la sentencia. Con `replacements`, cualquier `POST/PATCH /estudiantes/perfil`
  dejaba el RUT y la clave de cifrado completos en el log de consultas de desarrollo, y Postgres los
  habría registrado igual en producción ante cualquier error de la sentencia (ej. una violación de
  unicidad). Cambiado a `bind` con placeholders `$1, $2...` y `logging: false` explícito por
  consulta como segunda barrera. Verificado a mano: con el logging global forzado a capturar todo,
  las tres consultas del repositorio no escriben nada.
- **[Grave] El seed traía una contraseña fija y publicada para una cuenta `coordinacion`.**
  Sin guarda de entorno, ese seed podía correr contra producción (`config-cli.js` mapea
  `development`/`test`/`production` a la misma configuración) y cualquiera que leyera el repo público
  tenía la clave de una cuenta con acceso a `GET /estudiantes/:id/rut`. Arreglado: `up()` lanza si
  `env.esProduccion`, y la clave se genera con `crypto.randomBytes` en cada corrida (se imprime una
  vez, nunca queda en el archivo). Los cuerpos de RUT de los seeds también se movieron al rango
  `99.xxx.xxx`, que el Registro Civil no asigna a personas naturales (antes usaban un rango que sí
  corresponde a RUT real y vigente, aunque el número exacto fuera inventado).
- **[Alta] Una empresa `validada` podía cambiar `razonSocial`/`rutEmpresa` sin volver a revisión, y
  no había forma de revocar una validación.** Se agregó: cambiar un campo de identidad
  (`razonSocial` o `rutEmpresa`) en una empresa `validada` la manda de vuelta a `pendiente`
  automáticamente (mismo mecanismo que ya existía para `rechazada`); y `POST /empresas/:id/suspension`
  (`validada → suspendida`, motivo obligatorio, columna nueva `motivo_suspension` vía migración) para
  cuando un fraude se descubre después de validar. Reactivar una empresa suspendida queda fuera de
  alcance a propósito: no hay flujo definido todavía.
- **[Media] Un `PATCH` con cuerpo vacío reencolaba una empresa `rechazada` sin ningún cambio real.**
  `actualizarPropio` calculaba los cambios de estado *antes* de comprobar si había cambios de datos
  reales, así que `{}` bastaba para poner `motivoRechazo` en `null` y volver a `pendiente`. Arreglado:
  el reseteo de estado solo se dispara si `cambios` tiene al menos un campo real (y se compara contra
  el valor actual, no solo contra `undefined`).
- **[Media] `GET /estudiantes/:id/rut` no dejaba ningún rastro de quién lo consultó.** Se agregó un
  `req.log.info` con el id de coordinación y el id del estudiante (nunca el RUT), como sustituto
  mínimo hasta que exista `auditoria_accesos` de verdad en Fase 4. Se agregó también un límite de
  tasa propio de esa ruta (30/15min): el global no alcanza para frenar una cuenta comprometida
  recorriendo ids en secuencia.
- Observaciones menores cerradas de paso: `:id` de ruta sin validar devolvía 500 con un id no
  numérico (ahora 422 vía `validar-params.middleware.js`); `RUT_CIFRADO_KEY` se exigía pero no se
  validaba su largo (ahora mínimo 32 caracteres); `telefono`/`nombres`/`apellidos`/`rutUltimos4`/
  `rutCifradoKey` se agregaron a `CAMPOS_CENSURADOS` del logger, preventivo; el orden del spread en
  `estudiantes.service.crearPerfil` se invirtió (`{...datos, usuarioId}`) como defensa en profundidad
  aunque el esquema zod ya descartaba un `usuarioId` forjado.
**Bug encontrado arreglando lo anterior, no por la auditoría:** el `FK` de
`empresas.validada_por_usuario_id` no tenía `ON DELETE`, así que el `after()` de las pruebas de
integración —que borra usuarios de prueba por dominio de correo— fallaba completo (Postgres revierte
toda la sentencia) en cuanto alguna empresa de esa corrida había sido validada por un usuario
`coordinacion` de la misma tanda. El resultado: 70 usuarios de pruebas anteriores quedaron
acumulados en la base sin que ningún test lo reportara como fallo, hasta que un `generarRutValido()`
basado en un contador (en vez de aleatorio) repitió un RUT de una corrida vieja y chocó. Arreglado en
dos capas: la migración de `empresas` ahora usa `onDelete: 'SET NULL'` en esa FK, y el generador de
RUT de las pruebas pasó de un contador determinístico a un valor aleatorio (así una corrida nunca
depende de que la anterior se haya limpiado bien).
**Consecuencia:** cualquier FK opcional (`allowNull: true`) hacia `usuarios` necesita `onDelete`
explícito (`SET NULL` normalmente), no dejarlo en el default de Postgres (`NO ACTION`, que revienta
un `DELETE` masivo entero). Y ningún generador de datos de prueba debería depender de un contador que
reinicia por corrida si existe la posibilidad de que la corrida anterior no haya limpiado del todo.

## 2026-08-29 · Fase 2 (Perfiles y validación de empresas): decisiones y bugs
**Contexto:** `specs/03-perfiles-empresas/` ya anotaba las decisiones grandes (RUT vía pgcrypto,
`repositories/` aparece por primera vez, `RUT_CIFRADO_KEY` obligatoria, reenvío automático
`rechazada → pendiente`). Esto es lo que salió durante la implementación, no en el plan.
**Decisión — `:id` en las rutas de coordinación es el id de `estudiantes`/`empresas`, no el de
`usuarios`.** Ninguna ruta de "perfil propio" recibe `:id` (siempre `req.usuario.id` del JWT), pero
`GET /estudiantes/:id/rut` sí, y ese `:id` es el id propio de la tabla `estudiantes` — la misma clave
que `postulaciones.estudiante_id` va a usar en Fase 4. Se eligió así para no tener dos formas
distintas de referenciar un estudiante en el modelo de datos.
**Bug 1: `rut_ultimos_4` no se leía.** El mapeo automático `underscored: true` de Sequelize convierte
`rutUltimos4` a `rut_ultimos4` (sin guion antes del dígito), pero la columna real es `rut_ultimos_4`.
Toda consulta a `estudiantes` fallaba con `column "rut_ultimos4" does not exist`. Se arregla con
`field: 'rut_ultimos_4'` explícito en el modelo. Se revisó el resto de los modelos por el mismo patrón
(ningún otro campo termina en dígito) y no hay más casos.
**Bug 2: dos archivos de prueba compartían dominio de correo y se pisaban entre sí.**
`apps/api/tests/auth.test.js` y `apps/api/tests/perfiles.test.js` usaban el mismo
`DOMINIO_PRUEBA = 'test.uahurtado.cl'`. `node --test` corre los archivos en paralelo contra la misma
base de Postgres (no hay aislamiento por archivo), así que el `after()` de un archivo —que borra por
`email LIKE '%@dominio'`— podía borrar usuarios que el otro archivo todavía estaba usando a mitad de
una prueba. Se vio como un `SequelizeInstanceError: Instance could not be reloaded` en un test de
`auth.test.js` que no tocaba nada de Fase 2. Arreglo: cada archivo de pruebas usa su propio dominio
(`auth.uahurtado.test`, `perfiles.uahurtado.test`), con un comentario explícito para que el próximo
archivo de pruebas no repita el error.
**Consecuencia:** cualquier archivo de pruebas de integración nuevo necesita su propio dominio de
correo único. Es la regla a seguir de ahora en adelante, no solo una corrección puntual.

## 2026-08-29 · Fase 1 (Identidad): decisiones de la implementación
**Contexto:** `specs/02-identidad/` quedó aprobada con varias decisiones ya anotadas ahí (tabla
`tokens_verificacion`, columna `intentos_fallidos_desde`, Ethereal para correo). Durante la
implementación aparecieron otras, más chicas, que no estaban en el plan.
**Decisiones:**
- **Bloqueo de cuenta = 403, no 401.** Cinco fallos de login lanzan `NoAutorizado` (403), no
  `NoAutenticado` (401): la identidad puede ser correcta, lo que falta es permiso temporal. Es la
  única situación de Fase 1 donde se revela (a propósito) que una cuenta existe y está bloqueada.
- **Comparación de tiempo constante contra correos inexistentes.** `login()` corre
  `bcrypt.compare` contra un hash dummy fijo aunque el correo no exista, para que el tiempo de
  respuesta no delate qué correos están registrados.
- **`sequelize-cli` con un solo config para los tres entornos.** `config/config-cli.js` reexporta
  `config/env.js` bajo `development`/`test`/`production`: como `env.js` ya resolvió las variables
  reales del proceso, sequelize-cli no necesita (ni debe) tener su propia copia de la lógica de
  entorno.
- **`node --require ./scripts/entorno-prueba.js` fuerza `NODE_ENV=test` en `npm test` local.** Sin
  esto, correr pruebas localmente usa el `NODE_ENV=development` del `.env` y dispara Ethereal de
  verdad en cada corrida (lento, depende de red). CI ya lo hacía bien porque fija `NODE_ENV` como
  variable real del job; esto solo cierra la brecha local. Sin dependencias nuevas.
**Bugs encontrados probando a mano antes de escribir las pruebas automatizadas** (ver
`specs/02-identidad/`):
- El limitador de tasa de `/auth/login` y `/auth/recuperar-clave` era la **misma instancia** de
  `express-rate-limit`, así que compartían contador: agotar los 5 intentos en uno bloqueaba el otro
  para el mismo correo. Ahora `limitar-tasa-auth.middleware.js` exporta una fábrica y cada ruta
  monta la suya.
- `restablecerClave` no reseteaba `intentos_fallidos`: alguien a un fallo del bloqueo que
  recuperaba su clave por correo seguía con el contador viejo. Ahora se resetea en la misma
  transacción.
- El campo real de contraseña en los esquemas es `clave`/`claveNueva`, no `password`; no estaba en
  `CAMPOS_CENSURADOS` de `config/logger.js`. Se agregó y se verificó con una prueba manual que
  compara la salida del logger antes y después.
**Consecuencia:** las próximas fases que agreguen un límite de tasa específico por ruta deben usar el
mismo patrón de fábrica, no una instancia compartida entre rutas con distinto propósito.

## 2026-08-28 · Bug: la CI fallaba dos veces después del primer push
**Contexto:** al verificar el primer run de CI, dos problemas aparecieron uno detrás del otro.
**Decisión 1:** `WEB_URL` se agregó al bloque `env` de `ci.yml`. Había pasado a `REQUERIDAS` en
`config/env.js` en el commit de la auditoría, pero nadie actualizó el workflow — la CI nunca se había
corrido hasta ese punto, así que nada lo había detectado antes.
**Decisión 2, más sutil:** `npm run db:migrate --if-present` seguía fallando después de eso. Los
scripts `db:migrate`/`db:seed` de Fase 0 apuntaban a `npx sequelize-cli db:migrate` sin que existiera
`config/config.json` ni ninguna migración — `--if-present` solo salta un script que **no existe**, no
uno que existe y falla al correr. Se sacaron ambos scripts (raíz y `apps/api`) hasta que Fase 1 los
necesite de verdad, junto con la config real de `sequelize-cli`.
**Motivo:** son placeholders que nunca se probaron porque nada los ejecutaba en local (`npm test` no
pasa por ahí). Solo la CI, corriendo por primera vez, los expuso.
**Consecuencia:** cualquier script nuevo que dependa de una herramienta externa (sequelize-cli, algo de
Fase 4/5) se agrega junto con su configuración mínima funcionando, no antes — un script que falla al
correr es peor que uno ausente, porque `--if-present` no lo protege.

## 2026-08-28 · Auditoría de seguridad de Fase 0, antes del primer push
**Contexto:** primer código real a punto de subir a GitHub. `auditor-seguridad` revisó config, errores,
logger, middlewares y el healthcheck. Encontró 2 hallazgos altos activos ya (no hipotéticos) y varios
medios; el detalle completo del reporte no se guarda aquí, solo lo que cambió y por qué.
**Decisión — arreglado antes del push:**
- `manejadorErrores` traduce el `SyntaxError` de `express.json()` a `422 JSON_INVALIDO` y registra el
  error con una lista blanca de campos (`tipo`, `mensaje`, `codigo`, `stack`), nunca el objeto completo.
  Antes, un JSON mal formado dejaba el cuerpo crudo de la petición en el log tal cual, sin pasar por la
  censura del logger (que no cubre la propiedad `body` de un `SyntaxError`).
- `detalles` en la respuesta de error ahora exige `esOperacional`, igual que `mensaje`: antes un
  `ErrorInterno` con `detalles` los devolvía al cliente aunque el mensaje estuviera enmascarado.
- `WEB_URL` pasó a variable obligatoria: tenía un default silencioso a `localhost:5173` que, con
  `credentials: true`, es un hueco de CORS si se olvida configurar en un despliegue real.
- `NODE_ENV` se valida contra una lista blanca (`development`/`test`/`production`) y `env.esProduccion`
  / `env.esDesarrollo` reemplazan las comparaciones de string sueltas. Antes, un typo como
  `NODE_ENV=produccion` hacía que `/api/v1/salud` (pública, sin auth) devolviera el mensaje de error de
  Sequelize completo.
- `database.js` fuerza TLS (`ssl.require`) cuando `env.esProduccion`.
- `app.js`: `trust proxy` a 1 salto en producción (sin esto, el límite de tasa cuenta a todos los
  usuarios detrás del mismo proxy como una sola IP) y `peticionId` pasa a UUID en vez del contador
  incremental de pino-http (filtraba volumen de tráfico).
- Las 7 subclases de error generadas por el factory de `errors/index.js` tenían `error.name` vacío
  (las class expressions no heredan el nombre de la variable externa); se fija con
  `Object.defineProperty`.
- `salud.service.js` cachea el resultado 5 segundos: sin eso, el límite de tasa permitía 300
  `sequelize.authenticate()` por ventana contra un pool de 5 conexiones.
- `docker-compose.yml` publica Postgres en `127.0.0.1:5433`, no `0.0.0.0`: ya no es alcanzable desde
  otra máquina en la misma red.
**Motivo:** ninguno de estos requería una decisión de diseño nueva, solo cerrar huecos entre lo que el
código decía hacer (los comentarios y docs/03-seguridad.md) y lo que hacía. El de mayor impacto es el
del log: activa en Fase 0 sin que exista todavía ningún endpoint que reciba datos personales.
**Descartado por ahora:** apagado ordenado con `SIGTERM`/`server.close()` (Fase 8, cuando exista un
despliegue real que lo necesite) y redacción recursiva del logger por profundidad arbitraria (la lista
explícita a nivel raíz + `req.body` cubre los patrones que el código de hoy usa; se amplía cuando Fase 1
introduzca formas nuevas de loguear).
**Consecuencia:** cualquier `log.error`/`log.warn` nuevo debe pasar por una forma explícita (como
`errParaLog` en el manejador), no por el objeto de error completo. Cualquier variable de entorno nueva
que sea un control de seguridad (como `WEB_URL`) va a `REQUERIDAS`, nunca con default silencioso.

## 2026-08-28 · Bug: `npm test -w apps/api` no encontraba el `.env` de la raíz
**Contexto:** primer `npm test` real, con Docker ya corriendo. `config/env.js` moría diciendo que
faltaban las 8 variables obligatorias, aunque `.env` existía y estaba completo.
**Decisión:** `env.js` ahora resuelve la ruta del `.env` con `path.resolve(__dirname, '../../../../.env')`
en vez de `dotenv.config()` sin argumentos.
**Motivo:** `dotenv.config()` busca `.env` relativo a `process.cwd()`, y `npm test --workspaces` (y
`npm run dev -w apps/api`) cambian el cwd al directorio del workspace (`apps/api`), no la raíz del
monorepo donde vive el `.env` real. Como sí funcionaba corriendo `node src/server.js` a mano desde la
raíz, el bug solo aparecía a través de npm — costó un rato aislar que no era un problema de Docker ni
de las variables mismas.
**Consecuencia:** cualquier script nuevo en `apps/api/package.json` que dependa de `config/env.js`
sigue funcionando sin importar desde dónde se invoque. Puerto real usado en este arranque: Postgres en
`5433` (host) por conflicto con otro contenedor local — ya reflejado en `.env.example` y `docker-compose.yml`.

## 2026-08-28 · Fase 0: qué variables son obligatorias al arrancar
**Contexto:** `config/env.js` debe fallar al arrancar si falta una variable, pero `.env.example` tiene
17 claves y varias (SMTP, límites de negocio) no las usa todavía ningún código de esta fase.
**Decisión:** obligatorias solo `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — exactamente las que ya exige `.github/workflows/ci.yml`.
El resto tiene default en código (`PORT=3000`, `WEB_URL=http://localhost:5173`, etc.) hasta que una
fase futura las necesite de verdad.
**Motivo:** exigir SMTP o los plazos de negocio ahora impediría levantar la API sin sentido (nada los
lee todavía). Los secretos de auth sí se exigen desde ya, aunque el login no exista hasta la Fase 1,
porque es la clase de variable que no debe improvisarse nunca ni quedar con un valor de ejemplo.
**Consecuencia:** cuando la Fase 1/4/7 empiece a leer `SMTP_*`, `SLA_RESPUESTA_DIAS`, etc., hay que
sumarlas a `REQUERIDAS` en `apps/api/src/config/env.js` en el mismo commit que las usa por primera vez.

## 2026-08-28 · Catálogo de errores como paquete del workspace, no ruta relativa
**Contexto:** `docs/04-manejo-de-errores.md` dice que el catálogo de códigos vive en `packages/errores/`
porque lo comparten API y web.
**Decisión:** `packages/errores` es un paquete real del workspace (`@proxi/errores`, con su
`package.json`), no una carpeta a la que se llega con `../../../`. `apps/api` lo declara como
dependencia normal y hace `require('@proxi/errores')`.
**Motivo:** una ruta relativa profunda se rompe si algún día se mueve `apps/api/src/middlewares/`, y no
dice nada sobre que ese código es compartido. Con workspaces, `npm install` en la raíz lo enlaza solo.
**Consecuencia:** cualquier paquete nuevo en `packages/` (validaciones, constantes) sigue este mismo
patrón: `package.json` propio + `name` con prefijo `@proxi/`.

## 2026-08-28 · `/api/v1/salud` responde 503 si la base no contesta, y nunca expone el motivo en producción
**Contexto:** el roadmap solo pedía "estado de la app y de la base"; no especificaba el código HTTP ni
qué tan detallada debía ser la respuesta cuando la base falla.
**Decisión:** `salud.service.js` devuelve `baseDeDatos.error` con el mensaje real solo si
`NODE_ENV !== 'production'`; el controller responde `200` si la base contesta y `503` si no.
**Motivo:** un healthcheck en `200` aunque la base esté caída no sirve para monitoreo (Fase 8 pide
"aviso ante caídas"), y el mensaje de error de Sequelize puede filtrar detalles de la conexión a quien
golpee el endpoint desde afuera.
**Consecuencia:** cualquier monitor de uptime debe tratar `503` de `/salud` como caída real, no como
error transitorio a ignorar.

## 2026-08-28 · Método de trabajo: especificación antes que código, de forma selectiva
**Contexto:** proyecto de un solo desarrollador, asistido por IA. El asistente no recuerda nada entre
sesiones y el hilo del proyecto se perdía en el chat.
**Decisión:** lo que tiene reglas de negocio o riesgo se especifica en `specs/<n>-<nombre>/` (spec,
plan, tareas) antes de programarse. Lo rutinario va directo al código. Las decisiones no obvias se
anotan aquí.
**Motivo:** el repositorio pasa a ser la memoria del proyecto. Cualquier sesión futura, o cualquier
otra persona, reconstruye el contexto leyendo `CLAUDE.md` y `docs/`. Se descartó especificar todo:
en proyectos de una persona esa disciplina se abandona en semanas.
**Consecuencia:** cada funcionalidad con reglas cuesta un rato de escritura antes de empezar. A cambio,
el asistente deja de reinventar criterios en cada sesión.

## 2026-08-28 · Nombre del proyecto: Proxi
**Contexto:** hacía falta un nombre neutro, usable en la FEN UAH y en un portafolio personal.
**Decisión:** Proxi. Repositorio `proxi`, base `proxi_dev` / `proxi_prod`.
**Motivo:** corto, pronunciable, sin amarre institucional.
**Consecuencia:** ninguna marca de la universidad aparece en el código; si mañana se instala en otra
facultad, solo cambia la configuración.

## 2026-08-28 · Arquitectura: API REST + cliente separado, en un monorepo
**Contexto:** alternativas evaluadas: monolito con plantillas EJS, API + SPA en React, o híbrido.
**Decisión:** `apps/api` (Express) y `apps/web` (HTML/CSS/Bootstrap/JS sin framework), mismo repo.
**Motivo:** cubre los aprendizajes esperados de los módulos 2 al 8 de la currícula (incluido el
consumo de API con fetch y la seguridad con JWT del módulo 8), y deja una frontera explícita donde
concentrar CORS, tokens y límite de tasa. React se descartó por no estar en la currícula: no sería
defendible en la evaluación y agrega superficie de error.
**Consecuencia:** hay que mantener dos aplicaciones y un contrato entre ellas. Se mitiga compartiendo
validaciones y códigos de error en `packages/`.

## 2026-08-28 · El ciclo de vida es el producto
**Contexto:** el diagnóstico de mercado mostró que el problema no es publicar, es cerrar.
**Decisión:** `fecha_cierre` obligatoria a nivel de base de datos, cierre con motivo obligatorio,
bloqueo de publicación a empresas con cierres sin declarar, y estado terminal garantizado para toda
postulación.
**Motivo:** cerca del 30% de los avisos nunca lleva a contratación y el ghosting subió 120% en cinco
años. Si estas reglas fueran opcionales, nadie las usaría y seríamos un portal más.
**Consecuencia:** el modelo de datos es más estricto y hay dos tareas programadas que mantener. Se
acepta: es la razón de existir del proyecto.

## 2026-08-28 · Alinear Proxi con las convenciones de los proyectos previos
**Contexto:** se revisó la carpeta `BOOTCAMP PROYECTOS`. `toolshare-api` (módulo 8) ya tiene el
esqueleto `src/{app,server,config,controllers,middlewares,models,routes}` con nombres
`<recurso>.<capa>.js`, CommonJS y el stack Express + Sequelize + JWT.
**Decisión:** Proxi adopta esa estructura y esos nombres tal cual, en vez de imponer convenciones
nuevas. Se agregan solo cuatro diferencias: capa `services/`, manejo central de errores, códigos HTTP
correctos con rol en el token, y pruebas obligatorias de acceso cruzado.
**Motivo:** la estructura ya es correcta y ya es familiar. Cambiarla porque sí agrega carga de
aprendizaje sin beneficio, y todo lo que se aprende aquí sirve para defender los módulos del bootcamp.
Se descartó kebab-case en los archivos de capa por lo mismo.
**Consecuencia:** la documentación quedó ajustada (`CLAUDE.md`, `05-convenciones.md`). El detalle de
qué se hereda y qué cambia está en `docs/investigacion/referencia-proyectos-previos.md`.

## 2026-08-28 · Pruebas con el corredor nativo de Node
**Contexto:** hay que introducir pruebas automatizadas en un proyecto de una persona que casi no las
ha usado antes.
**Decisión:** `node --test` + supertest, no Jest. Detalle en `docs/adr/0003-herramienta-de-pruebas.md`.
**Motivo:** cero configuración y cero dependencias extra. Lo que se abandona no protege a nadie.
**Consecuencia:** los ejemplos que se encuentren en internet estarán escritos para Jest y hay que
traducir las afirmaciones.

## 2026-08-28 · Hallazgo: archivos .env versionados en proyectos previos
**Contexto:** `toolshare-api`, `libro_autor_lib_M8_L2` y `peliculas-actores` tienen `.env` junto al
código.
**Decisión:** en Proxi, `.env` en `.gitignore` desde el primer commit; `.env.example` documenta las
claves con valores vacíos.
**Motivo:** un secreto que entra a git queda en el historial aunque después se borre el archivo.
**Consecuencia:** si alguno de esos repos previos llegó a GitHub, esas credenciales deberían rotarse.

## 2026-08-28 · El cliente web queda sin especificar (deuda consciente)
**Contexto:** la Fase 3 tiene spec completa con criterios de aceptación; la Fase 6 (cliente web) solo
tiene una lista de casillas.
**Decisión:** se deja así por ahora, con la advertencia escrita en el roadmap y en `ARRANQUE.md`.
Antes de la primera pantalla hay que escribir `specs/02-vitrina-publica/` y `docs/08-guia-visual.md`.
**Motivo:** especificar pantallas antes de que la API devuelva datos reales lleva a rehacer. Pero la
deuda queda anotada donde se va a leer, no en la memoria de nadie.
**Consecuencia:** el riesgo es llegar a la Fase 6 con prisa y improvisar la interfaz. El punto crítico
a no improvisar es la representación visual de los estados: si `publicada`, `cierra pronto` y `cerrada`
no se distinguen de un vistazo, el diferenciador del producto no llega al usuario.
