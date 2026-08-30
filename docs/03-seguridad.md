# 03 · Seguridad

Este proyecto guarda currículums, RUT y correos de estudiantes. No es una app de notas: una filtración
tiene consecuencias reales para personas y consecuencias legales para la facultad. La seguridad se
diseña ahora, no se parcha después.

## Qué estamos protegiendo
| Activo | Sensibilidad | Riesgo si se filtra |
|---|---|---|
| CV de estudiantes | Alta | Datos personales completos: RUT, dirección, teléfono, historial |
| RUT | Alta | Suplantación de identidad |
| Correos institucionales | Media | Phishing dirigido a la comunidad |
| Credenciales | Crítica | Toma de cuentas, publicación fraudulenta |
| Ofertas y postulaciones | Media | Información de gestión de la facultad |

## Modelo de amenazas — las cinco que importan aquí

### 1. Acceso a datos ajenos por manipular un id (IDOR)
**El riesgo número uno de este proyecto.** Un estudiante cambia `/api/v1/postulaciones/41` por `/42` y
ve la postulación de otro. Una empresa pide `/api/v1/ofertas/99/postulaciones` de una oferta que no es
suya y accede a CVs completos.

**Defensa:** autorización en dos niveles, siempre las dos.
- *Rol*: middleware `autorizar('empresa')` — ¿este tipo de usuario puede usar esta ruta?
- *Pertenencia*: el servicio verifica que el recurso pertenezca a quien lo pide, **dentro de la misma
  consulta**, no con un `if` posterior:
  ```js
  // mal: dos pasos, y el findByPk ya trajo datos ajenos a memoria
  const oferta = await Oferta.findByPk(id);
  if (oferta.empresaId !== usuario.empresaId) throw new NoAutorizado();

  // bien: la pertenencia es parte de la consulta
  const oferta = await Oferta.findOne({ where: { id, empresaId: usuario.empresaId } });
  if (!oferta) throw new NoEncontrado('OFERTA_NO_ENCONTRADA');
  ```
  Devolver 404 en vez de 403 evita confirmarle a un atacante que el recurso existe.

**Toda ruta que reciba un id lleva una prueba automatizada que intenta acceder con otro usuario y
espera 404.** Sin esa prueba, la ruta no se da por terminada.

### 2. Robo o falsificación de sesión
**Defensa:**
- Token de acceso JWT de vida corta (15 min), firmado con HS256 y secreto de 48 bytes aleatorios.
- Token de refresco de 7 días, **rotativo**: cada uso emite uno nuevo e invalida el anterior. Si un
  token de refresco ya usado reaparece, se revoca la sesión completa: es señal de robo.
- El refresco viaja en cookie `httpOnly`, `secure`, `sameSite=strict`. Nunca en `localStorage`, que es
  legible por cualquier script inyectado.
- En la base se guarda el **hash** del token de refresco, no el token.
- El JWT lleva solo `sub`, `rol` y `exp`. Nunca el correo, el nombre ni el RUT: un JWT es legible por
  cualquiera que lo tenga.
- Cierre de sesión revoca la fila en `sesiones`. Un JWT no se puede "apagar", por eso el refresco es
  el que manda.

### 3. Entradas maliciosas: inyección SQL y XSS
**Defensa:**
- Sequelize con parámetros siempre. Se prohíbe construir SQL concatenando texto. Si hace falta SQL
  crudo, va con `replacements`, nunca con plantillas de cadena.
- Validación de **toda** entrada en el borde con un esquema declarado (`express-validator` o `zod`)
  antes de llegar al controller. Lista blanca: lo que no está declarado se descarta, no se ignora.
- En el cliente, el contenido que viene del servidor se inserta con `textContent`, nunca con
  `innerHTML`. Un `innerHTML` con la descripción de una oferta es un XSS almacenado esperando ocurrir.
- Cabeceras con `helmet`, incluida una CSP que no permita scripts en línea.

### 4. Subida de archivos
El CV es un archivo que un desconocido sube a nuestro servidor. Tratarlo como hostil.
- Solo PDF. Se valida el **contenido real** (número mágico `%PDF-`), no la extensión ni el
  `Content-Type`, que el cliente controla.
- Máximo 5 MB, tope también en el servidor web.
- Se almacena con nombre UUID, fuera de la carpeta pública. El nombre original solo se muestra.
- Se sirve por un endpoint que verifica permiso, con `Content-Disposition: attachment` y
  `X-Content-Type-Options: nosniff`. Jamás una carpeta estática abierta.
- Antivirus queda fuera del alcance v1; se documenta como riesgo aceptado en `docs/adr/`.

### 5. Abuso automatizado
- Límite de tasa global y uno más estricto en `/auth/login` (5 intentos por 15 minutos por IP+correo)
  y en `/auth/recuperar-clave`.
- Bloqueo temporal de la cuenta tras intentos fallidos consecutivos.
- Registro público de empresas **no** habilita para publicar: requiere validación humana de
  coordinación. Ese paso corta el spam y las ofertas fraudulentas, que son un problema real en portales
  de empleo dirigidos a jóvenes.
- Respuestas idénticas en "correo no existe" y "contraseña incorrecta": no se enumeran usuarios.

## Contraseñas
bcrypt con costo 12 como mínimo. Largo mínimo 12 caracteres, sin reglas de composición absurdas.
Se compara con `bcrypt.compare`, jamás con `===`. Al restablecer, el token es de un solo uso, expira en
1 hora y se guarda hasheado.

## Ley 21.719 — obligaciones concretas
Vigente desde el **1 de diciembre de 2026**. Aplica de lleno: tratamos datos personales de estudiantes.

| Obligación | Cómo se implementa |
|---|---|
| Base legal y consentimiento | Tabla `consentimientos` con versión de la política. Sin fila vigente, no se tratan datos. Casilla no premarcada |
| Finalidad y minimización | Solo se pide lo necesario para postular. Nada de fecha de nacimiento, foto ni estado civil |
| Acceso y portabilidad | `GET /api/v1/mi-cuenta/datos` exporta todo en JSON |
| Rectificación | El estudiante edita su perfil |
| Supresión | `DELETE /api/v1/mi-cuenta`: borra CV del disco, anonimiza postulaciones (se conserva el evento estadístico sin identidad) |
| Seguridad proporcional | Cifrado en tránsito (TLS), RUT cifrado en reposo, control de acceso por rol y pertenencia, respaldos verificados |
| Registro de accesos | Tabla `auditoria_accesos`: cada vez que alguien descarga un CV o ve datos de un estudiante |
| Notificación de brechas | Procedimiento escrito en `07-operacion-y-mantenimiento.md`. Plazo: 72 horas a la Agencia y a los afectados |
| Retención | CV y perfil se eliminan tras `RETENCION_CV_MESES` sin actividad, con aviso previo por correo |

Las sanciones llegan a 20.000 UTM en infracciones gravísimas. Esto no es un adorno del proyecto.

## Secretos
Nunca en el repositorio. `.env` está en `.gitignore`; `.env.example` documenta las claves con valores
vacíos. Los secretos de producción viven en el proveedor de hosting. Si un secreto se filtra alguna
vez, se rota **y** se registra en la bitácora.

## Las capas de defensa, y qué atrapa cada una

Ninguna capa sirve sola. La gracia es que fallen en momentos distintos: lo que se le escapa a una,
la siguiente lo ve.

| Capa | Cuándo actúa | Qué atrapa | Qué NO atrapa |
|---|---|---|---|
| Este documento | Al diseñar | Decisiones inseguras antes de escribirlas | Errores de implementación |
| Skill `nuevo-endpoint` | Al escribir | Ruta sin validación, sin permisos, sin prueba de acceso cruzado | Fallas entre piezas |
| Pruebas automatizadas | En cada push | Regresiones: un agujero que ya cerramos y se reabrió | Agujeros que nunca probamos |
| **CodeQL** | En cada push, automático | Patrones inseguros conocidos: inyección, datos que fluyen de la petición a una consulta | Fallas de lógica de negocio |
| **gitleaks** | En cada push, sobre el historial completo | Secretos escritos en el código, hoy o hace tres meses | Secretos que nunca entraron a git |
| **Dependabot** | Semanal | Dependencias con vulnerabilidades publicadas | Vulnerabilidades sin publicar |
| Agente `auditor-seguridad` | A pedido, antes de fusionar | Lo que exige entender la intención del código | Lo que solo se ve ejecutando |
| Agente `pentester-api` | A pedido, al cerrar una fase | Controles que existen en el código pero no funcionan en ejecución | Lo que no se le ocurrió probar |

Las cuatro automáticas no dependen de que nadie se acuerde. Las dos de agente sí, y por eso están en
la lista de abajo.

**Lo que ninguna capa cubre:** un diseño equivocado. Si decidimos que coordinación puede ver todos los
CV sin dejar registro, ninguna herramienta lo va a marcar — hace exactamente lo que le pedimos. Por eso
las decisiones de permisos se escriben en la spec antes de implementarse.

## Lista de verificación antes de fusionar una rama
- [ ] Toda entrada del usuario pasa por un esquema de validación
- [ ] Toda ruta con `:id` verifica pertenencia dentro de la consulta
- [ ] Hay una prueba que intenta acceder con otro usuario y espera 404
- [ ] Ningún dato personal aparece en los logs
- [ ] Ningún secreto quedó escrito en el código
- [ ] Los errores no exponen stack ni detalles internos en producción
- [ ] `npm audit` sin vulnerabilidades altas o críticas
- [ ] CodeQL y gitleaks en verde en el workflow `Seguridad`
- [ ] Al cerrar una fase: `auditor-seguridad` (código) y `pentester-api` (ejecución) pasados, y los
      ataques que funcionaron convertidos en pruebas automatizadas
