// v305 (Markers): Fill gaps › Ramp gaps leaves out the Fluorescent and Neutral / Black families and counts only
// markers of about the same hue as a gap's ends; a search that is the start of a code ("E", "BG", "E0", "r2") shows
// "Codes starting …" straight after Best match, with markers whose old code starts so under "Old code" (v306: under
// "Old codes starting …"; "Old code" is for an old code the search names whole).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

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
    const near = g.own.filter((o) => (grey ? o[1] < GREY_C : o[1] >= GREY_C && hueGap(o[2], g.lch[2]) <= 30));
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
