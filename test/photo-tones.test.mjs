// v327 photo tones (45-shading ptChoose; docs/PLAN-v327-photo-tones.md, B): from a section's samples (the photo's
// colour and the light's value), each marker's highlight and shadow matched to the photo's own light and dark parts;
// a section flat where its tones wouldn't bring it nearer; at most 4 markers added, each only when it helps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// a page of a few sections, its markers the app's own catalogue entries; S: samples [L, a, b, v] per section
function scene(codes, owned) {
  const app = createApp(),
    core = app.__mstest;
  const C = JSON.parse(
    app.__eval(
      'JSON.stringify(COLORS.map((c, i) => ({ mkey: mkey(i), code: c.code, brand: c.brand, hex: c.hex, name: c.name, lab: hexToLab(c.hex) })))',
    ),
  );
  const by = new Map(C.map((m) => [m.mkey, m]));
  const page = codes.map((k) => by.get(k));
  core.coll = (owned || codes).map((k) => by.get(k)).filter(Boolean);
  core.styleVars.shadeShadow = 'photo';
  core.styleVars.shadeHilite = 'photo';
  core.styleVars.shadeMode = 'full';
  // (the hand-overs: light below 0.34, shadow from 0.474)
  core.styleVars.shadeHi = 0.5;
  core.styleVars.shadeLo = 0.85;
  return { app, core, page, by };
}
// n samples of colour lab at light value v
const part = (lab, v, n) => Array.from({ length: n }, () => [lab[0], lab[1], lab[2], v]).flat();

test('the shadow matched to the photo’s dark part, laid over the base; a section with nothing light or dark stays flat', () => {
  const { core, page } = scene(['Ohuhu|E415', 'Ohuhu|E914']);
  const [base, bark] = page,
    bl = base.lab;
  core.assignData = { assign: { 1: base, 2: base, 3: bark }, order: [1, 2, 3], N: 3 };
  // section 1: its middle the base, its shadow side much darker; section 2: even all over (section 3 not sampled)
  const S = {
    1: Float32Array.from([...part(bl, 0.41, 40), ...part([bl[0] - 16, bl[1], bl[2] - 2], 0.95, 40)]),
    2: Float32Array.from(part(bl, 0.41, 60)),
  };
  const r = core.ptChoose(S, null, []);
  assert.ok(r.tone[1], 'section 1 shaded');
  assert.ok(r.tone[1].dark && r.tone[1].glaze, 'a shadow, laid over the base');
  assert.equal(r.tone[1].dark.mkey, 'Ohuhu|E914', 'the page’s darker brown');
  assert.equal(r.tone[1].light, null, 'no light part, no highlight');
  assert.equal(r.tone[2], null, 'section 2 flat');
  assert.equal(r.nFlat, 1);
});

test('a highlight only from the base’s own family or a close hue, lighter by 4 or more', () => {
  const { core, by } = scene(['Ohuhu|B09', 'Ohuhu|B05', 'Ohuhu|Y06']);
  const b = by.get('Ohuhu|B09');
  // (a lighter blue of its family: yes; a yellow, though lighter: no; itself: no)
  assert.equal(core.ptLightOK(b, by.get('Ohuhu|B05')), true);
  assert.equal(core.ptLightOK(b, by.get('Ohuhu|Y06')), false);
  assert.equal(core.ptLightOK(b, b), false);
});

test('markers added: at most 4, never one of the page’s, each only when it brings the page nearer', () => {
  const owned = [
    'Ohuhu|E415',
    'Ohuhu|E914',
    'Ohuhu|E413',
    'Ohuhu|R112',
    'Ohuhu|R015',
    'Ohuhu|R213',
    'Ohuhu|R16',
    'Ohuhu|B09',
    'Ohuhu|B05',
    'Ohuhu|G49',
    'Ohuhu|BV05',
    'Ohuhu|E97',
  ];
  const { core, by } = scene(['Ohuhu|E415', 'Ohuhu|R112'], owned);
  const e = by.get('Ohuhu|E415'),
    rr = by.get('Ohuhu|R112');
  core.assignData = { assign: { 1: e, 2: rr }, order: [1, 2], N: 2 };
  const S = {
    1: Float32Array.from([
      ...part(e.lab, 0.41, 30),
      ...part([e.lab[0] - 20, e.lab[1] + 6, e.lab[2] + 4], 0.95, 30),
    ]),
    2: Float32Array.from([
      ...part(rr.lab, 0.41, 30),
      ...part([rr.lab[0] - 25, rr.lab[1] + 4, rr.lab[2] - 6], 0.95, 30),
    ]),
  };
  const r = core.ptChoose(S, null, null);
  // (the page has nothing darker than either base: what shades them is added)
  assert.ok(r.extras.length >= 1 && r.extras.length <= 4, 'some added, at most 4');
  assert.ok(r.tone[1].dark && r.tone[2].dark, 'both shaded');
  r.extras.forEach((k) => assert.ok(k !== e.mkey && k !== rr.mkey, 'not one of the page’s'));
  // with the ones it added kept, the same choice
  const r2 = core.ptChoose(S, null, r.extras);
  assert.equal(Math.round(r2.err), Math.round(r.err));
  // and none added is never nearer than what it chose
  assert.ok(core.ptChoose(S, null, []).err >= r.err - 1e-6);
});

test('v327.1: one marker is never both a section’s highlight and its shadow', () => {
  const { core, by } = scene(['Ohuhu|E415', 'Ohuhu|E97']);
  const base = by.get('Ohuhu|E415'),
    rose = by.get('Ohuhu|E97');
  core.assignData = { assign: { 1: base, 2: rose }, order: [1, 2], N: 2 };
  // section 1: its light part E97's own colour, its dark part E97 laid over the base (as the glaze model draws it),
  // so E97 is the best highlight and the best shadow both
  const S = {
    1: Float32Array.from([
      ...part(rose.lab, 0.1, 30),
      ...part(base.lab, 0.41, 30),
      ...part([33.4, 15, 17.9], 0.95, 30),
    ]),
  };
  const r = core.ptChoose(S, null, []);
  assert.ok(r.tone[1] && r.tone[1].light, 'a highlight');
  assert.equal(r.tone[1].light.mkey, 'Ohuhu|E97');
  assert.ok(!r.tone[1].dark || r.tone[1].dark.mkey !== 'Ohuhu|E97', 'its shadow another marker, or none');
});
