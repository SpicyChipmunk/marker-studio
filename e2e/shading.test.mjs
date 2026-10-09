// Shading: off by default, the sun moves the light, settings save with the guide; rounder light (each edge lit or
// shadowed by which way it faces the sun), Highlight and Shadow size, sections left flat, and light taken from the
// photo in a Photo guide; tones while colouring along. All saved with the guide.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, shot, scrollTop, until, saveGuide, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

const pixels = (page) => page.evaluate(() => document.getElementById('sfCanvas').toDataURL());
// the biggest section that isn't background-sized, and the colour of two opposite points inside it
async function probe(page) {
  return page.evaluate(() => {
    const t = __mstest, W = t.W; let best = 0, ba = 0;
    for (const l in t.assignData.assign) { const a = t.comps[l].area; if (a > ba && a < t.W * t.H * 0.2) { ba = a; best = +l; } }
    let x0 = 1e9, x1 = -1, yM = 0, n = 0; for (let i = 0; i < t.labels.length; i++) if (t.labels[i] === best) { const x = i % W; if (x < x0) x0 = x; if (x > x1) x1 = x; yM += (i / W) | 0; n++; }
    yM = Math.round(yM / n);
    const row = (x) => { while (t.labels[yM * W + x] !== best) x += x < (x0 + x1) / 2 ? 1 : -1; return x; };
    const g = document.getElementById('sfCanvas').getContext('2d'), px = (x) => [...g.getImageData(x, yM, 1, 1).data].slice(0, 3);
    const a = row(x0 + 3), b = row(x1 - 3), lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    return { l: best, left: lum(px(a)), right: lum(px(b)) };
  });
}
async function turnOn(page, mode = 'full') {
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click(`#sfShade [data-v="${mode}"]`);
  await idle(page);
}
async function sunTo(page, fx, fy) {
  const s = await page.locator('#sfSun').boundingBox(), c = await page.locator('#sfCanvas').boundingBox();
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2); await page.mouse.down();
  await page.mouse.move(c.x + c.width * fx, c.y + c.height * fy, { steps: 8 }); await page.mouse.up();
  await idle(page);
}

test('shading is off by default and turning it off again restores the flat guide', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  assert.equal(await page.getAttribute('#sfShade button.on', 'data-v'), 'off');
  assert.ok(!(await page.isVisible('#sfSun')), 'no sun while off');
  const flat = await pixels(page);
  await turnOn(page);
  assert.ok(await page.isVisible('#sfSun'));
  assert.notEqual(await pixels(page), flat, 'the picture changes');
  assert.match(await page.textContent('.sfshnote'), /colours|markers/);
  await page.click('#sfShade [data-v="off"]'); await idle(page);
  assert.equal(await pixels(page), flat, 'back to exactly the flat guide');
  assert.deepEqual(errors, []);
});

test('the shadow falls away from the sun, and dragging the sun moves it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await scrollTop(page);
  await turnOn(page, 'shadow');
  await sunTo(page, 0.02, 0.5);
  const a = await probe(page);
  assert.ok(a.left > a.right + 4, `sun on the left: left side lighter (${a.left | 0} vs ${a.right | 0})`);
  await shot(page, 'shading-left');
  await sunTo(page, 0.98, 0.5);
  const b = await probe(page);
  assert.ok(b.right > b.left + 4, `sun on the right: right side lighter (${b.right | 0} vs ${b.left | 0})`);
  await shot(page, 'shading-right');
  // tap the section: the tip lists its tones
  const p = await sectionPoint(page, a.l);
  await page.mouse.click(p.x, p.y);
  assert.match(await page.textContent('.sftip'), /B .+S /, 'tip lists B (base) and S (shadow)');
  assert.deepEqual(errors, []);
});

test('shading settings save with the guide and come back when it is opened', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await turnOn(page, 'full');
  await sunTo(page, 0.9, 0.9);
  const sun = await page.evaluate(() => __mstest.shadeSun);
  await saveGuide(page); await idle(page);
  await page.reload();
  await page.click('#mHome');
  await page.click('#sfRecent [data-gid]');
  await page.waitForFunction(() => __mstest.assignData);
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.shadeMode), 'full');
  const back = await page.evaluate(() => __mstest.shadeSun);
  assert.ok(Math.abs(back.x - sun.x) < 1e-6 && Math.abs(back.y - sun.y) < 1e-6, 'sun position kept');
  assert.ok(await page.isVisible('#sfSun'));
  // Reveal hides the sun
  await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfReveal'); await idle(page);
  assert.ok(!(await page.isVisible('#sfSun')), 'no sun over the reveal');
  assert.deepEqual(errors, []);
});

test('with shading on, the PDF, its colouring page and the share image all change', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  const grab = () => page.evaluate(() => ({ pdf: __mstest.buildPDFPages().map((c) => c.toDataURL()), share: __mstest.buildExportCanvas().toDataURL() }));
  const off = await grab();
  await turnOn(page, 'full');
  const on = await grab();
  assert.notEqual(on.pdf[0], off.pdf[0], 'colouring page has tone lines and numbers');
  assert.notEqual(on.pdf[1], off.pdf[1], 'key page shows tones and the shaded reference');
  assert.notEqual(on.share, off.share, 'share image is shaded');
  // the real download still works
  await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint');
  assert.match(await page.textContent('#sfSheet'), /Shading is on/);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfPDF')]);
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(await dl.path());
  assert.equal(bytes.toString('latin1', 0, 5), '%PDF-');
  assert.ok((bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length >= 2);
  assert.deepEqual(errors, []);
});

test('colour along with shading: tones in the list, one tap per section in focus, step-by-step setting, partial tones saved', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await turnOn(page, 'full');
  await page.click('#sfColor'); await idle(page);
  assert.ok(await page.locator('#sfAlist .sfatones').count() > 0, 'each colour lists its tones');
  await page.click('#sfFocus'); await idle(page);
  const cur = () => page.evaluate(() => { const t = __mstest; return { pos: t.focusPos, l: t.focusOrd[t.focusPos], bits: t.focusStep[t.focusPos], name: document.getElementById('sfFocName').textContent, sub: document.getElementById('sfFocSub').textContent, chips: [...document.querySelectorAll('#sfFocChips .sffocchip')].map((c) => ({ t: c.textContent, on: c.classList.contains('on') })) }; });
  const a = await cur();
  // (v284: the tones as chips on a line of their own, none lit when the section is coloured in one go)
  assert.ok(a.chips.some((c) => /^B /.test(c.t)) && a.chips.some((c) => /^S /.test(c.t)), 'the bar lists the section\'s tones');
  assert.ok(a.chips.every((c) => !c.on));
  assert.match(a.sub, /^Section \d+ of \d+\. .*base /, 'and says them for screen readers');
  await page.click('#sfFDone'); await idle(page);
  const b = await cur();
  assert.notEqual(b.l, a.l, 'one tap finishes the section and moves on');
  assert.equal(await page.evaluate((l) => __mstest.colored[l], a.l), 1);
  // crisp H/S markers sit over big enough zoomed sections
  let seen = 0; for (let i = 0; i < 8 && !seen; i++) { seen = await page.locator('.sfzone').count(); if (!seen) { await page.click('#sfFSkip'); await idle(page); } }
  assert.ok(seen > 0, 'H/S markers shown over a zoomed section');
  await page.evaluate((p) => __mstest.goFocus(p, false, true), b.pos); await idle(page);
  // step through each tone
  await page.click('#sfFocCols'); await page.check('#sfToneSteps'); await idle(page);
  const c = await cur();
  assert.equal(c.l, b.l, 'stays on the same section');
  assert.match(c.name, /^(Highlight|Base|Shadow) · /, 'names a single tone');
  assert.equal(c.chips.filter((x) => x.on).length, 1, 'its chip lit');
  assert.equal(c.chips.find((x) => x.on).t[0], c.name[0]);
  await page.click('#sfFDone'); await idle(page);
  const d = await cur();
  assert.equal(d.l, c.l, 'next tone of the same section');
  assert.ok(d.bits > c.bits);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], c.l), 0, 'not done until its last tone');
  // partial tones survive saving and reopening
  await page.click('#sfExitFoc'); await saveGuide(page); await idle(page);
  const part = await page.evaluate((l) => __mstest.tonePart[l], c.l);
  assert.ok(part > 0);
  await page.evaluate(() => localStorage.setItem('ms-tone-steps', '0'));
  // (v285: part-coloured, it's Home's Continue card)
  await page.reload(); await page.click('#mHome'); await page.click('#homeCont .hccard');
  await page.waitForFunction(() => __mstest.assignData); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.tonePart[l], c.l), part, 'part-done tones kept');
  assert.equal(await page.evaluate((l) => __mstest.colored[l], a.l), 1, 'finished section kept');
  assert.deepEqual(errors, []);
});

async function shaded(page, mode = 'full') {
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click(`#sfShade [data-v="${mode}"]`); await idle(page);
}
// shade values (0..1) of one section's pixels, split by a test
const vals = (page, l, fn) => page.evaluate(([l, fn]) => {
  const t = __mstest, V = t.shadeField(1), W = t.W, f = new Function('x', 'y', 'c', 'return (' + fn + ')(x,y,c)'), c = t.comps[l], a = [], b = [];
  for (let i = 0; i < t.labels.length; i++) if (t.labels[i] === l && V[i]) { const x = i % W, y = (i / W) | 0; ((f(x, y, c)) ? a : b).push((V[i] - 1) / 254); }
  const m = (r) => r.reduce((s, v) => s + v, 0) / Math.max(1, r.length); return { a: m(a), b: m(b), na: a.length, nb: b.length };
}, [l, fn]);
// the biggest shaded section
const big = (page) => page.evaluate(() => { const t = __mstest, g = t.shadeGeom(); let best = 0, ba = 0; for (const l in t.assignData.assign) { if (!t.shadeable(+l, g)) continue; const a = t.comps[l].area; if (a > ba) { ba = a; best = +l; } } return best; });

test('rounder light: the edge facing the sun is lighter than the edge facing away, even across a long shape', async () => {
  const { page, errors } = await openApp();
  await shaded(page);
  await page.evaluate(() => { __mstest.shadeSun = { x: 0, y: 0.5 }; __mstest.shadeRound = 0.9; });
  const l = await big(page);
  // left edge band vs right edge band (sun on the left); the middle stays in between
  const r = await vals(page, l, "(x,y,c)=>x < c.x0 + (c.x1-c.x0)*0.2");
  const r2 = await vals(page, l, "(x,y,c)=>x > c.x1 - (c.x1-c.x0)*0.2");
  assert.ok(r.a + 0.15 < r2.a, `sun side ${r.a.toFixed(2)} vs far side ${r2.a.toFixed(2)}`);
  // flat light (roundness 0) is a plain gradient: still darker away from the sun
  await page.evaluate(() => { __mstest.shadeRound = 0; });
  const f1 = await vals(page, l, "(x,y,c)=>x < c.x0 + (c.x1-c.x0)*0.2"), f2 = await vals(page, l, "(x,y,c)=>x > c.x1 - (c.x1-c.x0)*0.2");
  assert.ok(f1.a < f2.a);
  assert.deepEqual(errors, []);
});

test('Highlight and Shadow sliders change how much of each shape gets each tone', async () => {
  const { page, errors } = await openApp();
  await shaded(page);
  const share = () => page.evaluate(() => { const t = __mstest, sh = t.shadePrep(false), V = sh.V; let h = 0, s = 0, n = 0; for (let i = 0; i < V.length; i++) { if (!V[i]) continue; const l = t.labels[i], tn = sh.tone[l]; if (!tn) continue; const z = t.shadeZone(tn, (V[i] - 1) / 254); n++; if (z === 0) h++; if (z === 2) s++; } return { h: h / n, s: s / n }; });
  const base = await share();
  await page.evaluate(() => { const el = document.getElementById('sfShLo'); el.value = 90; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await idle(page);
  const moreShadow = await share();
  assert.ok(moreShadow.s > base.s + 0.05, `shadow ${base.s.toFixed(2)} -> ${moreShadow.s.toFixed(2)}`);
  await page.evaluate(() => { const el = document.getElementById('sfShHi'); el.value = 90; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await idle(page);
  const moreHigh = await share();
  assert.ok(moreHigh.h > base.h + 0.03, `highlight ${base.h.toFixed(2)} -> ${moreHigh.h.toFixed(2)}`);
  assert.deepEqual(errors, []);
});

test('sections can be left flat, and that is saved with the guide', async () => {
  const { page, errors } = await openApp();
  await shaded(page);
  const l = await big(page);
  await page.click('#sfShFlat'); await idle(page);
  await scrollTop(page);
  const p = await page.evaluate((l) => { const c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), q = __mstest.labelPos(l); return { x: r.left + q.x / c.width * r.width, y: r.top + q.y / c.height * r.height }; }, l);
  await page.mouse.click(p.x, p.y); await idle(page);
  const r = await page.evaluate((l) => { const t = __mstest, V = t.shadeField(1); let any = 0; for (let i = 0; i < t.labels.length; i++) if (t.labels[i] === l && V[i]) any++; return { any, req: t.shadeReq(l), flat: !!t.shadeFlat[l] }; }, l);
  assert.deepEqual(r, { any: 0, req: 2, flat: true }, 'no tones: just the base marker');
  assert.match(await page.textContent('#sfShFlat'), /· 1/);
  await page.click('#sfShFlat'); // done choosing
  await page.evaluate(() => { __mstest.shadeHi = 0.8; __mstest.shadeLo = 0.3; });
  await saveGuide(page); await idle(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  await page.evaluate(() => SF.loadSample()); await idle(page, 1200);
  await page.evaluate((id) => SF.openDesign(id), id); await idle(page, 1500);
  const back = await page.evaluate(() => ({ n: Object.keys(__mstest.shadeFlat).length, hi: __mstest.shadeHi, lo: __mstest.shadeLo }));
  assert.deepEqual(back, { n: 1, hi: 0.8, lo: 0.3 });
  assert.deepEqual(errors, []);
});

test('in a Photo guide the light comes from the photo (no sun), and can be switched back to the sun', async () => {
  const { page, errors } = await openApp();
  await haveSet(page); await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  // left half light, right half dark, same hue
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#e8a37c'; g.fillRect(0, 0, 300, 800); g.fillStyle = '#7a3f22'; g.fillRect(300, 0, 300, 800); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); });
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
  await page.click('#sfPhAlign');
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), true, 'photo light by default');
  assert.ok(!(await page.isVisible('#sfSun')), 'no sun');
  // sections that straddle the light/dark split: their dark part is shadowed; sections on one side stay even
  const r = await page.evaluate(() => {
    const t = __mstest, V = t.shadeField(1), W = t.W, X = t.photoXf, split = X.cx, g = t.shadeGeom(); const res = { cross: [], one: [] };
    for (const k in t.assignData.assign) { const l = +k, c = t.comps[l]; if (!t.shadeable(l, g)) continue; let a = 0, na = 0, b = 0, nb = 0;
      for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) { const i = y * W + x; if (t.labels[i] !== l || !V[i]) continue; const v = (V[i] - 1) / 254; if (x < split - 3) { a += v; na++; } else if (x > split + 3) { b += v; nb++; } }
      if (na > 60 && nb > 60) res.cross.push(b / nb - a / na); else if (na + nb > 200) res.one.push((a + b) / (na + nb)); }
    return res; });
  assert.ok(r.cross.length >= 2, 'some sections cross the split');
  assert.ok(r.cross.every((d) => d > 0.3), 'the dark side of each crossing section is in shadow: ' + r.cross.map((d) => d.toFixed(2)));
  assert.ok(r.one.every((v) => v > 0.3 && v < 0.6), 'sections on one side stay even');
  await page.click('#sfShLight [data-v="sun"]'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), false);
  assert.ok(await page.isVisible('#sfSun'), 'the sun is back');
  assert.deepEqual(errors, []);
});

test('changing shading counts as an unsaved change', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  // (saved once the header says so: in GitHub's WebKit a late frame can hold the save up past the page going idle)
  await saveGuide(page); await idle(page);
  await until(page, () => /Saved in your Library|Saves itself from now on/.test(document.getElementById('sfSaveSt').textContent), null, 'saved', 10000);
  assert.equal(await page.evaluate(() => __mstest.guideDirty), false);
  // (the Library guide then saves itself 1.5 s later, which clears it again: so it's caught as it happens, not after
  // the page has gone idle, which on a slow machine can be after the auto-save)
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]');
  await until(page, () => __mstest.guideDirty === true, null, 'the guide marked changed', 5000);
  assert.deepEqual(errors, []);
});

// ---- From the review leftovers ----
test('stepping through tones: the base code fades on the highlight and shadow steps, and only this step’s marker is bright', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('.sftabbtn[data-t="colours"]'); await page.click('#sfColor'); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFocCols'); await page.check('#sfToneSteps'); await idle(page);
  const seen = {};
  for (let i = 0; i < 12 && Object.keys(seen).length < 3; i++) {
    const s = await page.evaluate(() => { const t = __mstest, l = t.focusOrd[t.focusPos]; return { bits: t.focusStep[t.focusPos] || 2, faint: t.stepFaint(l), zones: [...document.querySelectorAll('.sfzone')].map((z) => z.textContent + (z.classList.contains('off') ? '-' : '+')) }; });
    seen[s.bits] = 1;
    assert.equal(s.faint, s.bits === 1 || s.bits === 4, `step ${s.bits}`);
    for (const z of s.zones) { const bright = z.endsWith('+'), tone = z[0]; assert.equal(bright, (s.bits === 1 && tone === 'H') || (s.bits === 4 && tone === 'S'), `step ${s.bits}: ${z}`); }
    await page.click('#sfFDone'); await idle(page);
  }
  assert.ok(seen[4], 'reached a shadow step');
  assert.deepEqual(errors, []);
});

// ---- From the second full review ----
const tapSection = async (page, l) => {
  await scrollTop(page);
  const p = await page.evaluate((l) => { const c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect(), q = __mstest.labelPos(l); return { x: r.left + q.x / c.width * r.width, y: r.top + q.y / c.height * r.height }; }, l);
  await page.mouse.click(p.x, p.y); await idle(page);
};
const bigShaded = (page) => page.evaluate(() => { const t = __mstest, g = t.shadeGeom(); let best = 0, ba = 0; for (const l in t.assignData.assign) { if (!t.shadeable(+l, g)) continue; const a = t.comps[l].area; if (a > ba) { ba = a; best = +l; } } return best; });
const pngB64 = (page, draw, w = 600, h = 800) => page.evaluate(async ([draw, w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); new Function('g', 'w', 'h', draw)(g, w, h); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); }, [draw, w, h]);

test('reopening a guide lit from its photo draws the photo light (no sun) once the photo loads', async () => {
  const { page, errors } = await openApp();
  await haveSet(page); await page.check('#wcSets input[data-i="6"]'); await page.click('#wcAdd'); await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  const b64 = await pngB64(page, "g.fillStyle='#e8a37c';g.fillRect(0,0,300,800);g.fillStyle='#7a3f22';g.fillRect(300,0,300,800);");
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'r.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
  await page.click('#sfPhAlign'); await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await saveGuide(page); await idle(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  await page.evaluate(() => SF.loadSample()); await idle(page, 1200);
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction(() => !!__mstest.photoRef); await idle(page);
  assert.ok(!(await page.isVisible('#sfSun')), 'no sun');
  const d = await page.evaluate(() => { const c = document.getElementById('sfCanvas'), g = c.getContext('2d'); __mstest.renderGuide(); const a = g.getImageData(0, 0, c.width, c.height).data.slice(); __mstest.forceFullRender(); __mstest.renderGuide(); const b = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; });
  assert.equal(d, 0, 'already drawn with the photo light');
  assert.deepEqual(errors, []);
});

test('Leave sections flat works in the Blend pattern (the tap leaves it flat instead of adding an anchor)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="blend"]'); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShFlat');
  const l = await bigShaded(page);
  await tapSection(page, l);
  assert.equal(await page.evaluate((l) => !!__mstest.shadeFlat[l], l), true, 'the tap left it flat');
  assert.deepEqual(errors, []);
});

// ---- From the third full review (v259) ----
test('the sun sits on the picture after full screen opens and closes (measured once the picture has settled)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await page.evaluate(() => { __mstest.shadeSun = { x: 0.8, y: 0.8 }; __mstest.renderGuide(); });
  const off = () => page.evaluate(() => { const s = document.getElementById('sfSun').getBoundingClientRect(), c = document.getElementById('sfCanvas').getBoundingClientRect(); return Math.hypot(s.left + s.width / 2 - (c.left + 0.8 * c.width), s.top + s.height / 2 - (c.top + 0.8 * c.height)); });
  // the picture eases to its new size and the sun is placed again when that ends: wait for it (GitHub's WebKit can hold
  // a frame back for seconds, run 23; in WebKit itself the sun is 0 px off before, in and after full screen)
  const settled = (what) => until(page, () => { const s = document.getElementById('sfSun').getBoundingClientRect(), c = document.getElementById('sfCanvas').getBoundingClientRect(); return Math.hypot(s.left + s.width / 2 - (c.left + 0.8 * c.width), s.top + s.height / 2 - (c.top + 0.8 * c.height)) < 3; }, null, what, 15000).catch(() => {});
  await page.click('#sfFull'); await idle(page); await settled('the sun on the picture in full screen');
  assert.ok(await off(page) < 3, 'full screen');
  await page.click('#sfFullX'); await idle(page); await settled('the sun on the picture after full screen');
  assert.ok(await off(page) < 3, 'back');
  const pin = await page.evaluate(() => Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pinH')) - (Math.round(innerHeight * 0.45) + document.getElementById('sfZoomCtl').offsetHeight)));
  assert.ok(pin <= 2, 'the tabs stick right under the pinned picture (floor size) and tool row again');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (data safety) ----
// Save (a new guide into the Library), done once the header says so
const saveNew = (page) => saveGuide(page);

const AUTO = 2300; // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
const savedId = (page) => page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((p) => p && { prog: (p.prog || []).length, assign: p.assign, tones: p.tones || {}, ref: p.ref || null, base: p.base || null, style: p.style }), id);
const tab = (page, t) => page.click(`.sftabbtn[data-t="${t}"]`);
// reopen a Library guide the way the Library does
const openSaved = async (page, id) => { await page.evaluate((id) => loadGuide({ id }), id); await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 }); await idle(page); };

test('switching shading off keeps part-done tones: Undo (or shading back on) makes them part-done again, also after reopening', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveNew(page);
  const id = await savedId(page);
  await tab(page, 'shading'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  const l = await page.evaluate(() => { const t = __mstest, g = t.shadeGeom(); let best = 0, ba = 0; for (const l in t.assignData.assign) { if (!t.shadeable(+l, g)) continue; const a = t.comps[l].area; if (a > ba) { ba = a; best = +l; } } return best; });
  await page.evaluate((l) => { __mstest.stepSet(l, 2, true); __mstest.guideDirty = true; __mstest.renderGuide(); }, l);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 0, 'base only: not done yet');
  await page.click('#sfShade [data-v="off"]'); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'with shading off the base is all it needs');
  await page.keyboard.press('Control+z'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.shadeMode), 'full');
  assert.deepEqual(await page.evaluate((l) => [__mstest.colored[l], __mstest.tonePart[l]], l), [0, 2], 'part-done again after Undo');
  // saved with shading off, reopened, shading back on: still part-done
  await page.click('#sfShade [data-v="off"]'); await idle(page, AUTO);
  const s = await stored(page, id);
  assert.equal(s.tones[l], 2, 'its tones are stored with it');
  await page.reload(); await idle(page);
  await openSaved(page, id);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1);
  // (v284: part-way coloured, it opens in Colour along)
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  await page.click('#sfDoneBtn'); await idle(page);
  await tab(page, 'shading'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  assert.deepEqual(await page.evaluate((l) => [__mstest.colored[l], __mstest.tonePart[l]], l), [0, 2]);
  assert.deepEqual(errors, []);
});
