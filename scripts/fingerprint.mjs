// Fingerprints the app's code so a formatting-only change can be proven harmless.
//
//   node scripts/fingerprint.mjs              JS: the whole <script> blocks as shipped (template glue such
//                                             as `const COLORS=...` and the guide closure's wrapper included)
//   node scripts/fingerprint.mjs --css        also the CSS (the @@include'd files of the <style> block)
//   node scripts/fingerprint.mjs --shipped    with --css: also the whole <style> block as shipped
//   node scripts/fingerprint.mjs --all        all of the above (what `npm run fingerprint` runs)
//   node scripts/fingerprint.mjs --includes   also JS "includes": only the @@include'd files, joined. Only
//                                             for trees older than the guide-closure move: since then
//                                             the guide's wrapper lines live in the template, so the files
//                                             alone are not one valid script and this view can't be computed.
//   options: --root DIR   fingerprint another checkout/copy (needs DIR/src and DIR/scripts/build.mjs)
//            --json       machine-readable output
//            --write DIR  also save the minified text, to diff two runs when fingerprints differ
//
// How: each block's code is joined exactly as scripts/build.mjs joins it (see scripts/lib/bundle.mjs),
// then re-printed by esbuild with whitespace minification ONLY (no renaming, no syntax rewrites,
// comments dropped). esbuild prints JS from its syntax tree, so layout, comments, semicolons, quote
// style and redundant parentheses all disappear, while any change to what the code actually says
// survives into the SHA-256. Same code in, same hash out, every run.
//
// CSS gets two hashes. "strict" is esbuild's whitespace-only output as is. "canonical" additionally
// evens out what esbuild keeps verbatim but Prettier rewrites (see canonicalCss below).
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { blocks } from './lib/bundle.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function minify(code, loader) {
  const r = await transform(code, {
    loader,
    minifyWhitespace: true,
    minifyIdentifiers: false,
    minifySyntax: false,
    legalComments: 'none',
    charset: 'utf8',
    target: 'esnext',
    logLevel: 'silent',
  });
  return { code: r.code, warnings: r.warnings.length };
}

// esbuild's whitespace-only CSS output keeps some things exactly as written that Prettier rewrites:
// number spellings (.5 / 0.5 / 0.50), the whitespace inside custom-property values and var() fallbacks
// (`--x: a, b`, `var(--y, 0px)`), the spaces around * and / inside calc()/min()/max()/clamp()
// (`calc(12*var(--tpx))` / `calc(12 * var(--tpx))`), and the space after the colon in an @supports
// condition (`(font: x)`). None of these changes what the browser computes (no script reads a custom
// property back as text), so the canonical view evens out just those, outside strings and url(), and
// leaves everything else exactly as esbuild printed it.
export function canonicalCss(css) {
  return (
    css
      // quoted strings (including quoted url("...") contents) and unquoted url(...) are kept as they are
      .split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|url\((?!\s*["'])[^)]*\))/)
      .map((part, i) => {
        if (i % 2) return part; // a string or url(): untouched
        // then `calc(2 * var(--x))` -> `calc(2*var(--x))`, see tightenMath
        return tightenMath(
          part
            .replace(/(?<![\w.#%-])(-?)\.(\d)/g, '$10.$2') // .5 -> 0.5
            .replace(/(\d\.\d*?)0+(?!\d)/g, '$1') // 0.50 -> 0.5, 1.0 -> 1.
            .replace(/(\d)\.(?!\d)/g, '$1') // 1. -> 1
            .replace(/,\s+/g, ',') // `a, b` -> `a,b` (esbuild already does this outside custom properties)
            .replace(/(--[\w-]+:)\s+/g, '$1') // `--x: v` -> `--x:v`
            .replace(/@supports[^{]*/g, (p) => p.replace(/:\s+/g, ':')), // `@supports (font: x)` -> `(font:x)`
        );
      })
      .join('')
  );
}

// Prettier puts spaces around `*` and `/` inside calc(), min(), max() and clamp(); esbuild keeps them
// as written. They mean nothing there (unlike the required spaces around + and -), so drop them, but
// only inside those functions, never in selectors, where ` * ` is a combinator plus the universal selector.
function tightenMath(css) {
  let out = '',
    depth = 0; // > 0 while inside a math function (nested parentheses included)
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (depth === 0) {
      const m = /^(?:calc|min|max|clamp)\(/.exec(css.slice(i, i + 6));
      if (m && !/[\w-]/.test(css[i - 1] || '')) {
        out += m[0];
        i += m[0].length - 1;
        depth = 1;
        continue;
      }
      out += c;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (/\s/.test(c)) {
      const prev = out[out.length - 1],
        next = css.slice(i).match(/^\s*(.)/)[1];
      if (prev === '*' || prev === '/' || next === '*' || next === '/') continue;
    }
    out += c;
  }
  return out;
}

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const bytes = (s) => Buffer.byteLength(s, 'utf8');

/** Fingerprint one view ('includes' or 'shipped') of the js or css blocks under root. */
export async function fingerprint(root, kind, view = 'includes') {
  const bs = await blocks(root, kind);
  const loader = kind === 'css' ? 'css' : 'js';
  const parts = [];
  let raw = 0,
    warnings = 0;
  for (const b of bs) {
    const text = view === 'shipped' ? b.shipped : b.includes;
    if (!text.trim()) continue;
    raw += bytes(text);
    const m = await minify(text, loader);
    warnings += m.warnings;
    parts.push(m.code);
  }
  // blocks stay separate (they are separate <script>/<style> elements); \0 can't occur in source text
  const min = parts.join('\0');
  const result = {
    kind,
    view,
    blocks: parts.length,
    files: bs.reduce((n, b) => n + b.files.length, 0),
    rawBytes: raw,
    minBytes: bytes(min),
    sha256: sha(min),
    esbuildWarnings: warnings,
    min,
  };
  if (kind === 'css') result.canonicalSha256 = sha(canonicalCss(min));
  return result;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const has = (f) => args.includes(f);
  const val = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
  const root = resolve(val('--root') || ROOT);
  const all = has('--all');
  const css = all || has('--css');
  const jobs = [];
  if (has('--includes')) jobs.push(['js', 'includes']);
  if (css) jobs.push(['css', 'includes']);
  jobs.push(['js', 'shipped']);
  if (css && (all || has('--shipped'))) jobs.push(['css', 'shipped']);
  const results = [];
  let failed = false;
  for (const [kind, view] of jobs) {
    try {
      results.push(await fingerprint(root, kind, view));
    } catch (e) {
      failed = true;
      const detail = e.errors
        ? e.errors.map((x) => `  ${x.location ? `line ${x.location.line}: ` : ''}${x.text}`).join('\n')
        : `  ${e.message}`;
      console.error(`${kind.toUpperCase()} ${view}: could not be fingerprinted\n${detail}`);
      if (view === 'includes' && kind === 'js') {
        console.error(
          "  (the included files alone do not form one valid script: since the guide closure's\n" +
            '   opening/closing lines moved, they live in src/index.template.html; compare the JS shipped view instead)',
        );
      }
    }
  }
  process.exitCode = failed ? 1 : 0;

  const writeDir = val('--write');
  if (writeDir) {
    mkdirSync(writeDir, { recursive: true });
    for (const r of results) {
      writeFileSync(
        join(writeDir, `${r.kind}-${r.view}.min.${r.kind}`),
        r.min.replaceAll('\0', '\n/* ---- next block ---- */\n'),
      );
    }
  }
  if (has('--json')) {
    console.log(
      JSON.stringify(
        results.map(({ min, ...r }) => r),
        null,
        2,
      ),
    );
  } else {
    console.log(`fingerprint of ${root}`);
    for (const r of results) {
      const label = `${r.kind.toUpperCase()} ${r.view}`.padEnd(13);
      const n = (x) => x.toLocaleString('en-US').padStart(9);
      console.log(
        `${label} ${String(r.files).padStart(2)} files, ${r.blocks} block(s)  raw ${n(r.rawBytes)} B  min ${n(r.minBytes)} B  ` +
          `sha256 ${r.sha256}` +
          (r.kind === 'css' ? ' (strict)' : '') +
          (r.esbuildWarnings ? `  [${r.esbuildWarnings} esbuild warnings]` : ''),
      );
      if (r.kind === 'css') console.log(`${' '.repeat(80)}sha256 ${r.canonicalSha256} (canonical)`);
    }
  }
}
