# 02 · Modelo de datos

PostgreSQL 15. Nombres de tablas y columnas en `snake_case` y plural. Toda tabla lleva `id`
(bigserial), `created_at` y `updated_at` en `timestamptz` (UTC). Los borrados son lógicos
(`eliminado_at`) salvo cuando la ley exige borrado real (ver `03-seguridad.md`).

## Diagrama de relaciones

```
usuarios 1─1 estudiantes ──1─* postulaciones *─1── ofertas *─1─ empresas 1─1 usuarios
   │                              │                    │
   │                              └─* postulacion_eventos│
   │                                                   └─* oferta_eventos
   └─* sesiones   └─* consentimientos   └─* auditoria_accesos   └─* tokens_verificacion
estudiantes 1─* archivos (cv)
```

## Tablas

### usuarios
Identidad y acceso. Nada de datos de perfil aquí.

| Columna | Tipo | Notas |
|---|---|---|
| id | bigserial PK | |
| email | citext UNIQUE NOT NULL | `citext` evita el bug clásico de Juan@ vs juan@ |
| password_hash | text NOT NULL | bcrypt, nunca la contraseña |
| rol | text NOT NULL | CHECK: `estudiante` · `empresa` · `coordinacion` |
| estado | text NOT NULL | CHECK: `pendiente_verificacion` · `activo` · `bloqueado` |
| email_verificado_at | timestamptz NULL | |
| ultimo_acceso_at | timestamptz NULL | alimenta la política de retención |
| intentos_fallidos | int DEFAULT 0 | bloqueo temporal tras N intentos |
| intentos_fallidos_desde | timestamptz NULL | inicio de la racha de fallos actual; sin ella no hay desde cuándo contar los 15 minutos del bloqueo sin reusar `ultimo_acceso_at` |

Índices: `email` (único), `rol`.

### tokens_verificacion
Un solo mecanismo para dos flujos: verificar correo y restablecer clave. Se distinguen por `tipo`.

| Columna | Tipo | Notas |
|---|---|---|
| usuario_id | bigint FK NOT NULL | |
| token_hash | text NOT NULL | se guarda el hash, nunca el token |
| tipo | text NOT NULL | CHECK: `verificacion_correo` · `restablecer_clave` |
| expira_at | timestamptz NOT NULL | 24h para verificación, 1h para restablecer |
| usado_at | timestamptz NULL | un solo uso: si no es NULL, el token ya sirvió |

Índices: `usuario_id`, `token_hash`.

### estudiantes
| Columna | Tipo | Notas |
|---|---|---|
| usuario_id | bigint FK UNIQUE | |
| nombres, apellidos | text NOT NULL | |
| rut_cifrado | bytea NULL | cifrado con pgcrypto. Solo coordinación lo descifra |
| rut_ultimos_4 | char(4) NULL | para búsqueda sin descifrar |
| carrera | text NOT NULL | |
| nivel | int | semestre o año cursado |
| telefono | text NULL | |
| cv_archivo_id | bigint FK NULL | CV vigente |

### empresas
| Columna | Tipo | Notas |
|---|---|---|
| usuario_id | bigint FK UNIQUE | |
| razon_social | text NOT NULL | |
| rut_empresa | text UNIQUE NOT NULL | dato público de la empresa, sin cifrar |
| giro, sitio_web, comuna | text | |
| contacto_nombre, contacto_cargo | text NOT NULL | |
| estado_validacion | text NOT NULL | CHECK: `pendiente` · `validada` · `rechazada` · `suspendida` |
| validada_por_usuario_id | bigint FK NULL | quién de coordinación la validó |
| validada_at | timestamptz NULL | |
| motivo_rechazo | text NULL | |
| motivo_suspension | text NULL | agregada en la auditoría de Fase 2: distinta de `motivo_rechazo`, para `validada → suspendida` |

**Regla:** una empresa en estado distinto de `validada` no puede publicar. Puede escribir borradores.

### ofertas
| Columna | Tipo | Notas |
|---|---|---|
| empresa_id | bigint FK NOT NULL | |
| titulo, descripcion, requisitos | text NOT NULL | |
| area | text NOT NULL | contabilidad, finanzas, auditoría, marketing… |
| modalidad | text NOT NULL | CHECK: `presencial` · `hibrida` · `remota` |
| comuna | text NULL | obligatoria si la modalidad no es remota |
| jornada | text NOT NULL | CHECK: `completa` · `parcial` |
| remunerada | boolean NOT NULL | |
| monto_mensual | integer NULL | obligatorio si `remunerada` es verdadero |
| cupos | int NOT NULL DEFAULT 1 | CHECK > 0 |
| fecha_publicacion | timestamptz NULL | se llena al publicar |
| **fecha_cierre** | **timestamptz NULL** | CHECK `estado = 'borrador' OR fecha_cierre IS NOT NULL`: solo un borrador puede no tenerla. Ninguna oferta **publicada** existe sin ella — la columna que define el proyecto |
| estado | text NOT NULL | ver máquina de estados |
| motivo_cierre | text NULL | CHECK: `contratado` · `cancelada` · `sin_candidatos` · `vencida` |
| resultado_declarado | boolean NOT NULL DEFAULT false | lo pone la empresa, no el sistema |
| cerrada_at | timestamptz NULL | |

Restricciones a nivel de base, no solo de código:
```sql
CHECK (fecha_cierre > fecha_publicacion)
CHECK (estado <> 'cerrada' OR motivo_cierre IS NOT NULL)
CHECK (NOT remunerada OR monto_mensual IS NOT NULL)
```
Índices: `(estado, fecha_cierre)` para la vitrina, `empresa_id`, `area`.

### postulaciones
| Columna | Tipo | Notas |
|---|---|---|
| oferta_id, estudiante_id | bigint FK NOT NULL | **UNIQUE(oferta_id, estudiante_id)** |
| mensaje | text NULL | carta breve |
| cv_archivo_id | bigint FK NOT NULL | copia congelada del CV al postular |
| estado | text NOT NULL | ver máquina de estados |
| estado_actualizado_at | timestamptz NOT NULL | base del cálculo de SLA |
| respondida_por_empresa | boolean DEFAULT false | distingue respuesta real de cierre automático |

**Por qué el CV se congela:** si el estudiante cambia su CV en octubre, la postulación de agosto debe
seguir mostrando el CV que la empresa realmente recibió. Sin esto no hay trazabilidad.

### postulacion_eventos y oferta_eventos
Bitácora de cambios de estado. Nunca se actualizan ni se borran: solo se insertan.

| Columna | Tipo |
|---|---|
| postulacion_id / oferta_id | bigint FK |
| estado_anterior, estado_nuevo | text |
| actor_usuario_id | bigint FK NULL (NULL = el sistema) |
| motivo | text NULL |
| created_at | timestamptz |

De aquí salen los indicadores de transparencia. Sin esta tabla no se puede calcular "días promedio de
respuesta" ni auditar quién rechazó a quién.

### archivos
| Columna | Tipo | Notas |
|---|---|---|
| propietario_usuario_id | bigint FK | |
| nombre_original | text | se muestra, nunca se usa como ruta |
| nombre_almacenado | text | UUID generado. El nombre del usuario jamás toca el disco |
| mime, tamano_bytes | text / bigint | validados contra el contenido real, no la extensión |
| tipo | text | CHECK: `cv` · `logo` |
| expira_at | timestamptz | política de retención |

### sesiones, consentimientos, auditoria_accesos
- **sesiones**: `usuario_id`, `refresh_token_hash`, `expira_at`, `revocada_at`, `ip`, `user_agent`.
  Se guarda el hash del token, nunca el token.
- **consentimientos**: `usuario_id`, `version_politica`, `otorgado_at`, `revocado_at`. Sin un registro
  aquí no se pueden tratar los datos del estudiante.
- **auditoria_accesos**: `usuario_id`, `accion`, `entidad`, `entidad_id`, `ip`, `created_at`. Registra
  quién vio o descargó datos personales de otro. Exigido por la Ley 21.719.

## Máquinas de estado

### Oferta
```
borrador ──enviar──> en_revision ──aprobar──> publicada ──cerrar──> cerrada ──> archivada
    ^                     │                        │
    └──────rechazar───────┘                        └──vence sola──> cerrada (motivo: vencida)
```
| Desde | Hacia | Quién | Condición |
|---|---|---|---|
| borrador | en_revision | empresa | empresa validada y sin cierres pendientes de declarar |
| en_revision | publicada | coordinación | — |
| en_revision | borrador | coordinación | con `motivo_rechazo` |
| publicada | cerrada | empresa | exige `motivo_cierre`; marca `resultado_declarado = true` |
| publicada | cerrada | sistema | `fecha_cierre` pasada → `vencida`, `resultado_declarado = false` |
| cerrada | archivada | sistema | 90 días después |

Cualquier otra transición lanza `OFERTA_TRANSICION_INVALIDA`. Las transiciones viven en
`services/ofertas/estados.js` como una tabla de datos, no como una cadena de `if`.

### Postulación
```
recibida ──> en_revision ──> entrevista ──> seleccionada
    │             │              │       └─> no_seleccionada
    │             └──────────────┴─────────> no_seleccionada
    └── el estudiante puede pasar a `retirada` desde cualquier estado no terminal
    └── el sistema pasa a `sin_respuesta` si vence el SLA sin movimiento
```
Estados terminales: `seleccionada`, `no_seleccionada`, `sin_respuesta`, `retirada`.
**Ninguna postulación se queda fuera de un estado terminal.** Esa es la promesa del producto.

## Indicadores de transparencia
Vista materializada `empresa_indicadores`, recalculada de noche:

| Indicador | Cálculo |
|---|---|
| tasa_respuesta | postulaciones con `respondida_por_empresa = true` / total en estado terminal |
| dias_promedio_respuesta | promedio de días entre `recibida` y el primer movimiento de la empresa |
| tasa_cierre_declarado | ofertas cerradas con `resultado_declarado = true` / total cerradas |
| ofertas_publicadas_12m | conteo |

Se muestran públicamente solo si la empresa tiene al menos 3 ofertas cerradas: con menos casos el
número engaña más de lo que informa.
