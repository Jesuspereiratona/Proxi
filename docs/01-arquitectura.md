# 01 · Arquitectura

## Forma general
Monorepo con dos aplicaciones que se hablan solo por HTTP:

```
apps/api   API REST en Node + Express. Única dueña de la base de datos.
apps/web   Cliente en HTML/CSS/Bootstrap/JS que consume la API con fetch. No conoce la DB.
packages/  Código compartido por ambas (reglas de validación, catálogo de errores, constantes)
db/        Migraciones y datos de prueba
```

**Por qué separadas y no un monolito con plantillas:** el cliente y el servidor tienen ciclos de
vida distintos, la seguridad se razona mejor con una frontera explícita (CORS, tokens, límites de
tasa en un solo lugar), y la API queda reutilizable si mañana hay app móvil o un panel aparte.
Además cubre el Módulo 8 de la currícula, que pide exactamente una API REST con Express y JWT.

**Por qué monorepo y no dos repositorios:** un solo `git clone`, un solo historial, y las reglas de
validación se escriben una vez en `packages/` en lugar de duplicarse y desincronizarse.

## Capas de la API — el flujo va en un solo sentido

```
Petición HTTP
   ↓
routes/        Declara la URL y encadena middlewares. Cero lógica.
   ↓
middlewares/   Autenticación, autorización, validación de entrada, límite de tasa.
   ↓
controllers/   Traduce HTTP ↔ dominio: lee req, llama a UN servicio, arma la respuesta.
   ↓
services/      TODA la regla de negocio. Transiciones de estado, permisos de dominio, transacciones.
   ↓
repositories/  Consultas a la base. Único lugar donde aparece Sequelize.
   ↓
models/        Definición de tablas y relaciones.
```

### Las tres reglas de la arquitectura
1. **Un controller no consulta la base de datos.** Si ves un `Model.findAll` en un controller, está
   mal ubicado. El controller no sabe si los datos vienen de Postgres, de un archivo o de otra API.
2. **Un service no conoce `req` ni `res`.** Recibe datos planos y devuelve datos planos o lanza un
   error del catálogo. Así se puede probar sin levantar el servidor y reutilizar desde una tarea
   programada.
3. **Las capas no se saltan.** Un route no llama a un service directo, un service no llama a otro
   controller. Cuando se salta una capa es donde después aparece el bug de permisos.

### Estructura de `apps/api/src`
```
src/
├── config/          Lectura y validación de variables de entorno (falla al arrancar si falta una)
├── routes/          Un archivo por recurso: ofertas.routes.js, postulaciones.routes.js
├── middlewares/     autenticar.js, autorizar.js, validar.js, limitarTasa.js, manejadorErrores.js
├── controllers/
├── services/        Aquí vive el negocio. ofertas/estados.js define las transiciones válidas
├── repositories/
├── models/          Modelos Sequelize y asociaciones
├── errors/          Clases de error del catálogo (docs/04-manejo-de-errores.md)
├── tareas/          Trabajos programados: cerrar ofertas vencidas, marcar sin_respuesta
├── utils/           Helpers puros y sin estado
└── app.js / server.js   app.js arma Express (testeable); server.js solo escucha el puerto
```

**Por qué `app.js` y `server.js` separados:** las pruebas de integración importan `app` y le pegan
con supertest sin abrir un puerto real. Un archivo, cero puertos ocupados, pruebas paralelas.

### Estructura de `apps/web`
```
web/
├── index.html            Vitrina pública de ofertas vigentes
├── paginas/              Una carpeta por panel: estudiante/, empresa/, coordinacion/
├── assets/css/
├── assets/js/
│   ├── api/              Cliente HTTP: un módulo por recurso. Nadie llama fetch fuera de aquí
│   ├── componentes/      Piezas de UI reutilizables (tarjeta de oferta, insignia de estado)
│   └── paginas/          Lógica de cada pantalla
└── assets/img/
```
**Por qué todo `fetch` pasa por `assets/js/api/`:** el token, los encabezados, el manejo de 401 y la
traducción de códigos de error se resuelven en un solo lugar. Si se dispersan los `fetch`, la sesión
expirada se maneja distinto en cada pantalla y aparecen agujeros.

## Trabajos programados
Dos tareas nocturnas, en `apps/api/src/tareas/`, ejecutadas con `node-cron`:
- **`cerrarOfertasVencidas`**: ofertas `publicada` con `fecha_cierre` pasada → `cerrada`,
  `motivo_cierre = vencida`, `resultado_declarado = false`.
- **`marcarSinRespuesta`**: postulaciones sin movimiento pasado el SLA → `sin_respuesta`.

Ambas usan los mismos servicios que la API, no SQL propio: la regla de negocio vive en un solo lugar.
Ambas son idempotentes: correrlas dos veces no cambia nada.

## Qué NO se hace en la v1
Sin microservicios, sin cola de mensajes, sin Redis, sin GraphQL, sin Docker en producción si el
hosting no lo exige. Cada pieza extra es superficie de error y trabajo de mantenimiento. Se agregan
cuando exista un problema medido que las justifique, y se documenta en un ADR.
