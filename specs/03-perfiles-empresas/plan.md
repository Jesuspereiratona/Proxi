# Plan técnico · Perfiles y validación de empresas

## Cambios en el modelo de datos
Migración `crear-estudiantes`: tabla `estudiantes` según `docs/02-modelo-de-datos.md`.
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```
`rut_cifrado bytea NULL` se escribe con `pgp_sym_encrypt(:rut, :clave)` y se lee con
`pgp_sym_decrypt(rut_cifrado, :clave)::text` — siempre en SQL crudo parametrizado (`replacements`,
nunca concatenación), nunca a través del constructor normal de Sequelize, que no sabe llamar
funciones de pgcrypto en el valor de una columna.

Migración `crear-empresas`: tabla `empresas` según el modelo, con:
```sql
CHECK (estado_validacion IN ('pendiente','validada','rechazada','suspendida'))
```
Índice único en `rut_empresa`, índice en `estado_validacion`.

**Nueva variable de entorno obligatoria:** `RUT_CIFRADO_KEY` — la clave simétrica de `pgp_sym_encrypt`.
Sin ella no hay forma segura de cifrar un RUT, así que se agrega a `REQUERIDAS` en `config/env.js`,
igual que los secretos JWT. Se documenta vacía en `.env.example` con la misma instrucción de
`crypto.randomBytes` que ya usan los otros secretos.

## Por qué aparece `repositories/` recién ahora
Fase 1 no lo necesitó: todo era CRUD simple que Sequelize resuelve solo. El cifrado con `pgcrypto` es
la primera vez que hace falta SQL crudo, y `docs/01-arquitectura.md` ya reserva esa capa para eso
("Consultas a la base. Único lugar donde aparece Sequelize" para lo que no es CRUD simple). Se crea
`repositories/estudiantes.repository.js` solo para las tres consultas que tocan `rut_cifrado`; el
resto de las lecturas de `estudiantes`/`empresas` sigue yendo directo por el modelo desde el service,
como en Fase 1 — no se reescribe lo que ya funciona.

## Endpoints
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/v1/estudiantes/perfil` | estudiante | Crea el perfil propio |
| GET | `/api/v1/estudiantes/perfil` | estudiante | Perfil propio (RUT nunca en texto plano) |
| PATCH | `/api/v1/estudiantes/perfil` | estudiante | Edita el perfil propio |
| POST | `/api/v1/empresas/perfil` | empresa | Crea el perfil propio, nace `pendiente` |
| GET | `/api/v1/empresas/perfil` | empresa | Perfil propio |
| PATCH | `/api/v1/empresas/perfil` | empresa | Edita el perfil propio; si estaba `rechazada`, vuelve a `pendiente` |
| GET | `/api/v1/empresas/pendientes` | coordinacion | Cola de empresas `pendiente` |
| POST | `/api/v1/empresas/:id/validacion` | coordinacion | `pendiente` → `validada` |
| POST | `/api/v1/empresas/:id/rechazo` | coordinacion | `pendiente` → `rechazada`, motivo obligatorio |
| GET | `/api/v1/estudiantes/:id/rut` | coordinacion | RUT descifrado, uso puntual y auditable |

Todas las rutas de "perfil propio" ignoran cualquier `usuarioId`/`id` que venga en el cuerpo: el
`usuarioId` sale siempre de `req.usuario.id`, nunca del payload del cliente.

## Servicios
`services/estudiantes/estudiantes.service.js` — `crearPerfil`, `obtenerPropio`, `actualizarPropio`.
No conoce `req`; recibe `{ usuarioId, datos }`.

`services/empresas/estados.js` — tabla de transiciones, mismo patrón que `services/ofertas/estados.js`:
```js
const TRANSICIONES = {
  pendiente:  { validada: ['coordinacion'], rechazada: ['coordinacion'] },
  validada:   {},
  rechazada:  { pendiente: ['empresa'] }, // automático al editar, no una ruta aparte
  suspendida: {},
};
```

`services/empresas/empresas.service.js` — `crearPerfil`, `obtenerPropio`, `actualizarPropio` (dispara
`rechazada → pendiente` si corresponde), `listarPendientes`, `validar`, `rechazar`.

`services/empresas/reglas.js` — `verificarValidada(empresa)`: lanza `EMPRESA_NO_VALIDADA` si
`estadoValidacion !== 'validada'`. Sin usuarios todavía (Fase 3 la importa), pero se prueba sola.

`utils/rut.js` — `normalizarRut(rut)` (quita puntos y guion, mayúscula el dígito verificador) y
`esRutValido(rut)` (módulo 11). Se usa tanto para RUT de estudiante como de empresa.

`repositories/estudiantes.repository.js` — `crearConRutCifrado`, `actualizarRut`,
`obtenerRutDescifrado(usuarioId)`. Las tres únicas funciones que tocan `pgcrypto`.

## Errores nuevos
`PERFIL_YA_EXISTE` (409) · `PERFIL_NO_ENCONTRADO` (404) · `RUT_INVALIDO` (422) ·
`EMPRESA_TRANSICION_INVALIDA` (409). `EMPRESA_NO_VALIDADA` ya estaba anotado en
`docs/04-manejo-de-errores.md` desde la planificación original; se agrega recién ahora a
`packages/errores/codigos.js` porque es la primera vez que algo lo lanza.

## Consideraciones de seguridad
- El RUT de estudiante nunca sale en una respuesta HTTP normal, ni en `GET /estudiantes/perfil`
  propio: se expone `rutUltimos4` para que el dueño confirme que es el suyo, nada más. Solo
  `GET /estudiantes/:id/rut` (coordinación) descifra el valor completo.
- `GET /estudiantes/:id/rut` es sensible: además de `autorizar('coordinacion')`, cada llamada se
  registra (nivel `info`, sin el RUT en el log) — es el primer caso real de algo parecido a
  `auditoria_accesos`, aunque esa tabla completa es Fase 4. Se anota como deuda explícita.
- `rut_ultimos_4` no es reversible al RUT completo (son 4 caracteres de ~9), así que sirve para
  desambiguar sin ser un dato sensible por sí solo.
- Todas las rutas de "perfil propio" derivan el `usuarioId` de `req.usuario.id` (viene del JWT
  verificado), nunca de un parámetro de ruta ni del cuerpo. No hay :id que un estudiante o empresa
  pueda manipular para ver el perfil de otro — el vector de IDOR no existe por diseño, no solo por
  un chequeo de pertenencia.
- `GET /estudiantes/pendientes` → en realidad no existe (los estudiantes no se validan); la única
  cola es `GET /empresas/pendientes`, con `autorizar('coordinacion')`.
- `RUT_CIFRADO_KEY` nunca se registra en logs (ya cubierto por el patrón `*_KEY`/`*Secret` si se
  nombra así; se revisa explícito en `config/logger.js`).

## Pruebas
Unitarias: `utils/rut.js` (dígito verificador con casos válidos e inválidos conocidos),
`services/empresas/estados.js` (matriz de transiciones), `services/empresas/reglas.js`
(`verificarValidada` con los cuatro estados posibles).
Integración: un caso por criterio de aceptación de `spec.md`, más:
- **Acceso cruzado entre perfiles**: estudiante A y B, cada uno con perfil; A nunca ve ni modifica los
  datos de B a través de `GET`/`PATCH /estudiantes/perfil`. Mismo caso para dos empresas.
- Intento de mass-assignment: `PATCH` con `usuarioId` ajeno en el cuerpo no cambia el dueño del perfil.
- `GET /estudiantes/:id/rut` con rol distinto de `coordinacion` → 403.
- Datos de prueba y seeds: **RUT y correos inventados**, nunca reales — el repo es público.

## Riesgos
| Riesgo | Detección |
|---|---|
| `RUT_CIFRADO_KEY` se pierde o rota sin migrar los datos existentes | Ningún RUT antiguo se puede descifrar. Se documenta como procedimiento manual pendiente para cuando haya datos reales; en desarrollo no importa |
| Alguien agrega una lectura de `estudiantes` que sí selecciona `rut_cifrado` sin querer | El valor queda como `bytea` ilegible en JSON (no es texto plano), pero igual no debería exponerse un blob cifrado sin necesidad; se revisa en el checklist de seguridad de cada PR |
| El dígito verificador de un RUT válido real se rechaza por un bug del cálculo | Pruebas unitarias con RUT de ejemplo conocidos (inventados, no reales) cubriendo los bordes del módulo 11 (resto 0, 1, 10) |
