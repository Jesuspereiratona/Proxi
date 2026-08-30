# Plan técnico · Registro web

## Backend: nada nuevo
`POST /auth/registro` y `POST /auth/verificar-correo` ya existen y están probados desde Fase 1. Cero
cambios de API.

## Archivos nuevos
```
apps/web/
├── registro.html
├── verificar-correo.html
├── politica-privacidad.html      borrador versionado, enlazado desde registro.html
├── assets/js/
│   ├── api/auth.js                registrar(datos), verificarCorreo(token) — nuevo, un archivo
│   │                               por recurso, hoy sesion.js solo cubre login/logout/refrescar
│   ├── paginas/registro.js
│   └── paginas/verificar-correo.js
```

`POLITICA_VERSION` (una constante, `'2026-08-30-borrador'`) vive en `politica-privacidad.html` como
texto visible y se importa como literal en `registro.js` — no hay endpoint que la sirva, es un
identificador de documento, no un dato de la API.

## `registro.js`
- Valida en el cliente antes de enviar: contraseña ≥ 12 caracteres (mismo mínimo que
  `passwords.js LARGO_MINIMO`, duplicado como constante local con un comentario que apunte a la
  fuente — no hay forma de importarlo del backend sin un paquete compartido nuevo, y no vale la pena
  uno para un solo número), las dos contraseñas coinciden, la casilla de política está marcada.
- Rol: `<select>` con solo `estudiante`/`empresa` — nunca `coordinacion` como opción.
- Éxito: oculta el formulario, muestra "revisa tu correo para verificar tu cuenta antes de iniciar
  sesión" — no redirige a `login.html` solo, porque el login fallaría con `AUTH_EMAIL_NO_VERIFICADO`
  hasta que la persona verifique.

## `verificar-correo.js`
- Lee `token` de `URLSearchParams` al cargar, llama de inmediato — sin botón, sin que la persona
  haga nada (es un enlace de correo, ya "hizo clic").
- Éxito → mensaje + enlace a `login.html`. Error → mensaje humano específico para este contexto
  (`AUTH_TOKEN_INVALIDO`/`AUTH_TOKEN_EXPIRADO`), no reutiliza literalmente el texto de sesión de
  `cliente.js` MENSAJES (ahí dice "tu sesión expiró", que no aplica a un enlace de verificación que
  nunca inició una sesión) — mensaje propio en la página, mismo patrón que ya usa `oferta.js` para
  textos que no encajan en el mapa genérico.

## Mensajes nuevos en `cliente.js`
`AUTH_CORREO_YA_REGISTRADO`, `CONSENTIMIENTO_REQUERIDO` — ya existen en el catálogo de la API desde
Fase 1, nadie los había traducido porque no había ninguna pantalla que pudiera provocarlos.

## Pruebas
- Sin funciones puras nuevas que valga la pena aislar (es formulario + llamada a la API, mismo
  criterio que `login.js`, que tampoco tiene pruebas propias — se verifica con el smoke test).
- Smoke test con Chrome headless contra la API real: registrar una cuenta de prueba, tomar el token
  de verificación real del correo (Ethereal en desarrollo, ver el enlace en el log), verificar,
  iniciar sesión. Datos inventados, limpiados después.

## Riesgos
Ninguno de permisos nuevos — son las mismas dos rutas públicas que Fase 1 ya audita. El único
matiz de seguridad real es la política de privacidad "borrador": tiene que decir clarísimo que no es
el texto final, para no dar una falsa sensación de cumplimiento legal completo.
