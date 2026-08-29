# Tareas · Ciclo de vida de una oferta

- [x] 1. Migración `ofertas` con los CHECK del modelo. `fecha_cierre` terminó NULLable con un CHECK
      propio (`estado='borrador' OR fecha_cierre IS NOT NULL`) en vez de `NOT NULL` puro — ver bitácora
- [x] 2. Migración `oferta_eventos`
- [x] 3. Modelo Sequelize `Oferta` + asociaciones con `Empresa`
- [x] 4. `services/ofertas/estados.js` con la tabla de transiciones + pruebas unitarias de la matriz completa
- [x] 5. `services/ofertas/reglas.js`: vigencia y cierres pendientes, con reloj inyectado + pruebas
- [x] 6. Agregar los códigos de error nuevos al catálogo compartido
- [x] 7. `POST /ofertas` y `PATCH /ofertas/:id` (borradores) + validación de esquema
- [x] 8. `GET /ofertas/mias` con verificación de pertenencia en la consulta
- [x] 9. `POST /ofertas/:id/revision` con las reglas de empresa validada y cierres pendientes
- [x] 10. `POST /ofertas/:id/aprobacion` y `/rechazo` (coordinación), motivo obligatorio en el rechazo
- [x] 11. `POST /ofertas/:id/cierre` con motivo obligatorio y `resultado_declarado = true`
- [x] 12. Envolver cada cambio de estado + evento en una transacción
- [x] 13. `GET /ofertas` público con filtros, paginación y solo vigentes
- [x] 14. `GET /ofertas/:id` con la regla de visibilidad según estado y rol
- [x] 15. Tarea `cerrarOfertasVencidas` + registro de última ejecución + prueba de idempotencia
- [x] 16. Exponer la última ejecución de las tareas en `GET /salud`
- [x] 17. Prueba de acceso cruzado: empresa B contra oferta de empresa A
- [x] 18. Prueba de borde de fecha de cierre — no hay comparación "por día" en el código (todo es
      epoch/UTC vía `Date`, sin `setHours`/date-only), así que el único borde real es el instante
      exacto de `fechaCierre`, ya cubierto en `ofertas-reglas.test.js`

## Terminado cuando
- [x] Los 13 criterios de aceptación de `spec.md` tienen prueba automatizada y pasan (198 pruebas, 0 fallas)
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [x] Agente `auditor-seguridad` corrido antes del push — 2 hallazgos graves, 2 altos y varios medios/bajos, todos cerrados (ver bitácora)
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [x] Fase 3 marcada en `docs/06-roadmap.md`
