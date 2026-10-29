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

// (v329.1) the tones follow the page: a marker on the page that isn't yours (one left on a coloured section since
// marked dry, or Try it with these's) is never another section's tone, unless the page was made to try others (Use
// the full range, or that marker added with Try it with these); a coloured section keeps the tone it was coloured with
test('v329.1: tones only from your markers, unless the page was made with others; a coloured section keeps its own', () => {
  const { core, page } = scene(['Ohuhu|E415', 'Ohuhu|E914'], ['Ohuhu|E415']);
  const [base, bark] = page,
    bl = base.lab;
  core.assignData = { assign: { 1: base, 2: base, 3: bark }, order: [1, 2, 3], N: 3 };
  const S = {
    1: Float32Array.from([...part(bl, 0.41, 40), ...part([bl[0] - 16, bl[1], bl[2] - 2], 0.95, 40)]),
  };
  const dark = (r) => (r.tone[1] && r.tone[1].dark ? r.tone[1].dark.mkey : null);
  // E914 on the page, not yours: never section 1's shadow
  core.pp = null;
  assert.notEqual(dark(core.ptChoose(S, null, [])), 'Ohuhu|E914', 'not a tone: not yours');
  // a page made with the full range: its own markers may be tones
  core.pp = { full: true };
  assert.equal(dark(core.ptChoose(S, null, [])), 'Ohuhu|E914', 'Use the full range: the page’s own');
  // Try it with these: that marker, added, may be
  core.pp = { add: ['Ohuhu|E914'] };
  assert.equal(dark(core.ptChoose(S, null, [])), 'Ohuhu|E914', 'Try it with these: the one added');
  // a coloured section keeps the tone it was coloured with, though that marker isn't yours now
  core.pp = null;
  core.colored = new Uint8Array(4);
  core.colored[1] = 1;
  core.ptHeld[1] = { L: '', S: 'Ohuhu|E914' };
  assert.equal(dark(core.ptChoose(S, null, [])), 'Ohuhu|E914', 'what’s on the paper stays');
  delete core.ptHeld[1];
  core.colored = new Uint8Array(4);
});

// (v329.1) the choice's speed: each sample's difference from a colour kept with the samples (ptDist), so the same
// result from cold (fresh samples) and warm, and a Very detailed page's choice well under its old seconds
test('v329.1: the photo-tone choice, kept differences: the same from fresh samples as warm, and quick on a big page', () => {
  const { app, core } = scene([]);
  const C = JSON.parse(
    app.__eval(
      'JSON.stringify(COLORS.map((c, i) => ({ mkey: mkey(i), code: c.code, brand: c.brand, hex: c.hex, name: c.name, lab: hexToLab(c.hex) })))',
    ),
  ).filter((m) => m.brand === 'Ohuhu');
  const page = C.slice(0, 24);
  core.coll = C.slice(0, 120);
  const assign = {},
    order = [],
    mk = () => {
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647,
        S = {};
      for (let l = 1; l <= 600; l++) {
        const b = page[l % 24],
          a = new Float32Array(80 * 4);
        for (let i = 0; i < 80; i++) {
          const v = i / 80;
          a[i * 4] = b.lab[0] + (v < 0.34 ? 14 : v >= 0.474 ? -18 : 0) + rnd() * 3;
          a[i * 4 + 1] = b.lab[1] + rnd() * 6;
          a[i * 4 + 2] = b.lab[2] + rnd() * 6;
          a[i * 4 + 3] = v;
        }
        S[l] = a;
      }
      return S;
    };
  for (let l = 1; l <= 600; l++) {
    assign[l] = page[l % 24];
    order.push(l);
  }
  core.assignData = { assign, order, N: 600 };
  const S = mk(),
    t0 = process.cpuUsage(),
    r1 = core.ptChoose(S, null, null),
    t = process.cpuUsage(t0),
    r2 = core.ptChoose(S, null, r1.extras),
    r3 = core.ptChoose(mk(), null, r1.extras);
  const sig = (r) =>
    JSON.stringify([
      r.err,
      r.nFlat,
      r.extras,
      Object.keys(r.tone).map(
        (l) => r.tone[l] && [r.tone[l].light && r.tone[l].light.mkey, r.tone[l].dark && r.tone[l].dark.mkey],
      ),
    ]);
  assert.equal(sig(r2), sig(r3), 'warm and cold the same');
  // (600 sections, 80 samples each: about 3 s before, under 1 s here; generous for a slow machine)
  assert.ok((t.user + t.system) / 1000 < 2500, 'took ' + Math.round((t.user + t.system) / 1000) + ' ms');
});
