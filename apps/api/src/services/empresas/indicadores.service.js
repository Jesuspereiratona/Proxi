const { Empresa, EmpresaIndicador } = require('../../models');
const { NoEncontrado } = require('../../errors');
const { PERFIL_NO_ENCONTRADO } = require('@proxi/errores');

// Reglas de negocio fijas de la spec (docs/02-modelo-de-datos.md), no variables de entorno: no hay
// ningún escenario donde deban cambiar según el ambiente.
const UMBRAL_OFERTAS_CERRADAS = 3;
// tasaRespuesta y diasPromedioRespuesta tienen su propio denominador (postulaciones, no ofertas):
// el umbral de arriba no los protege. Una empresa con 3 ofertas cerradas y una sola postulación
// mostraría el trato de ese caso puntual con precisión de sub-segundo (auditoría de Fase 5).
const UMBRAL_POSTULACIONES = 5;

const redondear = (valor, decimales) => (valor == null ? null : Number(valor.toFixed(decimales)));

// La empresa puede existir sin fila todavía en la vista (se creó después del último REFRESH
// nocturno): se trata igual que "0 ofertas cerradas", no como un error. Y solo una empresa
// validada es públicamente visible (docs/03-seguridad.md): pendiente/rechazada/suspendida
// responden 404, igual que una empresa que no existe — no se confirma cuáles hay en cada estado.
const obtenerPublico = async (empresaId) => {
  const empresa = await Empresa.findOne({ where: { id: empresaId, estadoValidacion: 'validada' }, attributes: ['id'] });
  if (!empresa) throw new NoEncontrado(PERFIL_NO_ENCONTRADO, 'Esa empresa no existe.');

  const fila = await EmpresaIndicador.findByPk(empresaId);
  if (!fila || fila.ofertasCerradasTotal < UMBRAL_OFERTAS_CERRADAS) {
    return { empresaId: empresa.id, suficienteHistorial: false };
  }

  const resultado = {
    empresaId: empresa.id,
    suficienteHistorial: true,
    tasaCierreDeclarado: redondear(fila.tasaCierreDeclarado, 2),
    ofertasPublicadas12m: fila.ofertasPublicadas12m,
    calculadoAt: fila.calculadoAt,
  };
  if (fila.postulacionesTerminales >= UMBRAL_POSTULACIONES) {
    resultado.tasaRespuesta = redondear(fila.tasaRespuesta, 2);
  }
  if (fila.postulacionesConMovimiento >= UMBRAL_POSTULACIONES) {
    resultado.diasPromedioRespuesta = redondear(fila.diasPromedioRespuesta, 1);
  }
  return resultado;
};

// Coordinación ve el panorama completo, sin ningún filtro de umbral ni de validación: necesita
// gestionar, no una versión editorializada para el público.
const listarTodos = () => EmpresaIndicador.findAll({ include: [{ model: Empresa, attributes: ['razonSocial'] }] });

module.exports = { UMBRAL_OFERTAS_CERRADAS, UMBRAL_POSTULACIONES, obtenerPublico, listarTodos };
