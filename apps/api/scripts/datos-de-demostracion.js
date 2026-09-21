// Llena un Proxi recién desplegado con ofertas y postulaciones para mostrarlo funcionando.
// Uso: node apps/api/scripts/datos-de-demostracion.js https://proxi-88x.pages.dev <clave>
//
// Va por HTTP contra la API, no por SQL, a propósito: así cada oferta pasa por su revisión y cada
// postulación por sus transiciones reales (services/*/estados.js). Datos inventados a mano pero por
// los caminos de verdad — si una regla se rompe, esto falla en vez de dejar filas imposibles.
//
// Idempotente por el lado de las cuentas (las crea el seed), NO por el de las ofertas: correrlo dos
// veces publica dos tandas. Es demostración, no producción.
const [, , BASE_ARG, CLAVE_ARG] = process.argv;
const BASE = (BASE_ARG || '').replace(/\/$/, '');
const CLAVE = CLAVE_ARG;
if (!BASE || !CLAVE) {
  console.error('Uso: node apps/api/scripts/datos-de-demostracion.js <url-de-la-web> <clave-de-las-cuentas>');
  process.exit(1);
}

const API = `${BASE}/api/v1`;
const correo = (quien) => `${quien}@cuentas-proxi.test`;

const pedir = async (metodo, ruta, { token, cuerpo } = {}) => {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    throw new Error(`${metodo} ${ruta} -> ${respuesta.status} ${JSON.stringify(datos?.error ?? datos)}`);
  }
  return datos;
};

const entrar = async (quien) => {
  const { accessToken } = await pedir('POST', '/auth/login', { cuerpo: { email: correo(quien), clave: CLAVE } });
  return accessToken;
};

// Un PDF mínimo pero REAL: archivos.service.js valida los primeros bytes (%PDF-), no la extensión
// ni el Content-Type que declara el cliente, así que un archivo de mentira sería rechazado. Sin CV
// no se puede postular —regla de la Fase 2— y es justo con lo que este script tropezó la primera
// vez que corrió contra producción.
const pdfDePrueba = (nombre) => {
  const texto = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj',
    `% CV de demostracion de ${nombre}`,
    'trailer << /Root 1 0 R >>',
    '%%EOF',
  ].join('\n');
  return new Blob([texto], { type: 'application/pdf' });
};

const subirCv = async (token, nombre) => {
  const formulario = new FormData();
  formulario.append('cv', pdfDePrueba(nombre), 'cv-demostracion.pdf');
  const respuesta = await fetch(`${API}/estudiantes/mi-cv`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formulario,
  });
  if (!respuesta.ok) throw new Error(`subir CV de ${nombre} -> ${respuesta.status} ${await respuesta.text()}`);
};

// Fecha de cierre a N días de hoy. La vitrina marca "urgente" a 3 días o menos, así que las ofertas
// de abajo están repartidas a propósito para que se vean los dos estados.
const enDias = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

const OFERTAS = [
  {
    titulo: 'Práctica en Control de Gestión',
    area: 'Control de gestión',
    modalidad: 'hibrida',
    comuna: 'Providencia',
    jornada: 'completa',
    remunerada: true,
    montoMensual: 450000,
    cupos: 2,
    dias: 25,
    descripcion: 'Apoyo al equipo de control de gestión en la preparación de reportería mensual, análisis de desviaciones presupuestarias y automatización de planillas de seguimiento.',
    requisitos: 'Estudiante de Ingeniería Comercial o Contador Auditor, desde 3er año. Excel intermedio. Deseable manejo de Power BI.',
  },
  {
    titulo: 'Práctica en Auditoría Financiera',
    area: 'Auditoría',
    modalidad: 'presencial',
    comuna: 'Las Condes',
    jornada: 'completa',
    remunerada: true,
    montoMensual: 500000,
    cupos: 3,
    dias: 18,
    descripcion: 'Participación en auditorías de estados financieros de clientes del sector retail y servicios, bajo supervisión de un auditor senior.',
    requisitos: 'Contador Auditor con 4to año cumplido. Conocimiento de IFRS. Disponibilidad de jornada completa por tres meses.',
  },
  {
    titulo: 'Práctica en Marketing Digital',
    area: 'Marketing',
    modalidad: 'remota',
    jornada: 'parcial',
    remunerada: true,
    montoMensual: 300000,
    cupos: 1,
    dias: 3,
    descripcion: 'Gestión de contenidos para redes sociales, análisis de métricas de campañas y apoyo en la elaboración del calendario editorial mensual.',
    requisitos: 'Estudiante de Ingeniería Comercial con interés en marketing. Manejo de Meta Business Suite y Google Analytics.',
  },
  {
    titulo: 'Práctica en Análisis de Datos',
    area: 'Análisis de datos',
    modalidad: 'hibrida',
    comuna: 'Santiago',
    jornada: 'parcial',
    remunerada: true,
    montoMensual: 400000,
    cupos: 2,
    dias: 40,
    descripcion: 'Construcción de tableros de seguimiento comercial y limpieza de bases de datos de clientes para el área de inteligencia de negocios.',
    requisitos: 'Desde 3er año. SQL básico y Excel avanzado. Deseable Python o R.',
  },
  {
    titulo: 'Práctica en Finanzas Corporativas',
    area: 'Finanzas',
    modalidad: 'presencial',
    comuna: 'Vitacura',
    jornada: 'completa',
    remunerada: false,
    cupos: 1,
    dias: 2,
    descripcion: 'Apoyo en la evaluación de proyectos de inversión, construcción de flujos de caja proyectados y análisis de sensibilidad.',
    requisitos: 'Ingeniería Comercial, 4to año. Manejo sólido de evaluación de proyectos (VAN, TIR). Excel avanzado.',
  },
  {
    titulo: 'Práctica en Recursos Humanos',
    area: 'Recursos humanos',
    modalidad: 'presencial',
    comuna: 'Ñuñoa',
    jornada: 'parcial',
    remunerada: true,
    montoMensual: 350000,
    cupos: 1,
    dias: 30,
    descripcion: 'Apoyo en procesos de reclutamiento y selección, y en la organización de actividades de clima laboral.',
    requisitos: 'Estudiante de Ingeniería Comercial o Psicología Organizacional, desde 3er año.',
  },
];

// Un recorrido distinto por postulación, para que el panel de empresa muestre varios estados a la
// vez y no cinco filas iguales. `oferta` es el índice dentro de OFERTAS.
const GUIONES = [
  { alumno: 'estudiante', oferta: 0, hasta: 'seleccionada', mensaje: 'Me interesa mucho el área de control de gestión; llevo dos cursos de costos y manejo Excel avanzado.' },
  { alumno: 'estudiante', oferta: 1, hasta: 'entrevista', mensaje: 'Estoy en 4to año de Contador Auditor y busco práctica en auditoría financiera.' },
  { alumno: 'estudiante2', oferta: 1, hasta: 'en_revision', mensaje: 'Tengo disponibilidad de jornada completa a partir del próximo mes.' },
  { alumno: 'estudiante2', oferta: 3, hasta: 'no_seleccionada', mensaje: 'Manejo SQL y he trabajado con Power BI en un ramo electivo.' },
  { alumno: 'estudiante', oferta: 5, hasta: 'recibida', mensaje: 'Me gustaría conocer el área de personas desde dentro.' },
];

const PASO_DEL_ESTADO = { en_revision: 'revision', entrevista: 'entrevista', seleccionada: 'seleccion' };
const ORDEN = ['en_revision', 'entrevista', 'seleccionada'];

const correr = async () => {
  console.log(`Contra ${API}\n`);
  const empresa = await entrar('empresa');
  const coordinacion = await entrar('coordinacion');
  const alumnos = { estudiante: await entrar('estudiante'), estudiante2: await entrar('estudiante2') };
  console.log('Sesiones abiertas: empresa, coordinación y dos estudiantes\n');

  console.log('Ofertas:');
  const publicadas = [];
  for (const { dias, ...datos } of OFERTAS) {
    // Los tres pasos reales: se crea en borrador, se manda a revisión, coordinación la aprueba.
    // Saltarse alguno dejaría una oferta publicada que nadie revisó, que es justo lo que la spec
    // de la Fase 3 existe para impedir.
    const oferta = await pedir('POST', '/ofertas', { token: empresa, cuerpo: { ...datos, fechaCierre: enDias(dias) } });
    await pedir('POST', `/ofertas/${oferta.id}/revision`, { token: empresa });
    await pedir('POST', `/ofertas/${oferta.id}/aprobacion`, { token: coordinacion });
    publicadas.push({ id: oferta.id, titulo: datos.titulo });
    console.log(`  ${datos.titulo.padEnd(36)} cierra en ${String(dias).padStart(2)} días`);
  }

  console.log('\nCV de los estudiantes:');
  for (const nombre of Object.keys(alumnos)) {
    await subirCv(alumnos[nombre], nombre);
    console.log(`  ${nombre}: CV subido`);
  }

  console.log('\nPostulaciones:');
  for (const { alumno, oferta, mensaje, hasta } of GUIONES) {
    const destino = publicadas[oferta];
    const token = alumnos[alumno];
    const postulacion = await pedir('POST', '/postulaciones', { token, cuerpo: { ofertaId: destino.id, mensaje } });

    if (hasta === 'no_seleccionada') {
      // Rechazar exige pasar antes por revisión: la empresa no puede descartar algo que no miró.
      await pedir('POST', `/postulaciones/${postulacion.id}/revision`, { token: empresa });
      await pedir('POST', `/postulaciones/${postulacion.id}/rechazo`, {
        token: empresa,
        cuerpo: { motivo: 'Buscamos a alguien con disponibilidad de jornada completa.' },
      });
    } else {
      for (const estado of ORDEN) {
        if (hasta === 'recibida') break;
        await pedir('POST', `/postulaciones/${postulacion.id}/${PASO_DEL_ESTADO[estado]}`, { token: empresa });
        if (estado === hasta) break;
      }
    }
    console.log(`  ${alumno.padEnd(12)} ${destino.titulo.padEnd(36)} -> ${hasta}`);
  }

  const vitrina = await pedir('GET', '/ofertas?limite=50');
  console.log(`\nListo. La vitrina pública muestra ${vitrina.total} oferta(s).`);
};

correr().catch((error) => {
  console.error(`\nFalló: ${error.message}`);
  process.exitCode = 1;
});
