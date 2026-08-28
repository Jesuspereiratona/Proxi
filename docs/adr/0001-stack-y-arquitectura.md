# ADR 0001 · Stack y arquitectura

- **Estado:** aceptada
- **Fecha:** 2026-08-28

## Contexto
Plataforma de prácticas para la FEN UAH, desarrollada por una persona, que además sirve como producto
de portafolio del bootcamp Full Stack JavaScript. Cada elección técnica debe poder defenderse contra
un aprendizaje esperado del plan formativo, y debe ser mantenible por una sola persona.

## Alternativas
1. **Monolito Express + EJS.** Simple, cubre el módulo 6. Pero mezcla presentación y datos, deja fuera
   el consumo de API con `fetch` del módulo 4 y complica separar la seguridad.
2. **API REST + cliente separado (HTML/CSS/Bootstrap/JS), monorepo.** Cubre los módulos 2 a 8
   completos. Frontera explícita para CORS, JWT y límite de tasa. Cuesta mantener dos aplicaciones.
3. **API + SPA React.** Más cercano al mercado, pero React no está en la currícula: no es defendible
   en la evaluación y agrega superficie de error y de aprendizaje simultáneo.
4. **Híbrido SSR + API.** Cubre todo, pero duplica capas de presentación en un proyecto de una persona.

## Decisión
Alternativa 2. Node 20 + Express + PostgreSQL 15 + Sequelize + JWT, cliente en HTML/CSS/Bootstrap/JS
sin framework, monorepo con workspaces de npm.

## Consecuencias
**A favor:** cobertura curricular completa y demostrable; seguridad concentrada en un borde; API
reutilizable; validaciones y catálogo de errores compartidos en `packages/`.
**En contra:** dos aplicaciones que mantener y un contrato entre ellas que no puede romperse en
silencio. Se mitiga con versión en la URL (`/api/v1`) y pruebas de integración por ruta.
