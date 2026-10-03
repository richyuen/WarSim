// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import warsim from './tools/eslint/warsim-plugin.js';

/**
 * Math members that are not exactly specified by ECMAScript and may differ between
 * engines; the sim uses `sim/core/dmath` instead (SPEC §2.6, ADR-5).
 */
const NONDETERMINISTIC_MATH = [
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
  'asinh', 'acosh', 'atanh', 'exp', 'expm1', 'log', 'log1p', 'log2', 'log10', 'pow', 'cbrt',
  'hypot',
];

/** Globals that leak wall-clock time, host environment, GC timing or locale into the sim. */
const SIM_FORBIDDEN_GLOBALS = [
  'window', 'self', 'globalThis', 'document', 'navigator', 'location', 'Date', 'performance',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'queueMicrotask',
  'crypto', 'fetch', 'Worker', 'postMessage', 'localStorage', 'sessionStorage', 'indexedDB',
  'process', 'Intl', 'WeakRef', 'FinalizationRegistry', 'SharedArrayBuffer', 'Atomics',
].map((name) => ({ name, message: `'${name}' is forbidden in src/sim (SPEC §2.1/§2.6).` }));

export default tseslint.config(
  {
    ignores: [
      'dist/**', 'node_modules/**', 'reference/**', '.cache/**', 'coverage/**',
      'test-results/**', 'playwright-report/**', 'public/data/**',
      // Critic-owned output (CRITIC_PROMPT.md); not project source.
      'critic/**',
      // Deliberately-violating snippets; linted by tests/unit/lint-rules.test.ts.
      'tests/lint-fixtures/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    plugins: { warsim },
    rules: {
      'warsim/module-boundaries': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/app/**', 'src/ui/**', 'src/editor/**', 'src/render/**'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // i18n from day one (PROMPT.md, PLAN 0.21): no literal user-facing text in UI components.
    files: ['src/ui/**/*.tsx', 'src/editor/**/*.tsx', 'src/app/**/*.tsx'],
    ignores: ['src/app/bench/**'],
    rules: { 'warsim/no-literal-ui-string': 'error' },
  },
  {
    files: ['src/worker/**'],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    files: ['tools/**', 'tests/**', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Sim purity (SPEC §2.1, §2.6): the engine must be a pure deterministic function
    // of (state, commands, seed) in every JS engine.
    files: ['src/sim/**'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': ['error', ...SIM_FORBIDDEN_GLOBALS],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is unseeded; use the per-subsystem PCG32 streams in sim/core/rng.',
        },
        ...NONDETERMINISTIC_MATH.map((property) => ({
          object: 'Math',
          property,
          message: `Math.${property} is not bit-identical across engines; use sim/core/dmath.`,
        })),
        { property: 'localeCompare', message: 'Locale-dependent; compare ids or code points.' },
        { property: 'toLocaleString', message: 'Locale-dependent formatting is forbidden in the sim.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message: 'for-in iterates unordered/inherited keys; iterate ids in ascending order.',
        },
        {
          selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
          message: '`**` is Math.pow (not exactly specified); use dmath.pow or repeated multiplication.',
        },
        {
          selector: "VariableDeclarator[id.type='ObjectPattern'][init.type='Identifier'][init.name='Math']",
          message: 'Destructuring Math bypasses the determinism lint; call Math.* members directly.',
        },
        {
          selector: "MemberExpression[object.name='Math'][computed=true]",
          message: 'Computed Math access bypasses the determinism lint.',
        },
      ],
    },
  },
);
