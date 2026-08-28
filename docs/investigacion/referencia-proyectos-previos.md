# Referencia: qué se hereda de los proyectos previos del bootcamp

Revisión de la carpeta `BOOTCAMP PROYECTOS` (agosto 2026). El objetivo no es criticar trabajos de
curso —cumplieron su propósito— sino **partir de lo que ya sabes hacer** y ser explícito en los cuatro
puntos donde Proxi se separa, para que la diferencia sea una decisión y no un accidente.

## Lo que ya está bien y se conserva tal cual

`toolshare-api` (módulo 8, el más avanzado) ya tiene casi exactamente el esqueleto que Proxi necesita:

```
src/app.js              arma Express y exporta la app
src/server.js           solo escucha el puerto
src/config/database.js  conexión Sequelize
src/controllers/*.controller.js
src/middlewares/*.middleware.js
src/models/             PascalCase singular + index.js
src/routes/*.routes.js
assets/css, assets/js   frontend
```

Se conserva todo: la separación `app.js` / `server.js` (que es justo lo que hace testeable la API),
la convención de nombres `<recurso>.<capa>.js`, los modelos en PascalCase singular, CommonJS,
`.env` + `.env.example`, y el stack `express` + `sequelize` + `pg` + `pg-hstore` + `jsonwebtoken` +
`bcryptjs` + `dotenv` + `cors` + `multer` + `nodemon`.

**Consecuencia práctica:** Proxi no te obliga a aprender una estructura nueva. Es la tuya, con una
capa más y tres hábitos distintos.

## Las cuatro diferencias, y por qué

### 1. Aparece la capa `services/`
Hoy la lógica vive en el controller:
```js
// tool.controller.js
const listar = async (req, res) => {
  try {
    const herramientas = await Tool.findAll();
    return res.status(200).json({ success: true, data: herramientas });
  } catch (error) { return res.status(500).json({ error: error.message }); }
};
```
Para un CRUD de curso está perfecto. Proxi no puede: la regla "cerrar exige motivo y bloquea a la
empresa con cierres pendientes" tiene que ejecutarse **desde la ruta HTTP y también desde la tarea
nocturna**. Si vive en el controller, hay que duplicarla, y el día que cambie una de las dos copias
queda desincronizada. Por eso la regla baja a `services/` y el controller solo traduce HTTP.

Regla simple para saber dónde va algo: si lo necesitarías igual sin un navegador de por medio, es un
service.

### 2. El `try/catch` sale de los controllers
Hoy cada controller repite el mismo `try/catch` y responde `{ error: error.message }`. Dos problemas
concretos:
- **Filtra información.** El `error.message` de Sequelize puede incluir nombres de columnas,
  restricciones y fragmentos de la consulta. Eso es un mapa del esquema regalado a quien provoque el
  error a propósito.
- **El formato depende de quién escribió el controller.** El cliente no puede reaccionar de forma
  consistente porque a veces recibe `{ success, data }`, a veces `{ error }`.

En Proxi el código lanza errores del catálogo y **un solo** `manejadorErrores` responde. Detalle en
`docs/04-manejo-de-errores.md`.

### 3. El middleware de autenticación devuelve el código correcto y trae el rol
El actual:
```js
catch (error) { return res.status(400).json({ error: error.message }); }
```
Un token ausente o vencido no es un 400 (petición malformada) sino un **401**, y un token válido de
alguien sin permiso es un **403**. El cliente distingue esos casos para decidir si refresca la sesión
o muestra "no tienes permiso"; con 400 para todo, no puede.

Además Proxi necesita `req.usuario = { id, rol }`, no solo `req.userId`: sin el rol en el token no se
puede escribir `autorizar('coordinacion')`.

### 4. Aparecen pruebas automatizadas
Solo `evaluacion_M6` tiene algo de pruebas. En Proxi son obligatorias en un punto concreto y no
negociable: **toda ruta con `:id` lleva una prueba donde otro usuario intenta acceder y recibe 404**.
El riesgo mayor del sistema es que alguien cambie un número en la URL y descargue el CV de otro
estudiante; esa prueba es la única defensa que no se olvida con el tiempo.

Ver ADR 0003 sobre qué herramienta de pruebas usar.

## Hábitos de la carpeta que conviene dejar atrás
- **Versionar `.env`.** Aparece en `toolshare-api`, `libro_autor_lib_M8_L2` y `peliculas-actores`. Si
  alguno de esos repos llegó a GitHub, esas credenciales hay que rotarlas. En Proxi `.env` está en
  `.gitignore` desde el primer commit.
- **Los `.zip` como control de versiones** (`M7_E1_L2.zip`, `l3.zip`, `mi_tiendita l4.zip`…). En Proxi
  el historial es git y las ramas: `git log` responde qué cambió y por qué; un zip no.
- **Capturas de pantalla dentro del código fuente** (`public/img/prueba base datos l3.png`). Sirven
  para entregar una tarea; en un repo de producto, las evidencias van en el README o en la carpeta de
  documentación, no mezcladas con los recursos de la aplicación.
