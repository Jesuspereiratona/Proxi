# Tareas · Perfiles y validación de empresas

- [x] 1. Generar y agregar `RUT_CIFRADO_KEY` a `.env`/`.env.example`; agregarla a `REQUERIDAS` en `config/env.js`
- [x] 2. Migración `crear-estudiantes` (con `CREATE EXTENSION pgcrypto`) + modelo Sequelize `Estudiante`
- [x] 3. Migración `crear-empresas` (con el CHECK de `estado_validacion`) + modelo `Empresa`
- [x] 4. `utils/rut.js` (`normalizarRut`, `esRutValido`) + pruebas unitarias con casos límite
- [x] 5. Agregar `PERFIL_YA_EXISTE`, `PERFIL_NO_ENCONTRADO`, `RUT_INVALIDO`, `EMPRESA_TRANSICION_INVALIDA`, `EMPRESA_NO_VALIDADA` al catálogo de errores
- [x] 6. `repositories/estudiantes.repository.js`: `crearConRutCifrado`, `actualizarRut`, `obtenerRutDescifradoPorId`
- [x] 7. `services/estudiantes/estudiantes.service.js`: `crearPerfil`, `obtenerPropio`, `actualizarPropio`
- [x] 8. `schemas/estudiantes.schemas.js` + `POST`/`GET`/`PATCH /estudiantes/perfil`
- [x] 9. `GET /estudiantes/:id/rut` con `autorizar('coordinacion')`
- [x] 10. `services/empresas/estados.js` (transiciones) + pruebas unitarias de la matriz
- [x] 11. `services/empresas/reglas.js` (`verificarValidada`) + pruebas unitarias de los cuatro estados
- [x] 12. `services/empresas/empresas.service.js`: `crearPerfil`, `obtenerPropio`, `actualizarPropio` (con el auto-reenvío `rechazada → pendiente`)
- [x] 13. `schemas/empresas.schemas.js` + `POST`/`GET`/`PATCH /empresas/perfil`
- [x] 14. `empresas.service.listarPendientes` + `GET /empresas/pendientes` (coordinación)
- [x] 15. `empresas.service.validar`/`rechazar` + `POST /empresas/:id/validacion` y `/rechazo`
- [x] 16. Pruebas de integración: un caso por criterio de aceptación de `spec.md`
- [x] 17. Prueba de acceso cruzado entre dos estudiantes y entre dos empresas
- [x] 18. Prueba de mass-assignment: `usuarioId` forjado en el cuerpo no tiene efecto
- [x] 19. Seeds de datos de prueba (`db/seeds/`) con RUT y correos **inventados**

## Terminado cuando
- [x] Los 15 criterios de aceptación de `spec.md` tienen prueba automatizada y pasan (84 pruebas, 0 fallas)
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [x] Agente `auditor-seguridad` corrido antes del push — 2 hallazgos graves, 1 alto y 2 medios, todos cerrados (ver bitácora)
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [x] Fase 2 marcada en `docs/06-roadmap.md`
