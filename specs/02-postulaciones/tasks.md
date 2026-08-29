# Tareas · Postulaciones

- [x] 1. Migración `archivos` + migración que agrega la FK de `estudiantes.cv_archivo_id`
- [x] 2. Migración `postulaciones` con el `UNIQUE(oferta_id, estudiante_id)` y los CHECK de estado
- [x] 3. Migración `postulacion_eventos`
- [x] 4. Migración `auditoria_accesos`
- [x] 5. Modelos Sequelize `Archivo`, `Postulacion`, `PostulacionEvento`, `AuditoriaAcceso` +
      asociaciones en `models/index.js`
- [x] 6. Agregar `multer` a `apps/api/package.json`, `services/archivos/archivos.service.js`
      (subida con validación de número mágico `%PDF-`) y `middlewares/subir-cv.middleware.js`
- [x] 7. `POST /estudiantes/mi-cv` (ruta, controller, esquema no aplica — el cuerpo es multipart)
- [x] 8. Agregar los códigos de error nuevos al catálogo compartido
- [x] 9. `services/postulaciones/estados.js` con la tabla de transiciones + pruebas unitarias de
      la matriz completa
- [x] 10. `services/postulaciones/reglas.js`: `fechaLimiteSla` con reloj inyectado + pruebas
- [x] 11. `services/postulaciones/postulaciones.service.js`: `postular` con el manejo de la
      restricción `UNIQUE` como defensa de concurrencia
- [x] 12. `POST /postulaciones` + esquema de validación
- [x] 13. `GET /postulaciones/mias` y `GET /postulaciones/oferta/:id` con verificación de
      pertenencia en la consulta
- [x] 14. `GET /postulaciones/:id` con la regla de visibilidad según rol
- [x] 15. Las cuatro rutas de transición de empresa (`/revision`, `/entrevista`, `/seleccion`,
      `/rechazo`) + `/retiro` del estudiante, todas con compare-and-set
- [x] 16. `services/archivos/archivos.service.js`: `descargar` con la lógica de permiso por rol +
      registro en `auditoria_accesos`
- [x] 17. `GET /archivos/:id/descarga`
- [x] 18. Conectar `estudiantes.controller.js obtenerRut` a `auditoria_accesos` (reemplaza el log
      temporal que dejó la Fase 2)
- [x] 19. `manejador-errores.middleware.js`: traducir `MulterError` en vez de dejarlo caer como 500
- [x] 20. `tareas/marcarSinRespuesta.js` + registrar su estado en `GET /salud` + programarla en
      `server.js`
- [x] 21. Prueba de concurrencia: dos postulaciones simultáneas a la misma oferta
- [x] 22. Pruebas de acceso cruzado: postulación ajena, oferta ajena, CV de un estudiante sin
      relación con la empresa, y de una empresa suspendida (encontrado en la auditoría, ver bitácora)
- [x] 23. Prueba de subida: PDF real vs. archivo renombrado que no lo es

## Terminado cuando
- [x] Los criterios de aceptación de `spec.md` tienen prueba automatizada y pasan (378 pruebas, 0 fallas)
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [x] Agente `auditor-seguridad` corrido antes del push — sin hallazgos graves, 3 medios y 2 bajos, todos cerrados (ver bitácora)
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [x] Fase 4 marcada en `docs/06-roadmap.md`
