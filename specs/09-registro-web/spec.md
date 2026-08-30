# Spec · Registro web (crear cuenta, verificar correo)

- **Estado:** aprobada
- **Fecha:** 2026-08-30
- **Fase del roadmap:** Fase 6 (cliente web) — pieza que quedó pendiente

## Problema
`POST /auth/registro` y `POST /auth/verificar-correo` existen y están probados desde Fase 1, pero
`apps/web` nunca tuvo una pantalla para usarlos — la única forma de crear una cuenta hoy es `curl`
o el seed de desarrollo. Sin esto, ningún estudiante o empresa real puede empezar a usar Proxi solo.

## Alcance
Dos pantallas nuevas (`registro.html`, `verificar-correo.html`) y una tercera de apoyo
(`politica-privacidad.html`) que el registro necesita para el consentimiento explícito que exige la
Ley 21.719 (`docs/03-seguridad.md`). Recuperación de contraseña (`recuperar-clave`,
`restablecer-clave`) queda fuera — mismo patrón, otro incremento.

## Comportamiento esperado
- `registro.html`: formulario con correo, contraseña (con su confirmación), rol
  (`estudiante`/`empresa` — nunca `coordinacion`, esa cuenta no se autorregistra), y una casilla de
  aceptar la política de privacidad **no premarcada**, con enlace a `politica-privacidad.html`. Al
  enviar, llama a `POST /auth/registro` con `versionPolitica` fija al identificador de la política
  vigente.
- Éxito: mensaje explícito de "revisa tu correo para verificar la cuenta", sin iniciar sesión
  automáticamente (el backend exige `estado:'activo'`, que solo llega verificando el correo).
- `verificar-correo.html`: lee `?token=` de la URL al cargar, llama a `POST /auth/verificar-correo`
  sin que la persona haga nada más. Éxito: mensaje de confirmación + enlace a `login.html`. Token
  inválido o vencido: mensaje humano, sin redirigir sin que la persona lo decida.
- `login.html` gana un enlace a `registro.html` ("¿No tienes cuenta? Regístrate") — hoy no existe
  ninguna forma de llegar a la pantalla de registro desde la web.
- `politica-privacidad.html`: página de apoyo, marcada explícitamente como **borrador sujeto a
  revisión legal** (`docs/06-roadmap.md` ya lo advierte para toda Fase 7 legal) — no reemplaza el
  documento final que alguien con formación legal de la facultad tiene que redactar. Sirve para que
  el registro tenga algo real y versionado a qué apuntar, no un enlace roto.

## Reglas que no se pueden romper
1. La casilla de aceptar la política nunca viene premarcada (`docs/03-seguridad.md`: "casilla no
   premarcada").
2. El rol de coordinación nunca aparece como opción de autorregistro — esas cuentas las crea alguien
   con acceso directo a la base, no un formulario público.
3. Un registro exitoso nunca deja al usuario con una sesión iniciada antes de verificar su correo:
   el backend ya lo bloquea (`AUTH_EMAIL_NO_VERIFICADO`), la pantalla no intenta rodearlo.
4. Los mismos mensajes de error humanos que ya usa el resto del cliente (`cliente.js`), nunca el
   código crudo (`AUTH_CORREO_YA_REGISTRADO`, `CONSENTIMIENTO_REQUERIDO`, etc.).

## Casos borde
- Correo ya registrado → mensaje humano, no confirma si la cuenta existía antes o no en términos que
  ayuden a enumerar usuarios (el código ya es específico, `AUTH_CORREO_YA_REGISTRADO`, pero eso es
  aceptable acá: a diferencia del login, en el registro confirmar que un correo ya existe es
  información que la propia persona ya tiene motivo para saber — está tratando de crear esa cuenta).
- Contraseñas que no coinciden → se valida en el cliente antes de enviar, mensaje inmediato.
- Token de verificación ya usado o vencido → mensaje humano con opción de pedir uno nuevo quedaría
  bien, pero no hay endpoint de reenvío todavía (fuera de alcance); el mensaje explica que debe
  volver a registrarse o contactar a coordinación.
- La casilla de política sin marcar → el formulario no se envía, mensaje inline, no un 422 del
  servidor para algo que se puede atajar antes.

## Criterios de aceptación
- [ ] Dado un correo nuevo válido con contraseña de al menos 12 caracteres, cuando se registra como
      estudiante o empresa, entonces recibe 201 y un mensaje de "revisa tu correo".
- [ ] Dado un registro sin marcar la política, cuando se intenta enviar, entonces el formulario lo
      impide antes de llegar al servidor.
- [ ] Dado un correo ya registrado, cuando se intenta registrar de nuevo, entonces se ve un mensaje
      humano, no el código crudo.
- [ ] Dado el enlace de verificación real que manda el correo, cuando se abre, entonces la cuenta
      queda activa sin que la persona haga nada más que abrir el enlace.
- [ ] Dado un token de verificación vencido o inválido, cuando se abre el enlace, entonces se ve un
      mensaje humano explicando qué pasó.
- [ ] Dado `login.html`, cuando se abre, entonces hay un enlace visible a `registro.html`.

## Fuera de alcance
- Recuperación de contraseña (`recuperar-clave.html`, `restablecer-clave.html`) — mismo patrón,
  queda para un incremento aparte.
- Reenvío de correo de verificación.
- El texto final de la política de privacidad — eso es Fase 7 legal, no código.
