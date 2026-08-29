const tokens = require('../services/auth/tokens');

// A diferencia de autenticar.middleware.js, nunca bloquea: si no hay token, o es inválido, sigue
// como visitante anónimo (req.usuario queda undefined). Lo usa GET /ofertas/:id, donde el mismo
// endpoint es público pero la dueña o coordinación ven más que un visitante.
const autenticarOpcional = (req, res, next) => {
  const encabezado = req.headers.authorization || '';
  const [esquema, token] = encabezado.split(' ');
  if (esquema !== 'Bearer' || !token) return next();

  try {
    const payload = tokens.verificarAcceso(token);
    req.usuario = { id: payload.sub, rol: payload.rol };
  } catch {
    // token vencido o inválido: se trata como visitante anónimo, no se corta la petición.
  }
  next();
};

module.exports = autenticarOpcional;
