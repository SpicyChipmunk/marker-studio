// The app icon (v318.30): an ink drop drawn like a colouring page, its sections in eleven colours of their own (each
// from its own colour family, touching ones well apart) and one left white. src/assets/icon.svg is the source, drawn
// once; src/assets/icon-maskable.svg is the same art at 86% for Android's masks (inside the 80% safe circle).
// This renders the PNGs from them:
//   node scripts/make-icons.mjs      (needs the dev dependency: npm install)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const any = readFileSync(join(ROOT, 'src/assets/icon.svg'), 'utf8'),
  mask = readFileSync(join(ROOT, 'src/assets/icon-maskable.svg'), 'utf8');
const sized = (s, n) => s.replace('width="1024" height="1024"', `width="${n}" height="${n}"`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
for (const [src, n, out] of [
  [any, 512, 'icon-512.png'],
  [any, 192, 'icon-192.png'],
  [any, 180, 'apple-touch-icon.png'],
  [mask, 512, 'icon-maskable-512.png'],
]) {
  await p.setContent(`<html><body style="margin:0">${sized(src, n)}</body></html>`);
  await p.screenshot({ path: join(ROOT, out), clip: { x: 0, y: 0, width: n, height: n } });
  console.log('wrote', out);
}
await b.close();
