// Builds the single-file app (index.html) from src/.
//
//   node scripts/build.mjs           write index.html
//   node scripts/build.mjs --check   exit 1 if index.html is out of date
//   node scripts/build.mjs --watch   rebuild whenever something in src/ changes
//
// The template (src/index.template.html) is plain text with three directives:
//   @@include(path)   the file's contents (one trailing newline dropped)
//   @@json(path)      the JSON file, minified
//   @@dataurl(path)   the file as a base64 data: URL
// Paths are relative to src/. No dependencies; the output is byte-for-byte what ships.
import { readFileSync, writeFileSync, watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'index.html');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function expand(text, seen = []) {
  return text.replace(/@@(include|json|dataurl)\(([^)\s]+)\)/g, (_, kind, rel) => {
    const file = join(SRC, rel);
    if (kind === 'dataurl') {
      const mime = MIME[extname(rel).toLowerCase()];
      if (!mime) throw new Error(`@@dataurl: unknown image type for ${rel}`);
      return `data:${mime};base64,` + readFileSync(file).toString('base64');
    }
    const body = readFileSync(file, 'utf8');
    if (kind === 'json') return JSON.stringify(JSON.parse(body));
    if (seen.includes(rel)) throw new Error(`@@include loop: ${[...seen, rel].join(' -> ')}`);
    return expand(body.replace(/\n$/, ''), [...seen, rel]);
  });
}

export function build() {
  return expand(readFileSync(join(SRC, 'index.template.html'), 'utf8'));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const arg = process.argv[2];
  if (arg === '--check') {
    let cur = '';
    try { cur = readFileSync(OUT, 'utf8'); } catch {}
    if (build() !== cur) { console.error('index.html is out of date with src/. Run: npm run build'); process.exit(1); }
    console.log('index.html is up to date.');
  } else {
    const run = () => { try { const html = build(); writeFileSync(OUT, html); console.log(`built index.html (${(html.length / 1024).toFixed(0)} KB)`); } catch (e) { console.error('build failed:', e.message); } };
    run();
    if (arg === '--watch') {
      let t = null;
      watch(SRC, { recursive: true }, () => { clearTimeout(t); t = setTimeout(run, 80); });
      console.log('watching src/ …');
    }
  }
}
