# Spec · Panel de empresa

- **Estado:** aprobada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** Fase 6

## Problema
Una empresa ya puede hacer todo por API (Fases 2 a 4): editar su perfil, crear y publicar una
oferta, cerrarla con motivo, revisar postulantes y responderles. No tiene ninguna pantalla. Sin
este panel, la mitad de las decisiones de negocio del proyecto (publicar, cerrar, responder) sigue
sin ser usable por una persona real — solo por `curl`.

## Quién la usa
Un usuario con sesión y rol `empresa`, en cualquiera de sus cuatro estados de validación
(`pendiente`, `validada`, `rechazada`, `suspendida`) — los cuatro son casos normales que el panel
debe mostrar con claridad, no solo el caso feliz de una empresa ya validada.

## Comportamiento esperado
- Perfil: crea si no existe, edita si existe (mismo patrón que el panel de estudiante). Muestra el
  estado de validación de forma explícita y, si es `rechazada` o `suspendida`, el motivo que dejó
  coordinación.
- Cambiar la razón social **o el RUT** de una empresa ya `validada` la manda de vuelta a
  `pendiente` y cierra en cascada sus ofertas publicadas (regla ya existente de Fases 2 y 3,
  `CAMPOS_IDENTIDAD`). El formulario avisa esto **antes** de guardar si detecta el cambio, no lo
  descubre la empresa después de perder sus ofertas.
- "Mis ofertas": lista todas las propias en cualquier estado (`borrador`, `en_revision`,
  `publicada`, `cerrada`), con el estado visible sin abrir nada.
- Crear una oferta nueva empieza en `borrador`. Se puede editar mientras está en `borrador` o
  `rechazada`; enviarla a revisión la pasa a `en_revision`. Cerrar una `publicada` exige un motivo
  — la API ya lo exige (Fase 3); el formulario también, para no gastar un viaje al servidor solo
  para fallar.
- Una empresa no validada (`pendiente`, `rechazada`, `suspendida`) no puede enviar una oferta a
  revisión, pero sí puede seguir creando y editando borradores mientras espera — la API no se lo
  impide (`crear`/`editar` no llaman `verificarValidada`, solo `enviarARevision` lo hace) y no tiene
  sentido bloquear algo inofensivo. El panel deshabilita solo "Enviar a revisión" y explica por qué,
  en vez de dejar que el intento choque con un error de servidor.
- Ver postulantes de una oferta: lista con el estado de cada postulación, botones de transición
  según el estado actual (revisión → entrevista → selección/rechazo), motivo opcional al rechazar
  (mismo `motivoOpcionalEsquema` que ya comparten rechazo y retiro desde Fase 4: nunca obligatorio,
  a diferencia del motivo de cierre de una oferta, que sí lo es), descarga del CV con el mismo
  control de permiso que ya audita Fase 4. Cada postulante muestra su línea de tiempo.

## Reglas que no se pueden romper
1. Nunca se ve el CV de un estudiante que no postuló a una oferta propia — ya lo bloquea la API
   (Fase 4); el panel no ofrece ningún atajo que lo sugiera ni construye la URL a mano.
2. Cerrar una oferta sin motivo no es posible desde la interfaz: el campo es obligatorio antes de
   habilitar el botón, no solo una validación después de enviar.
3. Ninguna transición de postulación se ofrece si el estado actual no la permite según
   `services/postulaciones/estados.js` — el panel refleja lo que la API decide, no decide por su
   cuenta qué botones mostrar basándose en una copia local del estado.
4. El motivo de rechazo que la empresa escribe es su propio texto: se le sigue mostrando sin
   restricción. La exclusión de `motivo`/`actorUsuarioId` de Fase 6 parte 3 protege al estudiante
   de ver la nota de la empresa, no al revés.

## Casos borde
- Empresa `suspendida`: sus ofertas publicadas ya se cerraron en cascada (Fase 3); "mis ofertas"
  las muestra como `cerrada`, no como si algo se hubiera roto en el panel.
- Intento de enviar a revisión sin estar validada → mensaje humano de `EMPRESA_NO_VALIDADA`
  (`services/empresas/reglas.js`), no el código crudo.
- Dos pestañas transicionando la misma postulación a la vez → mismo compare-and-set que ya prueba
  Fase 4 (409, mensaje humano, ningún estado inconsistente queda pintado en pantalla).
- Cerrar una oferta que ya está cerrada → el botón no debería ni aparecer, pero si la carrera
  ocurre, el mismo 409 traducido, no una pantalla rota.
- Editar el contenido de una oferta ya `publicada` la manda de vuelta a `borrador` (regla ya
  existente de Fase 3) — el formulario lo advierte antes de guardar, mismo criterio que el cambio
  de razón social.

## Criterios de aceptación
- [ ] Dado una empresa sin perfil, cuando entra al panel, entonces ve el formulario de creación.
- [ ] Dado una empresa con perfil, cuando entra, entonces ve sus datos precargados y su estado de
      validación explícito, con motivo si corresponde.
- [ ] Dado una empresa validada que cambia su razón social, cuando el formulario detecta el cambio,
      entonces advierte la cascada antes de guardar.
- [ ] Dado "mis ofertas", cuando se abre, entonces cada oferta muestra su estado sin abrir nada.
- [ ] Dado una empresa no validada, cuando ve "mis ofertas", entonces puede crear y editar
      borradores con normalidad, pero "Enviar a revisión" está deshabilitado con una explicación
      visible, no ausente sin más.
- [ ] Dado una oferta en borrador, cuando se edita y se envía a revisión, entonces pasa a
      `en_revision` sin error.
- [ ] Dado una oferta publicada, cuando se cierra sin motivo, entonces el botón de cerrar está
      deshabilitado hasta que se escriba uno.
- [ ] Dado los postulantes de una oferta propia, cuando se abre la lista, entonces cada uno muestra
      su estado y solo los botones de transición válidos desde ese estado.
- [ ] Dado un postulante, cuando se descarga su CV, entonces se recibe el archivo (y no el de un
      estudiante que no postuló a esa oferta).
- [ ] Dado un rechazo con motivo, cuando la propia empresa vuelve a ver la línea de tiempo de esa
      postulación, entonces ve el motivo que escribió (el estudiante nunca).
- [ ] Dado un cierre de oferta, cuando no se ha elegido un motivo todavía, entonces el botón de
      confirmar cierre está deshabilitado.

## Fuera de alcance
- Panel de coordinación (validar empresas, moderar ofertas, indicadores) — sigue después de este.
- Los cuatro indicadores de transparencia dentro del panel: ya son públicos en `empresa.html`
  (Fase 6 parte 1), no se duplican aquí.
- Notificaciones (correo, push) de cambios de estado.
