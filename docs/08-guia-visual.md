# 08 · Guía visual

Sistema visual mínimo sobre Bootstrap 5, requisito de `docs/06-roadmap.md` antes de programar
cualquier pantalla de la Fase 6. No es una paleta inventada: son los tokens reales del sitio actual
de la Universidad Alberto Hurtado (tema `UAH-Futura24`, el rebrand vigente en `uahurtado.cl`),
extraídos de su hoja de estilos pública el 2026-08-29. Replicarlos es intencional — Proxi es una
herramienta de la propia FEN UAH, y un frontend que se vea como el resto del sitio institucional
es más confiable para un estudiante que un tema de Bootstrap por defecto.

Fuentes: [`uahurtado.cl`](https://www.uahurtado.cl/), hoja de estilos del tema en
`wp-content/themes/UAH-Futura24/assets/css/style.css`.

## Paleta de color

Los nombres de variable son los que usa la propia UAH (`--primario`, `--marengo1`, etc.), con un
prefijo `--uah-` para que convivan sin chocar con las variables de Bootstrap 5.3.

| Token | Hex | Uso en Proxi |
|---|---|---|
| `--uah-naranja` | `#ef6427` | Color de marca. Acciones principales, enlaces activos, el estado **publicada / vigente** de una oferta |
| `--uah-verde` | `#75fb7e` | Acento positivo. Estado **seleccionada** de una postulación, confirmaciones |
| `--uah-marengo-1` | `#111111` | Texto principal |
| `--uah-marengo-2` | `#222222` | Texto secundario, encabezados sobre fondo claro |
| `--uah-gris-1` | `#666666` | Texto terciario, ayudas de formulario |
| `--uah-gris-2` | `#3c3c3c` | Fondos oscuros (footer, badges neutros con texto claro) |
| `--uah-gris-claro` | `#cccccc` | Bordes, separadores, estado **archivada / inactivo** |
| `--uah-blanco-1` | `#ffffff` | Fondo base |
| `--uah-blanco-2` | `#f3f2ec` | Fondo alterno (secciones, tarjetas sobre fondo blanco) |
| `--uah-blanco-3` | `#f0efe9` | Fondo alterno, variante más cálida |

**No hay rojo en la paleta de la UAH.** Su sitio no define un token de error propio, así que Proxi
usa el rojo por defecto de Bootstrap (`--bs-danger`, `#dc3545`) sin modificar, solo para lo que es
semánticamente un error o un rechazo — nunca como color de marca. Es una decisión, no un olvido: un
rojo institucional inventado sería menos reconocible que el rojo que cualquiera ya asocia con
"rechazado" en cualquier sistema.

### Cómo aplicarla sobre Bootstrap sin paso de compilación
Proxi no compila Sass (`HTML+CSS+Bootstrap+JS vanilla`, `CLAUDE.md`): Bootstrap 5.3+ expone sus
propios colores como variables CSS (`--bs-primary`, `--bs-primary-rgb`, `--bs-border-radius`...),
así que reskinear es un solo archivo que se carga **después** de `bootstrap.min.css`:

```css
/* assets/css/uah-theme.css */
:root {
  --uah-naranja: #ef6427;
  --uah-verde: #75fb7e;
  --uah-marengo-1: #111111;
  --uah-marengo-2: #222222;
  --uah-gris-1: #666666;
  --uah-gris-2: #3c3c3c;
  --uah-gris-claro: #cccccc;
  --uah-blanco-2: #f3f2ec;
  --uah-blanco-3: #f0efe9;

  --bs-primary: var(--uah-naranja);
  --bs-primary-rgb: 239, 100, 39;
  --bs-body-color: var(--uah-marengo-1);
  --bs-body-font-family: var(--uah-rubik);
  --bs-border-radius: 0.6rem;
  --bs-border-radius-lg: 1rem;
  --bs-border-radius-pill: 50rem;
}
```

## Tipografía
Misma pareja que usa la UAH, cargada tal cual desde Google Fonts (permitido por la lista blanca de
`docs/03-seguridad.md`, dominio `fonts.googleapis.com`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500&family=Rubik:wght@300;400;500;600&display=swap" rel="stylesheet">
```

- **Rubik** (sans-serif geométrica): toda la interfaz — texto, botones, formularios, navegación.
  Pesos disponibles: 300, 400, 500, 600.
- **Frank Ruhl Libre** (serif editorial): solo para titulares grandes (el `<h1>` de la vitrina, el
  nombre de una empresa en su perfil público). Nunca en texto de interfaz ni en botones — es un
  acento, no la tipografía de trabajo. Pesos disponibles: 300, 400, 500.

La UAH también usa una fuente propia con licencia (`Replica`, autohosteada como `.otf`). No se
replica: no tenemos la licencia, y Rubik en semi-negrita (600) cumple el mismo rol.

## Formas
Del CSS real del tema:
- **Botones y CTA: forma de píldora.** `border-radius: 2em` (o `15px` en variantes chicas), nunca
  esquinas cuadradas ni el radio pequeño por defecto de Bootstrap.
- **Insignias, avatares, indicadores: circulares.** `border-radius: 50%`.
- **Elementos de estructura (navbar, su botón de menú): esquinas rectas.** `border-radius: 0`. El
  contraste entre "las acciones son píldoras, la estructura es recta" es deliberado — se mantiene
  en Proxi.
- **Sombra estándar, suave:** `box-shadow: 0 0 10px rgba(0, 0, 0, 0.2)` para tarjetas y elementos
  elevados (modales, dropdowns). Nada de sombras duras ni con desplazamiento marcado.

## Los estados son el producto
Esta es la sección que de verdad importa (`docs/06-roadmap.md`, Fase 6): si dos estados no se
distinguen de un vistazo, el diferenciador de Proxi se pierde en la pantalla. Cada estado real de
la base tiene un color y una forma de insignia fijos — nunca un color inventado por pantalla.

### Oferta
| Estado | Color de fondo | Texto | Nota |
|---|---|---|---|
| `publicada`, vigente | `--uah-blanco-3` con borde `--uah-borde` | `--uah-gris-2` + ícono de calendario | **Neutro a propósito** (cambiado el 2026-09-20, ver abajo). Un plazo cómodo es información, no alarma |
| `publicada`, cierra en ≤3 días | `--uah-naranja`, `font-weight: 600` | `--uah-marengo-1` + ícono de reloj | Lo **único** que lleva naranja sólido en una tarjeta. Estado **derivado en el cliente**, no existe en la base: se calcula comparando `fechaCierre` con "ahora". El umbral (3 días) es `UMBRAL_URGENTE_DIAS` en `assets/js/componentes/estado-oferta.js`. **Nunca texto blanco sobre este naranja**: da 3.2:1; el marengo da 5.86:1 |
| `cerrada`, `motivoCierre: vencida` | `--uah-gris-claro` | `--uah-gris-2` | "Vencida" se dice tal cual en la interfaz, nunca el código `OFERTA_NO_VIGENTE` |
| `cerrada`, otro motivo | `--uah-gris-claro` | `--uah-gris-2` + ícono según motivo (contratado/cancelada/sin candidatos) | |
| `en_revision`, `borrador`, `archivada` | No se muestran en la vitrina pública | — | Solo visibles en el panel de la propia empresa o de coordinación; ahí alcanza con texto, sin insignia de color |

#### Por qué `vigente` dejó de ser naranja (2026-09-20)
Hasta esa fecha `normal` y `urgente` compartían el mismo `--uah-naranja` y se distinguían solo por un
borde de 2px. En una vitrina de diez ofertas eso significaba diez insignias naranjas idénticas: el
estado estaba en la base y en el CSS, pero no llegaba a la persona. A un metro de la pantalla no se
veía ninguna diferencia, que es exactamente lo que esta sección existe para evitar.

La regla que lo reemplaza, tomada de la skill `identidad-visual`: **la urgencia es lo único que llama
la atención en una tarjeta.** De ahí salen tres consecuencias, y las tres están en el código:

1. `vigente` va neutro (`--uah-blanco-3` con borde). Informa sin gritar.
2. `cierra pronto` se queda con el naranja de marca, sólido y en negrita.
3. El botón "Ver y postular" de la vitrina pasó a `btn-outline-primary`. Relleno naranja competía
   con la insignia de urgencia hasta que ninguno de los dos destacaba.

Cada insignia lleva además **su propio ícono** (calendario / reloj / archivado), no solo color: uno de
cada doce hombres no distingue rojo de verde, y el estado es justamente lo que no se puede perder. Los
íconos son SVG inline de 24×24 en `assets/js/componentes/iconos.js`, con `currentColor` y `1em`, así
que heredan color y tamaño del texto — no hay paleta ni escala de íconos que mantener aparte, y no se
agregó ninguna dependencia.

### Formato de datos — un solo lugar
Todo dato crudo de la API se convierte a texto legible en `apps/web/assets/js/formato.js`. Antes cada
página improvisaba el suyo y habían divergido: el monto salía `$300000` en el panel de empresa y
`$300.000` en el detalle de una oferta; la modalidad salía `hibrida`, sin tilde, en la vitrina; y la
fecha salía `25-09-2026` en unas pantallas y "25 de septiembre" en otras.

| Función | Devuelve | Dónde se usa |
|---|---|---|
| `formatoMonto` | `$300.000` (sin decimales: en pesos nadie escribe `,00`) | detalle, tarjeta, paneles |
| `formatoFechaCorta` | `25 sept 2026` | listados — mes abreviado para que la fecha no le gane peso al título |
| `formatoFechaLarga` | `25 de septiembre de 2026` | detalle, donde ya se está leyendo y no escaneando |
| `formatoFechaHora` | `25 sept 2026, 14:30` | líneas de tiempo, donde el orden dentro de un día importa |
| `etiquetaModalidad`, `etiquetaJornada` | `Híbrida`, `Jornada parcial` | todas |
| `etiquetaRemuneracion` | `$300.000 al mes` / `No remunerada` | todas |
| `etiquetaArea` | `Control gestion` desde `control-gestion` | tarjeta |

Un valor desconocido se devuelve tal cual, nunca `—`: si el backend agrega una modalidad nueva, que se
vea fea es mejor que desaparezca de la pantalla sin que nadie lo note.

`etiquetaArea` es un parche de presentación, no la solución: `area` es `z.string()` en la API, así que
llega como la escribió cada empresa (`control-gestion`, `Auditoria`, `marketing`). El arreglo de fondo
es una lista controlada de áreas en el backend — anotado en el roadmap, no acá.

### La vitrina es una lista, no una cuadrícula
La vitrina pasó de tres tarjetas por fila a una fila por oferta el 2026-09-20. Una vitrina de empleo
es para escanear (`identidad-visual`, "Densidad correcta"): en una columna el ojo baja por una sola
lista de títulos, y el plazo de cierre queda siempre en el mismo lugar. En una cuadrícula hay que
recorrer en zigzag y la insignia de estado cae en una posición distinta en cada tarjeta.

La fila lleva una ranura de logo de empresa que todavía no tiene logo: hasta que exista la subida de
logos muestra la inicial de la razón social, que al menos distingue una empresa de otra al escanear.

### Postulación
| Estado | Color | Texto |
|---|---|---|
| `recibida`, `en_revision`, `entrevista` | `--uah-blanco-3` (fondo neutro cálido) | `--uah-marengo-1` |
| `seleccionada` | `--uah-verde` | `--uah-marengo-1` (nunca blanco: ver Accesibilidad) |
| `no_seleccionada` | `--bs-danger` (rojo de Bootstrap, sin modificar) | `#ffffff` |
| `sin_respuesta` | `--uah-gris-claro` | `--uah-gris-2` + texto explícito "la empresa no respondió a tiempo" — el silencio es un estado, no debe leerse como neutro |
| `retirada` | `--uah-gris-claro`, tachado o atenuado | `--uah-gris-1` |

### Empresa (perfil, visible solo para coordinación)
`pendiente` → `--uah-blanco-3` · `validada` → `--uah-verde` · `rechazada` → `--bs-danger` ·
`suspendida` → `--uah-gris-2` con texto blanco (una suspensión es más grave que un rechazo simple,
se marca más oscura, no del mismo rojo que "rechazada").

## Accesibilidad — verificado, no asumido
Contrastes calculados (WCAG 2.1, fórmula de luminancia relativa) sobre los pares que de verdad se
usan:

| Combinación | Ratio | ¿Sirve para texto normal (≥4.5:1)? | ¿Sirve para texto grande / UI (≥3:1)? |
|---|---|---|---|
| `--uah-marengo-1` sobre `--uah-blanco-2` | >15:1 | Sí | Sí |
| Blanco sobre `--uah-naranja` | 3.2:1 | **No** | Sí, justo |
| `--uah-marengo-1` sobre `--uah-naranja` | ~6.5:1 | Sí | Sí |
| `--uah-marengo-1` sobre `--uah-verde` | ~14:1 | Sí | Sí |
| Blanco sobre `--uah-verde` | ~1.3:1 | **No** | **No** |

**Regla derivada:** sobre `--uah-naranja` y `--uah-verde`, el texto siempre es `--uah-marengo-1`
(nunca blanco). El naranja con texto blanco se reserva para botones grandes o iconografía, nunca
para una insignia de estado con texto de tamaño normal.

Resto de la lista de la Fase 6 (`docs/06-roadmap.md`): toda insignia de estado lleva también texto,
nunca solo color (para daltonismo); todo formulario con `<label>` asociado por `for`/`id`; foco
visible con el `:focus-visible` por defecto de Bootstrap, sin quitarlo con `outline: none`;
navegación completa sin mouse verificada a mano antes de cerrar la fase.

## Qué no se copia
- La fuente `Replica` (con licencia, no la tenemos).
- El logo/escudo oficial de la universidad: Proxi es una herramienta de la FEN, no el sitio
  institucional — usa su propio nombre y un ícono simple, no el escudo de la UAH.
- Cualquier imagen fotográfica del sitio de la UAH: son de ellos, Proxi no las reutiliza.
