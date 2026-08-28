---
name: revision-seguridad
description: Revisión de seguridad de Proxi antes de fusionar una rama o desplegar. Úsala cuando el usuario pida revisar código, hacer un repaso antes de subir cambios, o cuando el cambio toque autenticación, permisos, subida o descarga de archivos, consultas a la base, datos personales de estudiantes o variables de entorno.
---

# Revisión de seguridad

Este sistema guarda currículums, RUT y correos de estudiantes. Una filtración tiene consecuencias
reales para personas y consecuencias legales bajo la Ley 21.719, vigente desde el 1 de diciembre de
2026. Revisar no es trámite.

Contexto completo en `docs/03-seguridad.md`. Esta skill es el procedimiento de revisión.

## Cómo revisar
Lee el diff completo antes de opinar. Para cada hallazgo di **qué** está mal, **cómo se explota** y
**cuál es el arreglo concreto**. Un hallazgo sin escenario de explotación suele ser ruido; si no
puedes describir cómo alguien lo aprovecha, dilo en vez de inflar la lista.

Ordena por gravedad real. Tres hallazgos ciertos valen más que quince genéricos.

## Qué buscar, en orden de importancia

**1. Acceso a datos ajenos (IDOR).** El riesgo principal aquí.
Busca cada ruta con `:id`. ¿La pertenencia está dentro del `where` o es un `if` después de traer el
registro? ¿Devuelve 404 y no 403? ¿Existe la prueba de acceso cruzado? Un `findByPk(req.params.id)`
seguido de una comprobación es una señal de alarma inmediata.

**2. Autorización ausente o floja.** ¿La ruta tiene `autenticar` y `autorizar(rol)`? ¿El rol se lee del
token verificado y no de algo que mandó el cliente (`req.body.rol`, un encabezado, una cookie sin
firmar)? ¿Hay rutas nuevas que quedaron públicas sin querer?

**3. Entradas sin validar.** ¿Todo lo que llega —cuerpo, parámetros de ruta, cadena de consulta— pasa
por un esquema? ¿Se arma SQL concatenando texto? ¿Se pasa a Sequelize un objeto del usuario tal cual
(riesgo de inyección de operadores)? ¿Se usa `innerHTML` con contenido del servidor en el cliente?

**4. Archivos.** ¿Se valida el contenido real del PDF y no la extensión ni el `Content-Type`? ¿El
nombre en disco es un UUID generado por nosotros? ¿Está fuera de la carpeta pública? ¿La descarga
verifica permiso y queda registrada en `auditoria_accesos`?

**5. Secretos y datos en logs.** ¿Quedó una clave, un token o una URL de base de datos escrita en el
código? ¿Algún `console.log` o `log.info` imprime el cuerpo completo de una petición, un correo, un
RUT o el contenido de un CV? Un log con datos personales es una filtración con retardo.

**6. Sesiones.** ¿El token de refresco rota al usarse? ¿Se guarda hasheado? ¿El JWT lleva solo `sub`,
`rol` y `exp`, sin correo ni nombre? ¿El cierre de sesión revoca la fila en `sesiones`?

**7. Fuga por respuesta.** ¿La respuesta incluye `password_hash`, `rut_cifrado`, rutas de disco,
identificadores internos o el stack en producción? Revisa qué devuelve el modelo cuando se serializa
completo: es la filtración más fácil de cometer y la más fácil de no ver.

## Formato del informe
```
## Hallazgos

### 1. [Grave] Cualquier empresa puede leer los postulantes de otra
Archivo: apps/api/src/services/postulaciones.service.js:47
Explotación: una empresa autenticada pide GET /ofertas/99/postulaciones de una oferta ajena y recibe
los CVs completos. El servicio filtra por ofertaId pero nunca comprueba que la oferta sea suya.
Arreglo: incluir empresaId en la consulta de la oferta y devolver 404 si no hay resultado.
Falta además la prueba de acceso cruzado exigida por docs/03-seguridad.md.
```

Si no encuentras nada relevante, dilo claramente y menciona qué revisaste. Inventar hallazgos para
parecer útil hace que la próxima revisión no se lea.
