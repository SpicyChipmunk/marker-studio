// Shading's Highlights (Same colour / Warmer / Paper white) and Shadows (Same colour / Cooler / Grey), v277. A cooler
// or grey shadow is a marker laid over the base, shown as that glaze; a warmer highlight is a lighter marker turned
// towards yellow; a paper highlight leaves the lit side white (no marker, no step of its own). Each falls back to the
// same colour when you own no marker of that kind, and the note says so.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

async function shaded(page) {
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
}
// every colour in the guide with its tones: hue and lightness of the base, the companions and the glaze (L*C*h°)
const tones = (page) => page.evaluate(() => {
  const t = __mstest, seen = {}, out = [], lch = (hex) => lchOf(hexToLab(hex)),
    rgbHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  for (const l in t.assignData.assign) {
    const m = t.assignData.assign[l];
    if (seen[m.mkey]) continue;
    seen[m.mkey] = 1;
    const x = t.shadeTones(m);
    out.push({
      code: m.code, base: lch(m.hex), temp: t.colour.temp(m),
      light: x.light && { code: x.light.code, lch: lch(x.light.hex), fam: x.light.fam },
      dark: x.dark && { code: x.dark.code, lch: lch(x.dark.hex), fam: x.dark.fam, temp: t.colour.temp(x.dark) },
      glaze: x.glaze, S: lch(rgbHex(x.S)), sameS: x.glaze && rgbHex(x.S) === rgbHex(t.shadeGlaze(x.B, x.dark)),
      paper: x.paper, fellS: x.fellS, fellH: x.fellH, noShadow: x.noShadow,
    });
  }
  return out;
});
const turn = (a, b) => { const d = ((((b - a) % 360) + 540) % 360) - 180; return d === -180 ? 180 : d; };
const coolWay = (h) => (h >= 70 && h < 282 ? 1 : -1);
const pixels = (page) => page.evaluate(() => { const c = document.getElementById('sfCanvas'); return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 97 === 0)); });

test('Shadows › Cooler: a marker turned the cool way, laid over the base as a clear step darker; Undo says so', async () => {
  const { page, errors } = await openApp();
  await shaded(page);
  const before = await pixels(page);
  await page.selectOption('#sfShStyle', 'cool'); await idle(page);
  assert.equal(await page.inputValue('#sfShStyle'), 'cool');
  assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /^Undo: Shadows: Cooler/);
  const T = await tones(page), cool = T.filter((t) => t.glaze);
  assert.ok(cool.length >= T.length / 2, `most colours get a cooler shadow (${cool.length} of ${T.length})`);
  for (const t of cool) {
    const k = turn(t.base[2], t.dark.lch[2]) * coolWay(t.base[2]);
    if (t.base[1] >= 8) assert.ok(k >= 8 && k <= 40, `${t.code} → ${t.dark.code}: turned ${k.toFixed(1)}° the cool way`);
    const dL = t.base[0] - t.S[0];
    assert.ok(dL >= 4.5 && dL <= 26.5, `${t.code}: the glaze is ${dL.toFixed(1)} darker`);
    assert.ok(t.sameS, `${t.code}: the shadow shown is the glaze, not the marker's own colour`);
  }
  // the ones that fell back have the same-colour shadow, and the note says how many
  const fell = T.filter((t) => t.fellS);
  if (fell.length) assert.match(await page.textContent('.sfshnote'), /same colour|same-colour/);
  assert.notDeepEqual(await pixels(page), before, 'the picture changed');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeShadow), 'same');
  assert.deepEqual(await pixels(page), before, 'Undo puts the shading back');
  assert.deepEqual(errors, []);
});

test('Shadows › Grey: a grey from a grey family, matched to the colour\'s warmth, glazed over the base', async () => {
  const { page, errors } = await openApp();
  await shaded(page);
  await page.selectOption('#sfShStyle', 'grey'); await idle(page);
  const T = await tones(page), grey = T.filter((t) => t.glaze);
  assert.ok(grey.length > 0, 'some colours get a grey shadow');
  for (const t of grey) {
    assert.match(t.dark.fam, /Grey|Blue-Green-Yellow|Yellow-Green-Yellow/, `${t.code} → ${t.dark.code} (${t.dark.fam})`);
    if (t.temp === 'warm') assert.notEqual(t.dark.temp, 'cool', `${t.code}: not a cool grey under a warm colour`);
    if (t.temp === 'cool') assert.notEqual(t.dark.temp, 'warm', `${t.code}: not a warm grey under a cool colour`);
    assert.ok(t.base[0] - t.S[0] >= 4.5, `${t.code}: the glaze is darker`);
  }
  // Colour along's shadow step says it goes over the base
  const l = await page.evaluate(() => { const t = __mstest; for (const l in t.assignData.assign) if (t.shadeTones(t.assignData.assign[l]).glaze && t.shadeReq(+l) & 4) return +l; return -1; });
  assert.ok(l > 0);
  assert.match((await page.evaluate((l) => __mstest.stepText(l, 4), l)).sub, /over the base/);
  assert.deepEqual(errors, []);
});

test('Highlights › Warmer: a lighter marker turned the warm way; shown only with Light & shadow', async () => {
  const { page, errors } = await openApp();
  await shaded(page);
  await page.selectOption('#sfHiStyle', 'warm'); await idle(page);
  assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /^Undo: Highlights: Warmer/);
  const T = await tones(page), warm = T.filter((t) => t.light && !t.fellH);
  assert.ok(warm.length >= T.length / 2, `most colours get a warmer highlight (${warm.length} of ${T.length})`);
  for (const t of warm) {
    const dL = t.light.lch[0] - t.base[0];
    assert.ok(dL >= 4 && dL <= 26, `${t.code} → ${t.light.code}: ${dL.toFixed(1)} lighter`);
    if (t.base[1] >= 8) {
      const k = turn(t.base[2], t.light.lch[2]) * -coolWay(t.base[2]);
      assert.ok(k >= 8 && k <= 40, `${t.code} → ${t.light.code}: turned ${k.toFixed(1)}° the warm way`);
    }
  }
  // Shadows only: no highlight, so no Highlights choice
  await page.click('#sfShade [data-v="shadow"]'); await idle(page);
  assert.equal(await page.$('#sfHiStyle'), null);
  assert.ok(await page.$('#sfShStyle'));
  assert.deepEqual(errors, []);
});

test('Highlights › Paper white: no lighter marker, the lit side left white (a smaller part than a marker highlight), and the steps say so', async () => {
  const { page, errors } = await openApp();
  await shaded(page);
  const t2 = await page.evaluate(() => __mstest.shT2(__mstest.zsh(0)));
  await page.selectOption('#sfHiStyle', 'paper'); await idle(page);
  assert.ok(await page.evaluate(() => __mstest.shT2(__mstest.zsh(0))) < t2, 'the paper highlight is the brightest part only');
  const T = await tones(page);
  assert.ok(T.every((t) => t.paper && !t.light), 'no lighter markers');
  const l = await page.evaluate(() => { const t = __mstest, g = t.assignData.order; for (const l of g) if (t.shadeReq(l) !== 2) return l; return -1; });
  assert.ok(l > 0);
  assert.equal(await page.evaluate((l) => __mstest.shadeReq(l) & 1, l), 0, 'no highlight step');
  assert.match((await page.evaluate((l) => __mstest.stepText(l, 2), l)).sub, /leave it white/);
  assert.match(await page.evaluate((l) => __mstest.shadeTipHTML(l), l), /H paper/);
  assert.match(await page.evaluate(() => __mstest.shadeHowto()), /the paper left white/);
  // part-done sections are brought in line: a section with its base done is done with a paper highlight
  await page.evaluate((l) => { const t = __mstest; t.tonePart[l] = 2 | 4; t.normalizeTones(); }, l);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1);
  // on the paper, a paper highlight is the paper's own colour
  assert.deepEqual(await page.evaluate(() => { const t = __mstest, m = t.assignData.assign[t.assignData.order[0]]; return t.shadeTones(m).L; }), [247, 244, 238]);
  assert.deepEqual(errors, []);
});

test('the sample jellyfish opens with all 166 of its sections; the smallest-section slider runs from 2 to 400 px', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  assert.equal(await page.evaluate(() => __mstest.assignData.N), 166);
  // on the Sections screen: all the way left keeps every section bigger than a speck, all the way right only the big ones
  await page.click('#sfBack2'); await idle(page);
  const count = (v) => page.evaluate((v) => { const el = document.getElementById('sfMin'); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); const t = __mstest; let n = 0; for (let l = 1; l < t.comps.length; l++) { const c = t.comps[l]; if (c && !c.merged && !c.bg && c.area >= t.minPx()) n++; } return n; }, v);
  assert.equal(await page.evaluate(() => document.getElementById('sfMin').value), '30');
  assert.equal(await count(30), 166);
  assert.equal(await count(0), 166, 'only single-pixel specks are below 2 px');
  const most = await count(100);
  assert.ok(most > 20 && most < 166, `at 400 px some sections go (${most} left)`);
  assert.deepEqual(errors, []);
});
