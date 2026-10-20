// v318.28 (fixer Y1, Markers and Scan): "skin" counts the skin tones outside the view; "copic 0" finds the 0s only; a
// long two-brand list is told mixed from its end too; a Honolulu set beside a themed one on the same line; a size after
// " - "; a set's name without its brand's word, with that brand chosen or in Find mode. The browser parts (Home's count,
// the skin search's lines, Tick all shown, the set card, a photo failing after Scan closed, the batch's words) are in
// e2e/v31828-y1. Each fails on v318.27.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

const app = createApp(),
  E = app.__eval;
E('globalThis.Event = globalThis.Event || function (t) { this.type = t; };');
const idx = (n) => E(`MARKER_SETS.findIndex((p) => p.n === ${JSON.stringify(n)})`);
const sets = (text, brand, hint) =>
  JSON.parse(
    E(
      `JSON.stringify(scanSets(${JSON.stringify(text)}, ${JSON.stringify(brand || '')}, ${JSON.stringify(hint || '')}).map((g) => g.map((i) => MARKER_SETS[i].n)))`,
    ),
  );

test('Markers’ "skin" in Owned or Unowned counts the skin tones on the other side, not names with the word', () => {
  // (Honolulu 120: 12 of the 72 skin tones yours; the other 60 are in All)
  E(`state.mode = 'collection'; state.collView = 'owned'; state.excluded = new Set();
     state.owned = new Set(presetMkeys(MARKER_SETS[${idx('Honolulu 120')}])); searchStr = 'skin'`);
  const sk = E('skinIdx().length'),
    mine = E('searchSkin().list.length');
  assert.equal(sk, 72);
  assert.equal(mine, 12);
  assert.equal(E('searchOutside().length'), sk - mine);
  // (none of them yours: all 72 are elsewhere)
  E(`state.owned = new Set(['Ohuhu|B08', 'Ohuhu|B111']); searchStr = 'skin tones'`);
  assert.equal(E('searchSkin()'), null);
  assert.equal(E('searchOutside().length'), 72);
  // (Unowned, the same: the skin tones yours)
  E(`state.collView = 'unowned'; state.owned = new Set(presetMkeys(MARKER_SETS[${idx('Honolulu 120')}]))`);
  assert.equal(E('searchOutside().length'), 12);
  // (another search as before: by name)
  E(`state.collView = 'owned'; searchStr = 'rose red'`);
  assert.deepEqual(
    JSON.parse(E('JSON.stringify(searchOutside().map((i) => COLORS[i].code))')),
    JSON.parse(
      E(
        `JSON.stringify(COLORS.map((c, i) => i).filter((i) => avail(i) && !isOwned(i)).map((i) => COLORS[i].code))`,
      ),
    ),
  );
  E(`searchStr = ''; state.collView = 'all'`);
});

test('"copic 0" finds the 0s (C-0, N-0…), not No.10 and No.00 by their names; a number alone as before', () => {
  const find = (q) =>
    JSON.parse(
      E(
        `JSON.stringify(COLORS.map((c, i) => i).filter((i) => sMatch(i, ${JSON.stringify(q)})).map((i) => COLORS[i].code))`,
      ),
    );
  assert.deepEqual(find('copic 0').sort(), ['0', 'C-0', 'N-0', 'T-0', 'W-0']);
  assert.deepEqual(find('cool gray 1'), ['C-1']);
  assert.ok(find('cool gray 10').includes('C-10'));
  assert.deepEqual(find('cool gray 00'), ['C-00']);
  assert.ok(find('gray no 3').includes('C-3'));
  // (alone, a number still looks after a code's letters: "10" finds C-10)
  assert.ok(find('10').includes('C-10'));
});

test('Scan: a list of both brands past 20,000 characters, one brand after the other, is read as both', () => {
  const r = JSON.parse(
    E(`(function () {
      state.owned = new Set(); scanSw.on = false; scanSw.added = [];
      scanList = []; scanBrand = 'Ohuhu'; scanBrandChosen = true;
      scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear();
      const line = (c) => c.code + ' ' + c.name + ' - alcohol marker, in stock, add to cart';
      const O = COLORS.filter((c) => c.brand === 'Ohuhu'), C = COLORS.filter((c) => c.brand === 'Copic');
      const t = O.concat(C).map(line).join('\\n');
      const lb = scanListBrand(t);
      scanHandle(t, true);
      const mk = scanList.filter((e) => !e.ask), by = (b) => mk.filter((e) => COLORS[e.i].brand === b).length;
      const out = { len: t.length, mixed: !!(lb && lb.mixed), ohuhu: by('Ohuhu'), copic: by('Copic'),
        asks: scanList.filter((e) => e.ask).length };
      // (one brand's long list still that brand's)
      out.copicOnly = scanListBrand(C.map(line).join('\\n')).brand;
      scanList = []; scanBrand = ''; scanBrandChosen = false;
      return JSON.stringify(out);
    })()`),
  );
  assert.ok(r.len > 40000);
  assert.equal(r.mixed, true);
  assert.equal(r.copic, 357);
  assert.equal(r.ohuhu, 363);
  assert.equal(r.asks, 1, 'only the 0 both brands have');
  assert.equal(r.copicOnly, 'Copic');
});

test('Scan: a Honolulu set beside a themed set on one line; a size after " - "; skin sizes unsure asked once', () => {
  assert.deepEqual(sets('Ohuhu Honolulu 72 Colors + 6 Skin Tones'), [['6 Skin Tones'], ['Honolulu 72']]);
  assert.deepEqual(sets('Ohuhu Honolulu 72 Colors + 36 Skin Tones'), [['36 Skin Tones'], ['Honolulu 72']]);
  assert.deepEqual(sets('Ohuhu Honolulu 120 Colors + 24 Portrait'), [['24 Portrait'], ['Honolulu 120']]);
  // (the themed set's own size isn't Honolulu's too)
  assert.deepEqual(sets('Ohuhu Honolulu Mid-tone 48 Colors'), [['48 Mid-tone Set']]);
  assert.deepEqual(sets('Ohuhu Honolulu 24 Skin Tone Colors Dual Tips'), [['24 Portrait']]);
  // (two sizes near "skin", neither said as colours: one question, not both sets)
  assert.deepEqual(sets('Ohuhu Honolulu 24 Skin Tone Colors (Pack of 6)'), [['24 Portrait', '6 Skin Tones']]);
  // (" - 120 Colors")
  assert.deepEqual(sets('Ohuhu Honolulu Alcohol Markers - 120 Colors'), [['Honolulu 120']]);
  assert.deepEqual(sets('Copic Ciao Set - 36 Colors Set A'), [['Ciao 36 - Set A']]);
  assert.deepEqual(sets('Ohuhu Alcohol Markers Skin Tone - 24 Colors Dual Tip'), [['24 Portrait']]);
  // (still not part of an order number)
  assert.deepEqual(sets('Order #-24 Honolulu'), []);
  assert.deepEqual(sets('Order 123-24 Honolulu'), []);
});

test('Scan: a set’s name without its brand’s word, with that brand chosen or in Find mode', () => {
  assert.deepEqual(sets('6 Skin Tones', '', 'Ohuhu'), [['6 Skin Tones']]);
  assert.deepEqual(sets('36 Skin Tones', 'Ohuhu'), [['36 Skin Tones']]);
  assert.deepEqual(sets('48 Mid-tone Set', 'Ohuhu'), [['48 Mid-tone Set']]);
  assert.deepEqual(sets('Sketch 72 Set A', 'Copic'), [['Sketch 72 - Set A']]);
  // (no brand chosen: as before, nothing; the other brand named: not the chosen brand's)
  assert.deepEqual(sets('6 Skin Tones'), []);
  assert.deepEqual(sets('Copic Sketch 36 Gray', '', 'Ohuhu'), [['Sketch 36']]);
});
