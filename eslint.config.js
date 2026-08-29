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
