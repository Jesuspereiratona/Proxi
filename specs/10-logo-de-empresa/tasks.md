# Tareas · Logo de empresa

Cada una se termina y se prueba por separado. El orden importa: la base primero, el servicio después,
la pantalla al final. Nada de esto sale a la vitrina hasta la tarea 9.

## Base de datos
- [x] 1. Migración `archivos.contenido BYTEA` (nullable). `down` que la elimina. Pasar por
      `revisor-migraciones`.
- [x] 2. Migración de aprobación: `aprobado_at`, `aprobado_por_usuario_id` (FK a `usuarios`),
      `retirado_at`, más el índice parcial de logo vigente. `down` reversible.
- [x] 3. Columnas nuevas en `models/Archivo.js`. Sin lógica: solo el mapeo.

## Servicio
- [x] 4. `services/archivos/logos.service.js`: validación por firma (PNG/JPEG/WebP, SVG rechazado con
      su propio mensaje), tope de 512 KB, `subir` que reemplaza el anterior dejándolo pendiente.
- [x] 5. `obtenerVigente(empresaId)`: una sola consulta que exige logo aprobado, no retirado **y**
      empresa validada. Es la que corre en cada carga de la vitrina.
- [x] 6. `aprobar`, `retirar`, `listarPendientes` para coordinación. Compare-and-set al aprobar, para
      que lo que queda aprobado sea exactamente lo que coordinación vio (caso borde de la spec).
- [x] 7. Pruebas del servicio, una por regla de la spec. Las de rechazo primero: SVG, PDF renombrado,
      archivo grande, empresa ajena.

## API
- [x] 8. Rutas y controller de los seis endpoints del plan. Encabezados al servir: `Content-Type` de
      la firma guardada, `Cache-Control`, `Content-Disposition: inline`. Verificar que helmet esté
      poniendo `nosniff` de verdad, con `curl`, no de memoria.
- [x] 9. `logoUrl` en el listado público de ofertas y en el perfil público de empresa, solo cuando hay
      logo vigente.
- [x] 10. Pruebas de integración: los 14 criterios de aceptación de la spec, uno por prueba.

## Cliente
- [x] 11. `tarjeta-oferta.js` y `empresa.js`: `<img>` si hay `logoUrl`, la inicial si no.
      `object-fit: contain` en el tema.
- [x] 12. `panel-empresa.html`: subir, vista previa, estado ("esperando aprobación de coordinación"),
      quitar.
- [x] 13. `panel-coordinacion.html`: logos pendientes **con la imagen a la vista**, aprobar y retirar.

## Cierre
- [x] 14. Borrado de cuenta: verificar con una prueba que el logo se va con la cuenta y no queda
      huérfano.
- [x] 15. Pasar todo por `auditor-seguridad`. Es subida de archivos de un tercero servida en la página
      más pública del sitio: no se cierra sin esto.
- [x] 16. Decisiones a la bitácora, casilla al roadmap, `docs/02-modelo-de-datos.md` actualizado con
      las columnas nuevas.

## Después de las revisiones (2026-09-20)
- [x] 17. Cinco hallazgos de `auditor-seguridad` corregidos y verificados en ejecución: bytes no
      liberados al retirar, `quitarPropio` que dejaba publicado el aprobado, límite de tasa que
      compartía contador con el global, empresa suspendida que podía seguir subiendo, y retiro sin
      rastro de quién lo hizo.
- [x] 18. Recortes de la revisión de economía de código: helpers de prueba a `tests/ayudas.js`,
      reenviador `empresasConLogo` eliminado, comentario falso sobre un ciclo de módulos que no
      existe, y tres patrones del cliente unificados con los que el repo ya usaba.
