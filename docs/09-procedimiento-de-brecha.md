# 09 · Procedimiento ante una brecha de datos personales

La Ley 21.719 obliga a notificar una brecha **dentro de 72 horas** de detectada, a la Agencia de
Protección de Datos Personales y a las personas afectadas. Este documento existe para que, cuando
pase, nadie tenga que improvisar con el reloj corriendo.

Se probó en seco el 30 de agosto de 2026 con cuatro escenarios. El simulacro está al final, junto con
los siete huecos que encontró.

## Quién hace qué
En un proyecto de una persona, los tres roles recaen en la misma. Escribirlos igual sirve: obliga a
cambiar de sombrero en vez de mezclar todo.

| Rol | Responsabilidad | Hoy |
|---|---|---|
| Coordinador del incidente | Decide, lleva la línea de tiempo, controla el reloj de 72 h | Desarrollador |
| Técnico | Contiene, investiga el alcance, ejecuta las correcciones | Desarrollador |
| Comunicaciones | Redacta y envía a la Agencia y a los afectados | Coordinación FEN |

**Si la brecha afecta a estudiantes reales, coordinación de la FEN se entera el mismo día.** No es una
decisión técnica: la responsable del tratamiento es la facultad, no quien escribió el código.

## Gravedad
Para datos personales la escala no es de disponibilidad, es de **sensibilidad × alcance**.

| Nivel | Qué pasó | Reloj |
|---|---|---|
| **G1** | CV, RUT o correos de estudiantes accesibles por quien no debía | Notificar. 72 h desde la detección |
| **G2** | Credenciales o secretos expuestos, sin evidencia de acceso a datos | Contener y evaluar. Notificable si no se puede descartar el acceso |
| **G3** | Acceso indebido por alguien con cuenta legítima (coordinación o empresa fuera de su ámbito) | Notificar si hubo datos de terceros. Siempre se investiga |
| **G4** | Falla sin exposición de datos personales | No notificable. Se documenta igual |

**Ante la duda, es G1.** "No pudimos confirmar que alguien lo viera" no es lo mismo que "nadie lo vio",
y la ley no premia el optimismo.

## El reloj
Las 72 horas cuentan **desde que se detecta**, no desde que se entiende. No se espera a tener la
investigación cerrada para notificar: se notifica con lo que se sabe y se actualiza después.

```
0 h ─── Detección. Empieza el reloj. Se abre el archivo del incidente.
0–2 h ─ Contener: revocar, rotar, cerrar el acceso.
2–12 h ─ Alcance: qué datos, de cuántas personas, en qué ventana de tiempo.
12–24 h ─ Avisar a coordinación FEN. Redactar los borradores.
< 72 h ─ Notificar a la Agencia y a las personas afectadas.
Después ─ Informe y correcciones al roadmap.
```

## Los cinco pasos

### 1. Contener (0–2 h)
Cortar el acceso antes que cualquier otra cosa. Según el caso: revocar todas las sesiones, rotar el
secreto comprometido, bloquear la cuenta involucrada, sacar el servicio de línea si no hay otra forma.

**No borrar nada todavía.** Los logs y la tabla `auditoria_accesos` son la única prueba del alcance;
un `rm` apurado destruye la evidencia que se necesita para saber a quién avisar.

### 2. Medir el alcance (2–12 h)
Responder tres preguntas con datos, no con impresiones:
- **Qué datos.** ¿CV completos? ¿RUT descifrados? ¿Solo correos?
- **De cuántas personas.** Con nombre y apellido: hay que poder notificar una por una.
- **En qué ventana.** Desde cuándo estuvo abierto hasta cuándo se cerró.

Fuentes: `auditoria_accesos` (quién descargó qué CV y cuándo), los logs de la aplicación
(`peticionId`, códigos de estado, IP), y los logs del proveedor de hosting.

### 3. Avisar a coordinación FEN (12–24 h)
La facultad es la responsable del tratamiento. Se le informa qué pasó, a cuántos afecta, qué se hizo,
y qué se va a notificar. La decisión de notificar no se toma en solitario.

### 4. Notificar (antes de 72 h)
**A la Agencia de Protección de Datos Personales.** Qué ocurrió, cuándo se detectó, qué categorías de
datos, cuántas personas aproximadamente, qué medidas se tomaron, qué se hará.

**A las personas afectadas**, en lenguaje claro y sin tecnicismos:

> Asunto: Aviso importante sobre tus datos en Proxi
>
> Hola [nombre]:
>
> El [fecha] detectamos que [qué pasó, en una frase sin jerga]. Esto afectó a [qué datos tuyos
> específicamente: tu currículum, tu RUT, tu correo].
>
> Qué hicimos: [contención, en una frase]. El acceso quedó cerrado el [fecha y hora].
>
> Qué te recomendamos hacer: [acciones concretas — cambiar la contraseña si la reutilizas en otro
> sitio, estar atento a correos que digan ser de la facultad].
>
> Si tienes dudas, escríbenos a uahmarketcl@gmail.com.
>
> Lamentamos lo ocurrido. Te contaremos qué cambiamos para que no vuelva a pasar.

Sin minimizar, sin "podría haberse producido un posible acceso no autorizado". Qué pasó, a qué datos,
qué hacemos, qué haga la persona.

### 5. Documentar y corregir
Informe en `docs/incidentes/AAAA-MM-DD-titulo.md`: línea de tiempo, causa raíz (cinco porqués),
qué funcionó, qué no, y las acciones correctivas **con casilla en el roadmap**. Sin buscar culpables:
buscar la falla del sistema que permitió el error.

---

## Simulacro en seco — 30 de agosto de 2026

Cuatro escenarios, corridos contra el estado real del código. La pregunta de cada uno no es "qué
haríamos" sino **"¿podemos?"**.

### Escenario 1 · Un CV llegó a quien no debía
*Una empresa reporta que descargando postulantes vio el CV de un estudiante que no postuló a ninguna
de sus ofertas.*

| Pregunta | ¿Podemos? |
|---|---|
| ¿Quién descargó ese CV y cuándo? | **Sí.** `auditoria_accesos` lo registra desde la Fase 4 |
| ¿Desde qué IP? | **Sí**, la columna existe |
| ¿Con qué navegador o cliente? | **No.** Falta `user_agent`, que sí estaba en el modelo de datos |
| ¿Cuántos CV ajenos se descargaron en total? | **Sí**, con una consulta cruzando accesos contra postulaciones |
| ¿Cerrar el acceso de esa empresa? | **Sí**, suspenderla cierra sus ofertas en cascada |
| ¿Notificar a los estudiantes afectados? | **No automáticamente.** Ver hueco 3 |

### Escenario 2 · Un secreto quedó expuesto
*`JWT_ACCESS_SECRET` aparece en una captura de pantalla de una presentación de clase.*

| Pregunta | ¿Podemos? |
|---|---|
| ¿Rotar el secreto? | **Sí**, variable de entorno |
| ¿Invalidar todas las sesiones activas de todos? | **No.** Existe revocación por usuario, no global. Hueco 2 |
| ¿Saber si alguien lo usó? | **Parcialmente.** Un token falsificado válido no se distingue de uno legítimo en los logs |
| ¿Es notificable? | **G2.** Si no se puede descartar el acceso a datos, se trata como G1 |

Nota: el repositorio es público. Un secreto que entra a git es público desde el segundo cero, no desde
que alguien lo mira. `gitleaks` corre en cada push justamente por esto.

### Escenario 3 · Acceso indebido desde dentro
*Alguien de coordinación descifra RUT de estudiantes que no tienen ningún trámite pendiente.*

| Pregunta | ¿Podemos? |
|---|---|
| ¿Queda registrado? | **Sí.** El descifrado de RUT pasa por `auditoria_accesos` desde la Fase 4 |
| ¿Nos enteramos solos? | **No.** Nadie mira esa tabla; la detección es por casualidad. Hueco 1 |
| ¿Sabemos qué es un volumen normal? | **No.** No hay línea base ni umbral |
| ¿Es notificable? | **G3**, y sí: son datos de terceros accedidos fuera de propósito |

Este es el escenario más incómodo porque el atacante tiene credenciales legítimas. Ninguna de las
capas de seguridad lo detiene: hacen exactamente lo que se les pidió.

### Escenario 4 · La base quedó comprometida
*Un respaldo de la base de datos terminó en un lugar público.*

| Pregunta | ¿Podemos? |
|---|---|
| ¿Las contraseñas sirven para algo? | **No.** bcrypt con costo 12 |
| ¿Los RUT están legibles? | **Depende.** Cifrados con pgcrypto — si la llave viajó con el respaldo, sí son legibles. Hueco 5 |
| ¿Los CV están en el respaldo? | **Los archivos no**, están en disco aparte. Sus nombres y dueños sí |
| ¿Restaurar desde un respaldo limpio? | **No.** No hay respaldos ni restauración probada. Fase 8 |
| ¿Saber cuándo se tomó ese respaldo? | **No** hoy |
| ¿A cuántas personas afecta? | **Sí**, contando filas |

---

## Los siete huecos que encontró el simulacro

Todos entraron al roadmap. Un simulacro que no produce tareas es una redacción.

| # | Hueco | Consecuencia | Destino |
|---|---|---|---|
| 1 | Nadie vigila `auditoria_accesos` | Un acceso indebido se descubre por casualidad, o nunca | Fase 8 · monitoreo |
| 2 | ~~No hay revocación global de sesiones~~ | ~~Ante una clave comprometida no se puede echar a todos de golpe~~ | **Cerrado 2026-08-30** |
| 3 | No hay forma de notificar a N afectados | Con el reloj de 72 h corriendo habría que mandar correos a mano | Fase 8 |
| 4 | ~~No hay contacto de privacidad publicado~~ | ~~Nadie tiene dónde ejercer sus derechos ni reportar un problema~~ | **Cerrado 2026-08-30** |
| 5 | La llave de cifrado puede terminar junto al respaldo | Un respaldo robado entregaría los RUT en claro | Fase 8 · respaldos |
| 6 | Retención de logs sin definir | Si la brecha se detecta 40 días después, quizá ya no hay con qué investigar | Fase 8 |
| 7 | ~~`auditoria_accesos` sin `user_agent`~~ | ~~Menos capacidad de distinguir sesiones al investigar~~ | **Cerrado 2026-08-30** |

**El más grave es el 4**, y es el más barato: sin un correo de contacto publicado, la política de
privacidad promete derechos que nadie puede ejercer.

### Qué se cerró el 2026-08-30

**Hueco 2 — revocación global.** `npm run revocar-sesiones -w apps/api` revoca todas las sesiones
activas de todos los usuarios de una vez. Es el paso 1 ("Contener") del escenario 2. Dos advertencias
para quien lo corra con el reloj andando:
- **Solo mata el refresco.** Un `accessToken` ya emitido sigue siendo válido hasta que vence (15
  minutos): el JWT no tiene estado, no hay lista de revocación. Si el secreto está comprometido, hay
  que rotar `JWT_ACCESS_SECRET` **además** de correr esto — eso sí invalida los tokens en el acto.
- **No es un endpoint HTTP a propósito.** Uno autenticado por JWT sería vulnerable exactamente al
  escenario que este script existe para responder.

**Hueco 4 — contacto de privacidad.** `privacidad@proxi.cl`, visible en el pie de las 13 páginas y
en la política. Está marcado como dirección provisoria en la propia interfaz: **cuando la FEN asigne
una casilla real, hay que cambiarlo en `apps/web/*.html` y en la plantilla de correo del paso 4** de
este documento. Una dirección de contacto que rebota es peor que ninguna.

**Hueco 7 — `user_agent`.** Columna agregada a `auditoria_accesos` y capturada en los cinco puntos
que escriben ahí. **Las filas anteriores al 2026-08-30 la tienen en NULL, y eso significa "no se
capturó", no "cliente desconocido"** — no se puede backfillear, el dato nunca existió. Importa
tenerlo claro leyendo la tabla en medio de un incidente.

## Cuándo se vuelve a probar
Una vez al año, y cada vez que cambie algo grande de cómo se guardan o se acceden los datos
personales. Se anota la fecha del último simulacro en `docs/decisiones/bitacora.md`.
