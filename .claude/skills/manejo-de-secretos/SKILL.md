---
name: manejo-de-secretos
description: Cómo se crean, guardan, rotan y recuperan los secretos de Proxi (claves JWT, contraseña de base de datos, llave de cifrado del RUT, credenciales SMTP). Úsala al agregar una variable de entorno nueva, antes de un despliegue, y sobre todo si un secreto quedó expuesto en git, en un log o en una captura de pantalla.
---

# Secretos

Un secreto filtrado no se arregla borrando el archivo: queda en el historial de git, en el log, en la
caché de alguien. Se arregla **rotándolo**. Esta skill existe para que esa reacción sea automática.

## Reglas
- Los secretos viven en `.env`, que está en `.gitignore`. `.env.example` documenta las claves con
  valores **vacíos**, nunca con ejemplos que alguien pueda copiar a producción.
- Todo secreto se genera al azar, nunca se inventa a mano:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Los secretos de producción viven en el proveedor de hosting, no en un archivo del repositorio ni en
  un mensaje de chat.
- Una variable de entorno que **es** un control de seguridad va a `REQUERIDAS` en `config/env.js`.
  Sin default silencioso: es preferible que la app no arranque a que arranque insegura.
- Desarrollo, pruebas y producción usan secretos **distintos**. Si el de pruebas se filtra —y los de
  CI son visibles en el workflow— no debe abrir nada real.

## Al agregar una variable nueva
1. ¿Es un control de seguridad? → `REQUERIDAS`, sin default.
2. Agregarla a `.env.example` con valor vacío y un comentario de qué es.
3. Agregarla al bloque `env:` de los workflows que corran pruebas. **Este paso se olvida siempre** y
   deja la CI en rojo con un mensaje que no parece de configuración.
4. Si es una llave de cifrado, documentar qué pasa si se pierde.

## Llaves de cifrado: el punto que se olvida
`RUT_CIFRADO_KEY` no es una contraseña, es una llave: **si se pierde, los datos cifrados con ella son
irrecuperables**. No hay recuperación, no hay soporte, no hay respaldo que valga si el respaldo no
incluye la llave.

Por eso: la llave se respalda **por separado** de la base de datos (si van juntas, un solo robo
entrega ambas cosas), y rotarla exige descifrar y volver a cifrar los datos existentes, no solo
cambiar la variable. Eso hay que escribirlo antes de necesitarlo, no durante.

## Si un secreto se expuso
El orden importa, y el primer paso no es borrar.

1. **Rotar primero.** Generar el secreto nuevo y ponerlo en producción. Mientras el viejo siga siendo
   válido, el daño sigue abierto. Borrar el archivo del repositorio no invalida nada.
2. **Invalidar lo que dependía de él.** Si fue una clave JWT: revocar todas las sesiones. Si fue la
   contraseña de la base: cambiarla en el motor, no solo en el `.env`.
3. **Evaluar el alcance.** ¿Cuánto tiempo estuvo expuesto? ¿El repositorio es público? ¿Hay accesos
   raros en los logs de ese período? Si hubo acceso a datos personales de estudiantes, se activa el
   procedimiento de brecha de `docs/07-operacion-y-mantenimiento.md`: **72 horas** para notificar.
4. **Limpiar el rastro** (último, no primero). Si está en el historial de git, reescribirlo o —más
   honesto y más seguro— dar el repositorio por comprometido y considerar que ese secreto ya es
   público para siempre.
5. **Anotar en la bitácora** qué se filtró, cómo, y qué cambió para que no se repita. Sin buscar
   culpables: buscar la falla del proceso.

## Verificación
`gitleaks` corre en cada push (`.github/workflows/seguridad.yml`) sobre el historial completo. Si algo
te preocupa antes de subir, córrelo en local:
```bash
gitleaks detect --source . --redact
```
