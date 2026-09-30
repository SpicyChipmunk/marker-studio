// Text size follows the phone's setting: the inline-style codemod (scripts/textsize-codemod.mjs) and the CSS rule
// that every font size goes through the type scale, so nothing is left at a fixed pixel size by accident.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { convertStyle, convertSource, sizeFor } from '../scripts/textsize-codemod.mjs';

test('the codemod maps pixel sizes onto the type scale, never below 12px', () => {
  assert.equal(sizeFor(13), 'var(--t-base)');
  assert.equal(sizeFor(14), 'var(--t-md)');
  assert.equal(sizeFor(9), 'var(--t-sm)');
  assert.equal(sizeFor(15), 'calc(15*var(--tpx))');
  assert.equal(convertStyle('color:red;font-size:11px;height:46px;line-height:20px'), 'color:red;font-size:var(--t-sm);min-height:46px;line-height:20px');
  assert.equal(convertStyle('font:700 18px/1.2 sans-serif'), 'font:700 calc(18*var(--tpx))/1.2 sans-serif');
  // a box with no text size set keeps its fixed height (a swatch, a dot)
  assert.equal(convertStyle('width:10px;height:10px;background:#fff'), 'width:10px;height:10px;background:#fff');
});

test('the codemod rewrites inline styles only, and a second run changes nothing', () => {
  const src = `h+='<div style="font-size:10px;height:40px">'+x+'</div>';ctx.font='700 12px sans-serif';el.style.fontSize='14px';svg='<text font-size="9">';`;
  const once = convertSource(src);
  assert.equal(once, `h+='<div style="font-size:var(--t-sm);min-height:40px">'+x+'</div>';ctx.font='700 12px sans-serif';el.style.fontSize='var(--t-md)';svg='<text font-size="9">';`);
  assert.equal(convertSource(once), once);
});

test('the codemod finds inline sizes in Prettier-formatted source too (line breaks after = and +)', () => {
  const src = `el.style.cssText =\n  'color:red;font-size:10px';\nh +=\n  '<div style="font:700 18px/1.2 x">' +\n  x;\nb.style.fontSize = '14px';\n`;
  assert.equal(convertSource(src), `el.style.cssText =\n  'color:red;font-size:var(--t-sm)';\nh +=\n  '<div style="font:700 calc(18*var(--tpx))/1.2 x">' +\n  x;\nb.style.fontSize = 'var(--t-md)';\n`);
});

test('src/js and src/html are already converted (run: node scripts/textsize-codemod.mjs)', () => {
  const root = new URL('../src/', import.meta.url);
  const walk = (u) => readdirSync(u, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(new URL(d.name + '/', u)) : /\.(js|html)$/.test(d.name) ? [new URL(d.name, u)] : []);
  for (const f of [...walk(new URL('js/', root)), ...walk(new URL('html/', root))]) {
    const s = readFileSync(f, 'utf8');
    assert.equal(convertSource(s), s, f.pathname);
  }
});

test('CSS font sizes go through the type scale (plain px only for fixed badges and drawings)', () => {
  const dir = new URL('../src/css/', import.meta.url);
  const allowed = new Set(['12px']); // badges on swatches, zone numbers on the picture: fixed geometry, 12px minimum
  for (const f of readdirSync(dir)) {
    const css = readFileSync(new URL(f, dir), 'utf8');
    for (const m of css.matchAll(/font-size:\s*([\d.]+(?:px|rem))/g)) assert.ok(allowed.has(m[1]), `${f}: font-size:${m[1]}`);
  }
});
