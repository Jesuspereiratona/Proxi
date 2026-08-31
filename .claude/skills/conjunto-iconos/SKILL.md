---
name: conjunto-iconos
description: "Hace brief a diseño de conjunto de icono con dirección de estilo, requisitos de tamaño, casos de uso, directrices de consistencia y especificaciones de entrega. Úsalo cuando comisiones iconos personalizados para tu marca."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Brief de Conjunto de Icono

## Cuándo Usar Este Skill

Usa este skill cuando necesites:
- Hacer un brief a un diseñador sobre diseño de conjunto de icono personalizado
- Definir estilo de icono, tamaños y requisitos de uso
- Crear especificaciones para entrega y implementación de icono
- Establecer reglas de consistencia para iconos en tu marca

**NO** uses este skill para seleccionar librerías de icono de stock, diseñar iconos por ti mismo o crear briefs de ilustración. Esto es para hacer brief a diseño de conjunto de icono personalizado.

---

## Principio Fundamental

LOS ICONOS DEBEN SER INSTANTÁNEAMENTE RECONOCIBLES EN SU TAMAÑO MÁS PEQUEÑO — SI EL ICONO NECESITA UNA ETIQUETA PARA SER ENTENDIDO, EL ICONO HA FALLADO.

---

## Fase 1: Brief

### Entradas Requeridas

| Entrada | Qué Preguntar | Predeterminado |
|---------|------------|---------|
| **Conteo de icono** | "¿Cuántos iconos necesitas?" | 15-25 |
| **Casos de uso** | "¿Dónde se usarán los iconos? (sitio web, app, presentaciones, impresión)" | Sitio web |
| **Lista de icono** | "Lista cada icono necesario con su concepto (ej.: rueda de settings, perfil de usuario, carrito de compras)." | Debe ser proporcionado |
| **Preferencia de estilo** | "¿Línea, relleno, duotono o 3D? Comparte 2-3 conjuntos de icono que admires." | Estilo de línea |
| **Directrices de marca** | "Colores de marca, estilo visual, personalidad." | Debe ser proporcionado |
| **Tamaños necesarios** | "¿Qué tamaños? (16px, 24px, 32px, 48px)" | 24px primario, variantes de 16px y 32px |

**PUNTO DE CONTROL: Confirma brief antes de proceder.**

---

## Fase 2: Diseñar

### Especificación de Estilo

Define las reglas visuales para todo el conjunto:

- **Estilo:** Línea, relleno, duotono o combinación
- **Peso de trazo:** Consistente en todos los iconos (ej.: 1.5px en tamaño 24px)
- **Radio de esquina:** Agudo, redondeado o mixto con radio específico
- **Cuadrícula:** Tamaño de cuadrícula base (24x24 con padding 2px = área segura 20x20)
- **Color:** Monocromático, dos colores o paleta de marca completa
- **Perspectiva:** Plano o isométrico

### Reglas de Consistencia

- Todos los iconos deben compartir el mismo peso de trazo, radio de esquina y densidad visual
- Las líneas clave (horizontal, vertical, circular) deben alinearse en todo el conjunto
- Dimensionamiento óptico: iconos más simples pueden necesitar peso visual ligeramente más grande para sentirse equilibrados

**PUNTO DE CONTROL: Presenta la especificación de estilo con referencias de ejemplo antes de la lista de icono.**

---

## Fase 3: Construir

### Entregables

**1. Documento Brief Completo de Icono**
- Especificación de estilo con todas las reglas visuales
- Lista completa de icono con descripción de concepto por icono
- Requisitos de tamaño y formato
- Contexto de uso para cada icono

**2. Hoja de Especificación Técnica**
| Spec | Valor |
|------|-------|
| Tamaño de cuadrícula | 24x24px |
| Área segura | 20x20px (padding 2px) |
| Peso de trazo | 1.5px |
| Radio de esquina | 2px |
| Tamaños de exportación | 16, 24, 32, 48px |
| Formatos de archivo | SVG (primario), PNG (fallback) |
| Modos de color | Color único (hereda color CSS) |

**3. Convención de Nombres**
- Formato de nombres de archivo: `icon-[concepto]-[tamaño].[formato]`
- Ejemplo: `icon-settings-24.svg`, `icon-user-16.png`
- Organizados en carpetas por tamaño o concepto

**4. Lista de Verificación de Calidad**
- [ ] Todos los iconos visualmente consistentes en peso y estilo
- [ ] Legible en tamaño más pequeño (16px)
- [ ] SVGs están limpios (sin grupos innecesarios, viewBox apropiado)
- [ ] Alineados a píxel en tamaño primario
- [ ] Accesible: contraste suficiente, no solo indicador de significado

---

## Fase 4: Pulir

### Guía de Implementación

- Cómo integrar SVGs en el sitio web o app
- Configuración de herencia de color CSS para iconos monocromáticos
- Notas de accesibilidad: empareja iconos con etiquetas para lectores de pantalla

### Expansión Futura

- Cómo solicitar iconos adicionales mientras mantienes la consistencia
- Notas de entrega del diseñador para la cuadrícula de icono y reglas de estilo
- Archivo de plantilla para diseñar nuevos iconos en el estilo establecido

---

## Anti-Patrones

- **Peso de trazo inconsistente** — un icono con trazos de 1px al lado de uno con trazos de 3px se ven como dos conjuntos de icono diferentes.
- **Demasiados detalles en tamaños pequeños** — iconos intrincados que se ven grandiosos en 48px se convierten en manchas en 16px. Diseña para el tamaño más pequeño primero.
- **Sin sistema de cuadrícula** — iconos diseñados a mano sin una cuadrícula nunca se alinearán consistentemente.
- **Mezclar estilos** — iconos de línea e iconos rellenos en el mismo conjunto crean disonancia visual a menos que se diseñen intencionalmente como un sistema.
- **Entrega solo raster** — PNGs no pueden escalar. Siempre requiere SVG como formato primario.

---

## Recuperación

- **El diseñador entrega iconos inconsistentes:** Proporciona la especificación de estilo y solicita una pasada de revisión enfocada en alineación de peso de trazo y densidad visual.
- **Los iconos no son claros en tamaño pequeño:** Solicita versiones simplificadas para uso de 16px. Muchos conjuntos de icono tienen variantes detalladas y compactas.
- **Presupuesto demasiado bajo para iconos personalizados:** Recomienda una librería de icono de código abierto de calidad (Lucide, Phosphor, Tabler) y personaliza colores para coincidir con marca.
- **La lista de icono sigue creciendo:** Establece un alcance V1 y comprométete a él. Los iconos adicionales vienen en un lote V2 después de que V1 está aprobado e implementado.
