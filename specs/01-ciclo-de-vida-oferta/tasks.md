# Tareas · Ciclo de vida de una oferta

- [ ] 1. Migración `ofertas` con `fecha_cierre NOT NULL` y los tres CHECK. Verificar en psql que un INSERT sin fecha falla
- [ ] 2. Migración `oferta_eventos`
- [ ] 3. Modelo Sequelize `Oferta` + asociaciones con `Empresa`
- [ ] 4. `services/ofertas/estados.js` con la tabla de transiciones + pruebas unitarias de la matriz completa
- [ ] 5. `services/ofertas/reglas.js`: vigencia y cierres pendientes, con reloj inyectado + pruebas
- [ ] 6. Agregar los códigos de error nuevos al catálogo compartido
- [ ] 7. `POST /ofertas` y `PATCH /ofertas/:id` (borradores) + validación de esquema
- [ ] 8. `GET /ofertas/mias` con verificación de pertenencia en la consulta
- [ ] 9. `POST /ofertas/:id/revision` con las reglas de empresa validada y cierres pendientes
- [ ] 10. `POST /ofertas/:id/aprobacion` y `/rechazo` (coordinación), motivo obligatorio en el rechazo
- [ ] 11. `POST /ofertas/:id/cierre` con motivo obligatorio y `resultado_declarado = true`
- [ ] 12. Envolver cada cambio de estado + evento en una transacción
- [ ] 13. `GET /ofertas` público con filtros, paginación y solo vigentes
- [ ] 14. `GET /ofertas/:id` con la regla de visibilidad según estado y rol
- [ ] 15. Tarea `cerrarOfertasVencidas` + registro de última ejecución + prueba de idempotencia
- [ ] 16. Exponer la última ejecución de las tareas en `GET /salud`
- [ ] 17. Prueba de acceso cruzado: empresa B contra oferta de empresa A, en todas las rutas con `:id`
- [ ] 18. Prueba de zona horaria en el borde del día

## Terminado cuando
- [ ] Los 13 criterios de aceptación de `spec.md` tienen prueba automatizada y pasan
- [ ] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [ ] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [ ] Fase 3 marcada en `docs/06-roadmap.md`
