# Proxi

Plataforma de prácticas profesionales: las empresas publican ofertas y los estudiantes postulan.

**Lo que la hace distinta:** ninguna oferta queda publicada sin fecha de vigencia, y ninguna
postulación queda sin respuesta. El estado y el tiempo son el centro del sistema, no un detalle.

## Estado
En diseño. Ver `docs/06-roadmap.md` para el avance por fases.

## Documentación
| Documento | Para qué sirve |
|---|---|
| `CLAUDE.md` | Reglas del proyecto. Se lee siempre, antes de escribir código |
| `docs/00-vision-y-alcance.md` | Qué construimos, para quién, qué queda fuera |
| `docs/01-arquitectura.md` | Capas, carpetas y por qué están así |
| `docs/02-modelo-de-datos.md` | Tablas, relaciones y máquinas de estado |
| `docs/03-seguridad.md` | Amenazas, defensas y Ley 21.719 |
| `docs/04-manejo-de-errores.md` | Catálogo de errores y cómo se propagan |
| `docs/05-convenciones.md` | Nombres, estilo, commits, ramas |
| `docs/06-roadmap.md` | Fases de construcción en orden |
| `docs/07-operacion-y-mantenimiento.md` | Despliegue, respaldos, monitoreo |
| `docs/investigacion/diagnostico-mercado.md` | Evidencia del problema que resolvemos |
| `docs/decisiones/bitacora.md` | Registro cronológico de decisiones |
| `docs/adr/` | Decisiones grandes, una por archivo |
| `specs/` | Especificación de cada funcionalidad antes de programarla |

## Puesta en marcha (cuando exista código)
```bash
cp .env.example .env      # completar secretos
docker compose up -d db   # PostgreSQL local
npm install
npm run db:migrate
npm run db:seed
npm run dev -w apps/api   # http://localhost:3000
npm run dev -w apps/web   # http://localhost:5173
```

## Stack
Node 20 LTS · Express · PostgreSQL 15 · Sequelize · JWT · HTML/CSS/Bootstrap/JS (sin framework)
