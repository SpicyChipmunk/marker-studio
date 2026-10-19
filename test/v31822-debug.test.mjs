// v318.22 debugging pass: the Ⅱ-grey rule by brand (Copic chosen, a stop in a code, a BG cap of now named); a change
// between two markers that show one code names both by their caps. Fails on v318.22's first build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function photo(caps, brand) {
  const a = createApp();
  return JSON.parse(
    a.__eval(
      '(function () { scanList = []; scanBrand = ' +
        JSON.stringify(brand || '') +
        '; ocrPhotos = 1;' +
        'const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: "" };' +
        'ocrRun = r; let id = 0; const lines = [];' +
        JSON.stringify(caps) +
        '.forEach((t, k) => { const x = 300 * (k % 6), y = 400 * Math.floor(k / 6), me = ++id;' +
        '  lines.push({ id: me, look: 1, text: t[0], conf: 0.97, unsure: false, nameOf: 0, box: [x, y, 60, 30, 0] });' +
        '  (t[1] || []).forEach((n, j) => lines.push({ id: ++id, look: 1, text: n, conf: 0.97, unsure: false, nameOf: me, box: [x, y + 30 + 20 * j, 80, 20, 0] })); });' +
        'lines.forEach((it) => ocrLine(r, it)); ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false }); clearTimeout(r.soon);' +
        'return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => mkey(e.i) + (e.how === "fixed" ? " as " + e.as : "") + (e.cv ? " cv " + e.cv : "")),' +
        ' asks: scanList.filter((e) => e.ask).map((e) => e.opts.map((o) => mkey(o.i)).join(",")) }); })()',
    ),
  );
}
const OLD = ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2', 'R6'].map(
  (c) => [c],
);

test('the Ⅱ-grey rule by brand: Copic chosen, a stop in a code, a BG cap of now with its name', () => {
  // (Copic chosen, too few caps to tell the photo's brand: Copic's BG05, as v318.21 read it)
  const a = photo([['BG期05'], ['E31']], 'Copic');
  assert.ok(a.list.includes('Copic|BG05') || a.asks.some((q) => /Copic\|BG05/.test(q)), JSON.stringify(a));
  assert.ok(!JSON.stringify(a).includes('B411'), JSON.stringify(a));
  // (a stop or a dash is no Ⅱ: BG05 as read)
  const b = photo(OLD.concat([['BG.05', ['Light Sea Blue']]]));
  assert.ok(
    b.list.some((k) => /^Ohuhu\|BG05/.test(k)) && !JSON.stringify(b).includes('B411'),
    JSON.stringify(b),
  );
  // (junk that may be a Ⅱ, with the BG cap of now's whole name: that cap, as it is now)
  const c = photo(OLD.concat([['BG期05', ['Light Sea Blue']]]));
  assert.ok(c.list.includes('Ohuhu|BG05 as BG期05 cv new'), JSON.stringify(c));
  assert.deepEqual(c.asks, []);
});

test('a change between two markers that show one code names both by their caps', () => {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  E(
    'state.owned = new Set(["Ohuhu|RV17","Ohuhu|R22","Ohuhu|R213"]); state.cap = {"Ohuhu|RV17":"old"}; state.capDef="";',
  );
  const by = {};
  E('sfCollection()').forEach((m) => (by[m.mkey] = m));
  t.coll = E('sfCollection()');
  // (after the change, the older cap's R22 gone from the guide: its * gone too)
  t.comps = [null, {}, {}];
  t.assignData = { assign: { 1: by['Ohuhu|R22'], 2: by['Ohuhu|R213'] }, order: [1, 2], N: 2 };
  const p = t.capPair(by['Ohuhu|RV17'], by['Ohuhu|R22']);
  assert.notEqual(p[0], p[1], JSON.stringify(p));
  assert.match(p[0], /^R22\*? \S/);
  assert.match(p[1], /^R22 \S/);
  // (two codes apart: as before, the labels alone)
  const q = t.capPair(by['Ohuhu|R22'], by['Ohuhu|R213']);
  assert.equal(JSON.stringify(q.slice(0, 2)), JSON.stringify(['R22', 'R213']));
});

test('second pass: Look closer reads under the photo’s own brand; a worker ended tells a closer look waiting on it', () => {
  const app = createApp();
  assert.equal(app.__eval('ocrBrandOf({ brand0: "", brands: { Ohuhu: 12 } })'), '');
  assert.equal(app.__eval('ocrBrandOf({ brands: { Ohuhu: 12 } })'), 'Ohuhu');
  const r = app.__eval(
    '(function () { let got = ""; ocrCl = { wait: { res: () => (got = "res"), rej: (e) => (got = "rej " + e.message) } };' +
      ' ocrEnd(); const w = ocrCl.wait; ocrCl = null; return got + (w === null ? " cleared" : ""); })()',
  );
  assert.equal(r, 'rej ended cleared');
});

test('(v318.22) a field a newer version wrote lives through this one’s save; a retired one doesn’t come back', async () => {
  const { memoryStorage } = await import('./harness.mjs');
  const ls = memoryStorage(),
    first = createApp({ localStorage: ls }),
    K = first.__eval('KEY');
  first.__eval('state.owned = new Set(["Ohuhu|R014"]); save(true)');
  // (a newer version's field, a field this one gave up writing, and a newer per-marker field the size a whole
  // collection's comes to: 364 entries, past the 4 KB a first version of this had capped it at)
  const raw = JSON.parse(ls.getItem(K));
  raw.zFuture = { keep: 'me' };
  raw.finderView = 'gone';
  raw.zBig = Object.fromEntries(
    first
      .__eval('COLORS.filter((c) => c.brand === "Ohuhu").map((c) => c.brand + "|" + c.code)')
      .map((k) => [k, 'old']),
  );
  ls.setItem(K, JSON.stringify(raw));
  const app = createApp({ localStorage: ls }),
    E = app.__eval,
    stored = () => JSON.parse(ls.getItem(K));
  E('save(true)');
  assert.deepEqual(stored().zFuture, { keep: 'me' });
  assert.equal(stored().finderView, undefined, 'a retired field is not put back');
  assert.equal(Object.keys(stored().zBig).length, 364, 'a large field is kept whole');
  assert.deepEqual(stored().owned, ['Ohuhu|R014']);
  // (and through its own next save, with nothing read in between)
  E('save(true)');
  assert.deepEqual(stored().zFuture, { keep: 'me' });
  // another tab adding a field while this one is open: through the storage event, and through save's own read
  const two = stored();
  two.zLater = 7;
  ls.setItem(K, JSON.stringify(two));
  E('syncFromStorage(); save(true)');
  assert.equal(stored().zLater, 7);
  const three = stored();
  three.zNoSync = 9;
  ls.setItem(K, JSON.stringify(three));
  E('save(true)');
  assert.equal(stored().zNoSync, 9, 'savedMerge’s own read of another tab’s save counts too');
  // (v318.22, fourth pass) as many fields as a newer version may add, of every size: 30, one a map over every marker
  // and one a list of 500 entries (a first version kept 20 and dropped the rest)
  const many = stored();
  const all = first.__eval('COLORS.map((c) => c.brand + "|" + c.code)');
  for (let k = 0; k < 28; k++) many['zMany' + k] = k;
  many.zNotes = Object.fromEntries(all.map((m) => [m, 'a note about it']));
  many.zLog = Array.from({ length: 500 }, (_, k) => ({ at: k, what: 'ticked' }));
  ls.setItem(K, JSON.stringify(many));
  const later = createApp({ localStorage: ls });
  later.__eval('save(true); state.owned.add("Ohuhu|R015"); save(true)');
  const kept = stored();
  assert.equal(Object.keys(kept).filter((k) => /^zMany/.test(k)).length, 28);
  assert.equal(Object.keys(kept.zNotes).length, all.length);
  assert.equal(kept.zLog.length, 500);
  // a stored "__proto__" is not carried, and nothing is polluted by it
  const four = JSON.parse(JSON.stringify(stored()).replace(/^\{/, '{"__proto__":{"polluted":1},'));
  ls.setItem(K, JSON.stringify(four));
  assert.match(ls.getItem(K), /"__proto__"/, 'the stored state really holds one');
  const last = createApp({ localStorage: ls });
  last.__eval('save(true)');
  assert.equal(last.__eval('JSON.stringify([({}).polluted, state.polluted])'), '[null,null]');
});

test('second pass: another tab’s save from before v318.21 (no caps) leaves what caps say here', async () => {
  const { memoryStorage } = await import('./harness.mjs');
  const ls = memoryStorage(),
    app = createApp({ localStorage: ls }),
    E = app.__eval,
    K = E('KEY');
  E(
    'state.owned = new Set(["Ohuhu|R213"]); state.cap = { "Ohuhu|R213": "old" }; state.capDef = "old"; state.capQ = 1; save(true)',
  );
  const raw = JSON.parse(ls.getItem(K));
  delete raw.cap;
  delete raw.capDef;
  delete raw.capQ;
  delete raw.capOffer;
  raw.wish = ['Ohuhu|R14'];
  ls.setItem(K, JSON.stringify(raw));
  E('syncFromStorage()');
  assert.equal(E('JSON.stringify([state.cap, state.capDef, state.capQ])'), '[{"Ohuhu|R213":"old"},"old",1]');
  // (a restore's put-back carries the offer's flag too)
  assert.equal(E('state.capOffer = 1; mkSnap().capOffer'), 1);
});
