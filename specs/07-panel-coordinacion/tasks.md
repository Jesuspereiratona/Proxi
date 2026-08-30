# Tareas · Panel de coordinación

- [x] 1. Backend: `empresasService.listarTodas()` + `GET /empresas` (coordinación); `ofertasService
      .listarPendientesRevision()` incluye `Empresa.razonSocial`. Pruebas de ambos, más acceso
      cruzado de rol en `GET /empresas`.
- [x] 2. Extender `api/empresas.js` (`listarTodas`, `validar`, `rechazar`, `suspender`,
      `listarTodosLosIndicadores`) y `api/ofertas.js` (`listarPendientesRevision`, `aprobar`,
      `rechazarOferta`) — wrappers de una línea.
- [x] 3. `panel-coordinacion.html` + su JS: tres secciones (empresas, ofertas por revisar,
      indicadores), acciones con motivo obligatorio por `prompt()`.
- [x] 4. Smoke test con Chrome headless contra la API real: empresas en distintos estados, una
      oferta en revisión, las tres secciones con datos reales. También sirvió para notar (no un
      hallazgo de seguridad, un descuido de datos de prueba) que la vista materializada de
      indicadores traía filas huérfanas de empresas de prueba ya borradas por los `after()` de otros
      archivos de test — todos corren contra `proxi_dev`, no una base de test aparte. Se refrescó la
      vista y, ya que la interfaz necesitaba manejar el caso de todos modos (una empresa borrada de
      verdad es un escenario real desde que exista Fase 7), se le agregó un texto de reemplazo en
      vez de dejar la celda en blanco.
- [x] 5. Auditoría de seguridad (`auditor-seguridad`) antes del push. Sin hallazgos Alto/Grave; dos
      Media corregidos (coordinación aprobaba ofertas y validaba empresas sin ver el contenido que
      estaba moderando — el control humano de `docs/03-seguridad.md` §5 era un trámite por el
      nombre) y dos observaciones corregidas (motivo de solo espacios pasaba la validación en los
      tres endpoints de rechazo/suspensión; las transiciones de empresa no tenían compare-and-set
      como sí lo tienen las de oferta desde Fase 3). Ver bitácora.
- [x] 6. Documentación: `docs/06-roadmap.md`, `docs/decisiones/bitacora.md`.

## Terminado cuando
- [x] Criterios de aceptación de `spec.md` verificados.
- [x] Lista de verificación de seguridad revisada.
- [x] Roadmap y bitácora actualizados.
