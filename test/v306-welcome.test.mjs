// v306 (welcome branch): the welcome's picture. Its coloured guide without codes is a small picture of its own, the
// sample page's shape; it is in the app once; the flood and its undoing move in step; nothing runs over 15 s; reduced
// motion stops it; it shows only on a tall enough screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => new URL('../src/' + p, import.meta.url);
const css = readFileSync(src('css/07-home-onboarding.css'), 'utf8');

// a WebP's size (lossy VP8, or VP8L / VP8X)
function webpSize(b) {
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  const k = b.toString('ascii', 12, 16);
  if (k === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (k === 'VP8L') {
    const v = b.readUInt32LE(21);
    return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
  }
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
}
function pngSize(b) {
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('the welcome’s coloured sample: a small WebP, the sample page’s shape, embedded once', () => {
  const plain = readFileSync(src('assets/sample-plain.webp')),
    [w, h] = webpSize(plain),
    [pw, ph] = pngSize(readFileSync(src('assets/sample-jellyfish.png')));
  assert.ok(plain.length < 36 * 1024, 'about 30 KB (' + plain.length + ')');
  assert.ok(w >= 300 && h > w, w + '×' + h);
  assert.ok(Math.abs(w / h - pw / ph) < 0.001, 'the page’s shape, so the two lie exactly over each other');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
    b64 = plain.toString('base64');
  assert.equal(html.split(b64).length - 1, 1, 'in index.html once');
  // the picture's CSS matches its size
  assert.ok(css.includes(`aspect-ratio: ${h} / ${w}`) && css.includes(`aspect-ratio: ${w} / ${h}`));
});

// a @keyframes block's selectors and declarations: { '15.38%': 'transform: none; opacity: 1', ... }
function frames(name) {
  const m = css.match(new RegExp('@keyframes ' + name + ' \\{([\\s\\S]*?)\\n\\}'));
  assert.ok(m, name);
  const out = {};
  for (const [, sel, body] of m[1].matchAll(/([\d.%,\s]+)\{([^}]*)\}/g)) {
    const decl = body
      .split(';')
      .map((x) => x.trim())
      .filter((x) => x && !x.startsWith('animation-timing-function') && !x.startsWith('opacity'));
    for (const s of sel.split(',')) out[s.trim()] = decl.join('; ');
  }
  return out;
}

test('the flood’s move and its undoing have the same keyframes, so the guide stays still under its edge', () => {
  const a = frames('wcflood'),
    b = frames('wcflood2');
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  for (const k of Object.keys(a)) {
    if (a[k] === 'transform: none') assert.equal(b[k], 'transform: none', k);
    else {
      assert.equal(a[k], 'transform: translateY(-100%)', k);
      // the layer is 160% of the picture's height: the guide in it moves back by as much
      assert.equal(b[k], 'transform: translateY(160%)', k);
    }
  }
  assert.ok(/\.wcpicin > \.wcfl \{[^}]*top: -30%;[^}]*height: 160%;/.test(css));
  assert.ok(/\.wcard \.wcfl img \{[^}]*top: 18\.75%;[^}]*height: 62\.5%;/.test(css));
});

test('every welcome animation ends within 15 s, and none runs with reduced motion', () => {
  const runs = [...css.matchAll(/animation: (wc\w+) ([\d.]+)s(?: ([\d.]+)s)?/g)];
  assert.ok(runs.length >= 4);
  for (const [, n, d, delay] of runs) assert.ok(+d + +(delay || 0) <= 15, n + ' ends by 15 s');
  const rm = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g).join('\n');
  for (const s of ['.wcfl,', '.wcfl img,', '.wcfan i'])
    assert.ok(rm.includes(s), s + ' stopped with reduced motion');
});

test('the picture shows only from 761 px of height', () => {
  assert.ok(/\.wcpic \{\s*display: none;/.test(css));
  assert.ok(/@media \(min-height: 761px\) \{\s*\.wcpic \{\s*display: block;/.test(css));
});
