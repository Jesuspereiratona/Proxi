# 05 · Convenciones

Existen para que el código se lea como si lo hubiera escrito una sola persona, y para que en seis
meses nadie tenga que adivinar.

## Idioma
Dominio y documentación en español (`oferta`, `postulacion`, `estudiante`). Palabras clave del
lenguaje y librerías en inglés. No se traduce `router`, `middleware` ni `service`. No se mezcla:
nunca `getOfertas` ni `obtenerOffers`.

## Nombres
| Elemento | Estilo | Ejemplo |
|---|---|---|
| Tablas y columnas | snake_case, tablas en plural | `postulacion_eventos`, `fecha_cierre` |
| Variables y funciones JS | camelCase | `cerrarOferta`, `fechaCierre` |
| Clases | PascalCase | `ErrorValidacion`, `Oferta` |
| Archivos de capa | `<recurso>.<capa>.js` | `ofertas.controller.js`, `ofertas.routes.js`, `auth.middleware.js` |
| Modelos Sequelize | PascalCase singular | `Oferta.js`, `Postulacion.js` |
| Otros archivos | kebab-case | `manejador-errores.js` |
| Constantes | SCREAMING_SNAKE | `ESTADOS_TERMINALES` |
| Rutas URL | plural, sin verbos | `/api/v1/ofertas/:id/postulaciones` |
| Ramas git | `tipo/descripcion-corta` | `feat/ciclo-vida-oferta` |

Las funciones de servicio se nombran con el verbo del dominio: `publicar`, `cerrar`, `postular`,
`validarEmpresa`. No `create`, `update`, `handle`. El nombre debe decir qué pasa en el negocio.

## Rutas de la API
Verbos HTTP para las operaciones, sustantivos en la URL. Cuando una acción no es un CRUD, se expresa
como subrecurso:
```
GET    /api/v1/ofertas                    lista pública (solo publicadas y vigentes)
POST   /api/v1/ofertas                    crea borrador (empresa)
PATCH  /api/v1/ofertas/:id                edita borrador
POST   /api/v1/ofertas/:id/publicacion    envía a revisión
POST   /api/v1/ofertas/:id/cierre         cierra con motivo
GET    /api/v1/ofertas/:id/postulaciones  postulantes (solo la empresa dueña)
```
Versión en la URL desde el día uno. Cambiar un contrato después sin versión rompe clientes.

## Estructura de un archivo de servicio
```js
// 1. imports
// 2. constantes del módulo (tabla de transiciones, límites)
// 3. funciones exportadas, la principal primero
// 4. helpers privados al final
```

## Commits
`tipo(alcance): mensaje en imperativo`
```
feat(ofertas): cerrar oferta exige motivo
fix(auth): rotar token de refresco al usarlo
docs(seguridad): agregar retención de CV
test(postulaciones): cubrir acceso cruzado entre estudiantes
refactor(errores): mover catálogo a packages
chore(deps): actualizar sequelize
```
Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.
Un commit hace una cosa. Si el mensaje necesita un "y", son dos commits.

## Ramas y fusiones
`main` siempre despliega. Nada se escribe directo en `main`.
Rama por funcionalidad, fusión cuando: pruebas en verde, `npm audit` limpio y la lista de seguridad de
`03-seguridad.md` revisada.

## Pruebas
- **Unitarias** para servicios: reglas de negocio y transiciones de estado, sin base de datos.
- **De integración** para rutas, con supertest y una base de pruebas.
- **Toda ruta con `:id` tiene una prueba de acceso cruzado** (otro usuario intenta y recibe 404).
- Nombres descriptivos: `describe('cerrar oferta')` → `it('rechaza el cierre sin motivo')`.
- Una funcionalidad sin pruebas de sus reglas no está terminada.

## Comentarios
Se comenta el **porqué**, no el qué. `// incrementa i` sobra. Esto no:
```js
// Se guarda el hash del token de refresco: si se filtra la base, los tokens no sirven.
```
Si un bloque necesita un párrafo para explicarse, probablemente hay que extraer una función con un
buen nombre.

## Dependencias
Antes de instalar algo, tres preguntas: ¿resuelve un problema que ya tenemos? ¿está mantenida?
¿cuánto pesa lo que arrastra? Cada dependencia es código ajeno con permisos de ejecución en nuestro
servidor. Se anota en la bitácora qué se instaló y para qué.
