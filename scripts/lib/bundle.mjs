// Shared by scripts/fingerprint.mjs and scripts/lint.mjs: rebuilds the JS and CSS exactly as
// scripts/build.mjs splices them into index.html, but keeps track of which source file each
// piece came from, so tools can report src/ file names and line numbers.
//
// Two views of the same code:
//   includes  the @@include'd files of one <script> (or <style>) block, in template order, joined
//             the way the build joins them (one trailing newline dropped, a newline in between).
//             Template glue such as `const COLORS=@@json(...)` is left out.
//   shipped   the whole block exactly as it appears in the built index.html, glue included.
// Every call checks its "shipped" text against a real build() of the same tree, so a change to
// build.mjs that this file doesn't mirror fails loudly instead of fingerprinting the wrong thing.
import { readFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const DIRECTIVE = /@@(include|json|dataurl)\(([^)\s]+)\)/g;

// Same rules as expand() in scripts/build.mjs.
function expand(src, text, seen = []) {
  return text.replace(DIRECTIVE, (_, kind, rel) => {
    const file = join(src, rel);
    if (kind === 'dataurl') {
      const mime = MIME[extname(rel).toLowerCase()];
      if (!mime) throw new Error(`@@dataurl: unknown image type for ${rel}`);
      return `data:${mime};base64,` + readFileSync(file).toString('base64');
    }
    const body = readFileSync(file, 'utf8');
    if (kind === 'json') return JSON.stringify(JSON.parse(body));
    if (seen.includes(rel)) throw new Error(`@@include loop: ${[...seen, rel].join(' -> ')}`);
    return expand(src, body.replace(/\n$/, ''), [...seen, rel]);
  });
}

// Expands one block of template text, recording where each top-level @@include landed.
// Returns { text, segments: [{ rel, start, end }] } with character offsets into text.
function expandTracked(src, blockText) {
  let out = '',
    last = 0;
  const segments = [];
  for (const m of blockText.matchAll(DIRECTIVE)) {
    out += blockText.slice(last, m.index);
    const piece = expand(src, m[0]);
    if (m[1] === 'include') segments.push({ rel: m[2], start: out.length, end: out.length + piece.length });
    out += piece;
    last = m.index + m[0].length;
  }
  out += blockText.slice(last);
  return { text: out, segments };
}

function blocksOf(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
  return [...html.matchAll(re)].map((m) => m[1]);
}

/**
 * Reads the template under `root` and returns the <script> (kind 'js') or <style> (kind 'css')
 * blocks: [{ shipped, shippedSegments, includes, includeSegments, files }].
 */
export async function blocks(root, kind) {
  root = resolve(root);
  const src = join(root, 'src');
  const tag = kind === 'css' ? 'style' : 'script';
  const ext = kind === 'css' ? '.css' : '.js';
  const template = readFileSync(join(src, 'index.template.html'), 'utf8');

  const out = blocksOf(template, tag).map((blockText) => {
    const shipped = expandTracked(src, blockText);
    const files = [...blockText.matchAll(DIRECTIVE)].filter((m) => m[1] === 'include').map((m) => m[2]);
    for (const rel of files) {
      if (extname(rel) !== ext) throw new Error(`unexpected @@include(${rel}) inside a <${tag}> block`);
    }
    // includes-only: the same files, joined as the build joins consecutive @@include lines
    let includes = '';
    const includeSegments = [];
    files.forEach((rel, i) => {
      if (i) includes += '\n';
      const piece = expand(src, `@@include(${rel})`);
      includeSegments.push({ rel, start: includes.length, end: includes.length + piece.length });
      includes += piece;
    });
    return { shipped: shipped.text, shippedSegments: shipped.segments, includes, includeSegments, files };
  });

  // Every file of this kind that the template includes must sit inside one of these blocks.
  const all = [...template.matchAll(DIRECTIVE)].filter((m) => m[1] === 'include' && extname(m[2]) === ext);
  const inBlocks = out.reduce((n, b) => n + b.files.length, 0);
  if (all.length !== inBlocks)
    throw new Error(`${all.length} ${ext} includes in the template but ${inBlocks} inside <${tag}> blocks`);

  // Cross-check against the real build of this tree.
  const { build } = await import(pathToFileURL(join(root, 'scripts', 'build.mjs')).href);
  const built = blocksOf(build(), tag);
  if (built.length !== out.length || built.some((b, i) => b !== out[i].shipped)) {
    throw new Error(
      `<${tag}> blocks rebuilt here differ from scripts/build.mjs output; update scripts/lib/bundle.mjs`,
    );
  }
  return out;
}

/** Maps a 1-based line of `text` to { rel, line } using segments from blocks(); rel is null for template glue. */
export function locate(text, segments, line) {
  let off = 0;
  for (let l = 1; l < line; l++) {
    off = text.indexOf('\n', off) + 1;
    if (off === 0) return { rel: null, line };
  }
  const seg = segments.find((s) => off >= s.start && off < s.end);
  if (!seg) return { rel: null, line };
  const before = text.slice(seg.start, off);
  let n = 1;
  for (const ch of before) if (ch === '\n') n++;
  return { rel: seg.rel, line: n };
}
