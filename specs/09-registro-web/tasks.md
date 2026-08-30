# Tareas · Registro web

- [x] 1. `politica-privacidad.html` — borrador versionado, claramente marcado como sujeto a revisión
      legal.
- [x] 2. `api/auth.js` (nuevo): `registrar`, `verificarCorreo`. Mensajes nuevos en `cliente.js`.
- [x] 3. `registro.html` + su JS: formulario con validación en el cliente (contraseñas coinciden,
      mínimo 12 caracteres, política marcada), rol limitado a estudiante/empresa.
- [x] 4. `verificar-correo.html` + su JS: verifica automáticamente al cargar con el `?token=` de la
      URL.
- [x] 5. Enlace "¿No tienes cuenta? Regístrate" en `login.html`.
- [x] 6. Smoke test con Chrome headless contra la API real, correo de Ethereal incluido.
- [x] 7. Auditoría de seguridad (`auditor-seguridad`) antes del push — es la primera pantalla pública
      que crea cuentas nuevas sin sesión previa. Encontró un hallazgo Grave (cookie `csrf` con path
      equivocado, ver bitácora) y cuatro menores, todos corregidos y probados antes de este commit.
- [x] 8. Documentación: `docs/06-roadmap.md`, `docs/decisiones/bitacora.md`.

## Terminado cuando
- [x] Criterios de aceptación de `spec.md` verificados.
- [x] Lista de verificación de seguridad revisada.
- [x] Roadmap y bitácora actualizados.
