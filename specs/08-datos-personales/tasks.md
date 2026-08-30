# Tareas · Portabilidad, borrado y retención

- [x] 1. Migración `agregar-aviso-retencion-estudiantes` (columna `aviso_retencion_enviado_at` en
      `estudiantes`) + campo en el modelo. Pasó por `revisor-migraciones` antes de aplicarla — sana
      tal cual, pero encontró un bug real en cómo la iba a usar `cuenta.service.js` (ver bitácora).
      Segunda migración agregada durante la auditoría de seguridad: `agregar-anonimizado-usuarios`
      (columna `anonimizado_at` en `usuarios`), mismo patrón (nullable, sin default, reversible).
- [x] 2. `env.js`: `retencionCvMeses`/`retencionAvisoDias`, con validación al arrancar (enteros
      positivos, aviso menor que el plazo total). `.env.example` documentado.
- [x] 3. Arreglo de paso: `correo.service.js` deja de registrar el correo del destinatario en el log.
- [x] 4. `services/cuenta/cuenta.service.js`: `obtenerDatos`, `confirmarClave`, `eliminarCuenta`,
      `procesarRetencion`.
- [x] 5. `controllers/cuenta.controller.js` + `routes/cuenta.routes.js`
      (`GET /mi-cuenta/datos`, `DELETE /mi-cuenta`, ambas `autenticar, autorizar('estudiante')`),
      montadas en `routes/index.js`.
- [x] 6. `tareas/procesarRetencionCv.js`, wireado en `salud.service.js` + `server.js`.
- [x] 7. Pruebas: exportación, borrado (archivo, anonimización, login posterior, sesión revocada,
      contraseña incorrecta, sin contraseña, doble borrado idempotente, motivo de un retiro
      anonimizado), retención (aviso una vez, elimina al plazo completo, no reintenta sobre cuenta ya
      anonimizada, vuelve a entrar y no se elimina sin aviso nuevo, un refresco cuenta como actividad).
- [x] 8. Auditoría de seguridad (`auditor-seguridad`) antes del push — primera vez que el proyecto
      borra/anonimiza datos de forma irreversible por pedido del propio usuario. Dos hallazgos Graves
      (la tarea podía eliminar sin aviso vigente a quien volvió a entrar; "actividad" no contaba una
      sesión sostenida solo por refrescos de token), uno Alto (el mensaje libre de la postulación y el
      motivo de un retiro seguían visibles para la empresa tras la supresión), y varios Medios/Menores
      corregidos. Ver bitácora, es la auditoría más extensa de todo el proyecto hasta ahora.
- [x] 9. Documentación: `docs/06-roadmap.md` (Fase 7), `docs/decisiones/bitacora.md`,
      `docs/02-modelo-de-datos.md` (dos columnas nuevas), `docs/07-operacion-y-mantenimiento.md`
      (orden de rollback de una migración).

## Terminado cuando
- [x] Criterios de aceptación de `spec.md` verificados.
- [x] Lista de verificación de seguridad revisada.
- [x] Roadmap y bitácora actualizados.
