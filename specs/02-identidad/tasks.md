# Tareas · Identidad

- [ ] 1. Instalar `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `nodemailer`; montar `cookie-parser` en `app.js`
- [ ] 2. Migración `usuarios` (con `intentos_fallidos_desde`) + modelo Sequelize `Usuario`
- [ ] 3. Migración `sesiones` + modelo `Sesion`
- [ ] 4. Migración `consentimientos` + modelo `Consentimiento`
- [ ] 5. Migración `tokens_verificacion` + modelo `TokenVerificacion`
- [ ] 6. Agregar `AUTH_CORREO_YA_REGISTRADO` y `AUTH_TOKEN_INVALIDO` al catálogo de errores
- [ ] 7. `services/auth/passwords.js` (hash, comparar, validar fortaleza) + pruebas unitarias
- [ ] 8. `services/auth/tokens.js` (firmar/verificar acceso, generar token de un solo uso) + pruebas
- [ ] 9. `services/auth/intentosLogin.js` (bloqueo temporal con reloj inyectado) + pruebas de la ventana
- [ ] 10. `services/correo/correo.service.js`: SMTP real / Ethereal en desarrollo / log en test
- [ ] 11. `services/auth/auth.service.js`: `registrar` + consentimiento obligatorio + envío de verificación
- [ ] 12. `POST /auth/registro` con validación de esquema (rechaza `rol` fuera de estudiante/empresa)
- [ ] 13. `auth.service.verificarCorreo` + `POST /auth/verificar-correo`
- [ ] 14. `auth.service.login` con intentos fallidos y bloqueo + `POST /auth/login`
- [ ] 15. `middlewares/autenticar.middleware.js` + `middlewares/autorizar.middleware.js`
- [ ] 16. `auth.service.refrescar` con rotación y detección de reuso + `POST /auth/refrescar`
- [ ] 17. `auth.service.logout` + `POST /auth/logout`
- [ ] 18. `auth.service.pedirRecuperacion` / `restablecerClave` + las dos rutas correspondientes
- [ ] 19. Límite de tasa específico (5/15min) en `/auth/login` y `/auth/recuperar-clave`
- [ ] 20. Pruebas de integración: un caso por criterio de aceptación de `spec.md`
- [ ] 21. Prueba de acceso cruzado: token de un rol contra una ruta `autorizar` de otro rol
- [ ] 22. Prueba de reuso de refresco: revoca todas las sesiones de la cuenta

## Terminado cuando
- [ ] Los 16 criterios de aceptación de `spec.md` tienen prueba automatizada y pasan
- [ ] Lista de verificación de seguridad de `docs/03-seguridad.md` revisada
- [ ] Decisiones no obvias anotadas en `docs/decisiones/bitacora.md`
- [ ] `docs/02-modelo-de-datos.md` actualizado con `tokens_verificacion` y `intentos_fallidos_desde`
- [ ] Fase 1 marcada en `docs/06-roadmap.md`
