// v305 show: the share card's title fits (one line, a little smaller, or two lines cut with "…"); the ribbon smooths
// many markers into bands; the keys' colour-family order; Colour along's list orders (Lightest first, Rainbow, By brand)
// while Home's Continue keeps lightest first; Save image's codes go automatic (on until every section is ticked) unless
// you've chosen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, core } from './harness.mjs';

const COLORS = app.__eval('COLORS'),
  FAM_ORDER = app.__eval('FAM_ORDER'),
  lab = app.__eval('hexToLab');
const mk = (c) => ({
  mkey: c.brand + '|' + c.code,
  code: c.code,
  brand: c.brand,
  hex: c.hex,
  name: c.name,
  lab: lab(c.hex),
});
const pick = (n, f = () => true) =>
  COLORS.filter((c) => !/colou?rless blender/i.test(c.name) && f(c))
    .slice(0, n)
    .map(mk);

// a guide of n sections, section l (1…n) in markers[l-1]
function guide(markers) {
  const n = markers.length,
    assign = {},
    order = [];
  core.comps = [null].concat(markers.map((m, i) => ({ area: 100 + i, cx: i, cy: 0 })));
  markers.forEach((m, i) => {
    assign[i + 1] = m;
    order.push(i + 1);
  });
  core.assignData = { assign, order, N: n, base: { ...assign } };
  core.colored = new Uint8Array(n + 1);
  return order;
}

// a measuring context: each letter half the font's size wide
const fakeG = () => ({
  font: '',
  measureText(t) {
    const px = parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]);
    return { width: String(t).length * px * 0.5 };
  },
});

test('the card’s title: one line when it fits, a little smaller, else two lines with the rest cut short by “…”', () => {
  const g = fakeG();
  let r = core.showTitleFit(g, 'Spectrum Siren', 900, 58);
  assert.deepEqual([...r.lines], ['Spectrum Siren']);
  assert.equal(r.fs, 58);
  // 34 letters × 29 = 986 > 900, at 82% 808: one line, smaller
  r = core.showTitleFit(g, 'A rather long name for a mandala!!', 900, 58);
  assert.equal(r.lines.length, 1);
  assert.ok(r.fs < 58);
  const long =
    'The great big spiral mandala with the jellyfish and the octopus and all their friends under the sea';
  r = core.showTitleFit(g, long, 600, 58);
  assert.equal(r.lines.length, 2, 'two lines at most');
  for (const l of r.lines) assert.ok(l.length * r.fs * 0.5 <= 600 + 0.01, 'inside the width: ' + l);
  assert.match(r.lines[1], /…$/, 'the rest cut short');
  // a single word longer than the line
  r = core.showTitleFit(g, 'Supercalifragilisticexpialidocious'.repeat(2), 300, 40);
  assert.equal(r.lines.length, 1);
  assert.ok(r.lines[0].length * r.fs * 0.5 <= 300 + 0.01);
  assert.match(r.lines[0], /…$/);
});

test('the ribbon: each marker its own colour up to 24, past that 24 bands', () => {
  guide(pick(10));
  assert.equal(core.showBands(core.showMarkers()).length, 10);
  const many = pick(60);
  guide(many);
  const b = core.showBands(core.showMarkers());
  assert.equal(b.length, 24);
  for (const c of b) assert.ok(c.every((v) => v >= 0 && v <= 255));
});

test('the keys’ order: colour families round the wheel, lightest first in each', () => {
  const ms = pick(80);
  const sorted = ms.slice().sort(core.famCmp);
  const fam = (m) => COLORS.find((c) => c.brand === m.brand && c.code === m.code).fam;
  for (let i = 1; i < sorted.length; i++) {
    const a = FAM_ORDER.indexOf(fam(sorted[i - 1])),
      b = FAM_ORDER.indexOf(fam(sorted[i]));
    assert.ok((a < 0 ? 99 : a) <= (b < 0 ? 99 : b), 'families in order');
    if (fam(sorted[i - 1]) === fam(sorted[i]))
      assert.ok(sorted[i - 1].lab[0] >= sorted[i].lab[0], 'lightest first');
  }
});

test('Colour along’s list orders; Home’s Continue still goes lightest first', () => {
  const ms = pick(6, (c) => c.brand === 'Ohuhu').concat(pick(6, (c) => c.brand === 'Copic'));
  guide(ms);
  const keys = (L) => [...L].map((e) => e.key);
  const light = keys(core.alongList());
  const lum = (h) => {
    const n = parseInt(h.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  const byKey = Object.fromEntries(ms.map((m) => [m.mkey, m]));
  for (let i = 1; i < light.length; i++)
    assert.ok(lum(byKey[light[i - 1]].hex) >= lum(byKey[light[i]].hex), 'lightest first');
  const rb = [...core.alongList('rainbow')].map((e) => e.m);
  for (let i = 1; i < rb.length; i++)
    assert.ok(core.famCmp(rb[i - 1], rb[i]) <= 0, 'rainbow: as the keys go');
  assert.notDeepEqual(
    rb.map((m) => m.mkey),
    light,
    'not the same as lightest first here',
  );
  const br = [...core.alongList('brand')].map((e) => e.m);
  assert.deepEqual(
    br.map((m) => m.brand),
    [
      'Copic',
      'Copic',
      'Copic',
      'Copic',
      'Copic',
      'Copic',
      'Ohuhu',
      'Ohuhu',
      'Ohuhu',
      'Ohuhu',
      'Ohuhu',
      'Ohuhu',
    ],
    'by brand',
  );
  for (let i = 1; i < br.length; i++)
    if (br[i].brand === br[i - 1].brand)
      assert.ok(br[i - 1].code.localeCompare(br[i].code, 'en', { numeric: true }) <= 0, 'by code');
  assert.equal(core.alongSort(), 'light', 'lightest first unless chosen');
});

test('Save image’s codes: on until every section is ticked, then off; a choice made is kept', () => {
  const order = guide(pick(5));
  core.exCodes = null;
  assert.equal(core.exCodesNow(), true, 'codes while there is colouring to do');
  order.slice(0, 4).forEach((l) => (core.colored[l] = 1));
  assert.equal(core.exCodesNow(), true);
  core.colored[order[4]] = 1;
  assert.equal(core.exCodesNow(), false, 'finished: the picture as it is');
  core.exCodes = true;
  assert.equal(core.exCodesNow(), true, 'your choice stands');
  core.colored[order[4]] = 0;
  core.exCodes = false;
  assert.equal(core.exCodesNow(), false);
  core.exCodes = null;
});
