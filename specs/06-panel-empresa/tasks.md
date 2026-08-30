# Tareas · Panel de empresa

- [x] 1. Extender `api/empresas.js` (`obtenerPropio`, `crearPerfil`, `actualizarPerfil`),
      `api/ofertas.js` (`listarMias`, `crear`, `editar`, `enviarARevision`, `cerrar`,
      `obtenerDetallePropio`) y `api/postulaciones.js` (`listarDeOferta`, `marcarEnRevision`,
      `marcarEntrevista`, `seleccionar`, `rechazar`) — todo wrappers de una línea, sin lógica nueva.
- [x] 2. Ampliar el mapa de mensajes de `cliente.js`: `EMPRESA_NO_VALIDADA`,
      `EMPRESA_TRANSICION_INVALIDA`, `EMPRESA_RUT_YA_REGISTRADO`, `EMPRESA_CIERRES_PENDIENTES`,
      `OFERTA_SIN_FECHA_CIERRE`, `OFERTA_FECHA_CIERRE_INVALIDA`, `OFERTA_TRANSICION_INVALIDA`,
      `OFERTA_CAMPO_NO_EDITABLE`. De paso, `ErrorApi`/`cuerpoDeError` ahora propagan `detalles`
      (los `{campo,mensaje}` de `VALIDACION_ENTRADA`) — el formulario de oferta es el primero con
      varias reglas cruzadas como para necesitar el mensaje específico en vez del genérico.
- [x] 3. `panel-empresa.html` + su JS: formulario de perfil (crea si 404, edita si existe), estado
      de validación visible con motivo si `rechazada`/`suspendida`, advertencia (`confirm()`) antes
      de guardar si cambia `razonSocial` **o `rutEmpresa`** de una empresa `validada` (cascada de
      cierre — ambos campos cuentan, no solo la razón social).
- [x] 4. `mis-ofertas.html` + su JS: lista de ofertas propias en cualquier estado, formulario de
      crear/editar (un componente, decide `POST`/`PATCH` con un diff contra lo cargado por la API),
      enviar a revisión, cerrar con motivo (select de un enum fijo) / declarar resultado tardío por
      el mismo camino. Bloqueo visible de "Enviar a revisión" si la empresa no está validada (crear
      y editar borradores queda permitido: la API tampoco lo bloquea). Advertencia antes de guardar
      si se edita el contenido de una oferta `publicada` (vuelve a `borrador`).
- [x] 5. `postulantes.html` (`?ofertaId=`) + su JS: lista de postulantes de una oferta propia,
      botones de transición según el estado actual de cada uno, motivo opcional al rechazar (mismo
      `motivoOpcionalEsquema` de Fase 4, vía `prompt()`), descarga de CV, línea de tiempo por
      postulante (reusa `linea-tiempo.js` del panel de estudiante, con un segundo parámetro
      `rolPropio` nuevo para que la empresa vea "Tú" donde el estudiante ve "La empresa", y
      viceversa — y para que la propia empresa vea el motivo de sus rechazos, que el estudiante
      nunca ve).
- [x] 6. Enlaces cruzados: desde `mis-ofertas.html` a `postulantes.html?ofertaId=`, y
      `panel-empresa.html`/`mis-ofertas.html`/`postulantes.html` comparten la navegación del panel
      (mismo patrón visual que el panel de estudiante). De paso, `index.html`/`login.html` — que
      hasta ahora mandaban a cualquiera de vuelta a la vitrina tras iniciar sesión — ahora navegan
      al panel del rol correspondiente, y la vitrina muestra un enlace al panel propio con sesión.
- [x] 7. No hizo falta una función aislada para los botones de transición: la tabla es chica
      (`SIGUIENTE_PASO` en `postulantes.js`) y vive junto a su único uso. Sí se agregó
      `textoEstadoOferta` a `estado-oferta.js` (estado de flujo de una oferta, distinto de
      `calcularEstado` que es vigencia) — función pura, con pruebas.
- [x] 8. Smoke test real con Chrome headless contra la API real (datos inventados, limpiados
      después): perfil, crear oferta, enviar a revisión, aprobar por API (coordinación todavía no
      tiene panel), publicar, postular como estudiante, ver postulantes con nombre y carrera. Así se
      encontró un bug real: el selector de motivo de cierre se veía visible sin haber tocado nada —
      `.d-flex` de Bootstrap tiene `!important` y le ganaba al `[hidden]` del navegador. Ver bitácora.
- [x] 9. Auditoría de seguridad (`auditor-seguridad`) antes del push. Sin hallazgos Alto/Grave;
      cuatro Media/Baja corregidos (falta de rastro de auditoría al ver postulantes, un campo oculto
      sin usar que dejaba en los hechos inerte el guard de "sin cambios no manda PATCH", el mismo
      guard sin detectar que se vació un campo — se perdía el cambio en silencio en vez de
      guardarlo —, y un texto engañoso sobre a quién le llega el motivo de un rechazo, que en el
      camino llevó a implementar de verdad la regla 4 de la spec en vez de solo corregir el texto) y
      una observación menor corregida (el select de motivo de cierre venía con "Contratado"
      preseleccionado). Ver bitácora.
- [x] 10. Documentación: `docs/06-roadmap.md`, `docs/decisiones/bitacora.md`.

## Terminado cuando
- [x] Los criterios de aceptación de `spec.md` verificados.
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada.
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`.
- [x] Roadmap actualizado.
