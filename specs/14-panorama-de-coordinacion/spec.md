# Panorama de coordinación

## El problema

Coordinación hoy valida empresas y aprueba ofertas, una por una. Lo que no puede hacer es **mirar el
conjunto**: cuántas ofertas hay por área, si los estudiantes están postulando, qué ofertas llevan
semanas publicadas sin que nadie postule, dónde se atascan las postulaciones.

Proxi ya tiene todos esos datos. Solo que nadie los suma.

La diferencia no es cosmética: sin esto, Proxi es un tablón de anuncios con moderación. Con esto, la
FEN puede decir "en Auditoría hay 40 postulantes para 3 cupos y en Marketing hay 2 ofertas sin
ningún postulante", que es información con la que se toman decisiones.

## Por qué no hace falta medir a nadie

Todo sale de lo que **ya ocurrió**: ofertas, estados, fechas, postulaciones. No se agrega ningún
rastreo, ningún clic, ninguna vista de página. Eso no es una limitación, es la decisión: medir el
comportamiento de los estudiantes es dato personal nuevo, exige consentimiento y contradice la
minimización que el proyecto defiende en todo lo demás. Y con el tamaño de la FEN, diría menos que
hablar con cinco alumnos.

## Reglas

1. Solo coordinación. Es una vista de gestión de la facultad, no información pública.
2. **Ningún dato identifica a un estudiante.** Se cuentan postulaciones, no se nombran postulantes.
   Nombres de empresa y títulos de oferta sí aparecen: ya son públicos en la vitrina.
3. Se calcula en el momento de pedirlo, no se precalcula. La vista de indicadores por empresa se
   materializa porque la consulta el público en cada visita; esta la mira coordinación unas veces al
   día y no justifica una tabla más que mantener sincronizada.
4. "Oferta sin postulantes" es una oferta **publicada**, con al menos N días publicada, y cero
   postulaciones. El plazo es configurable y por defecto 15 días.
5. El embudo cuenta postulaciones por estado actual, no eventos: interesa dónde **están**, no por
   cuántos pasos pasaron.

## Criterios de aceptación

1. Un estudiante recibe 403; una empresa recibe 403; sin sesión, 401.
2. La respuesta no contiene ningún correo, RUT, nombre ni apellido de estudiante.
3. Con 6 ofertas publicadas en 4 áreas, `porArea` trae 4 filas con el conteo correcto.
4. Una oferta publicada hace 20 días sin postulaciones aparece en `ofertasSinPostulantes`.
5. Una oferta publicada hace 20 días **con** una postulación no aparece.
6. Una oferta publicada hace 2 días sin postulaciones no aparece (no le dio tiempo).
7. Una oferta en borrador o cerrada nunca aparece en `ofertasSinPostulantes`.
8. El embudo suma exactamente el total de postulaciones existentes.
9. Con la base vacía, responde 200 con ceros y listas vacías, no un error.

## Fuera de alcance

- Gráficos. Números y tablas. Un gráfico que nadie sabe leer es peor que una cifra clara.
- Exportar a Excel. Cuando alguien lo pida de verdad.
- Series de tiempo ("cómo evolucionó el mes pasado"). Hoy no hay historia suficiente para que
  signifique algo; con datos de demostración sería ruido dibujado.
