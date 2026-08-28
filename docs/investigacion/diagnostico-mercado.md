# Diagnóstico: por qué existe Proxi

Investigación de agosto de 2026. Sirve para justificar cada decisión de producto y para la defensa del
portafolio. Cuando alguien pregunte "¿por qué la fecha de cierre es obligatoria?", la respuesta está
aquí, con fuente.

## Hallazgo 1 · Un tercio de los avisos publicados no lleva a ninguna contratación
Con datos de la Oficina de Estadísticas Laborales de EE.UU. (junio 2025), las empresas reportaron
7,4 millones de vacantes publicadas y solo 5,2 millones de contrataciones: **cerca del 30% de los
avisos nunca terminó en una contratación**. En LinkedIn se estima que 1 de cada 4 avisos es un
"ghost job", un aviso fantasma.

Además, **el 54% de los empleadores no piensa llenar el cargo dentro de los dos meses** siguientes a
publicarlo. Los avisos de octubre de 2019 se llenaban en un 91% en seis meses; los de octubre de 2024
no llegaron ni al 50% en el mismo plazo.

**Por qué las empresas lo hacen:** construir una lista de candidatos para el futuro, medir al mercado,
proyectar crecimiento, y —según el 62% de los gerentes encuestados— hacer sentir a sus empleados que
son reemplazables.

**Qué significa para un estudiante de la FEN:** tardes completas armando postulaciones para procesos
que no existen, sin manera de distinguir un aviso vivo de uno abandonado.

→ **Decisión de producto:** `fecha_cierre` obligatoria, vencimiento automático, y cierre que exige
declarar el resultado. Una empresa que no declara sus cierres no puede publicar de nuevo.

## Hallazgo 2 · El silencio como norma
Los reportes de ghosting a postulantes —quedarse sin ninguna respuesta, incluso después de una
entrevista— **crecieron 120% entre 2018 y 2023**. El efecto documentado es el desgaste: se postula
decenas de veces sin retroalimentación alguna.

En una facultad esto es peor que en el mercado abierto: el estudiante no tiene experiencia previa para
calibrar, y suele leer el silencio como un juicio sobre sí mismo.

→ **Decisión de producto:** toda postulación termina en un estado terminal. Si la empresa no se mueve
dentro del SLA, el sistema marca `sin_respuesta` y lo cuenta en el indicador de la empresa. El silencio
deja de ser gratis.

## Hallazgo 3 · La coordinación trabaja a ciegas
Los portales genéricos entregan el aviso, no el proceso. La unidad académica no sabe cuántos
estudiantes postularon, a qué empresas ni cómo terminó cada proceso; todo eso vive en correos y
planillas dispersas.

→ **Decisión de producto:** el rol de coordinación valida empresas antes de que publiquen y ve el
panorama completo. El registro no habilita: habilita la validación humana. De paso, ese filtro corta
las ofertas fraudulentas, un problema real en portales dirigidos a jóvenes.

## Hallazgo 4 · El marco legal cambia en tres meses
La **Ley 21.719** de protección de datos personales entra en vigencia el **1 de diciembre de 2026**
(publicada el 13 de diciembre de 2024, con 24 meses de transición). Crea la Agencia de Protección de
Datos Personales, con facultades para fiscalizar y sancionar.

Obligaciones que nos aplican directamente: base legal para tratar los datos, finalidad declarada y
minimización, derechos de acceso, rectificación, cancelación, oposición y portabilidad, medidas de
seguridad proporcionales al riesgo, y **notificación de brechas dentro de 72 horas**. Las sanciones
llegan a 20.000 UTM en infracciones gravísimas, y hasta 4% de los ingresos anuales en caso de
reincidencia.

Guardamos RUT, correos y currículums de estudiantes: son datos personales sin discusión.

→ **Decisión de producto:** consentimiento versionado, retención con borrado automático, exportación y
eliminación de cuenta, registro de accesos a datos personales y procedimiento de brecha escrito. No es
un extra: es requisito de la fase 7 y no se recorta.

## Qué nos diferencia, en una frase
Los portales existentes optimizan la **publicación**. Proxi optimiza el **cierre**: que cada oferta y
cada postulación llegue a un final declarado y visible.

## Fuentes
- Ghost Jobs: What Are They and How to Spot Them — Built In: https://builtin.com/articles/ghost-jobs
- Ley 21.719: guía 2026 para cumplir con la ley de protección de datos en Chile — Prey:
  https://preyproject.com/es/blog/ley-de-proteccion-de-datos-en-chile
- Documento técnico currícula, Desarrollo de Aplicaciones Full Stack JavaScript Trainee v2.0
  (restricción de stack)
