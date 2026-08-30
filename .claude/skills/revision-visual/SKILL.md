---
name: revision-visual
description: Analiza una pantalla o toda la interfaz de Proxi buscando mejoras visuales y funcionalidades que faltan, comparando contra plataformas reales similares (portales de práctica/empleo). Úsala cuando el usuario pida "más vida", más colores, mejorar el diseño, o preguntar qué funcionalidades le faltan a la app frente a la competencia.
---

# Revisión visual y de funcionalidades

Antes de proponer nada nuevo, revisa si ya existe una decisión de diseño sin terminar de aplicar —
en este proyecto, la mejora de mayor impacto casi siempre es esa, no una idea nueva.

## Paso 1 · ¿Ya está diseñado y no implementado?
Lee `docs/08-guia-visual.md` completo. Para cada estado/color/forma que documenta, busca en
`apps/web/assets/css/` y en las páginas si de verdad se aplica. Esto ya pasó una vez: la guía
especificaba insignias de color para los estados de postulación y de empresa desde Fase 6, con
contraste WCAG ya calculado, y dos paneles enteros los mostraban en texto plano. Terminar un diseño
ya aprobado es menor riesgo y mayor impacto que inventar uno nuevo — no hay que volver a verificar
contraste ni convencer a nadie del color.

## Paso 2 · Investigación real, nunca de memoria
Para comparar funcionalidades contra la competencia, usa `WebSearch`/`WebFetch` de verdad. La memoria
de un modelo sobre "qué tiene tal plataforma" envejece mal y no cita fuente. Busca:
- Portales de empleo/práctica chilenos: Laborum.cl, Trabajando.com, Computrabajo Chile.
- Software de "career services" que usan universidades: Symplicity (Career Services Manager),
  Handshake — son el estándar de facto para lo que hace Proxi, más relevantes que un portal de
  empleo genérico.

Por cada funcionalidad que se proponga, cita **qué plataforma real la tiene** y de dónde salió el
dato. "Handshake tiene favoritos" sin enlace es una afirmación sin verificar — trátala como tal
hasta confirmarla.

## Paso 3 · Clasificar, no solo listar
Separa cada hallazgo en una de tres categorías, porque la respuesta a cada una es distinta:
- **Deuda de diseño** (ya decidido, no aplicado) → arreglar siempre, es barato y ya está aprobado.
- **Básico esperado** (la mayoría de la competencia lo tiene, un usuario lo asume) → candidato fuerte
  a un incremento nuevo.
- **Diferenciador avanzado** (mensajería, recomendaciones por IA, auto-postulación, ferias de
  empleo) → evaluar contra `docs/00-vision-y-alcance.md` y el alcance de un proyecto de una persona.
  Algunas de estas **no le sirven a Proxi aunque la competencia las tenga**: la auto-postulación de
  Laborum, por ejemplo, choca de frente con el principio de Proxi de que cada postulación tiene una
  respuesta real — cópiala tal cual, sin decir por qué no, sería aplicar coherencia ajena a un
  producto propio.

## Paso 4 · Vida visual sin ruido
Si el pedido es "más vida" o "más colores": preferir terminar el sistema ya documentado
(`docs/08-guia-visual.md`) sobre inventar paleta nueva. Fuera de eso, lo que rinde barato y sin
sorpresas:
- Transiciones suaves en hover/click (`transform`, `box-shadow`, `transition` — nunca animaciones
  largas o que compitan por atención). Siempre con `@media (prefers-reduced-motion: reduce)`.
- Insignias con color **y** texto juntos (nunca solo color — accesibilidad para daltonismo, ya es
  regla del proyecto).
- Nada que agregue una dependencia nueva sin preguntar (`CLAUDE.md`): si hace falta un ícono,
  preferir SVG inline propio antes que una librería de íconos.

## Cómo reportar
Igual que una auditoría de seguridad: cada hallazgo con su categoría (deuda/básico/avanzado), la
fuente si aplica, y una recomendación — no una lista de veinte ideas sin orden. Cierra preguntando
por cuál seguir, no implementes todo de una vez: cada funcionalidad nueva (no el pulido visual) sigue
el flujo normal de `nueva-funcionalidad` si toca datos o permisos.
