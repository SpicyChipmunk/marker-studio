// v318.26 (builder W2): Blends with in a marker's details (SF.blendFor, 88-coverage-blend.js) and the skin tones
// (skinIdx, events.js). The browser tests (e2e/v31826-w2) cover the sheet, Tester questions, Change colour's row and
// Markers' search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

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
  E(`Object.defineProperty(COLORS[${i}], 'fam', { configurable: true, get() { throw new Error('boom'); } })`);
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
