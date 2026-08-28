---
name: nuevo-endpoint
description: Plantilla y lista de verificación para crear o modificar un endpoint de la API de Proxi. Úsala siempre que se agregue una ruta, se cambie una existente, se toque un controller, un service o un middleware de la API. Cubre validación, autorización, pertenencia, errores y pruebas obligatorias.
---

# Crear un endpoint en Proxi

El orden importa: cada capa se escribe sabiendo qué hace la siguiente. Escribir la ruta primero y
"después le pongo los permisos" es exactamente como se filtra un CV.

## Orden de trabajo

### 1. Esquema de validación
Antes que nada, qué entra. Lista blanca: lo que no está declarado se descarta, no se ignora.
```js
// validadores/ofertas.validador.js
const crearOferta = [
  body('titulo').isString().trim().isLength({ min: 10, max: 120 }),
  body('fechaCierre').isISO8601().toDate(),
  body('modalidad').isIn(['presencial', 'hibrida', 'remota']),
];
```

### 2. Servicio
Toda la regla vive aquí. Recibe datos planos, devuelve datos planos, lanza errores del catálogo.
Nunca toca `req` ni `res`.
```js
async function cerrar(ofertaId, { motivo }, usuario) {
  if (!motivo) throw new ErrorValidacion('OFERTA_SIN_MOTIVO_CIERRE', 'Indica por qué cierras la oferta.');

  return sequelize.transaction(async (t) => {
    // la pertenencia es parte de la consulta, no un if posterior
    const oferta = await Oferta.findOne({
      where: { id: ofertaId, empresaId: usuario.empresaId }, transaction: t,
    });
    if (!oferta) throw new NoEncontrado('OFERTA_NO_ENCONTRADA', 'Oferta no encontrada.');

    if (!puedeTransicionar(oferta.estado, 'cerrada', 'empresa')) {
      throw new Conflicto('OFERTA_TRANSICION_INVALIDA', 'Esa transición no está permitida.',
        { detalles: { estadoActual: oferta.estado } });
    }

    await oferta.update({ estado: 'cerrada', motivoCierre: motivo, resultadoDeclarado: true }, { transaction: t });
    await OfertaEvento.create({ ofertaId, estadoAnterior: oferta.estado, estadoNuevo: 'cerrada',
      actorUsuarioId: usuario.id, motivo }, { transaction: t });
    return oferta;
  });
}
```
El cambio de estado y su evento van en la **misma transacción**: si el evento falla y el estado
cambia igual, los indicadores de transparencia mienten y ya no hay cómo auditar.

### 3. Controller
Traduce HTTP y nada más. Sin `try/catch`: el envoltorio manda el error al manejador central.
```js
const cerrar = asyncHandler(async (req, res) => {
  const oferta = await ofertasService.cerrar(req.params.id, req.body, req.usuario);
  res.json(oferta);
});
```

### 4. Ruta
```js
router.post('/:id/cierre',
  autenticar,
  autorizar('empresa'),
  validar(validadores.cerrarOferta),
  ofertasController.cerrar);
```
El orden de los middlewares no es decorativo: primero saber **quién** es, luego si **puede**, luego si
lo que manda es **válido**. Validar antes de autenticar es gastar CPU con desconocidos.

## Antes de darlo por terminado
- [ ] Existe esquema de validación para toda entrada, incluidos parámetros de consulta
- [ ] `autenticar` y `autorizar(rol)` están puestos, salvo que la ruta sea deliberadamente pública
- [ ] Si hay `:id`, la pertenencia se verifica **dentro** del `where`, y la ausencia devuelve 404
- [ ] Los errores salen del catálogo (`docs/04-manejo-de-errores.md`); códigos nuevos agregados ahí
- [ ] La respuesta no incluye campos internos: nada de `password_hash`, `rut_cifrado` ni rutas de disco
- [ ] Existe prueba de camino feliz, de validación fallida y **de acceso cruzado con otro usuario**
- [ ] Si cambia estado, hay evento registrado en la misma transacción
- [ ] Si expone datos personales de terceros, queda registro en `auditoria_accesos`

La prueba de acceso cruzado no es opcional. El riesgo número uno de este proyecto es que alguien
cambie un id en la URL y lea el CV de otra persona.
