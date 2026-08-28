# Spec · Ciclo de vida de una oferta

- **Estado:** aprobada
- **Fecha:** 2026-08-28
- **Fase del roadmap:** 3

## Problema
En los portales actuales una oferta se publica y ahí queda. Nadie sabe si sigue viva, si ya
contrataron o si la empresa simplemente se olvidó. Cerca del 30% de los avisos nunca lleva a una
contratación (ver `docs/investigacion/diagnostico-mercado.md`). El estudiante gasta su tiempo en
procesos que no existen y la coordinación no tiene datos de resultados.

## Quién la usa
- **Empresa validada:** crea, edita, envía a revisión y cierra sus ofertas.
- **Coordinación:** aprueba o rechaza ofertas antes de que se publiquen.
- **Estudiante y visitante:** ve solo ofertas publicadas y vigentes.
- **Sistema:** cierra las vencidas cada noche.

## Comportamiento esperado
Una oferta nace como borrador de la empresa. Cuando está lista, la empresa la envía a revisión; para
eso debe estar validada y no tener cierres anteriores sin declarar. Coordinación la aprueba —y ahí se
publica— o la devuelve a borrador con un motivo.

Una oferta publicada es visible para todos y recibe postulaciones **solo mientras esté vigente**.
Toda oferta nace con una fecha de cierre: no existe la oferta indefinida.

El cierre ocurre de dos maneras. La empresa la cierra declarando qué pasó: contrató, canceló el
proceso, o no encontró candidato adecuado. O bien llega la fecha de cierre y el sistema la cierra
solo, marcándola como vencida y con el resultado **sin declarar**. En ese caso la empresa sigue
debiendo la declaración, y mientras no la haga no puede publicar ofertas nuevas.

Noventa días después de cerrada, la oferta se archiva: deja de aparecer en los listados de la empresa
pero sus datos se conservan para los indicadores.

## Reglas que no se pueden romper
1. No existe una oferta publicada sin `fecha_cierre`. Lo garantiza la base de datos, no solo el código.
2. La fecha de cierre debe ser posterior a la publicación.
3. Solo una empresa con `estado_validacion = validada` puede enviar una oferta a revisión.
4. Una empresa con ofertas cerradas sin declarar resultado hace más de `PLAZO_DECLARAR_CIERRE_DIAS`
   no puede enviar una oferta nueva a revisión.
5. Cerrar exige `motivo_cierre`. Sin motivo no hay cierre.
6. Solo se puede postular a ofertas `publicada` y con `fecha_cierre` en el futuro.
7. Toda transición de estado queda registrada en `oferta_eventos` con actor y momento.
8. Una empresa solo ve y modifica sus propias ofertas.
9. Las transiciones no listadas son imposibles: se rechazan con `OFERTA_TRANSICION_INVALIDA`.

## Casos borde
| Situación | Qué pasa |
|---|---|
| Se intenta publicar con fecha de cierre en el pasado | `OFERTA_FECHA_CIERRE_INVALIDA` |
| La oferta vence mientras un estudiante llena el formulario | Al enviar, `OFERTA_NO_VIGENTE`. Se valida al momento de postular, no al abrir |
| La empresa cierra una oferta que ya cerró el sistema | Se permite: completa la declaración y marca `resultado_declarado = true` |
| La tarea nocturna corre dos veces | No pasa nada: es idempotente, solo toca ofertas `publicada` vencidas |
| Coordinación rechaza sin escribir motivo | Se bloquea: el motivo es obligatorio |
| La empresa edita una oferta ya publicada | Solo campos que no alteran el trato: no puede acortar la fecha de cierre ni cambiar la remuneración con postulantes dentro |
| La empresa queda suspendida con ofertas publicadas | Sus ofertas se cierran con motivo `cancelada` y se avisa a los postulantes |

## Criterios de aceptación
- [ ] Dado un borrador sin `fecha_cierre`, cuando se intenta enviar a revisión, entonces responde 422 `OFERTA_SIN_FECHA_CIERRE`
- [ ] Dada una fecha de cierre pasada, cuando se envía a revisión, entonces responde 422 `OFERTA_FECHA_CIERRE_INVALIDA`
- [ ] Dada una empresa `pendiente`, cuando envía a revisión, entonces responde 403 `EMPRESA_NO_VALIDADA`
- [ ] Dada una empresa con un cierre sin declarar de hace más de 7 días, cuando envía a revisión, entonces responde 422 `EMPRESA_CIERRES_PENDIENTES`
- [ ] Dada una oferta `en_revision`, cuando coordinación aprueba, entonces queda `publicada` con `fecha_publicacion` y hay un evento registrado
- [ ] Dada una oferta `publicada`, cuando la empresa la cierra sin motivo, entonces responde 422
- [ ] Dada una oferta `publicada`, cuando la empresa la cierra con motivo `contratado`, entonces queda `cerrada` con `resultado_declarado = true`
- [ ] Dada una oferta `publicada` con fecha de cierre de ayer, cuando corre la tarea nocturna, entonces queda `cerrada`, `motivo_cierre = vencida`, `resultado_declarado = false`
- [ ] Dada una oferta `cerrada`, cuando se intenta publicarla de nuevo, entonces responde 409 `OFERTA_TRANSICION_INVALIDA`
- [ ] Dada una oferta `cerrada`, cuando un estudiante postula, entonces responde 422 `OFERTA_NO_VIGENTE`
- [ ] Dada una oferta de la empresa A, cuando la empresa B la consulta o edita, entonces responde 404
- [ ] Dado el listado público, cuando se consulta, entonces solo devuelve ofertas `publicada` con fecha de cierre futura
- [ ] Dada cualquier transición ejecutada, cuando se consulta `oferta_eventos`, entonces existe la fila con estado anterior, nuevo y actor

## Fuera de alcance
Renovar o duplicar una oferta vencida, ofertas con varias etapas de selección, cupos que se descuentan
automáticamente al seleccionar, y aviso por correo del vencimiento próximo (candidato claro para la
fase 5).
