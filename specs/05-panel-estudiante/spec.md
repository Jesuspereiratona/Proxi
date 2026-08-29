# Spec · Panel de estudiante

- **Estado:** aprobada
- **Fecha:** 2026-08-29
- **Fase del roadmap:** Fase 6

## Problema
Un estudiante puede ver la vitrina pública sin sesión, pero no tiene ninguna pantalla para crear
su perfil, subir su CV, postular a una oferta ni ver qué pasó con sus postulaciones. Toda esa
lógica ya existe y está probada en la API (Fases 2 y 4) — falta la única pieza que le falta al
proyecto para que un estudiante real pueda usarlo de punta a punta.

## Quién la usa
Un usuario con sesión iniciada y rol `estudiante`. Sin perfil todavía, sin CV todavía, o con
ambos y varias postulaciones — los tres casos son parte normal del flujo, no casos de error.

## Comportamiento esperado
- Sin perfil creado, la pantalla de perfil muestra un formulario de creación. Con perfil, muestra
  los mismos campos precargados para editar.
- El RUT nunca se vuelve a mostrar descifrado en el cliente (la API no lo permite: solo
  coordinación puede pedirlo descifrado, y por un endpoint aparte). El perfil muestra los últimos
  4 dígitos y un campo vacío para escribir uno nuevo solo si se quiere cambiar.
- El estado del CV es visible siempre: "sin CV todavía" o el nombre del archivo con un botón para
  descargarlo y otro para reemplazarlo. Subir uno nuevo nunca borra el anterior (ya es así en la
  API desde Fase 4) — la pantalla no necesita hacer nada especial por eso, pero tampoco debe
  sugerir que el reemplazo "actualiza" un archivo existente.
- Descargar el propio CV pasa por el mismo control de permiso que ya audita Fase 4
  (`GET /archivos/:id/descarga`), con la sesión — nunca un enlace público al archivo.
- Desde el detalle de una oferta (`oferta.html`, ya público), si hay sesión de estudiante y la
  oferta sigue vigente, aparece un botón "Postular". Sin sesión, aparece un enlace a iniciar sesión
  en su lugar — nunca un botón que falle al hacer clic.
- "Mis postulaciones" lista todas las propias, con el estado actual visible sin abrir nada.
- Cada postulación tiene una línea de tiempo: cada cambio de estado, cuándo, y si lo hizo la
  empresa o el sistema (silencio = `sin_respuesta`, se dice así, no se esconde).
- Una postulación en curso (no terminal) se puede retirar. Una terminal no muestra esa opción.

## Reglas que no se pueden romper
1. Nadie ve el CV de otro estudiante desde esta pantalla — la sesión siempre viaja en la descarga.
2. Ninguna postulación aparece con un estado que no sea el que devuelve la API.
3. El botón "Postular" nunca se ofrece sobre una oferta que la API ya no considera vigente.
4. La contraseña y el token de sesión siguen las mismas reglas que `login.html` — ya establecidas,
   esta pantalla no introduce una excepción.

## Casos borde
- Sin perfil y sin CV, intenta postular → la API responde `POSTULACION_SIN_CV`; el mensaje que ve
  la persona dice qué falta y cómo resolverlo (subir el CV), no el código.
- Ya postuló a esa oferta → `POSTULACION_YA_EXISTE`, mensaje humano, el botón no debería ni
  aparecer si "mis postulaciones" ya la tiene, pero la pantalla también se defiende de la carrera
  (dos pestañas, doble clic).
- El archivo elegido para el CV no es un PDF real → mismo `ARCHIVO_INVALIDO` que ya prueba Fase 4,
  traducido.
- Sesión vencida a mitad de cualquiera de estas acciones → el cliente ya sabe reintentar una vez
  (Fase 6, sesión); si de verdad se acabó, vuelve a `login.html`.

## Criterios de aceptación
- [ ] Dado un estudiante sin perfil, cuando entra a la pantalla de perfil, entonces ve el
      formulario de creación, no uno de edición vacío.
- [ ] Dado un estudiante con perfil, cuando entra a la pantalla, entonces ve sus datos precargados
      y el RUT solo como últimos 4 dígitos.
- [ ] Dado un estudiante sin CV, cuando ve su perfil, entonces dice explícitamente que no tiene CV
      todavía.
- [ ] Dado un estudiante con CV, cuando hace clic en descargarlo, entonces lo recibe (y no un
      estudiante distinto pidiendo el mismo id de archivo).
- [ ] Dado un PDF real seleccionado, cuando se sube, entonces reemplaza el CV vigente sin errores.
- [ ] Dado un archivo que no es un PDF real, cuando se intenta subir, entonces se rechaza con un
      mensaje humano.
- [ ] Dado un estudiante con sesión y una oferta vigente, cuando ve su detalle, entonces existe un
      botón "Postular" que la envía.
- [ ] Dado un visitante sin sesión, cuando ve el detalle de una oferta, entonces no ve el botón
      "Postular", ve un enlace a iniciar sesión.
- [ ] Dado un estudiante que ya postuló a una oferta, cuando la vuelve a intentar, entonces recibe
      un mensaje humano de "ya postulaste", no el código interno.
- [ ] Dado un estudiante con postulaciones en distintos estados, cuando abre "mis postulaciones",
      entonces cada una muestra su estado actual sin necesidad de abrir el detalle.
- [ ] Dado el detalle de una postulación, cuando se abre, entonces se ve la línea de tiempo
      completa con fecha y quién la movió (o "sin respuesta" cuando corresponde).
- [ ] Dado una postulación no terminal, cuando el estudiante la retira, entonces desaparece la
      opción de retirar y el estado pasa a `retirada`.

## Fuera de alcance
- Paneles de empresa y coordinación — siguen después de este.
- Notificaciones (correo, push) de cambios de estado.
- Editar o eliminar una postulación ya enviada, más allá de retirarla.
