// v308 Palette (beta review, area 3): size, scheme and filter changes keep the palette you made (Undo brings it back);
// Undo into a photo's palette goes back to Photo; the first visit's preview follows your markers; saved palettes keep
// their scheme and open as it, asking before they replace Custom picks; no marker in play gives an empty card; sizes
// stop at what the markers in play can fill; Brands I'd buy stands in for an empty collection; a Library tile shows 16
// colours; Rainbow runs from red; Use in a guide doesn't save the palette; From photo keeps hues apart, keeps a big
// dark, stops instead of making colours up and puts its bands in order; "Photo looks dim" is offered on dim photos,
// not on a starry sky.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3';
function appWith(set, storage) {
  const a = createApp({ localStorage: storage || memoryStorage() });
  a.__eval('state.owned = new Set(); state.pool = null; state.ink = {}');
  if (set === 'ben') a.__eval('state.owned = new Set(defaultOwned())');
  else if (set)
    a.__eval(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
    );
  // no screen to draw on
  a.__eval(
    `showPalette = function () {}; chrome = function () {}; fullRender = function () {}; clearPalette = function () {};
     showCustom = function () {}; closeDialog = function () {}; renderRecent = function () {}; flashSaved = function () {};
     window.__toasts = []; toast = function (m) { window.__toasts.push(m); }`,
  );
  return a;
}
const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
function palState(E, h, n) {
  E(
    `state.mode = 'palette'; state.harmony = '${h}'; state.palSize = ${n}; state.palettes = []; state.palH = [];
     state.locked = []; state.seed = null; state.excluded = new Set(); state.pool = null; setPool(null)`,
  );
}

// ---- 1. Size, scheme and filter changes push; only a palette made that way is replaced ----

test('trying other sizes keeps the palette you made: 6, then 3, then Undo gives it back', () => {
  const a = appWith('ben'),
    E = a.__eval;
  palState(E, 'triadic', 4);
  E(`palPush(genPalette(4, 'triadic', {}), 24)`);
  E(`palPush(genPalette(4, 'triadic', {}), 24)`);
  const B = J(a, 'state.palettes[1]');
  E('setSize(6)');
  E('setSize(3)');
  assert.equal(E('state.palettes.length'), 3, 'the 6 was replaced by the 3; B kept');
  assert.deepEqual(J(a, 'state.palH'), ['triadic', 'triadic', 'triadic+']);
  E('undo()');
  assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), B, 'B is back');
  assert.equal(E('state.palSize'), 4);
  // a scheme change and a filter change are steps too, the second replacing the first
  E(`setHarmony('tetradic')`);
  E(`state.excluded = new Set(['Fluorescent']); filterChanged()`);
  assert.equal(E('state.palettes.length'), 3);
  E('undo()');
  assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), B);
  assert.equal(E('state.harmony'), 'triadic');
  // Generate's palette is yours: the next size change doesn't replace it
  // (as Generate's roll ends: its own step)
  E(`palPush(genPalette(5, 'triadic', paletteOpts()), 24)`);
  const G = J(a, 'state.palettes[state.palettes.length - 1]');
  E('setSize(5)');
  E('undo()');
  assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), G);
});

test('the made-by-itself mark is kept in saved data (an older app reads it as unknown)', () => {
  const ls = memoryStorage();
  const a = appWith('ben', ls),
    E = a.__eval;
  palState(E, 'split', 4);
  E(`palPush(genPalette(4, 'split', {}), 24); setSize(5)`);
  assert.deepEqual(J(a, 'state.palH'), ['split', 'split+']);
  E('save(true)');
  const b = createApp({ localStorage: memoryStorage({ [KEY]: ls.getItem(KEY) }) });
  assert.deepEqual(JSON.parse(b.__eval('JSON.stringify(state.palH)')), ['split', 'split+']);
  assert.equal(b.__eval(`palHarm('split+')`), 'split');
  assert.equal(b.__eval(`palAuto('split+')`), true);
  assert.equal(b.__eval(`palAuto('split')`), false);
});

// ---- 5. Undo into a photo's palette ----

test('Undo into a photo’s palette goes back to From photo (or past it, once its photo has gone)', () => {
  const a = appWith('ben'),
    E = a.__eval;
  palState(E, 'photo', 8);
  E(`_photoImg = { width: 10, height: 10 }`);
  E(`palPush(genPalette(8, 'complementary', {}), 20)`);
  E(`setHarmony('complementary')`);
  assert.equal(E('state.palettes.length'), 2);
  E('undo()');
  assert.equal(E('state.harmony'), 'photo', 'shown as From photo, not as Complementary');
  assert.equal(E('state.palSize'), 8);
  // a scheme's palette under Photo goes back to its scheme
  palState(E, 'triadic', 6);
  E(
    `palPush(genPalette(6, 'triadic', {}), 24); state.harmony = 'photo'; palPush(genPalette(8, 'complementary', {}), 20)`,
  );
  E('undo()');
  assert.equal(E('state.harmony'), 'triadic');
  // the photo gone (the page opened again): its palettes are skipped
  palState(E, 'mono', 4);
  E(`palPush(genPalette(4, 'mono', {}), 24); state.harmony = 'photo'; palPush(genPalette(6, 'complementary', {}), 20);
     palPush(genPalette(6, 'complementary', {}), 20); state.harmony = 'complementary'; palPush(genPalette(4, 'complementary', {}), 24);
     _photoImg = null`);
  E('undo()');
  assert.equal(E('state.palettes.length'), 1);
  assert.equal(E('state.harmony'), 'mono');
});

// ---- 2. The first visit's preview ----

test('the first visit’s preview is made again when your markers change (it kept markers you don’t own)', () => {
  const a = appWith(null),
    E = a.__eval;
  palState(E, 'triadic', 6);
  E('palPvOff = false; palPv = null');
  const p1 = J(a, 'palPreview()');
  assert.equal(p1.length, 6);
  E(`presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')).forEach((k) => state.owned.add(k))`);
  const p2 = J(a, 'palPreview()');
  assert.ok(
    J(a, `${JSON.stringify(p2)}.every((i) => isOwned(i))`),
    'all owned: ' + J(a, `${JSON.stringify(p2)}.map((i) => COLORS[i].code)`),
  );
  // a filter, and a selection, too
  E(
    `state.excluded = new Set(families.map((f) => f.name).filter((n) => n !== 'Blue' && n !== 'Red' && n !== 'Yellow'))`,
  );
  const p3 = J(a, 'palPreview()');
  assert.ok(J(a, `${JSON.stringify(p3)}.every((i) => inPool(i))`));
  // the same markers in play: the same preview
  assert.deepEqual(J(a, 'palPreview()'), p3);
});

// ---- 6. Saved palettes keep their scheme ----

test('a saved palette keeps its scheme and opens as it, as a new step; Custom’s and older ones open as Custom', () => {
  const a = appWith('ben'),
    E = a.__eval;
  E('disarm = function () {}; unownDisarm = function () {}');
  palState(E, 'tetradic', 8);
  E(`palPush(genPalette(8, 'tetradic', {}), 24)`);
  E('doSave()');
  const ent = J(a, 'state.saved[0]');
  assert.equal(ent.h, 'tetradic');
  assert.equal(ent.type, 'palette');
  palState(E, 'mono', 4);
  E(`palPush(genPalette(4, 'mono', {}), 24)`);
  E('loadSaved(state.saved[0])');
  assert.equal(E('state.harmony'), 'tetradic');
  assert.equal(E('state.palSize'), 8);
  assert.equal(E('state.palettes.length'), 2);
  assert.deepEqual(J(a, 'state.palettes[1].map(mkey)'), ent.keys);
  E('undo()');
  assert.equal(E('state.harmony'), 'mono', 'Undo goes back to the palette before');
  // one saved before v308 (no scheme): Custom picks, as before
  E(
    `state.saved.push({ id: 5, type: 'palette', name: 'Old', keys: ${JSON.stringify(ent.keys.slice(0, 5))} })`,
  );
  E(`state.customPal = []; loadSaved(state.saved[state.saved.length - 1])`);
  assert.equal(E('state.harmony'), 'custom');
  assert.equal(E('state.customPal.length'), 5);
  // a scheme name the app doesn't know is dropped when read
  assert.equal(E(`'h' in cleanSaved({ id: 3, type: 'palette', keys: [], h: 'loud' })`), false);
  assert.equal(E(`cleanSaved({ id: 3, type: 'palette', keys: [], h: 'rainbow' }).h`), 'rainbow');
});

test('opening a saved palette asks before it replaces Custom picks in progress', () => {
  const a = appWith('ben'),
    E = a.__eval;
  E(`disarm = function () {}; unownDisarm = function () {};
     window.__asks = []; SF = { askBox: function (t, x) { window.__asks.push([t, x]); return { then: function (f) { window.__ans = f; } }; } }`);
  E(`state.mode = 'palette'; state.harmony = 'custom'; state.palSize = 4;
     state.customPal = COLORS.map((c, i) => i).filter((i) => isOwned(i)).slice(0, 3).concat([null])`);
  const picks = J(a, 'state.customPal');
  E(
    `state.saved = [{ id: 9, type: 'palette', name: 'Sea', keys: COLORS.map((c, i) => i).filter((i) => isOwned(i)).slice(40, 46).map(mkey), h: 'custom' }]`,
  );
  E('loadSaved(state.saved[0])');
  assert.equal(E('window.__asks.length'), 1);
  assert.equal(E('window.__asks[0][0]'), 'Replace your Custom picks?');
  assert.match(E('window.__asks[0][1]'), /“Sea” replaces the 3 markers you’ve picked in Custom/);
  assert.deepEqual(J(a, 'state.customPal'), picks, 'nothing replaced yet');
  E(`window.__ans('stay')`);
  assert.deepEqual(J(a, 'state.customPal'), picks, 'Cancel keeps them');
  E(`loadSaved(state.saved[0]); window.__ans('go')`);
  assert.equal(E('state.customPal.length'), 6);
  // no picks, or picks that are this palette: opened without asking
  E(`window.__asks = []; loadSaved(state.saved[0])`);
  assert.equal(E('window.__asks.length'), 0);
});

// ---- 7. Filters that leave nothing ----

test('filters that leave no marker in play: an empty card, nothing to save or use, no “try fewer colours” toast', () => {
  const a = appWith('ben'),
    E = a.__eval;
  palState(E, 'complementary', 4);
  E(`palPush(genPalette(4, 'complementary', {}), 24)`);
  assert.equal(E('palNone()'), false);
  assert.equal(E('currentPaletteIdxs().length'), 4);
  E(
    `state.harmony = 'rainbow'; state.palSize = 8; state.excluded = new Set(families.map((f) => f.name)); filterChanged()`,
  );
  assert.equal(E('palNone()'), true);
  assert.equal(E('currentPaletteIdxs().length'), 0, 'Save, Save image and Use in a guide have nothing');
  assert.equal(E('window.__toasts.length'), 0);
  // a selection with nothing left in it
  E(`state.excluded = new Set(); setPool([COLORS.findIndex((c, i) => NOINK.has(i))].filter((i) => i >= 0))`);
  assert.equal(E('palNone()'), false, 'an empty selection is no selection');
  // Custom isn't filtered
  E(`state.excluded = new Set(families.map((f) => f.name)); state.harmony = 'custom'`);
  assert.equal(E('palNone()'), false);
});

// ---- 9. Sizes for small collections ----

test('sizes stop at what the markers in play can fill (Honolulu 24’s Monochrome at 10 had spanned three hues)', () => {
  const a = appWith('Honolulu 24'),
    E = a.__eval;
  const cap = E(`palCap('mono')`);
  assert.ok(cap >= 2 && cap <= 6, 'Monochrome ' + cap);
  palState(E, 'mono', 4);
  E('setSize(10)');
  assert.equal(E('state.palSize'), 4, '10 not offered');
  E('state.palSize = 10; palSizeFit()');
  assert.equal(E('state.palSize'), cap);
  // a scheme chosen with a size past its cap comes down to it
  palState(E, 'complementary', 8);
  E(`setHarmony('mono')`);
  assert.equal(E('state.palSize'), cap);
  // Ben's markers, Honolulu 120 and none owned: every size, as before
  for (const set of ['ben', 'Honolulu 120', null]) {
    const b = appWith(set);
    for (const [h, n] of [
      ['complementary', 8],
      ['analogous', 8],
      ['triadic', 10],
      ['split', 10],
      ['tetradic', 12],
      ['mono', 10],
    ])
      assert.equal(b.__eval(`palCap('${h}')`), n, `${set} ${h}`);
  }
  // never under a scheme's smallest size
  const c = appWith('36 Gray Tones');
  assert.equal(c.__eval(`palCap('tetradic')`), 4);
});

// ---- 10. Brands I'd buy with nothing owned ----

test('with no markers added, Brands I’d buy “Only Copic” keeps palettes to Copic', () => {
  const a = appWith(null),
    E = a.__eval;
  E(`state.buyBrands = ['Copic']`);
  for (const h of ['complementary', 'rainbow', 'mono']) {
    const p = J(a, `genPalette(6, '${h}', {})`);
    assert.ok(p && p.length >= 6, h);
    assert.deepEqual([...new Set(J(a, `${JSON.stringify(p)}.map((i) => COLORS[i].brand)`))], ['Copic'], h);
  }
  // once markers are owned, they decide
  E(`presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 24')).forEach((k) => state.owned.add(k))`);
  assert.deepEqual(
    [...new Set(J(a, `genPalette(6, 'complementary', {}).map((i) => COLORS[i].brand)`))],
    ['Ohuhu'],
  );
});

// ---- 11. Library tiles ----

test('a palette’s Library tile shows all 16 of its colours', () => {
  const a = appWith('ben'),
    E = a.__eval;
  const keys = J(a, `genPalette(16, 'rainbow', {}).map(mkey)`);
  const html = E(
    `libRowHTML({ id: 1, type: 'palette', name: 'R', keys: ${JSON.stringify(keys)}, ts: 1 }, false)`,
  );
  const strip = html.match(/<span class="sstrip">(.*?)<\/span><\/span>/)[1];
  assert.equal((strip.match(/<span style=/g) || []).length, 16);
});

// ---- 12. Rainbow from red ----

test('Rainbow runs from red round the wheel, and colours locked under another scheme take their place in it', () => {
  const a = appWith('ben'),
    E = a.__eval;
  const ordered = (p) => {
    const h = J(a, `${JSON.stringify(p)}.map((i) => LCH[i][2])`);
    let turns = 0;
    for (let k = 1; k < h.length; k++) if (h[k] < h[k - 1]) turns++;
    return turns <= 1;
  };
  const isRed = (i) => {
    const h = E(`LCH[${i}][2]`);
    return h < 50 || h > 345;
  };
  for (const n of [6, 8, 12, 16]) {
    for (const o of ['{}', '{ reroll: true }']) {
      const p = J(a, `genPalette(${n}, 'rainbow', ${o})`);
      assert.ok(isRed(p[0]), n + ': starts at red, not ' + E(`COLORS[${p[0]}].code`));
      assert.ok(ordered(p), n + ': in hue order');
    }
  }
  // two colours locked where a Triadic had them
  const t = J(a, `genPalette(6, 'triadic', {})`);
  const lk = { 0: t[2], 3: t[5] };
  const p = J(a, `genPalette(8, 'rainbow', { reroll: true, locked: ${JSON.stringify(lk)} })`);
  assert.ok(p.includes(t[2]) && p.includes(t[5]), 'kept');
  assert.ok(ordered(p.filter((i) => E(`LCH[${i}][1] >= GREY_C`))), 'in hue order with them');
});

// ---- 13. Use in a guide ----

test('Use in a guide doesn’t add the palette to the Library; one already there is used from there', () => {
  const a = appWith('ben'),
    E = a.__eval;
  E(`setMode = function () {}; window.__got = [];
     SF = { setNextPal: function (x) { window.__got.push(x); }, pickPhoto: function () {},
            recolourWith: function (x) { window.__got.push(x); return true; }, hasGuide: function () { return false; } }`);
  palState(E, 'split', 5);
  E(`palPush(genPalette(5, 'split', {}), 24); state.saved = []`);
  const idxs = J(a, 'state.palettes[0]');
  E(`useInGuideGo(${JSON.stringify(idxs)}, ${JSON.stringify(idxs)}.map(mkey), null, true)`);
  E(`useInGuideGo(${JSON.stringify(idxs)}, ${JSON.stringify(idxs)}.map(mkey), null, false)`);
  assert.equal(E('state.saved.length'), 0, 'nothing saved');
  const got = J(a, 'window.__got');
  assert.equal(got.length, 2);
  for (const g of got) {
    assert.deepEqual(g.keys, J(a, `${JSON.stringify(idxs)}.map(mkey)`));
    assert.equal(g.h, 'split');
    assert.equal(typeof g.name, 'string');
  }
  E(`window.__got = []; useInGuideGo([], [], { id: 77 }, true)`);
  assert.deepEqual(J(a, 'window.__got'), [77]);
});

// ---- 4. From photo ----

// an image for the harness's canvas: RGBA pixels it reads back exactly (no more than 9000 pixels: not scaled)
function img(a, w, h, fill) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...fill(x, y), 255], (y * w + x) * 4);
  const im = new (a.__eval('Image'))();
  im.src = 'data:image/x-mslabels;' + w + ',' + h + ',' + Buffer.from(d.buffer).toString('base64');
  return { im, d, w, h };
}
const mixC = (p, q, t) => p.map((v, k) => Math.round(v + (q[k] - v) * t));
// a sunset: a sky from violet through magenta and red to orange, a pale gold sun, and dark violet hills over the
// lower quarter and more
function sunset(a) {
  const W = 120,
    H = 75,
    sky = [
      [74, 44, 120],
      [160, 50, 110],
      [220, 60, 60],
      [245, 140, 60],
    ];
  return img(a, W, H, (x, y) => {
    const hill = H * 0.68 - 6 * Math.sin(x / 9);
    if (y > hill) return [38, 22, 48];
    if (Math.hypot(x - W * 0.55, y - H * 0.6) < 7) return [255, 226, 140];
    const t = (y / hill) * 3,
      k = Math.min(2, Math.floor(t));
    return mixC(sky[k], sky[k + 1], t - k);
  });
}
const lchOf = (a, pal) => J(a, `${JSON.stringify(pal)}.map((i) => LCH[i].slice())`);
const hueGap = (h1, h2) => Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));

test('From photo: a sunset’s colours keep their hues apart, and its dark hills (a quarter of it) are kept', () => {
  const a = appWith('ben'),
    s = sunset(a);
  const p4 = [...a.extractPhotoPalette(s.im, 4).markers],
    L4 = lchOf(a, p4).filter((l) => l[1] >= 15);
  // no two clear colours of much the same hue and lightness (v307.1: four reds)
  for (let i = 0; i < L4.length; i++)
    for (let j = i + 1; j < L4.length; j++)
      assert.ok(
        hueGap(L4[i][2], L4[j][2]) >= 20 || Math.abs(L4[i][0] - L4[j][0]) >= 20,
        'apart: ' + JSON.stringify([L4[i], L4[j]].map((l) => l.map(Math.round))),
      );
  const p8 = [...a.extractPhotoPalette(s.im, 8).markers];
  assert.ok(
    lchOf(a, p8).some((l) => l[0] < 30),
    'a dark for the hills: ' + J(a, `${JSON.stringify(p8)}.map((i) => COLORS[i].code)`),
  );
});

test('From photo: stops when the markers left are far from the photo’s colours, and says so; bands in hue order', () => {
  const a = appWith('Honolulu 24'),
    de = a.de2000,
    LAB = a.__eval('LAB');
  // three flat colours: a red, a green and a blue
  const three = img(a, 60, 30, (x) => (x < 20 ? [200, 40, 50] : x < 40 ? [60, 150, 70] : [40, 80, 180]));
  const r = a.extractPhotoPalette(three.im, 16),
    pal = [...r.markers];
  assert.ok(pal.length >= 3 && pal.length < 16, pal.length + ' markers');
  assert.equal(r.few, true);
  [...r.labs].forEach((l, k) => assert.ok(de(l, LAB[pal[k]]) <= 18, 'each within 18 of its colour'));
  // in hue order round the wheel (one turn at most), the near-greys after
  const L = lchOf(a, pal),
    clear = L.filter((l) => l[1] >= 12),
    h = clear.map((l) => l[2]);
  let turns = 0;
  for (let k = 1; k < h.length; k++) if (h[k] < h[k - 1]) turns++;
  assert.ok(turns <= 1, 'hue order: ' + h.map(Math.round));
  const firstGrey = L.findIndex((l) => l[1] < 12);
  if (firstGrey >= 0)
    assert.ok(
      L.slice(firstGrey).every((l) => l[1] < 12),
      'greys last',
    );
});

// ---- 14. Photo looks dim ----

function photoOffer(a, p) {
  return JSON.parse(
    a.__eval(`(function () { const d = new Uint8ClampedArray(${JSON.stringify([...p.d])}), q = photoWarm(d, ${p.w});
      return JSON.stringify(q && { warm: q.warm, L: q.lab[0] }); })()`),
  );
}
test('Photo looks dim: offered on a photo taken in the dark, not on a starry sky', () => {
  const a = appWith('ben');
  // deep space: black, with stars and small faint galaxies all over it
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const stars = new Map();
  for (let k = 0; k < 420; k++) stars.set(Math.floor(rnd() * 160 * 120), 110 + Math.floor(rnd() * 70));
  const space = img(a, 160, 120, (x, y) => {
    const v = stars.get(y * 160 + x);
    return v ? [v, v, v + 6] : [4, 4, 7];
  });
  assert.equal(photoOffer(a, space), null, 'nothing offered for space');
  // a house with white walls, a green field and a dusky sky, photographed in the dark (its walls L* about 28)
  const dk = 0.07;
  const night = img(a, 160, 120, (x, y) => {
    let c = y < 50 ? [150, 170, 210] : [120, 170, 100];
    if (x > 60 && x < 110 && y > 40 && y < 90) c = [245, 245, 240];
    if (x > 75 && x < 95 && y > 60 && y < 90) c = [150, 40, 30];
    return c.map((v) => Math.round(255 * Math.pow(Math.pow(v / 255, 2.2) * dk, 1 / 2.2)));
  });
  const o = photoOffer(a, night);
  assert.ok(o, 'offered');
  assert.equal(o.warm, false, 'dim, not warm');
  assert.ok(o.L >= 15 && o.L < 35, 'its whites dim: ' + o.L);
});
