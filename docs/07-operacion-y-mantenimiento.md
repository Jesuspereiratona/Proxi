# 07 · Operación y mantenimiento

Un proyecto que solo corre en el computador de quien lo escribió no está terminado.

## Entornos
| Entorno | Para qué | Base de datos |
|---|---|---|
| desarrollo | día a día | PostgreSQL en Docker, datos de prueba |
| pruebas | CI y suite automatizada | base efímera, se crea y destruye |
| producción | uso real | base gestionada con respaldos |

Las tres se configuran solo con variables de entorno. El código es idéntico. Si hay un `if (entorno
=== 'produccion')` con lógica de negocio adentro, está mal.

## Despliegue
1. Rama fusionada a `main` con CI en verde
2. `npm ci --omit=dev`
3. `npm run db:migrate` — **las migraciones corren antes de arrancar la app nueva**
4. Reinicio del proceso
5. Verificar `GET /api/v1/salud`
6. Anotar en la bitácora qué se desplegó

Migraciones: siempre reversibles (`up` y `down`), nunca destructivas en un solo paso. Para eliminar una
columna: primero dejar de usarla y desplegar, después borrarla en un despliegue posterior. Así un
retroceso no pierde datos.

**Revertir una migración es al revés que aplicarla: primero el proceso vuelve a la versión
anterior, después `db:migrate:undo`.** Un modelo de Sequelize declara sus columnas de forma
explícita — si el proceso nuevo sigue corriendo cuando se le quita una columna a la base, cualquier
`SELECT`/`INSERT`/`UPDATE` sobre esa tabla falla con un 500 hasta que también se revierte el código
(encontrado por `revisor-migraciones` al revisar la migración de retención de Fase 7).

## Respaldos
- Diario automático de la base, retención 30 días.
- Los CVs entran en el respaldo desde la fase 4.
- **Restauración probada cada 3 meses.** Un respaldo que nunca se restauró no es un respaldo, es una
  esperanza. Se anota la fecha de la última prueba en la bitácora.

## Monitoreo
- `GET /api/v1/salud` devuelve: estado de la app, de la base, y última ejecución exitosa de cada tarea
  programada.
- Un servicio externo lo consulta cada 5 minutos y avisa si falla dos veces seguidas.
- Revisión semanal de logs `error` y `warn`: 401 repetidos desde una IP o picos de límite de tasa son
  señales de ataque, no ruido.

## Mantenimiento periódico
| Cada | Qué |
|---|---|
| Semana | Revisar logs de error y warn |
| Mes | `npm audit` y `npm outdated`; actualizar parches de seguridad |
| Trimestre | Probar restauración del respaldo; revisar accesos de coordinación; revisar la lista de `03-seguridad.md` |
| Semestre | Actualizar dependencias mayores en rama aparte, con pruebas |
| Año | Revisar política de privacidad y plazos de retención |

## Procedimiento ante una brecha de datos
La Ley 21.719 exige notificar a la Agencia y a los afectados **dentro de 72 horas** de detectada.

1. **Contener** (0–2 h): revocar sesiones, rotar secretos, cerrar el acceso comprometido.
2. **Evaluar** (2–12 h): qué datos, de cuántas personas, en qué ventana. Los logs y
   `auditoria_accesos` son la fuente.
3. **Notificar** (antes de 72 h): a la Agencia y a los titulares afectados, en lenguaje claro: qué
   pasó, qué datos, qué estamos haciendo, qué debe hacer la persona.
4. **Documentar**: informe en `docs/incidentes/AAAA-MM-DD-titulo.md` con línea de tiempo, causa raíz y
   qué cambió para que no se repita. Sin buscar culpables: buscar la falla del sistema.
5. **Corregir**: la corrección entra al roadmap con prioridad, no a una lista de deseos.

## Traspaso
Si otra persona toma el proyecto, debería bastarle con: `README.md` → `CLAUDE.md` → `docs/` en orden →
`docs/decisiones/bitacora.md` para entender el porqué de lo raro. Si algo no se entiende leyendo eso,
falta documentación, y esa es una tarea del roadmap como cualquier otra.
