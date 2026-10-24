// Markers: filters, sets, finding, buying, Random.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app, createApp, memoryStorage } from './harness.mjs';
import { readFileSync } from 'node:fs';

// ---- from filters.test.mjs ----
// Marker filters: nothing chosen means every marker; tapping a chip shows only that one,
// tapping more adds them, and removing the last choice goes back to everything.
{
  const fresh = () => createApp({ localStorage: memoryStorage() });
  const tones = (a) => [...a.__eval('state.tones')].sort();
  const ALL_T = ['dark', 'light', 'mid', 'pale'];
  test('tapping a tone shows only that tone, then adds, then back to all', () => {
    const a = fresh();
    assert.deepEqual(tones(a), ALL_T);
    assert.equal(a.__eval("fgIsAll('tone')"), true);
    assert.equal(a.__eval("fgSel('tone','pale')"), false, 'nothing looks chosen when everything shows');
    a.__eval("fgTap('tone','pale')");
    assert.deepEqual(tones(a), ['pale'], 'first tap = only this');
    assert.equal(a.__eval("fgSel('tone','pale')"), true);
    a.__eval("fgTap('tone','light')");
    assert.deepEqual(tones(a), ['light', 'pale'], 'second tap adds');
    a.__eval("fgTap('tone','pale')");
    assert.deepEqual(tones(a), ['light'], 'tapping a chosen one removes it');
    a.__eval("fgTap('tone','light')");
    assert.deepEqual(tones(a), ALL_T, 'removing the last goes back to all');
    a.__eval("fgTap('tone','pale');fgTap('tone','light');fgTap('tone','mid');fgTap('tone','dark')");
    assert.equal(a.__eval("fgIsAll('tone')"), true, 'choosing all of them is the same as none');
    assert.equal(a.__eval("fgSel('tone','mid')"), false);
  });
  test('families use the same rule (stored as the excluded list)', () => {
    const a = fresh();
    const fams = a.__eval('families.map(f=>f.name)');
    const f0 = fams[0],
      f1 = fams[1];
    a.__eval(`fgTap('fam',${JSON.stringify(f0)})`);
    assert.equal(a.__eval('state.excluded.size'), fams.length - 1, 'only the tapped family shows');
    assert.equal(a.__eval(`state.excluded.has(${JSON.stringify(f0)})`), false);
    a.__eval(`fgTap('fam',${JSON.stringify(f1)})`);
    assert.equal(a.__eval('state.excluded.size'), fams.length - 2);
    a.__eval("fgClear('fam')");
    assert.equal(a.__eval('state.excluded.size'), 0);
  });
  test('an empty group from an old saved state means everything', () => {
    const a = fresh();
    a.__eval('state.brands=new Set();state.excluded=new Set(families.map(f=>f.name));fgNormalize()');
    assert.equal(a.__eval("fgIsAll('brand')"), true);
    assert.equal(a.__eval('state.excluded.size'), 0);
  });
}

// ---- from sets.test.mjs ----
// Marker sets offered in the welcome dialog and on Markers. Checked against Ohuhu's
// official colour charts (ohuhu.com/pages/color-codes-index) in Sept 2026. Also: the set picker's state.
{
  // (v320: an app of its own, as when this was a file of its own)
  const _app = createApp(),
    app = _app;
  const SETS = app.__eval('OHUHU_SETS');
  const set = (k) => new Set(SETS[k].split(' '));
  const codes = new Set(
    app
      .__eval('COLORS')
      .filter((c) => c.brand === 'Ohuhu')
      .map((c) => c.code),
  );
  // ---- From the design pass ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const base = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      tones: ['pale', 'light', 'mid', 'dark'],
      sats: ['neutral', 'muted', 'medium', 'vivid'],
      brands: ['Ohuhu', 'Copic'],
      satsUpgraded: true,
      scopeFlipped: true,
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      owned: [],
      saved: [],
      ...extra,
    });
  test('every set has as many colours as its name says (blenders are extra)', () => {
    const size = {
      24: 24,
      48: 48,
      72: 72,
      104: 104,
      120: 120,
      168: 168,
      216: 216,
      320: 320,
      '48mid': 48,
      '36skin': 36,
      '36gray': 36,
      '48pastelS': 48,
      '48pastelB': 48,
      '24portrait': 24,
      '6skin': 6,
    };
    for (const [k, n] of Object.entries(size)) {
      const list = SETS[k].split(' ');
      assert.equal(new Set(list).size, list.length, `${k} has a duplicate`);
      assert.equal(list.length, n, `${k}`);
    }
  });
  test('every code in every set is a marker the app knows', () => {
    for (const k of Object.keys(SETS)) for (const c of set(k)) assert.ok(codes.has(c), `${k}: ${c}`);
  });
  test('sets build on each other the way Ohuhu sells them', () => {
    const union = (...ks) => new Set(ks.flatMap((k) => [...set(k)]));
    const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    const within = (a, b) => [...set(a)].filter((x) => !set(b).has(x));
    assert.deepEqual(within('72', '120'), [], '72 ⊂ 120');
    assert.ok(same(union('120', '48pastelS'), set('168')), '168 = 120 + 48 Sweetness pastels');
    assert.ok(same(union('168', '48mid'), set('216')), '216 = 168 + 48 Mid-tones');
    assert.ok(same(union('216', '104'), set('320')), '320 = 216 + 104');
    assert.deepEqual(within('24portrait', '36skin'), [], '24 skin tones ⊂ 36 skin tones');
  });
  // Copic sets are listed with the codes printed on copic.jp's set pages (Sept 2026).
  test('every Copic set resolves to exactly the number of markers in its name', () => {
    const sets = app.__eval('MARKER_SETS').filter((s) => s.b === 'Copic' && s.c);
    assert.ok(sets.length >= 16);
    for (const s of sets) {
      const n = +s.n.match(/(\d+)/)[1],
        got = app.__eval(
          `presetMkeys(MARKER_SETS.find(function(x){return x.n===${JSON.stringify(s.n)};}))`,
        ).length;
      assert.equal(s.c.split(' ').length, n, `${s.n} lists ${n}`);
      assert.equal(got, n, `${s.n} finds all ${n} markers`);
    }
  });
  test('set picker marks sets you already fully own', () => {
    const probe = createApp({ localStorage: memoryStorage() });
    const set24 = probe.__eval('presetMkeys(MARKER_SETS[0])');
    const a = createApp({ localStorage: memoryStorage({ [KEY]: base({ owned: [...set24] }) }) });
    const html = a.presetListHTML();
    assert.match(html, /presetrow have"><input type="checkbox" data-i="0">/);
    assert.doesNotMatch(
      html,
      /presetrow have"><input type="checkbox" data-i="1">/,
      'partially owned set is not marked',
    );
  });
}

// ---- from v304-buy.test.mjs ----
// v304, Brands I'd buy: which brands a marker to buy is suggested from, kept with the collection. Automatic (none
// ticked): your brands first, another brand only when it's clearly closer, as before. With brands ticked: only
// those, in Match; your markers still count whatever their brand. Saved, read back (brands the data doesn't have
// dropped, none ticked is automatic), in backups and restored with them.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const app = (extra = {}) => {
    const ls = memoryStorage();
    ls.setItem(
      KEY,
      JSON.stringify({
        mode: 'collection',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|BG311', 'Ohuhu|B08', 'Ohuhu|R014'],
        saved: [],
        ...extra,
      }),
    );
    return createApp({ localStorage: ls });
  };
  const near = (E, hex) =>
    JSON.parse(
      E(
        `(function () { const r = matchNearest(hexToLab(${JSON.stringify(hex)})); const b = (o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code; return JSON.stringify({ owned: r.owned.map(b), buy: r.buy.map(b), other: r.other.map(b) }); })()`,
      ),
    );
  test('automatic: your brands first, another brand only when clearly closer (as v304 first had it)', () => {
    const E = app().__eval;
    assert.equal(E('JSON.stringify(state.buyBrands)'), 'null');
    const r = near(E, '#40e0d0');
    assert.ok(r.owned.every((x) => x.startsWith('Ohuhu ')));
    assert.ok(
      r.buy.every((x) => x.startsWith('Ohuhu ')),
      r.buy.join(),
    );
    assert.ok(r.other.length <= 1);
  });
  test('only the brands ticked: Match suggests from them, and your own markers still count', () => {
    const E = app({ buyBrands: ['Copic'] }).__eval;
    assert.equal(E('JSON.stringify(state.buyBrands)'), '["Copic"]');
    const r = near(E, '#40e0d0');
    assert.ok(r.owned[0].startsWith('Ohuhu '), 'your Ohuhu marker is still your best');
    assert.ok(r.buy.length && r.buy.every((x) => x.startsWith('Copic ')), r.buy.join());
    assert.deepEqual(r.other, []);
    const E2 = app({ buyBrands: ['Ohuhu'] }).__eval;
    const r2 = near(E2, '#40e0d0');
    assert.ok(r2.buy.every((x) => x.startsWith('Ohuhu ')));
    assert.deepEqual(r2.other, [], 'no other-brand row once brands are ticked');
  });
  test('saved and read back: brands the data doesn’t have are dropped, none ticked is automatic', () => {
    assert.equal(
      app({ buyBrands: ['Copic', 'Nope'] }).__eval('JSON.stringify(state.buyBrands)'),
      '["Copic"]',
    );
    assert.equal(app({ buyBrands: [] }).__eval('JSON.stringify(state.buyBrands)'), 'null');
    assert.equal(app({ buyBrands: 'Copic' }).__eval('JSON.stringify(state.buyBrands)'), 'null');
    const a = app(),
      E = a.__eval;
    E(`state.buyBrands = ['Ohuhu']; save()`);
    assert.deepEqual(JSON.parse(E(`localStorage.getItem(${JSON.stringify(KEY)})`)).buyBrands, ['Ohuhu']);
  });
  test('a backup carries it, and a restore of the collection brings it back (a file without it leaves it)', () => {
    const E = app({ buyBrands: ['Copic'] }).__eval;
    const own = JSON.parse(E('JSON.stringify([...state.owned])'));
    assert.equal(E('typeof applyCollectionBackup'), 'function');
    E(
      `applyCollectionBackup({ owned: ${JSON.stringify(own)}, wish: [], ink: {}, saved: [], buyBrands: ['Ohuhu'] }, Date.now(), true)`,
    );
    assert.equal(E('JSON.stringify(state.buyBrands)'), '["Ohuhu"]');
    E(
      `applyCollectionBackup({ owned: ${JSON.stringify(own)}, wish: [], ink: {}, saved: [] }, Date.now(), true)`,
    );
    assert.equal(E('JSON.stringify(state.buyBrands)'), '["Ohuhu"]', 'a file without it leaves it');
  });
}

// ---- from v304-finder.test.mjs ----
// v304 (Markers): the search ignores hyphens, dots and spaces in codes, folds grey/gray and colour/color and curly
// punctuation, finds a brand from four letters and a code from its start (a number alone after the code's letters, a
// whole number among other words), and puts the code searched for first under "Best match", markers that once had it
// under "Old code"; the slot picker uses the same search. Tick all shown, Untick all shown, Copy codes and Palette from
// these act on what the grid shows (Ramp gaps shows only some of the matches); the Colorless Blender isn't a gap to
// fill, and owning one doesn't cover white; back in Custom the palette has its own size again.
{
  const fresh = () => {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval(
      `state.mode = 'finder'; state.finderScope = 'all'; state.owned = new Set(); state.pool = null; poolSet = null;`,
    );
    return a;
  };
  // what a search finds, as 'C:C-3' (brand letter and code)
  const find = (E, q) =>
    JSON.parse(
      E(
        `searchStr = ${JSON.stringify(q)}; JSON.stringify(finderMatches().map((i) => COLORS[i].brand[0] + ':' + COLORS[i].code))`,
      ),
    );
  const idx = (E, brand, code) =>
    E(`COLORS.findIndex((c) => c.brand === ${JSON.stringify(brand)} && c.code === ${JSON.stringify(code)})`);
  test('codes: hyphens, spaces and case don’t matter, and "copic b04" is Copic’s B04', () => {
    const { __eval: E } = fresh();
    for (const q of ['c3', 'c 3', 'c-3', 'C-3']) assert.ok(find(E, q.toLowerCase()).includes('C:C-3'), q);
    assert.deepEqual(find(E, 'copic b04'), ['C:B04']);
    assert.deepEqual(find(E, 'w3'), ['C:W-3']);
    // every marker's code, typed with or without its hyphen, finds it
    const miss = JSON.parse(
      E(
        `JSON.stringify(COLORS.map((c, i) => [c.code, i]).filter(([code, i]) => !['', '-'].every((h) => { searchStr = code.replace(/-/g, h).toLowerCase(); return finderMatches().includes(i); })).map(([c]) => c))`,
      ),
    );
    assert.deepEqual(miss, []);
  });
  test('names: grey and gray, colour and color, curly apostrophes; the name as written still found while typing', () => {
    const { __eval: E } = fresh();
    const grey = find(E, 'grey'),
      gray = find(E, 'gray');
    assert.deepEqual(grey, gray);
    assert.ok(
      grey.some((x) => x.startsWith('C:')) && grey.some((x) => x.startsWith('O:')),
      'both brands’ greys',
    );
    assert.deepEqual(find(E, 'cool grey 3'), ['C:C-3']);
    assert.equal(find(E, 'warm grey').length, find(E, 'warm gray').length);
    assert.deepEqual(find(E, 'colourless').sort(), find(E, 'colorless').sort());
    assert.equal(find(E, 'colourless').length, 2);
    assert.ok(find(E, 'robin’s').length >= 1, 'a curly apostrophe');
    // (on the way to "grey", "gre" still has every marker named Grey)
    const named = JSON.parse(
      E(`JSON.stringify(COLORS.filter((c) => /grey/i.test(c.name)).map((c) => c.brand[0] + ':' + c.code))`),
    );
    const gre = find(E, 'gre');
    assert.ok(named.length > 0 && named.every((x) => gre.includes(x)));
  });
  test('old codes: as printed, with Ⅱ typed as two l’s or II', () => {
    const { __eval: E } = fresh();
    const olds = JSON.parse(
      E(`JSON.stringify(COLORS.map((c, i) => [c.old, i]).filter(([o]) => o && /Ⅱ/.test(o)))`),
    );
    assert.ok(olds.length > 0);
    for (const [o, i] of olds)
      for (const q of [o.replace(/Ⅱ/g, 'll'), o.replace(/Ⅱ/g, 'II'), o]) {
        E(`searchStr = ${JSON.stringify(q.toLowerCase())}`);
        assert.ok(JSON.parse(E('JSON.stringify(finderMatches())')).includes(i), q);
      }
  });
  test('brands from four letters; "cop" and "pi" don’t bring every Copic marker', () => {
    const { __eval: E } = fresh();
    const copic = E(`COLORS.filter((c) => c.brand === 'Copic').length`),
      ohuhu = E(`COLORS.filter((c) => c.brand === 'Ohuhu').length`);
    assert.equal(find(E, 'copi').length, copic);
    assert.equal(find(E, 'copic').length, copic);
    assert.equal(find(E, 'ohuh').length, ohuhu);
    assert.ok(find(E, 'cop').length < 20, 'cop: ' + find(E, 'cop').length);
    assert.ok(find(E, 'pi').length < 100, 'pi: ' + find(E, 'pi').length);
  });
  test('numbers: alone, after the code’s letters by their start; among other words, the whole number', () => {
    const { __eval: E } = fresh();
    const r22 = find(E, '22');
    for (const x of ['O:R22', 'C:R22', 'O:E22', 'C:V22']) assert.ok(r22.includes(x), x);
    const z = find(E, '000');
    assert.ok(z.includes('C:B000') && z.includes('C:B0000'));
    // "copic 0": the Copic markers whose number is 0 (C-0, W-0, the blender ...), not every one with a 0 after its letters
    const c0 = find(E, 'copic 0');
    assert.ok(c0.length > 0 && c0.length < 20 && c0.every((x) => x.startsWith('C:')), JSON.stringify(c0));
    assert.ok(c0.includes('C:C-0') && c0.includes('C:W-0'));
    assert.ok(find(E, 'c 3').length < 10, 'c 3: ' + find(E, 'c 3').length);
    // (codes that are all numbers, found as they're typed: "ohuhu 1", "ohuhu 12", "ohuhu 120")
    const o120 = idx(E, 'Ohuhu', '120');
    for (const q of ['ohuhu 1', 'ohuhu 12', 'ohuhu 120']) {
      E(`searchStr = ${JSON.stringify(q)}`);
      assert.ok(JSON.parse(E('JSON.stringify(finderMatches())')).includes(o120), q);
    }
  });
  test('"Best match": the code searched for first; a marker that once had it next, under "Old code"', () => {
    const { __eval: E } = fresh();
    const groups = (q) =>
      JSON.parse(
        E(
          `searchStr = ${JSON.stringify(q)}; JSON.stringify(searchGroups(finderMatches()).map((g) => [g.f.name, g.list.map((i) => COLORS[i].brand[0] + ':' + COLORS[i].code)]))`,
        ),
      );
    const g = groups('g410');
    assert.deepEqual(g[0], ['Best match', ['O:G410']]);
    assert.equal(g[1][0], 'Old code');
    const r = groups('r22');
    assert.deepEqual(r[0], ['Best match', ['O:R22', 'C:R22']]);
    // every code searched for comes first
    const notFirst = JSON.parse(
      E(
        `JSON.stringify(COLORS.filter((c) => { searchStr = c.code.toLowerCase(); const f = [].concat(...searchGroups(finderMatches()).map((g) => g.list))[0]; return COLORS[f].code !== c.code; }).map((c) => c.code))`,
      ),
    );
    assert.deepEqual(notFirst, []);
    // a search that isn't a code has no Best match
    assert.notEqual(groups('pink')[0][0], 'Best match');
  });
  test('"isn’t in your collection" names the code searched for, not a marker whose old code it was', () => {
    const { __eval: E } = fresh();
    const html = E(
      `state.mode = 'collection'; state.collView = 'owned'; state.owned = new Set([mkey(${idx(E, 'Ohuhu', 'B08')})]); searchStr = 'g410'; searchElsewhereHTML(searchOutside())`,
    );
    assert.match(html, /G410 isn’t in your collection/);
  });
  test('Copy codes and Palette from these follow the grid’s order: the Best match first, in Palette’s list too', () => {
    const { __eval: E } = fresh();
    E(`searchStr = 'g410'; renderResults()`);
    assert.deepEqual(JSON.parse(E('JSON.stringify(shownMatches().map((i) => COLORS[i].code))')), [
      'G410',
      'G24',
    ]);
  });
  test('Ramp gaps: Tick all shown and the rest act on the gaps shown, not every unowned match', () => {
    const { __eval: E } = fresh();
    E(
      `state.mode = 'collection'; state.collView = 'unowned'; state.gapSort = 'ramps'; state.owned = new Set([...defaultOwned()]); searchStr = ''; renderResults()`,
    );
    const shown = E('shownMatches().length'),
      ramps = E('rampRank(finderMatches()).length'),
      all = E('finderMatches().length');
    assert.equal(shown, ramps);
    assert.ok(shown < all, shown + ' of ' + all);
  });
  // (v308: the Colorless Blender, and fluorescents, aren't listed in Fill the biggest gaps at all; they came last)
  test('Fill gaps: the Colorless Blender isn’t listed, and owning one doesn’t move the palest markers down', () => {
    const { __eval: E } = fresh();
    const rank = (ownBlender) =>
      JSON.parse(
        E(`state.owned = new Set([...defaultOwned()]); ${ownBlender ? `COLORS.forEach((c, i) => { if (NOINK.has(i) && c.brand === 'Copic') state.owned.add(mkey(i)); });` : ''} state.ink = {};
      (() => { const m = []; for (let i = 0; i < COLORS.length; i++) if (!isOwned(i) && passes(i)) m.push(i);
      const o = gapRank(m); return JSON.stringify({ blend: o.map((i, k) => [i, k]).filter(([i]) => NOINK.has(i)).map(([, k]) => k), n: o.length, top: o.slice(0, 20) }); })()`),
      );
    const a = rank(false),
      b = rank(true);
    assert.deepEqual(a.blend, [], 'no blender: ' + JSON.stringify(a.blend) + ' of ' + a.n);
    assert.deepEqual(b.top, a.top, 'an owned blender changes nothing at the top');
  });
  test('Custom: a scheme with fewer sizes and back keeps its markers; a smaller size chosen in Custom cuts them', () => {
    const { __eval: E } = fresh();
    E(
      `state.mode = 'home'; setHarmony('custom'); setSize(12); state.customPal = COLORS.slice(0, 12).map((c, i) => i * 10); save()`,
    );
    E(`setHarmony('analogous'); setHarmony('custom')`);
    assert.equal(E('state.palSize'), 12);
    assert.equal(E('state.customPal.filter((x) => x != null).length'), 12);
    E(
      `setSize(4); ensureCustomSize(); setHarmony('complementary'); setHarmony('custom'); ensureCustomSize()`,
    );
    assert.equal(E('state.palSize'), 4);
    assert.equal(E('state.customPal.length'), 4);
  });
  test('a code typed with a space is that code, not a letter in a name and a number at the end of another code', () => {
    const { __eval: E } = fresh();
    assert.deepEqual(find(E, 'c 3'), ['C:C-3']);
    assert.deepEqual(find(E, 'w 3'), ['C:W-3']);
    assert.ok(!find(E, 'r 22').some((x) => /V22$/.test(x)), 'not V22: ' + find(E, 'r 22').join());
    assert.ok(find(E, 'r 22').includes('C:R22') && find(E, 'r 22').includes('O:R22'));
    // (words that aren't a code stay words)
    assert.ok(find(E, 'gray no 3').includes('C:C-3'), find(E, 'gray no 3').join());
    assert.ok(find(E, 'cool grey 3').includes('C:C-3'));
  });
}

// ---- from v305-finder.test.mjs ----
// v305 (Markers): Fill gaps › Ramp gaps leaves out the Fluorescent and Neutral / Black families and counts only
// markers of about the same hue as a gap's ends; a search that is the start of a code ("E", "BG", "E0", "r2") shows
// "Codes starting …" straight after Best match, with markers whose old code starts so under "Old code" (v306: under
// "Old codes starting …"; "Old code" is for an old code the search names whole).
{
  const app = () => createApp({ localStorage: memoryStorage() });
  const hueGap = (p, q) => Math.min(Math.abs(p - q), 360 - Math.abs(p - q));
  test('Ramp gaps: no fluorescents or blacks, and every gap has two markers you own of its family within 30° of hue', () => {
    const { __eval: E } = app();
    E(`state.mode = 'collection'; state.collView = 'unowned'; state.gapSort = 'ramps'; state.finderScope = 'all';
     state.owned = new Set([...defaultOwned()]); state.ink = {}; state.pool = null; poolSet = null; searchStr = ''`);
    const r = JSON.parse(
      E(`JSON.stringify(rampRank(finderMatches()).map((i) => {
      const own = COLORS.map((c, j) => j).filter((j) => isOwned(j) && COLORS[j].fam === COLORS[i].fam);
      return { code: COLORS[i].brand[0] + ':' + COLORS[i].code, fam: COLORS[i].fam, lch: LCH[i], own: own.map((j) => LCH[j]) };
    }))`),
    );
    const GREY_C = E('GREY_C');
    assert.ok(r.length >= 20, r.length + ' gaps');
    assert.deepEqual(
      r.filter((g) => /Fluorescent|Neutral \/ Black/.test(g.fam)).map((g) => g.code),
      [],
      'none of those families',
    );
    for (const g of r) {
      const grey = g.lch[1] < GREY_C;
      const near = g.own.filter((o) =>
        grey ? o[1] < GREY_C : o[1] >= GREY_C && hueGap(o[2], g.lch[2]) <= 30,
      );
      assert.ok(near.length >= 2, g.code + ': two of yours of its hue');
    }
    // (v304 began FRV, FG, FBG, FYR)
    assert.ok(!/:F/.test(r[0].code), 'led by ' + r[0].code);
  });
  test('Search: "Codes starting …" comes straight after Best match, letters ending where the query does; old codes under Old codes starting', () => {
    const { __eval: E } = app();
    E(
      `state.mode = 'finder'; state.finderScope = 'all'; state.owned = new Set(); state.pool = null; poolSet = null;`,
    );
    const groups = (q) =>
      JSON.parse(
        E(`searchStr = ${JSON.stringify(q)}; JSON.stringify(searchGroups(finderMatches()).map((g) => ({ name: g.f.name,
        codes: g.list.map((i) => sHay(i).codes[0]), old: g.list.map((i) => sHay(i).codes.slice(1)) })))`),
      );
    // "e": the E codes first (it had been R014, a name with an e), then old codes starting E, then names
    let g = groups('e');
    assert.deepEqual(
      g.slice(0, 2).map((x) => x.name),
      ['Codes starting E', 'Old codes starting E'],
    );
    assert.ok(
      g[0].codes.every((c) => /^e[^a-z]/.test(c)),
      g[0].codes.join(' '),
    );
    assert.ok(g[0].codes.length >= 50);
    assert.ok(
      g[1].old.every((o) => o.some((c) => /^e[^a-z]/.test(c))),
      'old codes starting E',
    );
    // "BG": BG's codes, not BGY's (those come later, with their family)
    g = groups('bg');
    assert.equal(g[0].name, 'Codes starting BG');
    assert.ok(
      g[0].codes.every((c) => /^bg\d/.test(c)),
      g[0].codes.join(' '),
    );
    assert.ok(
      g.slice(1).some((x) => x.codes.some((c) => c.startsWith('bgy'))),
      'BGY still found, further on',
    );
    // "b" isn't BV; "e0" and "r2": the letters, then the digits typed
    assert.ok(groups('b')[0].codes.every((c) => /^b\d/.test(c)));
    assert.equal(groups('e0')[0].name, 'Codes starting E0');
    assert.ok(groups('e0')[0].codes.every((c) => c.startsWith('e0')));
    assert.ok(groups('r2')[0].codes.every((c) => c.startsWith('r2')));
    // a whole code: Best match first, then the codes that start with it
    g = groups('w0');
    assert.deepEqual(g.map((x) => x.name).slice(0, 2), ['Best match', 'Codes starting W0']);
    assert.deepEqual(g[0].codes, ['w0']);
    // words aren't codes: "red", "gre" and two words are grouped by family as before
    for (const q of ['red', 'gre', 'e 0 red'])
      assert.ok(!groups(q).some((x) => /^Codes starting/.test(x.name)), q);
  });
}

// ---- from v306-home.test.mjs ----
// v306 (home branch): Markers' search keeps "Old code" for an old code the search names whole; old codes that only
// start with it go under "Old codes starting …", or with their families after an exact match ("Y26" had filed Y39,
// once Y260, under Old code; "R25" R54, once R250).
{
  const app = () => createApp({ localStorage: memoryStorage() });
  function searcher() {
    const { __eval: E } = app();
    E(
      `state.mode = 'finder'; state.finderScope = 'all'; state.owned = new Set(); state.pool = null; poolSet = null;`,
    );
    return (q) =>
      JSON.parse(
        E(`searchStr = ${JSON.stringify(q)}; JSON.stringify(searchGroups(finderMatches()).map((g) => [g.f.name,
        g.list.map((i) => COLORS[i].brand[0] + ':' + COLORS[i].code)]))`),
      );
  }
  const group = (g, name) => (g.find((x) => x[0] === name) || [name, []])[1];
  // ---- Palette › From photo: "Paper looks warm · Make it white" -----------------------------------------------------
  // Synthetic photos drawn here (160 × 120, as the app reads a small copy): coloured caps on paper under a lamp, cream
  // paper, sunsets, caps on a wooden desk, a portrait, a beach, pale fur.
  const W = 160,
    H = 120;
  function canvas(bg) {
    const d = new Uint8ClampedArray(W * H * 4);
    for (let p = 0; p < W * H; p++) d.set([...bg, 255], p * 4);
    return d;
  }
  function rect(d, x0, y0, x1, y1, c) {
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) d.set(c, (y * W + x) * 4);
  }
  function ellipse(d, cx, cy, rx, ry, c) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) d.set(c, (y * W + x) * 4);
  }
  const toLin = (v) => ((v /= 255) > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92);
  const toS = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
  // the light's colour, per channel in linear light
  function cast(d, k) {
    for (let i = 0; i < d.length; i += 4)
      for (let c = 0; c < 3; c++) d[i + c] = toS(Math.min(1, toLin(d[i + c]) * k[c]));
    return d;
  }
  const CAPS = [
    [230, 30, 40],
    [250, 120, 20],
    [250, 220, 30],
    [120, 200, 60],
    [20, 150, 90],
    [20, 170, 200],
    [30, 90, 200],
    [110, 60, 180],
    [220, 60, 150],
    [240, 170, 190],
    [150, 90, 50],
    [60, 60, 60],
  ];
  function caps(k, bg = [255, 255, 255]) {
    const d = canvas(bg);
    CAPS.forEach((c, i) =>
      rect(d, 8 + (i % 6) * 25, 30 + ((i / 6) | 0) * 45, 26 + (i % 6) * 25, 62 + ((i / 6) | 0) * 45, c),
    );
    return cast(d, k);
  }
  const PHOTOS = {
    // white paper under lamps: shown
    'caps on paper, slightly warm lamp': [caps([1, 0.88, 0.7]), true],
    // a phone photo of a page under a lamp: grey and warm (L about 80, b* about 10)
    'a page photographed under a lamp': [caps([0.62, 0.55, 0.45]), true],
    // the same, darker: too dark to be sure it's paper (L about 68)
    'a darker photo under a lamp': [caps([0.42, 0.38, 0.3]), false],
    // cream paper in daylight reads warm too (the wording says what is seen)
    'cream paper in daylight': [
      (() => {
        const d = canvas([245, 236, 215]);
        CAPS.slice(0, 8).forEach((c, i) => ellipse(d, 12 + i * 19, 60, 8, 8, c));
        return d;
      })(),
      true,
    ],
    // not shown
    'caps on paper in daylight': [caps([1, 1, 1]), false],
    'caps on paper in cool light': [caps([0.8, 0.9, 1]), false],
    'caps on paper under a strong lamp (too coloured to be paper)': [caps([1, 0.78, 0.5]), false],
    'caps on a wooden desk, daylight': [caps([1, 1, 1], [160, 110, 70]), false],
    'caps on a wooden desk, warm lamp': [caps([1, 0.8, 0.55], [160, 110, 70]), false],
    sunset: [
      (() => {
        const d = canvas([30, 25, 40]);
        for (let y = 0; y < 80; y++) {
          const t = y / H;
          rect(
            d,
            0,
            y,
            W,
            y + 1,
            [t < 0.7 ? 80 + 175 * t * 1.4 : 255, 60 + 120 * t, 120 - 60 * t].map(Math.round),
          );
        }
        ellipse(d, 80, 60, 12, 12, [255, 240, 200]);
        // pale warm clouds
        ellipse(d, 40, 20, 30, 8, [250, 214, 190]);
        ellipse(d, 115, 26, 28, 7, [250, 214, 190]);
        return d;
      })(),
      false,
    ],
    'a portrait in a white shirt (skin too dark to be paper)': [
      (() => {
        const d = canvas([90, 70, 60]);
        ellipse(d, 80, 55, 28, 38, [232, 190, 160]);
        ellipse(d, 80, 35, 20, 12, [245, 215, 190]);
        rect(d, 40, 92, 120, H, [240, 236, 230]);
        return d;
      })(),
      false,
    ],
    'a beach': [
      (() => {
        const d = canvas([225, 200, 160]);
        rect(d, 0, 0, W, 48, [140, 190, 235]);
        rect(d, 0, 48, W, 60, [40, 110, 160]);
        return d;
      })(),
      false,
    ],
    'pale fur (light, but not paper-light)': [canvas([178, 166, 150]), false],
    'a little white paper among colour (under 15%)': [
      (() => {
        const d = canvas([200, 60, 50]);
        rect(d, 0, 0, 30, 60, [250, 235, 205]);
        return d;
      })(),
      false,
    ],
  };
  // ---- Palette's Rainbow scheme (U5) ---------------------------------------------------------------------------------
  // an app with Ben's own markers (defaultOwned: 451), or these sets, owned; the guide's collection to match
  function rainbowApp(sets) {
    const a = createApp(),
      E = a.__eval,
      t = a.__mstest;
    if (sets) {
      E('state.owned = new Set()');
      for (const n of sets)
        E(
          `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
        );
    } else E('state.owned = new Set(defaultOwned())');
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { a, E, t };
  }
  const rb = (E, n, opts = '{}') => JSON.parse(E(`JSON.stringify(genPalette(${n}, 'rainbow', ${opts}))`));
  const codes = (E, pal) => JSON.parse(E(`JSON.stringify(${JSON.stringify(pal)}.map((i) => mkey(i)))`));
  // the Gradient's markers in the order they run, for n markers on a page of many sections, Smooth (one per band)
  function gradientRun(t, n, src) {
    const N = 300,
      labels = new Int32Array(N + 1).map((_, i) => i),
      comps = [null];
    for (let l = 1; l <= N; l++)
      comps.push({
        area: 10,
        bg: false,
        bpx: 0,
        cx: l,
        cy: 1,
        h: 1,
        x0: l,
        y0: 0,
        x1: l,
        y1: 1,
        merged: false,
      });
    t.W = N + 1;
    t.H = 1;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    Object.assign(t.styleVars, {
      family: 'gradient',
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      gradSeed: 0,
      dir: 1,
      look: 'smooth',
      gradShape: 'serpentine',
      limitN: n,
      expand: false,
      // (v308: a new guide's Gradient, Include as the Mood has it, as Palette's Rainbow picks)
      gradIncl: {},
      ...src,
    });
    return [...t.grad.plan(t.grad.poolSource(n), N).seq].map((m) => m.mkey);
  }
  // (v308) the same markers in the same order round the loop: Palette's Rainbow starts at red (rainbowOrder), wherever
  // the Gradient's loop starts and whichever way it runs
  function sameLoop(a, b) {
    if (a.length !== b.length) return false;
    for (const s of [b, b.slice().reverse()])
      for (let k = 0; k < s.length; k++) if (a.every((x, j) => x === s[(j + k) % s.length])) return true;
    return false;
  }
  test('Search "Y26": both Y26s, and Y39 (once Y260) is not under Old code', () => {
    const groups = searcher();
    const g = groups('y26');
    assert.deepEqual(g[0], ['Best match', ['O:Y26', 'C:Y26']]);
    assert.ok(!g.some((x) => /^Old code/.test(x[0])), g.map((x) => x[0]).join(', '));
    assert.ok(group(g, 'Yellow').includes('O:Y39'), 'Y39 still found, with its family');
  });
  test('Search "R25": BV26 (once R25) stays under Old code; R54 (once R250) goes with the reds', () => {
    const g = searcher()('r25');
    assert.deepEqual(g[0], ['Best match', ['O:R25']]);
    assert.deepEqual(group(g, 'Old code'), ['O:BV26']);
    assert.ok(!group(g, 'Old code').includes('O:R54'));
    assert.ok(!g.some((x) => /^Old codes starting/.test(x[0])));
    assert.ok(group(g, 'Red').includes('O:R54'));
  });
  test('Without an exact match, old codes that start so get their own group after the exact old code', () => {
    const groups = searcher();
    let g = groups('y2');
    const names = g.map((x) => x[0]);
    assert.deepEqual(names.slice(0, 3), ['Codes starting Y2', 'Old code', 'Old codes starting Y2']);
    assert.deepEqual(group(g, 'Old code'), ['O:Y111']);
    assert.ok(group(g, 'Old codes starting Y2').includes('O:Y39'));
    // the whole old code still files under Old code
    assert.deepEqual(groups('y260')[0], ['Old code', ['O:Y39']]);
    assert.deepEqual(groups('r250')[0], ['Old code', ['O:R54']]);
    // "g410": its own code, then G24, whose old code it was (v304)
    g = groups('g410');
    assert.deepEqual(g[0], ['Best match', ['O:G410']]);
    assert.deepEqual(group(g, 'Old code'), ['O:G24']);
  });
  test('Paper looks warm: shown for clearly warm paper (L 75+, 15% of the picture, b* 8+), never for sunsets, wood or skin', () => {
    const { __eval: E } = app();
    const got = {};
    for (const [name, [d]] of Object.entries(PHOTOS))
      got[name] = JSON.parse(
        E(`(function () { const r = paperWarm(new Uint8ClampedArray(${JSON.stringify([...d])}));
        return JSON.stringify(r && { L: r.lab[0], b: r.lab[2], share: r.share, gain: [...r.fix.gain] }); })()`),
      );
    for (const [name, [, want]] of Object.entries(PHOTOS))
      assert.equal(!!got[name], want, name + ': ' + JSON.stringify(got[name]));
    for (const r of Object.values(got).filter(Boolean)) {
      assert.ok(r.L >= 75 && r.b >= 8 && r.share >= 0.15, JSON.stringify(r));
      // the correction cools the picture: blue gains more than red
      assert.ok(r.gain[2] > r.gain[0] * 1.1, JSON.stringify(r));
    }
  });
  test('Paper looks warm: the correction is what tapping that paper does (paperSpot of paperOf), and it whitens the paper', () => {
    const { __eval: E } = app();
    const d = JSON.stringify([...PHOTOS['caps on paper, slightly warm lamp'][0]]);
    const r = JSON.parse(
      E(`(function () { const d = new Uint8ClampedArray(${d}), w = paperWarm(d), s = paperSpot(paperOf(d));
      const px = lightApply(w.fix, d[0], d[1], d[2]), lab = rgbLab8(px[0], px[1], px[2]);
      return JSON.stringify({ same: JSON.stringify([...w.fix.gain]) === JSON.stringify([...s.fix.gain]), lab: [...lab] }); })()`),
    );
    assert.ok(r.same, 'the same correction as a tap on the paper');
    assert.ok(
      Math.hypot(r.lab[1], r.lab[2]) < 3,
      'the paper comes out white: ' + r.lab.map((v) => v.toFixed(1)).join(' '),
    );
  });
  test('Rainbow: the Gradient’s markers in its order at the same count; a saved or generated Rainbow lays the same', () => {
    const { E, t } = rainbowApp();
    for (const n of [6, 8, 10, 12, 14]) {
      const pal = codes(E, rb(E, n));
      assert.equal(pal.length, n);
      assert.ok(sameLoop(pal, gradientRun(t, n)), n + ': the Gradient’s own');
      assert.ok(
        sameLoop(gradientRun(t, n, { paletteSource: 'generate', genPal: pal }), pal),
        n + ': laid from the palette',
      );
    }
  });
  test('Rainbow: no two colours under ΔE 5 where another marker near that hue will do (Ben’s teal–cyan at 16)', () => {
    const { E, t } = rainbowApp();
    const own = gradientRun(t, 16),
      min = (keys) => E(`palMinDE(${JSON.stringify(keys)}.map(keyIdx))`);
    // (v308: the Gradient's own 16, from Ben's vivid markers with lightness following hue, no longer has a pair under 5,
    // B111 and B112 3.9 apart before; the Rainbow is the Gradient's 16)
    assert.ok(min(own) >= 5, 'the Gradient’s: ' + min(own));
    const pal = codes(E, rb(E, 16));
    assert.equal(pal.length, 16);
    assert.ok(min(pal) >= 5, 'the Rainbow’s: ' + min(pal));
    assert.equal(pal.filter((k) => own.includes(k)).length, 16, 'the Gradient’s own');
    assert.ok(E(`palOnScheme(${JSON.stringify(pal)}.map(keyIdx), 'rainbow')`));
    // lightness follows hue now (yellow light, violet dark), within the vivid band
    const L = JSON.parse(E(`JSON.stringify(${JSON.stringify(pal)}.map((k) => LCH[keyIdx(k)][0]))`));
    assert.ok(Math.max(...L) - Math.min(...L) < 55, L.join(' '));
  });
  test('Rainbow: Generate rolls others (seeded), each a rainbow; locked colours stay where they are', () => {
    const { E } = rainbowApp();
    const first = rb(E, 8),
      seen = new Set();
    for (let k = 0; k < 6; k++) {
      const p = rb(E, 8, '{ reroll: true }');
      assert.equal(p.length, 8);
      assert.equal(new Set(p).size, 8, 'no marker twice');
      assert.ok(E(`palOnScheme(${JSON.stringify(p)}, 'rainbow')`), 'round the wheel');
      seen.add(p.join());
    }
    assert.ok(seen.size >= 3, seen.size + ' different rolls of 6');
    // the same seed gives the same palette
    const s1 = E(
        `JSON.stringify(SF.rainbowPick(8, 'neutral', COLORS.map((c, i) => i).filter(inPool), { seed: 0.3 }))`,
      ),
      s2 = E(
        `JSON.stringify(SF.rainbowPick(8, 'neutral', COLORS.map((c, i) => i).filter(inPool), { seed: 0.3 }))`,
      );
    assert.equal(s1, s2);
    // locks: two colours kept, the others picked round them, still round the wheel (v308: in rainbow order from red, the
    // locked ones in their places in it)
    const lk = { 0: first[3], 5: first[0] };
    for (let k = 0; k < 4; k++) {
      const p = rb(E, 8, `{ reroll: true, locked: ${JSON.stringify(lk)} }`);
      assert.equal(p.length, 8);
      assert.ok(p.includes(first[3]));
      assert.ok(p.includes(first[0]));
      assert.equal(new Set(p).size, 8);
      assert.ok(E(`palOnScheme(${JSON.stringify(p)}, 'rainbow')`));
    }
  });
  test('Rainbow: from the markers in play (filters, a selection), the catalogue with none owned, capped at the clear ones', () => {
    let { E } = rainbowApp();
    // a family filtered out stays out
    E(`state.excluded = new Set(['Fluorescent'])`);
    let p = rb(E, 12);
    assert.equal(p.length, 12);
    assert.ok(
      JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.every((i) => COLORS[i].fam !== 'Fluorescent'))`)),
    );
    E(`state.excluded = new Set()`);
    // a selection: only its markers
    E(
      `setPool(COLORS.map((c, i) => i).filter((i) => isOwned(i) && LCH[i][1] >= 25).filter((_, k) => k % 3 === 0))`,
    );
    p = rb(E, 10);
    assert.equal(p.length, 10);
    assert.ok(JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.every((i) => state.pool.includes(i)))`)));
    E('setPool(null)');
    // none owned: the whole catalogue
    E('state.owned = new Set()');
    p = rb(E, 16);
    assert.equal(p.length, 16);
    assert.ok(E(`palMinDE(${JSON.stringify(p)})`) >= 5);
    // Ciao 12: 11 clear colours and a black; 12 or 16 gives the 11, never the black (v308: past its vivid ones, the
    // other clear ones, as Palette says there are)
    ({ E } = rainbowApp(['Ciao 12']));
    for (const n of [12, 16]) {
      p = rb(E, n);
      const clear = E(`COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] >= GREY_C).length`);
      assert.equal(p.length, Math.min(n, clear), n + '');
      assert.ok(
        JSON.parse(E(`JSON.stringify(${JSON.stringify(p)}.every((i) => LCH[i][1] >= GREY_C))`)),
        'no grey',
      );
    }
    // too few clear markers for 6: none
    ({ E } = rainbowApp());
    E(`setPool(COLORS.map((c, i) => i).filter((i) => isOwned(i) && LCH[i][1] >= 25).slice(0, 4))`);
    assert.equal(E(`genPalette(6, 'rainbow', {})`), null);
  });
  test('Rainbow: on its scheme as Palette judges it; a re-rolled colour fills its own gap and keeps it a rainbow', () => {
    const { E } = rainbowApp();
    const p = rb(E, 10);
    assert.ok(E(`palOnScheme(${JSON.stringify(p)}, 'rainbow')`));
    // a palette of blues and reds isn't a rainbow
    const two = rb(E, 10).filter((_, k) => k < 2);
    assert.equal(E(`palOnScheme(${JSON.stringify(two.concat(two))}, 'rainbow')`), false);
    assert.equal(E(`genNeed('rainbow')`), 5);
    for (let k = 0; k < 10; k++) {
      const pick = E(`rerollPick(${JSON.stringify(p)}, ${k}, 'rainbow')`);
      assert.ok(pick >= 0 && !p.includes(pick), k + ': another marker');
      const np = p.slice();
      np[k] = pick;
      assert.ok(E(`palOnScheme(${JSON.stringify(np)}, 'rainbow')`), k + ': still a rainbow');
      // near the hue it had (its gap's middle), not across the wheel
      const d = E(`hueDist(LCH[${pick}][2], LCH[${p[k]}][2])`);
      assert.ok(d <= 45, k + ': ' + d.toFixed(0) + '°');
    }
  });
  // ---- Home's latest piece: which guide ------------------------------------------------------------------------------
  test('Home’s latest piece: the newest guide when finished and nothing is in progress; none otherwise', () => {
    const { __eval: E } = app();
    const pick = (list) =>
      E(`(function () { const all = ${JSON.stringify(list)}; const cont = all.find(homeStarted) || null;
      const h = homeHeroPick(all, cont); return h ? h.name : null; })()`);
    const g = (name, n, done, ts, extra = {}) => ({
      id: ts,
      type: 'guide',
      name,
      n,
      done,
      ts,
      keys: [],
      ...extra,
    });
    assert.equal(pick([]), null, 'empty Home');
    assert.equal(pick([g('A', 10, 10, 3), g('B', 10, 0, 2)]), 'A');
    assert.equal(pick([g('A', 10, 0, 3), g('B', 10, 10, 2)]), null, 'the newest isn’t finished');
    assert.equal(pick([g('A', 10, 10, 3), g('B', 10, 4, 2)]), null, 'Continue keeps priority');
    assert.equal(pick([g('A', 10, 10, 3), g('B', 10, 0, 2, { tn: 2 })]), null, 'some tones: in progress');
    assert.equal(pick([g('A', 12, 10, 3)]), null, 'sections added in Edit sections');
    assert.equal(pick([g('A', 0, 0, 3)]), null, 'no sections');
    // a picture that couldn't be read: none
    E(`_heroBad['3|3'] = 1`);
    assert.equal(pick([g('A', 10, 10, 3)]), null);
    assert.equal(E(`heroDate(new Date(new Date().getFullYear(), 9, 4).getTime())`), '4 Oct');
    assert.equal(E(`heroDate(new Date(2024, 9, 4).getTime())`), '4 Oct 2024');
  });
}

// ---- from v308-markers.test.mjs ----
// v308 Markers: Unowned's orders follow Brands I'd buy (your brands first, another only for a colour yours don't have;
// no fluorescents or blender in the gaps and families to finish), Copic's fluorescent cap codes, Ohuhu's BGY and YGY
// greys as "Blue Grey" and "Yellow Grey" with the greys (saved filters follow), Owned's "Running low", a search that's a
// list of codes, and Scan's lines it couldn't read.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const fresh = (st) => {
    const a = createApp({ localStorage: memoryStorage(st ? { [KEY]: JSON.stringify(st) } : {}) });
    a.__eval(
      `state.mode = 'collection'; state.collView = 'unowned'; state.finderScope = 'all'; state.pool = null; poolSet = null; searchStr = ''; state.ink = {};`,
    );
    return a.__eval;
  };
  const J = (E, s) => JSON.parse(E('JSON.stringify(' + s + ')'));
  // Honolulu 24 and 48: an Ohuhu-only collection
  const OHUHU_ONLY =
    'state.owned = new Set([...presetMkeys(MARKER_SETS[0]), ...presetMkeys(MARKER_SETS[1])]); state.buyBrands = null;';
  const unowned = 'finderMatches()';
  test('Unowned › Fill the biggest gaps: your brands first, another brand only after them and only for a colour yours don’t have', () => {
    const E = fresh();
    E(OHUHU_ONLY);
    const g = J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`);
    const firstCopic = g.indexOf('Copic');
    assert.ok(firstCopic > 0, 'Ohuhu first');
    assert.ok(
      g.slice(firstCopic).every((b) => b === 'Copic'),
      'Copic only after every Ohuhu',
    );
    assert.ok(
      g.filter((b) => b === 'Copic').length < 80,
      'and only some: ' + g.filter((b) => b === 'Copic').length,
    );
    // each Copic one listed has no Ohuhu marker within BUY_OTHER_DE
    const far = J(
      E,
      `gapRank(${unowned}).filter((i) => COLORS[i].brand === 'Copic').map((i) => Math.min(...COLORS.map((c, j) => j).filter((j) => COLORS[j].brand === 'Ohuhu' && !NOINK.has(j)).map((j) => de2000(LAB[i], LAB[j]))))`,
    );
    assert.ok(
      far.every((d) => d >= E('BUY_OTHER_DE')),
      'a colour Ohuhu doesn’t have',
    );
    // Brands I'd buy ticked: only those
    E(`state.buyBrands = ['Ohuhu']`);
    assert.deepEqual([...new Set(J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`))], ['Ohuhu']);
    E(`state.buyBrands = ['Copic']`);
    assert.deepEqual(
      [...new Set(J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`))],
      ['Copic'],
      'Copic only, though you own none',
    );
  });
  test('Unowned: no fluorescents or Colorless Blender in Fill the biggest gaps or Finish families (unless the filters leave only those)', () => {
    const E = fresh();
    E('state.owned = new Set([...defaultOwned()]); state.buyBrands = null;');
    const g = J(E, `gapRank(${unowned}).map((i) => COLORS[i].fam + (NOINK.has(i) ? ' blender' : ''))`);
    assert.ok(g.length > 100);
    assert.deepEqual(
      g.filter((f) => /Fluorescent|blender/.test(f)),
      [],
    );
    const fams = J(E, `completeGroups(${unowned}).map((g) => g.fam)`);
    assert.ok(!fams.includes('Fluorescent'), fams.join(', '));
    assert.ok(!J(E, `completeGroups(${unowned}).some((g) => g.un.some((i) => NOINK.has(i)))`), 'no blender');
    // a filter to the fluorescents alone: they're what's asked for
    E(`state.excluded = new Set(families.map((f) => f.name).filter((n) => n !== 'Fluorescent'))`);
    assert.ok(J(E, `gapRank(${unowned}).length`) > 0);
  });
  test('Unowned › Finish families counts a family in your brands; Ramp gaps puts your brands first', () => {
    const E = fresh();
    E(OHUHU_ONLY);
    const g = J(
      E,
      `completeGroups(${unowned}).map((g) => ({ fam: g.fam, total: g.total, brands: [...new Set(g.un.map((i) => COLORS[i].brand))] }))`,
    );
    assert.ok(
      g.every((x) => x.brands.join() === 'Ohuhu'),
      'only Ohuhu to finish',
    );
    const ohuhuGreen = E(`COLORS.filter((c) => c.brand === 'Ohuhu' && c.fam === 'Green').length`);
    assert.equal(g.find((x) => x.fam === 'Green').total, ohuhuGreen, 'Green counted in Ohuhu');
    const r = J(E, `rampRank(${unowned}).map((i) => COLORS[i].brand)`);
    const c = r.indexOf('Copic');
    assert.ok(c < 0 || r.slice(c).every((b) => b === 'Copic'), 'Ohuhu ramps first');
    // Ben's two brands: both are yours, and the order is as before apart from fluorescents and the blender
    E('state.owned = new Set([...defaultOwned()])');
    assert.ok(J(E, `gapRank(${unowned}).map((i) => COLORS[i].brand)`).slice(0, 30).includes('Copic'));
  });
  test('Copic fluorescents are found by the codes on their caps (FB2, FBG2, FRV1, FV2, FY1, FYG1, FYG2, FYR1)', () => {
    const E = fresh();
    const cap = {
      FB2: 'FB',
      FBG2: 'FBG',
      FRV1: 'FRV',
      FV2: 'FV',
      FY1: 'FY',
      FYG1: 'FYG',
      FYG2: 'FG',
      FYR1: 'FYR',
    };
    for (const [old, now] of Object.entries(cap)) {
      assert.equal(E(`knownMkey('Copic|${old}')`), 'Copic|' + now, old);
      E(`state.collView = 'all'; searchStr = ${JSON.stringify(old.toLowerCase())}`);
      assert.ok(
        J(E, 'finderMatches().map((i) => COLORS[i].brand + "|" + COLORS[i].code)').includes('Copic|' + now),
        'search ' + old,
      );
      assert.deepEqual(
        J(E, `scanRead(${JSON.stringify(old)}, 'Copic').codes.map((c) => c.opts.map((i) => COLORS[i].code))`),
        [[now]],
        'Scan ' + old,
      );
    }
    // a current code is still itself: FYG is Fluorescent Yellow Green, FYG2 is Fluorescent Green
    assert.equal(E(`knownMkey('Copic|FYG')`), 'Copic|FYG');
  });
  test('Ohuhu’s BGY and YGY greys are Blue Grey and Yellow Grey, listed with the greys; a saved filter follows them', () => {
    const E = fresh();
    assert.deepEqual(
      [...new Set(J(E, `COLORS.filter((c) => /^(BGY|YGY)/.test(c.code)).map((c) => c.fam)`))].sort(),
      ['Blue Grey', 'Yellow Grey'],
    );
    const order = J(E, 'families.map((f) => f.name)');
    const greys = order.slice(order.indexOf('Warm Grey'), order.indexOf('Green Grey') + 1);
    assert.ok(greys.includes('Blue Grey') && greys.includes('Yellow Grey'), order.join(', '));
    assert.ok(order.indexOf('Yellow-Green') === order.indexOf('Yellow') + 1, 'not between the colours');
    assert.ok(E(`WARM_FAMS.has('Yellow Grey') && COOL_FAMS.has('Blue Grey')`));
    // a filter saved before v308 leaving them out still leaves them out
    const E2 = fresh({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R014'],
      saved: [],
      excluded: ['Blue-Green-Yellow', 'Yellow-Green-Yellow', 'Red'],
    });
    assert.deepEqual(J(E2, '[...state.excluded].sort()'), ['Blue Grey', 'Red', 'Yellow Grey']);
    assert.equal(E2(`passes(COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'BGY24'))`), false);
  });
  test('Owned › Running low: only the markers you marked running low or dry', () => {
    const E = fresh();
    E(
      `state.owned = new Set(['Ohuhu|R014', 'Ohuhu|B08', 'Ohuhu|Y111']); state.ink = { 'Ohuhu|B08': 'low', 'Ohuhu|Y111': 'dry', 'Copic|E09': 'low' }; state.collView = 'owned'`,
    );
    assert.deepEqual(J(E, 'lowCount()'), { n: 2, dry: 1 }, 'yours only');
    assert.equal(J(E, 'finderMatches()').length, 3);
    E('lowOnly = true');
    assert.deepEqual(J(E, 'finderMatches().map((i) => COLORS[i].code)').sort(), ['B08', 'Y111']);
    E(`state.collView = 'all'`);
    assert.ok(J(E, 'finderMatches()').length > 3, 'only in Owned');
  });
  test('a search that is a list of codes points to Scan or type codes', () => {
    const E = fresh();
    for (const q of ['b02, b03', 'B02 B03 R014', 'c-3; c-5', 'fb2 / fy1'])
      assert.equal(E(`searchList(${JSON.stringify(q)})`), true, q);
    for (const q of ['b02', 'cool grey 3', 'red pink', 'b02 sugar'])
      assert.equal(E(`searchList(${JSON.stringify(q)})`), false, q);
  });
  test('Scan: a pasted line with nothing to read in it is counted, not dropped without a word', () => {
    const E = fresh();
    const r = J(
      E,
      `(() => { const r = scanRead('B02\\nfoo bar\\nR014\\n?? !!', ''); return { codes: r.codes.length, unread: r.unread }; })()`,
    );
    // (v317: lines of plain words beside codes are the names and noise of a tray photographed: not counted; a line with
    // a digit in it, and any line when nothing in the paste is a code, still are)
    assert.deepEqual(r, { codes: 2, unread: 0 });
    assert.deepEqual(
      J(
        E,
        `(() => { const r = scanRead('B02\\nfoo 7 bar\\nR014\\n?? !!', ''); return { codes: r.codes.length, unread: r.unread }; })()`,
      ),
      { codes: 2, unread: 1 },
    );
    assert.deepEqual(
      J(
        E,
        `(() => { const r = scanRead('foo bar\\n?? !!', ''); return { codes: r.codes.length, unread: r.unread }; })()`,
      ),
      { codes: 0, unread: 2 },
    );
  });
}

// ---- from v309-collection.test.mjs ----
// v309: "I'm not sure which set" — findSets ranks a brand's sets from about how many markers and a few caps.
{
  const app = createApp();
  const set = (n) => app.__eval(`MARKER_SETS.findIndex((p) => p.n === ${JSON.stringify(n)})`);
  const keysOf = (n) => app.__eval(`presetMkeys(MARKER_SETS[${set(n)}])`);
  const name = (r) => app.__eval(`MARKER_SETS[${r.i}].n`);
  const key = (b, code) => b + '|' + code;
  const bucket = (t) => app.__eval(`FIND_BUCKETS.findIndex((b) => b.t === ${JSON.stringify(t)})`);
  test('the count only ranks: Honolulu sets sit inside each other, and the one in the range comes first', () => {
    const caps = [key('Ohuhu', 'R014'), key('Ohuhu', 'Y28'), key('Ohuhu', 'BG314')];
    for (const k of caps) assert.ok(keysOf('Honolulu 120').includes(k), k);
    const r = app.findSets('Ohuhu', bucket('101–150'), caps);
    assert.equal(name(r[0]), 'Honolulu 120');
    assert.ok(r[0].all && r[0].hits === 3);
    // (Honolulu 72 hasn't BG314 or Y28) the sets with all three follow, nearest size first
    assert.deepEqual(
      [...r.slice(1, 3)].map(name),
      ['Honolulu 168', 'Honolulu 216'],
      'the bigger sets that have all three, nearest first',
    );
    const off = app.findSets('Ohuhu', bucket('151–250'), caps);
    assert.ok(off.slice(0, 3).map(name).includes('Honolulu 120'), 'one range off: still in the first three');
  });
  test('only the brand chosen; sets with none of the caps left out; with no caps, all of the brand', () => {
    const r = app.findSets('Copic', bucket('Up to 30'), [key('Copic', 'E00'), key('Copic', 'R29')]);
    assert.ok(r.length > 0);
    assert.ok(r.every((x) => app.__eval(`MARKER_SETS[${x.i}].b`) === 'Copic'));
    assert.ok(r.every((x) => x.hits > 0));
    assert.equal(name(r[0]), 'Ciao 24', 'the smallest in range with both');
    const all = app.findSets('Ohuhu', -1, []);
    assert.equal(all.length, app.__eval("MARKER_SETS.filter((p) => p.b === 'Ohuhu').length"));
  });
  // (v309.1: a cap in no set no longer counts against a set; that test is below. Here, a cap from another set does)
  test('a cap from another set: the sets with the others first, marked as not having all', () => {
    const caps = [key('Ohuhu', 'R014'), key('Ohuhu', 'Y28'), key('Ohuhu', 'B03')];
    const r = app.findSets('Ohuhu', bucket('101–150'), caps);
    assert.ok(!keysOf('Honolulu 120').includes(key('Ohuhu', 'B03')), 'B03 isn’t in Honolulu 120');
    assert.ok(r[0].all, 'a bigger set has all three');
    const h120 = [...r].find((x) => name(x) === 'Honolulu 120');
    assert.equal(h120.hits, 2);
    assert.equal(h120.all, false);
  });
  test('measured: with the right count and 3 caps, the set is first almost always and in the first two always', () => {
    const sets = app.__eval('MARKER_SETS.map((p) => ({ b: p.b, keys: presetMkeys(p) }))');
    const B = app.__eval('FIND_BUCKETS');
    const bk = (n) => B.findIndex((b) => n >= b.lo && n <= b.hi);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let first = 0,
      two = 0,
      n = 0;
    sets.forEach((S) => {
      for (let t = 0; t < 30; t++) {
        const pick = [...S.keys]
          .map((k) => [rnd(), k])
          .sort((a, b) => a[0] - b[0])
          .slice(0, 3)
          .map((x) => x[1]);
        const r = app.findSets(S.b, bk(S.keys.length), pick);
        const same = (x) => {
          const k = sets[x.i].keys;
          return k.length === S.keys.length && k.every((q) => S.keys.includes(q));
        };
        n++;
        if (same(r[0])) first++;
        if (r.slice(0, 2).some(same)) two++;
      }
    });
    assert.ok(first / n >= 0.95, 'first: ' + ((100 * first) / n).toFixed(1) + '%');
    assert.equal(two, n, 'in the first two');
  });
  // v309.1: a cap in none of the brand's sets (a colour sold on its own, such as Ohuhu B04) says nothing about the set:
  // it doesn't count. The Colorless Blender comes with most Ohuhu sets (not the 24, nor the 6 Skin Tones), so it counts.
  test('a cap in no set is left out of the count; with only such caps, nothing fits; the blender comes with the sets', () => {
    const caps = [key('Ohuhu', 'B04'), key('Ohuhu', 'R014'), key('Ohuhu', 'BG314')];
    for (const p of app.__eval("MARKER_SETS.filter((p) => p.b === 'Ohuhu').map((p) => p.n)"))
      assert.ok(!keysOf(p).includes(key('Ohuhu', 'B04')), p);
    const r = app.findSets('Ohuhu', bucket('101–150'), caps);
    assert.equal(name(r[0]), 'Honolulu 120');
    assert.ok(r[0].all, 'all of the caps that count');
    assert.equal(r[0].of, 2);
    assert.equal(r[0].n, 120, 'its size: the colours, not the blender');
    assert.equal(app.findSets('Ohuhu', bucket('101–150'), [key('Ohuhu', 'B04')]).length, 0);
    assert.ok(keysOf('Honolulu 120').includes(key('Ohuhu', '0')));
    assert.ok(!keysOf('Honolulu 24').includes(key('Ohuhu', '0')));
    assert.equal(
      app.__eval("presetSize(MARKER_SETS.find((p) => p.n === 'Honolulu 320 (complete set)'))"),
      320,
    );
  });
}

// ---- from v309-d2.test.mjs ----
// v309.1 (review 2): "All Copic markers" in findSets. It has every Copic cap, so it came first whenever no real set had
// all the caps read (caps from two sets, one misread), whatever "about how many" said.
{
  const app = createApp();
  const name = (r) => app.__eval(`MARKER_SETS[${r.i}].n`);
  const bucket = (t) => app.__eval(`FIND_BUCKETS.findIndex((b) => b.t === ${JSON.stringify(t)})`);
  // one cap each from Ciao 24 (R29, E00) and Sketch 72 - Set D (B000): no real set has all three
  const mix = ['Copic|R29', 'Copic|E00', 'Copic|B000'];
  test('caps no real set has all of: the sets with most of them first, All Copic markers last (not ruled out)', () => {
    for (const t of ['Up to 30', '31–60', '61–100', '101–150', '151–250']) {
      const r = app.findSets('Copic', bucket(t), mix);
      assert.notEqual(name(r[0]), 'All Copic markers', t);
      assert.equal(r[0].all, false, t);
      assert.equal(name(r.at(-1)), 'All Copic markers', t);
      assert.equal(r.at(-1).far, true);
      // the welcome's list: none has every cap, so all of them, the most caps first
      const l = app.__eval(
        `findList(findSets('Copic', ${bucket(t)}, ${JSON.stringify(mix)})).map((x) => MARKER_SETS[x.i].n)`,
      );
      assert.notEqual(l[0], 'All Copic markers');
      assert.equal(l.at(-1), 'All Copic markers');
    }
  });
  test('more than 250 Copic markers: All Copic markers first', () => {
    const r = app.findSets('Copic', bucket('More than 250'), mix);
    assert.equal(name(r[0]), 'All Copic markers');
    assert.ok(r[0].all && !r[0].far);
  });
  test('caps one real set has: that set first, All Copic markers after the sets with every cap', () => {
    const r = app.findSets('Copic', bucket('Up to 30'), ['Copic|R29', 'Copic|E00']);
    const l = app.__eval(
      `findList(findSets('Copic', ${bucket('Up to 30')}, ['Copic|R29', 'Copic|E00'])).map((x) => MARKER_SETS[x.i].n)`,
    );
    assert.equal(name(r[0]), 'Ciao 24');
    assert.equal(l.at(-1), 'All Copic markers');
    assert.ok(l.length > 1);
  });
}

// ---- from v3091-d3.test.mjs ----
// v309.2 (reviewer 3): Markers and Palette.
{
  const app = createApp();
  const size = (n) => app.__eval(`presetSize(MARKER_SETS.find((p) => p.n === ${JSON.stringify(n)}))`);
  const row = (n) => {
    const h = app.__eval('presetListHTML()'),
      m = h.match(
        new RegExp(
          '<span class="presetnm">' +
            n.replace(/[()]/g, '\\$&') +
            '</span><span class="presetn">([^<]*)</span>',
        ),
      );
    return m && m[1];
  };
  test("a Copic set's Colorless Blender is one of the markers its name counts; an Ohuhu set's added one isn't", () => {
    // (v309's "a set's size is its colours" had made Ciao 36 Set B 35 and All Copic markers 357)
    assert.equal(size('Ciao 36 - Set B'), 36);
    assert.equal(size('Ciao 72 - Set A'), 72);
    assert.equal(size('Sketch 72 - Set B'), 72);
    assert.equal(size('All Copic markers'), 358);
    assert.equal(row('Ciao 36 - Set B'), '36');
    assert.equal(row('All Copic markers'), '358');
    // the Ohuhu sets as v309 has them
    assert.equal(size('Honolulu 120'), 120);
    assert.equal(size('Honolulu 320 (complete set)'), 320);
    assert.equal(row('Honolulu 120'), '120');
  });
}

// ---- from v31826-w2.test.mjs ----
// v318.26 (builder W2): Blends with in a marker's details (SF.blendFor, 88-coverage-blend.js) and the skin tones
// (skinIdx, events.js). The browser tests (e2e/v31826-w2) cover the sheet, Tester questions, Change colour's row and
// Markers' search.
{
  function appWith(sets = [], more = []) {
    const app = createApp(),
      E = app.__eval;
    E('state.owned = new Set(); state.ink = {}');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    for (const k of more) E(`state.owned.add(${JSON.stringify(k)})`);
    return { app, E, core: app.__mstest };
  }
  const pick = (c) =>
    c && {
      light: c.light ? c.light.mkey : null,
      lo: !!c.lightOwned,
      dark: c.dark ? c.dark.mkey : null,
      dOwn: !!c.darkOwned,
    };
  test('Blends with: the companions a guide made now would show (its collection, rule 4), for every marker', () => {
    const { app, E, core } = appWith(['Honolulu 120'], ['Copic|E00', 'Copic|E11', 'Copic|R20']);
    // a new guide: your markers (sfCollection) and the current rule
    core.coll = E('sfCollection()');
    core.styleVars.famRule = 4;
    const keys = E('JSON.stringify(COLORS.map((c, i) => (NOINK.has(i) ? null : mkey(i))).filter(Boolean))');
    let n = 0;
    for (const k of JSON.parse(keys)) {
      const i = E(`keyIdx(${JSON.stringify(k)})`),
        base = {
          mkey: k,
          code: E(`COLORS[${i}].code`),
          brand: E(`COLORS[${i}].brand`),
          hex: E(`COLORS[${i}].hex`),
        };
      base.lab = E(`LAB[${i}]`);
      base.fam = E(`COLORS[${i}].fam`);
      const want = pick(core.colour.companions(base));
      // (another guide open meanwhile, with its own collection and rule: set aside for the call)
      const c0 = core.coll;
      core.coll = [];
      core.styleVars.famRule = 2;
      const got = pick(app.SF.blendFor(k));
      assert.equal(core.coll.length, 0, 'the open guide’s collection put back');
      assert.equal(core.styleVars.famRule, 2, 'and its rule');
      core.coll = c0;
      core.styleVars.famRule = 4;
      assert.deepEqual(got, want, k);
      if (got.light || got.dark) n++;
    }
    assert.ok(n > 600, n + ' markers with a companion');
    // a Colorless Blender, or no such marker: nothing
    assert.equal(app.SF.blendFor('Ohuhu|0'), null);
    assert.equal(app.SF.blendFor('Nope|X1'), null);
  });
  test('Blends with: nothing owned, every companion is one to buy (not the demo’s every marker as yours)', () => {
    const { app } = appWith([]);
    const c = app.SF.blendFor('Ohuhu|R27') || app.SF.blendFor('Copic|R27');
    assert.ok(c && (c.light || c.dark), 'companions found in the catalogue');
    assert.equal(!!c.lightOwned, false);
    assert.equal(!!c.darkOwned, false);
  });
  test('Blends with: a dry marker isn’t one you have; the collection and rule come back after a throw', () => {
    const { app, E, core } = appWith(['Honolulu 120']);
    const c = app.SF.blendFor('Ohuhu|R28');
    assert.ok(c.dark && c.darkOwned, 'R28’s darker is yours: ' + (c.dark && c.dark.code));
    E(`state.ink[${JSON.stringify(c.dark.mkey)}] = 'dry'`);
    const d = app.SF.blendFor('Ohuhu|R28');
    assert.ok(!(d.dark && d.dark.mkey === c.dark.mkey && d.darkOwned), 'the dry one isn’t counted as yours');
    // a throw inside the call: a marker whose colour can't be read
    const k = 'Copic|R27',
      i = E(`keyIdx(${JSON.stringify(k)})`);
    core.coll = ['x'];
    core.styleVars.famRule = 1;
    E(
      `Object.defineProperty(COLORS[${i}], 'fam', { configurable: true, get() { throw new Error('boom'); } })`,
    );
    assert.throws(() => app.SF.blendFor(k), /boom/);
    assert.equal(core.coll.length, 1);
    assert.equal(core.coll[0], 'x');
    assert.equal(core.styleVars.famRule, 1);
  });
  test('skin tones: Ohuhu’s 36 Skin Tones set and Copic’s 36, lightest first', () => {
    const { E } = appWith([]);
    const got = JSON.parse(E('JSON.stringify(skinIdx().map((i) => [mkey(i), LAB[i][0]]))'));
    assert.equal(got.length, 72);
    const oh = E(`OHUHU_SETS['36skin']`)
        .split(' ')
        .map((c) => 'Ohuhu|' + c),
      cp = (
        'YR30 E0000 E000 E50 YR0000 E51 E00 YR000 R00 R30 E21 R11 R12 R20 E02 E53 E93 R02 E11 YR02 R32 E55 E33 E13 ' +
        'E35 E23 E04 E15 E25 E74 E27 E37 E57 E47 E18 E49'
      )
        .split(' ')
        .map((c) => 'Copic|' + c);
    assert.deepEqual(got.map((x) => x[0]).sort(), oh.concat(cp).sort());
    for (let n = 1; n < got.length; n++)
      assert.ok(got[n - 1][1] >= got[n][1], 'lightest first at ' + got[n][0]);
    // none left out by the Colorless Blender rule, and none twice
    assert.equal(new Set(got.map((x) => x[0])).size, 72);
  });
}

// ---- from v31827-v1.test.mjs ----
// v318.27 (builder V1): Ohuhu's 6 Skin Tones set; 24 Portrait with its Colorless Blender and read off Ohuhu's shop name
// ("Honolulu 24 Skin Tone Colors"); Print's rows drawn Pages, Paper, Labels with PRINT_OPTS as it was. The browser
// tests (e2e/v31827-v1) cover the Print sheet on phones, Home's count, its button and ⋯ › Open a PDF.
{
  const app = createApp(),
    E = app.__eval;
  const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const idx = (n) => E(`MARKER_SETS.findIndex((p) => p.n === ${JSON.stringify(n)})`);
  const keysOf = (n) => [...E(`presetMkeys(MARKER_SETS[${idx(n)}])`)];
  const sets = (text) =>
    JSON.parse(
      E('JSON.stringify(scanSets(' + JSON.stringify(text) + ').map((g) => g.map((i) => MARKER_SETS[i].n)))'),
    );
  test('6 Skin Tones: Ohuhu’s six, after 24 Portrait, no blender, a set of 6 everywhere it is counted', () => {
    const i = idx('6 Skin Tones');
    assert.ok(i > 0);
    assert.equal(i, idx('24 Portrait') + 1, 'after 24 Portrait');
    assert.equal(E(`MARKER_SETS[${i}].b`), 'Ohuhu');
    assert.deepEqual(
      keysOf('6 Skin Tones').sort(),
      ['YR00', 'YR05', 'YR06', 'YR312', 'YR55', 'E614'].map((c) => 'Ohuhu|' + c).sort(),
    );
    assert.ok(!keysOf('6 Skin Tones').includes('Ohuhu|0'), 'no Colorless Blender listed');
    assert.equal(E(`presetSize(MARKER_SETS[${i}])`), 6);
    // (Find my set: three of its caps, "Up to 30": it first)
    const r = app.findSets(
      'Ohuhu',
      E("FIND_BUCKETS.findIndex((b) => b.t === 'Up to 30')"),
      ['YR312', 'YR55', 'E614'].map((c) => 'Ohuhu|' + c),
    );
    assert.equal(E(`MARKER_SETS[${r[0].i}].n`), '6 Skin Tones');
    // (the set list: its row with 6)
    E("state.owned = new Set(['Ohuhu|YR00'])");
    assert.match(
      E('presetListHTML()'),
      /<span class="presetnm">6 Skin Tones<\/span><span class="presetn">1\/6<\/span>/,
    );
    // (named wherever the sets are listed)
    const html = read('src/html/dialogs.html');
    for (const t of [read('README.md'), read('docs/TESTERS.md').replace(/\s+/g, ' '), html])
      assert.ok(/24 Portrait and 6 Skin Tones sets/.test(t.replace(/\s+/g, ' ')));
  });
  test('24 Portrait: its Colorless Blender comes with it (Ohuhu’s and Blick’s pages), its size still 24', () => {
    assert.ok(keysOf('24 Portrait').includes('Ohuhu|0'));
    assert.equal(E(`presetSize(MARKER_SETS[${idx('24 Portrait')}])`), 24);
    assert.ok(!keysOf('Honolulu 24').includes('Ohuhu|0'), 'the Honolulu 24 still none');
  });
  test('Scan reads Ohuhu’s three skin sets by size, the shop’s "Honolulu 24 Skin Tone Colors" as 24 Portrait', () => {
    assert.deepEqual(sets('Ohuhu Honolulu 24 Skin Tone Colors Dual Tips Alcohol Markers'), [['24 Portrait']]);
    assert.deepEqual(sets('Ohuhu Alcohol Markers 24 Skin Tone Colors Portrait'), [['24 Portrait']]);
    assert.deepEqual(sets('Ohuhu 6 Skin Tones Alcohol Markers'), [['6 Skin Tones']]);
    assert.deepEqual(sets('Ohuhu Alcohol Markers 36 Skin Tone Colors'), [['36 Skin Tones']]);
    // (a code isn't a size: YR06 here)
    assert.deepEqual(sets('Ohuhu skin tones YR06 E614'), []);
    // (not Honolulu 24 any more; the plain Honolulu 24 still is)
    assert.deepEqual(sets('Ohuhu Honolulu 24 Colors'), [['Honolulu 24']]);
  });
  test('Print: PRINT_OPTS keeps Paper third (printSummary, PAPER_OPTS); the sheet draws Pages, Paper, Labels', () => {
    const src = read('src/js/guide/90-export.js'),
      opts = src.slice(src.indexOf('const PRINT_OPTS = ['), src.indexOf('function printOptVal'));
    assert.deepEqual(
      [...opts.matchAll(/^ {4}'(pwhat|plabels|paper)',$/gm)].map((m) => m[1]),
      ['pwhat', 'plabels', 'paper'],
    );
    assert.match(src, /\[byKey\('pwhat'\), byKey\('paper'\), byKey\('plabels'\)\]\.forEach/);
    // (the close-ups note is in #sfPrWhat, not the foot's summary)
    const sum = src.slice(src.indexOf('function printSummary'), src.indexOf('function printPic'));
    assert.ok(!/printCloseNote/.test(sum));
  });
  // (v320, Ben's count rule: "markers" is every pen owned, the blender too, as Markers and the swatch chart count them;
  // "colours", the ink, stays the guide's card's word: "Built from your 120 colours")
  test('Home’s Markers card counts every marker owned, as Markers does; the button says it starts from a photo', () => {
    const chrome = read('src/js/chrome.js');
    assert.match(chrome, /const n = state\.owned\.size;/);
    assert.match(
      read('src/html/app.html'),
      /<button id="homeNew" class="btn-primary homenew">New guide from a photo<\/button>/,
    );
  });
}

// ---- from v31834-random.test.mjs ----
// v318.34 — Markers › Random outside the browser: counts() counts every drawn marker (d) and the ones out of play
// (out); usedKeys() takes the keys of guides worked with (wk, done, tn or fn), not of built-only guides or palettes;
// guideMeta keeps the worked flag and sets it for ticks and tones.
{
  function appWith() {
    const a = createApp({ localStorage: memoryStorage() });
    a.__eval('state.owned = new Set(); state.pool = null; state.drawn = []; state.mode = "random"');
    return a;
  }
  test('counts(): d is every drawn marker, out the ones a filter leaves out, u and left the ones in play', () => {
    const E = appWith().__eval;
    E(`{ const own = []; for (let i = 0; i < COLORS.length && own.length < 6; i++) if (inPool(i)) own.push(i);
       state.owned = new Set(own.map(mkey)); state.drawn = [own[0], own[1], own[2]]; globalThis.__own = own; }`);
    assert.deepEqual(
      JSON.parse(
        E('JSON.stringify((() => { const c = counts(); return [c.t, c.u, c.left, c.d, c.out]; })())'),
      ),
      [6, 3, 3, 3, 0],
    );
    // the first drawn marker's family filtered out
    E('state.excluded.add(COLORS[__own[0]].fam)');
    const c = E('counts()');
    assert.equal(c.d, 3, 'still 3 drawn');
    assert.equal(c.out, c.d - c.u);
    assert.ok(c.out >= 1, 'at least the one filtered out: ' + c.out);
    assert.equal(c.left, c.t - c.u);
  });
  test('usedKeys(): keys of guides with wk, done, tn or fn; a built-only guide and a palette are not used', () => {
    const E = appWith().__eval;
    E(`state.saved = [
    { id: 1, type: 'guide', name: 'A', keys: ['Ohuhu|R16'], wk: 1 },
    { id: 2, type: 'guide', name: 'B', keys: ['Ohuhu|R28'], done: 1 },
    { id: 3, type: 'guide', name: 'C', keys: ['Ohuhu|R38'], tn: 2 },
    { id: 4, type: 'guide', name: 'D', keys: ['Ohuhu|R46'], fn: 1700000000000 },
    { id: 5, type: 'guide', name: 'E', keys: ['Ohuhu|R210'] },
    { id: 6, type: 'guide', name: 'F', keys: ['Ohuhu|R013'], done: 0, tn: 0 },
    { id: 7, type: 'palette', name: 'G', keys: ['Ohuhu|R05'] },
    { id: 8, type: 'draw', name: 'H', keys: ['Ohuhu|R412'] },
  ]`);
    assert.deepEqual(JSON.parse(E('JSON.stringify([...usedKeys()].sort())')), [
      'Ohuhu|R16',
      'Ohuhu|R28',
      'Ohuhu|R38',
      'Ohuhu|R46',
    ]);
    assert.equal(E('state.saved = []; usedKeys().size'), 0);
  });
  test('guideMeta: the worked flag is kept from the row it replaces, and set by a ticked or toned section', () => {
    const E = appWith().__eval;
    const meta = (d, id) => E(`guideMeta(${JSON.stringify(d)}, ${id}).wk`);
    assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] } }, 1), undefined);
    assert.equal(meta({ name: 'x', n: 3, payload: { prog: [0] } }, 1), 1, 'a tick');
    assert.equal(meta({ name: 'x', n: 3, payload: { tones: { 0: 1 } } }, 1), 1, 'a tone');
    assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] }, wk: 1 }, 1), 1, 'given');
    // kept: the row has it, the save that follows has nothing ticked any more
    E("state.saved = [{ id: 9, type: 'guide', name: 'x', keys: [], wk: 1 }]");
    assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] } }, 9), 1, 'kept');
    assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] } }, 10), undefined, 'another guide');
  });
  test('state: rndFresh is saved and read back, off by default', () => {
    const a = appWith();
    assert.equal(a.__eval('state.rndFresh'), 0);
    a.__eval('state.rndFresh = 1; save()');
    const raw = a.__eval('localStorage.getItem(KEY)');
    assert.equal(JSON.parse(raw).rndFresh, 1);
    const b = createApp({ localStorage: memoryStorage({ [a.__eval('KEY')]: raw }) });
    assert.equal(b.__eval('state.rndFresh'), 1);
  });
}
