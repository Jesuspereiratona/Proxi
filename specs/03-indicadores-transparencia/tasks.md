# Tareas · Indicadores de transparencia

- [x] 1. Migración: `CREATE MATERIALIZED VIEW empresa_indicadores` + índice único en `empresa_id`
      (incluye `postulaciones_terminales`/`postulaciones_con_movimiento`, agregados tras la
      auditoría de seguridad — ver bitácora)
- [x] 2. Modelo Sequelize `EmpresaIndicador` (solo lectura) + asociación `Empresa.hasOne` /
      `EmpresaIndicador.belongsTo` en `models/index.js`
- [x] 3. `services/empresas/indicadores.service.js`: `obtenerPublico` y `listarTodos`
- [x] 4. `GET /api/v1/empresas/:id/indicadores` (público, solo empresas validadas)
- [x] 5. `GET /api/v1/empresas/indicadores` (coordinación)
- [x] 6. `tareas/recalcularIndicadores.js` + registrar su estado en `GET /salud` + programarla en
      `server.js`
- [x] 7. Pruebas: los 13 criterios de aceptación de `spec.md` (11 originales + 2 agregados tras la
      auditoría), con datos construidos a mano y cálculos verificados contra el resultado real

## Terminado cuando
- [x] Los criterios de aceptación de `spec.md` tienen prueba automatizada y pasan (392 pruebas, 0 fallas)
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [x] Agente `auditor-seguridad` corrido antes del push — 1 hallazgo medio, 1 medio-bajo y 2 bajos, todos cerrados (ver bitácora)
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [x] Fase 5 marcada en `docs/06-roadmap.md`
