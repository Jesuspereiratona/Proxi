# Registro de actividades de tratamiento

- **Versión:** `2026-08-30`
- **Responsable del tratamiento:** Facultad de Economía y Negocios, Universidad Alberto Hurtado
  *(entidad exacta pendiente — ver `00-que-debe-revisar-un-abogado.md`, punto 1)*

La Ley 21.719 impone **responsabilidad proactiva**: hay que poder demostrar en cualquier momento que
se cumple. Este registro es esa demostración. Está levantado desde el código, no desde una plantilla:
cada fila corresponde a tablas y endpoints que existen.

Se actualiza cada vez que se agrega un dato, una finalidad o un destinatario. Si el código cambia y
este documento no, el registro miente — y un registro que miente es peor que no tenerlo.

## Titulares
| Grupo | Aproximado | Menores de edad |
|---|---|---|
| Estudiantes de la Facultad | cientos | **Posible — sin determinar.** Ver punto 4 del documento del abogado |
| Personas de contacto de empresas | decenas | No |
| Personal de coordinación | pocas | No |

## Actividades

### A1 · Cuenta y autenticación
| | |
|---|---|
| **Datos** | Correo, contraseña cifrada (bcrypt costo 12), rol, estado, fecha de último acceso, intentos fallidos |
| **Finalidad** | Permitir el acceso a la plataforma e impedir accesos no autorizados |
| **Base de licitud propuesta** | Ejecución del contrato — los términos de uso aceptados al registrarse |
| **Conservación** | Mientras la cuenta exista. Se elimina con la cuenta |
| **Destinatarios** | Nadie fuera de la plataforma |
| **Dónde vive** | Tabla `usuarios` |

### A2 · Sesiones
| | |
|---|---|
| **Datos** | Hash del token de refresco, IP, agente de usuario, fechas de expiración y revocación |
| **Finalidad** | Mantener la sesión y **detectar el robo de credenciales** (reuso de un token ya rotado) |
| **Base de licitud propuesta** | Interés legítimo — seguridad de las cuentas |
| **Conservación** | Hasta la expiración o revocación |
| **Dónde vive** | Tabla `sesiones` |

### A3 · Perfil de estudiante
| | |
|---|---|
| **Datos** | Nombres, apellidos, **RUT (cifrado)**, carrera, nivel cursado, teléfono (opcional) |
| **Finalidad** | Identificar al estudiante ante la empresa a la que postula y ante la coordinación |
| **Base de licitud propuesta** | Consentimiento — **la del RUT está en discusión**, ver punto 2 del abogado |
| **Conservación** | Mientras la cuenta esté activa; se elimina tras 12 meses de inactividad, con aviso 30 días antes |
| **Destinatarios** | La empresa dueña de la oferta a la que el estudiante postuló, y la coordinación |
| **Dónde vive** | Tabla `estudiantes`. El RUT cifrado con pgcrypto |

### A4 · Currículum
| | |
|---|---|
| **Datos** | Archivo PDF con todo lo que el estudiante decida incluir |
| **Finalidad** | Que la empresa evalúe la postulación |
| **Base de licitud propuesta** | Consentimiento |
| **Conservación** | Igual que el perfil. Se borra **del disco**, no solo de la base, al eliminar la cuenta |
| **Destinatarios** | Solo la empresa dueña de la oferta a la que postuló. **Cada descarga queda registrada** |
| **Riesgo particular** | Es el dato más sensible del sistema: un CV contiene dirección, teléfono, historial completo. La minimización no aplica porque el contenido lo decide el titular |

### A5 · Perfil de empresa
| | |
|---|---|
| **Datos** | Razón social, RUT de la empresa, giro, sitio, comuna, nombre y cargo del contacto |
| **Finalidad** | Validar que la empresa es real antes de dejarla publicar |
| **Base de licitud propuesta** | Ejecución del contrato. El RUT de una empresa **no es dato personal**; el nombre y cargo del contacto sí |
| **Conservación** | Mientras la cuenta exista |
| **Destinatarios** | Público — el perfil de empresa es visible |

### A6 · Postulaciones y su historial
| | |
|---|---|
| **Datos** | Vínculo estudiante–oferta, mensaje, copia congelada del CV, estados y quién los cambió |
| **Finalidad** | Gestionar el proceso y **garantizar que ninguna postulación quede sin respuesta** |
| **Base de licitud propuesta** | Ejecución del contrato |
| **Conservación** | Al eliminar la cuenta, se **anonimiza**: se conserva que la postulación existió y en qué estado terminó, sin ningún dato identificatorio, porque de ahí salen los indicadores públicos |
| **Destinatarios** | La empresa dueña de la oferta, la coordinación |

### A7 · Auditoría de accesos a datos personales
| | |
|---|---|
| **Datos** | Quién accedió, a qué, cuándo, desde qué IP |
| **Finalidad** | Poder responder «¿quién vio los datos de esta persona?» — exigido por la ley |
| **Base de licitud propuesta** | Cumplimiento de obligación legal |
| **Conservación** | **Pendiente de definir.** Debe sobrevivir al dato auditado; hueco 6 del simulacro de brecha |
| **Destinatarios** | Coordinación y, si lo requiere, la Agencia |

### A8 · Consentimientos
| | |
|---|---|
| **Datos** | Usuario, versión de la política aceptada, fecha de aceptación y de revocación |
| **Finalidad** | **Poder demostrar** que hubo consentimiento y sobre qué texto exacto |
| **Base de licitud** | Cumplimiento de obligación legal |
| **Conservación** | Debe sobrevivir a la cuenta: es la prueba de que el tratamiento fue lícito |

### A9 · Correos transaccionales
| | |
|---|---|
| **Datos** | Correo del destinatario y el contenido del mensaje |
| **Finalidad** | Verificar la cuenta, recuperar contraseña, avisar antes de eliminar por inactividad |
| **Base de licitud propuesta** | Ejecución del contrato |
| **Destinatarios** | El proveedor de correo — **encargado de tratamiento, requiere contrato** |
| **Nota** | Solo transaccional. Proxi **no** envía correo comercial ni promocional |

## Decisiones automatizadas
La ley obliga a informarlas. Proxi tiene tres:

| Decisión | Efecto sobre una persona | Se informa en |
|---|---|---|
| **Eliminación por inactividad** tras 12 meses | Sí: pierde su cuenta y su CV. Hay aviso previo por correo con 30 días | Política de privacidad |
| Marcado de una postulación como *sin respuesta* al vencer el plazo | Indirecto: refleja la inacción de la empresa, no evalúa al estudiante | Términos de uso |
| Cierre automático de una oferta vencida | Sobre la empresa, no sobre una persona natural | Términos de uso |

Ninguna decide sobre la selección de un estudiante. **Proxi no evalúa, no puntúa y no ordena
candidatos**: eso lo hace la empresa, fuera del sistema.

## Encargados de tratamiento (terceros)
Ya no están "sin decidir": el despliegue del 2026-09-21 los eligió. Los tres están **fuera de
Chile**, así que los tres son transferencia internacional.

| Encargado | Qué trata | Dónde | Estado |
|---|---|---|---|
| **Neon** (base de datos) | Todo: cuentas, perfiles, RUT cifrado, CV completos, auditoría | EE.UU. (Virginia) | En uso. **Falta DPA** |
| **Render** (API) | Todo, en tránsito y en memoria mientras procesa | EE.UU. (Virginia) | En uso. **Falta DPA** |
| **Cloudflare** (web y proxy) | Todo lo que pasa entre el navegador y la API | Red global | En uso. **Falta DPA** |
| **GitHub Actions** (tareas y ensayo de restauración) | El volcado completo de la base pasa por su runner una vez por semana | EE.UU. | En uso. **Falta DPA** |
| Proveedor de correo | Correos y direcciones | Sin decidir | Sin configurar; el registro está apagado mientras tanto |

**Hoy esto es inocuo y mañana no.** La base solo tiene datos inventados: seis cuentas de prueba y
ofertas de mentira. Ninguna de esas transferencias toca a una persona real. El día que un estudiante
de la FEN suba su CV, las cuatro filas de arriba pasan a ser tratamiento de datos personales por
terceros fuera de Chile, y **eso no se puede regularizar después**: hay que tener el contrato antes
del primer dato real.

Por qué están fuera de Chile, para que quede en el registro y no en la memoria de alguien: ningún
proveedor gratuito de los evaluados tiene región en Chile. Render no tiene Sudamérica (cinco
regiones, ninguna). Se eligió la costa este de EE.UU. porque es por donde sale el tráfico chileno
hacia el norte, y la base se puso en la misma región que la API porque una petición hace varias
consultas. La alternativa —base en São Paulo— no evitaba la salida del país, solo agregaba latencia.

Ver punto 5 del documento del abogado.

## Medidas de seguridad
Detalle en `../03-seguridad.md`. Resumen: contraseñas con bcrypt costo 12; RUT cifrado en reposo; TLS
en tránsito; control de acceso por rol y por pertenencia verificada en la consulta; registro de
accesos a datos personales; censura automática de datos personales en los registros técnicos; análisis
estático y búsqueda de secretos en cada cambio de código; auditoría de seguridad por fase.

## Brechas
Procedimiento escrito y probado en seco: `../09-procedimiento-de-brecha.md`. Notificación a la Agencia
y a los afectados dentro de **72 horas** desde la detección.
