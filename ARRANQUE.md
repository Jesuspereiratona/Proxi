# Retomar Proxi

Este archivo es para quien llega sin contexto: otra sesión de Claude, otra persona, o tú mismo en
tres meses. **Léelo completo antes de tocar nada.** Ocho minutos aquí ahorran una tarde de suposiciones.

## Dónde está el proyecto ahora

Las fases 0 a 6 están **terminadas y verificadas**: fundaciones, identidad, perfiles y validación de
empresas, ciclo de vida de ofertas, postulaciones con CV, indicadores de transparencia y cliente web
completo con sus cinco pantallas. La fase 7 está cerrada por nuestra parte. La fase 8 no ha empezado.

**El estado real y detallado está en `docs/06-roadmap.md`, casilla por casilla. Ese archivo manda
sobre cualquier resumen, incluido este.** Si alguno de los dos está desactualizado, es este.

## Orden de lectura
1. `CLAUDE.md` — las reglas duras. Claude Code lo lee solo en cada sesión, no hay que pegarlo.
2. `docs/06-roadmap.md` — qué está hecho y qué falta.
3. `docs/00-vision-y-alcance.md` — qué es Proxi y por qué existe.
4. `docs/decisiones/bitacora.md` — **el porqué de todo lo raro.** Lo más reciente arriba. Si algo del
   código parece una decisión extraña, la explicación está acá.
5. El resto de `docs/` según lo que vayas a tocar.

## Cómo se trabaja aquí
El método es especificación selectiva: **lo que tiene reglas de negocio o riesgo se escribe antes de
programarse.** Un CRUD sin reglas va directo al código. La skill `nueva-funcionalidad` tiene el flujo.

Las decisiones no obvias van a `docs/decisiones/bitacora.md`; las grandes, con alternativas
evaluadas, a `docs/adr/`. El avance se marca en el roadmap. Esa disciplina es la razón de que este
archivo pueda existir.

Hay **seis skills** en `.claude/skills/` (construir una funcionalidad, crear un endpoint, revisar
seguridad, depurar, mantener la bitácora, escribir menos código) y **cuatro agentes** en
`.claude/agents/` (auditor de seguridad, pentester, revisor de migraciones, escritor de pruebas,
guardián de docs). Se activan solos por contexto o se llaman por nombre.

## Levantar el proyecto
```bash
cp .env.example .env     # completar los secretos, ver abajo
docker compose up -d db  # PostgreSQL en el puerto 5433
npm install
npm run db:migrate
npm run dev -w apps/api  # http://localhost:3000
```
Verificar con `GET /api/v1/salud`. Las pruebas: `npm test`.

**Los secretos no están en el repositorio y no van a estarlo.** `.env.example` documenta cada clave.
Las de desarrollo se generan con
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Para el correo en
desarrollo se usa una cuenta de Ethereal. La skill `manejo-de-secretos` tiene las reglas.

## Lo que NO está en el repositorio
Para que nadie lo busque en vano:
- **Los secretos.** A propósito.
- **La carpeta `Skills/`** con plantillas legales, que vive fuera del repo. Solo cuatro sirven y están
  referenciadas en la Fase 7 del roadmap.
- **Las conversaciones** donde se tomaron las decisiones. Lo que valía la pena está en la bitácora;
  lo demás se perdió, y está bien.

## Lo que está bloqueado esperando a alguien
No son tareas pendientes: son decisiones de terceros. Están en
`docs/legal/00-que-debe-revisar-un-abogado.md`, y **tres de las diez bloquean código, no texto**:

1. **Si el consentimiento es "libre"** cuando Proxi es el único canal para postular. Si no lo es,
   cambia el flujo de registro.
2. **Estudiantes menores de 18 años.** Hoy el sistema no pregunta la edad ni distingue.
3. **Transferencia internacional** si el hosting queda fuera de Chile. Omitirla es infracción
   gravísima bajo la Ley 21.719.

**La Fase 8 no debería cerrarse sin las tres resueltas.** Descubrir en el despliegue que el registro
tiene que cambiar sale caro.

## Lo que sigue
1. **Pulido visual** — logos de empresa y más color, sobre la base UAH que ya existe en
   `assets/css/uah-theme.css`. La skill `revision-visual` diagnostica antes de tocar código.
2. **Fase 8 · Despliegue** — es lo único que separa el proyecto de que alguien lo use.

## Higiene
- Una rama por funcionalidad. `main` siempre debe poder desplegarse.
- Nada de secretos en el repositorio.
- Anota lo no obvio en la bitácora: es la memoria del proyecto.
- Marca el roadmap.
- **La prueba de acceso cruzado no se salta.** Es la defensa contra el riesgo número uno del sistema:
  que alguien cambie un id en una URL y lea el currículum de otra persona.
