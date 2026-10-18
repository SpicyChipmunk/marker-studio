// v318.16: the Shading row's styles are the whole picture's look: each sets the mode, Main's and every zone's
// Roundness, Highlights and Shadows amounts, and Light from only between the sun and the edges (a photo's light is
// kept, Neuro is the edges); a style is chosen while Main and every shaded zone match it, else Custom (none chosen).
// Fails on v318.15 (its presets set only the chosen zone's, and the photo's light went).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

function withZones() {
  const t = createApp().__mstest;
  t.W = 10;
  t.H = 10;
  t.zoneOpen(
    [
      { name: 'Bell', secs: [1] },
      { name: 'Foot', secs: [2] },
    ],
    { 1: 11, 2: 12 },
  );
  return t;
}
const amounts = (t, id) => {
  const z = t.zsh(id);
  return [z.round, z.hi, z.lo];
};

test('a style sets Main and every zone, and is chosen while they all match', () => {
  const t = withZones(),
    ids = Array.from(t.zones, (z) => z.id);
  assert.equal(ids.length, 2);
  // a zone with amounts of its own first
  t.zshSet(ids[0], 'round', 0.2);
  assert.equal(t.shPresetApply('dramatic'), true);
  assert.equal(t.shadeMode, 'full');
  for (const id of [0, ...ids]) assert.deepEqual(amounts(t, id), [0.6, 0.6, 0.65], 'zone ' + id);
  assert.equal(t.shStyleCur().k, 'dramatic');
  // one zone's Roundness moved: Custom
  t.zshSet(ids[1], 'round', 0.3);
  assert.equal(t.shStyleCur(), null);
  // Shadows only is never a style
  t.shPresetApply('soft');
  assert.equal(t.shStyleCur().k, 'soft');
  t.shadeMode = 'shadow';
  assert.equal(t.shStyleCur(), null);
  assert.equal(t.shPresetApply('nope'), false);
});

test('Light from: the sun and the edges follow the style; a photo’s light is kept (Neuro is the edges)', () => {
  const t = createApp().__mstest;
  t.styleVars.shadeLight = 'edges';
  t.shPresetApply('soft');
  assert.equal(t.styleVars.shadeLight, 'sun', 'from the edges to the sun');
  t.shPresetApply('neuro');
  assert.equal(t.styleVars.shadeLight, 'edges');
  t.styleVars.shadeLight = 'photo';
  t.shPresetApply('rounded');
  assert.equal(t.styleVars.shadeLight, 'photo', 'the photo’s light kept');
  t.styleVars.shadeLight = 'auto';
  t.shPresetApply('soft');
  assert.equal(t.styleVars.shadeLight, 'auto', 'as it was');
});

test('Shadows only (Highlights › None) is saved as it always was: mode shadow', () => {
  const t = createApp().__mstest,
    f = [...t.styleFields].find((x) => x.key === 'mode' && x.in === 'shade');
  assert.equal(f.check('shadow', f.def), 'shadow');
});
