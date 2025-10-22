const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        global: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        sessionStorage: 'readonly',
        
        // Web API types
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
        RequestInit: 'readonly',
        ResponseType: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLDivElement: 'readonly',
        URLSearchParams: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        DOMException: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        
        // Node.js types
        NodeJS: 'readonly',
        
        // React
        React: 'readonly',
        
        // Jest/Testing globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      // Disable some rules that are too strict for this project
      'no-unused-vars': 'off',
      'no-undef': 'error',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      '*.config.js',
      '*.config.mjs',
      'scripts/**', // Skip test runner script
    ],
  },
];