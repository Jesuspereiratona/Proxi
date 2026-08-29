# Tareas · Panel de estudiante

- [x] 1. Backend: `postulaciones.service.js obtenerDetalle` incluye `PostulacionEvento` ordenados
      (las tres ramas) + prueba de que el detalle trae los eventos en orden. De paso, `listarDeEstudiante`
      incluye `Oferta`+`Empresa` (falta si no, "mis postulaciones" no tendría qué mostrar), y se
      encontró y corrigió un alias de Sequelize real (`Postulacion.belongsTo(Oferta)` singularizaba
      mal a "Ofertum") — ver bitácora.
- [x] 2. `cliente.js`: `enviarFormData(ruta, formData)` (multipart, sin `Content-Type` forzado) y
      `descargarArchivo(id)` (blob + `Authorization`, sin exponer el archivo por un `<a>` público)
      + sus pruebas con `fetch` mockeado. `app.js` expone `Content-Disposition` en CORS para que el
      nombre real del archivo llegue al cliente.
- [x] 3. Ampliar el mapa de mensajes de `cliente.js`: `POSTULACION_SIN_CV`,
      `POSTULACION_YA_EXISTE`, `POSTULACION_TRANSICION_INVALIDA`, `ARCHIVO_INVALIDO`
- [x] 4. `assets/js/componentes/proteger-pagina.js`: guardián de sesión + rol, reusado por los tres
      paneles desde ahora. Necesitó `usuarioActual()` en `cliente.js` (decodifica el JWT en memoria
      sin verificar firma, solo para decidir qué mostrar) porque `refrescarSesion()` no devuelve el
      usuario.
- [x] 5. `api/estudiantes.js` (obtenerPerfil, crearPerfil, actualizarPerfil, subirCv) y
      `api/postulaciones.js` (listarMias, obtenerDetalle, postular, retirar)
- [x] 6. `panel-estudiante.html` + su JS: formulario de perfil (crea si 404, edita si existe),
      RUT solo como últimos 4 dígitos, sección de CV (estado, descarga, subida/reemplazo)
- [x] 7. Botón "Postular" en `oferta.html`, condicional a sesión de estudiante + oferta vigente;
      enlace a login si no hay sesión
- [x] 8. `postulaciones.html` + su JS: lista de "mis postulaciones" con estado visible sin abrir
      nada
- [x] 9. `assets/js/componentes/linea-tiempo.js` (función pura: eventos → estructura para pintar)
      + detalle de una postulación con la línea de tiempo completa
- [x] 10. Botón "Retirar" en una postulación no terminal
- [x] 11. Pruebas de las funciones puras (`linea-tiempo.js`, traducción de estado a texto) — 8 pruebas
- [x] 12. Smoke test real con Chrome headless contra la API real (datos inventados, limpiados
      después): perfil, CV, postular, línea de tiempo, retiro. Confirmó el flujo funcional completo
      y, al revisar las capturas, encontró dos bugs visuales reales corregidos de paso: los botones
      usaban el azul de Bootstrap en vez del naranja de marca (el CDN precompilado no consume
      `--bs-primary` a nivel de componente), y `.card` (flex-column en Bootstrap 5) estiraba a sus
      hijos directos al ancho completo — afectaba también a las tarjetas de la vitrina, ya
      corregido en `tarjeta-oferta.js`. Ver bitácora.
- [x] 13. Auditoría de seguridad (`auditor-seguridad`) antes del push — primera vez que el cliente
      sube un archivo autenticado y descarga un binario con sesión. Sin hallazgos Alto/Grave; Media/Baja
      corregidos: línea de tiempo filtraba `motivo`/`actorUsuarioId` a la otra parte (faltaba en el
      include de `obtenerPropiaDeEmpresa`, no solo en el de `conEventos`), nombre de CV sin sanear
      (permitía subir un PDF real nombrado `cv.html`), `subirCv` devolvía `nombreAlmacenado` (UUID
      interno) al cliente, y `refrescarUnaVez` borraba la sesión ante un 429/500 ambiguo, no solo
      ante 401/403. Ver bitácora.
- [x] 14. Documentación: `docs/06-roadmap.md`, `docs/decisiones/bitacora.md`

## Terminado cuando
- [x] Los criterios de aceptación de `spec.md` verificados (automatizados los de funciones puras —
      29 pruebas nuevas de `apps/web`, 402 en `apps/api` — y con Chrome headless contra la API real
      para el resto)
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [x] Roadmap actualizado
