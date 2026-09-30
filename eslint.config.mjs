// ESLint flat config. The app's JS is not a set of modules: src/js/*.js and src/js/guide/*.js are
// spliced by scripts/build.mjs into one classic <script> (plus a tiny second one), sharing one global
// scope, and the guide slices are pieces of a single function body. Linting them file by file would
// report every cross-file name as undefined and every cross-file helper as unused, and the guide
// closure's opening and closing lines live in src/index.template.html. So `npm run lint`
// (scripts/lint.mjs) lints the code as shipped, in one piece, under the virtual path below, and maps
// each message back to its src/ file and line.
import globals from 'globals';

/** Virtual file name scripts/lint.mjs hands to ESLint for the shipped script. */
export const BUNDLE_PATH = 'bundle/app.js';

export default [
  {
    // src/js is linted through the bundle only (see above); the rest isn't linted yet.
    ignores: ['node_modules/**', 'e2e/.artifacts/**', 'src/**', 'index.html', 'service-worker.js'],
  },
  {
    files: [BUNDLE_PATH],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // The guide module is published as `window.SF = (function(){...})()` and then read as bare `SF`.
        SF: 'readonly',
        // Element ids are never read as bare globals (the browser's named access on window): look them up
        // with $() / document.getElementById, so no-undef catches any that creep back.
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-undef': 'error',
      // the empty catch (e) / catch (_) blocks are deliberate (best-effort storage, optional APIs), so only
      // unused variables and parameters are reported, not unused caught errors
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-redeclare': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-var': 'off', // plenty of `var` today; revisit after formatting lands
    },
  },
];
