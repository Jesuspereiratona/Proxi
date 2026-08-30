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

## 2026-08-29 · Se terminó el sistema de insignias de estado que la guía visual ya había diseñado
**Contexto:** pedido explícito de "darle más vida" a la interfaz sin perder simplicidad ni el
nombre Proxi. Antes de inventar nada, se investigaron plataformas reales (Handshake, Symplicity —
el software que usan la mayoría de universidades para prácticas —, Laborum, Trabajando.com) para
comparar funcionalidades; el hallazgo de diseño más grande no vino de esa comparación, sino de
releer `docs/08-guia-visual.md`: documenta un color y una insignia por cada estado de postulación
(`recibida`/`en_revision`/`entrevista` → neutro, `seleccionada` → verde, `no_seleccionada` → rojo,
`sin_respuesta` → gris, `retirada` → gris tachado) y por cada estado de empresa
(`pendiente`/`validada`/`rechazada`/`suspendida`), con el contraste WCAG ya calculado a mano desde
Fase 6 — pero **nunca se implementó**. Los tres paneles (`postulaciones.html`, `postulantes.html`,
`panel-coordinacion.html`) mostraban el estado como `"Estado: texto"` en texto plano, contradiciendo
el principio que la propia Fase 6 se puso como meta: "los estados son el producto".
**Decisión:** dos clases CSS nuevas en `uah-theme.css` (`.estado-postulacion`, `.estado-empresa`),
con las variantes exactas que ya especificaba la guía — ningún color nuevo, ningún contraste sin
verificar. Dos funciones puras nuevas: `claseEstadoPostulacion()` en `linea-tiempo.js` (con
pruebas) y un mapa local en `panel-coordinacion.js` (uso único, no amerita su propio archivo). De
paso, transición suave (`transform`/`box-shadow`) en tarjetas al pasar el mouse y en botones al
hacer clic, con `prefers-reduced-motion` respetado — la parte de "más vida" que sí era nueva, no
documentada antes.
**Motivo:** terminar un sistema ya diseñado y auditado (accesibilidad incluida) es menor riesgo y
mayor impacto que agregar superficie nueva — el "más vida" que se pidió resulta ser, en gran parte,
que la interfaz cumpla lo que su propia especificación ya prometía.
**Investigación de funcionalidades (para después, no se tocó código todavía):** confirmado con
fuentes reales que Handshake y Symplicity tienen favoritos/guardar ofertas y alertas por correo de
ofertas nuevas que calzan con el perfil — ausentes en Proxi y candidatas razonables para un
incremento futuro. Auto-postulación (Laborum) se descartó a propósito: choca con el principio de
Proxi de que cada postulación importa y tiene una respuesta real. Sin cambios de alcance todavía,
solo quedó anotado.
**Consecuencia:** 431 pruebas en `apps/api` sin cambios (nada de backend), 37 en `apps/web` (3
nuevas para `claseEstadoPostulacion`), 0 fallas. Sin auditoría de seguridad — no toca auth, permisos,
transiciones de estado ni datos personales, es solo cómo se muestra un estado que la API ya
devuelve.

## 2026-08-29 · Portabilidad, borrado y retención — decisiones y auditoría de seguridad, antes del push (Fase 7, parte de código)
**Contexto:** primera vez que el proyecto borra/anonimiza datos de forma **irreversible** por
pedido del propio usuario, y primera tarea programada que manda correos automáticos sin que nadie
la dispare. `docs/03-seguridad.md` ya documentaba las tres obligaciones (portabilidad, supresión,
retención) desde Fase 0; nada las implementaba. Ver `specs/08-datos-personales/`.
**Decisiones:**
- **Alcance solo estudiante.** `docs/03-seguridad.md` describe las tres obligaciones enteramente en
  esos términos (CV, RUT, postulaciones); una empresa no tiene datos personales de una persona
  natural en el mismo sentido, y coordinación es personal interno. Portabilidad/borrado de empresa
  queda documentado como fuera de alcance, no como un olvido.
- **Una sola función anonimiza, `eliminarCuenta()`** — la llaman tanto `DELETE /mi-cuenta` como la
  tarea de retención, para que "qué significa borrar una cuenta" viva en un solo lugar.
- **El correo real se reemplaza por un marcador único (`eliminado-<id>-<random>@proxi.invalid`) en
  vez de borrar la fila de `usuarios`.** `.invalid` es un TLD reservado por RFC 2606, nunca
  resoluble ni registrable de verdad — un intento de login con el correo original ya no encuentra
  la fila y cae en el mismo `AUTH_CREDENCIALES_INVALIDAS` que un correo que nunca existió, sin
  ningún caso especial en `auth.service.js`. Borrar la fila habría roto todo lo que la referencia
  (`postulaciones.estudiante_id` vía `estudiantes.usuario_id`, sesiones, auditoría).
- **RETENCION_CV_MESES ya estaba en `.env`/`.env.example` desde una fase anterior** (valor 12), sin
  que nada lo leyera — el default de `env.js` replica ese valor, no inventa uno nuevo.
**Encontrado por `revisor-migraciones`, antes de aplicar la migración de la columna de aviso:**
- **[Bloqueante] La segunda pasada de `procesarRetencion` no filtraba por la antigüedad del aviso,
  solo por `IS NOT NULL`.** La primera noche después de desplegar, un estudiante inactivo pasaba las
  dos pasadas en la misma ejecución: se le avisaba y, segundos después, se le eliminaba en la misma
  corrida — el "aviso previo" de 30 días que pide `docs/03-seguridad.md` quedaba en cero días
  reales. Arreglado exigiendo `avisoRetencionEnviadoAt` más viejo que `RETENCION_AVISO_DIAS`
  (`Op.lt`, no `Op.ne: null`) antes de considerar la eliminación.
- Además: el orden de rollback de una migración que agrega una columna que el modelo ya declara
  (revertir la base antes de revertir el código deja cualquier consulta sobre esa tabla en 500) —
  anotado en `docs/07-operacion-y-mantenimiento.md`, que hasta ahora solo cubría el despliegue de ida.
**Auditado con `auditor-seguridad` antes del push — la revisión más extensa del proyecto hasta
ahora. Dos hallazgos Graves, uno Alto, varios Medios/Menores, todos corregidos:**
- **[Grave] Con el arreglo de arriba ya aplicado, alguien a quien se le avisó una vez y volvió a
  usar Proxi normalmente podía terminar eliminado en un ciclo de inactividad posterior sin recibir
  nunca un aviso vigente para ese ciclo** — nada limpiaba `avisoRetencionEnviadoAt` al volver a
  entrar, así que un aviso de hace un año seguía "cumpliendo" los 30 días de antigüedad que exige el
  filtro. Arreglado en `auth.service.js login()`: dentro de la misma transacción que ya actualiza
  `ultimoAccesoAt`, se limpia el aviso del estudiante (si lo es; si no, el `UPDATE` con ese `WHERE`
  simplemente no afecta ninguna fila). Reabre el ciclo completo de aviso cada vez que la persona
  vuelve de verdad.
- **[Grave] "Actividad" solo se actualizaba en el login con contraseña — una sesión web sostenida
  solo por refrescos de token (`sesion.js iniciarSesion()` en cada carga de página, Fase 6) nunca
  volvía a escribir `ultimoAccesoAt`.** Alguien que usa Proxi todas las semanas sin volver a teclear
  su contraseña quedaba con la fecha congelada en su primer login; a los 12 meses la tarea lo
  clasificaba como inactivo y, 30 días después del aviso, le borraba el CV, le anulaba el RUT y le
  reemplazaba el correo — mientras seguía usando la plataforma activamente, y sin forma de volver a
  entrar después (el correo real ya no existe). Arreglado con una línea en `auth.service.js
  refrescar()`: actualiza `ultimoAccesoAt` en la misma transacción que rota el token.
- **[Alto] La supresión anonimizaba a quien postuló, pero no el texto libre que escribió.**
  `postulaciones.mensaje` (la carta de presentación, hasta 2000 caracteres) y
  `postulacion_eventos.motivo` de un retiro propio seguían intactos y visibles para la empresa
  después de `DELETE /mi-cuenta` — con nombre, RUT o teléfono adentro si la persona los había escrito
  ahí, que es exactamente el tipo de texto libre que la gente pone en una carta de presentación.
  `docs/03-seguridad.md` dice literalmente "anonimiza postulaciones"; la primera versión no
  anonimizaba ninguna. Arreglado anulando `mensaje` y el `motivo` de los eventos actorados por el
  propio usuario, dentro de la misma transacción — se conserva el estado y la fecha de cada
  transición, que es "el evento estadístico sin identidad" que pide la spec.
- **[Medio] El disco se borraba antes de abrir la transacción.** Un fallo a mitad de camino (corte
  de conexión, la colisión de correo del punto siguiente) dejaba el CV destruido con la cuenta
  intacta — la persona recibía un error y creía que el borrado había fallado del todo, con su perfil
  todavía identificable pero su CV ya perdido sin vuelta. Arreglado invirtiendo el orden: toda la
  parte transaccional primero (incluido marcar el archivo como suprimido), `fs.unlink` — irreversible,
  no participa de un rollback — recién después del commit.
- **[Medio] El archivo suprimido no quedaba marcado como tal, solo le faltaban los bytes.** Un
  respaldo restaurado dentro de la ventana de retención de 30 días (`docs/07-operacion-y-
  mantenimiento.md`) repone el PDF con el mismo nombre, y `descargar()` solo comprobaba `fs.access`
  — el CV de alguien que ejerció su derecho de supresión podía volver a servirse. Arreglado usando
  `archivos.expira_at`, una columna que ya existía en el modelo y la migración desde Fase 4 sin que
  nadie la usara: se marca al suprimir, `descargar()` la revisa.
- **[Medio] Ni exportar los datos ni borrar la cuenta dejaban rastro en `auditoria_accesos`** —
  inconsistente con el resto del proyecto (`descargar_cv`, `ver_rut`) y con la obligación de poder
  decir, ante una brecha, qué cuentas se exportaron o se destruyeron. Arreglado con
  `accion:'exportar_datos'`/`'eliminar_cuenta'`, mismo patrón que las demás.
- **[Medio] La configuración de retención no se validaba al arrancar, y la tarea no tenía techo por
  corrida.** `RETENCION_CV_MESES` negativo o `RETENCION_AVISO_DIAS` mayor que el plazo total son
  errores de despliegue plausibles (una unidad mal puesta), y el primero, sin validación, habría
  hecho que la primera corrida calificara a toda la tabla de estudiantes para eliminarse. Arreglado
  con validación en `env.js` (enteros positivos, aviso menor que el plazo total en días) y un tope
  de 50 eliminaciones por corrida: si se supera, la pasada se aborta y queda un `logger.error`, no
  una base de estudiantes anonimizada de golpe.
- **[Baja] `eliminarCuenta` no era idempotente** — repetir la petición (o que el borrado manual y la
  tarea de retención coincidieran) rehacía todo el trabajo, incluido un bcrypt de costo 12 en el
  hilo principal cada vez. Arreglado con una salida temprana si `usuario.anonimizadoAt` ya está
  puesto.
- **[Baja] La marca de "cuenta ya anonimizada" era `estudiante.nombres === 'Estudiante eliminado'`**
  — un campo que el propio estudiante puede editar (`PATCH /estudiantes/perfil`), y que además nunca
  cubre cuentas sin perfil de estudiante. Arreglado con una columna dedicada,
  `usuarios.anonimizado_at`, que ningún endpoint expone para editar — nueva migración
  (`agregar-anonimizado-usuarios`), mismo patrón revisado que la anterior.
- **[Baja] `DELETE /mi-cuenta` no pedía ninguna confirmación para una acción irreversible.** Con un
  token de acceso robado y hasta 15 minutos de vida, alcanzaba para destruir la cuenta de otra
  persona sin que su dueño real confirmara nada. Arreglado exigiendo la contraseña actual en el
  cuerpo (`cuenta.schemas.js`), verificada antes de llamar a `eliminarCuenta` — la tarea de
  retención no pasa por ahí, no le hace falta: ya exige el aviso previo vencido.
- **[Observación, corregida] El registro de cuentas aceptaba cualquier dominio de correo**, incluido
  `.invalid` — alguien podía registrarse con el mismo patrón del marcador de una cuenta suprimida y
  quedar confuso en una revisión manual. Arreglado con un `refine` en `registroEsquema`.
- **[Observación, corregida] `correo.service.js` registraba el correo del destinatario en el log**
  en dos lugares — viola una regla dura de `CLAUDE.md`, preexistente de Fase 1. Se corrigió de paso:
  esta es la primera tarea que llama `enviarCorreo` fuera del flujo de registro/recuperación.
- **[Observación, corregida] La respuesta de `GET /mi-cuenta/datos` (lleva el RUT en claro) no
  tenía `Cache-Control: no-store`.** Una línea en el controller.
- **[Observación, corregida] La exportación no incluía los consentimientos otorgados** (versión de
  política, fecha) — parte de lo que un pedido de portabilidad debería mostrar. Agregado.
**Verificado real, no solo con mocks:** contra la base de desarrollo con curl real —
`GET /mi-cuenta/datos` de una cuenta demo real trae el RUT descifrado, el CV y la línea de tiempo
correctos. El borrado en sí **no** se probó contra ninguna cuenta demo persistente (habría destruido
los datos de prueba usados para que el usuario siguiera navegando los paneles) — queda cubierto por
las 18 pruebas nuevas de `cuenta.test.js`, incluidas dos que reproducen exactamente los dos
hallazgos Graves (avisar, volver a entrar, inactivarse de nuevo, y confirmar que no se elimina sin
un aviso vigente; refrescar la sesión y confirmar que cuenta como actividad). 431 pruebas en
`apps/api`, 34 en `apps/web`, 0 fallas.

## 2026-08-29 · Panel de coordinación — decisiones y auditoría de seguridad, antes del push (cierra Fase 6)
**Contexto:** última pantalla de Fase 6 — con esta, los tres roles pueden usar Proxi de punta a
punta sin `curl`. Coordinación es el rol con más poder del sistema (valida/rechaza/suspende
empresas, aprueba/rechaza ofertas, ve indicadores sin el umbral que sí aplica la vista pública).
Ver `specs/07-panel-coordinacion/`.
**Decisiones:**
- **Una sola pantalla, tres secciones**, no tres archivos como empresa/estudiante: a diferencia de
  esos paneles, coordinación no crea ni edita nada, solo lista y decide — mucha menos superficie por
  sección como para justificar separarlas.
- **`GET /empresas` (nuevo, `listarTodas()`) devuelve la fila completa, sin whitelist** — a
  propósito, no un descuido: `listarPendientes()` (Fase 2) ya hacía lo mismo, y `rutEmpresa`/
  `sitioWeb`/`contactoNombre` son justo los campos que coordinación necesita para poder verificar
  que una empresa existe de verdad antes de validarla. La whitelist de `obtenerPerfilPublico()` es
  para el público, no aplica acá.
- **Motivo obligatorio por `prompt()`**, mismo patrón que el rechazo (opcional) del panel de
  empresa, pero acá el cliente sí corta si vuelve vacío o cancelado — la API también lo exige
  (`rechazoEsquema`/`suspensionEsquema`), así que es consistencia, no una regla nueva.
**Auditado con `auditor-seguridad` antes del push — sin hallazgos Alto/Grave, dos Media y dos
observaciones corregidas:**
- **[Media] Coordinación aprobaba ofertas y validaba empresas viendo solo el título/nombre — el
  control humano de `docs/03-seguridad.md` §5 ("corta el spam y las ofertas fraudulentas") era un
  trámite por el nombre.** Escenario real: una oferta con título inocuo puede tener una
  `descripcion` que pide RUT y cédula por WhatsApp a un número externo; una empresa con razón social
  creíble puede tener un RUT inventado y un contacto falso. Ninguno de los dos se nota mirando solo
  el campo que la tarjeta mostraba. Arreglado agregando a cada tarjeta lo que ya traía la API sin
  pedirlo de nuevo: para una oferta, descripción, requisitos, modalidad, comuna, jornada,
  remuneración y fecha de cierre; para una empresa, RUT, giro, sitio web, comuna y contacto.
- **[Baja, en dos endpoints de empresas y uno de ofertas] Un motivo de solo espacios pasaba la
  validación** (`z.string().min(1)` sin `.trim()`, ejecuté los tres esquemas directamente para
  confirmarlo). El cliente ya se defendía bien (`pedirMotivo()` recorta y corta si queda vacío), así
  que no hay forma de llegar a esto desde el panel — pero por curl, una empresa podía quedar
  `rechazada` o, peor, `suspendida` (estado terminal, sin transición de salida) con un motivo que se
  pinta en blanco y nadie puede saber por qué. Arreglado con `.trim()` antes de `.min(1)` en los tres
  esquemas (`rechazoEsquema`/`suspensionEsquema` de empresas, `rechazoEsquema` de ofertas).
- **[Observación, corregida] Las transiciones de empresa (`validar`/`rechazar`/`suspender`) no
  tenían compare-and-set — las de oferta sí, desde la auditoría de Fase 3.** Dos coordinadores
  actuando a la vez sobre la misma empresa pendiente (uno "Validar", otro "Rechazar") pasaban los
  dos el chequeo de `puedeTransicionar` y el segundo pisaba al primero sin ningún aviso; si ganaba
  "Validar", el motivo de rechazo que alguien acababa de escribir se descartaba en silencio. Era
  preexistente de Fase 2 y solo alcanzable por curl hasta ahora — este panel es lo primero que pone
  a dos personas con la misma pantalla abierta haciendo clic en paralelo. Arreglado con el mismo
  patrón que ya usa `ofertas.service.js transicionar()`: el estado anterior va en el `WHERE`, 0 filas
  afectadas es un 409, no una pisada silenciosa. Prueba nueva con dos peticiones concurrentes reales
  (`Promise.all`), mismo patrón que la de ofertas de Fase 3.
- **[Observación, corregida] La tabla de indicadores no decía nada cuando estaba vacía** — se
  quedaba con el `<tbody>` en blanco sin explicación, incumpliendo el caso borde de la propia spec.
  Arreglado con una fila de texto cuando la lista viene vacía.
**Hallazgo propio, no de seguridad:** la vista materializada de indicadores traía filas con
`Empresa` nula — empresas de prueba que otros archivos de test habían borrado con su `after()`,
porque `npm test` corre contra `proxi_dev`, la misma base que uso para probar a mano en el
navegador, no una base de test aparte. Se refrescó la vista (`REFRESH MATERIALIZED VIEW
CONCURRENTLY`) para la demo, y ya que la interfaz tenía que manejar el caso de todos modos —una
empresa borrada de verdad será un escenario real en cuanto exista Fase 7— se le agregó un texto de
reemplazo ("(empresa eliminada)") en vez de dejar la celda en blanco.
**Verificado real, no solo con mocks:** flujo completo contra la API real con Chrome headless
(empresa pendiente, empresa validada, oferta en revisión, las tres secciones con datos reales,
validar/aprobar). 413 pruebas en `apps/api`, 34 en `apps/web`, 0 fallas.

**Fase 6 cerrada.** Cinco auditorías de seguridad a lo largo de la fase (vitrina, sesión, panel de
estudiante, panel de empresa, panel de coordinación) — ningún hallazgo Alto o Grave llegó a
producción sin corregir. Sigue Fase 7 (datos personales).

## 2026-08-29 · Panel de empresa — decisiones, bugs y auditoría de seguridad, antes del push
**Contexto:** cuarta pantalla de Fase 6, primera que **no agrega ni una línea nueva al backend**
salvo un `include` — todo lo que necesita (perfil, CRUD de ofertas, revisar postulantes,
transiciones) ya existía y estaba probado desde las Fases 2 a 4. Ver `specs/06-panel-empresa/`.
**Decisiones:**
- **`GET /postulaciones/oferta/:id` pasó de devolver solo ids y estado a incluir
  `nombres`/`apellidos`/`carrera` del postulante**, con `attributes` explícito (ni RUT ni teléfono)
  — sin esto, "ver postulantes" no tenía forma de mostrar *a quién* le llegó una postulación.
  Necesitó un alias explícito nuevo, `Postulacion.belongsTo(Estudiante, {as:'Estudiante'})`, por la
  misma cautela que dejó el bug de "Ofertum" en Fase 6 parte 3: no confiar en que `inflection`
  singularice bien un sustantivo sin haberlo probado.
- **El formulario de oferta manda un PATCH con un diff manual (`construirParche` en
  `mis-ofertas.js`) contra lo que trajo la API, no el formulario entero.** `ofertas.service.js
  editar()` reacciona a que un campo *venga* en el body, no a que su valor haya cambiado de verdad
  — reenviar el formulario completo habría mandado cualquier oferta `publicada` de vuelta a
  `borrador` cada vez que alguien abriera "Editar" y le diera a "Guardar" sin tocar nada.
- **`linea-tiempo.js` (Fase 6 parte 3) ganó un segundo parámetro, `rolPropio`**, en vez de
  duplicarse para el panel de empresa: `quienMovio`/`formatoLineaTiempo` ya sabían deducir "quién
  movió cada estado" del propio `estadoNuevo`, solo faltaba saber desde qué lado se está mirando
  para decidir quién es "Tú". Por defecto `'estudiante'` (compatible con el código ya en producción,
  sin tocar sus pruebas).
- **`ErrorApi`/`cuerpoDeError` ahora propagan `detalles`** (el arreglo `{campo,mensaje}` que
  `validar.middleware.js` ya calculaba desde Fase 0 y que el cliente descartaba). El formulario de
  oferta es el primero con suficientes reglas cruzadas (remunerada↔montoMensual, modalidad↔comuna,
  fecha de cierre) como para que el mensaje genérico de `VALIDACION_ENTRADA` no alcance.
**Bug encontrado al probar:** el selector de motivo de cierre se veía visible en la captura sin
que nadie hubiera tocado "Cerrar" — `.d-flex` de Bootstrap 5 es una utilidad con `!important`, y le
gana al `display:none` que el navegador aplica a `[hidden]`; con las dos clases puestas a la vez,
`contenedor.hidden = true` no ocultaba nada. Se encontró mirando la captura real, no adivinando (el
mismo tipo de descuido que el bug de `.card-body` de Fase 6 parte 3, pero en la dirección contraria:
ahí un hijo se estiraba de más, acá un contenedor no se escondía). Arreglado postergando la clase
`d-flex` hasta el momento de abrir el bloque, en vez de dejarla puesta junto con `hidden` desde el
principio.
**Auditado con `auditor-seguridad` antes del push — sin hallazgos Alto/Grave, cuatro Media/Baja
corregidos:**
- **[Media] Ver la lista de postulantes de una oferta no dejaba rastro en `auditoria_accesos`.**
  Antes de esta pantalla, `GET /postulaciones/oferta/:id` devolvía filas sin identidad (ids y
  estado); ahora devuelve nombre y carrera de cada postulante, y esa lectura no quedaba registrada
  en ningún lado — `docs/03-seguridad.md` exige registrar cada vez que alguien ve datos de un
  estudiante, no solo cuando descarga su CV. Arreglado con una fila de `AuditoriaAcceso` por
  listado (no una por postulante), acción `ver_postulantes`, mismo patrón que `ver_rut` y
  `descargar_cv`.
- **[Baja-media] Un `<input type="hidden" name="id">` que nadie leía ni rellenaba viajaba vacío en
  cada PATCH**, lo que además dejaba en los hechos inerte el guard de "sin cambios no manda nada"
  (`Object.keys(parche).length === 0` nunca se cumplía porque `parche.id` siempre tenía algo).
  Inofensivo hoy porque Zod descarta claves no declaradas, pero es exactamente el tipo de campo que
  un cambio futuro de esquema (o un `Model.update(req.body)` sin lista blanca) volvería peligroso.
  Arreglado borrando el input: nadie lo usaba.
- **[Baja-media] Vaciar un campo opcional (`comuna` al pasar a modalidad remota, `montoMensual` al
  dejar de ser remunerada) no se enviaba nunca — el cambio se perdía en silencio y la interfaz decía
  "Guardado."** `construirParche` solo recorría `Object.keys(datos)`, y esos dos campos ya se habían
  borrado de `datos` antes de llegar ahí si quedaban vacíos; nunca se detectaban como "cambiaron",
  solo como "no están". Escenario real: una oferta remunerada en $400.000 donde la empresa desmarca
  "Remunerada" y borra el monto — el PATCH mandaba solo `{remunerada:false}`, y `monto_mensual`
  quedaba huérfano en la base con el valor viejo mientras la oferta se mostraba como no remunerada.
  Arreglado en dos capas: `construirParche` ahora recorre una lista fija de campos del formulario
  (no las claves de `datos`) y manda `null` explícito para los dos campos anulables cuando se
  vacían; `comuna`/`montoMensual` ganaron `.nullable()` en `ofertas.schemas.js`, y el cruce
  `datos.montoMensual === undefined` de `validarCruces` pasó a `== null` (un `null` explícito es
  tan "falta el monto" como un `undefined`).
- **[Baja] El texto de un `prompt()` de rechazo decía "solo lo ves tú" sobre el motivo, pero la
  propia empresa tampoco lo veía nunca** — el `attributes` que excluye `motivo` de la línea de
  tiempo (Fase 6 parte 3) aplicaba igual a las tres partes, empresa incluida, así que el campo había
  quedado de solo escritura. Al mirar de cerca esto también era un incumplimiento real de la regla 4
  de `specs/06-panel-empresa/spec.md` ("el motivo de rechazo... se le sigue mostrando [a la
  empresa] sin restricción"), así que en vez de solo corregir el texto se implementó la regla de
  verdad: `obtenerPropiaDeEmpresa` (a diferencia de `conEventos`, que sigue sin tocar) ahora incluye
  `motivo` en sus eventos — es la propia nota de la empresa, mostrársela de vuelta no es una fuga.
  `linea-tiempo.js formatoLineaTiempo` solo agrega la clave `motivo` cuando `rolPropio==='empresa'`
  y el evento la trae, para no reintroducir sin querer el problema en el lado del estudiante (hay
  prueba explícita de ambos casos). De paso se corrigió la spec: decía "motivo obligatorio al
  rechazar" pero Fase 4 ya lo había hecho opcional a propósito (`motivoOpcionalEsquema`, compartido
  con el retiro) — la spec tenía el error, no el código.
- **[Observación menor] El select de motivo de cierre venía con "Contratado" preseleccionado**, así
  que dos clics rápidos ("Cerrar" → "Confirmar") podían declarar una contratación que no ocurrió.
  No infla ningún indicador público (la vista materializada cuenta `resultado_declarado`, no el
  valor de `motivoCierre`), pero ensucia el dato del que vive el proyecto. Arreglado con un
  placeholder deshabilitado y el botón "Confirmar" inhabilitado hasta elegir un motivo real.
- **[Observación menor, preexistente, no corregida]** El CV de una postulación `retirada` o
  `sin_respuesta` sigue siendo descargable por la empresa — viene de Fase 4 y no es un bug (el
  retiro no borra que la postulación existió), pero es una decisión de retención que conviene tomar
  explícitamente en Fase 7, no dejar por omisión. Anotado, no tocado en este push.
**Verificado real, no solo con mocks:** flujo completo contra la API real con Chrome headless
(perfil de empresa, crear oferta, enviar a revisión, aprobar por API porque coordinación todavía no
tiene panel, publicar, ver postulantes con nombre y carrera reales) — así se encontró el bug del
`d-flex`/`hidden`. 407 pruebas en `apps/api`, 34 en `apps/web`, 0 fallas.

## 2026-08-29 · Panel de estudiante — decisiones, bugs y auditoría de seguridad, antes del push
**Contexto:** primer panel autenticado de Fase 6 — primera vez que `apps/web` sube un archivo con
sesión (el CV) y descarga un binario protegido, no solo consume JSON público. Ver
`specs/05-panel-estudiante/`.
**Decisiones:**
- **La línea de tiempo de una postulación muestra `estadoAnterior`/`estadoNuevo`/`createdAt` y nada
  más.** `linea-tiempo.js` deduce "lo movió la empresa o el sistema" del propio `estadoNuevo` (la
  máquina de estados de `postulaciones/estados.js` ya lo determina sin ambigüedad), así que no hace
  falta exponer `actorUsuarioId` para eso. Se decidió antes de que la auditoría lo encontrara como
  fuga real (ver más abajo) — la intención ya era no mandarlo, la implementación inicial se quedó
  corta en un solo lugar.
- **`descargarArchivo()` pide el binario con `fetch` autenticado y arma un `<a download>` temporal
  con un object URL**, no un `<a href>` directo al endpoint: un enlace público no puede llevar el
  header `Authorization`, y el CV nunca se sirve por una ruta sin sesión (`docs/03-seguridad.md`).
  Necesitó exponer `Content-Disposition` en el `cors()` de `app.js` (oculto por defecto en
  respuestas cross-origin) para que el nombre real del archivo llegue al cliente.
- **`usuarioActual()` decodifica el JWT en memoria sin verificar la firma.** Sirve solo para decidir
  qué mostrar (qué panel, qué botón) — cada petición real la revalida el servidor con la firma
  completa, así que decodificar sin verificar acá no es una superficie nueva de ataque, es una
  lectura de un dato que el propio dueño del token ya puede leer en texto plano.
**Bugs encontrados al construir:**
- **Alias de Sequelize: `Postulacion.belongsTo(Oferta)` sin `as` explícito generaba el alias
  `"Ofertum"`, no `"Oferta".`** La librería `inflection` que usa Sequelize para singularizar
  interpreta la "a" final de "Ofertas" como marca de plural en latín. No era un problema mientras
  nadie hacía `include` de esa asociación (Fases 3-4); se volvió visible recién ahora que "mis
  postulaciones" necesita traer la oferta. Arreglado con `as: 'Oferta'` explícito en
  `models/index.js` (mismo problema y mismo arreglo en `OfertaEvento.belongsTo(Oferta)`) — y, una
  vez que una asociación tiene *cualquier* alias explícito, Sequelize exige que **todo** `include`
  de esa asociación lo repita, aunque no haya ambigüedad, así que los tres `include:[{model:Oferta}]`
  ya existentes (dos en `postulaciones.service.js`, uno en `archivos.service.js`) necesitaron el
  mismo `as: 'Oferta'` para no romper con un 500.
- **Dos bugs visuales reales en Bootstrap, encontrados al mirar las capturas de Chrome headless, no
  adivinados:** los botones se veían con el azul por defecto de Bootstrap en vez del naranja de
  marca — las clases precompiladas del CDN (`.btn-primary`) traen sus propios `--bs-btn-*` con
  valores hexadecimales fijos desde Sass, no leen la variable `--bs-primary` del root (solo las
  clases *utilitarias* como `.text-primary` lo hacen); y una insignia/botón dentro de una `.card` se
  estiraba al ancho completo de la tarjeta — `.card` es `flex-column` en Bootstrap 5, así que
  cualquier hijo directo hereda `align-items:stretch`, confirmado midiendo
  `getComputedStyle(el).width` de verdad, no asumiendo. El segundo bug ya estaba en producción desde
  la vitrina pública (`tarjeta-oferta.js`) sin que nadie lo hubiera notado; se corrigió ahí también,
  envolviendo el contenido en `.card-body` en ambos componentes.
**Auditado con `auditor-seguridad` antes del push — sin hallazgos Alto/Grave, cuatro Media/Baja,
todos corregidos:**
- **[Media] La línea de tiempo exponía `motivo` y `actorUsuarioId` a la otra parte de la
  postulación**, pese a que la decisión de diseño ya era no mostrarlos. El `attributes` que los
  excluye se había puesto en el helper `conEventos()` que usan `obtenerPorId`/
  `obtenerPropiaDeEstudiante`, pero `obtenerPropiaDeEmpresa` arma su propio `include` a mano (por el
  `where` de pertenencia sobre `Oferta`) y ese segundo `include` de `PostulacionEvento` se quedó sin
  la lista blanca. `motivo` es una nota libre que la empresa escribe pensando en su propio proceso
  ("no contratar, mala actitud"), nunca en que el estudiante rechazado la va a leer textual — un
  riesgo real de reputación y no solo de forma. Arreglado repitiendo el mismo `attributes` en el
  `include` de `obtenerPropiaDeEmpresa`; la prueba de "el detalle incluye la línea de tiempo" ahora
  itera el token del estudiante **y** el de la empresa, que es como se encontró que solo la primera
  rama estaba cubierta.
- **[Media] El nombre original del CV no se saneaba.** El número mágico `%PDF-` valida el
  *contenido*, pero nada impedía subir un PDF real llamado `cv.html`; con `Content-Disposition` ya
  exponiendo ese nombre a una descarga real (decisión de esta misma fase), alguien que lo descargue
  y lo abra desde el gestor de descargas en vez de un lector de PDF lo ejecutaría como HTML en
  origen `file://`. Arreglado forzando la extensión a `.pdf` en `archivos.service.js` al momento de
  subir (`nombreArchivoSeguro`), no en cada descarga.
- **[Baja] `subirCv` devolvía `nombreAlmacenado`** (el UUID interno en disco) en la respuesta al
  cliente, sin que la interfaz lo usara para nada. Arreglado con una lista blanca explícita en el
  controller: `{id, nombreOriginal, tamanoBytes}`.
- **[Baja] `refrescarUnaVez` borraba el token de sesión ante cualquier respuesta no exitosa de
  `/auth/refrescar`**, incluido un `429` (límite de tasa compartido, que `oferta.html` puede
  disparar en una visita pública) o un `500` transitorio — ninguno de los dos prueba que la sesión
  murió. Arreglado: solo `401`/`403` limpian el token; un fallo ambiguo o de red lo deja como está.
**Bug propio, encontrado al re-correr las pruebas después de aplicar los cuatro arreglos de
arriba:** el mismo olvido de la lista blanca en `obtenerPropiaDeEmpresa` (primer hallazgo Media)
hizo fallar la prueba ya escrita para el otro camino, y la prueba de subida de CV seguía afirmando
sobre `tipo`/`nombreAlmacenado` en el cuerpo de la respuesta — campos que el tercer arreglo (Baja)
acababa de sacar a propósito. Ambas se corrigieron para afirmar sobre el comportamiento nuevo, más
seguro, no para volver al anterior.
**Verificado real, no solo con mocks:** flujo completo contra la API real con Chrome headless
(login → crear perfil → subir un PDF real → postular → listar "mis postulaciones" con oferta y
empresa → ver la línea de tiempo → retirar → confirmar que una segunda postulación a la misma
oferta se bloquea) — así se encontraron los dos bugs visuales de Bootstrap. 402 pruebas en
`apps/api`, 29 en `apps/web`, 0 fallas.

## 2026-08-29 · Sesión web (login) — decisión y auditoría de seguridad, antes del push
**Contexto:** primera vez que `apps/web` maneja credenciales, cookies y un token de acceso — hasta
ahora todo era público y sin sesión. Es la base que necesitan los tres paneles de Fase 6
(estudiante, empresa, coordinación), así que se construyó antes que cualquiera de los tres.
**Decisión:** el token de acceso vive **solo en una variable de módulo en memoria**, nunca en
`localStorage` ni `sessionStorage` (`docs/03-seguridad.md`). Como `apps/web` es multipágina (cada
HTML es una carga nueva, no una SPA con router), esa variable se pierde en cada navegación a
propósito — cada página protegida la repone llamando a `POST /auth/refrescar`, apoyándose en la
cookie `httpOnly` que ya emite el login de Fase 1. Cuesta una llamada de red extra por carga de
página; a cambio, ningún script de la página puede leer el token en ningún momento entre
navegaciones, porque no hay ningún momento en que esté guardado en algo que JS pueda leer aparte de
esa variable.
**Auditado con `auditor-seguridad` antes del push** — encontró algo real y no trivial:
- **[Alto] Dos peticiones autenticadas en paralelo, con el token vencido, disparan dos refrescos
  simultáneos.** El backend de Fase 1 rota el token de refresco en cada uso y detecta reuso: un
  segundo refresco con la misma cookie mientras el primero ya la invalidó se lee como robo y
  **revoca todas las sesiones del usuario**, en todos sus dispositivos. Es justo el mecanismo que
  existe para detectar un token robado — dispararlo solo por una carrera del cliente lo vuelve
  inservible como señal real (quien opere esto aprende a ignorarlo). Latente en este push (ninguna
  pantalla llama todavía a una ruta autenticada), pero se vuelve real en cuanto exista la primera
  pantalla protegida, así que se arregló ahora en vez de dejarlo para después. Arreglado
  serializando `refrescarSesion()` en dos niveles: un `promise` compartido dentro de la misma
  pestaña, y `navigator.locks` (Web Locks, nativo del navegador, sin dependencia nueva) entre
  pestañas del mismo origen — el caso más probable es abrir varias pestañas juntas al iniciar el
  navegador, todas comparten la misma cookie. De paso, un refresco fallido ahora limpia el token en
  vez de dejarlo "vivo" en memoria (evitaba que cada llamada autenticada gastara dos peticiones
  contra el límite de tasa compartido por IP, sin forma de que la interfaz supiera que la sesión
  había muerto).
- **[Medio] `AUTH_CUENTA_BLOQUEADA` con mensaje propio reintroducía la enumeración de usuarios.**
  Ese código solo se lanza si el correo existe, antes de revisar la contraseña — Fase 1 ya se había
  cuidado de esto en el backend, pero el cliente nuevo lo deshacía mostrando un texto distinto al
  de credenciales inválidas. Con el patrón de correos institucionales de la FEN, es una forma
  barata de armar una lista de destinatarios para phishing dirigido. Arreglado: mismo mensaje que
  `AUTH_CREDENCIALES_INVALIDAS`. `AUTH_EMAIL_NO_VERIFICADO` no tiene este problema (se lanza
  después de validar la contraseña).
- **[Medio-bajo] El formulario de login no declaraba `method="post"`.** Si el módulo de `login.js`
  no llegaba a ejecutarse por cualquier motivo (CSP futura, error de red al pedir el script), el
  envío nativo del navegador mandaba la contraseña como query string en un GET — queda en el
  historial del navegador y en cualquier log de acceso. Arreglado con un atributo.
**Verificado real, no solo con mocks:** login real desde `localhost:5173` hacia `localhost:3000`
establece la cookie cross-origin y un refresco posterior la usa con éxito; contraseña incorrecta
muestra el mensaje traducido. La corrección de la carrera se probó con `node --test` real —
Node 26 trae una implementación real de `navigator.locks`, así que la prueba no es un mock del
mecanismo de bloqueo, es el mecanismo real ejercitado con dos llamadas en paralelo. No se pudo
reproducir el mismo escenario con dos peticiones reales concurrentes en un navegador real dentro de
este entorno: la combinación específica de dos `POST` con cookies bajo el modo de tiempo virtual de
Chrome headless se colgó de forma reproducible incluso con las piezas por separado funcionando bien
(Web Locks solos, `fetch` concurrente solo, login+refresco secuencial) — se documenta como
limitación de la herramienta de verificación usada en este entorno, no como algo sin resolver del
lado de la aplicación.
**Riesgo de despliegue anotado para Fase 8, no resuelto ahora:** la cookie de refresco usa
`sameSite: 'strict'`; `localhost:5173`/`localhost:3000` son *same-site* (el puerto no cuenta para
`SameSite`, solo el dominio registrable), así que esta verificación no prueba el caso donde Fase 8
ponga la API y la web en dominios registrables distintos — ahí la cookie se perdería en silencio.
Es una decisión de hosting que hay que tomar antes de escribir la infraestructura, no después.
También falta CSP propia para `apps/web` (pendiente de Fase 8, ya anotado en la auditoría de la
vitrina pública) — ahora hay una página que recibe contraseñas, así que pesa más que antes.

## 2026-08-29 · Auditoría de seguridad de Fase 6 (vitrina pública), antes del push
**Contexto:** primera vez que el proyecto tiene código de cliente y primera vez que un dato
escrito por un usuario (`sitioWeb` de una empresa) termina en un `href` que otra persona puede
hacer clic. `auditor-seguridad` encontró 1 hallazgo grave, 1 medio-alto y 5 bajos — el primero
verificado de punta a punta contra la API real, no solo en el código.
**Arreglado:**
- **[Grave] XSS almacenado vía `sitioWeb` con URI `javascript:`.** El esquema de
  `empresas.schemas.js` aceptaba cualquier string (`z.string().min(1)`), el servicio lo guardaba
  tal cual, `obtenerPerfilPublico` lo publicaba sin autenticar, y `empresa.js` lo asignaba directo
  a `enlaceSitio.href`. Peor: `sitioWeb` está en `CAMPOS_EDITABLES` pero no en `CAMPOS_IDENTIDAD`,
  así que una empresa ya validada podía cambiarlo sin volver a pasar por revisión de coordinación —
  el control humano quedaba completamente eludido. Cadena de explotación verificada real: empresa
  validada → `PATCH /empresas/perfil {"sitioWeb":"javascript:fetch(...)"}` → 200, sigue validada →
  `GET /empresas/:id` (público) lo expone → cualquiera que hace clic en "Sitio web" ejecuta el
  script en el origen de Proxi. Arreglado en dos capas: el esquema exige `z.string().url()` **más**
  un `refine` que confirma el protocolo (`http:`/`https:` únicamente) — `z.string().url()` sola no
  alcanza, `new URL('javascript:...')` es una URL válida para Zod; y `empresa.js` revalida el
  protocolo antes de fijar el `href`, defensa en profundidad en el cliente aunque el servidor ya
  corte el problema de raíz.
- **[Medio-alto] La vitrina podía mostrar la razón social de una empresa que dejó de estar
  validada.** El `include` de `Empresa` que se agregó a `listarPublicas`/`obtenerDetalle` no
  filtraba por `estadoValidacion`. Combinado con que `actualizarPropio()` revierte una empresa
  `validada → pendiente` al cambiar razón social/RUT pero **nunca tocaba sus ofertas ya
  publicadas** (a diferencia de `suspender()`, que sí cierra en cascada desde Fase 3), una empresa
  podía cambiar su identidad y la vitrina seguía mostrando el nombre nuevo — sin revisar — pegado a
  una oferta vigente. Arreglado por el lado del dominio, no con un parche en la consulta:
  `actualizarPropio()` ahora llama a la misma `ofertasService.cerrarPorSuspension()` que ya usa
  `suspender()`, dentro de la misma transacción, cuando la transición es `validada → pendiente`.
  Ver la decisión de renombrar (o no) esa función más abajo.
- **[Bajo] `servidor-dev.js`: el chequeo de path traversal usaba `startsWith(RAIZ)` sin
  separador**, así que un hermano como `apps/web-backup` habría pasado el filtro por compartir el
  prefijo de texto. Arreglado con `path.relative` + chequeo de `..`/ruta absoluta, más
  `fs.realpath` antes de servir (para que un symlink dentro de `apps/web` no lo esquive) y
  `X-Content-Type-Options: nosniff` en cada respuesta.
- **[Bajo] `servidor-dev.js` escuchaba en todas las interfaces.** Con `npm run dev` corriendo en
  la red de la universidad, el sitio de desarrollo quedaba alcanzable por cualquiera en esa red.
  Arreglado: `servidor.listen(PUERTO, '127.0.0.1', ...)`.
- **[Bajo] El `id` de la URL entraba sin `encodeURIComponent` a la ruta de la API.** Inofensivo hoy
  (el cliente no manda credenciales), pero es el hábito que hay que tener antes de que una fase
  futura le agregue sesión a este mismo `cliente.js`. Arreglado en `api/ofertas.js` y
  `api/empresas.js`.
- **[Bajo] Sin debounce, escribir en el filtro de área disparaba una petición por tecla** contra el
  límite de tasa global compartido por IP — en la red de la universidad, un puñado de personas
  usando la vitrina normalmente agotaba el límite para todos. Arreglado con debounce de 300ms en
  `vitrina.js`, más un contador de petición para descartar una respuesta lenta que llegue después
  de una más nueva (evita que una respuesta fuera de orden pise el filtro que la persona ya cambió).
- **[Observación] CDN sin `integrity`.** Se agregó `integrity`/`crossorigin` al `<link>` de
  Bootstrap en las tres páginas, con el hash sha384 calculado sobre el artefacto real de la versión
  fijada (5.3.3) — no un valor de un tercero sin verificar. Google Fonts se deja sin `integrity` a
  propósito: su respuesta varía por user-agent, es la práctica estándar no fijarla.
**Registrado sin cambiar código:** la CSP de `helmet()` (Fase 0) protege solo a `apps/api`; las
páginas de `apps/web` no tienen CSP propia todavía, y una CSP ahí habría bloqueado igual el `href`
`javascript:` del hallazgo grave. Ya estaba anotado como pendiente de Fase 8 en `config.js`; queda
confirmado que es un requisito de despliegue, no un detalle.
**Pruebas agregadas:** `sitioWeb` con `javascript:`/`data:` → 422, en creación y en edición; cambiar
razón social de una empresa validada con una oferta publicada → la oferta deja de estar
`publicada` y desaparece del listado público.

## 2026-08-29 · Fase 6 (primera entrega): vitrina pública — decisiones
**Contexto:** primera fase con `apps/web`, y primer código de cliente del proyecto. Antes de
programar, se investigó el sitio real de la UAH (`docs/08-guia-visual.md`) para no construir un
frontend con la estética genérica por defecto de un LLM, y se especificó `specs/04-vitrina-publica/`
antes de escribir HTML, como exige la nota de la Fase 6 en `docs/06-roadmap.md`.
**Decisiones:**
- **`apps/web` usa módulos ES nativos del navegador (`<script type="module">`, `import`/`export`),
  no CommonJS.** `CLAUDE.md` dice "CommonJS, no mezclar con ESM" pensando en `apps/api` (Node): un
  navegador no puede ejecutar `require()` sin un bundler, y el proyecto no quiere paso de build.
  Son dos runtimes que solo se hablan por HTTP (`docs/01-arquitectura.md`), así que no hay mezcla
  real — decisión consultada con el usuario antes de escribir el primer archivo. `apps/api` sigue
  en CommonJS puro, sin cambios.
- **Paleta y tipografía tomadas del sitio real de la UAH** (`uahurtado.cl`, tema `UAH-Futura24`),
  no inventadas: naranja `#ef6427` como color de marca, verde `#75fb7e` como acento, Rubik + Frank
  Ruhl Libre. Se verificó el contraste WCAG de cada combinación real que se usa (texto sobre
  naranja da 3.2:1 — insuficiente para texto normal, solo texto grande/UI), en vez de asumir que
  cualquier color de marca sirve para cualquier texto. Detalle completo en `docs/08-guia-visual.md`.
- **`GET /api/v1/empresas/:id` (perfil público) se agregó recién ahora**, no en Fase 2 ni Fase 5:
  ninguna fase anterior necesitaba mostrarle a un tercero la razón social/comuna/sitio web de una
  empresa — Fase 5 solo expone indicadores. Mismo patrón de lista blanca y de umbral de validación
  que `indicadoresService.obtenerPublico`. De paso, `ofertas.service.js listarPublicas`/
  `obtenerDetalle` agregan un `include` de `Empresa` (`razonSocial` solamente) para que la vitrina
  no necesite una segunda llamada por cada tarjeta.
- **Servidor de desarrollo propio (`scripts/servidor-dev.js`), sin dependencia nueva.** Un
  servidor estático de estas características son ~40 líneas de `http`/`fs` de Node; no se pidió
  aprobación para instalar `http-server`/`serve` porque no hacía falta. Nunca se usa en producción
  (Fase 8 decide cómo se sirve `apps/web` en el hosting real).
**Limitación reconocida, resuelta más tarde el mismo día:** en el momento de escribir esto no se
había encontrado herramienta de navegador. Se verificó todo lo que se pudo sin una (200 sirviendo
las tres páginas, respuestas reales de la API calzando con lo que cada página espera, 10 pruebas de
funciones puras) pero el render visual y el foco quedaron sin confirmar. Se resolvió después: el
Chrome ya instalado en la máquina soporta modo headless nativo (`--headless=new --screenshot`),
sin ninguna dependencia nueva — no hacía falta Playwright ni `chromium-cli`. Con eso se tomaron
capturas reales de las tres páginas contra la API real, y se usó `getComputedStyle` (vía una página
de prueba descartable, no parte del repo) para confirmar en números, no a ojo, que la insignia
"normal" y la "urgente" sí tienen bordes distintos — la primera captura las hacía ver casi iguales,
y antes de asumir que eso era un bug se verificó el valor real de `border-width` de cada una.
De paso se encontró y corrigió un bug real de esa primera pasada visual: los enlaces se veían en
el azul por defecto de Bootstrap en vez del naranja/marengo de la paleta de la UAH (`--bs-link-color`
no estaba sobreescrito en `uah-theme.css`). Detalle completo de la auditoría de seguridad que salió
de esta misma verificación, en la entrada de arriba.

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

## 2026-08-30 · Capas automáticas de seguridad: CodeQL, gitleaks y Dependabot
**Contexto:** la seguridad del proyecto dependía de invocar a mano la skill `revision-seguridad` o el
agente `auditor-seguridad`. Todo lo que depende de acordarse, tarde o temprano se olvida.
**Decisión:** workflow `Seguridad` con dos trabajos que corren en cada push y cada lunes: CodeQL
(análisis estático, `security-extended`) y gitleaks sobre el historial completo. Más Dependabot
semanal con los parches agrupados en un solo PR. Se agregó el agente `pentester-api` (pruebas
dinámicas contra la instancia local) y la skill `manejo-de-secretos`.
**Motivo:** las capas existentes son estáticas y a pedido. CodeQL ve patrones que un revisor humano
pasa por alto; gitleaks revisa el **historial**, no solo el estado actual — un `.env` borrado sigue
estando en los commits viejos, y eso ya pasó en otros proyectos del bootcamp. `pentester-api` cubre el
hueco que ninguna lectura de código cubre: un control que está escrito y no funciona.
Los parches de Dependabot van agrupados a propósito: doce PR por semana terminan aprobados sin leer.
**`npm audit` no quedó como tercer trabajo de este workflow**: `ci.yml` ya lo corre en cada push desde
antes, y Dependabot vigila lo mismo de forma continua — un tercer chequeo idéntico solo gasta minutos
de CI (encontrado al revisar este mismo workflow antes de comitearlo).
**Consecuencia:** el push tarda un poco más y CodeQL puede reportar falsos positivos que hay que
descartar con criterio, no silenciar por costumbre. Un hallazgo descartado se anota aquí con su razón.

## 2026-08-30 · Primera corrida de CodeQL en `main`: dos alertas, una descartada y una atendida
**Contexto:** primera corrida real del workflow `Seguridad` (commit `ca77e41`) sobre todo el código
existente. CodeQL abrió dos alertas (`security-extended`). Por la regla acordada, ninguna se toca sin
mostrarla antes.

**Alerta #1 — `js/missing-token-validation` ("Missing CSRF middleware"), alta, [app.js:30](../../apps/api/src/app.js#L30).**
**Decisión:** agregar protección CSRF explícita (doble-submit cookie) en `/auth/refrescar` y
`/auth/logout` — las únicas dos rutas de todo el proyecto que leen una cookie para autorizar algo,
todo lo demás usa `Authorization: Bearer`. Nuevo middleware `verificar-csrf.middleware.js`: exige un
encabezado `X-CSRF-Token` igual a una segunda cookie `csrf` (no `HttpOnly`, para que el cliente pueda
leerla), comparados con `crypto.timingSafeEqual`. Se emite junto a la cookie de sesión
(`fijarCookiesSesion` en `auth.controller.js`) y se exige solo cuando ya existe una cookie de sesión
que proteger.
**Motivo:** la cookie de sesión ya usa `SameSite=Strict`, que en la práctica ya bloquea que el
navegador la mande en una petición cross-site — es una mitigación real, no un saludo a la bandera.
Aun así se optó por la capa extra (decisión explícita del usuario, no mía): `SameSite` depende de que
el navegador respete el atributo; el doble-submit no depende de eso.
**Consecuencia:** `/auth/refrescar` y `/auth/logout` ahora rechazan con 403 `AUTH_CSRF_INVALIDO` si
falta o no coincide el encabezado — se actualizaron las pruebas existentes que llamaban esas rutas
(`auth.test.js`, `cuenta.test.js`) para mandarlo, y se agregaron pruebas nuevas del rechazo (backend)
y del envío automático del encabezado (`cliente.js`, frontend). Es posible que CodeQL siga marcando
esta alerta en la próxima corrida: la regla busca librerías de CSRF conocidas (`csurf`, `lusca`), no
necesariamente reconoce una implementación propia — si pasa, se descarta como falso positivo
apuntando a este párrafo, no se silencia sin más.

**Seguimiento (mismo día, tras el fix del hallazgo Grave de arriba):** ocurrió lo anticipado — la
corrida de CodeQL sobre `fd25b76` siguió marcando la alerta. Descartada en GitHub como falso
positivo (`dismissed_reason: false positive`), con la razón de este párrafo. El control queda vivo:
si algún día se saca `verificar-csrf.middleware.js` sin reemplazo, esta alerta hay que volver a
tomarla en serio.

**Alerta #2 — `js/http-to-file-access` ("Network data written to file"), media, [archivos.service.js:38](../../apps/api/src/services/archivos/archivos.service.js#L38).**
**Decisión:** descartada como falso positivo directamente en GitHub (alerta #2, `dismissed_reason:
false positive`).
**Motivo:** el nombre en disco es `crypto.randomUUID()` generado en el servidor
(`subirCv`), nunca derivado de `nombreOriginal` ni de ningún dato que mande quien sube el archivo —
no hay ruta de traversal posible. El contenido se valida contra la firma real de un PDF (`%PDF-`)
antes de escribir. Es la forma esperada de cualquier subida de archivo; la regla de CodeQL es
genérica ("dato de red escrito a disco") y no distingue esto de un backdoor real.
**Consecuencia:** ninguna — no había nada que arreglar. Si en el futuro `nombreArchivoSeguro` deja de
sanear el nombre, o el nombre en disco deja de ser aleatorio, esta alerta pasa a ser real y hay que
revisar esta entrada.

## 2026-08-30 · `auditor-seguridad` sobre el CSRF nuevo y el registro web: un grave autoinfligido y cuatro menores
**Contexto:** re-análisis completo pedido después de la corrida de CodeQL de arriba, con foco en el
CSRF recién agregado (nunca auditado) y en `registro.html`/`verificar-correo.js` (la auditoría
anterior sobre esa pieza se había cancelado sin resultados). Corrió en paralelo con `pentester-api`
contra la instancia local real.

**[Grave] La cookie `csrf` heredaba `path: '/api/v1/auth'` de la cookie de sesión.** Ningún
navegador expone `document.cookie` a una página fuera de ese path, y ninguna página de `apps/web`
vive ahí — `leerCookie('csrf')` devolvía siempre `''`, el header nunca se mandaba, y
`/auth/refrescar` y `/auth/logout` quedaban en 403 permanente para cualquier sesión real. Peor:
`sesion.js` `logout()` traga ese error (`.catch(() => {})`) y solo borra el token en memoria — la
fila de `sesiones` nunca se revocaba, contradiciendo `docs/03-seguridad.md` §2. El commit que agregó
el CSRF (`75a2045`) rompía la sesión web completa sin que ninguna prueba lo detectara: las pruebas
existentes leen la cookie del `Set-Cookie` crudo y la reenvían sin respetar `Path`, que es
exactamente la diferencia con un navegador real.
**Arreglo:** `path: '/'` en la cookie `csrf` (no protege un secreto, solo tiene que ser legible en
el origen). Verificado en vivo contra el servidor real corriendo (no solo con las pruebas): login →
`Set-Cookie: csrf=...; Path=/` → `/refrescar` sin el header da 403, con el header correcto da 200 →
`/logout` con el header da 204. Prueba nueva que fija `Path=/` en el `Set-Cookie` para que esto no
se repita en silencio.

**[Media] `/auth/registro` sin límite de tasa propio.** Permitía enumerar correos institucionales
(`409` = existe, `201` = no) a la velocidad del límite global (300/15min por IP), y cada intento
manda un correo real a un tercero. Reusar `crearLimitarTasaAuth()` no servía: su clave es
IP+correo, y quien enumera cambia el correo en cada intento. **Arreglo:** nuevo
`limitar-tasa-registro.middleware.js`, clave solo por IP, 10/hora.

**[Media-baja] `versionPolitica` viajaba como texto libre del cliente** y quedaba tal cual en
`consentimientos` — la fila que sirve de evidencia de base legal ante la Agencia (Ley 21.719) podía
llevar cualquier valor, incluida una cadena de casi 1 MB (columna `TEXT` sin tope). **Arreglo:** se
saca del esquema de entrada (`auth.schemas.js`); el servidor usa una constante propia
(`VERSION_POLITICA` en `auth.service.js`, duplicada del valor en `politica-privacidad.html` y
`registro.js`, mismo patrón que `LARGO_MINIMO_CLAVE`).

**[Baja, funcional] El enlace del correo de verificación apuntaba a `/verificar-correo` sin
`.html`** — 404 real contra `servidor-dev.js`, que sirve por path exacto. Bug de la Fase 1, recién
visible porque la página finalmente existe. **Arreglo:** una línea en `auth.service.js`.

**[Baja] Sin `Referrer-Policy` en `verificar-correo.html`**, con el token de un solo uso en la
query. Con la política por defecto de los navegadores actuales no hay fuga hoy, pero nada en el
código lo garantiza. **Arreglo:** `<meta name="referrer" content="no-referrer">` + limpiar la URL
con `history.replaceState` después de leer el token (importa en un computador compartido).

**[Menor] `timingSafeEqual` comparaba longitud en caracteres (UTF-16), no en bytes (UTF-8)** —
un `X-CSRF-Token` con caracteres fuera de ASCII podía disparar `RangeError` y un 500 en vez de un
403. **Arreglo:** comparar digests SHA-256 de largo fijo en vez de los valores crudos.

**Motivo general:** el propio agregado de CSRF de esta tarde introdujo el hallazgo más grave de la
lista — la razón exacta por la que la regla del proyecto es correr `auditor-seguridad` antes de
cerrar, no confiar en que "pasaron las pruebas".
**Consecuencia:** los seis hallazgos están arreglados y probados (437 pruebas de API, 41 de web,
todas verdes) antes de este commit. `pentester-api` corrió en paralelo contra la instancia local;
sus resultados se documentan aparte cuando terminen.

## 2026-08-30 · `pentester-api` (parcial): `pagina` sin tope desbordaba el OFFSET en Postgres
**Contexto:** `pentester-api` se cortó a mitad de la corrida por límite de sesión, pero alcanzó a
dejar una pista sin confirmar: un 500 relacionado con `pagina` en el listado público de ofertas.
**Decisión:** revisado por código y confirmado — `pagina: z.coerce.number().int().positive()` en
`ofertas.schemas.js` no tenía tope. Un valor como `1e30` sigue siendo "entero" para
`Number.isInteger` (precisión de punto flotante) y llega tal cual a `(pagina-1)*limite` como
`OFFSET`: Postgres lo rechaza por desbordar su rango, y el endpoint público (sin autenticación, la
vitrina) responde 500 en vez de un 422 de validación. **No es un cuelgue del proceso** — el
`manejadorErrores` del proyecto atrapa cualquier rechazo de la base y siempre responde JSON — pero
sí es información de menos (un 500 genérico no le dice al cliente que el problema es suyo) contra
un endpoint que cualquiera puede golpear sin cuenta.
**Motivo:** `limite` ya tenía `.max(100)`; `pagina` se quedó sin el mismo tope cuando se escribió el
esquema, probablemente porque "página" no suena a algo que pueda desbordar nada.
**Arreglo:** `.max(100_000)` en `pagina`, prueba nueva (`ofertas.test.js`) que confirma 422 en vez
de 500. Verificado con la suite completa (437 API + 41 web) antes de este commit.
**Consecuencia:** ninguna pérdida de funcionalidad — nadie necesita legítimamente pasar de la
página 100.000 de un listado. `pentester-api` sigue pendiente de una corrida completa.

## 2026-08-30 · `pentester-api`, corrida completa: dos hallazgos del mismo patrón que `pagina`, todo lo demás sin hallazgo
**Contexto:** corrida completa contra la instancia local real (la anterior se había cortado por
límite de sesión). Confirmó en ejecución el arreglo de `pagina` de la entrada de arriba, y confirmó
que la lista blanca de campos (contrabando de `estadoValidacion`, `validadaPorUsuarioId`, etc. en el
perfil de empresa) funciona de verdad, no solo en el esquema.

**[Media-baja] Mismo defecto que `pagina`, pero en columnas `int4` en vez del `OFFSET`.**
`cupos` y `montoMensual` (`ofertas.schemas.js`) y `nivel` (`estudiantes.schemas.js`) usaban
`.int().positive()` sin `.max()`. Un valor entre 2.147.483.648 y `Number.MAX_SAFE_INTEGER` pasa la
validación igual y revienta en Postgres ("value out of range for type integer") con 500 en vez de
422. **Arreglo:** topes de dominio generosos (`cupos` 1.000, `montoMensual` 100.000.000, `nivel`
20) — ninguno reduce un caso de uso real. De paso, `.trim()` en `titulo`/`descripcion`/`requisitos`/
`area` de ofertas (un título de solo espacios pasaba, mismo arreglo que ya tenían los campos
`motivo*`).

**[Baja] Cuerpo de más de 1 MB respondía 500 en vez de 413, sin necesitar cuenta.**
`express.json({limit:'1mb'})` lanza `PayloadTooLargeError` (`type: 'entity.too.large'`) para
cualquier petición que supere el límite, autenticada o no; `manejador-errores.middleware.js` solo
reclasificaba `SyntaxError` (JSON inválido) y `MulterError`, así que este caso caía al 500 genérico
`ERROR_INTERNO`. Sin fuga (el cuerpo grande no se adjunta a este error, a diferencia del
`SyntaxError`), pero un 500 disparable por cualquiera contra `/auth/login` sin token. **Arreglo:**
nuevo código `CUERPO_DEMASIADO_GRANDE`, reclasificado a `ErrorValidacion` (422) igual que
`JSON_INVALIDO`.

**[Informativo, sin acción] La censura del logger no cubre 2+ niveles de anidamiento** — el propio
comentario de `config/logger.js` ya declara esto como limitación aceptada (segunda barrera; la
primera es no pasar nunca datos personales al logger), y `pentester-api` no encontró ninguna ruta
viva que registre un objeto anidado así. Queda anotado para si algún `logger.info/error` futuro pasa
un objeto de dominio de dos niveles.

**Sin hallazgo, confirmado en ejecución (no solo por código):** las once rutas con `:id` responden
404 ante un token de otro usuario o sin token; autorización por rol correcta en cada endpoint
probado; JWT con firma alterada / sin `rol` / `alg:none` rechazados; reuso de un refresco rotado
revoca *toda* la sesión, incluido el token nuevo; CSRF de doble-submit rechaza sin el header
correcto; los cubos de límite de tasa de `/login`, `/recuperar-clave` y el nuevo `/registro` están
separados entre sí y el de `/registro` es realmente por IP (no por IP+correo, que habría dejado
enumerar cambiando el correo); condiciones de carrera reales (5 transiciones simultáneas, 3
postulaciones idénticas en paralelo) resolvieron en una sola escritura cada vez; ninguna respuesta
exitosa expuso `password_hash`, `rut_cifrado`, rutas de disco ni datos de terceros.
**Motivo:** mismo patrón que `pagina` — un campo numérico validado solo con `.int().positive()`,
sin tope, es una superficie repetible de 500s evitables. Vale revisar el resto de campos numéricos
del proyecto la próxima vez que se toque un esquema, no solo estos tres.
**Consecuencia:** seis pruebas nuevas (`ofertas.test.js`, `perfiles.test.js`, y un archivo nuevo
`manejador-errores.test.js` para JSON inválido y cuerpo demasiado grande). 443 pruebas de API + 41
de web, todas verdes.

## 2026-08-30 · Simulacro de brecha en seco: 4 escenarios, 7 huecos
**Contexto:** la Fase 7 pedía "procedimiento de brecha escrito y probado en seco". Escribirlo sin
probarlo habría sido una redacción bonita.
**Decisión:** `docs/09-procedimiento-de-brecha.md` con roles, escala de gravedad por sensibilidad ×
alcance, el reloj de 72 h, los cinco pasos y las plantillas de notificación. El simulacro corrió
cuatro escenarios (CV filtrado, secreto expuesto, acceso indebido interno, respaldo comprometido)
preguntando en cada uno **"¿podemos?"** contra el código real, no "¿qué haríamos?".
**Motivo:** la pregunta útil no es si el procedimiento está escrito, sino si el sistema permite
ejecutarlo. Encontró 7 huecos; los 3 baratos van a Fase 7 y los 4 de infraestructura a Fase 8.
**Consecuencia:** el hueco más grave es el más barato — no hay ningún correo de contacto publicado,
así que la política de privacidad promete derechos que nadie puede ejercer. El más incómodo es el
acceso indebido desde dentro: el atacante tiene credenciales legítimas y ninguna capa lo detiene,
porque todas hacen exactamente lo que se les pidió. Próximo simulacro: agosto de 2027.

## 2026-08-30 · Fase 7 cerrada por nuestra parte: los tres huecos accionables del simulacro
**Contexto:** el simulacro de brecha del mismo día dejó siete huecos. Tres dependían solo de
nosotros; los otros cuatro son de Fase 8 (monitoreo, notificación masiva, respaldos, retención de
logs) y ya tienen casilla ahí.

**Hueco 2 · Revocación global de sesiones.** Existía revocación por usuario (logout, cambio de
clave, reuso de refresco), pero nada para cortar todas las sesiones de golpe ante un
`JWT_ACCESS_SECRET` comprometido — el escenario 2 del simulacro.
**Decisión:** `authService.revocarTodasLasSesiones()` + `npm run revocar-sesiones -w apps/api`.
**Deliberadamente NO es un endpoint HTTP**: uno autenticado por JWT sería vulnerable exactamente al
secreto que este mecanismo existe para responder, y uno sin autenticar sería un botón de denegación
de servicio para cualquiera. Un script que exige acceso al servidor es la barrera correcta.
**Límite conocido, escrito también en `docs/09`:** solo mata el refresco. Un `accessToken` ya
emitido vive hasta sus 15 minutos de TTL — el JWT no tiene estado. Ante un secreto comprometido hay
que **rotar el secreto además de correr el script**; eso sí invalida en el acto. El TTL corto existe
justamente para acotar esa ventana.

**Hueco 4 · Contacto de privacidad.** El más grave según el propio simulacro, y el más barato:
`privacidad@proxi.cl` en el pie de las 13 páginas y en la política. Es un placeholder marcado como
tal en la propia interfaz ("dirección provisoria, pendiente casilla real de la FEN"), no una
dirección inventada que se hace pasar por real — una casilla de contacto que rebota es peor que
ninguna, y decirlo en la interfaz es más honesto que esconderlo en un comentario del código.
Se repitió el `<footer>` en las 13 páginas en vez de inyectarlo por JS: son cuatro líneas de HTML
estático, y un componente JS para eso significaría que el contacto de privacidad desaparece si
falla un script — justo el dato que nunca debería depender de que el JS cargue.

**Hueco 7 · `user_agent` en `auditoria_accesos`.** Estaba en el modelo de datos original y se
implementó sin ella en la Fase 4. Migración reversible, columna nullable, sin backfill: **el dato
nunca existió para las filas viejas, así que NULL significa "no se capturó", no "cliente
desconocido"** — anotado en `docs/09` porque leer mal ese NULL en medio de un incidente lleva a una
conclusión falsa. Un `DEFAULT 'desconocido'` habría inventado evidencia en una tabla que la Ley
21.719 usa como prueba.
`revisor-migraciones` la validó corriendo el ciclo up → down → up contra una base limpia, con filas
preexistentes que sobrevivieron intactas. De paso levantó cuatro observaciones ajenas a esta
migración, anotadas para más adelante: la FK de `auditoria_accesos` tiene `ON DELETE CASCADE` (un
`DELETE` manual de un usuario borraría su rastro de auditoría — debería ser `RESTRICT`); CI nunca
ejercita el `down` de ninguna migración; y `auditoria_accesos` no tiene plazo de retención definido
aunque ahora guarda un dato personal más.

**Una prueba que fallaba por la razón correcta:** la aserción nueva de `user_agent` falló al
principio porque **supertest no manda `User-Agent` por defecto**, a diferencia de cualquier
navegador real. El código estaba bien; la prueba comparaba NULL contra NULL y habría pasado igual
aunque el controller dejara de capturar el dato. Se corrigió mandando el header explícito y
afirmando el valor exacto.

**Decisión de roadmap: separar "pendiente" de "bloqueado".** Las casillas de Fase 7 que quedan
(política de privacidad final, términos de uso) no esperan trabajo nuestro: esperan revisión legal
de la FEN. El DPA se movió a Fase 8 porque depende de qué proveedor de hosting se elija, decisión
que se toma allá — no se firma un acuerdo de procesamiento con un proveedor que todavía no existe.
**Motivo:** una lista donde todo se ve igual esconde qué se puede avanzar hoy. Tres casillas sin
marcar leídas como "trabajo pendiente" dan una sensación de deuda que no corresponde, y peor, hacen
perder de vista que la fase sí está cerrada por nuestra parte.
**Consecuencia:** Fase 7 cerrada el 2026-08-30 por nuestra parte. 444 pruebas de API + 41 de web,
todas verdes. Lo único que la separa del cierre total son documentos que este proyecto no puede
desbloquear solo.

**Dos cosas encontradas al cerrar, que quedan anotadas:**

1. **Hay dos textos de política de privacidad con versiones distintas, y el que la gente acepta es el
   más corto.** `apps/web/politica-privacidad.html` es `2026-08-30-borrador` (lo que ve y acepta
   quien se registra, y lo que el servidor graba en `consentimientos`), mientras que
   `docs/legal/politica-privacidad.md` es `2026-08-30-borrador-3`, más completo y **sin publicar**.
   No se unificó a propósito: cuál de los dos textos es "la" política es una decisión, no una
   corrección de tipeo — y la tabla `consentimientos` guarda exactamente qué versión aceptó cada
   persona, así que cambiar el número sin cambiar el texto publicado dejaría un registro que miente
   sobre a qué consintió la gente. Al aprobarse el texto final hay que actualizar los tres lugares a
   la vez: el HTML, `VERSION_POLITICA` en `auth.service.js`, y el propio markdown.
2. **Tres de las diez decisiones legales bloquean código, no texto** (consentimiento libre,
   estudiantes menores de edad, transferencia internacional si el hosting queda fuera de Chile).
   Anotadas en el roadmap dentro de Fase 7 · Bloqueado, con la advertencia de que la Fase 8 no
   debería cerrarse sin ellas: descubrir en el despliegue que el flujo de registro tiene que cambiar
   es mucho más caro que saberlo ahora.
