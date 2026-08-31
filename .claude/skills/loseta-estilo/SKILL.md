---
name: loseta-estilo
description: "Crea losetas de estilo para proyectos de diseño web con tipografía, colores, elementos de UI, texturas y referencias de mood. Úsalo cuando alinea la dirección visual antes del diseño completo."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Loseta de Estilo

## Cuándo Usar Este Skill

Usa este skill cuando necesites:
- Establecer dirección visual para un proyecto de diseño web antes de mockups completos
- Alinear stakeholders sobre estética de diseño sin construir páginas completas
- Cerrar la brecha entre directrices de marca e implementación web real
- Dar dirección clara a un diseñador o desarrollador para estilo de UI

**NO** uses este skill para wireframing, mockups de página completa o creación de identidad de marca. Las losetas de estilo se sientan entre directrices de marca y diseño de página — definen la sensación visual sin comprometerse a layout.

---

## Principio Fundamental

UNA LOSETA DE ESTILO MUESTRA CÓMO SE SIENTE LA MARCA EN PANTALLA — RESPONDE "¿CÓMO SE VERÁ ESTO?" SIN DISEÑAR CADA PÁGINA.

---

## Fase 1: Brief

### Entradas Requeridas

| Entrada | Qué Preguntar | Predeterminado |
|---------|------------|---------|
| **Proyecto** | "¿Para qué proyecto web es esto? (sitio nuevo, rediseño, página de destino)" | Sitio web nuevo |
| **Adjetivos de marca** | "Describe la sensación deseada en 3-5 adjetivos." | Debe ser proporcionado |
| **Audiencia objetivo** | "¿Quién usará este sitio?" | Debe ser proporcionado |
| **Sitios de referencia** | "Comparte 3-5 sitios web que admiras visualmente y por qué." | Debe ser proporcionado |
| **Anti-referencias** | "Comparte 1-2 sitios que se sientan equivocados para tu marca." | Ninguno |
| **Activos de marca existentes** | "Logo, colores, fuentes — ¿qué tienes?" | Logo y colores básicos |

**PUNTO DE CONTROL: Confirma brief antes de crear especificaciones de loseta de estilo.**

---

## Fase 2: Diseñar

### Componentes de Loseta de Estilo

Una loseta de estilo completa incluye especificaciones para:

1. **Paleta de color** — primario, secundario, acento, neutrales con códigos hex
2. **Tipografía** — fuente de encabezado, fuente de cuerpo, escala de tamaño, variaciones de peso
3. **Estilos de botón** — CTA principal, secundario, ghost/outline, estados de hover
4. **Elementos de forma** — campos de entrada, dropdowns, checkboxes, estados de error
5. **Estilos de tarjeta/contenedor** — radio de borde, profundidad de sombra, tratamiento de fondo
6. **Tratamiento de imagen** — estilo de foto, tratamiento de superposición, formas de borde o máscara
7. **Estilo de iconografía** — peso de línea, referencia de estilo, tamaño
8. **Textura/patrón** — patrones de fondo, texturas sutiles, gradientes
9. **Adjetivos de mood** — 3-5 palabras que capturan la sensación objetivo

### Escala de Tipografía

Define una escala de tipo con valores exactos:
- Display: 48-64px
- H1: 36-48px
- H2: 28-36px
- H3: 22-28px
- Body: 16-18px
- Small/Caption: 12-14px
- Line height: 1.4-1.6 para body, 1.1-1.2 para encabezados

**PUNTO DE CONTROL: Presenta la especificación de loseta de estilo y espera feedback. Itera hasta que la dirección esté aprobada.**

---

## Fase 3: Construir

### Entregables

**1. Documento de Loseta de Estilo**
- Especificación completa para cada elemento visual listado arriba
- Organizado en formato de referencia de página única
- Incluye códigos hex, nombres de fuente, valores de píxel, valores de radio de borde

**2. Tokens de Diseño CSS**
- Lista de variables lista para implementación:
  - `--color-primary: #XXXX`
  - `--font-heading: 'Inter', sans-serif`
  - `--radius-default: 8px`
  - `--shadow-card: 0 2px 8px rgba(0,0,0,0.1)`

**3. Especificaciones de Estilo de Componente**
- Botón: padding, tamaño de fuente, radio de borde, color de fondo, estado de hover
- Tarjeta: padding, borde, sombra, radio de borde
- Input: altura, borde, estado de enfoque, estado de error
- Link: color, tratamiento de subrayado, estado de hover

**4. Referencia de Mood Board**
- 5-8 imágenes de referencia capturando la estética objetivo
- Notas sobre qué tomar de cada referencia (tipografía de esta, espaciado de aquella)

---

## Fase 4: Pulir

### Entrega de Diseño

Empaqueta la loseta de estilo para la persona implementándola:
- Para diseñadores: Especificaciones listas para Figma con descripciones de componente
- Para desarrolladores: Variables CSS y sugerencias de clase de utilidad
- Para constructores de página: códigos de color y nombres de fuente formateados para Webflow, WordPress o Squarespace

### Protocolo de Iteración

Las losetas de estilo están destinadas a ser iteradas. Presenta hasta 3 direcciones si la primera no llega. Cada iteración se ajusta basada en feedback específico ("colores más cálidos," "más espacio en blanco," "tipografía más audaz").

---

## Anti-Patrones

- **Loseta de estilo como diseño final** — muestra dirección, no layout. No esperes que reemplace mockups.
- **Demasiadas opciones a la vez** — presentar 5 direcciones de estilo crea parálisis de decisión. Máximo 2-3 opciones.
- **Sin estados interactivos** — botones sin estados de hover e inputs sin estados de enfoque dejan brechas para implementación.
- **Especificaciones vagas** — "fuente moderna" no es accionable. Incluye el nombre exacto de fuente, peso y tamaño.
- **Saltarse anti-referencias** — saber qué es lo que el cliente NO quiere es tan valioso como saber qué quiere.

---

## Recuperación

- **El cliente no puede articular la sensación deseada:** Usa una prueba de preferencia — muestra 5 capturas de pantalla diversas de sitios web y pregunta por reacciones viscerales (amor/odio/neutral).
- **Loseta de estilo rechazada:** Pregunta qué elementos específicos se sienten equivocados. Frecuentemente es una cosa (color demasiado frío, fuente demasiado formal) no toda la dirección.
- **No puedo estar de acuerdo sobre la dirección:** Crea dos losetas de estilo contrastantes (p.ej., audaz vs mínimo) y deja que el contraste aclare la preferencia.
- **Loseta de estilo se ve bien pero no se traduce a páginas:** Cierra la brecha con una sección de muestra única (área de héroe) usando elementos de loseta de estilo antes de comprometerse a diseño de página completa.
