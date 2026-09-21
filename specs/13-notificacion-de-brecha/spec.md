# Notificar a las personas afectadas por una brecha

Hueco 3 del simulacro (`docs/decisiones/bitacora.md`, 2026-08-30).

## El problema

`docs/09-procedimiento-de-brecha.md` dice, en el paso 4: *"A las personas afectadas, en lenguaje
claro y sin tecnicismos"*, con la carta ya redactada. Y `correo.service.js` solo sabe mandar **un**
correo transaccional a **una** persona.

O sea: el procedimiento está escrito y no se puede ejecutar. El día que haya que avisarle a 300
estudiantes en menos de 72 horas, alguien tendría que improvisar un script bajo presión, de noche, y
llevar la cuenta a mano de a quién ya le avisó. Es exactamente el momento en que nadie debería estar
escribiendo código.

## Lo que hace difícil esto, y no es mandar correos

1. **El reloj.** 72 horas desde la detección. No hay margen para empezar de cero si algo falla a
   mitad.
2. **Se corta.** Un envío a 300 personas tarda, y el proceso puede morir en el 150. Volver a
   empezar significaría escribirle dos veces a la mitad de la gente, en el peor momento posible para
   verse desprolijo.
3. **Hay que demostrar que se avisó.** La Agencia puede preguntar a quién se notificó y cuándo. Un
   "mandamos los correos" no es prueba.
4. **El proveedor gratuito corta.** Brevo permite 300 correos al día. Con más afectados que eso, la
   notificación abarca más de un día **por diseño**, y eso hay que saberlo antes, no descubrirlo a
   mitad.

## Reglas

1. Es un **script de rotura de vidrio**, no un endpoint. Una ruta HTTP capaz de escribirle a todos
   los usuarios es un arma si las credenciales se filtran. Mismo criterio que
   `revocar-todas-las-sesiones.js`.
2. Cada notificación queda registrada con el incidente, la persona y la fecha. Esa fila **es** la
   prueba.
3. **Reanudable**: volver a correrlo con el mismo incidente salta a quien ya recibió el aviso.
4. **Tope por corrida**, configurable, con un valor por defecto que no supere lo que aguanta un plan
   gratuito de correo. Al llegar al tope, dice cuántos quedan.
5. Si un envío falla, **no aborta**: registra el fallo, sigue con el resto, y al final informa
   cuántos fallaron para poder reintentarlos. Mismo patrón que `procesarRetencion`.
6. Quién está afectado lo decide **una persona**, no el script. El script puede *proponer* la lista
   a partir de `auditoria_accesos` —quién tocó datos de quién, en qué ventana— pero la decisión de
   notificar no se toma en solitario (`docs/09`, paso 3).
7. Nunca se registra un correo electrónico en el log, ni siquiera acá. Se cuentan personas, no se
   nombran.
8. El texto del aviso es el de `docs/09-procedimiento-de-brecha.md`, no uno inventado al vuelo.

## Criterios de aceptación

1. Notificar a tres personas registra tres filas con el mismo incidente.
2. Volver a correrlo con el mismo incidente no manda nada y reporta 3 ya notificadas.
3. Correrlo con **otro** incidente sí vuelve a notificar a las mismas personas.
4. Con un tope de 2 y 5 afectados, manda 2 y reporta 3 pendientes.
5. Si el envío a una persona falla, las otras igual reciben el aviso y el resultado reporta 1 fallo.
6. Una persona cuya cuenta ya fue suprimida (`anonimizadoAt`) **no** recibe correo: su dirección ya
   no existe, es un marcador `@proxi.invalid`.
7. `afectadosPorActor` devuelve los dueños de los CV descargados y los estudiantes cuyo RUT se
   descifró, dentro de la ventana, y **no** incluye al actor.
8. El log de una corrida no contiene ninguna dirección de correo.

## Fuera de alcance

- Notificar a la Agencia. Eso es un trámite con formulario, no un correo.
- Decidir si hay que notificar. Eso lo dice `docs/09-procedimiento-de-brecha.md` y lo decide la FEN.
