# ADR 0003 · Herramienta de pruebas

- **Estado:** aceptada
- **Fecha:** 2026-08-28

## Contexto
Proxi exige pruebas automatizadas, sobre todo la de acceso cruzado en cada ruta con `:id`. Los
proyectos previos del bootcamp casi no tienen pruebas, así que esta es la primera vez que se
introduce el hábito. Lo que se elija tiene que ser fácil de sostener, o las pruebas se abandonan al
tercer sprint y la garantía de seguridad se cae con ellas.

## Alternativas
1. **Jest.** Lo más común del ecosistema, mucha documentación. Pero es una dependencia grande, con
   configuración propia y fricciones conocidas al mezclarse con CommonJS y con módulos nativos.
2. **`node --test`** (corredor de pruebas incluido en Node 20) **+ supertest.** Cero configuración,
   cero dependencias nuevas salvo supertest. Sintaxis casi idéntica (`describe` / `it`). Menos
   material de ayuda en internet que Jest.
3. **Vitest.** Rápido y moderno, pero pensado para proyectos con empaquetador; aquí no hay ninguno.

## Decisión
Alternativa 2: `node --test` con `node:assert` y supertest para las pruebas de integración.
```json
"scripts": { "test": "node --test" }
```

## Consecuencias
**A favor:** una dependencia en lugar de veinte; nada que configurar; encaja con el `node --watch` que
ya usas; el corredor no puede quedar obsoleto porque viene con Node.
**En contra:** al buscar ayuda, la mayoría de los ejemplos estarán escritos para Jest. La traducción
es casi mecánica (`test()` / `describe()` / `it()` existen igual; cambia `expect(x).toBe(y)` por
`assert.strictEqual(x, y)`), pero hay que saberlo de antemano.
**Reversible:** si en algún momento hace falta algo que solo Jest da —simulaciones complejas, reportes
de cobertura más ricos— migrar es reescribir las afirmaciones, no la estructura.
