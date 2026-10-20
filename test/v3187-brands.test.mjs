// v318.7 Scan: an old Ohuhu code that's a Copic code now is asked about with both (section 0); a list typed, pasted or
// opened is read as its own brand (section 1); with the brand set for you, the sweep that shows the other brand
// switches the reading to both brands, with Keep Ohuhu to take it back (section 6). Reads are made up here and go
// through scanHandle as Scan Text's, Enter's and a paste's do; cards are caught. Each test fails on v318.6.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage, cpuMs } from './harness.mjs';

// one app: every scenario starts afresh (reset). brand: the brand above the box; chosen: tapped (else set for you)
function studio() {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval(`
    var T = {};
    T.reset = function (brand, chosen, owned) {
      scanList = []; scanBrand = brand; scanBrandChosen = !!chosen; scanAutoB = chosen ? '' : brand;
      scanSw = scanSwNew(); scanLastBrand = ''; scanHandleId = 0; scanUnread = 0;
      scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLast = { i: -1, at: 0 };
      scanLastMany = { key: '', at: 0 };
      state.owned = new Set(owned || []);
      T.cards = [];
      scanSay = function (k, a, b, i, ch) { T.cards.push({ k: k, big: String(a), small: String(b || ''), labels: ch ? ch.map((c) => c.label || c.head) : [] }); };
    };
    // a read, as Scan Text's (quiet) or Enter's and a paste's (loud); the "still in view" state cleared after, as a
    // cap taken away is
    T.read = function (t, loud) { scanHandle(t, !!loud); scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLastMany = { key: '', at: 0 }; };
    T.again = function (t) { scanHandle(t, false); };
    T.set = (n) => { const i = MARKER_SETS.findIndex((p) => p.n === n); return presetMkeys(MARKER_SETS[i]).map((k) => COLORS[keyIdx(k)]); };
    T.key = (c) => c.brand + '|' + scanKey(c.code);
    T.list = () => scanList.filter((e) => !e.ask).map((e) => T.key(COLORS[e.i]));
    T.asks = () => scanList.filter((e) => e.ask).map((e) => e.title + ' [' + e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code + (o.how ? '/' + o.how : '')).join('|') + ']');
    T.last = () => T.cards[T.cards.length - 1] || { k: '', big: '', small: '', labels: [] };
    // reads: [{ t, k: the cap's marker or null for a misread }] → wrong (in the list, not a cap read), lost (neither
    // listed nor asked about), questions, the read the switch came at (0: none)
    T.sweep = function (reads, keepAt) {
      let at = 0;
      reads.forEach((r, n) => {
        T.read(r.t, r.loud);
        if (r.again) T.again(r.t);
        if (!at && scanSw.on) at = n + 1;
        if (keepAt !== undefined && scanSw.on && at && n + 1 - at >= keepAt && !T.kept) { scanSwitchOff(); T.kept = true; }
      });
      const truth = new Set(reads.map((r) => r.k).filter(Boolean)), list = T.list(),
        qs = scanList.filter((e) => e.ask), qOpts = new Set([].concat(...qs.map((e) => e.opts.map((o) => T.key(COLORS[o.i])))));
      return { wrong: list.filter((k) => !truth.has(k)), lost: [...truth].filter((k) => list.indexOf(k) < 0 && !qOpts.has(k)), q: qs.length, at: at, on: scanSw.on, list: list };
    };
    T.caps = (n, names, misread) => T.set(n).map((c) => { const m = misread && misread[c.code]; return m !== undefined ? { t: m, k: null } : { t: names ? c.code + ' ' + c.name : c.code, k: T.key(c) }; });
  `);
  const ev = (src) => JSON.parse(a.__eval('JSON.stringify((function () { ' + src + ' })())'));
  return {
    a,
    ev,
    reset: (brand, chosen, owned) =>
      a.__eval(
        'T.reset(' +
          JSON.stringify(brand) +
          ',' +
          !!chosen +
          ',' +
          JSON.stringify(owned || []) +
          '); T.kept = false;',
      ),
    read: (t, loud) => a.__eval('T.read(' + JSON.stringify(t) + ',' + !!loud + ')'),
    list: () => ev('return T.list();'),
    asks: () => ev('return T.asks();'),
    last: () => ev('return T.last();'),
    sweep: (mk, keepAt) =>
      ev(
        'return T.sweep((function () { ' + mk + ' })()' + (keepAt === undefined ? '' : ', ' + keepAt) + ');',
      ),
    sw: () =>
      ev(
        'return { on: scanSw.on, off: scanSw.off, row: scanSw.row, brand: scanBrand, whole: scanSw.whole.size, other: scanSw.other.size, autoOnly: scanSw.autoOnly };',
      ),
  };
}

/* ---- section 0: an old Ohuhu code that's a Copic code now ---- */

test('the ten old Ohuhu codes that are Copic codes now: with Ohuhu chosen, asked with both, the Ohuhu marker first; Either asks both; Copic as before', () => {
  const s = studio();
  const rows = s.ev(
    `const out = {}; for (const k of ['Y13','R21','R11','R17','R24','Y11','R20','R29','R30','YR20']) { out[k] = {}; for (const b of ['', 'Ohuhu', 'Copic']) { const r = scanRead(k, b); out[k][b || 'Either'] = { asked: r.codes.map((c) => c.asked).join(), opts: [].concat(...r.codes.map((c) => c.opts.map((i) => COLORS[i].brand + ' ' + COLORS[i].code))), other: r.other.map((i) => COLORS[i].brand + ' ' + COLORS[i].code) }; } } return out;`,
  );
  for (const k of Object.keys(rows)) {
    const o = rows[k].Ohuhu;
    // (v318.6: other [Copic k], the Ohuhu marker not offered at all)
    assert.deepEqual(o.other, [], k + ' with Ohuhu: ' + JSON.stringify(o));
    assert.equal(o.asked, 'old', k);
    assert.equal(o.opts.length, 2, k + ': ' + o.opts.join('|'));
    assert.match(o.opts[0], /^Ohuhu /, k + ': the brand chosen first: ' + o.opts.join('|'));
    assert.equal(o.opts[1], 'Copic ' + k);
    assert.deepEqual(rows[k].Either.opts.slice().sort(), o.opts.slice().sort(), k + ' with Either');
    assert.deepEqual(rows[k].Copic.opts, ['Copic ' + k], k + ' with Copic');
    assert.deepEqual(rows[k].Copic.other, []);
  }
});

test('typed, pasted or swept with Ohuhu chosen: "Which R29?" in the list with both; a quiet read of a code that could be an Ohuhu code read short is a card with every choice; the name settles it', () => {
  const s = studio();
  s.reset('Ohuhu', true);
  // Enter: a question in the list, the Ohuhu marker by its old code first (v318.6: "Another brand than the one chosen")
  s.read('R29', true);
  assert.deepEqual(s.asks(), ['Which R29? [Ohuhu YR47/old|Copic R29/chosen]']);
  assert.deepEqual(s.list(), []);
  // a quiet read (Scan Text) of Y13, which BGY13 and YGY13 end in: a card with both, never a question in the list
  s.reset('Ohuhu', true);
  s.read('Y13', false);
  assert.deepEqual(s.asks(), []);
  let c = s.last();
  assert.equal(c.big, 'Y13: Ohuhu E515 Black Brown (was Y13), or Copic Y13 Lemon Yellow?');
  assert.equal(c.small, 'Or an Ohuhu code read short (BGY13, YGY13) · Hold the cap still');
  assert.deepEqual(c.labels, ['Add Ohuhu E515', 'Add Copic Y13']);
  // (R29: YR29 ends in it; R30: R38 is one digit away: cards too)
  s.read('R29', false);
  assert.equal(s.last().small, 'Or Ohuhu YR29 read short · Hold the cap still');
  s.read('R30', false);
  assert.equal(s.last().small, 'Or Ohuhu R38 misread · Hold the cap still');
  assert.deepEqual(s.asks(), []);
  // R24 is no Ohuhu code read wrong: a question in the list, quietly read too
  s.read('R24', false);
  assert.deepEqual(s.asks(), ['Which R24? [Ohuhu V38/old|Copic R24/chosen]']);
  // typed with the Ohuhu marker's name: that one, by its old code (v318.6: Copic R29 offered)
  s.reset('Ohuhu', true);
  s.read('R29 Dusty Peach', true);
  assert.deepEqual(s.list(), ['Ohuhu|YR47']);
  assert.deepEqual(s.asks(), []);
  // a paste of one line: each a question with both
  s.reset('Ohuhu', true);
  s.read('R29, R30, YR20', true);
  assert.deepEqual(s.asks().sort(), [
    'Which R29? [Ohuhu YR47/old|Copic R29/chosen]',
    'Which R30? [Ohuhu E81/old|Copic R30/chosen]',
    'Which YR20? [Ohuhu YR37/old|Copic YR20/chosen]',
  ]);
  // the old-code Skin Tones list pasted with Ohuhu chosen: no "another brand" trap at all (v318.6: six of them)
  s.reset('Ohuhu', true);
  s.read(s.ev(`return T.set('36 Skin Tones').map((c) => c.old || c.code).join('\\n');`), true);
  assert.ok(!s.asks().some((t) => /Another brand/.test(t)), s.asks().join(' | '));
  assert.ok(s.asks().filter((t) => /^Which /.test(t) && /Copic/.test(t)).length >= 6, s.asks().join(' | '));
  assert.ok(!s.list().some((k) => /^Copic/.test(k)), s.list().join(' '));
});

test('a photo of an Ohuhu tray with a lone scrap: nothing added and nothing new asked, as before; a question the photo keeps offers the Ohuhu marker by its old code too', () => {
  const a = createApp({ localStorage: memoryStorage() });
  const photo = (extra) =>
    JSON.parse(
      a.__eval(`(function () {
    scanList = []; ocrAnswered = []; scanBrand = 'Ohuhu'; scanBrandChosen = true; scanAutoB = ''; scanSw = scanSwNew(); ocrPhotos = 0;
    const H = presetMkeys(MARKER_SETS[3]).map((k) => COLORS[keyIdx(k)]).slice(0, 20);
    const lines = []; let id = 1;
    H.forEach((c, k) => lines.push({ id: id++, text: c.code, conf: 0.95, box: [100 + 120 * (k % 8), 100 + 120 * Math.floor(k / 8), 60, 20, 0], unsure: false }));
    ${JSON.stringify(extra)}.forEach((t, k) => lines.push({ id: id++, text: t, conf: 0.95, box: [100 + 120 * k, 600, 60, 20, 0], unsure: false }));
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1200, h: 900 } };
    ocrRun = r; ocrPhotos = 1;
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    return JSON.stringify({ list: scanList.filter((e) => !e.ask).map((e) => COLORS[e.i].brand + ' ' + COLORS[e.i].code), asks: scanList.filter((e) => e.ask).map((e) => e.title + ' [' + e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code + '/' + o.how).join('|') + ']') });
  })()`),
    );
  for (const scrap of ['R29', 'Y13']) {
    const o = photo([scrap]);
    assert.equal(o.list.length, 20, scrap + ': ' + o.list.join(','));
    assert.ok(!o.list.some((x) => /Copic/.test(x)), scrap);
    assert.deepEqual(o.asks, [], scrap + ': ' + o.asks.join(' | '));
  }
  const o = photo(['R24']);
  assert.equal(o.list.length, 20);
  assert.deepEqual(o.asks, ['Which R24? [Ohuhu V38/old|Copic R24/chosen]']);
});

/* ---- section 1: a list read as its own brand ---- */

const CIAO = `return T.set('Ciao 36 - Set A').map((c) => c.code)`;

test('a Copic set’s codes pasted with Ohuhu chosen: read as Copic, said; set for you: said, and both brands are read from now on; Either: said', () => {
  const s = studio();
  s.reset('Ohuhu', true);
  s.read(s.ev(CIAO + '.join("\\n");'), true);
  assert.equal(s.list().length, 36, s.asks().join(' | '));
  assert.ok(
    s.list().every((k) => /^Copic/.test(k)),
    s.list().join(' '),
  );
  assert.equal(s.last().small, 'Read as Copic, though Ohuhu is chosen above the box');
  assert.equal(s.sw().brand, 'Ohuhu', 'the brand chosen stays');
  // set for you: the switch to both brands, said on the same card
  s.reset('Ohuhu', false);
  s.read(s.ev(CIAO + '.join("\\n");'), true);
  assert.equal(s.list().length, 36);
  assert.equal(
    s.last().small,
    'Read as Copic: its codes are plainly Copic’s · both brands are read from now on',
  );
  assert.deepEqual([s.sw().on, s.sw().brand], [true, '']);
  // Either brand: the ten codes both brands have go in as Copic's, not asked (v318.6: 13 questions)
  s.reset('', true);
  s.read(s.ev(CIAO + '.join("\\n");'), true);
  assert.equal(s.list().length, 36, s.asks().join(' | '));
  assert.equal(s.last().small, 'Read as Copic: its codes are plainly Copic’s');
  // on one line, typed (the box is one line): by the codes, not the lines; "100" beside other codes is asked as ever
  s.reset('Ohuhu', true);
  s.read(s.ev(CIAO + '.join(" ");'), true);
  assert.equal(s.list().filter((k) => /^Copic/.test(k)).length, 35, s.list().join(' '));
  assert.ok(!s.list().some((k) => /^Ohuhu/.test(k)));
  assert.equal(s.asks().length, 1);
});

test('a list of both brands’ codes is read as either (its shared codes asked); fewer than five one-brand codes, as before; a line naming its brand is that brand’s', () => {
  const s = studio();
  // 36 Copic codes and one only Ohuhu has: mixed
  s.reset('Ohuhu', true);
  s.read(s.ev(CIAO + '.concat(["B015"]).join("\\n");'), true);
  assert.ok(s.list().includes('Ohuhu|B015'));
  assert.equal(
    s.asks().filter((t) => /: Ohuhu or Copic\?|: Copic or Ohuhu\?/.test(t)).length,
    10,
    s.asks().join(' | '),
  );
  assert.ok(!s.asks().some((t) => /Another brand/.test(t)), s.asks().join(' | '));
  assert.match(
    s.last().small,
    /^Codes of both brands: those both have are asked · A brand tapped above answers them at once/,
  );
  // four Copic-only codes with Ohuhu chosen: asked as another brand's, as before
  s.reset('Ohuhu', true);
  s.read('E71\nC-3\nE21\nE29\nY06', true);
  assert.equal(
    s.asks().filter((t) => /^Another brand than the one chosen \(Ohuhu\)/.test(t)).length,
    4,
    s.asks().join(' | '),
  );
  assert.deepEqual(s.list(), ['Ohuhu|Y06']);
  // a line naming its brand decides, whatever is chosen, and doesn't make the list mixed: "Ohuhu B02" among a Copic
  // set's codes with Ohuhu chosen goes in as Ohuhu's, said, and the rest are read as Copic
  s.reset('Ohuhu', true);
  s.read(s.ev(CIAO + '.concat(["Ohuhu B02"]).join("\\n");'), true);
  assert.ok(s.list().includes('Ohuhu|B02'), s.list().join(' '));
  assert.equal(s.list().filter((k) => /^Copic/.test(k)).length, 36, s.asks().join(' | '));
  assert.ok(!s.asks().length, s.asks().join(' | '));
  assert.match(s.last().small, /^Read as Copic, though Ohuhu is chosen above the box · 1 named Ohuhu/);
  // ("Ohuhu B02" typed on its own with Copic chosen: Ohuhu's, not "another brand than the one chosen")
  s.reset('Copic', true);
  s.read('Ohuhu B02', true);
  assert.deepEqual([s.list(), s.asks()], [['Ohuhu|B02'], []]);
  // the old-code Skin Tones list with Copic chosen: Ohuhu's old codes count for Ohuhu
  s.reset('Copic', true);
  s.read(s.ev(`return T.set('36 Skin Tones').map((c) => c.old || c.code).join('\\n');`), true);
  assert.match(s.last().small, /^Read as Ohuhu, though Copic is chosen above the box/);
  assert.ok(!s.list().some((k) => /^Copic/.test(k)), s.list().join(' '));
  // Scan Text's reads cap by cap are read by the brand chosen, as before
  s.reset('Ohuhu', true);
  s.read('Y06', false);
  assert.deepEqual(s.list(), ['Ohuhu|Y06']);
});

test('a set’s name in the text: its card carries how the list was read; every built-in set’s list, current and old codes, is its own brand’s', () => {
  const s = studio();
  s.reset('Ohuhu', true);
  s.read(
    s.ev(
      `return ['COPIC ciao', '36 colors', 'Set A'].concat(T.set('Ciao 36 - Set A').flatMap((c) => [c.code, c.name])).join('\\n');`,
    ),
    true,
  );
  assert.equal(s.list().length, 36);
  assert.match(s.last().big, /^Copic Ciao 36: which one\?/);
  assert.match(s.last().small, /Read as Copic, though Ohuhu is chosen above the box/);
  const sets = s.ev(
    `return MARKER_SETS.map((p) => { const cs = presetMkeys(p).map((k) => COLORS[keyIdx(k)]).filter(Boolean); if (!cs.length) return null; const cur = scanListBrand(cs.map((c) => c.code).join('\\n')), old = scanListBrand(cs.map((c) => c.old || c.code).join('\\n')); return [p.n, cs[0].brand, cur && cur.brand, old && old.brand]; }).filter(Boolean);`,
  );
  assert.ok(sets.length >= 32);
  for (const [n, b, cur, old] of sets) assert.deepEqual([cur, old], [b, b], n);
});

test('a long paste isn’t read twice for its brand: 122 KB in no more than 1.3 times one reading', () => {
  const s = studio();
  const text = s.ev(
    `let t = ''; const cs = COLORS.map((c) => c.code + ' ' + c.name); while (t.length < 122000) t += cs.join('\\n') + '\\n'; return t;`,
  );
  assert.ok(text.length > 120000);
  s.reset('Ohuhu', true);
  // (v318.25: over 20 KB, told from its first 20,000 characters, and that part's reading not kept)
  assert.equal(
    s.ev(
      'const lb = scanListBrand(' +
        JSON.stringify(text) +
        '); return JSON.stringify(lb && [lb.brand, !!lb.mixed, lb.r]);',
    ),
    JSON.stringify(['', true, null]),
    'over 20 KB: its first part classified',
  );
  const t0 = cpuMs();
  s.a.__eval('scanRead(' + JSON.stringify(text) + ', "Ohuhu")');
  const one = cpuMs() - t0;
  s.reset('Ohuhu', true);
  const t1 = cpuMs();
  s.read(text, true);
  const all = cpuMs() - t1;
  assert.ok(all <= 1.3 * one + 150, 'read ' + one.toFixed(0) + ' ms, handled ' + all.toFixed(0) + ' ms');
});

/* ---- section 6: the sweep that shows the brand (automatic brand only) ---- */

test('a Copic set swept cap by cap with Ohuhu set for you: nothing wrong goes in, the reading switches to both brands by the third cap, and codes both brands use are asked', () => {
  const s = studio();
  for (const [n, q] of [
    ['Ciao 36 - Set A', 14],
    ['Ciao 12', 8],
    ['Ciao 72 - Set A', 24],
  ]) {
    s.reset('Ohuhu', false);
    const m = s.sweep(`return T.caps(${JSON.stringify(n)});`);
    // (v318.6: Ciao 36 A → 10 Ohuhu markers in the list, 26 vanishing cards)
    assert.deepEqual(m.wrong, [], n + ': ' + m.wrong.join(','));
    assert.ok(m.at >= 1 && m.at <= 5, n + ': switched at read ' + m.at);
    assert.ok(m.lost.length <= 2, n + ' lost: ' + m.lost.join(','));
    assert.ok(m.q <= q, n + ': ' + m.q + ' questions');
    assert.deepEqual([s.sw().on, s.sw().brand], [true, ''], n);
    // with the names: every cap in, none asked
    s.reset('Ohuhu', false);
    const w = s.sweep(`return T.caps(${JSON.stringify(n)}, true);`);
    assert.deepEqual([w.wrong, w.lost, w.q <= 1], [[], [], true], n + ' with names: ' + JSON.stringify(w));
  }
  // the ten shared codes first: held as Ohuhu's, then asked at the switch (hold-since: all ten)
  s.reset('Ohuhu', false);
  const m = s.sweep(
    `const R = T.caps('Ciao 36 - Set A'); const sh = (r) => COLORS.some((c) => c.brand === 'Copic' && c.brand !== 'x' && T.key(c) === r.k) && COLORS.some((c) => c.brand === 'Ohuhu' && scanKey(c.code) === r.k.split('|')[1]); return R.filter(sh).concat(R.filter((r) => !sh(r)));`,
  );
  assert.deepEqual(m.wrong, []);
  assert.ok(m.at >= 11, 'switched at ' + m.at);
  assert.equal(s.asks().filter((t) => /: Ohuhu or Copic\?/.test(t)).length, 10, s.asks().join(' | '));
  // a brand tapped: as before, the user's choice (ten shared codes go in as Ohuhu's), nothing switches
  s.reset('Ohuhu', true);
  const t = s.sweep(`return T.caps('Ciao 36 - Set A');`);
  assert.equal(t.wrong.length, 10);
  assert.equal(t.at, 0);
});

test('an Ohuhu set swept with its caps misread as Copic codes (short, a digit, a doubled character, a letter): nothing wrong goes in and nothing switches', () => {
  const s = studio();
  for (const [why, mis] of [
    ['short', { BG114: 'BG11', BGY13: 'Y13' }],
    ['digit', { B08: 'B00', G49: 'G40', Y08: 'Y00' }],
    ['doubled', { B112: 'B12', B114: 'B14' }],
    ['letter', { B08: 'R08', E14: 'B14', G49: 'C49' }],
    ['mixed', { BG114: 'BG11', B08: 'B00', E14: 'B14', B112: 'B12', YG08: 'YG00' }],
    ['a neighbour’s name on a short read', { BG114: 'BG11 Moon White' }],
  ]) {
    s.reset('Ohuhu', false);
    const m = s.sweep(`return T.caps('Honolulu 120', ${/name/.test(why)}, ${JSON.stringify(mis)});`);
    assert.deepEqual(m.wrong, [], why + ': ' + m.wrong.join(','));
    assert.equal(m.at, 0, why + ': switched at ' + m.at);
    assert.ok(m.q <= 5, why + ': ' + m.q);
  }
  // the misread cap's card says what it could be; typed, there's no cap to hold still
  s.reset('Ohuhu', false);
  s.read('BG11', false);
  assert.equal(s.last().big, 'BG11: Copic’s, or Ohuhu BG114 read short?');
  assert.equal(s.last().small, 'Hold the cap still');
  assert.deepEqual(s.last().labels, ['Add Copic BG11']);
  assert.deepEqual(s.asks(), []);
  // (v318.22 review H) typed, it goes in the list as a question instead: nothing was misread and there's no cap to
  // hold still, and the next code typed used to replace the card and lose it
  s.reset('Ohuhu', false);
  s.read('B00', true);
  assert.equal(s.last().big, 'B00: Copic’s, or an Ohuhu code misread (B06, B08)?');
  assert.equal(s.last().small, 'Choose in the list below');
  assert.deepEqual(s.last().labels, []);
  assert.deepEqual(s.asks(), ['B00: Copic’s, or an Ohuhu code misread (B06, B08)? [Copic B00/chosen]']);
  // the same cap held in view, read again and again, is one; and a plain word of the name is no name
  s.reset('Ohuhu', false);
  const m = s.sweep(
    `const R = T.caps('Honolulu 120', true); R.splice(20, 0, { t: 'E71 Champagne', k: 'Copic|E71', again: true }); return R;`,
  );
  assert.deepEqual([m.wrong, m.at], [[], 0]);
  assert.equal(s.sw().whole, 1);
  s.reset('Ohuhu', false);
  const p = s.sweep(
    `return T.caps('Honolulu 320 (complete set)', true, { B411: 'B41 Rich Slate Blue', YG012: 'YG01 Yellow Green' });`,
  );
  assert.deepEqual([p.wrong, p.at], [[], 0]);
});

test('the first cap read whole as Copic’s is a question in the list, said as set for you; at the switch it goes in, codes both brands use taken since the last Ohuhu-only code are asked, and the card says so', () => {
  const s = studio();
  s.reset('Ohuhu', false);
  s.read('B04', false); // both brands have it: Ohuhu's, for now
  s.read('B015', false); // Ohuhu's alone
  s.read('YR07', false); // both brands': since the last Ohuhu-only code
  s.read('E71 Champagne', false);
  assert.deepEqual(s.asks(), ['Copic E71 Champagne: add it? Ohuhu was set for you [Copic E71/chosen]']);
  assert.equal(s.last().big, 'Copic E71 Champagne: add it? Ohuhu was set for you');
  assert.equal(s.sw().on, false);
  s.read('BG11 Moon White', false);
  assert.deepEqual([s.sw().on, s.sw().brand], [true, '']);
  assert.deepEqual(
    s.list().sort(),
    ['Copic|BG11', 'Copic|E71', 'Ohuhu|B015', 'Ohuhu|B04'],
    s.list().join(' '),
  );
  assert.deepEqual(s.asks(), ['YR07: Ohuhu or Copic? [Ohuhu YR07/chosen|Copic YR07/chosen]']);
  assert.equal(s.last().big, 'Reading both brands: Copic caps were read');
  assert.equal(
    s.last().small,
    'Codes both brands use are asked from now on · Keep Ohuhu is at the top of the list',
  );
  assert.equal(s.sw().row, true);
  // from now on a code both brands use is asked, and a Copic-only code goes in
  s.read('Y06', false);
  assert.ok(
    s.asks().some((t) => /^Y06: /.test(t)),
    s.asks().join(' | '),
  );
  s.read('C-3', false);
  assert.ok(s.list().includes('Copic|C3'));
  // Keep Ohuhu: the brand back, the held questions answered as Ohuhu's, the Copic markers taken since asked about
  s.a.__eval('scanSwitchOff()');
  assert.deepEqual([s.sw().on, s.sw().off, s.sw().brand, s.sw().row], [false, true, 'Ohuhu', false]);
  assert.ok(s.list().includes('Ohuhu|YR07') && s.list().includes('Ohuhu|Y06'), s.list().join(' '));
  assert.ok(!s.list().some((k) => /^Copic/.test(k)), s.list().join(' '));
  assert.deepEqual(s.asks().sort(), [
    'Copic BG11 Moon White: add it? Ohuhu was set for you [Copic BG11/name]',
    'Copic C-3 Cool Gray No.3: add it? Ohuhu was set for you [Copic C-3/chosen]',
    'Copic E71 Champagne: add it? Ohuhu was set for you [Copic E71/chosen]',
  ]);
  assert.equal(s.last().big, 'Ohuhu again');
  assert.equal(s.last().small, 'Copic codes read since are asked below');
  // switched again only after two more distinct Copic reads
  s.read('E71 Champagne', false);
  assert.equal(s.sw().on, false);
  s.read('B000', false);
  assert.equal(s.sw().on, true);
  assert.equal(s.sw().row, true);
  // (the whole reads' questions went in again; the questions about codes both brands use came back)
  assert.ok(s.list().includes('Copic|E71') && s.list().includes('Copic|BG11'), s.list().join(' '));
  assert.ok(
    s.asks().some((t) => /^YR07: /.test(t)),
    s.asks().join(' | '),
  );
});

test('a noisy read that makes the switch stays a card; two misreads first switch too, and Keep Ohuhu puts it right; three other-brand codes in a row switch mid-sweep', () => {
  const s = studio();
  // the first two reads of the visit misreads: switched (no Ohuhu-only code yet), nothing wrong in the list
  s.reset('Ohuhu', false);
  const m = s.sweep(
    `const M = { BG114: 'BG11', B08: 'B00' }; const R = T.caps('Honolulu 120', false, M); const first = R.filter((r) => !r.k); return first.concat(R.filter((r) => r.k));`,
  );
  assert.equal(m.at, 2);
  assert.deepEqual(m.wrong, []);
  assert.ok(
    !s.list().includes('Copic|B00') && !s.list().includes('Copic|BG11'),
    'the noisy reads stayed cards: ' +
      s
        .list()
        .filter((k) => /Copic/.test(k))
        .join(' '),
  );
  // the same with Keep Ohuhu tapped at the switch: five questions, nothing wrong, no switch again
  s.reset('Ohuhu', false);
  const k = s.sweep(
    `const M = { BG114: 'BG11', B08: 'B00' }; const R = T.caps('Honolulu 120', false, M); const first = R.filter((r) => !r.k); return first.concat(R.filter((r) => r.k));`,
    0,
  );
  assert.deepEqual([k.wrong, k.on], [[], false]);
  assert.ok(k.q <= 6, k.q + ' questions');
  // three misreads in a row after twenty right: the sequence rule switches; Keep Ohuhu takes it back
  s.reset('Ohuhu', false);
  const t = s.sweep(
    `const M = { BG114: 'BG11', B08: 'B00', G49: 'G40' }; const R = T.caps('Honolulu 120', false, M); const mis = R.filter((r) => !r.k), rest = R.filter((r) => r.k); return rest.slice(0, 20).concat(mis, rest.slice(20));`,
  );
  assert.deepEqual([t.at, t.wrong], [23, []]);
  s.reset('Ohuhu', false);
  const u = s.sweep(
    `const M = { BG114: 'BG11', B08: 'B00', G49: 'G40' }; const R = T.caps('Honolulu 120', false, M); const mis = R.filter((r) => !r.k), rest = R.filter((r) => r.k); return rest.slice(0, 20).concat(mis, rest.slice(20));`,
    0,
  );
  assert.deepEqual([u.wrong, u.on], [[], false]);
  assert.ok(u.q <= 6, u.q + ' questions');
  // an Ohuhu tray then a Copic one: switched at the third Copic cap, nothing wrong, the Ohuhu tray's shared codes not asked
  s.reset('Ohuhu', false);
  const v = s.sweep(`return T.caps('Honolulu 120').concat(T.caps('Ciao 36 - Set A'));`);
  assert.deepEqual(v.wrong, []);
  assert.ok(v.at > 120 && v.at <= 125, 'switched at ' + v.at);
  assert.ok(v.q <= 20, v.q + ' questions');
});

test('a brand word read with the code, and a code typed with Enter, count as read whole; a photo plainly of Copic caps switches; Clear list and a brand tapped end the switch', () => {
  const s = studio();
  s.reset('Ohuhu', false);
  s.read('COPIC E71', false);
  s.read('COPIC BG11', false);
  assert.equal(s.sw().at, undefined);
  assert.equal(s.sw().on, true);
  assert.deepEqual(s.list().sort(), ['Copic|BG11', 'Copic|E71']);
  s.reset('Ohuhu', false);
  s.read('E71 Champagne', true);
  s.read('BG11 Moon White', true);
  assert.equal(s.sw().on, true);
  // a photo plainly of Copic caps (its end): switched, said on the photo's line and Done's card
  s.reset('Ohuhu', false);
  const o = s.ev(`
    scanList = []; ocrAnswered = []; ocrPhotos = 0;
    const C = T.set('Ciao 36 - Set A').filter((c) => !COLORS.some((x) => x.brand === 'Ohuhu' && scanKey(x.code) === scanKey(c.code))).slice(0, 10);
    const lines = C.map((c, k) => ({ id: k + 1, text: c.code, conf: 0.95, box: [100 + 120 * (k % 8), 100 + 120 * Math.floor(k / 8), 60, 20, 0], unsure: false }));
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1200, h: 900 } };
    ocrRun = r; ocrPhotos = 1;
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    ocrRun = r; ocrFinish();
    return { brand: r.brand, switched: !!r.switched, on: scanSw.on, sb: scanBrand, list: T.list().length, card: T.last() };`);
  assert.deepEqual([o.brand, o.switched, o.on, o.sb, o.list], ['Copic', true, true, '', 10]);
  assert.match(
    o.card.small,
    /Read as Copic: these look like Copic caps, so both brands are read from now on/,
  );
  // Clear list: the brand set for you is back; a brand tapped ends it for good
  s.a.__eval('scanSwitchEnd(true)');
  assert.deepEqual([s.sw().on, s.sw().brand, s.sw().row], [false, 'Ohuhu', false]);
  s.read('COPIC E71', false);
  s.read('COPIC BG11', false);
  assert.equal(s.sw().on, true);
  s.a.__eval('scanSwitchEnd(false); scanBrand = "Copic"; scanBrandChosen = true;');
  assert.deepEqual([s.sw().on, s.sw().row], [false, false]);
  s.read('E71 Champagne', false);
  assert.equal(s.sw().other, 0, 'nothing counted once a brand is tapped');
});

/* ---- v318.7 debug ---- */

test('a code both brands use read in the box after a list of that brand was pasted is that list’s marker read again, "Already in the list", not asked; not after the other brand’s list, nor when the caps just read were the other brand’s', () => {
  const s = studio();
  // a Copic list pasted under Either, then its caps swept: BG23 (Copic’s alone), then YR07 (both brands have it)
  // (v318.7 as built: the list’s markers were never marked as pasted, so "YR07: Ohuhu or Copic?" was asked)
  s.reset('', true);
  s.read(s.ev(CIAO + '.join("\\n");'), true);
  assert.equal(s.list().length, 36);
  s.read('BG23', false);
  s.read('YR07', false);
  assert.deepEqual(s.asks(), [], 'not asked: Copic YR07 is in the list from the paste');
  assert.deepEqual(
    [s.last().k, s.last().big, s.last().small],
    ['same', 'YR07 Cadmium Orange', 'Already in the list · Copic'],
  );
  assert.equal(s.list().length, 36, 'nothing added');
  // the same list typed on one line (without 100, a number beside other codes, asked about): a list too
  s.reset('', true);
  s.read(s.ev(CIAO + '.filter((c) => c !== "100").join(" ");'), true);
  assert.equal(s.list().length, 35);
  s.read('BG23', false);
  s.read('YR07', false);
  assert.deepEqual(s.asks(), []);
  assert.equal(s.list().length, 35);
  // an Ohuhu cap read just before: the Ohuhu marker of the code isn’t in the list, so asked as before
  s.reset('', true);
  s.read(s.ev(CIAO + '.join("\\n");'), true);
  s.read('R014', false);
  s.read('YR07', false);
  assert.deepEqual(s.asks(), ['YR07: Ohuhu or Copic? [Ohuhu YR07/chosen|Copic YR07/chosen]']);
  // the code read in the box before (not pasted): asked, as v303 has it
  s.reset('', true);
  s.read('E71', false);
  s.read('Copic YR07', true);
  s.read('YR07', false);
  assert.deepEqual(s.asks(), ['YR07: Ohuhu or Copic? [Ohuhu YR07/chosen|Copic YR07/chosen]']);
});

test('the noisy card with Copic set for you says "a Copic code", not "an Copic code"', () => {
  const s = studio();
  assert.equal(
    s.ev(`return scanNotWholeWhy(scanNotWhole('B08', 'Copic'), 'Copic');`),
    'a Copic code misread (E08, R08)',
  );
  assert.equal(
    s.ev(`return scanNotWholeWhy(scanNotWhole('E71', 'Ohuhu'), 'Ohuhu');`),
    'an Ohuhu code read short (E713, E711)',
  );
  s.reset('Copic', false);
  s.read('B08', true);
  assert.equal(s.last().big, 'B08: Ohuhu’s, or a Copic code misread (E08, R08)?');
  // (v318.22 review H: typed, the choice is in the list, so the card carries no Add of its own)
  assert.deepEqual(s.last().labels, []);
  assert.deepEqual(s.asks(), ['B08: Ohuhu’s, or a Copic code misread (E08, R08)? [Ohuhu B08/chosen]']);
  // quiet, as a cap held in the box: the card with its Add, nothing in the list
  s.reset('Copic', false);
  s.read('B08', false);
  assert.deepEqual(s.last().labels, ['Add Ohuhu B08']);
  assert.deepEqual(s.asks(), []);
});

test('(v318.22) a typed other-brand code that could be a misread is kept: the next code typed doesn’t lose it', () => {
  const s = studio();
  s.reset('Ohuhu', false);
  // RV10 is a Copic marker, and near Ohuhu's RV18/RV19, so it used to be a card only and the next code replaced it
  s.read('RV10', true);
  assert.deepEqual(s.asks(), ['RV10: Copic’s, or an Ohuhu code misread (RV18, RV19)? [Copic RV10/chosen]']);
  // (what Add looks at: a question raised by the box is shown before anything is added, 70-dialog.js scanAdd)
  assert.equal(s.ev('return scanAsks();'), 1);
  s.read('Y06', true);
  assert.deepEqual(s.list(), ['Ohuhu|Y06']);
  assert.deepEqual(s.asks(), ['RV10: Copic’s, or an Ohuhu code misread (RV18, RV19)? [Copic RV10/chosen]']);
  // the same code typed again: said, not asked twice, and no Add of its own on the card
  s.read('RV10', true);
  assert.equal(s.last().small, 'Waiting in the list below');
  assert.deepEqual(s.last().labels, []);
  assert.equal(s.asks().length, 1);
  // two of them, then the switch to both brands at the second: both kept, and a Copic cap goes in from then on
  s.reset('Ohuhu', false);
  s.read('RV10', true);
  s.read('RV11', true);
  assert.equal(s.sw().on, true);
  assert.equal(s.asks().length, 2);
  s.read('E71 Champagne', true);
  assert.deepEqual(s.list(), ['Copic|E71']);
});

test('a photo not plainly one brand’s, with Ohuhu set for you: another brand’s cap is asked about as Scan’s own reads say it, "set for you", not "chosen"', () => {
  const a = createApp({ localStorage: memoryStorage() });
  const photo = (chosen) =>
    JSON.parse(
      a.__eval(`(function () {
    scanList = []; ocrAnswered = []; scanBrand = 'Ohuhu'; scanBrandChosen = ${chosen}; scanAutoB = ${chosen ? "''" : "'Ohuhu'"}; scanSw = scanSwNew(); ocrPhotos = 0;
    const H = presetMkeys(MARKER_SETS[3]).map((k) => COLORS[keyIdx(k)]).slice(0, 3);
    const lines = []; let id = 1;
    H.forEach((c, k) => lines.push({ id: id++, text: c.code, conf: 0.95, box: [100 + 120 * k, 100, 60, 20, 0], unsure: false }));
    ['E71 Champagne', 'BG11 Moon White'].forEach((t, k) => lines.push({ id: id++, text: t, conf: 0.95, box: [100 + 120 * k, 600, 60, 20, 0], unsure: false }));
    const r = { n: 1, items: new Map(), taken: new Set(), brands: {}, sure: 0, p: null, done: false, note: '', img: { w: 1200, h: 900 } };
    ocrRun = r; ocrPhotos = 1;
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    return JSON.stringify({ seen: r.brand, list: scanList.filter((e) => !e.ask).length, asks: scanList.filter((e) => e.ask).map((e) => e.title).sort() });
  })()`),
    );
  // (v318.7 as built: "Another brand than the one chosen (Ohuhu): add it?", though nothing was chosen)
  assert.deepEqual(photo(false), {
    seen: '',
    list: 3,
    asks: [
      'Copic BG11 Moon White: add it? Ohuhu was set for you',
      'Copic E71 Champagne: add it? Ohuhu was set for you',
    ],
  });
  // Ohuhu tapped: as before
  assert.deepEqual(photo(true).asks, [
    'Another brand than the one chosen (Ohuhu): add it?',
    'Another brand than the one chosen (Ohuhu): add it?',
  ]);
});

test('a long paste under the switch to both brands is read in no more than 1.3 times Either’s time: its words are worked out once, not again for each marker; the names still make the markers whole', () => {
  const s = studio();
  const text = s.ev(
    `let t = ''; const cs = COLORS.map((c) => c.code + ' ' + c.name); while (t.length < 122000) t += cs.join('\\n') + '\\n'; return t;`,
  );
  s.reset('', true);
  const t0 = cpuMs();
  s.read(text, true);
  const either = cpuMs() - t0;
  // (v318.7 as built: 2.4 times, the whole text searched for each Copic marker's name, scanWholeOther)
  s.reset('Ohuhu', false);
  s.read('E71 Champagne', false);
  s.read('BG11 Moon White', false);
  assert.equal(s.sw().on, true);
  const t1 = cpuMs();
  s.read(text, true);
  const sw = cpuMs() - t1;
  assert.ok(
    sw <= 1.3 * either + 150,
    'Either ' + either.toFixed(0) + ' ms, under the switch ' + sw.toFixed(0) + ' ms',
  );
  // the paste's Copic markers are read whole by their names, as the text searched for each would have them (Keep Ohuhu
  // asks about them so; a switch again puts them in); a name of plain words alone, Light Blue, makes none whole, as before
  const whole = s.ev(
    `const t = ${JSON.stringify(text)}; return scanList.filter((e) => !e.ask && COLORS[e.i].brand === 'Copic').map((e) => [COLORS[e.i].code, !!e.whole, !!scanWholeOther(e.i, t, 'Ohuhu')]);`,
  );
  assert.ok(whole.length > 300);
  assert.deepEqual(
    whole.filter((w) => w[1] !== w[2]),
    [],
    'read whole as the text searched would have it',
  );
  assert.ok(
    whole.filter((w) => w[1]).length > 300 && whole.some((w) => !w[1]),
    'most whole by their names, some not',
  );
  // codes alone: a code that could be an Ohuhu code read wrong isn't whole, one that couldn't is
  s.reset('Ohuhu', false);
  s.read('E71 Champagne', false);
  s.read('BG11 Moon White', false);
  s.read(['B18', 'B26', 'B37', 'B41'].join('\n'), true);
  assert.deepEqual(
    s.ev(
      `return scanList.filter((e) => !e.ask && COLORS[e.i].brand === 'Copic').map((e) => COLORS[e.i].code + ':' + !!e.whole).sort();`,
    ),
    ['B18:true', 'B26:false', 'B37:true', 'B41:false', 'BG11:true', 'E71:true'],
  );
});
