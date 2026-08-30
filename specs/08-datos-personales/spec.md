# Spec · Portabilidad, borrado y retención (Fase 7, parte de código)

- **Estado:** aprobada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** Fase 7 (solo la parte de código — política de privacidad, términos de uso y
  DPA quedan fuera, ver nota del roadmap)

## Problema
`docs/03-seguridad.md` ya documenta las obligaciones de la Ley 21.719 (portabilidad, supresión,
retención) desde Fase 0, pero nada las implementa todavía. Sin esto, un estudiante no tiene forma de
pedir sus datos ni de borrar su cuenta, y un CV nunca se elimina aunque nadie vuelva a entrar.

## Alcance
Solo estudiantes. `docs/03-seguridad.md` describe estas tres obligaciones enteramente en términos de
"el estudiante" (CV, RUT, postulaciones) — una empresa no tiene datos personales de una persona
natural en el mismo sentido (su RUT es de la empresa, no de alguien), y coordinación es personal
interno de la facultad, no un usuario final. Portabilidad/borrado de cuentas de empresa queda fuera
de este incremento, anotado como decisión explícita.

## Comportamiento esperado
- `GET /api/v1/mi-cuenta/datos` (estudiante, autenticado): exporta en JSON todo lo propio — datos de
  cuenta, perfil (con el RUT descifrado: es su propio dato, distinto del endpoint de coordinación que
  audita Fase 2), el CV vigente (metadatos, no el archivo binario), y sus postulaciones con la línea
  de tiempo de estados (sin `motivo` de la empresa: sigue siendo la nota de otra persona, la regla de
  Fase 6 parte 3 no cambia porque ahora el pedido es de portabilidad).
- `DELETE /api/v1/mi-cuenta` (estudiante, autenticado): borra el/los CV del disco (nunca de la base:
  `postulaciones.cv_archivo_id` tiene `onDelete:'RESTRICT'` desde Fase 4, un archivo referenciado no
  se puede borrar); anonimiza el perfil de estudiante en el lugar (nombres, apellidos, carrera, RUT,
  teléfono); las postulaciones **no se tocan** — siguen existiendo con su estado, apuntando al
  perfil ya anonimizado, que es justamente "el evento estadístico sin identidad" que pide el
  roadmap. La cuenta (`usuarios`) queda inutilizable: el correo se reemplaza por un marcador único
  (no se puede volver a iniciar sesión con el correo real) y se revocan todas las sesiones activas.
- Tarea programada de retención: un estudiante sin actividad por `RETENCION_CV_MESES` meses (default
  12, ya estaba en `.env`/`.env.example` desde una fase anterior) recibe un aviso por correo
  `RETENCION_AVISO_DIAS` días antes (default 30) y, si sigue sin actividad al cumplirse el plazo
  completo (contado desde que se cumplió el aviso, no desde el mismo día en que se avisó), se le
  aplica el mismo borrado de arriba automáticamente.

## Reglas que no se pueden romper
1. El borrado nunca deja una postulación huérfana ni rompe una FK — se anonimiza el perfil, no se
   borran las filas que otros procesos (indicadores de Fase 5, historial de una empresa) necesitan
   seguir contando.
2. Después de borrar/anonimizar, el correo original no vuelve a servir para iniciar sesión.
3. El RUT descifrado de `GET /mi-cuenta/datos` solo lo puede pedir el dueño de esos datos — nunca una
   ruta que reciba un id de otro usuario.
4. El aviso de retención se manda una sola vez por cuenta, no todos los días hasta que se borre.

## Casos borde
- Un estudiante sin perfil todavía (creó la cuenta pero nunca llenó el formulario): `GET
  /mi-cuenta/datos` responde con `perfil: null`, no un error.
- Un estudiante sin CV subido: `cv: null` en la exportación, y el borrado de cuenta no falla por
  intentar borrar un archivo que no existe.
- Un archivo ya no está en disco cuando se procesa el borrado (se borró a mano, o ya se había
  borrado antes): no revienta, sigue con el resto (mismo criterio que `archivos.service.js
  descargar()`).
- La tarea de retención corre sobre una cuenta que ya se autoeliminó: no debe reintentar el aviso ni
  fallar — el perfil ya anonimizado no vuelve a calificar para "avisar" ni "eliminar" de nuevo.

## Criterios de aceptación
- [ ] Dado un estudiante con perfil, CV y postulaciones, cuando pide `GET /mi-cuenta/datos`,
      entonces recibe todo eso en un solo JSON, incluido su RUT propio.
- [ ] Dado un estudiante con CV, cuando borra su cuenta, entonces el archivo ya no existe en disco.
- [ ] Dado un estudiante con postulaciones, cuando borra su cuenta, entonces esas postulaciones
      siguen existiendo con su estado, pero el perfil vinculado ya no tiene datos personales.
- [ ] Dado un estudiante que borró su cuenta, cuando intenta iniciar sesión con el correo original,
      entonces falla igual que con un correo que nunca existió.
- [ ] Dado un estudiante inactivo por el plazo completo menos el aviso, cuando corre la tarea,
      entonces recibe el correo de aviso una sola vez.
- [ ] Dado un estudiante inactivo por el plazo completo, cuando corre la tarea, entonces su cuenta
      queda anonimizada igual que con el borrado manual.

## Fuera de alcance
- Portabilidad/borrado de cuentas de empresa o coordinación.
- Política de privacidad, términos de uso, DPA (documentos legales, no código — ver roadmap).
- Interfaz web para pedir los propios datos o borrar la cuenta (queda para un incremento futuro si
  se pide; hoy es API pura, como el resto de Fase 7).
