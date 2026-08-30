// Rotura de vidrio: correr esto a mano durante un incidente (docs/09-procedimiento-de-brecha.md,
// paso 1 "Contener" — ej. JWT_ACCESS_SECRET expuesto). A propósito NO es un endpoint HTTP: uno
// autenticado por JWT sería vulnerable exactamente al secreto que esto existe para responder.
// Uso: npm run revocar-sesiones -w apps/api
const { sequelize } = require('../src/models');
const authService = require('../src/services/auth/auth.service');

authService
  .revocarTodasLasSesiones()
  .then((cantidad) => console.log(`${cantidad} sesión(es) revocada(s).`))
  .catch((error) => {
    console.error('No se pudo revocar:', error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
