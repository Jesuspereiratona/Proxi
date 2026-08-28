# ADR 0002 · Vigencia obligatoria y cierre declarado

- **Estado:** aceptada
- **Fecha:** 2026-08-28

## Contexto
El diagnóstico (`docs/investigacion/diagnostico-mercado.md`) muestra que cerca del 30% de los avisos
publicados nunca lleva a una contratación, y que el ghosting a postulantes creció 120% entre 2018 y
2023. La molestia original que dio origen al proyecto fue exactamente esa: "se publican avisos pero no
sabes cuándo se acaban ni qué pasó".

## Alternativas
1. **Fecha de cierre opcional, con recordatorio por correo.** Menos fricción para la empresa. Pero lo
   opcional no se usa: seríamos un portal más con avisos zombis.
2. **Fecha de cierre obligatoria y vencimiento automático.** Resuelve el aviso zombi, pero no obliga a
   la empresa a decir qué pasó.
3. **Obligatoria + cierre con motivo + bloqueo por cierres sin declarar.** Cierra el ciclo completo.
   Fricción real para la empresa que se porta mal, ninguna para la que se porta bien.

## Decisión
Alternativa 3, con la regla escrita en la base de datos y no solo en el código:

```sql
fecha_cierre timestamptz NOT NULL
CHECK (estado <> 'cerrada' OR motivo_cierre IS NOT NULL)
```

Una empresa con ofertas cerradas y `resultado_declarado = false` por más de
`PLAZO_DECLARAR_CIERRE_DIAS` no puede enviar una oferta nueva a revisión.

## Consecuencias
**A favor:** el aviso fantasma es imposible por diseño; hay datos reales de resultados para la
coordinación; es el diferenciador que hace defendible el proyecto.
**En contra:** una empresa puede declarar un motivo falso —no lo podemos verificar—, y algunas se
irritarán con el bloqueo. Se acepta: la restricción va contra el descuido, que es el caso frecuente,
no contra la mala fe deliberada. El indicador público de transparencia es el contrapeso reputacional.
