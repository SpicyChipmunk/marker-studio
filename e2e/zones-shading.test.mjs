// Shading per zone (v281): each zone has its own "Shade Bell", Roundness, and Highlights and Shadows (kind and amount);
// the mode, the light (the sun or the photo) and the tone lines are the whole picture's. A flat zone is as sections left
// flat are. One marker can have other companions in another zone: Colour along and the printed key show each.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop, notOnWebKit, WK, saveGuide, answerAsks, buildGo } from './helpers.mjs';

before(setup);
after(teardown);

const bigSecs = (page, n, part) => page.evaluate(([n, part]) => {
  const t = __mstest, H = t.H;
  return Object.keys(t.assignData.assign).map(Number)
    .filter((l) => (part === 'top' ? t.comps[l].cy < H * 0.3 : t.comps[l].cy > H * 0.7))
    .sort((a, b) => t.comps[b].area - t.comps[a].area).slice(0, n);
}, [n, part]);
async function tapSec(page, l) {
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y); await idle(page);
}
async function makeZone(page, secs, name) {
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
  else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
  await idle(page);
  if (name) { await page.fill('#sfZoneName', name); await page.press('#sfZoneName', 'Enter'); await idle(page); }
  for (const l of secs) await tapSec(page, l);
  await page.click('#sfZoneDone'); await idle(page);
}
const shadingOn = async (page, mode = 'full') => { await page.click('.sftabbtn[data-t="shading"]'); await idle(page); await page.click(`#sfShade [data-v="${mode}"]`); await idle(page); };
const shadeTab = async (page) => { await page.click('.sftabbtn[data-t="shading"]'); await idle(page); };
const chip = (page, id) => page.click(`#sfPanel-shading .sfzchip[data-z="${id}"]`).then(() => idle(page));
const slide = (page, id, v) => page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
const undoLabel = (page) => page.getAttribute('#sfPlanUndo', 'aria-label');
// a section's tones (null: not shaded) and why not
const sec = (page, l) => page.evaluate((l) => { const t = __mstest.shadeSec(l); return { t: t && { T2: t.T2, T3: t.T3, paper: !!t.paper, light: t.light ? t.light.mkey : null, dark: t.dark ? t.dark.mkey : null, glaze: !!t.glaze }, why: __mstest.shadeWhy(l) }; }, l);
// Main's sections and a zone's
const split = (page, zid) => page.evaluate((zid) => { const t = __mstest, m = [], z = []; for (const l in t.assignData.assign) (t.zoneOf(+l) === zid ? z : t.zoneOf(+l) === 0 ? m : []).push(+l); return { main: m, zone: z }; }, zid);
const shadedIn = (page, secs) => page.evaluate((secs) => secs.filter((l) => !!__mstest.shadeSec(l)), secs);

test('the Shading tab: the whole picture’s settings first; with zones, the chips, “Shade Bell” and the chosen zone’s own', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  // without zones: no chips, no Shade checkbox; the whole picture's settings above Roundness and the pair
  assert.equal(await page.$('#sfPanel-shading .sfzrow'), null);
  assert.equal(await page.$('#sfZoneShade'), null);
  const order = () => page.evaluate(() => [...document.querySelectorAll('#sfPanel-shading #sfShade, #sfPanel-shading .sfshnote, #sfPanel-shading .sfshrow, #sfPanel-shading .sfzrow, #sfPanel-shading .sfzshade, #sfPanel-shading #sfRound, #sfPanel-shading .sfshpair, #sfPanel-shading #sfTex')].map((e) => e.id || ['sfshnote', 'sfshrow', 'sfzrow', 'sfzshade', 'sfshpair'].find((c) => e.classList.contains(c))));
  assert.deepEqual(await order(), ['sfShade', 'sfshnote', 'sfshrow', 'sfRound', 'sfshpair', 'sfTex']);
  await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
  await shadeTab(page);
  assert.deepEqual(await order(), ['sfShade', 'sfshnote', 'sfshrow', 'sfzrow', 'sfzshade', 'sfRound', 'sfshpair', 'sfTex']);
  assert.match(await page.textContent('#sfPanel-shading .sfzshade'), /Shade Bell/);
  // the chips choose the zone, here as in Pattern and Colours (one chosen zone for all three)
  await chip(page, 0);
  assert.match(await page.textContent('#sfPanel-shading .sfzshade'), /Shade Main/);
  assert.equal(await page.evaluate(() => __mstest.zoneCur), 0);
  assert.equal(await page.getAttribute('#sfPanel-pattern .sfzchip[data-z="0"]', 'aria-pressed'), 'true');
  // Off: none of it
  await page.click('#sfShade [data-v="off"]'); await idle(page);
  assert.equal(await page.$('#sfPanel-shading .sfzrow'), null);
  assert.deepEqual(errors, []);
});

test('each zone’s Roundness, Highlights and Shadows change its own sections only; a new zone starts with the chosen zone’s', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  await makeZone(page, await bigSecs(page, 8, 'top'), 'Bell');
  const zid = await page.evaluate(() => __mstest.zoneCur), s = await split(page, zid);
  const mz = (await shadedIn(page, s.main))[0], bz = (await shadedIn(page, s.zone))[0];
  assert.ok(mz && bz, 'a shaded section in each');
  const m0 = await sec(page, mz), b0 = await sec(page, bz);
  assert.deepEqual([m0.t.T2, m0.t.T3], [b0.t.T2, b0.t.T3], 'Bell started with Main\'s shading');
  await shadeTab(page);
  // Bell's highlight kind and amounts
  await page.selectOption('#sfHiStyle', 'paper'); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Bell: Highlights: Paper white');
  await slide(page, 'sfShLo', 90); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Bell: Shadow changed');
  const m1 = await sec(page, mz), b1 = await sec(page, bz);
  assert.deepEqual(m1, m0, 'Main\'s section is as it was');
  assert.equal(b1.t.paper, true);
  assert.ok(b1.t.T3 < b0.t.T3, 'more of Bell\'s section is shadow');
  // roundness: Bell's pixels change, Main's don't
  const V = () => page.evaluate(([a, b]) => { const t = __mstest; t.shadePrep(false); const V = t.shadeV, ra = [], rb = []; for (let i = 0; i < t.labels.length; i++) { if (t.labels[i] === a) ra.push(V[i]); else if (t.labels[i] === b) rb.push(V[i]); } return { a: ra.join(), b: rb.join() }; }, [mz, bz]);
  const v0 = await V(page);
  await slide(page, 'sfRound', 95); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Bell: Roundness changed');
  const v1 = await V(page);
  assert.equal(v1.a, v0.a, 'Main\'s section is shaded as it was');
  assert.notEqual(v1.b, v0.b, 'Bell\'s is rounder');
  // Main's own change says so
  await chip(page, 0);
  await slide(page, 'sfRound', 10); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Main: Roundness changed');
  assert.equal(await page.evaluate((id) => __mstest.zsh(id).round, zid), 0.95, 'Bell keeps its own');
  // Undo takes them back one at a time
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.zsh(0).round), 0.5);
  // a new zone made while Bell is chosen has Bell's shading
  await chip(page, zid);
  await makeZone(page, await bigSecs(page, 2, 'bottom'), 'Foot');
  const fz = await page.evaluate(() => __mstest.zoneCur);
  assert.deepEqual(await page.evaluate(([a, b]) => [__mstest.zsh(a), __mstest.zsh(b)], [zid, fz]).then(([a, b]) => [a.hilite, a.lo, a.round].join() === [b.hilite, b.lo, b.round].join()), true);
  assert.deepEqual(errors, []);
});

test('a flat zone: its sections one colour each, as sections left flat; tips, Colour along and the print follow; a new zone made from it is flat too', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  await makeZone(page, await bigSecs(page, 8, 'top'), 'Bell');
  const zid = await page.evaluate(() => __mstest.zoneCur), s = await split(page, zid);
  const bz = (await shadedIn(page, s.zone))[0];
  await shadeTab(page);
  await page.click('#sfZoneShade'); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Bell: Shading: Flat');
  assert.match(await page.textContent('#sfPanel-shading .sfzflat'), /Bell is flat: one colour per section/);
  assert.equal(await page.$('#sfRound'), null, 'no Roundness or Highlights for a flat zone');
  assert.deepEqual(await sec(page, bz), { t: null, why: 'zone' });
  assert.equal((await shadedIn(page, s.zone)).length, 0);
  assert.ok((await shadedIn(page, s.main)).length > 0, 'Main is still shaded');
  // its tip says why
  await tapSec(page, bz);
  assert.match(await page.textContent('.sftip'), /Bell is flat — one colour/);
  await page.keyboard.press('Escape');
  // Leave sections flat: a tap in Bell says it's flat already
  await page.click('#sfShFlat'); await idle(page);
  await tapSec(page, bz);
  assert.match(await page.textContent('#msToast'), /Bell is flat, so its sections already are/);
  assert.equal(await page.evaluate((l) => !!__mstest.styleVars.shadeFlat[l], bz), false);
  await page.click('#sfShFlat'); await idle(page);
  // Colour along zone by zone: Bell's rows have no tones, Main's do
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfAlOrder [data-v="zones"]'); await idle(page);
  const rows = await page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => [r.dataset.k, !!r.querySelector('.sfatones')]));
  assert.ok(rows.length);
  for (const [k, tones] of rows) assert.equal(tones, !k.endsWith('@' + zid), k);
  await page.click('#sfAlOrder [data-v="whole"]'); await idle(page);
  await page.click('#sfDoneBtn'); await idle(page);
  // every zone flat: nothing is shaded, so no tone steps, how-to or tone columns
  await shadeTab(page);
  await chip(page, 0);
  await page.click('#sfZoneShade'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.shadeUse().on), false);
  assert.match(await page.textContent('#sfPanel-shading .sfshnote'), /Every section is flat, so nothing is shaded: tick “Shade” for a zone/);
  // (and the ⓘ line doesn't ask to drag a sun that isn't there)
  assert.doesNotMatch(await page.textContent('#sfPanel-shading'), /Drag the/);
  assert.ok((await page.evaluate(() => __mstest.buildPDFPages(true))) >= 1);
  await page.click('#sfColor'); await idle(page);
  assert.equal(await page.$('#sfAlist .sfatones'), null);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFocCols'); await idle(page);
  assert.equal(await page.$('#sfToneSteps'), null, 'no "Step through each tone"');
  await page.click('#sfExitFoc'); await idle(page);
  await page.click('#sfDoneBtn'); await idle(page);
  // a new zone made while flat Main is chosen is flat too (as it copies the chosen zone's settings)
  await makeZone(page, await bigSecs(page, 2, 'bottom'), 'Foot');
  assert.equal(await page.evaluate(() => __mstest.zsh(__mstest.zoneCur).on), false);
  assert.deepEqual(errors, []);
});

test('the last zone deleted with Main flat: the whole guide is shaded again (Shade Main goes with the zones)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  await makeZone(page, await bigSecs(page, 3, 'top'), 'Bell');
  const zid = await page.evaluate(() => __mstest.zoneCur);
  await shadeTab(page);
  await chip(page, 0);
  await page.click('#sfZoneShade'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeMain), false);
  // Bell's editor (its chip, then its chip again), Delete zone
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click(`#sfPanel-pattern .sfzchip[data-z="${zid}"]`); await idle(page);
  await page.click(`#sfPanel-pattern .sfzchip[data-z="${zid}"]`); await idle(page);
  await page.click('#sfZoneDel'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.zones.length), 0);
  assert.equal(await page.evaluate(() => __mstest.styleVars.shadeMain), true);
  assert.equal(await page.evaluate(() => __mstest.shadeUse().on), true);
  // Undo brings back the zone, and Main flat with it
  await page.click('#sfPlanUndo'); await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.zones.length, __mstest.styleVars.shadeMain]), [1, false]);
  assert.deepEqual(errors, []);
});

test('one marker, other companions in another zone: Colour along shows both (and each zone’s when open), the printed key has a line for the zone', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  await makeZone(page, await bigSecs(page, 12, 'top'), 'Bell');
  const zid = await page.evaluate(() => __mstest.zoneCur);
  await shadeTab(page);
  await page.selectOption('#sfHiStyle', 'paper'); await idle(page);
  await page.selectOption('#sfShStyle', 'grey'); await idle(page);
  // a marker shaded in both Main and Bell
  const mk = await page.evaluate((zid) => { const t = __mstest, by = {}; for (const l in t.assignData.assign) { if (!t.shadeSec(+l)) continue; const k = t.assignData.assign[l].mkey; (by[k] = by[k] || new Set()).add(t.zoneOf(+l)); } return Object.keys(by).find((k) => by[k].has(0) && by[k].has(zid)); }, zid);
  assert.ok(mk, 'a marker shaded in both zones');
  const rows = await page.evaluate((mk) => { const t = __mstest, secs = t.assignData.order.filter((l) => t.assignData.assign[l].mkey === mk); return t.toneRows(secs).map((r) => ({ paper: !!r.t.paper, z: Object.keys(r.z) })); }, mk);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.paper).sort(), [false, true]);
  await page.click('#sfColor'); await idle(page);
  const row = `#sfAlist .sfarow[data-k="${mk}"]`;
  const tones = await page.textContent(row + ' .sfatones .sftv');
  assert.match(tones, /H .+ \/ paper|H paper \/ /, 'both highlights: ' + tones);
  const said = await page.textContent(row + ' .sfatones .sfsr');
  assert.match(said, /highlight .+ or /);
  // (a grey shadow is laid over the base, and says so)
  if (await page.evaluate((mk) => { const t = __mstest; return t.assignData.order.some((l) => t.assignData.assign[l].mkey === mk && t.shadeSec(l) && t.shadeSec(l).glaze); }, mk)) assert.match(said, /over the base/);
  // (several options: the row's tones take the lines they need)
  assert.ok(await page.$(row + ' .sfatones.sfatm'));
  await page.click(row + ' .sfah'); await idle(page);
  const byZone = await page.$$eval(row + ' .sfazones > div', (ds) => ds.map((d) => d.querySelector('b').textContent));
  assert.deepEqual(byZone.sort(), ['Bell', 'Main']);
  await page.click('#sfDoneBtn'); await idle(page);
  // the print: a page count that allows for the lines, and the pages drawn without trouble
  const pages = await page.evaluate(() => __mstest.buildPDFPages(true));
  assert.ok(pages >= 2);
  assert.equal(await page.evaluate(() => __mstest.buildPDFPages(false).length), pages);
  // the how-to for a guide with both kinds of highlight
  assert.match(await page.evaluate(() => __mstest.shadeHowto()), /a lighter marker, or the paper left white where the key says so/);
  assert.deepEqual(errors, []);
});

test('the tone circles follow the Highlight and Shadow amounts (they were kept from before a change)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  const labs = () => page.evaluate(() => { const t = __mstest, sh = t.shadePrep(false); return JSON.stringify(t.shadeZoneLabelsAll(sh, 3).map((z) => [z.l, z.tone, Math.round(z.x), Math.round(z.y)])); });
  const a = await labs(page);
  await slide(page, 'sfShHi', 100); await idle(page);
  await slide(page, 'sfShLo', 100); await idle(page);
  const b = await labs(page);
  assert.notEqual(b, a);
  assert.deepEqual(errors, []);
});

test('zones’ shading is saved with the guide and opens as it was; a zone saved before v281 opens with Main’s', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
  const zid = await page.evaluate(() => __mstest.zoneCur);
  await shadeTab(page);
  await page.selectOption('#sfShStyle', 'cool'); await idle(page);
  await slide(page, 'sfRound', 80); await idle(page);
  await chip(page, 0);
  await page.click('#sfZoneShade'); await idle(page);
  const d = await page.evaluate(() => __mstest.currentDesignObj());
  assert.deepEqual(d.payload.zones[0].shade, { on: true, round: 0.8, hi: 0.5, lo: 0.5, shadow: 'cool', hilite: 'same' });
  assert.equal(d.payload.style.shade.main, false);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  const z = await page.evaluate(() => { const t = __mstest, id = t.zones[0].id; return [t.zsh(id), t.styleVars.shadeMain]; });
  assert.deepEqual([z[0].shadow, z[0].round, z[0].on, z[1]], ['cool', 0.8, true, false]);
  // a zone saved before v281 has no shading of its own: Main's, as it had then
  await page.evaluate(() => { const t = __mstest, d = t.currentDesignObj(), p = d.payload; delete p.zones[0].shade; p.style.shade.round = 0.3; p.style.shade.shadow = 'grey'; p.style.shade.main = true; t.openDesignObj(Object.assign({}, p, { name: 'Old', W: d.W, H: d.H }), null); });
  await page.waitForFunction(() => __mstest.curName === 'Old' && __mstest.zones.length); await idle(page);
  const o = await page.evaluate(() => __mstest.zsh(__mstest.zones[0].id));
  assert.deepEqual([o.on, o.round, o.shadow], [true, 0.3, 'grey']);
  assert.deepEqual(errors, []);
});

test('a change waiting to be saved goes into its guide with its zones when another picture opens', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await makeZone(page, await bigSecs(page, 3, 'top'), 'Bell');
  // the sample again at once (the autosave hasn't run yet)
  await page.evaluate(() => SF.loadSample());
  await page.waitForFunction((id) => __mstest.assignData && !__mstest.zones.length && __mstest.curId !== id, id); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  assert.deepEqual(await page.evaluate(() => __mstest.zones.map((z) => z.name)), ['Bell']);
  assert.deepEqual(errors, []);
});

test('Light from is one light for the whole picture, whichever zone is chosen; sections the photo doesn’t cover stay flat', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  await makeZone(page, await bigSecs(page, 6, 'bottom'), 'Foot');
  const zid = await page.evaluate(() => __mstest.zoneCur);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 600, 0); gr.addColorStop(0, '#f0c0c0'); gr.addColorStop(1, '#401010'); g.fillStyle = gr; g.fillRect(0, 0, 600, 800); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking); await idle(page);
  // the photo over the bottom half of the picture only
  await page.evaluate(() => { const M = __mstest, r = M.photoRef; M.photoXf = { cx: M.W / 2, cy: M.H * 0.75, sx: M.W / r.w, sy: (M.H / 2) / r.h, r: 0 }; M.photoRecolour(); });
  await idle(page);
  // Main isn't a Photo pattern: the sun, whichever zone is chosen (v280 flipped it with the chip)
  assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), false);
  await shadeTab(page);
  assert.equal(await page.getAttribute('#sfShLight [data-v="sun"]', 'aria-pressed'), 'true');
  await chip(page, 0);
  assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), false);
  // a top section half done (its base) while the sun shades it
  const half = await page.evaluate(() => { const t = __mstest; const l = Object.keys(t.assignData.assign).map(Number).find((l) => t.comps[l].cy < t.H * 0.3 && t.shadeSec(l) && !t.shadeSec(l).coat); t.normalizeTones(); t.tonePart[l] = 2; return l; });
  assert.ok(half);
  // The photo: every zone lit from it, the top half (no photo there) flat, and a line says how many
  await page.click('#sfShLight [data-v="photo"]'); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], half), 1, 'flat now: its base was all it needed');
  assert.equal(await undoLabel(page), 'Undo: Light from the photo');
  assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), true);
  await chip(page, zid);
  assert.equal(await page.evaluate(() => __mstest.shadeFromPhoto()), true, 'the same light with another zone chosen');
  const r = await page.evaluate(() => { const t = __mstest, out = { top: 0, topShaded: 0 }; for (const l in t.assignData.assign) { if (t.comps[l].cy < t.H * 0.4) { out.top++; if (t.shadeSec(+l)) out.topShaded++; } } return out; });
  assert.ok(r.top > 5 && r.topShaded === 0, JSON.stringify(r));
  assert.match(await page.textContent('#sfShOut'), /sections? (is|are) outside the photo, so (it stays|they stay) flat/);
  const top = await page.evaluate(() => { const t = __mstest; return Object.keys(t.assignData.assign).map(Number).find((l) => t.comps[l].cy < t.H * 0.3 && t.shadeWhy(l) === 'photo'); });
  assert.ok(top);
  // no sun handle with the light from the photo
  assert.equal(await page.evaluate(() => { const s = document.getElementById('sfSun'); return !!s && s.style.display !== 'none'; }), false);
  // saved and opened again: once the photo is back, that section is still done
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData && !!__mstest.photoRef, id); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], half), 1);
  assert.deepEqual(errors, []);
});

test('Main flat, the picture turned (the zones cleared), then Undo in Edit sections: the zones and Main flat are back', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
  await shadeTab(page);
  await chip(page, 0);
  await page.click('#sfZoneShade'); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfAdjToggle'); await idle(page);
  await page.click('#sfRotR'); await idle(page, 3000);
  await buildGo(page); await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.zones.length, __mstest.styleVars.shadeMain]), [0, true]);
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfPlanUndo'); await idle(page, 3000);
  await buildGo(page); await idle(page);
  assert.deepEqual(await page.evaluate(() => [__mstest.zones.map((z) => z.name), __mstest.styleVars.shadeMain]), [['Bell'], false]);
  assert.deepEqual(errors, []);
});

test('by keyboard, Off / Shadows / Light & shadow keeps the focus on the one chosen', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadeTab(page);
  await page.focus('#sfShade [data-v="shadow"]');
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => { const a = document.activeElement; return a && a.closest('#sfShade') ? a.dataset.v : a && a.tagName; }), 'shadow');
  assert.deepEqual(errors, []);
});

test('choosing a zone’s sections with shading on: the sun is out of the way (a drag where it was picks sections, not the light)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await shadingOn(page);
  const sunShown = () => page.evaluate(() => { const s = document.getElementById('sfSun'); return !!s && s.style.display !== 'none'; });
  assert.equal(await sunShown(page), true);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfZoneAdd'); await idle(page);
  assert.equal(await sunShown(page), false, 'no sun in the zone editor');
  const sun0 = await page.evaluate(() => JSON.stringify(__mstest.styleVars.shadeSun));
  // a tap where the sun sits (top left): the section there, if any, joins; the light stays put
  await scrollTop(page);
  const p = await page.evaluate(() => { const c = document.getElementById('sfCanvas').getBoundingClientRect(), s = __mstest.styleVars.shadeSun; return { x: c.left + c.width * s.x, y: c.top + c.height * s.y }; });
  await page.mouse.click(p.x, p.y); await idle(page);
  assert.equal(await page.evaluate(() => JSON.stringify(__mstest.styleVars.shadeSun)), sun0);
  await page.click('#sfZoneDone'); await idle(page);
  assert.equal(await sunShown(page), true, 'back after Done');
  assert.deepEqual(errors, []);
});
