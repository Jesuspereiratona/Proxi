# Spec · Indicadores de transparencia

- **Estado:** implementada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** Fase 5

## Problema
Hoy un estudiante que mira el perfil de una empresa no tiene forma de saber si esa empresa
responde, si cierra sus procesos con seriedad, o si publica ofertas con frecuencia. Toda la
información existe (postulaciones, sus estados, ofertas cerradas), pero está repartida en filas
individuales, no resumida en algo que una persona pueda leer en cinco segundos. Ese resumen es la
cuarta regla del proyecto (`docs/00-vision-y-alcance.md`): "cada empresa muestra sus indicadores".

## Quién la usa
- **Estudiante** (público, sin sesión): ve los indicadores de una empresa antes de postular, para
  decidir dónde invertir su tiempo.
- **Coordinación**: ve los indicadores de todas las empresas, incluidas las que todavía no
  acumulan historial suficiente para mostrarse en público, para gestionar la vinculación con el
  medio.

## Comportamiento esperado
- Cuatro indicadores por empresa, ya definidos en `docs/02-modelo-de-datos.md`: tasa de respuesta,
  días promedio de respuesta, tasa de cierres declarados, y ofertas publicadas en los últimos 12
  meses.
- Los indicadores se recalculan una vez por noche, no en cada consulta: son agregados sobre
  potencialmente todo el historial de la empresa, y no necesitan estar actualizados al segundo.
- Una empresa con menos de 3 ofertas cerradas no muestra sus indicadores en público: con pocos
  casos, un número solo o mala suerte. Coordinación sí los ve siempre, sin ese filtro — necesita el
  panorama completo para gestionar, no una versión editorializada.
- Una empresa recién creada, sin ninguna oferta cerrada ni postulación, existe igual y responde con
  normalidad: simplemente no tiene historial suficiente todavía.

## Reglas que no se pueden romper
1. Nunca se muestran los indicadores en el endpoint público si la empresa tiene menos de 3 ofertas
   cerradas.
2. El endpoint de coordinación nunca aplica ese filtro: siempre muestra todo.
3. Un indicador sin datos de base (p. ej. días promedio de respuesta cuando nadie le ha postulado
   todavía) se representa como ausente, nunca como cero: cero significa "responde el mismo día",
   no "no hay información".
4. La tasa de respuesta y los días promedio de respuesta nunca se muestran si hay muy pocas
   postulaciones de por medio, aunque la empresa ya supere el umbral de ofertas cerradas: con pocos
   casos, esas dos cifras dejan de ser un patrón y pasan a describir el trato de una postulación
   puntual — exactamente el riesgo que ya evita el umbral de ofertas cerradas, pero por el lado de
   las postulaciones (hallazgo de la auditoría de seguridad).
5. Solo una empresa validada por coordinación tiene indicadores públicos. Una empresa pendiente,
   rechazada o suspendida responde igual que una que no existe: ni su existencia ni su estado se
   confirman por este endpoint.

## Casos borde
- Una empresa con 3 ofertas cerradas exactas (el umbral) → sí muestra indicadores.
- Una empresa con 2 → no los muestra.
- Una empresa sin ninguna postulación recibida todavía → `tasaRespuesta` y
  `diasPromedioRespuesta` ausentes, no cero.
- Una postulación que el estudiante retiró antes de que la empresa se moviera → cuenta en el
  denominador de la tasa de respuesta (es un estado terminal), pero no en el numerador salvo que la
  empresa ya la hubiera movido antes del retiro.
- Una oferta publicada hace 13 meses no cuenta en `ofertasPublicadas12m`; una publicada hace 11 sí.
- Una empresa que no existe → 404, igual que el resto de las rutas con `:id` de este proyecto.
- Correr el recálculo dos veces seguidas sin que nada haya cambiado da exactamente el mismo
  resultado (idempotencia).

## Criterios de aceptación
- [ ] Dado una empresa con menos de 3 ofertas cerradas, cuando se consulta su endpoint público de
      indicadores, entonces responde `suficienteHistorial: false` y sin las cifras.
- [ ] Dado una empresa con 3 ofertas cerradas o más, cuando se consulta su endpoint público,
      entonces responde `suficienteHistorial: true` con las cuatro cifras.
- [ ] Dado una empresa con 3 ofertas cerradas, 2 con resultado declarado, cuando se calcula
      `tasaCierreDeclarado`, entonces el valor es 2/3.
- [ ] Dado postulaciones en estados terminales de una empresa, con y sin `respondidaPorEmpresa`,
      cuando se calcula `tasaRespuesta`, entonces es la proporción correcta sobre el total en
      estado terminal.
- [ ] Dado una postulación movida por la empresa un número conocido de días después de recibida,
      cuando se calcula `diasPromedioRespuesta`, entonces el promedio coincide con ese número de
      días.
- [ ] Dado una empresa sin ninguna postulación con movimiento propio, cuando se consultan sus
      indicadores desde coordinación, entonces `diasPromedioRespuesta` es `null`, no `0`.
- [ ] Dado ofertas publicadas hace 11 y hace 13 meses, cuando se calcula `ofertasPublicadas12m`,
      entonces solo cuenta la de hace 11.
- [ ] Dado que corre la tarea de recálculo dos veces seguidas sin cambios de datos, entonces el
      resultado es idéntico ambas veces.
- [ ] Dado coordinación, cuando consulta el panorama general, entonces ve todas las empresas con
      sus cifras completas, incluidas las que no llegan al umbral público.
- [ ] Dado un usuario sin rol coordinación, cuando intenta consultar el panorama general, entonces
      recibe 403.
- [ ] Dado un id de empresa que no existe, cuando se consultan sus indicadores, entonces recibe 404.
- [ ] Dado una empresa con 3 ofertas cerradas pero una sola postulación en estado terminal, cuando
      se consultan sus indicadores públicos, entonces `tasaRespuesta` y `diasPromedioRespuesta`
      están ausentes, aunque `tasaCierreDeclarado` sí se muestre.
- [ ] Dado una empresa pendiente, rechazada o suspendida, cuando se consultan sus indicadores
      públicos, entonces recibe 404.

## Fuera de alcance
- El panel visual de coordinación (tablas, gráficos) — eso es Fase 6, cliente web. Esta fase solo
  entrega el endpoint que ese panel va a consumir.
- Indicadores por oferta individual o por estudiante — la spec de `docs/00-vision-y-alcance.md`
  habla solo de indicadores por empresa.
- Recalcular bajo demanda (un botón "actualizar ahora") — el recálculo es siempre nocturno.
