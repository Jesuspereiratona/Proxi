# Vigilancia de `auditoria_accesos`

Hueco 1 del simulacro de brecha (`docs/decisiones/bitacora.md`, 2026-08-30).

## El problema

Proxi registra cada acceso a datos personales de un estudiante: `descargar_cv`, `ver_rut`,
`ver_postulantes`, `exportar_datos`. La tabla es evidencia impecable **después** de que alguien
avise. Lo que no existe es lo de antes: **nadie mira esa tabla**.

Si mañana la cuenta de coordinación queda comprometida y alguien descarga 300 CV en una tarde, la
fila queda escrita, correctamente, 300 veces. Y no pasa nada. Nos enteraríamos cuando un estudiante
reclame, si reclama.

La Ley 21.719 da **72 horas** para notificar desde que se **detecta** una brecha. Un control que solo
sirve para reconstruir los hechos después no ayuda a detectarla.

## Qué cuenta como anómalo, y por qué no es un número fijo

Un umbral fijo ("más de 50 al día") no sirve en los dos extremos: hoy, con seis cuentas de prueba,
50 accesos serían un escándalo y no dispararían nada; el día que la FEN tenga 400 estudiantes,
coordinación revisando postulaciones podría pasar de 50 en una mañana normal.

**La línea base se calcula de la propia historia**: cuántos accesos hace normalmente cada rol por
día. Se alerta cuando alguien se sale de su propio patrón, no del de otro.

Además hace falta un **piso absoluto**: en un sistema recién estrenado la historia es casi vacía y
cualquier cosa parece un pico. Por debajo de ese piso no se alerta nunca, aunque estadísticamente
destaque.

## Reglas

1. Se miran las acciones que tocan datos personales de un estudiante: `descargar_cv`, `ver_rut`,
   `ver_postulantes`, `exportar_datos`. `eliminar_cuenta` y `retirar_logo` no: son acciones de
   gestión y su volumen no dice nada sobre una fuga.
2. La ventana de observación es el último día. La línea base son los 30 días anteriores a esa
   ventana, por usuario.
3. Se alerta sobre un usuario cuando supera **a la vez**: el piso absoluto, y un múltiplo de su
   propia línea base.
4. Un usuario sin historia (primera vez que aparece) solo se compara con el piso absoluto.
5. La alerta **nunca** incluye correo, RUT ni nombre: solo `usuarioId`, `rol`, el conteo y la línea
   base. La regla dura de `CLAUDE.md` no tiene excepción para las alertas.
6. La vigilancia **no bloquea a nadie ni revoca nada**. Avisa. Cortar el acceso de coordinación por
   un falso positivo, en plena temporada de prácticas, haría más daño que el ataque que busca.
7. El resultado no sale por `GET /salud`, que es público y sin autenticación: decir en abierto
   "hoy detectamos un acceso anómalo" es información para quien lo esté haciendo.

## Criterios de aceptación

1. Un usuario con 3 accesos hoy y 3 diarios de línea base no genera alerta.
2. Un usuario con 200 accesos hoy y 3 de línea base genera alerta.
3. Un usuario con 200 accesos hoy y 180 de línea base **no** genera alerta: es su patrón normal.
4. Un usuario que aparece por primera vez con 5 accesos no genera alerta (por debajo del piso).
5. Un usuario que aparece por primera vez con 200 accesos sí genera alerta.
6. Las acciones de gestión (`eliminar_cuenta`, `retirar_logo`) no cuentan para el volumen.
7. La alerta contiene `usuarioId`, `rol`, `accesos` y `lineaBase`, y **ninguna** clave con correo,
   RUT o nombre.
8. `GET /salud` publica que la tarea corrió y si falló, pero **no** si hubo alerta ni sobre quién.
9. `POST /tareas/ejecucion` —que exige secreto— sí devuelve las alertas.
10. La tarea se detiene en el apagado ordenado, como las otras.

## Fuera de alcance

- Mandar el aviso por correo. Hoy no hay SMTP configurado, y el canal de aviso que sí existe es que
  el flujo de GitHub Actions falle de forma ruidosa. Cuando haya correo, se suma.
- Bloquear automáticamente al usuario. Ver regla 6.
