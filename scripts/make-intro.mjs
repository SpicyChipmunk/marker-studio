// The opening animation (v322), from the app icon (src/assets/icon.svg): the drop as a page not yet coloured (its
// sections a dark a little lighter than the ground, its lines as on the icon), and each section's colour on its own,
// laid on in turn, top to bottom. Writes:
//   src/html/intro.html          the animation's markup: the uncoloured drop, then a small SVG of its own for each
//                                section's colour (each is faded in on its own layer: an opacity animation the
//                                browser runs off the main thread, smooth while the app's script is still loading),
//                                then the lines on top. Its ids start ms-in- (one set of defs, shared)
//   src/assets/intro/plain.png   the uncoloured drop whole, 512 px: the launch screens' picture (scripts/launch.py)
//   node scripts/make-intro.mjs      (needs the dev dependency: npm install)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/assets/intro');
const N = 512;
const src = readFileSync(join(ROOT, 'src/assets/icon.svg'), 'utf8');
const open = src.slice(src.indexOf('<svg'), src.indexOf('</defs>') + 7).replace('width="1024" height="1024"', `width="${N}" height="${N}"`);
const body = src.slice(src.indexOf('</defs>') + 7, src.lastIndexOf('</svg>'));
// the parts, in the order the icon draws them
const gl = body.indexOf('<g filter="url(#gl)"'),
  glEnd = body.indexOf('</g>', gl) + 4,
  main = body.indexOf('<g clip-path="url(#cp)">', glEnd),
  mainEnd = body.lastIndexOf('</g>') + 4;
const ground = body.slice(0, gl),
  glowG = body.slice(gl, glEnd),
  mainG = body.slice(main, mainEnd),
  edge = body.slice(mainEnd);
const paths = (g) => [...g.matchAll(/<path [^>]*\/>/g)].map((m) => m[0]);
const glows = paths(glowG),
  mains = paths(mainG),
  fills = mains.filter((p) => !/fill="none"/.test(p) && !/url\(#shade\)/.test(p)),
  lines = mains.filter((p) => !fills.includes(p));
if (glows.length !== 12 || fills.length !== 12) throw new Error('expected 12 sections: ' + glows.length + ' ' + fills.length);
const glowOpen = glowG.slice(0, glowG.indexOf('>') + 1);
const DROP = 'M 512 140 C 586 262, 770 420, 770 608 C 770 758, 654 870, 512 870 C 370 870, 254 758, 254 608 C 254 420, 438 262, 512 140 Z';
// the inside of an uncoloured drop: a little lighter than the ground round it, so it reads as paper waiting
const INSIDE = '#211638';
const svg = (inner) => open + inner + '</svg>';
const layers = {
  base: svg(ground + `<path d="${DROP}" fill="${INSIDE}"/>`),
  top: svg('<g clip-path="url(#cp)">' + lines.join('') + '</g>' + edge),
  plain: svg(ground + `<path d="${DROP}" fill="${INSIDE}"/>` + '<g clip-path="url(#cp)">' + lines.join('') + '</g>' + edge),
};
// each section's middle, for the order: top to bottom
const mid = (p) => {
  const n = [...p.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [+m[1], +m[2]]);
  return n.reduce((s, q) => s + q[1], 0) / n.length;
};
const order = fills.map((p, i) => i).sort((a, b) => mid(fills[a]) - mid(fills[b]));
order.forEach((k, j) => {
  layers['f' + String(j).padStart(2, '0')] = svg(glowOpen + glows[k] + '</g><g clip-path="url(#cp)">' + fills[k] + '</g>');
});
// the markup: ids made the app's own, defs once (in the first), every layer a 1024 viewBox scaled by CSS
const own = (t) => t.replace(/id="(\w+)"/g, 'id="ms-in-$1"').replace(/url\(#(\w+)\)/g, 'url(#ms-in-$1)');
const defs = own(src.slice(src.indexOf('<defs>'), src.indexOf('</defs>') + 7));
const layer = (cls, inner, withDefs) =>
  `<svg class="${cls}" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">${withDefs ? defs : ''}${own(inner)}</svg>`;
let html =
  '<!-- (v322) the opening animation: made by scripts/make-intro.mjs from src/assets/icon.svg; don\'t edit by hand -->\n' +
  '<div id="msIntro" class="msintro" aria-hidden="true"><div class="msinicon">' +
  layer('msinl', ground + `<path d="${DROP}" fill="${INSIDE}"/>`, true);
order.forEach((k, j) => {
  html += layer('msinl msinf', glowOpen + glows[k] + '</g><g clip-path="url(#cp)">' + fills[k] + '</g>').replace(
    'class="msinl msinf"',
    `class="msinl msinf" style="--i:${j}"`,
  );
});
html += layer('msinl', '<g clip-path="url(#cp)">' + lines.join('') + '</g>' + edge) + '</div></div>\n';
writeFileSync(join(ROOT, 'src/html/intro.html'), html);
console.log('wrote src/html/intro.html', html.length, 'bytes');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: N, height: N } });
await p.setContent(`<html><body style="margin:0">${layers.plain}</body></html>`);
writeFileSync(join(OUT, 'plain.png'), await p.screenshot({ clip: { x: 0, y: 0, width: N, height: N } }));
console.log('wrote plain.png');
await b.close();
