# Qué tiene que revisar un abogado, exactamente

Este documento existe para que la revisión legal no sea "léete esto y dinos si está bien", sino una
lista de decisiones concretas. Un abogado cobra por decidir, no por leer.

Lo redactó un desarrollador con ayuda de una IA, a partir de la Ley 21.719 y de lo que el sistema
efectivamente hace. **Nada de esto es asesoría legal.**

## Lo que ya está resuelto y no necesita decisión
El **inventario** está completo: `registro-actividades-tratamiento.md` lista cada dato que se guarda,
para qué, con qué base de licitud, cuánto tiempo y quién lo ve. Eso es normalmente lo que más cuesta
levantar en una revisión, y ya está hecho y verificado contra el código.

También están escritos y probados el procedimiento de brecha (`../09-procedimiento-de-brecha.md`) y
las medidas de seguridad (`../03-seguridad.md`).

## Las diez decisiones que necesitan un abogado

### 1. Quién es el responsable del tratamiento
El borrador dice que es la Facultad. ¿Es la FEN, la Universidad Alberto Hurtado como persona jurídica,
o ambas? De esto depende quién firma, quién responde ante la Agencia y quién paga una multa.

### 2. La base de licitud de cada finalidad
El registro propone una base por cada tratamiento (consentimiento, ejecución de contrato, interés
legítimo, obligación legal). **Hay que confirmar cada una.** La más discutible: usar el RUT del
estudiante para identificarlo ante la empresa — ¿consentimiento o relación académica?

### 3. Si el consentimiento de un estudiante es libre
La ley exige consentimiento **libre**. Si Proxi es el único canal para postular a prácticas de la
Facultad, un estudiante que no acepta queda fuera del proceso académico. Eso puede viciar el
consentimiento y obligar a apoyarse en otra base de licitud. **Es el punto más delicado de todo el
documento** y no lo puede resolver un desarrollador.

### 4. Estudiantes menores de 18 años
Puede haber estudiantes de primer año menores de edad. La ley da tratamiento reforzado a los datos de
menores. Hoy el sistema **no pregunta la edad y no distingue**. Si la respuesta es que sí importa, es
un cambio de código, no de texto.

### 5. Transferencia internacional
Si la aplicación se despliega en un proveedor con servidores fuera de Chile —el candidato actual,
Render, los tiene en EE. UU.— hay **transferencia internacional de datos personales**, que la ley
regula y exige informar con sus garantías. Omitirlo es infracción gravísima. Es una decisión de
infraestructura con consecuencia legal, y hay que tomarla en ese orden.

### 6. Plazo de conservación
El borrador propone 12 meses de inactividad antes de eliminar. Es un número que eligió el
desarrollador, no la ley. ¿Hay alguna obligación de la Universidad de conservar registros de prácticas
por más tiempo? Si la hay, gana sobre la minimización.

### 7. Delegado de Protección de Datos
¿La Universidad ya tiene uno designado? Si existe, su contacto va en la política. Si no, hay que
determinar si en este caso la ley lo exige.

### 8. Evaluación de impacto
Hay tratamiento de RUT, currículums y datos académicos de un grupo grande de personas. Corresponde
determinar si se exige una evaluación de impacto previa, y hacerla antes de operar.

### 9. Limitación de responsabilidad y jurisdicción
Los términos de uso dicen que Proxi no es empleador, no es parte del convenio de práctica y no
garantiza obtener una. Falta afinar hasta dónde llega la responsabilidad de la Facultad si una empresa
publicada en Proxi incumple con un estudiante, y ante qué tribunal se resuelve.

### 10. Licencia del código
El repositorio es público sin licencia declarada. Sin licencia, legalmente nadie puede reutilizarlo —
puede ser lo que se quiere, o no.

## Lo que un desarrollador ya no puede avanzar sin respuesta
Los puntos **3, 4 y 5** bloquean código, no solo texto:
- Si el consentimiento no puede ser la base, cambia el flujo de registro.
- Si importan los menores, hay que pedir y tratar la edad de forma distinta.
- Si hay transferencia internacional, cambia el proveedor o cambian las garantías.

## Fuentes usadas para redactar los borradores
- Ley 21.719, publicada el 13-12-2024, en plena vigencia desde el **1 de diciembre de 2026**.
- Deber de información (Art. 14 ter): identidad del responsable, finalidades, base de licitud, plazos
  de conservación, destinatarios, transferencias internacionales, derechos y decisiones automatizadas.
- Derechos ARSOPB: acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal.
- Plazo de respuesta: **30 días corridos**, prorrogable una vez por 30 días más. Bloqueo temporal:
  2 días hábiles.
- Notificación de brechas a la Agencia: **72 horas**. Omitirla es infracción gravísima.
- Sanciones: leves hasta 5.000 UTM, graves hasta 10.000 UTM, gravísimas hasta 20.000 UTM.
