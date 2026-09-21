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
    // apps/web/functions no corre en el navegador ni en Node: son Cloudflare Pages Functions, que
    // corren en el borde con la API de Workers (Request, Response, fetch, URL). Bloque propio para
    // no meter `Request`/`Response` en los globales del navegador, donde no se usan.
    files: ['apps/web/functions/**/*.js'],
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
