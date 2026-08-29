# Tareas · Perfiles y validación de empresas

- [ ] 1. Generar y agregar `RUT_CIFRADO_KEY` a `.env`/`.env.example`; agregarla a `REQUERIDAS` en `config/env.js`
- [ ] 2. Migración `crear-estudiantes` (con `CREATE EXTENSION pgcrypto`) + modelo Sequelize `Estudiante`
- [ ] 3. Migración `crear-empresas` (con el CHECK de `estado_validacion`) + modelo `Empresa`
- [ ] 4. `utils/rut.js` (`normalizarRut`, `esRutValido`) + pruebas unitarias con casos límite
- [ ] 5. Agregar `PERFIL_YA_EXISTE`, `PERFIL_NO_ENCONTRADO`, `RUT_INVALIDO`, `EMPRESA_TRANSICION_INVALIDA`, `EMPRESA_NO_VALIDADA` al catálogo de errores
- [ ] 6. `repositories/estudiantes.repository.js`: `crearConRutCifrado`, `actualizarRut`, `obtenerRutDescifrado`
- [ ] 7. `services/estudiantes/estudiantes.service.js`: `crearPerfil`, `obtenerPropio`, `actualizarPropio`
- [ ] 8. `schemas/estudiantes.schemas.js` + `POST`/`GET`/`PATCH /estudiantes/perfil`
- [ ] 9. `GET /estudiantes/:id/rut` con `autorizar('coordinacion')`
- [ ] 10. `services/empresas/estados.js` (transiciones) + pruebas unitarias de la matriz
- [ ] 11. `services/empresas/reglas.js` (`verificarValidada`) + pruebas unitarias de los cuatro estados
- [ ] 12. `services/empresas/empresas.service.js`: `crearPerfil`, `obtenerPropio`, `actualizarPropio` (con el auto-reenvío `rechazada → pendiente`)
- [ ] 13. `schemas/empresas.schemas.js` + `POST`/`GET`/`PATCH /empresas/perfil`
- [ ] 14. `empresas.service.listarPendientes` + `GET /empresas/pendientes` (coordinación)
- [ ] 15. `empresas.service.validar`/`rechazar` + `POST /empresas/:id/validacion` y `/rechazo`
- [ ] 16. Pruebas de integración: un caso por criterio de aceptación de `spec.md`
- [ ] 17. Prueba de acceso cruzado entre dos estudiantes y entre dos empresas
- [ ] 18. Prueba de mass-assignment: `usuarioId` forjado en el cuerpo no tiene efecto
- [ ] 19. Seeds de datos de prueba (`db/seeds/`) con RUT y correos **inventados**

## Terminado cuando
- [ ] Los 15 criterios de aceptación de `spec.md` tienen prueba automatizada y pasan
- [ ] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [ ] Agente `auditor-seguridad` corrido antes del push, hallazgos altos/medios cerrados
- [ ] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [ ] Fase 2 marcada en `docs/06-roadmap.md`
