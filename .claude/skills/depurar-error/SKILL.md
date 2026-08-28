---
name: depurar-error
description: Protocolo para diagnosticar un error en Proxi. Úsala cuando el usuario pegue un stack trace, un mensaje de error, un código de error de la API, o diga que algo no funciona, se cuelga, devuelve 500, o funciona en su máquina pero no en el servidor.
---

# Depurar en Proxi

El objetivo no es que el síntoma desaparezca: es entender por qué ocurrió. Un error silenciado con un
`try/catch` vacío vuelve más tarde, más grande y en producción.

## Procedimiento

**1. Reproducir antes de tocar nada.**
Petición exacta, usuario y rol, datos de entrada, estado del registro involucrado. Si no lo puedes
reproducir, el primer trabajo es lograrlo, no adivinar. Si el usuario reporta un `peticionId`, ese es
el atajo: busca ese identificador en los logs y tendrás la petición completa.

**2. Ubicar la capa.** El síntoma dice bastante:
| Síntoma | Dónde mirar primero |
|---|---|
| 422 inesperado | Esquema de validación: campo faltante o tipo distinto |
| 401 en bucle | Rotación del token de refresco, o la cookie no viaja (CORS, `sameSite`, dominio) |
| 403 cuando debería pasar | `autorizar(rol)` con el rol equivocado, o el rol no llega en el token |
| 404 cuando el registro existe | Casi siempre es el filtro de pertenencia: el registro es de otro |
| 409 transición inválida | La tabla de `services/*/estados.js`; imprime el estado real del registro |
| 500 sin más datos | Busca el `peticionId` en el log: ahí está el error real con su stack |
| La petición se cuelga sin responder | Un `async` sin `asyncHandler`, o una transacción sin cerrar |
| Funciona local y falla en el servidor | Variable de entorno ausente, migración no corrida, zona horaria |

**3. Formular una hipótesis y probarla con evidencia**, no con cambios especulativos. Cambiar tres
cosas a la vez y ver que funciona no enseña nada: no sabes cuál era.

**4. Escribir la prueba que falla, antes del arreglo.** Reproduce el bug en una prueba automatizada.
Así compruebas que entendiste la causa y garantizas que no vuelva. Si el bug es de una regla de
negocio, la prueba va en el servicio, no en la ruta.

**5. Arreglar en la capa correcta.** Un dato inválido que llegó al servicio se arregla en la
validación de entrada, no con un `if` defensivo dentro del servicio. Preguntarse siempre: ¿por qué
esto pudo llegar hasta aquí?

**6. Anotar si costó.** Si la causa no era evidente, va a `docs/decisiones/bitacora.md`. El próximo que
lo encuentre —probablemente tú en tres meses— agradecerá los diez minutos.

## Lo que no se hace
- `try/catch` que se traga el error sin registrarlo.
- `console.log` con el cuerpo completo de la petición: ahí van RUT, correos y contraseñas al log.
  Registra el campo puntual que estás investigando.
- Dejar los `console.log` de depuración en el commit.
- "Ya no falla" sin saber por qué. Si el arreglo no tiene explicación, el bug sigue vivo.

## Al reportar el diagnóstico
Causa en una línea, arreglo abajo. Si no puedes verificar algo —el comportamiento real de una librería,
el estado de la base en producción— dilo con esas palabras en vez de suponer.
