# Bitácora de decisiones

Registro cronológico, lo más reciente arriba. Aquí va lo que **no** es obvio leyendo el código: por qué
se eligió algo, qué se descartó, qué salió mal.

Se anota cuando: se toma una decisión técnica no evidente · se descarta una alternativa · se cambia
algo ya decidido · se resuelve un bug cuya causa costó encontrar · se instala una dependencia.

Formato:
```
## AAAA-MM-DD · Título corto
**Contexto:** qué situación lo provocó.
**Decisión:** qué se hizo.
**Motivo:** por qué, y qué se descartó.
**Consecuencia:** con qué hay que vivir ahora.
```

---

## 2026-08-28 · Método de trabajo: especificación antes que código, de forma selectiva
**Contexto:** proyecto de un solo desarrollador, asistido por IA. El asistente no recuerda nada entre
sesiones y el hilo del proyecto se perdía en el chat.
**Decisión:** lo que tiene reglas de negocio o riesgo se especifica en `specs/<n>-<nombre>/` (spec,
plan, tareas) antes de programarse. Lo rutinario va directo al código. Las decisiones no obvias se
anotan aquí.
**Motivo:** el repositorio pasa a ser la memoria del proyecto. Cualquier sesión futura, o cualquier
otra persona, reconstruye el contexto leyendo `CLAUDE.md` y `docs/`. Se descartó especificar todo:
en proyectos de una persona esa disciplina se abandona en semanas.
**Consecuencia:** cada funcionalidad con reglas cuesta un rato de escritura antes de empezar. A cambio,
el asistente deja de reinventar criterios en cada sesión.

## 2026-08-28 · Nombre del proyecto: Proxi
**Contexto:** hacía falta un nombre neutro, usable en la FEN UAH y en un portafolio personal.
**Decisión:** Proxi. Repositorio `proxi`, base `proxi_dev` / `proxi_prod`.
**Motivo:** corto, pronunciable, sin amarre institucional.
**Consecuencia:** ninguna marca de la universidad aparece en el código; si mañana se instala en otra
facultad, solo cambia la configuración.

## 2026-08-28 · Arquitectura: API REST + cliente separado, en un monorepo
**Contexto:** alternativas evaluadas: monolito con plantillas EJS, API + SPA en React, o híbrido.
**Decisión:** `apps/api` (Express) y `apps/web` (HTML/CSS/Bootstrap/JS sin framework), mismo repo.
**Motivo:** cubre los aprendizajes esperados de los módulos 2 al 8 de la currícula (incluido el
consumo de API con fetch y la seguridad con JWT del módulo 8), y deja una frontera explícita donde
concentrar CORS, tokens y límite de tasa. React se descartó por no estar en la currícula: no sería
defendible en la evaluación y agrega superficie de error.
**Consecuencia:** hay que mantener dos aplicaciones y un contrato entre ellas. Se mitiga compartiendo
validaciones y códigos de error en `packages/`.

## 2026-08-28 · El ciclo de vida es el producto
**Contexto:** el diagnóstico de mercado mostró que el problema no es publicar, es cerrar.
**Decisión:** `fecha_cierre` obligatoria a nivel de base de datos, cierre con motivo obligatorio,
bloqueo de publicación a empresas con cierres sin declarar, y estado terminal garantizado para toda
postulación.
**Motivo:** cerca del 30% de los avisos nunca lleva a contratación y el ghosting subió 120% en cinco
años. Si estas reglas fueran opcionales, nadie las usaría y seríamos un portal más.
**Consecuencia:** el modelo de datos es más estricto y hay dos tareas programadas que mantener. Se
acepta: es la razón de existir del proyecto.

## 2026-08-28 · Alinear Proxi con las convenciones de los proyectos previos
**Contexto:** se revisó la carpeta `BOOTCAMP PROYECTOS`. `toolshare-api` (módulo 8) ya tiene el
esqueleto `src/{app,server,config,controllers,middlewares,models,routes}` con nombres
`<recurso>.<capa>.js`, CommonJS y el stack Express + Sequelize + JWT.
**Decisión:** Proxi adopta esa estructura y esos nombres tal cual, en vez de imponer convenciones
nuevas. Se agregan solo cuatro diferencias: capa `services/`, manejo central de errores, códigos HTTP
correctos con rol en el token, y pruebas obligatorias de acceso cruzado.
**Motivo:** la estructura ya es correcta y ya es familiar. Cambiarla porque sí agrega carga de
aprendizaje sin beneficio, y todo lo que se aprende aquí sirve para defender los módulos del bootcamp.
Se descartó kebab-case en los archivos de capa por lo mismo.
**Consecuencia:** la documentación quedó ajustada (`CLAUDE.md`, `05-convenciones.md`). El detalle de
qué se hereda y qué cambia está en `docs/investigacion/referencia-proyectos-previos.md`.

## 2026-08-28 · Pruebas con el corredor nativo de Node
**Contexto:** hay que introducir pruebas automatizadas en un proyecto de una persona que casi no las
ha usado antes.
**Decisión:** `node --test` + supertest, no Jest. Detalle en `docs/adr/0003-herramienta-de-pruebas.md`.
**Motivo:** cero configuración y cero dependencias extra. Lo que se abandona no protege a nadie.
**Consecuencia:** los ejemplos que se encuentren en internet estarán escritos para Jest y hay que
traducir las afirmaciones.

## 2026-08-28 · Hallazgo: archivos .env versionados en proyectos previos
**Contexto:** `toolshare-api`, `libro_autor_lib_M8_L2` y `peliculas-actores` tienen `.env` junto al
código.
**Decisión:** en Proxi, `.env` en `.gitignore` desde el primer commit; `.env.example` documenta las
claves con valores vacíos.
**Motivo:** un secreto que entra a git queda en el historial aunque después se borre el archivo.
**Consecuencia:** si alguno de esos repos previos llegó a GitHub, esas credenciales deberían rotarse.

## 2026-08-28 · El cliente web queda sin especificar (deuda consciente)
**Contexto:** la Fase 3 tiene spec completa con criterios de aceptación; la Fase 6 (cliente web) solo
tiene una lista de casillas.
**Decisión:** se deja así por ahora, con la advertencia escrita en el roadmap y en `ARRANQUE.md`.
Antes de la primera pantalla hay que escribir `specs/02-vitrina-publica/` y `docs/08-guia-visual.md`.
**Motivo:** especificar pantallas antes de que la API devuelva datos reales lleva a rehacer. Pero la
deuda queda anotada donde se va a leer, no en la memoria de nadie.
**Consecuencia:** el riesgo es llegar a la Fase 6 con prisa y improvisar la interfaz. El punto crítico
a no improvisar es la representación visual de los estados: si `publicada`, `cierra pronto` y `cerrada`
no se distinguen de un vistazo, el diferenciador del producto no llega al usuario.
