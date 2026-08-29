const { Op } = require('sequelize');
const { Oferta } = require('../../models');
const { ReglaDeNegocio } = require('../../errors');
const { EMPRESA_CIERRES_PENDIENTES, OFERTA_NO_VIGENTE } = require('@proxi/errores');
const env = require('../../config/env');

// Pura, sin base de datos: se prueba con fechas fijas.
const fechaLimiteDeclaracion = (ahora = new Date()) =>
  new Date(ahora.getTime() - env.plazoDeclararCierreDias * 24 * 60 * 60 * 1000);

// La usa services/empresas/empresas.service.js indirectamente: ofertas.service.enviarARevision()
// la llama antes de mover una oferta a en_revision (regla 4 de la spec).
const verificarCierresPendientes = async (empresaId, ahora = new Date()) => {
  const limite = fechaLimiteDeclaracion(ahora);
  const pendiente = await Oferta.findOne({
    where: { empresaId, estado: 'cerrada', resultadoDeclarado: false, cerradaAt: { [Op.lt]: limite } },
  });
  if (pendiente) {
    throw new ReglaDeNegocio(
      EMPRESA_CIERRES_PENDIENTES,
      'Tienes ofertas cerradas sin declarar resultado. Declara el resultado antes de enviar una oferta nueva a revisión.',
    );
  }
};

// Pura: recibe la oferta ya cargada, no consulta nada.
const verificarVigencia = (oferta, ahora = new Date()) => {
  if (oferta.estado !== 'publicada' || !oferta.fechaCierre || oferta.fechaCierre <= ahora) {
    throw new ReglaDeNegocio(OFERTA_NO_VIGENTE, 'Esa oferta no está vigente.');
  }
};

module.exports = { fechaLimiteDeclaracion, verificarCierresPendientes, verificarVigencia };
