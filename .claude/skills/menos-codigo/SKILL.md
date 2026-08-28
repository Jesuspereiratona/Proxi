---
name: menos-codigo
description: Regla de economía de código para Proxi. Úsala antes de escribir o generar cualquier archivo nuevo, al revisar un diff que se ve grande, cuando el usuario diga que algo es exagerado, demasiado, o pida simplificar. También al final de cada bloque de trabajo, como pasada de reducción.
---

# Menos código

Este proyecto lo mantiene una sola persona. Cada línea escrita es una línea que alguien tiene que
leer, entender y arreglar en seis meses. El código más barato de mantener es el que no existe.

Esto **no** es permiso para saltarse validaciones, permisos, pruebas ni manejo de errores: esos son
el motivo de existir del proyecto. Se recorta la ceremonia, nunca la seguridad.

## Antes de escribir: la escalera
Para cada pieza que vayas a crear, en orden:
1. ¿Tiene que existir?
2. ¿Ya lo hace Node o Express de fábrica?
3. ¿Lo hace una dependencia que ya está instalada?
4. ¿Cabe en una línea dentro de algo que ya existe?

Recién si las cuatro fallan, se crea el archivo.

## Declara el presupuesto
Antes de generar código, di en una línea: **qué archivos vas a tocar y cuántas líneas estimas.**
Si la estimación pasa de ~150 líneas para una tarea, párate y explica por qué antes de seguir.
Un presupuesto dicho en voz alta se corrige antes; un diff de 800 líneas ya nadie lo revisa de verdad.

## Un archivo por recurso y capa. No por clase ni por función
Nueve clases de error son un archivo `errors/index.js` de cuarenta líneas, no nueve archivos.
Tres helpers de fechas son un `utils/fechas.js`, no tres.
Si un archivo tiene menos de quince líneas y no va a crecer, casi siempre pertenece a otro.

## Prohibido sin pedirlo
- Abstracciones de un solo uso: una función usada una vez es la línea, no la función.
- Configurabilidad que nadie pidió: opciones, banderas y parámetros "por si acaso".
- Capas vacías: un service que solo reenvía a un repositorio sin ninguna regla propia.
- Dependencias nuevas. Se pregunta primero, y la respuesta por defecto es la biblioteca estándar.
- Comentarios que repiten el código, JSDoc en funciones privadas obvias, archivos README dentro de
  carpetas de código.
- Manejo de casos que no existen todavía: eso es la Fase 6 del roadmap, no el archivo de hoy.

## Copia antes de inventar
Antes de escribir un patrón nuevo, busca el más parecido que ya exista en el repositorio y síguelo.
Dos formas de hacer lo mismo en el mismo proyecto cuestan más que cualquiera de las dos por separado.

## Pasada de reducción
Al terminar un bloque, lee tu propio diff y pregunta línea por línea: **¿esto se puede borrar sin
cambiar el comportamiento?** Borra lo que sobre y di qué borraste. Es más valioso que agregar.

Cada línea del diff debe poder rastrearse a algo que el usuario pidió. Si no puedes explicar por qué
está ahí, no debería estar.

## Cómo reportar
Corto. Qué se hizo, qué falta, qué te preocupa. Sin repetir en prosa lo que el diff ya muestra.
