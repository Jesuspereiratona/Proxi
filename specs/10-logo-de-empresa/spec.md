# Spec · Logo de empresa

- **Estado:** borrador
- **Fecha:** 2026-09-20
- **Fase del roadmap:** 6 (cliente web), pendiente desde la revisión visual del 2026-09-20

## Problema

La vitrina muestra una fila por oferta con una ranura cuadrada a la izquierda donde debería ir el
logo de la empresa. Hoy esa ranura muestra la inicial de la razón social en gris, porque no existe
forma de subir un logo. El resultado es una lista de cuadrados grises iguales: no se distingue una
empresa de otra al escanear, y la página se ve a medio terminar comparada con cualquier bolsa de
trabajo real.

Para la empresa hay un problema aparte: publica una oferta y aparece sin identidad visual, igual que
todas. Es la primera cosa que una empresa nota que "le falta" a la plataforma.

## Quién la usa

- **Empresa**, desde "Mi empresa": sube o reemplaza su logo cuando quiera.
- **Coordinación**, desde su panel: aprueba o quita un logo. Es la misma persona que ya revisa el
  perfil de la empresa antes de validarla.
- **Cualquier visitante**, sin sesión: ve el logo en la vitrina, en el detalle de una oferta y en el
  perfil público de la empresa.

## Comportamiento esperado

Una empresa sube una imagen desde su panel. Queda guardada de inmediato y ella la ve en su propio
panel, pero **el público todavía no**: hasta que coordinación la apruebe, la vitrina sigue mostrando
la inicial. Coordinación ve los logos pendientes en su panel y los aprueba de a uno.

Aprobar o rechazar un logo **no cambia el estado de validación de la empresa ni toca sus ofertas**.
Es una decisión sobre una imagen, no sobre la empresa.

Una empresa tiene, a lo más, un logo vigente. Subir uno nuevo reemplaza al anterior y vuelve a dejarlo
pendiente de aprobación; mientras tanto el público sigue viendo el logo anterior si había uno
aprobado, y la inicial si no.

Coordinación puede quitar un logo ya aprobado en cualquier momento. Al quitarlo, el público vuelve a
ver la inicial.

## Reglas que no se pueden romper

1. **Un logo sin aprobar nunca se muestra en público.** La vitrina, el detalle de oferta y el perfil
   público muestran la inicial hasta que coordinación apruebe.
2. **Solo se aceptan PNG, JPEG y WebP, verificados por el contenido real del archivo**, no por su
   extensión ni por el tipo que declara el navegador. **SVG se rechaza siempre**: un SVG es un
   documento que puede contener JavaScript, y servirlo desde nuestro dominio es XSS almacenado en la
   página más pública del sitio.
3. **Una empresa solo puede subir el logo de su propia empresa.** No existe forma de subir el logo de
   otra, ni siquiera conociendo su id.
4. **El logo de una empresa que no está validada no se sirve en público**, igual que su perfil: una
   empresa pendiente, rechazada o suspendida responde como si no existiera.
5. **El nombre de archivo que manda el navegador nunca se usa como ruta.** Se guarda para mostrarlo y
   nada más, igual que ya ocurre con el CV.
6. **Un logo pesa como máximo 512 KB.** Es una imagen de 200×200 en una fila de listado, no una foto.
7. **Quitar un logo no borra el registro de que existió.** Coordinación debe poder saber que una
   empresa tuvo un logo que fue retirado.

## Casos borde

- **La empresa sube un archivo que no es imagen** (un PDF renombrado a `.png`, un ejecutable): se
  rechaza por contenido, con un mensaje que dice qué formatos se aceptan.
- **Sube un SVG**: se rechaza explícitamente, aunque sea una imagen válida.
- **Sube dos veces seguidas**: el segundo reemplaza al primero. No quedan dos logos vigentes.
- **Sube un logo nuevo teniendo uno ya aprobado**: el público sigue viendo el aprobado hasta que
  coordinación apruebe el nuevo. No hay un intervalo en que la empresa quede sin logo por haber
  intentado mejorarlo.
- **Coordinación aprueba y la empresa sube otro en el mismo segundo**: el logo que queda aprobado es
  exactamente el que coordinación vio, nunca uno que llegó después.
- **La empresa se suspende teniendo logo aprobado**: deja de verse en público, junto con su perfil.
- **La empresa borra su cuenta**: el logo se borra con ella, sin quedar huérfano.
- **Una oferta de una empresa sin logo**: se ve la inicial, exactamente como hoy. Nada se rompe.

## Criterios de aceptación

- [ ] Dado un usuario empresa con perfil, cuando sube un PNG válido de menos de 512 KB, entonces la
      respuesta es 201 y el logo queda registrado como pendiente de aprobación.
- [ ] Dado un logo recién subido y no aprobado, cuando cualquiera pide el listado público de ofertas
      de esa empresa, entonces la respuesta no incluye una URL de logo.
- [ ] Dado un logo aprobado por coordinación, cuando cualquiera sin sesión pide esa URL de logo,
      entonces recibe 200 con `Content-Type: image/png` y los bytes exactos que se subieron.
- [ ] Dado un archivo SVG válido, cuando una empresa intenta subirlo como logo, entonces la respuesta
      es 422 y no se guarda nada.
- [ ] Dado un PDF renombrado a `.png`, cuando una empresa intenta subirlo, entonces la respuesta es
      422 y no se guarda nada.
- [ ] Dado un archivo de más de 512 KB, cuando una empresa intenta subirlo, entonces la respuesta es
      422 y no se guarda nada.
- [ ] Dado un usuario estudiante, cuando intenta subir un logo, entonces recibe 403.
- [ ] Dada la empresa A con logo aprobado, cuando la empresa B intenta reemplazarlo o quitarlo,
      entonces recibe 403 o 404 y el logo de A queda intacto.
- [ ] Dada una empresa en estado `pendiente` con logo aprobado, cuando alguien sin sesión pide ese
      logo, entonces recibe 404, igual que al pedir su perfil.
- [ ] Dada una empresa con logo aprobado, cuando sube uno nuevo, entonces el público sigue viendo el
      anterior hasta que coordinación apruebe el nuevo.
- [ ] Dada una empresa validada con logo aprobado, cuando sube un logo nuevo, entonces su estado de
      validación sigue siendo `validada` y sus ofertas publicadas siguen publicadas.
- [ ] Dado un usuario empresa, cuando intenta aprobar su propio logo, entonces recibe 403.
- [ ] Dado un logo aprobado, cuando coordinación lo quita, entonces deja de servirse en público y
      queda registro de que existió.
- [ ] Dada una empresa con logo, cuando su cuenta se elimina, entonces el logo deja de servirse y no
      queda un archivo huérfano.

## Fuera de alcance

- **Recorte, redimensionado o compresión en el servidor.** La imagen se guarda tal como llega. Si una
  empresa sube algo desproporcionado, el CSS lo encuadra; no procesamos imágenes.
- **Foto de perfil del estudiante.** Los estudiantes no tienen foto y no la van a tener en esta
  versión: es un dato personal más que no aporta a postular, y minimizar datos es una regla del
  proyecto.
- **Histórico de logos anteriores.** Se conserva el registro de que un logo fue retirado, no una
  galería de todos los que tuvo.
- **Logo en los correos transaccionales.** Los correos siguen siendo de texto plano.
- **CDN o almacenamiento externo.** El logo se guarda en la base, junto al resto (ver `plan.md`).
