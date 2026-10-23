// (v319) Palette fixes from Fable's Y3 review: Greys + accent from a grey seed keeps a locked accent, at the accent's
// slot (Y3-1); in a guide, Include › Greys & black off makes Greys + accent unavailable with that reason, the
// exclusions counting the generator's own greys (Y3-2); the fallback to Analogous + accent is per call: genHarmony
// stays 'neutral', the note returns each time, and Greys + accent comes back once the greys do (Y3-3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function withSeed(seed, fn) {
  const orig = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}
function appWith(set) {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval(
    'state.owned = new Set(); state.pool = null; state.ink = {}; state.seed = null; state.locked = []',
  );
  a.__eval(
    `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(set)})).forEach((k) => state.owned.add(k))`,
  );
  return a;
}
const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
const H320 = 'Honolulu 320 (complete set)';

test('v319 Y3-1: Greys + accent from a grey seed with the accent locked: the lock is kept, at the accent’s slot', () => {
  const a = appWith(H320),
    E = a.__eval,
    GREY_C = J(a, 'GREY_C');
  withSeed(5, () => {
    for (let t = 0; t < 20; t++) {
      // a black seed (Ohuhu 120: its step is the ramp's darkest, where paletteOpts had put the locked accent)
      E(
        `state.harmony = 'neutral'; state.palSize = 5; state.seed = mkey(0); state.palettes = []; state.palH = []; state.locked = []`,
      );
      const r = J(
        a,
        `(() => { const p = genPalette(5, 'neutral', paletteOpts()); state.palettes.push(p); state.palH.push('neutral');
           const acc = p[0]; state.locked = [acc];
           const o = paletteOpts(), p2 = genPalette(5, 'neutral', o);
           return { acc, opts: o.locked, p2, C: p2.map((i) => LCH[i][1]) }; })()`,
      );
      assert.equal(r.opts[4], r.acc, 'paletteOpts puts the locked accent in the last free slot');
      assert.ok(r.p2.includes(r.acc), 'the locked accent is kept: ' + JSON.stringify(r));
      assert.equal(r.p2[0], r.acc, 'at the accent’s slot');
      assert.ok(r.p2.includes(0), 'the seed is in the palette');
      assert.equal(r.C.filter((c) => c >= GREY_C).length, 1, 'one clear colour: ' + r.C.map(Math.round));
      assert.equal(new Set(r.p2).size, 5);
    }
  });
});

test('v319 Y3-1: a grey locked at the seed’s own step moves to the nearest free step; two locks, both kept', () => {
  const a = appWith(H320),
    E = a.__eval;
  withSeed(8, () => {
    for (let t = 0; t < 12; t++) {
      E(
        `state.harmony = 'neutral'; state.palSize = 6; state.seed = mkey(0); state.palettes = []; state.palH = []; state.locked = []`,
      );
      const r = J(
        a,
        `(() => { const p = genPalette(6, 'neutral', paletteOpts()); state.palettes.push(p); state.palH.push('neutral');
           const acc = p[0], g = p[5] === 0 ? p[4] : p[5]; state.locked = [acc, g];
           const o = paletteOpts(), p2 = genPalette(6, 'neutral', o);
           return { acc, g, p2 }; })()`,
      );
      assert.ok(
        r.p2.includes(r.acc) && r.p2.includes(r.g) && r.p2.includes(0),
        'all kept: ' + JSON.stringify(r),
      );
      assert.equal(r.p2[0], r.acc);
      assert.equal(new Set(r.p2).size, 6);
    }
  });
});

// the guide, with the shell's two callbacks it uses here (the harness doesn't run the shell's boot)
function guideWith(set) {
  const a = appWith(set),
    E = a.__eval,
    core = a.__mstest;
  E(
    `SF.configure({ neutralWhy: (ex) => (genGreys(ex || null) < NEUTRAL_GREYS ? 'Needs ' + NEUTRAL_GREYS + ' greys among your markers' : null), genPalette: (n, h, o) => (genPalette(n, h, o) || []).map(mkey) })`,
  );
  core.coll = E('sfCollection()');
  core.paletteSource = 'generate';
  return { a, E, core, sv: core.styleVars };
}
const greysIn = (a, keys) => keys.filter((k) => J(a, `LCH[keyIdx(${JSON.stringify(k)})][1] < GREY_C`)).length;

test('v319 Y3-2: Include › Greys & black off: Greys + accent is unavailable with that reason, and every near-grey is kept out', () => {
  const { a, core, sv } = guideWith(H320);
  sv.gradIncl = {};
  assert.equal(core.grad.inclOn(sv.gradIncl, sv.emphasis).greys, false, 'off by default');
  assert.equal(core.genNeutralWhy(), 'Needs Include › Greys & black on');
  // (v319, Ben's choice) the option itself is greyed only for a real shortage: the chip alone doesn't grey it
  assert.equal(core.genNeutralChipOff(), true);
  assert.equal(core.genNeutralShort(), null, 'with the greys on it could be made');
  // the exclusions hold the generator's greys (chroma under GREY_C), whatever their family: so the two agree
  const ex = core.inclExclude();
  const nearGreys = J(a, 'COLORS.map((c, i) => i).filter((i) => inPool(i) && LCH[i][1] < GREY_C)');
  for (const i of nearGreys) assert.ok(ex.has(i), 'near-grey ' + i + ' kept out');
  assert.equal(a.__eval(`neutralWhy()`), null, 'the generator alone would make it (greys among the markers)');
  // greys on: available; browns off changes nothing for it
  sv.gradIncl = { greys: true, browns: false };
  assert.equal(core.genNeutralWhy(), null);
  assert.equal(core.genNeutralChipOff(), false);
  // every group on: no near-grey kept out (an Earth-family one goes with the browns)
  sv.gradIncl = { greys: true, browns: true, fluor: true };
  assert.equal(core.inclExclude(), null);
  // a guide from before the Include row (gradIncl null): the generator's own test only
  sv.gradIncl = null;
  assert.equal(core.genNeutralWhy(), null);
  // too few greys with the chip on: the generator's reason, as before
  const c = guideWith('Ciao 36 - Set A');
  c.sv.gradIncl = { greys: true };
  assert.equal(c.core.genNeutralWhy(), 'Needs 3 greys among your markers');
});

test('v319 Y3-3: the fallback is per call: genHarmony stays Greys + accent, the note returns each time, and the scheme comes back with the greys', () => {
  const { a, core, sv } = guideWith(H320);
  sv.gradIncl = {};
  core.genHarmony = 'neutral';
  withSeed(2, () => {
    core.generatePalette();
    assert.equal(core.genHarmony, 'neutral', 'the chosen scheme is kept');
    assert.equal(core.genFell, true);
    assert.equal(core.genHarmUsed(), 'accent', 'made as Analogous + accent');
    assert.equal(core.genNote, 'Greys + accent needs Include › Greys & black on: Analogous + accent instead');
    let pal = [...sv.genPal];
    assert.ok(pal.length >= 3 && greysIn(a, pal) === 0, 'no grey: ' + pal);
    // a second regeneration: the note again (it had been lost with genHarmony set to 'accent' for good)
    core.generatePalette(true);
    assert.equal(core.genHarmony, 'neutral');
    assert.match(core.genNote, /Analogous \+ accent instead$/);
    // the greys back on: nothing made yet says what the palette is; the next call makes Greys + accent, no note
    sv.gradIncl = { greys: true };
    assert.equal(core.genHarmUsed(), 'accent', 'the palette on the card is still the fallback’s');
    core.generatePalette();
    assert.equal(core.genHarmony, 'neutral');
    assert.equal(core.genFell, false);
    assert.equal(core.genHarmUsed(), 'neutral');
    assert.equal(core.genNote, '');
    pal = [...sv.genPal];
    assert.equal(greysIn(a, pal), pal.length - 1, 'a clear accent and greys: ' + pal);
    // another scheme is never touched by any of it
    core.genHarmony = 'analogous';
    core.generatePalette();
    assert.equal(core.genNote, '');
    assert.equal(core.genHarmUsed(), 'analogous');
  });
});
