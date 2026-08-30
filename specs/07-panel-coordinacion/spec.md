# Spec · Panel de coordinación

- **Estado:** aprobada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** Fase 6 (último panel)

## Problema
Coordinación valida empresas, aprueba ofertas y ve el panorama de indicadores desde Fase 2-3-5,
pero todo por API. Cierra Fase 6: los tres roles pueden usar Proxi de punta a punta sin `curl`.

## Quién la usa
Un usuario con sesión y rol `coordinacion`. Es el único rol con visión total: todas las empresas
en cualquier estado, todas las ofertas pendientes de revisión, el panorama completo de indicadores
sin el filtro que sí aplica la vista pública (Fase 5).

## Comportamiento esperado
- Una pantalla, tres secciones: **Empresas**, **Ofertas por revisar**, **Indicadores**.
- Empresas: lista todas (cualquier estado). `pendiente` → validar o rechazar (motivo obligatorio).
  `validada` → suspender (motivo obligatorio). `rechazada`/`suspendida` → de solo lectura, con el
  motivo visible.
- Ofertas por revisar: lista las `en_revision`, con la empresa que las mandó. Aprobar o rechazar
  (motivo obligatorio) cada una.
- Indicadores: tabla de las cuatro métricas por empresa, sin el umbral mínimo que sí aplica
  `GET /empresas/:id/indicadores` (ese es para el público; coordinación necesita ver todo, incluida
  una empresa con poco historial, para poder actuar).

## Reglas que no se pueden romper
1. Ninguna transición de empresa/oferta se ofrece si el estado actual no la permite, según
   `services/empresas/estados.js` / `services/ofertas/estados.js` — el panel refleja lo que la API
   decide.
2. Rechazar una empresa o una oferta, o suspender una empresa, exige motivo: la API ya lo exige
   (`rechazoEsquema`/`suspensionEsquema` de empresas, `rechazoEsquema` de ofertas); el panel también,
   para no gastar un viaje al servidor solo para fallar.
3. Ningún dato personal de estudiantes aparece en esta pantalla — coordinación modera empresas y
   ofertas, no postulaciones individuales (eso ya lo audita Fase 4 con `AuditoriaAcceso` aparte).

## Casos borde
- Todas las empresas ya están validadas o todas las ofertas ya están revisadas → sección vacía con
  mensaje humano, no una tabla en blanco sin explicación.
- Dos coordinadores aprobando la misma oferta a la vez → mismo compare-and-set que ya prueba
  Fase 3 (409 traducido, no una oferta aprobada dos veces).

## Criterios de aceptación
- [ ] Dado una empresa pendiente, cuando se valida, entonces pasa a `validada` y desaparece de
      "pendientes de validar".
- [ ] Dado una empresa pendiente, cuando se rechaza sin motivo, entonces el flujo lo exige antes de
      enviar.
- [ ] Dado una empresa validada, cuando se suspende, entonces sus ofertas publicadas se cierran en
      cascada (ya lo hace la API; el panel solo dispara la acción y refresca la lista).
- [ ] Dado una oferta en revisión, cuando se aprueba, entonces pasa a `publicada` y aparece en la
      vitrina pública.
- [ ] Dado la tabla de indicadores, cuando se abre, entonces muestra una fila por empresa sin
      importar cuánto historial tenga (a diferencia de la vista pública).

## Fuera de alcance
- Notificaciones a la empresa/estudiante cuando coordinación actúa.
- Reactivar una empresa suspendida (decisión ya tomada en Fase 2: sin flujo definido).
- Ver o moderar postulaciones individuales.
