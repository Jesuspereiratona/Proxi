# Spec · Postulaciones

- **Estado:** implementada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** Fase 4

## Problema
Hoy una oferta puede publicarse y cerrarse, pero no existe ningún camino para que un estudiante
postule. Y aunque existiera, sin esta funcionalidad se repite el problema que motiva todo el
proyecto: un estudiante que postula y nunca sabe qué pasó. La empresa necesita mover cada
postulación por un proceso de selección simple, y el sistema necesita garantizar que ninguna se
quede sin resolución si la empresa no responde.

## Quién la usa
- **Estudiante**: sube su CV, postula a ofertas vigentes, ve el estado de sus postulaciones, se
  retira si ya no le interesa.
- **Empresa**: ve quién postuló a sus ofertas, mueve cada postulación por el proceso (revisión,
  entrevista, selección o rechazo), y puede descargar el CV de quien postuló — solo el de sus
  propios postulantes.
- **Coordinación**: puede ver cualquier postulación y descargar cualquier CV, con el acceso
  registrado igual que el de una empresa.

## Comportamiento esperado
- Un estudiante solo puede postular si tiene un CV subido. Sin CV, no hay postulación posible.
- Solo se puede postular a una oferta vigente (publicada y con fecha de cierre futura) — la misma
  regla que ya usa el resto del ciclo de vida de la oferta.
- Un estudiante postula una sola vez a cada oferta.
- El CV que la empresa ve en una postulación es el que el estudiante tenía al momento de postular,
  aunque después lo reemplace por uno nuevo. Reemplazar el CV no borra el anterior: las
  postulaciones ya enviadas lo siguen necesitando.
- Una postulación avanza por un proceso con orden: recibida, en revisión, entrevista, y termina en
  seleccionada o no seleccionada. La empresa puede rechazar en cualquier punto del proceso, no solo
  al final.
- El estudiante puede retirar su postulación en cualquier momento mientras siga en curso.
- Si la empresa no mueve una postulación dentro del plazo del SLA, el sistema la marca
  automáticamente como sin respuesta. Esto se distingue de un rechazo real: uno es una decisión
  tomada, el otro es silencio.
- Cada cambio de estado queda registrado: quién lo hizo (o si lo hizo el sistema) y cuándo.
- El CV es un documento personal. Solo lo puede descargar su dueño, coordinación, o una empresa que
  tenga una postulación real de ese estudiante a alguna de sus ofertas — y solo el CV congelado de
  esa postulación, no el CV vigente si ya cambió. Cada descarga queda registrada: quién descargó
  qué y cuándo.
- El archivo subido tiene que ser realmente un PDF: se verifica el contenido, no el nombre ni lo que
  el navegador dice que es.

## Reglas que no se pueden romper
1. Ninguna postulación queda sin un CV asociado.
2. Ninguna postulación se puede duplicar para el mismo estudiante y la misma oferta.
3. Ninguna postulación se queda fuera de un estado terminal para siempre: si la empresa no
   responde, el sistema la cierra igual.
4. Nadie descarga el CV de un estudiante sin una razón legítima (ser el dueño, ser coordinación, o
   tener una postulación real de ese estudiante a una oferta propia) — y esa descarga queda en el
   registro de auditoría.
5. Solo se acepta contenido que sea realmente un PDF.

## Casos borde
- El estudiante intenta postular sin haber subido nunca un CV → rechazado, mensaje claro de qué
  falta.
- El estudiante intenta postular dos veces a la misma oferta (incluso en paralelo, dos pestañas a
  la vez) → la segunda falla, nunca se crean dos filas.
- La oferta se cierra o vence justo después de que el estudiante abrió el formulario pero antes de
  enviar → rechazado con el mismo código que usa el resto del sistema para "oferta no vigente".
- El estudiante reemplaza su CV después de postular a tres ofertas → las tres postulaciones siguen
  mostrando el CV original, no el nuevo.
- La empresa intenta mover una postulación que ya está en un estado terminal (seleccionada,
  rechazada, retirada, sin respuesta) → rechazado, esos estados no tienen salida.
- Dos personas de la misma empresa intentan mover la misma postulación al mismo tiempo a estados
  distintos → solo una gana, la otra recibe un error de conflicto, nunca queda en un estado mixto.
- Una empresa intenta descargar el CV de un estudiante que nunca postuló a ninguna de sus ofertas →
  se le responde como si el archivo no existiera.
- Alguien sube un archivo que no es un PDF real (aunque lo llame `cv.pdf` o el navegador diga
  `application/pdf`) → rechazado.
- Pasan los días del SLA sin que la empresa mueva una postulación → el sistema la marca sin
  respuesta sola, sin intervención de nadie.

## Criterios de aceptación
- [ ] Dado un estudiante sin CV subido, cuando intenta postular, entonces recibe 422
      `POSTULACION_SIN_CV`.
- [ ] Dado un estudiante con CV, cuando postula a una oferta publicada y vigente, entonces la
      postulación se crea en estado `recibida` con el CV actual del estudiante congelado.
- [ ] Dado un estudiante que ya postuló a una oferta, cuando postula de nuevo a la misma oferta,
      entonces recibe 409 `POSTULACION_YA_EXISTE`.
- [ ] Dado dos postulaciones simultáneas del mismo estudiante a la misma oferta, cuando ambas se
      procesan en paralelo, entonces solo una crea la fila y la otra recibe 409.
- [ ] Dado un estudiante, cuando postula a una oferta vencida o no publicada, entonces recibe 422
      `OFERTA_NO_VIGENTE`.
- [ ] Dado un estudiante que reemplaza su CV, cuando se consulta una postulación anterior,
      entonces esa postulación sigue mostrando el CV original, no el nuevo.
- [ ] Dado que una empresa mueve una postulación propia por revisión, entrevista y selección,
      entonces cada paso queda registrado con el actor y la fecha.
- [ ] Dado que una empresa intenta mover una postulación de una oferta que no es suya, entonces
      recibe 404.
- [ ] Dado que una empresa intenta mover una postulación desde un estado terminal, entonces recibe
      409 `POSTULACION_TRANSICION_INVALIDA`.
- [ ] Dado un estudiante, cuando retira una postulación en curso, entonces queda en `retirada` y ya
      no admite más cambios.
- [ ] Dado un estudiante, cuando intenta retirar la postulación de otro estudiante, entonces recibe
      404.
- [ ] Dado una postulación sin movimiento de la empresa por más días que `SLA_RESPUESTA_DIAS`,
      cuando corre la tarea programada, entonces pasa a `sin_respuesta` con actor nulo.
- [ ] Dado que corre la tarea del SLA dos veces seguidas, entonces la segunda vez no encuentra nada
      que marcar (idempotencia).
- [ ] Dado un archivo que no empieza con la firma real de un PDF, cuando se sube como CV, entonces
      se rechaza con 422 `ARCHIVO_INVALIDO`, sin importar su nombre o `Content-Type`.
- [ ] Dado un estudiante, cuando descarga su propio CV, entonces lo recibe y queda un registro en
      `auditoria_accesos`.
- [ ] Dado una empresa con una postulación real de un estudiante a una de sus ofertas, cuando
      descarga el CV de esa postulación, entonces lo recibe y queda registrado el acceso.
- [ ] Dado una empresa sin ninguna postulación de un estudiante, cuando intenta descargar su CV,
      entonces recibe 404, sin confirmar si el archivo existe.
- [ ] Dado coordinación, cuando descarga cualquier CV, entonces lo recibe y queda registrado el
      acceso.

## Fuera de alcance
- Notificaciones por correo cuando cambia el estado de una postulación (fuera del alcance v1 según
  `docs/00-vision-y-alcance.md`; las transaccionales de Fase 1 ya cubren verificación y clave).
- Mensajería entre empresa y estudiante más allá del `mensaje` inicial de la postulación.
- Portabilidad y borrado de datos personales (`GET /mi-cuenta/datos`, `DELETE /mi-cuenta`) — eso es
  Fase 7.
- Antivirus sobre el PDF subido — riesgo aceptado y documentado, igual que el resto del proyecto
  (`docs/03-seguridad.md`).
- Límite de tamaño de foto de perfil o logo de empresa — la tabla `archivos` soporta `tipo=logo`
  porque ya está en el modelo de datos, pero ningún endpoint de esta fase lo usa.
