const rateLimit = require('express-rate-limit');
const { DemasiadasSolicitudes } = require('../errors');
const { DEMASIADAS_SOLICITUDES } = require('@proxi/errores');

// Un limitador propio, no el global. Montar `limitar-tasa.middleware` otra vez en esta ruta no abría
// un presupuesto nuevo: ese módulo exporta UNA instancia de rateLimit, ya montada en app.js, así que
// compartían store y clave y la subida solo descontaba dos unidades del mismo contador de 300
// (medido en la auditoría de seguridad, no supuesto).
//
// La clave es el id del usuario y no la IP: el límite global ya cubre la IP, y lo que hay que acotar
// acá es cuántos bytes puede dejar una CUENTA en la base. Una empresa cambia su logo unas pocas
// veces al año, así que diez por hora es holgado y sigue estando tres órdenes de magnitud por debajo
// de lo que permitía el contador compartido.
const limitarTasaLogo = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // La ruta va después de `autenticar`, así que req.usuario siempre existe. El ?? es para que un
  // error de orden en las rutas degrade a limitar por IP en vez de agrupar a todo el mundo bajo
  // la misma clave `undefined`.
  keyGenerator: (req) => String(req.usuario?.id ?? req.ip),
  handler: (req, res, next) => {
    next(new DemasiadasSolicitudes(DEMASIADAS_SOLICITUDES, 'Demasiados cambios de logo, espera un rato.'));
  },
});

module.exports = limitarTasaLogo;
