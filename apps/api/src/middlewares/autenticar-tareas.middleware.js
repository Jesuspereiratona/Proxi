const crypto = require('crypto');
const env = require('../config/env');
const { NoEncontrado } = require('../errors');
const { RUTA_NO_ENCONTRADA } = require('@proxi/errores');

// Esta ruta NO usa JWT. La llama un disparador externo (GitHub Actions, docs/07), que no es una
// persona, no tiene sesión y no puede refrescar un token de 15 minutos. Un rol nuevo en `usuarios`
// para un cron sería una cuenta con contraseña eterna: peor.
//
// El secreto se compara con timingSafeEqual sobre el SHA-256 de cada lado, no con ===. Dos motivos:
// === corta en el primer byte distinto y filtra por tiempo cuántos caracteres se acertaron, y
// timingSafeEqual a secas lanza si los largos difieren, lo que filtra el largo del secreto. El
// hash deja ambos lados en 32 bytes fijos.
const digerir = (valor) => crypto.createHash('sha256').update(String(valor)).digest();

const autenticarTareas = (req, res, next) => {
  // Sin TAREAS_TOKEN configurado la ruta no existe, y responde igual que cualquier URL inventada:
  // un 503 o un mensaje distinto confirmaría que el endpoint está ahí, esperando el secreto
  // correcto. Mismo criterio de no confirmar existencia que usa archivos.service.js.
  const esperado = env.tareasToken;
  if (!esperado) return next(new NoEncontrado(RUTA_NO_ENCONTRADA, 'El recurso solicitado no existe.'));

  const recibido = req.get('x-tareas-token') || '';
  if (!crypto.timingSafeEqual(digerir(recibido), digerir(esperado))) {
    // 404 y no 401: lo mismo. Quien no trae el secreto no tiene por qué enterarse de que acertó la
    // URL. El límite de tasa global (app.js) ya acota los intentos por IP.
    return next(new NoEncontrado(RUTA_NO_ENCONTRADA, 'El recurso solicitado no existe.'));
  }
  return next();
};

module.exports = autenticarTareas;
