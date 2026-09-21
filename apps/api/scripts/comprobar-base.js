// Comprueba que una base está lista para recibir Proxi, ANTES de desplegar contra ella.
// Uso: npm run comprobar-base -w apps/api   (lee DATABASE_URL del entorno o de .env.produccion)
//
// Existe porque las tres cosas que fallan al estrenar una base gestionada no fallan al conectarse,
// sino más tarde y de forma confusa: falta pgcrypto y revienta al guardar el primer RUT; el usuario
// no puede crear tablas y la migración muere a mitad; o quedan CV sin bytes tras migrarlos desde
// disco y responden 404 sin que nada avise (docs/07).
//
// Nunca imprime la cadena de conexión ni la clave: solo el host.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const leerDeArchivo = () => {
  const ruta = path.resolve(__dirname, '../../../.env.produccion');
  if (!fs.existsSync(ruta)) return '';
  const linea = fs.readFileSync(ruta, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  // Las comillas se las ponemos nosotros: sin ellas, el `&` de la URL de Neon parte la línea en la
  // terminal y la variable queda vacía sin ningún error.
  return linea ? linea.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '') : '';
};

const url = process.env.DATABASE_URL || leerDeArchivo();

const comprobaciones = [
  ['pgcrypto instalado', async (c) => (await c.query("SELECT 1 FROM pg_extension WHERE extname='pgcrypto'")).rowCount > 0],
  ['cifra y descifra un RUT', async (c) => {
    const r = await c.query("SELECT pgp_sym_decrypt(pgp_sym_encrypt('12345678-9','llave'),'llave') AS v");
    return r.rows[0].v === '12345678-9';
  }],
  ['el usuario puede crear y borrar tablas', async (c) => {
    await c.query('CREATE TABLE comprobacion_proxi (id int)');
    await c.query('DROP TABLE comprobacion_proxi');
    return true;
  }],
];

const correr = async () => {
  if (!url) throw new Error('No hay DATABASE_URL (ni en el entorno ni en .env.produccion).');
  console.log(`Servidor: ${new URL(url).hostname}`);

  const cliente = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
  await cliente.connect();
  console.log('OK   conexión con TLS verificado');

  let todoBien = true;
  for (const [que, probar] of comprobaciones) {
    let bien = false;
    try { bien = await probar(cliente); } catch (error) { bien = false; console.log(`     (${error.message})`); }
    if (!bien) todoBien = false;
    console.log(`${bien ? 'OK  ' : 'MAL '} ${que}`);
  }

  const tablas = await cliente.query("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'");
  console.log(`\nTablas: ${tablas.rows[0].n}`);

  if (tablas.rows[0].n > 0) {
    // Solo tiene sentido si ya se migró. Es la comprobación que pide docs/07 tras mover los CV a la
    // base: un CV sin bytes responde 404 aunque el estudiante lo vea listado en su panel.
    const sinBytes = await cliente.query(
      "SELECT count(*)::int n FROM archivos WHERE tipo='cv' AND contenido IS NULL AND expira_at IS NULL",
    );
    if (sinBytes.rows[0].n > 0) todoBien = false;
    console.log(`${sinBytes.rows[0].n === 0 ? 'OK  ' : 'MAL '} CV vigentes sin bytes: ${sinBytes.rows[0].n} (tiene que ser 0)`);
  }

  await cliente.end();
  console.log(todoBien ? '\nLa base está lista.' : '\nHay algo que arreglar antes de desplegar.');
  if (!todoBien) process.exitCode = 1;
};

correr().catch((error) => {
  console.log(`\nFALLÓ: ${error.message}`);
  process.exitCode = 1;
});
