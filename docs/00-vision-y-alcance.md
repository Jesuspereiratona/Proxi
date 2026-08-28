# 00 · Visión y alcance

## El problema
La vinculación entre empresas y estudiantes en práctica se maneja hoy con avisos publicados en
portales genéricos, correos y planillas. Tres fallas se repiten y están documentadas en el rubro
(evidencia en `investigacion/diagnostico-mercado.md`):

1. **Avisos sin vencimiento.** El estudiante no sabe si el aviso sigue vivo. Cerca de un tercio de
   los avisos publicados nunca termina en una contratación.
2. **Postulaciones sin respuesta.** El estudiante postula y nunca recibe ni un "no". El ghosting a
   postulantes creció 120% entre 2018 y 2023.
3. **Coordinación a ciegas.** La unidad académica no sabe cuántos estudiantes postularon, a qué
   empresas, ni cómo terminó el proceso. No hay datos para gestionar.

## La propuesta
Proxi no es un tablón de avisos. Es un sistema donde **el estado y el tiempo son obligatorios**.

### Las cuatro reglas que nos definen
1. **Toda oferta tiene fecha de cierre.** No existe una oferta publicada sin vigencia. Al vencerse,
   el sistema la cierra solo.
2. **Cerrar exige declarar el resultado.** La empresa debe decir qué pasó: contrató, canceló o no
   encontró candidato. Si deja cierres sin declarar más de `PLAZO_DECLARAR_CIERRE_DIAS`, no puede
   publicar una oferta nueva.
3. **Toda postulación llega a un estado terminal.** Si la empresa no responde dentro del SLA, el
   sistema marca `sin_respuesta`. El silencio queda registrado, no escondido.
4. **Cada empresa muestra sus indicadores.** Tasa de respuesta, días promedio de respuesta y tasa de
   cierres declarados, visibles en su perfil público. El estudiante decide dónde invertir su tiempo.

## Usuarios y qué gana cada uno
| Rol | Qué hace | Qué gana |
|---|---|---|
| **Estudiante** | Crea perfil, sube CV, busca ofertas vigentes, postula, sigue el estado | Deja de postular al vacío; sabe qué pasó con cada postulación |
| **Empresa** | Se registra, es validada, publica ofertas con vigencia, responde postulaciones | Llega a estudiantes filtrados de la facultad; su buen comportamiento es visible |
| **Coordinación** | Valida empresas, modera ofertas, observa el proceso completo | Datos reales para gestionar la vinculación con el medio |

## Alcance de la versión 1
**Dentro:** identidad y roles · validación de empresas por coordinación · publicación de ofertas con
ciclo de vida completo · postulación con CV · estados de postulación con SLA · indicadores de
transparencia · vitrina pública · paneles por rol · derechos sobre datos personales (acceso,
portabilidad, eliminación).

**Fuera (fases posteriores):** convenios y seguro escolar · evaluación del supervisor · informe final
de práctica · notificaciones por correo más allá de las transaccionales · recomendaciones
automáticas por carrera o habilidades · mensajería interna empresa–estudiante · app móvil.

## Cómo sabremos que funciona
| Indicador | Meta v1 |
|---|---|
| Ofertas publicadas sin fecha de cierre | 0 (imposible por diseño) |
| Ofertas cerradas con resultado declarado | > 90% |
| Postulaciones que terminan en estado terminal | 100% (garantizado por el SLA automático) |
| Días promedio de respuesta de las empresas | < 10 |

## Restricciones
- **Stack acotado a la currícula** del bootcamp Full Stack JavaScript: HTML/CSS/Bootstrap, JS/ES6+,
  SQL/PostgreSQL, Node/Express, ORM, API REST, JWT, subida de archivos. Cada elección debe poder
  defenderse contra un aprendizaje esperado del plan formativo.
- **Ley 21.719** de protección de datos personales, vigente desde el 1 de diciembre de 2026. Se
  manejan RUT, correos y currículums de estudiantes: son datos personales y hay obligaciones
  concretas. Ver `03-seguridad.md`.
- Un solo desarrollador. Todo lo que se agregue hay que mantenerlo.
