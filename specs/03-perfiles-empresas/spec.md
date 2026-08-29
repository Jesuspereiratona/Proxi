# Spec · Perfiles y validación de empresas

- **Estado:** aprobada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** 2

## Problema
Fase 1 solo sabe "quién entra y con qué rol". No sabe nada de la persona: un estudiante no tiene
carrera ni forma de contacto, una empresa no tiene razón social ni nadie que la haya revisado. Sin
esto no hay a quién mostrarle una oferta ni quién publique una.

## Quién la usa
- **Estudiante:** crea y edita su propio perfil (nombres, RUT, carrera, teléfono).
- **Empresa:** crea y edita su propio perfil (razón social, RUT, contacto) y queda a la espera de
  validación.
- **Coordinación:** revisa la cola de empresas pendientes, valida o rechaza con motivo.
- **Sistema:** ninguna oferta de una empresa no validada puede publicarse (la regla se construye
  ahora; la ruta que la usa es de Fase 3).

## Comportamiento esperado
Un usuario con rol `estudiante` crea su perfil una sola vez: nombres, RUT, carrera, nivel, teléfono
opcional. El RUT se guarda cifrado en la base — nunca en texto plano — y solo coordinación puede
pedir su valor descifrado. Estudiantes y empresas ven y editan **solo su propio perfil**: no existe
una ruta que reciba el id de otra persona.

Un usuario con rol `empresa` crea su perfil: razón social, RUT de empresa (este sí es público, no se
cifra), giro, sitio web, comuna, nombre y cargo de contacto. El perfil nace `pendiente`. Mientras no
esté `validada`, la empresa puede editar su perfil y ver su propio estado, pero no puede publicar
ofertas (regla que Fase 3 consume).

Coordinación ve la cola de empresas `pendiente` y decide: valida (queda `validada`, con quién y
cuándo) o rechaza (exige motivo). Una empresa rechazada puede editar su perfil y volver a quedar
`pendiente` — el rechazo no es definitivo, es "corrige y reintenta".

## Reglas que no se pueden romper
1. Un usuario `estudiante` o `empresa` solo puede tener un perfil propio; no se pueden crear dos.
2. El RUT de un estudiante se guarda cifrado (`pgcrypto`) y solo se descifra en una consulta que
   exige rol `coordinacion`. En cualquier otra respuesta, el RUT nunca aparece completo.
3. Ninguna ruta de perfil recibe el id de otro usuario: siempre opera sobre el usuario autenticado.
   Un intento de forzar el `usuarioId` en el cuerpo de la petición se ignora, no se procesa.
4. Una empresa nace `pendiente`. Solo coordinación transiciona a `validada` o `rechazada`.
5. Rechazar exige `motivo_rechazo`. Sin motivo no hay rechazo.
6. Una empresa `rechazada` que edita su perfil vuelve a `pendiente` automáticamente.
7. `verificarValidada(empresa)` lanza `EMPRESA_NO_VALIDADA` para cualquier empresa que no esté
   `validada`; es la función que Fase 3 usará antes de publicar.
8. El RUT (de estudiante o de empresa) se valida con el dígito verificador antes de guardarse.

## Casos borde
| Situación | Qué pasa |
|---|---|
| Un estudiante intenta crear un segundo perfil | 409 `PERFIL_YA_EXISTE` |
| Un estudiante o empresa sin perfil consulta su perfil | 404 `PERFIL_NO_ENCONTRADO` |
| Se envía un RUT con dígito verificador inválido | 422 `RUT_INVALIDO` |
| Coordinación rechaza sin `motivo_rechazo` | 422 `VALIDACION_ENTRADA` |
| Coordinación intenta validar una empresa ya `validada` | 409 `EMPRESA_TRANSICION_INVALIDA` |
| Una empresa `rechazada` edita su perfil | Queda `pendiente` otra vez, sin nueva acción de coordinación |
| El cuerpo de un `PATCH` incluye `usuarioId` o `estadoValidacion` | Se ignoran: no son campos editables por el dueño del perfil |
| Un estudiante autenticado llama a la cola de empresas pendientes | 403 |
| Dos empresas distintas usan el mismo `rut_empresa` | 409 (constraint único) |

## Criterios de aceptación
- [ ] Dado un estudiante autenticado sin perfil, cuando crea uno con datos válidos, entonces responde 201 y el RUT no aparece en texto plano en la respuesta
- [ ] Dado un estudiante con perfil, cuando intenta crear otro, entonces responde 409 `PERFIL_YA_EXISTE`
- [ ] Dado un RUT con dígito verificador inválido, cuando se envía en la creación, entonces responde 422 `RUT_INVALIDO`
- [ ] Dados dos estudiantes con perfil, cuando el estudiante A consulta `GET /estudiantes/perfil`, entonces solo ve sus propios datos, nunca los de B
- [ ] Dado un `PATCH` con un `usuarioId` distinto al propio en el cuerpo, cuando se procesa, entonces el perfil modificado sigue siendo el del usuario autenticado
- [ ] Dada una empresa autenticada sin perfil, cuando crea uno con datos válidos, entonces responde 201 con `estadoValidacion = pendiente`
- [ ] Dado un `rut_empresa` ya usado por otra empresa, cuando se intenta registrar, entonces responde 409
- [ ] Dada una empresa `pendiente`, cuando coordinación la valida, entonces queda `validada` con `validadaPorUsuarioId` y `validadaAt`
- [ ] Dada una empresa `pendiente`, cuando coordinación la rechaza sin motivo, entonces responde 422
- [ ] Dada una empresa `pendiente`, cuando coordinación la rechaza con motivo, entonces queda `rechazada` con el motivo guardado
- [ ] Dada una empresa `rechazada`, cuando edita su propio perfil, entonces queda `pendiente` de nuevo
- [ ] Dada una empresa `validada`, cuando coordinación intenta validarla otra vez, entonces responde 409 `EMPRESA_TRANSICION_INVALIDA`
- [ ] Dado un estudiante autenticado, cuando llama a la cola de empresas pendientes de coordinación, entonces responde 403
- [ ] Dada una empresa `pendiente` o `rechazada`, cuando se llama `verificarValidada`, entonces lanza `EMPRESA_NO_VALIDADA`
- [ ] Dado el RUT cifrado de un estudiante, cuando coordinación lo consulta por la vía autorizada, entonces se descifra correctamente; cuando lo intenta cualquier otro rol, responde 403

## Fuera de alcance
Subida de CV (`cv_archivo_id` queda `NULL`, Fase 4), perfil público de empresa e indicadores de
transparencia (Fase 5), estado administrativo `suspendida` de una empresa (no hay flujo que lo dispare
todavía), un registro histórico de cada validación/rechazo (las columnas guardan solo la última
transición, no un `empresa_eventos` completo), y la ruta que realmente bloquea publicar (`Fase 3`
consume `verificarValidada`, no la llama nadie todavía).

**Mejora futura, no ahora:** el reenvío a revisión (`rechazada → pendiente`) es automático al editar
cualquier campo del perfil. Un endpoint explícito "reenviar a revisión" —para que la empresa decida
cuándo está lista, en vez de disparar una revisión con cada edición— tiene más sentido cuando exista
un panel de empresa real (Fase 6) donde ponerle un botón. Antes de eso, construirlo es especular sobre
una interfaz que no existe.
