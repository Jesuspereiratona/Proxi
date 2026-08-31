---
name: identidad-visual
description: Reglas de identidad visual de Proxi y cómo evitar que la interfaz se vea generada por IA. Úsala antes de escribir CSS, al elegir colores o tipografía, al diseñar una pantalla o un componente nuevo, y cuando el usuario diga que algo se ve genérico, plano, sin vida o "hecho por IA".
---

# Identidad visual de Proxi

La base es `apps/web/assets/css/uah-theme.css`: **Frank Ruhl Libre** para titulares, **Rubik** para
texto, sobre Bootstrap 5. Eso no se cambia — Proxi es una herramienta de la Universidad Alberto
Hurtado y esa tipografía es su identidad. Lo que se pule es todo lo demás.

## Regla cero: todo color vive en el tema
Ningún color se escribe a mano en una página. Se declara como variable CSS en `uah-theme.css` y se usa
desde ahí. Si el mismo color aparece dos veces con valores distintos, es un error, no una variante.

## Lo que NO puede pasar: que se note hecho por IA

Las interfaces generadas por IA se parecen entre sí, y quien revisa este proyecto —un profesor, una
empresa, un reclutador— las reconoce al instante. Estos son los tics concretos. **Ninguno debe
aparecer en Proxi.**

**Color**
- El degradado morado-a-azul en la cabecera. Nunca.
- Fondo crema cálido con acento terracota y titulares serif.
- Casi negro con un solo acento verde ácido o bermellón.
- Degradados donde un color plano hace el trabajo.

**Tipografía**
- Inter o Space Grotesk como opción "segura". Aquí ya hay tipografía elegida: se usa esa.
- Titulares enormes con texto diminuto debajo, sin escala intermedia.
- Todo centrado. El texto largo centrado no se lee.

**Composición**
- Emoji como icono de sección. Nunca en producto: se usan iconos reales.
- `border-radius` grande y uniforme en absolutamente todo.
- Tarjetas con una barra de acento vertical a la izquierda, todas iguales.
- Numeración decorativa (01 / 02 / 03) donde no hay una secuencia real.
- Sombras difusas en cada elemento para simular profundidad.
- Tres tarjetas por fila porque sí, sin que el contenido lo pida.

**Movimiento**
- Animaciones de entrada en cada elemento al hacer scroll.
- Efectos de hover que mueven, escalan y cambian color a la vez.

## Lo que sí hace que se vea hecho por alguien

1. **Que el color signifique algo.** En Proxi el color no decora: informa. Una oferta que cierra en
   dos días y una vencida tienen que distinguirse **de un vistazo, sin leer**. Ese es el producto.
2. **Densidad correcta.** Una vitrina de ofertas es para escanear, no para contemplar. Menos aire y
   más información por pantalla que en una landing.
3. **Estados completos.** Vacío, cargando, error y sin resultados diseñados igual que el estado feliz.
   Una lista vacía que dice "No hay ofertas vigentes en Contabilidad. Prueba quitando el filtro" está
   mejor diseñada que cualquier animación.
4. **Detalle donde se mira.** Números alineados con `tabular-nums`, fechas en formato consistente,
   foco de teclado visible y bonito.
5. **Restricción.** Una decisión audaz, el resto tranquilo. Si todo grita, nada se lee.

## Semántica de estado — lo intocable
El color de estado no es el color de marca y no se mezcla con él. Cada estado necesita **forma además
de color**: texto e icono, no solo un punto de color. Uno de cada doce hombres no distingue rojo de
verde, y el estado es justamente lo que no se puede perder.

| Estado | Qué comunica |
|---|---|
| Publicada, con plazo cómodo | Normal, sin alarma |
| Cierra pronto | Urgencia — es lo único que debe llamar la atención en la tarjeta |
| Cerrada o vencida | Apagado, claramente inactivo, pero legible |
| Sin respuesta | Neutro y honesto: describe a la empresa, no juzga al estudiante |

Cambiar esta semántica exige una razón escrita en `docs/08-guia-visual.md`. Si `publicada`,
`cierra pronto` y `cerrada` dejan de distinguirse a un metro de la pantalla, todo el trabajo del ciclo
de vida se queda en la base de datos y nunca llega a la persona.

## Antes de dar por terminada una pantalla
- [ ] Ningún color escrito a mano fuera del tema
- [ ] Los estados se distinguen sin leer, y no solo por color
- [ ] Estados vacío, cargando y error diseñados
- [ ] Contraste suficiente, foco de teclado visible, navegable sin ratón
- [ ] Se ve bien en un teléfono
- [ ] Ningún tic de la lista de arriba
- [ ] Lo decidido quedó en `docs/08-guia-visual.md`, no solo en el CSS
