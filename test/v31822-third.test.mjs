// v318.22, the third debugging pass: codes typed into Scan kept (left in the box as Scan closes; with a brand tapped;
// a question gone once its marker is in); Tick colours on a chart saving only what was changed there and labelling
// markers by their caps; search by an older cap's name; To buy and the swatch chart by your caps' codes; the * on a
// swatch chart; a copy's name keeping a year; a locked colour kept the base of Generate; a Rainbow's base and its
// failure said; the photo's boxes drawn at Done as later. Each fails on v318.22's first build (68199d0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const J = (a, s) => JSON.parse(a.__eval('JSON.stringify(' + s + ')'));
// Scan: the brand set for you (auto) or tapped, cards caught
function scan(brand, chosen) {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval(`
    scanList = []; scanBrand = ${JSON.stringify(brand)}; scanBrandChosen = ${!!chosen};
    scanAutoB = ${chosen ? "''" : JSON.stringify(brand)}; scanSw = scanSwNew();
    window.__cards = []; scanSay = function (k, a, b, i, ch) { __cards.push({ k: k, big: String(a), small: String(b || ''), labels: ch ? ch.map((c) => c.label || c.head) : [] }); };
    window.__read = function (t, loud) { const n = scanHandle(t, !!loud); scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLastMany = { key: '', at: 0 }; return n; };`);
  return {
    read: (t, loud) => a.__eval('__read(' + JSON.stringify(t) + ',' + !!loud + ')'),
    closing: (t) =>
      a.__eval(
        'scanMute = true; try { __read(' + JSON.stringify(t) + ', false) } finally { scanMute = false }',
      ),
    asks: () => J(a, 'scanList.filter((e) => e.ask).map((e) => e.title)'),
    list: () => J(a, 'scanList.filter((e) => !e.ask).map((e) => mkey(e.i))'),
    last: () => J(a, '__cards[__cards.length - 1]'),
    a,
  };
}

test('Scan: a code typed and left in the box as Scan closes is asked in the list, not carded and lost', () => {
  const s = scan('Ohuhu', false);
  s.closing('RV10');
  assert.deepEqual(s.asks(), ['RV10: Copic’s, or an Ohuhu code misread (RV18, RV19)?']);
  // (Scan Text's read with the dialog open is still a card: the cap held still is read whole)
  const t = scan('Ohuhu', false);
  t.read('RV10', false);
  assert.deepEqual(t.asks(), []);
  assert.equal(t.last().small, 'Hold the cap still');
});

test('Scan with a brand tapped: another brand’s code typed is a question naming its marker, and the box clears', () => {
  const s = scan('Ohuhu', true);
  assert.equal(s.read('C-3', true), 1, 'read: the box clears');
  assert.equal(s.asks().length, 1);
  assert.match(s.asks()[0], /^Copic C-3 .*: add it\? Another brand than the one chosen \(Ohuhu\)$/);
  assert.equal(s.read('Y06', true), 1);
  assert.deepEqual(s.list(), ['Ohuhu|Y06']);
  assert.equal(s.asks().length, 1, 'C-3 still asked');
  // (a pasted list keeps its own wording)
  const p = scan('Ohuhu', true);
  p.read('B015\nC-3', true);
  assert.ok(
    p.asks().some((q) => /^Another brand than the one chosen \(Ohuhu\): add it\?$/.test(q)),
    p.asks().join(' | '),
  );
});

test('Scan: a question about another brand’s marker goes once that marker is in the list', () => {
  const s = scan('Ohuhu', false);
  s.read('RV10', true);
  assert.equal(s.asks().length, 1);
  s.a.__eval('scanTake(keyIdx("Copic|RV10"), "chosen", true)');
  assert.deepEqual(s.list(), ['Copic|RV10']);
  assert.deepEqual(s.asks(), [], 'not left waiting with its answer in');
});

test('Tick colours on a chart: Save changes only what was ticked there; markers labelled by your caps', () => {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval(
    'state.owned = new Set(["Ohuhu|R213","Ohuhu|B115"]); chartOn = new Set(state.owned); chartBase = new Set(state.owned);',
  );
  // (another tab added G36 meanwhile; Y26 ticked here)
  a.__eval('state.owned.add("Ohuhu|G36"); chartOn.add("Ohuhu|Y26")');
  assert.deepEqual(J(a, 'chartChanges()'), { add: ['Ohuhu|Y26'], del: [] });
  // (unticked here and still had: removed)
  a.__eval('chartOn.delete("Ohuhu|B115")');
  assert.deepEqual(J(a, 'chartChanges()'), { add: ['Ohuhu|Y26'], del: ['Ohuhu|B115'] });
  // labels: with older codes set, a marker not yet ticked shows its older cap's code (R23 on an older cap is R38 now)
  a.__eval('state.cap = {}; state.capDef = "old"');
  assert.equal(J(a, 'capCodeAny("Ohuhu|R38")'), 'R23');
  assert.equal(J(a, 'capCode("Ohuhu|R38")'), 'R38', 'elsewhere, one you don’t have shows the code sold now');
  a.__eval('state.capDef = ""');
  assert.equal(J(a, 'capCodeAny("Ohuhu|R38")'), 'R38');
});

test('Search finds a marker by its older cap’s name where its cap is shown older', () => {
  const a = createApp();
  a.__eval('state.owned = new Set(["Ohuhu|RV17"]); state.cap = { "Ohuhu|RV17": "old" }; state.capDef = ""');
  assert.equal(J(a, 'sMatch(keyIdx("Ohuhu|RV17"), "dark blush")'), true);
  a.__eval('state.cap = { "Ohuhu|RV17": "new" }');
  assert.equal(J(a, 'sMatch(keyIdx("Ohuhu|RV17"), "dark blush")'), false, 'not with the cap of now');
  a.__eval('state.owned = new Set(); state.cap = {}; state.capDef = "old"');
  assert.equal(J(a, 'sMatch(keyIdx("Ohuhu|R213"), "rose red")'), true, 'nor yours yet, with older codes set');
});

test('To buy and the swatch chart go by your caps’ codes; two boxes with one code: the older cap’s gets the *', () => {
  const a = createApp({ performance });
  a.__eval(
    'state.owned = new Set(["Ohuhu|R213"]); state.cap = {"Ohuhu|R213":"old"}; state.capDef = ""; state.wish = []; state.ink = {};',
  );
  a.__eval(
    'state.saved = [{ id: "g1", type: "guide", name: "Rose", ts: 1, keys: ["Ohuhu|R213"], fr: 2 }]; _gbuy = null;',
  );
  const g = J(a, 'guideBuys().want.map((x) => x.for)');
  assert.ok(g.length && g.every((f) => f.join() === 'R6'), JSON.stringify(g));
  // (Code order: as printed, R6 before R22 before RV260)
  a.__eval(
    'state.owned = new Set(["Ohuhu|R213","Ohuhu|RV17","Ohuhu|R22"]); state.cap = {"Ohuhu|R213":"old","Ohuhu|RV17":"old"}',
  );
  const idx = J(a, '["Ohuhu|R22","Ohuhu|RV17","Ohuhu|R213"].map(keyIdx)');
  const order = J(a, `swGroups(${JSON.stringify(idx)}, 'code').map((g) => g.idxs.map((i) => capCode(i)))`);
  assert.deepEqual(order.flat(), ['R6', 'R22', 'R22'], JSON.stringify(order));
  assert.deepEqual(J(a, `[...swStars(${JSON.stringify(idx)})].map((i) => mkey(i))`), ['Ohuhu|RV17']);
});

test('a copy’s name: a year in brackets is part of the name; a copy number is counted on', () => {
  const a = createApp();
  assert.equal(J(a, 'copyName("Garden (2024)", new Set(["garden (2024)"]))'), 'Garden (2024) (2)');
  assert.equal(J(a, 'copyName("Moss (2)", new Set(["moss", "moss (2)"]))'), 'Moss (3)');
});

test('Palette: with a colour locked, Generate keeps the scheme round it (Analogous’s neighbours stay near)', () => {
  const a = createApp({ localStorage: memoryStorage() });
  const E = a.__eval;
  E(
    'presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k)); state.pool = null; state.ink = {}',
  );
  E(
    'state.mode = "palette"; state.harmony = "analogous"; state.palSize = 5; state.palettes = []; state.locked = []; state.seed = null; state.excluded = new Set(); setPool(null)',
  );
  E(
    'window.__gen = function () { const pal = genPalette(state.palSize, state.harmony, Object.assign(paletteOpts(), { reroll: true })); if (pal) { state.palettes.push(pal); state.locked = state.locked.filter((i) => pal.includes(i)); } return pal; }',
  );
  let far = 0;
  for (let seed = 1; seed <= 6; seed++) {
    E(
      'state.palettes = []; state.locked = []; Math.random = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(' +
        seed * 7919 +
        ')',
    );
    const p = J(a, '__gen()');
    const lock = p[2];
    E('state.locked = [' + lock + ']');
    for (let k = 0; k < 5; k++) J(a, '__gen()');
    const near = J(
      a,
      `(function () { const p = state.palettes[state.palettes.length - 1]; return p.filter((i) => i !== ${lock}).map((i) => hueDist(LCH[i][2], LCH[${lock}][2])); })()`,
    );
    if (Math.min(...near) > 45) far++;
  }
  assert.equal(far, 0, 'every palette has a colour within 45° of the one locked');
});

test('Palette: a Rainbow from too few clear colours says so; built from a marker, its line names that base', () => {
  const a = createApp({ localStorage: memoryStorage() });
  const E = a.__eval;
  E(
    'window.__t = []; toast = function (m) { __t.push(m); }; state.harmony = "rainbow"; state.palSize = 6; state.pool = null',
  );
  E('palFailToast()');
  assert.match(J(a, '__t[0]'), /don’t have the 6 clear colours a rainbow needs/);
  // (built from a marker, its line names that base, wherever its hue puts it in the rainbow)
  E(
    'presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k)); state.seed = "Ohuhu|B111"',
  );
  const sub = J(a, 'palSub(genPalette(6, "rainbow", Object.assign(paletteOpts(), { reroll: true })))');
  assert.match(sub, /^Rainbow · Ohuhu .* base$/);
});

test('the photo’s boxes at Done are drawn as every later drawing is, outside its reading rules', () => {
  const a = createApp();
  const r = J(
    a,
    `(function () { scanList = []; scanBrand = ''; ocrPhotos = 1; const was = []; const o = ocrDraw; ocrDraw = function (r) { was.push(scanPhoto); };
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', cv: {}, img: { w: 1000, h: 800 } };
    ocrRun = r; ocrDone(r, { lines: [{ id: 1, look: 1, text: 'R10', conf: 0.97, unsure: false, nameOf: 0, box: [100, 100, 60, 30, 0] }], stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon); ocrDraw = o; return was; })()`,
  );
  assert.ok(r.length >= 1 && r[r.length - 1] === false, JSON.stringify(r));
});

// ---- the fourth pass: what it found in the third's fixes ----

test('Undo this photo gives back a question about another brand’s marker that the photo took', () => {
  const a = createApp({ localStorage: memoryStorage() });
  const r = J(
    a,
    `(function () {
    scanList = []; scanBrand = 'Ohuhu'; scanBrandChosen = false; scanAutoB = 'Ohuhu'; scanSw = scanSwNew(); ocrAnswered = [];
    scanTookAt.clear(); scanAnsweredAt.clear(); scanLast = { i: -1, at: 0 }; state.owned = new Set();
    scanSay = function () {};
    scanHandle('E000', true);
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '' };
    ocrRun = r; ocrPhotos = 1;
    const lines = ['E000', 'RV10', 'B0000', 'BG0000', 'C-1', 'C-3', 'E31', 'YG03'].map((t, k) => ({ id: k + 1, look: 1, text: t, conf: 0.9, unsure: false, nameOf: 0, box: [100 * k, 0, 60, 30, 0] }));
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    const took = scanList.some((e) => !e.ask && mkey(e.i) === 'Copic|E000');
    // (Undo this photo, as its button does)
    const mine = (e) => e.photo === r.n;
    scanList = scanList.filter((e) => !mine(e));
    ocrAnswered = ocrAnswered.filter((x) => { if (x.by !== r.n) return true; if (!mine(x.e)) scanList.splice(ocrGroupAt(x.e), 0, x.e); return false; });
    return { took: took, back: scanList.filter((e) => e.ask).map((e) => e.ask) };
  })()`,
  );
  assert.equal(r.took, true);
  assert.deepEqual(r.back, ['other Copic|E000']);
});

test('Look closer boxes each cap of a row at real spacing, its code read at any angle', () => {
  // (caps 64 px apart on the photo's 2048 copy, codes 64 × 28 read upright or slanted, the first three misread)
  for (const ang of [0, 90, -63]) {
    const a = createApp();
    const boxed = J(
      a,
      `(function () {
      scanList = []; scanBrand = ''; ocrPhotos = 1; ocrCloserList = [];
      const r = { n: 1, file: { name: 'x.jpg' }, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1536, h: 2048, ow: 3024, oh: 4032 } };
      ocrRun = r;
      const CODES = ['RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1'], MIS = ['RPX9', 'BRX8', 'YRX7'], xs = CODES.map((_, k) => 300 + 64 * k);
      let id = 0;
      const lines = CODES.map((t, k) => ({ id: ++id, look: 1, text: k < 3 ? MIS[k] : t, conf: k < 3 ? 0.5 : 0.97, unsure: k < 3, nameOf: 0, box: [xs[k], 1000, 64, 28, ${ang}] }));
      ['Y7', 'R10', 'YR2', 'R6'].forEach((t, k) => lines.push({ id: ++id, look: 1, text: t, conf: 0.97, unsure: false, nameOf: 0, box: [300 + 200 * k, 1600, 64, 28, ${ang}] }));
      lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);
      r.cv = {};
      const p = ocrCloserList[0];
      const got = { lines: [0, 1, 2, 3].map((k) => ({ id: 900 + k, look: 1, text: CODES[k], conf: 0.98, unsure: false, nameOf: 0, box: [xs[k] + 3, 1002, 64, 28, ${ang}], closer: true })) };
      ocrCloserMerge(p, got);
      ocrCloserBoxes(p, got, {});
      return xs.map((x) => [...r.items.values()].filter((it) => !it.nameOf && Math.abs(it.box[0] - x) < 6 && Math.abs(it.box[1] - 1000) < 6).length);
    })()`,
    );
    assert.deepEqual(boxed, [1, 1, 1, 1, 1, 1, 1], 'one box a cap at ' + ang + '°: ' + JSON.stringify(boxed));
  }
});

test('To buy’s From your guides names your marker as your cap now says, after the cap changes', () => {
  const a = createApp({ performance });
  a.__eval(
    'state.owned = new Set(["Ohuhu|R213"]); state.cap = {}; state.capDef = ""; state.wish = []; state.ink = {};',
  );
  a.__eval(
    'state.saved = [{ id: "g1", type: "guide", name: "Rose", ts: 1, keys: ["Ohuhu|R213"], fr: 2 }]; _gbuy = null;',
  );
  const f = () => J(a, 'guideBuys().want.map((x) => x.for.join())');
  assert.ok(
    f().every((x) => x === 'R213'),
    JSON.stringify(f()),
  );
  a.__eval('state.cap = { "Ohuhu|R213": "old" }');
  assert.ok(f().length && f().every((x) => x === 'R6'), JSON.stringify(f()));
});

test('Palette: a locked colour keeps its own place in every scheme; a Rainbow names its base only when built from it', () => {
  const a = createApp({ localStorage: memoryStorage() });
  const E = a.__eval;
  E(
    'presetMkeys(MARKER_SETS.find((s) => s.n === "Honolulu 120")).forEach((k) => state.owned.add(k)); state.pool = null; state.ink = {}; state.excluded = new Set(); setPool(null); state.seed = null',
  );
  // (the base worked out from a lock at the ends of an Analogous fan, and in a second hue's place: the slot there lands
  // on the lock's hue, as genSlots lays it out)
  for (const [h, n, pos] of [
    ['analogous', 5, 0],
    ['analogous', 5, 4],
    ['complementary', 6, 5],
    ['triadic', 6, 3],
  ]) {
    const d = J(
      a,
      `(function () { state.harmony = '${h}'; state.palSize = ${n}; const lock = COLORS.findIndex((c, i) => state.owned.has(mkey(i)) && LCH[i][1] >= GREY_C && LCH[i][2] > 200 && LCH[i][2] < 260);
      const pal = []; for (let p = 0; p < ${n}; p++) pal.push(p === ${pos} ? lock : COLORS.findIndex((c, i) => state.owned.has(mkey(i)) && !pal.includes(i) && i !== lock));
      state.palettes = [pal]; state.palH = ['${h}']; state.locked = [lock];
      const o = paletteOpts(), cx = genCtx('${h}', 'neutral', null); cx.bh = o.baseHue; const s = genSlots(cx, ${n});
      return hueDist(s.slots[${pos}].h, LCH[lock][2]); })()`,
    );
    assert.ok(d < 1, h + ' ' + n + ' place ' + pos + ': ' + d);
  }
  // Rainbow: one made before a marker in it was chosen to build from (back by Undo) doesn't say it's that base
  const r = J(
    a,
    `(function () { state.harmony = 'rainbow'; state.palSize = 6; state.locked = []; state.seed = null;
    const plain = genPalette(6, 'rainbow', Object.assign(paletteOpts(), { reroll: true }));
    state.seed = mkey(plain[2]);
    const seeded = genPalette(6, 'rainbow', Object.assign(paletteOpts(), { reroll: true }));
    return [palSub(plain), palSub(seeded)]; })()`,
  );
  assert.equal(r[0], 'Rainbow');
  assert.match(r[1], / base$/);
});

test('a copy’s name keeps a number of four figures or more', () => {
  const a = createApp();
  assert.equal(J(a, 'copyName("Kew (1759)", new Set())'), 'Kew (1759) (2)');
});

test('Saved fields: as many as a newer version may add are kept, past twenty', () => {
  const ls = memoryStorage(),
    a = createApp({ localStorage: ls }),
    K = a.__eval('KEY');
  a.__eval('save(true)');
  const raw = JSON.parse(ls.getItem(K));
  for (let k = 0; k < 40; k++) raw['zf' + k] = { k: k };
  ls.setItem(K, JSON.stringify(raw));
  const b = createApp({ localStorage: ls });
  b.__eval('save(true)');
  assert.equal(Object.keys(JSON.parse(ls.getItem(K))).filter((k) => /^zf/.test(k)).length, 40);
});
