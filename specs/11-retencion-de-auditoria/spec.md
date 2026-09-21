# Retención de `auditoria_accesos`

## El problema

`auditoria_accesos` crece sin límite. Guarda `usuario_id`, `ip` y `user_agent` de cada acceso a
datos de un estudiante, **para siempre**, incluso de cuentas ya suprimidas — `eliminarCuenta` no la
toca a propósito, porque esa fila es evidencia.

El otro extremo quedó abierto: una persona que ejerció su derecho de supresión en 2026 seguiría
teniendo su IP registrada en 2035. Eso contradice la minimización que exige la Ley 21.719 tan
directamente como borrar la evidencia contradiría la responsabilidad proactiva.

## La decisión que hay que tomar, y por qué no es "borrar a los N meses"

Una fila de auditoría tiene dos partes con valor y vida útil distintos:

| Parte | Para qué sirve | Cuánto tiempo hace falta |
|---|---|---|
| quién, qué, cuándo | demostrar que el acceso ocurrió, ante un reclamo o una revisión | años |
| `ip`, `user_agent` | investigar una brecha: desde dónde se hizo, con qué | semanas o meses |

Borrar la fila entera a los 12 meses tiraría la evidencia junto con el dato de red. Dejarla intacta
guardaría el dato de red mucho después de que sirva para algo.

**Se hace en dos etapas.** Primero se anonimiza (se anulan `ip` y `user_agent`, la fila sobrevive);
mucho después, se borra.

## Reglas

1. A los **12 meses**, `ip` y `user_agent` se anulan. La fila queda: quién accedió a qué y cuándo.
2. A los **24 meses**, la fila se borra.
3. Las dos ventanas son configurables por variable de entorno, con los mismos topes de validación
   que `RETENCION_CV_MESES`: si alguien pone un valor absurdo, la app no arranca.
4. El borrado **nunca** puede ser anterior a la anonimización. Si la configuración dice lo
   contrario, la app no arranca.
5. La tarea corre una vez al día, no aborta si una fila falla, y deja su estado en `/salud`, igual
   que las otras cuatro.
6. Es idempotente: correrla dos veces el mismo día no cambia nada la segunda vez.
7. La tarea **no** distingue si la cuenta fue suprimida. La auditoría de una cuenta eliminada tiene
   el mismo valor probatorio y la misma fecha de vencimiento que la de una activa.

## Criterios de aceptación

1. Una fila de hace 13 meses conserva `usuario_id`, `accion`, `entidad`, `entidad_id` y
   `created_at`, y tiene `ip` y `user_agent` en `NULL`.
2. Una fila de hace 11 meses no se toca.
3. Una fila de hace 25 meses ya no existe.
4. Una fila de hace 13 meses **sigue existiendo** (no se borró al anonimizarla).
5. Correr la tarea dos veces seguidas deja el mismo resultado que correrla una vez, y la segunda
   corrida reporta 0 anonimizadas y 0 borradas.
6. La tarea anonimiza y borra igual las filas de cuentas ya suprimidas (`anonimizado_at` no nulo).
7. Con `RETENCION_AUDITORIA_BORRADO_MESES` menor que `RETENCION_AUDITORIA_MESES`, la app se niega a
   arrancar con un mensaje que nombra las dos variables.
8. Con cualquiera de las dos en cero, negativa o no entera, la app se niega a arrancar.
9. `GET /salud` publica `ultimaEjecucionAt` y `huboError` de la tarea nueva, y **no** los conteos
   (mismo criterio que las otras cuatro: cuánto se borró es dato de gestión).
10. La tarea nueva se detiene en el apagado ordenado, como las otras cuatro.

## Fuera de alcance

- Purgar `oferta_eventos` y `postulacion_eventos`. Son historial de negocio, no datos de red, y su
  retención es otra conversación.
- Exportar la auditoría antes de borrarla. Si hace falta conservarla más allá de 24 meses, eso es
  una decisión de la FEN con su abogado, no un default del código.
