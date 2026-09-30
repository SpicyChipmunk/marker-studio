// Makes inline styles in src/js and src/html follow the phone's text size (see the note at the top of
// src/css/01-base.css). Safe to run again: it only touches what hasn't been converted yet.
//
//   node scripts/textsize-codemod.mjs           rewrite the files in place, listing each change
//   node scripts/textsize-codemod.mjs --check   exit 1 if anything still needs converting
//
// Inside inline styles (style="…" attributes, cssText strings and style.fontSize = '…'):
//   font-size:Npx   ->  the matching type-scale variable (var(--t-sm) …), or calc(N*var(--tpx)); never below 12
//   font:W Npx/…    ->  the same, for the size inside the shorthand
//   height:Npx      ->  min-height:Npx, when the same style also sets a font size (a box holding text grows with it)
// Canvas text (ctx.font = …) and SVG font-size="…" attributes are left alone: they are drawings, not page text.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src/js', 'src/html'].map((d) => join(ROOT, d));
const MIN = 12;
const SCALE = { 12: 'sm', 13: 'base', 14: 'md', 16: 'lg', 19: 'xl', 24: '2xl' };

export function sizeFor(px) {
  const n = Math.max(MIN, +px);
  return SCALE[n] ? `var(--t-${SCALE[n]})` : `calc(${+n.toFixed(2)}*var(--tpx))`;
}

// one style declaration list (the text inside style="…" or a cssText string)
export function convertStyle(css) {
  let out = css.replace(/(^|[;{\s"'])(font-size\s*:\s*)(\d+(?:\.\d+)?)px/g, (_, pre, prop, n) => pre + prop + sizeFor(n));
  out = out.replace(/(^|[;{\s"'])(font\s*:\s*(?:[a-z-]+\s+|\d{3}\s+)*)(\d+(?:\.\d+)?)px/gi, (_, pre, prop, n) => pre + prop + sizeFor(n));
  if (/(^|[;{\s"'])font(-size)?\s*:/.test(out)) out = out.replace(/(^|[;{\s"'])height(\s*:\s*\d+(?:\.\d+)?px)/g, (_, pre, rest) => pre + 'min-height' + rest);
  return out;
}

// every inline style in a source file
export function convertSource(src) {
  return src
    .replace(/style=(\\?)(["'])([\s\S]*?)\1\2/g, (_, b, q, body) => "style=" + b + q + convertStyle(body) + b + q)
    .replace(/(cssText\s*[+]?=\s*)(["'])((?:\\.|(?!\2).)*)\2/g, (_, a, q, body) => a + q + convertStyle(body) + q)
    .replace(/(\.style\.fontSize\s*=\s*)(["'])(\d+(?:\.\d+)?)px\2/g, (_, a, q, n) => a + q + sizeFor(n) + q);
}

function files(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(js|html)$/.test(f) ? [p] : []; });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const check = process.argv.includes('--check');
  let changed = 0;
  for (const f of DIRS.flatMap(files)) {
    const src = readFileSync(f, 'utf8'), out = convertSource(src);
    if (out === src) continue;
    changed++;
    console.log((check ? 'needs converting: ' : 'converted: ') + relative(ROOT, f));
    if (!check) writeFileSync(f, out);
  }
  if (!changed) console.log('Inline styles already follow the text size.');
  if (check && changed) process.exit(1);
}
