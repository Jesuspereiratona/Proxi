# Arranque en VS Code

Este proyecto quedó **planteado y documentado**. Falta escribir el código, y eso se hace en VS Code
con Claude Code.

## Antes de la primera sesión
```bash
cd ~/proyectos/Proxi
git init
git add .
git commit -m "docs: planteamiento del proyecto, arquitectura, seguridad y specs"
```
Opcional pero recomendado: crea el repo en GitHub y súbelo. Así la CI corre desde el primer día.

## Qué hay aquí y por qué importa
- **`CLAUDE.md`** — Claude Code lo lee solo en cada sesión. Son las reglas duras: capas, nombres,
  qué nunca se registra en logs, cómo responder. No hay que pegarlo ni recordarlo.
- **`docs/`** — el porqué de cada cosa. Empieza por `00-vision-y-alcance.md`.
- **`specs/`** — cómo debe comportarse cada funcionalidad, con criterios de aceptación que se
  traducen directo a pruebas. La primera ya está escrita: `01-ciclo-de-vida-oferta/`.
- **`.claude/skills/`** — cinco procedimientos que Claude Code carga solo cuando corresponde:
  construir una funcionalidad, crear un endpoint, revisar seguridad, depurar, y mantener la bitácora.
- **`.claude/agents/`** — cuatro revisores especializados que se invocan a pedido: auditor de
  seguridad, revisor de migraciones, escritor de pruebas y guardián de la documentación.

## Cómo empezar la primera sesión de código
Abre la carpeta en VS Code, abre Claude Code y escribe algo así:

> Lee CLAUDE.md y docs/06-roadmap.md. Vamos a hacer la Fase 0 completa: estructura de apps/api,
> configuración validada al arrancar, conexión a PostgreSQL, healthcheck, clases de error con el
> manejador central, logger con censura de datos personales, helmet y límite de tasa, y Jest con una
> prueba del healthcheck. Empieza por la estructura de carpetas y muéstramela antes de escribir código.

Cuando llegues a la Fase 3, el arranque es más corto porque la spec ya existe:

> Lee specs/01-ciclo-de-vida-oferta/ completo e implementa las tareas en orden, marcándolas a medida
> que avanzas.

## Cómo usar las skills y los agentes
Se activan solas por contexto, pero puedes llamarlas por nombre:
- `usa la skill nueva-funcionalidad` — al empezar algo con reglas de negocio
- `usa la skill nuevo-endpoint` — al crear una ruta
- `revisa esto con el agente auditor-seguridad` — antes de fusionar una rama
- `usa el agente revisor-migraciones` — antes de aplicar una migración
- `usa el agente escritor-pruebas` — cuando falten pruebas
- `usa el agente guardian-docs` — al cerrar una fase

## Deuda de planificación conocida
La API está especificada al detalle; **el cliente web no**. La Fase 6 del roadmap tiene la advertencia
completa, pero en corto: antes de escribir la primera pantalla hay que crear
`specs/02-vitrina-publica/` y `docs/08-guia-visual.md`, y decidir cómo se ve cada estado de una oferta.
Es trabajo de planificación, no de código, y toma poco. Saltárselo significa improvisar la parte del
producto que la gente efectivamente mira.

También falta una skill `nueva-pantalla`, equivalente de `nuevo-endpoint` para el front. Vale la pena
escribirla recién después de la primera pantalla, cuando ya exista un patrón real que copiar en vez de
uno inventado.

## Reglas de higiene
1. **Una rama por funcionalidad.** `main` siempre debe poder desplegarse.
2. **Nada de secretos en el repo.** `.env` está ignorado; `.env.example` documenta las claves.
3. **Anota lo no obvio** en `docs/decisiones/bitacora.md`. Es la memoria del proyecto: sin ella, cada
   sesión nueva de Claude empieza de cero.
4. **Marca el roadmap.** Es lo primero que se lee para saber dónde quedó todo.
5. **La prueba de acceso cruzado no se salta.** Es la defensa contra el riesgo número uno del sistema.

## Si vienes de tus proyectos del bootcamp
La estructura de `apps/api/src` es la misma de tu `toolshare-api`. Lo que cambia son cuatro cosas, y
están explicadas una por una en `docs/investigacion/referencia-proyectos-previos.md`: aparece la capa
`services/`, el `try/catch` sale de los controllers, el middleware de auth devuelve 401/403 y trae el
rol, y hay pruebas obligatorias de acceso cruzado.

## Orden de lectura para alguien que llega nuevo
`README.md` → `CLAUDE.md` → `docs/00-vision-y-alcance.md` → `docs/01-arquitectura.md` →
`docs/02-modelo-de-datos.md` → `docs/03-seguridad.md` → `docs/06-roadmap.md`
