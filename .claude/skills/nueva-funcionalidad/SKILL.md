---
name: nueva-funcionalidad
description: Flujo obligatorio para construir cualquier funcionalidad con reglas de negocio en Proxi (ofertas, postulaciones, estados, permisos, datos personales). Úsala siempre que el usuario pida "agregar", "implementar" o "construir" algo que cambie el comportamiento del sistema, antes de escribir una sola línea de código. También cuando pida empezar una fase del roadmap.
---

# Construir una funcionalidad en Proxi

Este proyecto usa especificación selectiva: lo que tiene reglas o riesgo se escribe antes de
programarse. El motivo es concreto: quien retome el proyecto —incluida una sesión futura de Claude,
que no recuerda nada— reconstruye el contexto leyendo el repositorio, no el chat.

## Primero: ¿esto necesita spec?

Necesita spec si toca **estados, permisos, datos personales, dinero o plazos**. También si hay más de
un camino posible y elegir mal cuesta rehacer.

No necesita spec un CRUD sin reglas, un cambio de estilos, un ajuste de texto o un arreglo evidente.
Ahí se va directo al código. Forzar la ceremonia en todo es la razón por la que la gente abandona
este método a las dos semanas.

Si tienes dudas, pregunta al usuario en una línea en vez de asumir.

## Con spec

1. **Lee el contexto antes de escribir**: `docs/00-vision-y-alcance.md` para saber si esto está dentro
   del alcance, y `docs/02-modelo-de-datos.md` para no inventar tablas que ya existen.
2. **Crea `specs/<n>-<nombre-corto>/`** copiando `specs/_plantilla/`.
3. **Escribe `spec.md`.** Lo importante son los criterios de aceptación: si no puedes escribir la
   prueba automatizada a partir del criterio, el criterio está mal redactado. Reescríbelo.
4. **Escribe `plan.md`.** Aquí sí entran tablas, endpoints y servicios. Si aparece una decisión con
   alternativas reales, es un ADR en `docs/adr/`, no un párrafo enterrado en el plan.
5. **Escribe `tasks.md`**: pasos atómicos, cada uno terminable y probable por separado.
6. **Muestra la spec al usuario y espera su visto bueno.** Es más barato discutir un documento que
   rehacer código.
7. **Implementa tarea por tarea**, marcando `[x]` a medida que avanzas. Respeta las capas de
   `docs/01-arquitectura.md`: un controller no consulta la base, un service no conoce `req`.
8. **Cierra**: pruebas en verde, lista de seguridad revisada, decisiones no obvias en la bitácora,
   roadmap actualizado.

## Sin spec
Implementa directo, pero siguen valiendo las capas, el catálogo de errores y las pruebas. Y si en el
camino descubres que sí había una regla escondida, detente y escribe la spec: eso es exactamente lo
que la spec existe para atrapar.

## Errores que se repiten
- Escribir la spec **después** del código para cumplir el trámite. No sirve de nada: el valor está en
  pensar antes.
- Criterios de aceptación vagos ("el sistema debe funcionar bien"). Un criterio se prueba o no es un
  criterio.
- Empezar a programar sin leer `docs/02-modelo-de-datos.md` y terminar duplicando una tabla.
