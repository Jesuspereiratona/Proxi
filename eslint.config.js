module.exports = [
  {
    files: ['apps/**/*.js', 'packages/**/*.js'],
    ignores: ['apps/web/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        // Globales del runtime de Node 20 que usan los scripts de apps/api/scripts (fetch contra la
        // API desplegada, FormData/Blob para subir un CV en el script de datos de demostración).
        fetch: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        // Lo usa el apagado ordenado de server.js. Faltaba, y `npm run lint` venía fallando con
        // no-undef desde que se agregó ese temporizador (encontrado al preparar el despliegue).
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
  {
    // _worker.js no corre en el navegador ni en Node: corre en el borde de Cloudflare, con la API
    // de Workers (Request, fetch, URL). Bloque propio para no meter `Request` en los globales del
    // navegador, donde no se usa.
    files: ['apps/web/_worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        Request: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
  {
    // apps/web es JS de navegador con módulos ES nativos (specs/04-vitrina-publica/plan.md):
    // no puede ejecutar require()/module.exports sin un bundler, así que usa import/export en vez
    // de CommonJS. apps/api sigue en CommonJS puro; son runtimes separados, solo se hablan por HTTP.
    files: ['apps/web/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Intl: 'readonly',
        console: 'readonly',
        globalThis: 'writable',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        navigator: 'readonly',
        atob: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
];
