---
name: bitacora
description: Registrar decisiones, cambios de rumbo y hallazgos en la memoria del proyecto Proxi. Úsala al terminar una funcionalidad, al elegir entre alternativas técnicas, al instalar una dependencia, al resolver un bug difícil, o cuando el usuario diga "anota esto", "que no se pierda" o "para acordarnos".
---

# Mantener la memoria del proyecto

Claude no recuerda nada entre sesiones. Lo que no está escrito en el repositorio, no existe. Esta skill
decide **dónde** se escribe cada cosa, porque poner todo en el mismo archivo es lo mismo que no
escribir nada.

## Dónde va cada cosa

| Qué | Dónde | Señal |
|---|---|---|
| Decisión con alternativas y consecuencias duraderas | `docs/adr/NNNN-titulo.md` | "Elegimos X en vez de Y y esto nos va a condicionar" |
| Decisión menor, hallazgo, dependencia nueva, bug con causa no obvia | `docs/decisiones/bitacora.md` | "Esto no se entiende leyendo el código" |
| Regla permanente que Claude debe respetar siempre | `CLAUDE.md` | "Esto no se vuelve a discutir" |
| Comportamiento de una funcionalidad | su `spec.md` | "Así debe funcionar" |
| Avance | `docs/06-roadmap.md` | marcar `[x]` |
| Cambio en tablas o estados | `docs/02-modelo-de-datos.md` | el modelo siempre refleja la base real |

Un ADR es para lo que costará revertir. La bitácora es para lo que costará recordar.

## Formato de la bitácora
Lo más reciente arriba.
```
## AAAA-MM-DD · Título corto
**Contexto:** qué situación lo provocó.
**Decisión:** qué se hizo.
**Motivo:** por qué, y qué se descartó.
**Consecuencia:** con qué hay que vivir ahora.
```

El campo que más se olvida y más vale es **qué se descartó**. Sin eso, en dos meses alguien propone
justo la alternativa que ya se evaluó y se pierde la discusión de nuevo.

## Cuándo NO anotar
No se registra lo que el código ya dice con claridad. "Se creó el endpoint POST /ofertas" no es una
decisión, es un commit. Una bitácora llena de obviedades deja de leerse, y ese es el peor resultado
posible: el archivo sigue ahí pero ya no cumple su función.

## Al cerrar una funcionalidad
1. Marcar las tareas de `specs/<n>/tasks.md` y el roadmap.
2. Anotar en la bitácora solo lo que no sea evidente.
3. Si el modelo de datos cambió, actualizar `docs/02-modelo-de-datos.md` en el mismo commit. Un
   documento de modelo desactualizado es peor que no tenerlo: manda a la gente por el camino
   equivocado con confianza.
