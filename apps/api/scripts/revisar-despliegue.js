// Revision de humo del Proxi DESPLEGADO, por el mismo camino que usa el navegador: entra por el
// dominio de la web, asi que atraviesa el proxy del borde igual que una persona.
//
// Uso: node apps/api/scripts/revisar-despliegue.js https://proxi-88x.pages.dev <clave-demo>
//
// No reemplaza a `npm test`: aquella prueba el codigo, esta prueba el despliegue —proxy, CORS,
// cookies entre dominios, variables cargadas, base real. Son fallos que ninguna prueba unitaria
// puede ver, y los tres primeros que encontro fueron suposiciones MIAS equivocadas, no de la app.
const [, , BASE_ARG, CLAVE_ARG] = process.argv;
const WEB = (BASE_ARG || '').replace(/\/$/, '');
const CLAVE = CLAVE_ARG;
if (!WEB || !CLAVE) {
  console.error('Uso: node apps/api/scripts/revisar-despliegue.js <url-de-la-web> <clave-de-las-cuentas>');
  process.exit(1);
}
const API = `${WEB}/api/v1`;

// Titulo fijo para poder reconocer el borrador de comprobacion entre corridas.
const TITULO_DE_COMPROBACION = 'Comprobacion de despliegue (no publicar)';

let ok = 0;
let mal = 0;
let limitados = 0;
const fallos = [];

const revisar = async (nombre, fn) => {
  try {
    const detalle = await fn();
    console.log(`  OK   ${nombre}${detalle ? `  (${detalle})` : ''}`);
    ok += 1;
  } catch (error) {
    if (error instanceof LimiteDeIntentos) {
      console.log(`  ---  ${nombre}  (${error.message})`);
      limitados += 1;
      return;
    }
    console.log(`  MAL  ${nombre}  -> ${error.message}`);
    fallos.push(nombre);
    mal += 1;
  }
};

const pedir = async (metodo, ruta, { token, cuerpo, esperado = 200 } = {}) => {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (r.status !== esperado) throw new Error(`${metodo} ${ruta} dio ${r.status}, se esperaba ${esperado}`);
  return datos;
};

// Esta revision abre seis sesiones por corrida, y el limitador de intentos de login es estricto a
// proposito (protege contra fuerza bruta). Correrla varias veces seguidas lo dispara — eso NO es un
// fallo del despliegue, asi que se distingue con su propio mensaje en vez de contarse como error.
class LimiteDeIntentos extends Error {}

const entrar = async (quien) => {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${quien}@cuentas-proxi.test`, clave: CLAVE }),
  });
  if (r.status === 429) {
    const espera = Math.ceil(Number(r.headers.get('ratelimit-reset') || 0) / 60);
    throw new LimiteDeIntentos(`limite de intentos activo, vuelve en ~${espera} min (es la proteccion funcionando)`);
  }
  const datos = await r.json();
  if (!r.ok) throw new Error(`login de ${quien} -> ${r.status} ${JSON.stringify(datos.error)}`);
  return datos.accessToken;
};

// Todo dentro de una funcion async: apps/api es CommonJS (CLAUDE.md: no mezclar con ESM) y el
// `await` de primer nivel solo existe en modulos ES. Node lo dejaba pasar por su deteccion
// automatica, pero eslint no, y la convencion del proyecto manda.
const revisarDespliegue = async () => {
  console.log('\n=== 1. LA WEB SE SIRVE ===');
  for (const p of ['', 'login.html', 'registro.html', 'oferta.html', 'panel-estudiante.html', 'panel-empresa.html', 'panel-coordinacion.html', 'politica-privacidad.html']) {
    await revisar(`pagina /${p || '(inicio)'}`, async () => {
      const r = await fetch(`${WEB}/${p}`, { redirect: 'follow' });
      if (!r.ok) throw new Error(`http ${r.status}`);
    });
  }

  console.log('\n=== 2. VITRINA PUBLICA (sin sesion) ===');
  let primeraOferta;
  await revisar('lista de ofertas', async () => {
    const v = await pedir('GET', '/ofertas?limite=50');
    primeraOferta = v.ofertas[0];
    if (!v.total) throw new Error('la vitrina esta vacia');
    return `${v.total} ofertas`;
  });
  await revisar('detalle de una oferta', async () => {
    const o = await pedir('GET', `/ofertas/${primeraOferta.id}`);
    return o.titulo;
  });
  await revisar('perfil publico de la empresa', async () => {
    const e = await pedir('GET', `/empresas/${primeraOferta.empresaId}`);
    return e.nombre ?? e.razonSocial ?? 'ok';
  });
  await revisar('filtro por area funciona', async () => {
    const v = await pedir('GET', '/ofertas?area=audit');
    if (v.total === 0) throw new Error('el filtro no encontro nada');
    return `${v.total} con "audit"`;
  });
  await revisar('la vitrina NO expone datos privados', async () => {
    const campos = Object.keys(primeraOferta);
    const prohibidos = campos.filter((c) => /rut|email|correo|telefono/i.test(c));
    if (prohibidos.length) throw new Error(`expone ${prohibidos.join(', ')}`);
    return `${campos.length} campos, ninguno personal`;
  });

  console.log('\n=== 3. SESIONES ===');
  const tokens = {};
  for (const quien of ['coordinacion', 'empresa', 'empresa.pendiente', 'empresa.suspendida', 'estudiante', 'estudiante2']) {
    await revisar(`entra ${quien}`, async () => { tokens[quien] = await entrar(quien); });
  }
  await revisar('clave incorrecta se rechaza', () => pedir('POST', '/auth/login', { cuerpo: { email: 'empresa@cuentas-proxi.test', clave: 'incorrecta123' }, esperado: 401 }));

  console.log('\n=== 4. PANEL DE ESTUDIANTE ===');
  let miPostulacion;
  await revisar('ve sus postulaciones', async () => {
    const p = await pedir('GET', '/postulaciones/mias', { token: tokens.estudiante });
    const lista = p.postulaciones ?? p;
    miPostulacion = lista[0];
    return `${lista.length} postulaciones`;
  });
  await revisar('ve el detalle con su linea de tiempo', async () => {
    const d = await pedir('GET', `/postulaciones/${miPostulacion.id}`, { token: tokens.estudiante });
    return `estado: ${d.estado}`;
  });
  await revisar('descarga su propio CV', async () => {
    const datos = await pedir('GET', '/mi-cuenta/datos', { token: tokens.estudiante });
    if (!datos.cv) throw new Error('no tiene CV');
    const r = await fetch(`${API}/archivos/${datos.cv.id ?? miPostulacion.cvArchivoId}/descarga`, { headers: { Authorization: `Bearer ${tokens.estudiante}` } });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('no es un PDF');
    return `${bytes.length} bytes, PDF valido`;
  });
  await revisar('portabilidad: exporta todos sus datos', async () => {
    const d = await pedir('GET', '/mi-cuenta/datos', { token: tokens.estudiante });
    if (!d.perfil || !d.cuenta) throw new Error('faltan secciones');
    return `perfil, cuenta, cv y ${(d.postulaciones || []).length} postulaciones`;
  });

  console.log('\n=== 5. PERMISOS (lo que NO debe poder hacerse) ===');
  await revisar('estudiante2 NO ve la postulacion de estudiante', () => pedir('GET', `/postulaciones/${miPostulacion.id}`, { token: tokens.estudiante2, esperado: 404 }));
  await revisar('estudiante NO entra al panel de coordinacion', () => pedir('GET', '/empresas/pendientes', { token: tokens.estudiante, esperado: 403 }));
  await revisar('empresa NO entra al panel de coordinacion', () => pedir('GET', '/empresas/pendientes', { token: tokens.empresa, esperado: 403 }));
  await revisar('sin sesion NO se ven postulaciones', () => pedir('GET', '/postulaciones/mias', { esperado: 401 }));
  await revisar('empresa suspendida NO puede publicar', async () => {
    // Crear un BORRADOR si lo puede hacer, y esta bien: un borrador es privado y nunca llega a
    // nadie. El limite real esta al enviarlo a revision, que es el momento en que dejaria de ser
    // privado. Se comprueba ese, no el otro.
    //
    // El borrador se REUTILIZA entre corridas en vez de crear uno nuevo cada vez: la API no expone
    // borrar ofertas (a proposito — una oferta es historial), asi que crear uno por corrida iria
    // acumulando basura en el panel de esa empresa.
    const token = tokens['empresa.suspendida'];
    const mias = await pedir('GET', '/ofertas/mias', { token });
    const existente = (mias.ofertas ?? mias).find((o) => o.titulo === TITULO_DE_COMPROBACION);

    const borrador = existente ?? await pedir('POST', '/ofertas', {
      token,
      cuerpo: {
        titulo: TITULO_DE_COMPROBACION,
        descripcion: 'Borrador que usa revisar-despliegue.js. No se publica nunca: su empresa esta suspendida.',
        requisitos: 'Ninguno.',
        area: 'Comprobacion',
        modalidad: 'remota',
        jornada: 'parcial',
        remunerada: false,
        fechaCierre: new Date(Date.now() + 365 * 864e5).toISOString(),
      },
      esperado: 201,
    });

    await pedir('POST', `/ofertas/${borrador.id}/revision`, { token, esperado: 422 });
    return existente ? 'el borrador se queda en borrador' : 'el borrador se queda en borrador (creado ahora)';
  });

  console.log('\n=== 6. PANEL DE EMPRESA ===');
  await revisar('ve sus ofertas', async () => {
    const o = await pedir('GET', '/ofertas/mias', { token: tokens.empresa });
    return `${(o.ofertas ?? o).length} ofertas`;
  });
  await revisar('ve los postulantes de una oferta', async () => {
    const p = await pedir('GET', `/postulaciones/oferta/${primeraOferta.id}`, { token: tokens.empresa });
    return `${(p.postulaciones ?? p).length} postulantes`;
  });

  console.log('\n=== 7. PANEL DE COORDINACION ===');
  await revisar('ve empresas por validar', async () => {
    const e = await pedir('GET', '/empresas/pendientes', { token: tokens.coordinacion });
    return `${(e.empresas ?? e).length} pendientes`;
  });
  await revisar('ve ofertas por revisar', async () => {
    const o = await pedir('GET', '/ofertas/pendientes-revision', { token: tokens.coordinacion });
    return `${(o.ofertas ?? o).length} por revisar`;
  });
  await revisar('descifra un RUT (queda auditado)', async () => {
    const detalle = await pedir('GET', `/postulaciones/${miPostulacion.id}`, { token: tokens.coordinacion });
    const estudianteId = detalle.estudianteId ?? detalle.estudiante?.id;
    if (!estudianteId) throw new Error('no se pudo obtener el id del estudiante');
    const r = await pedir('GET', `/estudiantes/${estudianteId}/rut`, { token: tokens.coordinacion });
    if (!r.rut) throw new Error('no devolvio RUT');
    return 'descifrado correctamente';
  });

  console.log('\n=== 8. INFRAESTRUCTURA ===');
  await revisar('salud de la API', async () => {
    const s = await pedir('GET', '/salud');
    if (!s.baseDeDatos.ok) throw new Error('la base no responde');
    return `version ${s.version}`;
  });
  await revisar('las tareas nocturnas, sin errores', async () => {
    const s = await pedir('GET', '/salud');
    const conError = Object.entries(s.tareas).filter(([, t]) => t.huboError).map(([n]) => n);
    if (conError.length) throw new Error(`con error: ${conError.join(', ')}`);
    // ultimaEjecucionAt vive en memoria y vuelve a null en cada reinicio del proceso, a proposito
    // (tareas/cerrarOfertasVencidas.js). Tras un despliegue esta vacio y eso NO es un fallo: que
    // corran de verdad se comprueba en el flujo de GitHub Actions, no aca.
    const corridas = Object.values(s.tareas).filter((t) => t.ultimaEjecucionAt).length;
    return `${Object.keys(s.tareas).length} declaradas, ${corridas} con corrida en esta instancia`;
  });
  await revisar('el disparador de tareas rechaza sin secreto', () => pedir('POST', '/tareas/ejecucion', { esperado: 404 }));
  await revisar('encabezados de seguridad', async () => {
    const r = await fetch(`${API}/salud`);
    const faltan = ['strict-transport-security', 'x-content-type-options', 'content-security-policy'].filter((h) => !r.headers.get(h));
    if (faltan.length) throw new Error(`faltan: ${faltan.join(', ')}`);
    return 'HSTS, nosniff y CSP presentes';
  });
  await revisar('el registro esta apagado y lo dice claro', async () => {
    const r = await fetch(`${API}/auth/registro`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `prueba.${Date.now()}@uahurtado.cl`, clave: 'claveDePrueba123456', rol: 'estudiante', aceptaPolitica: true }),
    });
    const j = await r.json();
    if (j?.error?.codigo !== 'REGISTRO_NO_DISPONIBLE') throw new Error(`respondio ${r.status} ${JSON.stringify(j?.error?.codigo)}`);
    return 'REGISTRO_NO_DISPONIBLE, sin crear la cuenta';
  });

  console.log(`\n${'='.repeat(52)}`);
  console.log(`  ${ok} bien   ${mal} mal${limitados ? `   ${limitados} sin probar (limite de intentos)` : ''}`);
  if (mal) console.log(`  Fallan: ${fallos.join(' | ')}`);
  console.log('='.repeat(52));
};

revisarDespliegue().catch((error) => {
  console.error(`La revision no pudo terminar: ${error.message}`);
  process.exitCode = 1;
});
