# Tareas · Identidad

- [x] 1. Instalar `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `nodemailer`; montar `cookie-parser` en `app.js`
- [x] 2. Migración `usuarios` (con `intentos_fallidos_desde`) + modelo Sequelize `Usuario`
- [x] 3. Migración `sesiones` + modelo `Sesion`
- [x] 4. Migración `consentimientos` + modelo `Consentimiento`
- [x] 5. Migración `tokens_verificacion` + modelo `TokenVerificacion`
- [x] 6. Agregar `AUTH_CORREO_YA_REGISTRADO` y `AUTH_TOKEN_INVALIDO` al catálogo de errores
- [x] 7. `services/auth/passwords.js` (hash, comparar, validar fortaleza) + pruebas unitarias
- [x] 8. `services/auth/tokens.js` (firmar/verificar acceso, generar token de un solo uso) + pruebas
- [x] 9. `services/auth/intentosLogin.js` (bloqueo temporal con reloj inyectado) + pruebas de la ventana
- [x] 10. `services/correo/correo.service.js`: SMTP real / Ethereal en desarrollo / log en test
- [x] 11. `services/auth/auth.service.js`: `registrar` + consentimiento obligatorio + envío de verificación
- [x] 12. `POST /auth/registro` con validación de esquema (rechaza `rol` fuera de estudiante/empresa)
- [x] 13. `auth.service.verificarCorreo` + `POST /auth/verificar-correo`
- [x] 14. `auth.service.login` con intentos fallidos y bloqueo + `POST /auth/login`
- [x] 15. `middlewares/autenticar.middleware.js` + `middlewares/autorizar.middleware.js`
- [x] 16. `auth.service.refrescar` con rotación y detección de reuso + `POST /auth/refrescar`
- [x] 17. `auth.service.logout` + `POST /auth/logout`
- [x] 18. `auth.service.pedirRecuperacion` / `restablecerClave` + las dos rutas correspondientes
- [x] 19. Límite de tasa específico (5/15min) en `/auth/login` y `/auth/recuperar-clave`
- [x] 20. Pruebas de integración: un caso por criterio de aceptación de `spec.md`
- [x] 21. Prueba de acceso cruzado: unitaria sobre `autorizar` (no hay ruta de negocio protegida aún
      para probarlo end-to-end; Fase 2 la hereda a nivel de integración)
- [x] 22. Prueba de reuso de refresco: revoca todas las sesiones de la cuenta

## Terminado cuando
- [x] Los 16 criterios de aceptación de `spec.md` tienen prueba automatizada y pasan (42 pruebas, 0 fallas)
- [x] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [x] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [x] `docs/02-modelo-de-datos.md` actualizado con `tokens_verificacion` y `intentos_fallidos_desde`
- [x] Fase 1 marcada en `docs/06-roadmap.md`
