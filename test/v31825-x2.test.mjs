// v318.25 (deep debugging pass, step 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

// ---- X2: Palette (reviewer C's C1–C8) ----

function palApp(owned) {
  const a = createApp({ localStorage: memoryStorage() }),
    E = a.__eval;
  E('state.owned = new Set(); state.pool = null; state.ink = {}');
  if (Array.isArray(owned)) E(`state.owned = new Set(${JSON.stringify(owned)})`);
  else if (owned)
    E(
      `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(owned)})).forEach((k) => state.owned.add(k))`,
    );
  // no screen to draw on; the toasts kept, and the line under the Colours row readable
  E(`showPalette = function () {}; chrome = function () {}; fullRender = function () {}; clearPalette = function () {};
     renderRecent = function () {}; flashSaved = function () {}; window.__toasts = [];
     toast = function (m) { window.__toasts.push(m); };
     var __pc = { textContent: '', style: {} }, __d = document;
     document = new Proxy({}, { get(t, p) {
       if (p === 'getElementById') return (id) => (id === 'palClose' ? __pc : __d.getElementById(id));
       return __d[p];
     } })`);
  return a;
}
const J = (a, s) => JSON.parse(a.__eval(`JSON.stringify(${s})`));
const palState = (E, h, n) =>
  E(`state.mode = 'palette'; state.harmony = '${h}'; state.palSize = ${n}; state.palettes = []; state.palH = [];
     state.locked = []; state.seed = null; state.excluded = new Set(); setPool(null)`);
const FIVE = ['Copic|R27', 'Copic|G07', 'Copic|B29', 'Copic|Y08', 'Copic|V09'];

test('X2 C4: Save and Use in a guide keep the palette’s own scheme when the one chosen since can’t be made', () => {
  const a = palApp(FIVE),
    E = a.__eval;
  palState(E, 'complementary', 4);
  E(`palPush(genPalette(4, 'complementary', paletteOpts()), 24)`);
  // five clear markers can't make a Rainbow (6): the Complementary palette stays on the card
  E(`setHarmony('rainbow')`);
  assert.equal(E('state.harmony'), 'rainbow');
  assert.deepEqual(J(a, 'state.palH'), ['complementary']);
  E('doSave()');
  assert.equal(E('state.saved[0].h'), 'complementary', 'saved as the Complementary it is, not as "Rainbow"');
  assert.equal(E('currentPaletteHarm()'), 'complementary');
  // the first visit's preview (nothing made yet) and Custom are the scheme chosen
  palState(E, 'triadic', 3);
  assert.equal(E('currentPaletteHarm()'), 'triadic');
  E(`palPush(genPalette(3, 'triadic', paletteOpts()), 24); state.harmony = 'custom'`);
  assert.equal(E('currentPaletteHarm()'), 'custom');
});

test('X2 C5: Rainbow’s “N clear colours” isn’t said of another scheme’s palette left on the card', () => {
  const a = palApp(FIVE),
    E = a.__eval;
  palState(E, 'complementary', 4);
  E(`palPush(genPalette(4, 'complementary', paletteOpts()), 24); setHarmony('rainbow'); closeNote()`);
  assert.doesNotMatch(E('__pc.textContent'), /clear colours for a rainbow/);
  // a Rainbow itself stopped at the clear markers in play still says it
  const b = palApp('Honolulu 24'),
    F = b.__eval;
  palState(F, 'rainbow', 16);
  F(`palPush(genPalette(16, 'rainbow', paletteOpts()), 24); closeNote()`);
  const n = +F('state.palettes[0].length');
  if (n < 16)
    assert.match(F('__pc.textContent'), new RegExp('have ' + n + ' clear colours for a rainbow, not 16'));
});

test('X2 C6: “try fewer colours” isn’t said at the scheme’s smallest size', () => {
  const a = palApp(['Copic|R27', 'Copic|G07', 'Copic|B29']),
    E = a.__eval;
  palState(E, 'tetradic', 4);
  E('doGenerate()');
  assert.equal(
    E('window.__toasts[window.__toasts.length - 1]'),
    'Couldn’t make a 4-colour palette from the markers in play — add markers with more colours.',
  );
  // above the smallest it's still offered
  palState(E, 'complementary', 4);
  E('palFailToast()');
  assert.match(E('window.__toasts[window.__toasts.length - 1]'), /— try fewer colours, or add markers/);
});

test('X2 C7: a lock with no room at the new size is said, not dropped silently', () => {
  const a = palApp('Honolulu 120'),
    E = a.__eval;
  palState(E, 'complementary', 8);
  E(
    `palPush(genPalette(8, 'complementary', paletteOpts()), 24); state.locked = state.palettes[0].slice(0, 5)`,
  );
  const five = J(a, 'state.locked.map(capCode)');
  E('window.__toasts = []; setSize(4)');
  assert.equal(E('state.locked.length'), 4);
  const off = five.filter((c) => !J(a, 'state.locked.map(capCode)').includes(c));
  assert.deepEqual(J(a, 'window.__toasts'), ['Unlocked ' + off[0] + ': no room for it at 4 colours.']);
});

test('X2 C2: after From photo, Undo in Photo goes back to the palettes made before it', () => {
  const a = palApp('Honolulu 120'),
    E = a.__eval;
  palState(E, 'complementary', 4);
  E(
    `palPush(genPalette(4, 'complementary', paletteOpts()), 24); palPush(genPalette(4, 'complementary', paletteOpts()), 24)`,
  );
  const B = J(a, 'state.palettes[1]');
  // From photo (its palette, then a band swap: two photo steps), then Complementary again
  E(`_photoImg = { width: 10, height: 10 }; state.harmony = 'photo'; state.palSize = 4;
     palPush(genPalette(4, 'complementary', {}), 20); palPush(genPalette(4, 'complementary', {}), 20)`);
  assert.equal(E('photoUndoable()'), true);
  E(`setHarmony('complementary')`);
  E('undo()');
  assert.equal(E('state.harmony'), 'photo', 'v308: Undo into a photo’s palette goes back to From photo');
  E('undo()');
  assert.equal(E('state.harmony'), 'photo', 'the band swap taken back (v299), in Photo');
  E('undo()');
  assert.equal(E('state.harmony'), 'complementary', 'and from Photo, back to the palette before it');
  assert.deepEqual(J(a, 'state.palettes[state.palettes.length - 1]'), B);
  // only photo palettes: nothing to go back to, Undo does nothing in Photo
  palState(E, 'photo', 4);
  E(`palPush(genPalette(4, 'complementary', {}), 20); undo()`);
  assert.equal(E('photoUndoable()'), false);
  assert.equal(E('state.palettes.length'), 1);
});

test('X2 C1: Monochrome from a black is a ramp of greys, of one family', () => {
  const a = palApp('Honolulu 320 (complete set)'),
    E = a.__eval;
  palState(E, 'mono', 5);
  E(`state.seed = 'Ohuhu|120'; palSizeFit()`);
  for (let t = 0; t < 6; t++) {
    const p = J(
      a,
      `genPalette(5, 'mono', paletteOpts()).map((i) => ({ k: mkey(i), c: LCH[i][1], f: COLORS[i].fam }))`,
    );
    assert.equal(p[0].k, 'Ohuhu|120', 'the black kept');
    assert.ok(
      p.every((x) => x.c < 12),
      'all near-greys: ' + p.map((x) => x.k).join(' '),
    );
    assert.equal(
      new Set(p.slice(1).map((x) => x.f)).size,
      1,
      'one grey family: ' + p.map((x) => x.f).join(', '),
    );
  }
  // a colour's Monochrome is as before: its own family
  E(`state.seed = mkey(COLORS.findIndex((c, i) => c.fam === 'Red' && inPool(i) && LCH[i][1] > 40))`);
  const r = J(a, `genPalette(5, 'mono', paletteOpts()).map((i) => COLORS[i].fam)`);
  assert.ok(r.filter((f) => f === 'Red').length >= 3, r.join(', '));
});
