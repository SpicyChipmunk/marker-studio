// Zones (v280): what the v279 review found. Zones follow the sections through re-detection, turning and Undo in Edit
// sections; a tap in the zone editor doesn't roll a Random zone again; the markers-changed check; focus mode and the
// Done group zone by zone; Undo labels and an empty zone.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop, saveGuide, answerAsks, buildGo } from './helpers.mjs';

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
const zoneSecsAll = (page) => page.evaluate(() => __mstest.zones.map((z) => Object.keys(z.secs).map(Number).sort((a, b) => a - b)));
// the picture flipped left to right (the same size), its sections found again `times` times (as Sensitivity does)
const flipAndDetect = (page, times) => page.evaluate((times) => {
  const t = __mstest, W = t.W, H = t.H, g = t.gray, o = new Uint8Array(g.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = g[y * W + (W - 1 - x)];
  t.gray = o;
  for (let i = 0; i < times; i++) t.segment();
  t.render();
}, times);
const markers = (page, zone) => page.evaluate((zone) => { const t = __mstest, o = {}; for (const l in t.assignData.assign) if (zone == null || t.zoneOf(+l) === zone) o[l] = t.assignData.assign[l].mkey; return o; }, zone);
const changed = (a, b) => Object.keys(a).filter((l) => a[l] !== b[l]).length;

test('sections found again twice before Build guide: the zones land where once puts them', async () => {
  const runs = [];
  for (const times of [1, 2]) {
    const { page, errors } = await openApp();
    await sampleGuide(page); await idle(page);
    await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
    await page.click('#sfBack2'); await idle(page);
    await flipAndDetect(page, times);
    await buildGo(page); await idle(page);
    const placed = await zoneSecsAll(page);
    assert.equal(placed.length, 1); assert.ok(placed[0].length, 'the zone kept sections');
    runs.push(placed);
    assert.deepEqual(errors, []);
    await page.close();
  }
  assert.deepEqual(runs[1], runs[0], 'twice places the zone as once does');
});

test('Undo in Edit sections after sections were found again brings back the zones as they were', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await idle(page);
  await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
  const orig = await zoneSecsAll(page);
  await page.click('#sfBack2'); await idle(page);
  // the greys flipped, then Enhance finds the sections again the usual way (an Undo step kept first)
  await flipAndDetect(page, 0);
  await page.click('#sfAdjToggle'); await idle(page);
  await page.click('#sfEnh'); await idle(page, 2000);
  await buildGo(page); await idle(page);
  assert.notDeepEqual(await zoneSecsAll(page), orig, 'the zone is on the new sections');
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfPlanUndo'); await idle(page, 2000);
  await buildGo(page); await idle(page);
  assert.deepEqual(await zoneSecsAll(page), orig);
  assert.deepEqual(errors, []);
});

test('turning the picture clears the zones and says so; Undo in Edit sections brings them back', async () => {
  const { page, errors } = await openApp();
  await answerAsks(page);
  await sampleGuide(page); await idle(page);
  await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
  const orig = await zoneSecsAll(page);
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfAdjToggle'); await idle(page);
  await page.click('#sfRotR'); await idle(page, 3000);
  await buildGo(page); await idle(page);
  assert.match(await page.textContent('#msToast'), /zones were cleared: turning, straightening or cropping/);
  assert.equal((await zoneSecsAll(page)).length, 0);
  await page.click('#sfBack2'); await idle(page);
  await page.click('#sfPlanUndo'); await idle(page, 3000);
  await buildGo(page); await idle(page);
  assert.deepEqual(await zoneSecsAll(page), orig);
  assert.deepEqual(await page.evaluate(() => __mstest.zones.map((z) => z.name)), ['Bell']);
  assert.deepEqual(errors, []);
});

test('section edits kept while the page is hidden, after sections were found again: the zones are saved on the new sections', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
  await page.click('#sfBack2'); await idle(page);
  await flipAndDetect(page, 1);
  const saved = await page.evaluate(() => { const d = __mstest.currentDesignObj(false, true); window.__d = Object.assign({}, d.payload, { name: d.name, W: d.W, H: d.H }); return d.payload.zones[0].secs; });
  // where Build guide puts them
  await buildGo(page); await idle(page);
  assert.deepEqual(saved, (await zoneSecsAll(page))[0]);
  // and opened again (Resume), then built: the same
  await page.evaluate(() => __mstest.openDesignObj(window.__d, null, true));
  await page.waitForFunction(() => __mstest.labels && __mstest.zones.length); await idle(page);
  await buildGo(page); await idle(page);
  assert.deepEqual((await zoneSecsAll(page))[0], saved);
  assert.deepEqual(errors, []);
});

test('Build guide with no section edits leaves a white section of Main in Main', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfZoneAdd'); await idle(page);
  // a zone round one section, which the pattern left white (as the Photo pattern's white areas are)
  const r = await page.evaluate(() => {
    const t = __mstest, zid = t.zoneCur, l = Object.keys(t.assignData.assign).map(Number).sort((a, b) => t.comps[b].area - t.comps[a].area)[20];
    const around = t.countedList().filter((x) => x !== l && Math.hypot(t.comps[x].cx - t.comps[l].cx, t.comps[x].cy - t.comps[l].cy) < t.W * 0.4);
    t.zoneMove(around, zid); t.reassign([0, zid]);
    const a = t.assignData; delete a.assign[l]; delete a.base[l]; a.order = a.order.filter((x) => x !== l); a.N = a.order.length; a.paper = { [l]: 1 };
    return { l };
  });
  await page.click('#sfZoneDone'); await idle(page);
  await page.click('#sfBack2'); await idle(page);
  await buildGo(page); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.zoneOf(l), r.l), 0);
  assert.deepEqual(errors, []);
});

test('a tap in the zone editor doesn\'t roll a Random Main (or the Random zone) again', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page);
  const [a, b, c] = await bigSecs(page, 3, 'top');
  await makeZone(page, [a, b], 'Bell');
  const m0 = await markers(page, 0), z0 = await markers(page, (await page.evaluate(() => __mstest.zoneCur)));
  await page.click('#sfPanel-pattern .sfzchip.on'); await idle(page);
  await tapSec(page, c);
  await page.click('#sfZoneDone'); await idle(page);
  const m1 = await markers(page, 0), z1 = await markers(page, (await page.evaluate(() => __mstest.zoneCur)));
  assert.equal(changed(m1, m0), 0, 'Main\'s sections keep their markers');
  assert.equal(changed(z0, z1), 0, 'the zone\'s own sections keep theirs (Random, as it was: a copy of Main\'s settings)');
  assert.ok(z1[c], 'the section added has a marker');
  assert.deepEqual(errors, []);
});

test('the markers you can use: after reopening, a filter change lays every zone again; after Undo of one, a change to one zone keeps the others', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page);
  await makeZone(page, await bigSecs(page, 6, 'top'), 'Bell');
  await page.click('#sfShape [data-v="radial"]').catch(() => {});
  await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]'); await idle(page);
  // leave out the family of a marker Bell uses, with Main chosen: Bell's sections don't keep it
  const r = await page.evaluate(() => {
    const t = __mstest, zid = t.zones[0].id, a = t.assignData.assign;
    const k = Object.keys(a).filter((l) => t.zoneOf(+l) === zid).map((l) => a[l].mkey)[0];
    const i = COLORS.findIndex((c, i) => mkey(i) === k);
    state.excluded.add(COLORS[i].fam); save(); SF.setCollection(sfCollection()); t.reassign();
    const b = t.assignData.assign;
    return { k, still: Object.keys(b).filter((l) => b[l].mkey === k).length };
  });
  assert.equal(r.still, 0, 'no section keeps a marker left out');
  // Undo that, then a change to Bell only: Main (Random) keeps its markers
  await page.click('#sfPlanUndo'); await idle(page);
  const m0 = await markers(page, 0);
  await page.click(`#sfPanel-pattern .sfzchip[data-z="${await page.evaluate(() => __mstest.zones[0].id)}"]`); await idle(page);
  await page.click('#sfShape [data-v="vertical"]'); await idle(page);
  assert.equal(changed(await markers(page, 0), m0), 0, 'Main keeps its colours');
  assert.deepEqual(errors, []);
});

test('zone by zone: focus mode\'s Mark all done and Section x of y are the zone\'s; the Done group keeps its rows, naming their zone', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await makeZone(page, await bigSecs(page, 12, 'top'), 'Bell');
  const zid = await page.evaluate(() => __mstest.zoneCur);
  // a marker in both Main and Bell
  const mk = await page.evaluate(() => { const t = __mstest, by = {}; t.assignData.order.forEach((l) => { const k = t.assignData.assign[l].mkey; (by[k] = by[k] || new Set()).add(t.zoneOf(l)); }); return Object.keys(by).find((k) => by[k].size > 1); });
  assert.ok(mk, 'a marker in both zones');
  const nMain = await page.evaluate((mk) => __mstest.assignData.order.filter((l) => __mstest.assignData.assign[l].mkey === mk && __mstest.zoneOf(l) === 0).length, mk);
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfAlOrder [data-v="zones"]'); await idle(page);
  await page.locator(`#sfAlist .sfarow[data-k="${mk}@0"] .sfah`).click(); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  assert.match(await page.textContent('#sfFocSub'), new RegExp('Section 1 of ' + nMain + '\\b'));
  await page.click('#sfFocCols'); await idle(page);
  await page.click('#sfFocAll'); await idle(page);
  const t = await page.evaluate(([mk, zid]) => { const s = __mstest, r = { main: 0, bell: 0 }; s.assignData.order.forEach((l) => { if (s.assignData.assign[l].mkey === mk && s.colored[l]) r[s.zoneOf(l) === zid ? 'bell' : 'main']++; }); return r; }, [mk, zid]);
  assert.deepEqual(t, { main: nMain, bell: 0 }, 'only Main\'s are ticked');
  await page.click('#sfExitFoc'); await idle(page);
  // Whole picture and back: the Done group is still there, and its rows say their zone
  await page.click('#sfAlOrder [data-v="whole"]'); await idle(page);
  await page.click('#sfAlOrder [data-v="zones"]'); await idle(page);
  assert.ok(await page.$('#sfDoneGrp'), 'the Done group');
  await page.click('#sfDoneGrp'); await idle(page);
  assert.match(await page.textContent(`#sfAlist .sfarow[data-k="${mk}@0"]`), /· Main/);
  assert.deepEqual(errors, []);
});

test('Undo labels: a section taken from another zone is "added" to the one being edited; an empty zone renamed and dropped leaves no step', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const [a, b] = await bigSecs(page, 2, 'top');
  await makeZone(page, [a], 'Bell');
  await makeZone(page, [b], 'Foot');
  const n0 = await page.evaluate(() => __mstest.planCount);
  await page.click('#sfPanel-pattern .sfzchip.on'); await idle(page);
  await tapSec(page, a);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Foot: 1 section added');
  await page.click('#sfZoneDone'); await idle(page);
  const n1 = await page.evaluate(() => __mstest.planCount), lab = await page.getAttribute('#sfPlanUndo', 'aria-label');
  // ＋, a name, Done: dropped, and no step for it
  await page.click('#sfPanel-pattern .sfzchip.sfzadd'); await idle(page);
  await page.fill('#sfZoneName', 'Hat'); await page.press('#sfZoneName', 'Enter'); await idle(page);
  await page.click('#sfZoneDone'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.planCount), n1);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), lab);
  assert.deepEqual(await page.evaluate(() => __mstest.zones.map((z) => z.name)), ['Bell', 'Foot']);
  assert.ok(n1 > n0);
  assert.deepEqual(errors, []);
});
