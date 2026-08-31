---
name: paleta-color
description: "Genera paletas de color de marca con códigos hex, clasificaciones de accesibilidad, directrices de aplicación y especificaciones de impresión/digital. Úsalo cuando establezques o refresques colores de marca."
allowed-tools: Read Write Glob
metadata:
  author: Imperio Digital
  version: "1.0"
---

# Generador de Paleta de Color

## Cuándo Usar Este Skill

Usa este skill cuando necesites:
- Crear una paleta de color de marca desde cero
- Expandir una paleta existente con colores complementarios
- Asegurar cumplimiento de accesibilidad de color (estándares WCAG)
- Documentar directrices de uso de color para aplicación consistente

**NO** uses este skill para guías de identidad de marca completas, diseño de logo o diseño de componente de UI. Esto es específicamente para creación de paleta de color y documentación.

---

## Principio Fundamental

UNA PALETA DE COLOR DEBE FUNCIONAR EN CADA CONTEXTO — PANTALLA, IMPRESIÓN, FONDOS GRANDES, TEXTO PEQUEÑO — Y PASAR ESTÁNDARES DE ACCESIBILIDAD PARA TODOS LOS USUARIOS.

---

## Fase 1: Brief

### Entradas Requeridas

| Entrada | Qué Preguntar | Predeterminado |
|---------|------------|---------|
| **Personalidad de marca** | "Describe tu marca en 3 adjetivos." | Debe ser proporcionado |
| **Industria** | "¿En qué industria estás?" | Debe ser proporcionado |
| **Colores existentes** | "¿Tienes algunos colores ya? (códigos hex, materiales de marca)" | Comenzando fresco |
| **Preferencias** | "¿Algunos colores que ames u odies?" | Ninguno |
| **Uso primario** | "¿Dónde se usarán los colores principalmente? (sitio web, impresión, social, empaque)" | Sitio web y social |
| **Competidores** | "¿Qué colores usan tus competidores? (para diferenciarte)" | Investigaré |

**PUNTO DE CONTROL: Confirma brief antes de generar paletas.**

---

## Fase 2: Generar

### Estructura de Paleta

Cada paleta de marca necesita estos roles:

| Rol | Propósito | Conteo |
|------|---------|-------|
| **Primario** | Color de marca principal, CTAs, elementos clave | 1 |
| **Secundario** | Color de apoyo, fondos de sección, acentos | 1-2 |
| **Neutral oscuro** | Texto, fondos oscuros, encabezados | 1 |
| **Neutral claro** | Fondos claros, tarjetas, espaciado | 1 |
| **Acento** | Destacados, alertas, elementos especiales | 1 |
| **Éxito/Error** | Colores funcionales para feedback de UI | 2 (verde/rojo) |

### Método de Generación

1. Comienza con el color primario basado en personalidad de marca e industria
2. Usa teoría de color para construir relaciones armoniosas (complementario, análogo, triádico)
3. Genera 2-3 opciones de paleta completa
4. Prueba cada una por accesibilidad antes de presentar

**PUNTO DE CONTROL: Presenta 2-3 opciones de paleta y espera selección.**

---

## Fase 3: Documentar

### Entregables

**1. Especificación de Color Completa**

Para cada color en la paleta:
- Nombre de color (específico de marca, ej.: "Azul Océano" no solo "Azul")
- Código hex (#1A73E8)
- Valores RGB (26, 115, 232)
- Valores HSL
- Valores CMYK (para impresión)
- Coincidencia Pantone (más cercana)

**2. Reporte de Accesibilidad**
- Relación de contraste para cada pareja de color usada para texto
- Cumplimiento WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- Cumplimiento WCAG AAA donde sea alcanzable
- Colores de texto recomendados en cada color de fondo

**3. Directrices de Uso**
- Qué color para qué caso de uso (fondos, botones, texto, links, estados de hover)
- Porcentaje máximo de cada color en un layout típico (ej.: primario: 10%, neutrales: 70%)
- Combinaciones de color a usar y combinaciones a evitar
- Variaciones de modo oscuro si aplica

**4. Ejemplos de Aplicación**
- Sección de sitio web de muestra usando la paleta
- Ejemplo de post de redes sociales
- Ejemplo de layout de impresión o tarjeta de presentación
- Ejemplo de plantilla de email de uso de color

---

## Fase 4: Pulir

### Paquete de Activo Digital

- Descripciones de archivo de muestra para herramientas de diseño (Figma, Canva, Adobe)
- Propiedades personalizadas CSS para implementación web
- Valores de configuración de Tailwind (si aplica)

### Notas de Preparación de Impresión

- Valores CMYK verificados para reproducción de impresión precisa
- Consideraciones de stock de papel que afectan apariencia de color
- Recomienda prueba de impresión antes de corridas grandes

---

## Anti-Patrones

- **Demasiados colores** — más de 6-8 colores crea caos visual. Constrain la paleta.
- **Ignorar accesibilidad** — colores hermosos que fallan requisitos de contraste excluyen usuarios y riesgo legal.
- **Hacer coincidir colores de competidor** — si cada competidor es azul, diferénciate. Destacarse importa más que encajar.
- **Pensar solo en pantalla** — los colores que se ven grandiosos en pantalla pueden imprimir mal. Siempre proporciona valores CMYK.
- **Sin colores neutrales** — una paleta de todos colores vibrantes no tiene dónde descansar el ojo. Incluye neutrales oscuros y claros.

---

## Recuperación

- **El usuario no puede describir personalidad de marca:** Muéstrale 5 paletas de color y pregunta cuál se siente más cerca. Ingeniería inversa la personalidad desde su preferencia.
- **Color existente falla accesibilidad:** Sugiere ajustes leves (oscurecer o aclarar 10-15%) que mantengan la sensación pasando WCAG.
- **Demasiado apegado a color específico:** Construye el resto de la paleta alrededor de él. Un color no negociable puede anclar una gran paleta.
- **La paleta se ve diferente en diferentes pantallas:** Proporciona códigos hex y nota que la calibración de pantalla varía. Las pruebas de impresión son el único estándar confiable.
