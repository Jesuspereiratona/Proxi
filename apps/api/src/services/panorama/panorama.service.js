const repo = require('../../repositories/panorama.repository');
const env = require('../../config/env');

// Panorama de coordinación (specs/14-panorama-de-coordinacion/spec.md).
//
// Se calcula al pedirlo, no se precalcula: la vista materializada de indicadores por empresa existe
// porque la consulta el público en cada visita a un perfil; esto lo mira coordinación unas veces al
// día y no justifica otra tabla que mantener sincronizada.

// Los siete estados de postulaciones.js, en el orden del proceso. Se declaran para que un estado
// sin ninguna postulación salga en cero en vez de faltar: un embudo al que le falta un escalón se
// lee mal, y "cero entrevistas" es justamente lo que hay que poder ver.
const ESTADOS_POSTULACION = [
  'recibida', 'en_revision', 'entrevista', 'seleccionada', 'no_seleccionada', 'sin_respuesta', 'retirada',
];
const ESTADOS_OFERTA = ['borrador', 'en_revision', 'publicada', 'cerrada', 'archivada'];
const ESTADOS_EMPRESA = ['pendiente', 'validada', 'rechazada', 'suspendida'];

const completar = (claves, conteos) => Object.fromEntries(claves.map((c) => [c, conteos[c] ?? 0]));

const obtener = async () => {
  // En paralelo: son cinco lecturas independientes y en serie sumarían cinco viajes a una base que
  // en producción está a un continente de distancia.
  const [ofertas, empresas, porArea, embudo, sinPostulantes] = await Promise.all([
    repo.contarOfertasPorEstado(),
    repo.contarEmpresasPorEstado(),
    repo.resumirPorArea(),
    repo.contarEmbudo(),
    repo.ofertasSinPostulantes(env.diasSinPostulantes),
  ]);

  const porEstado = completar(ESTADOS_POSTULACION, embudo);
  return {
    ofertas: completar(ESTADOS_OFERTA, ofertas),
    empresas: completar(ESTADOS_EMPRESA, empresas),
    porArea,
    embudo: porEstado,
    postulacionesTotal: Object.values(porEstado).reduce((suma, n) => suma + n, 0),
    ofertasSinPostulantes: sinPostulantes,
    diasSinPostulantes: env.diasSinPostulantes,
  };
};

module.exports = { obtener, ESTADOS_POSTULACION };
