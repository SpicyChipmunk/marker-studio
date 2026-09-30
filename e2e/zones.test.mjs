// Zones (v279): parts of the picture with their own pattern and colours. ＋ Zone opens the zone editor (tap or drag
// across sections to add them, start on one in the zone to take them out); the chips at the top of Pattern and
// Colours choose which zone those tabs edit. Main holds the rest. Shading, texture and the photo are the whole
// guide's. Zones are saved with the guide, taken back by Undo, follow section edits, and Colour along can go zone by
// zone.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

const Z = (page) => page.evaluate(() => ({ cur: __mstest.zoneCur, edit: __mstest.zoneEdit, list: __mstest.zones.map((z) => ({ id: z.id, name: z.name, n: Object.keys(z.secs).length })) }));
const assignOf = (page) => page.evaluate(() => { const a = __mstest.assignData.assign, o = {}; for (const l in a) o[l] = a[l].mkey; return o; });
const zoneOfAll = (page) => page.evaluate(() => { const o = {}; for (const l in __mstest.assignData.assign) o[l] = __mstest.zoneOf(+l); return o; });
const undoLabel = (page) => page.getAttribute('#sfPlanUndo', 'aria-label');
// the n biggest sections whose middle is in the top (or bottom) part of the picture
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
// ＋ Zone (or ＋ among the chips), then tap these sections, then Done
async function makeZone(page, secs, name) {
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
  else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
  await idle(page);
  if (name) { await page.fill('#sfZoneName', name); await page.press('#sfZoneName', 'Enter'); await idle(page); }
  for (const l of secs) await tapSec(page, l);
  await page.click('#sfZoneDone'); await idle(page);
}

test('＋ Zone: the editor, taps add and take out sections (one Undo step each), the picture shows the zone, Done shows the chips', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.ok(await page.isVisible('#sfZoneAdd'), '＋ Zone beside Colour pattern');
  assert.equal(await page.$('.sfzrow'), null, 'no chips without zones');
  await page.click('#sfZoneAdd'); await idle(page);
  let z = await Z(page);
  assert.equal(z.edit, true); assert.equal(z.list.length, 1); assert.equal(z.cur, z.list[0].id); assert.equal(z.list[0].name, 'Zone 1');
  assert.equal(await page.inputValue('#sfZoneName'), 'Zone 1');
  assert.match(await page.textContent('#sfZoneN'), /No sections yet/);
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'sfZoneName', 'a click leaves the name field alone');
  assert.equal(await page.$('#sfFam'), null, 'the editor takes the Pattern tab\'s place');
  assert.equal(await page.evaluate(() => __mstest.planCount), 0, 'opening the editor is no change yet');
  // a finger on the picture adds sections instead of scrolling the page (as Paint does)
  assert.equal(await page.evaluate(() => document.getElementById('sfPicBox').style.touchAction), 'none');
  // every section faded while the zone has none
  const faded = () => page.evaluate(() => { const c = document.getElementById('sfCanvas'), g = c.getContext('2d'), t = __mstest; let f = 0, n = 0; for (const l in t.assignData.assign) { const p = t.labelPos(+l); const k = c.width / t.W, d = g.getImageData(Math.round(p.x * k), Math.round(p.y * k), 1, 1).data; n++; if (d[0] + d[1] + d[2] > 3 * 205) f++; } return f / n; });
  assert.ok(await faded(page) > 0.9, 'the picture fades the sections not in the zone');
  const [a, b, c] = await bigSecs(page, 3, 'top');
  await tapSec(page, a);
  z = await Z(page);
  assert.equal(z.list[0].n, 1);
  assert.equal(await page.evaluate((a) => __mstest.zoneOf(a), a), z.cur);
  assert.match(await page.textContent('#sfZoneN'), /1 section in Zone 1/);
  assert.equal(await undoLabel(page), 'Undo: Zone 1: 1 section added');
  await tapSec(page, b); await tapSec(page, c);
  assert.equal((await Z(page)).list[0].n, 3);
  assert.equal(await undoLabel(page), 'Undo: Zone 1: 1 section added');
  // a tap on one already in it takes it out
  await tapSec(page, b);
  assert.equal((await Z(page)).list[0].n, 2);
  assert.equal(await page.evaluate((b) => __mstest.zoneOf(b), b), 0, 'back in Main');
  assert.equal(await undoLabel(page), 'Undo: Zone 1: 1 section taken out');
  await page.click('#sfPlanUndo'); await idle(page);
  assert.equal((await Z(page)).list[0].n, 3, 'Undo puts it back in the zone');
  // Done: chips, the zone's on (with ✎), Main first
  await page.click('#sfZoneDone'); await idle(page);
  z = await Z(page);
  assert.equal(z.edit, false);
  assert.equal(await page.evaluate(() => document.getElementById('sfPicBox').style.touchAction), 'pan-y', 'the page scrolls under a finger again');
  const chips = await page.$$eval('#sfPanel-pattern .sfzchip', (bs) => bs.map((b) => [b.dataset.z, b.textContent, b.getAttribute('aria-pressed')]));
  assert.deepEqual(chips, [['0', 'Main', 'false'], [String(z.cur), 'Zone 1✎', 'true'], ['new', '＋', null]]);
  assert.ok(await page.isVisible('#sfFam'), 'the Pattern tab again, now for the zone');
  assert.ok(await page.$('#sfPanel-colours .sfzrow'), 'Colours has the chips too');
  assert.equal(await page.$('#sfPanel-shading .sfzrow'), null, 'Shading is off here, so no chips there (with it on, each zone has its own shading: zones-shading.test.mjs)');
  // Enter on the chip that's on opens the editor with the name field focused; by touch or mouse it isn't (a phone's
  // keyboard would come up over the picture)
  await page.focus('#sfPanel-pattern .sfzchip.on'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal((await Z(page)).edit, true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfZoneName');
  await page.click('#sfZoneDone'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('sfzchip')), true, 'Done puts the focus back on the chip');
  await page.click('#sfPanel-pattern .sfzchip.on'); await idle(page);
  assert.equal((await Z(page)).edit, true);
  assert.notEqual(await page.evaluate(() => document.activeElement.id), 'sfZoneName');
  assert.deepEqual(errors, []);
});

test('a zone\'s own pattern changes only its sections; Main (even Random) keeps its colours; the chips switch what the tabs edit', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // Main as Random first
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]'); await idle(page);
  await makeZone(page, await bigSecs(page, 4, 'top'), 'Bell');
  const zid = (await Z(page)).cur, zo = await zoneOfAll(page), before = await assignOf(page);
  // the new zone starts with the settings Main had
  assert.equal(await page.getAttribute('#sfFam [data-v="random"]', 'aria-pressed'), 'true');
  await page.click('#sfFam [data-v="gradient"]'); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Bell: Pattern: Gradient');
  const after1 = await assignOf(page);
  for (const l in before) if (zo[l] === 0) assert.equal(after1[l], before[l], `Main section ${l} kept its marker`);
  await page.click('#sfShape [data-v="radial"]'); await idle(page);
  const after2 = await assignOf(page);
  for (const l in before) if (zo[l] === 0) assert.equal(after2[l], before[l], `Main section ${l} still kept its marker`);
  // Main's chip: the tabs show Main's settings (Random), and it's Main's pattern that changes
  const n0 = await page.evaluate(() => __mstest.planCount);
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]'); await idle(page);
  assert.equal((await Z(page)).cur, 0);
  assert.equal(await page.getAttribute('#sfFam [data-v="random"]', 'aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => __mstest.planCount), n0, 'switching zones is no change');
  assert.equal(await page.evaluate(() => { const a = document.activeElement; return a.dataset.z + ' ' + !!a.closest('#sfPanel-pattern'); }), '0 true', 'the focus stays on the chip chosen');
  await page.click('#sfFam [data-v="blend"]'); await idle(page);
  assert.equal(await undoLabel(page), 'Undo: Main: Pattern: Blend');
  const after3 = await assignOf(page);
  for (const l in before) if (zo[l] === zid) assert.equal(after3[l], after2[l], `Bell section ${l} kept its marker`);
  // back to Bell: its Radial gradient is there; Colours says "this zone"
  await page.click('#sfPanel-pattern .sfzchip[data-z="' + zid + '"]'); await idle(page);
  assert.equal(await page.getAttribute('#sfShape [data-v="radial"]', 'aria-pressed'), 'true');
  await page.click('.sftabbtn[data-t="colours"]'); await idle(page);
  assert.match(await page.textContent('#sfPanel-colours .sfmkcount'), /Markers in this zone/);
  assert.equal(await page.getAttribute('#sfPanel-colours .sfzchip.on', 'data-z'), String(zid));
  assert.deepEqual(errors, []);
});

test('a gradient in a zone runs over the zone itself (Radial starts from the zone\'s own middle)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const secs = await bigSecs(page, 8, 'bottom');
  await makeZone(page, secs, 'Foot');
  await page.click('#sfShape [data-v="radial"]'); await page.click('#sfLook [data-v="smooth"]'); await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest, z = t.zoneCur, secs = t.zoneSecs(z);
    // the zone's flow, first section first (by distance from the middle of the zone's box)
    const first = t.assignData.order.filter((l) => t.zoneOf(l) === z)[0];
    return { first, firstKey: t.assignData.assign[first].mkey, start: t.gradStartInfo().cols[0].mkey, n: secs.length };
  });
  assert.equal(r.n, secs.length);
  assert.equal(r.firstKey, r.start, 'the zone\'s flow starts with its own start colour at its own middle');
  // and that first section is the one nearest the middle of the zone's box, not of the picture
  const near = await page.evaluate(() => {
    const t = __mstest, secs = t.zoneSecs(t.zoneCur);
    const B = (() => { const b = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 }; for (let p = 0; p < t.W * t.H; p++) { const l = t.labels[p]; if (secs.indexOf(l) >= 0) { const x = p % t.W, y = (p / t.W) | 0; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; } } return b; })();
    const mx = (B.x0 + B.x1 + 1) / 2, my = (B.y0 + B.y1 + 1) / 2;
    return secs.slice().sort((a, b) => Math.hypot(t.comps[a].cx - mx, t.comps[a].cy - my) - Math.hypot(t.comps[b].cx - mx, t.comps[b].cy - my))[0];
  });
  assert.equal(r.first, near);
  assert.deepEqual(errors, []);
});

test('rename, delete (sections back to Main) and Undo; an empty new zone is dropped at Done; Escape closes the editor', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const secs = await bigSecs(page, 2, 'top');
  await makeZone(page, secs);
  const zid = (await Z(page)).cur;
  await page.click('#sfPanel-pattern .sfzchip.on'); await idle(page);
  assert.equal((await Z(page)).edit, true, 'the chip that\'s on opens the editor');
  await page.fill('#sfZoneName', '  Bell  '); await page.press('#sfZoneName', 'Enter'); await idle(page);
  assert.equal((await Z(page)).list[0].name, 'Bell');
  assert.equal(await undoLabel(page), 'Undo: Zone renamed: Bell');
  // Escape in the name field puts the name back; Escape outside it closes the editor
  await page.fill('#sfZoneName', 'Nope'); await page.press('#sfZoneName', 'Escape'); await idle(page);
  assert.equal(await page.inputValue('#sfZoneName'), 'Bell');
  assert.equal((await Z(page)).edit, true);
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal((await Z(page)).edit, false, 'Escape closes the editor');
  // delete: its sections go back to Main; Undo brings the zone back with them
  await page.click('#sfPanel-pattern .sfzchip.on'); await idle(page);
  await page.click('#sfZoneDel'); await idle(page);
  let z = await Z(page);
  assert.deepEqual(z.list, []); assert.equal(z.cur, 0);
  assert.equal(await page.$('.sfzrow'), null);
  assert.equal(await undoLabel(page), 'Undo: Zone deleted: Bell');
  await page.click('#sfPlanUndo'); await idle(page);
  z = await Z(page);
  assert.deepEqual(z.list.map((x) => [x.id, x.name, x.n]), [[zid, 'Bell', 2]]);
  // a new zone given no sections goes at Done, and leaves no Undo step
  const steps = await page.evaluate(() => __mstest.planCount);
  await page.click('#sfPanel-pattern .sfzchip.sfzadd'); await idle(page);
  assert.equal((await Z(page)).list.length, 2);
  await page.click('#sfZoneDone'); await idle(page);
  assert.equal((await Z(page)).list.length, 1, 'the empty zone is dropped');
  assert.equal(await page.evaluate(() => __mstest.planCount), steps);
  // another tab closes the editor too
  await page.click('#sfPanel-pattern .sfzchip.on'); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await idle(page);
  assert.equal((await Z(page)).edit, false);
  assert.deepEqual(errors, []);
});

test('a drag across sections adds them all as one step; starting on one in the zone takes them out', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfZoneAdd'); await idle(page);
  await scrollTop(page);
  const c = await page.evaluate(() => { const r = document.getElementById('sfCanvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const drag = async (y) => { await page.mouse.move(c.x + c.w * 0.1, c.y + c.h * y); await page.mouse.down(); for (let i = 1; i <= 24; i++) await page.mouse.move(c.x + c.w * (0.1 + 0.8 * i / 24), c.y + c.h * y); await page.mouse.up(); await idle(page); };
  await drag(0.55);
  const n1 = (await Z(page)).list[0].n, steps = await page.evaluate(() => __mstest.planCount);
  assert.ok(n1 >= 3, `a drag across the picture added several (${n1})`);
  assert.equal(steps, 1, 'one step for the whole drag');
  // the same line again, starting on a section in the zone: all of them out
  await drag(0.55);
  assert.equal((await Z(page)).list[0].n, 0, 'taken out again');
  assert.deepEqual(errors, []);
});

test('zones are saved with the guide and open again as they were (Main\'s settings stay the guide\'s style, for older copies)', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await makeZone(page, await bigSecs(page, 3, 'top'), 'Bell');
  await page.click('#sfFam [data-v="random"]'); await idle(page);
  const zid = (await Z(page)).cur, before = await assignOf(page), zo = await zoneOfAll(page);
  const d = await page.evaluate(() => __mstest.currentDesignObj());
  assert.equal(d.payload.style.family, 'gradient', 'the guide\'s style is Main\'s, though Bell is being edited');
  assert.equal(d.payload.zones.length, 1);
  assert.equal(d.payload.zones[0].name, 'Bell');
  assert.equal(d.payload.zones[0].style.family, 'random');
  assert.equal(d.payload.zones[0].secs.length, 3);
  // saved in the Library, reopened after a reload
  await page.click('#sfSave'); await page.waitForFunction(() => /Saved in your Library/.test(document.getElementById('sfSaveSt').textContent));
  const id = await page.evaluate(() => __mstest.curId);
  await page.reload(); await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id); await idle(page);
  const z = await Z(page);
  assert.equal(z.cur, 0, 'opens on Main');
  assert.deepEqual(z.list.map((x) => [x.name, x.n]), [['Bell', 3]]);
  assert.deepEqual(await assignOf(page), before, 'every section\'s marker as saved');
  const zo2 = await zoneOfAll(page);
  for (const l in zo) assert.equal(zo2[l] !== 0, zo[l] !== 0, `section ${l} in the same zone`);
  assert.equal(await page.evaluate(() => __mstest.zoneRec(__mstest.zones[0].id).st.family), 'random');
  void zid;
  assert.deepEqual(errors, []);
});

test('a tapped section\'s tip says its zone, and "Edit this zone" goes to it', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const secs = await bigSecs(page, 2, 'top');
  await makeZone(page, secs, 'Bell');
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]'); await idle(page);
  await tapSec(page, secs[0]);
  assert.match(await page.textContent('.sftip'), /Zone: Bell/);
  await page.click('.sftip [data-a="zone"]'); await idle(page);
  assert.equal((await Z(page)).cur, (await Z(page)).list[0].id);
  assert.equal(await page.getAttribute('#sfPanel-pattern .sfzchip.on', 'data-z'), String((await Z(page)).list[0].id));
  assert.deepEqual(errors, []);
});

test('Blend in a zone: its anchors are its own, seeded inside it; a tap in another zone says where that is', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const secs = await bigSecs(page, 6, 'bottom');
  await makeZone(page, secs, 'Foot');
  await page.click('#sfFam [data-v="blend"]'); await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest, B = { y0: 1e9 };
    t.zoneSecs(t.zoneCur).forEach((l) => { B.y0 = Math.min(B.y0, t.comps[l].cy); });
    return { anchors: t.zoneRec(t.zoneCur).an.length, main: t.zoneRec(0).an.length, minY: B.y0, ay: t.zoneRec(t.zoneCur).an.map((a) => a.y) };
  });
  assert.equal(r.anchors, 3); assert.equal(r.main, 0, 'Main (a Gradient) has none');
  assert.ok(r.ay.every((y) => y > r.minY - 200), 'the anchors are in the zone\'s part of the picture');
  // a tap on a section in Main
  const [top] = await bigSecs(page, 1, 'top');
  await tapSec(page, top);
  assert.match(await page.textContent('#msToast'), /That section is in Main/);
  assert.equal(await page.evaluate(() => __mstest.zoneRec(__mstest.zoneCur).an.length), 3, 'no anchor added');
  assert.deepEqual(errors, []);
});

test('Edit sections: a zone keeps its sections through leaving one out and bringing it back', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const secs = await bigSecs(page, 3, 'top');
  await makeZone(page, secs, 'Bell');
  const zid = (await Z(page)).cur;
  await page.click('#sfBack2'); await idle(page);
  // leave one out, build, then bring it back, build
  await page.evaluate((l) => { __mstest.secState[l] = 2; }, secs[1]);
  await page.click('#sfBuild'); await idle(page);
  assert.equal(await page.evaluate((l) => !!__mstest.assignData.assign[l], secs[1]), false);
  assert.deepEqual(await page.evaluate(() => __mstest.zoneSecs(__mstest.zones[0].id)).then((a) => a.sort()), [secs[0], secs[2]].sort());
  await page.click('#sfBack2'); await idle(page);
  await page.evaluate((l) => { __mstest.secState[l] = 0; }, secs[1]);
  await page.click('#sfBuild'); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.zoneOf(l), secs[1]), zid, 'back in its zone');
  assert.deepEqual(errors, []);
});

test('Colour along zone by zone: each zone\'s markers under its name; a row lights, ticks and finds only its zone\'s sections; focus mode goes zone by zone', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const secs = await bigSecs(page, 5, 'top');
  await makeZone(page, secs, 'Bell');
  // the zone uses Main's markers too (same Gradient settings), so a marker is likely in both
  await page.click('#sfColor'); await idle(page);
  assert.ok(await page.isVisible('#sfAlOrder'), 'the choice shows with zones');
  assert.equal(await page.getAttribute('#sfAlOrder [data-v="whole"]', 'aria-pressed'), 'true');
  const wholeRows = await page.$$eval('#sfAlist .sfarow', (r) => r.length);
  await page.click('#sfAlOrder [data-v="zones"]'); await idle(page);
  const heads = await page.$$eval('#sfAlist .sfazh b', (b) => b.map((x) => x.textContent));
  assert.deepEqual(heads, ['Main', 'Bell']);
  const rows = await page.$$eval('#sfAlist .sfarow', (r) => r.map((x) => x.dataset.k));
  assert.ok(rows.length >= wholeRows, 'a marker in two zones has a row in each');
  assert.ok(rows.every((k) => /@\d+$/.test(k)));
  // open Bell's first row: only Bell's sections of that marker are lit, ticked by Mark all done
  const zid = await page.evaluate(() => __mstest.zones[0].id);
  const i = rows.findIndex((k) => k.endsWith('@' + zid));
  await page.locator('#sfAlist .sfarow .sfah').nth(i).click(); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.hlZone), zid);
  const k = rows[i].split('@')[0];
  const path = await page.evaluate(() => __mstest.hlPath());
  assert.ok(path.length >= 1);
  assert.ok(await page.evaluate(([p, zid]) => p.every((l) => __mstest.zoneOf(l) === zid), [path, zid]), 'Find next stays in the zone');
  await page.click('#sfMarkAll'); await idle(page);
  const ticked = await page.evaluate(([k, zid]) => { const t = __mstest, a = t.assignData.assign; let inZ = 0, out = 0; for (const l in a) if (a[l].mkey === k) { if (t.colored[l]) (t.zoneOf(+l) === zid ? inZ++ : out++); } return { inZ, out }; }, [k, zid]);
  assert.ok(ticked.inZ >= 1); assert.equal(ticked.out, 0, 'Mark all done ticks only the zone\'s sections');
  // focus mode: zone by zone, Main first
  await page.click('#sfFocus'); await idle(page);
  const z1 = await page.evaluate(() => { const t = __mstest; return t.focusOrd.map((l) => t.zoneOf(l)); });
  const firstBell = z1.indexOf(zid), lastMain = z1.lastIndexOf(0);
  assert.ok(firstBell > lastMain, 'all of Main before Bell');
  assert.deepEqual(errors, []);
});

test('with zones, Pattern, Colours and Shading fit in about one and a half screens of room at 390×844 besides their row of chips (and Shading’s “Shade Bell”)', notOnWebKit(WK.font), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="shading"]'); await page.click('#sfShade [data-v="full"]'); await idle(page);
  await makeZone(page, await bigSecs(page, 2, 'top'), 'Bell');
  // (as tabs.test.mjs measures: the helper lines already seen, the tabs pinned under the picture at its floor size)
  await page.evaluate(() => document.querySelectorAll('.sfinfo.open').forEach((b) => b.click()));
  for (const tb of ['colours', 'pattern', 'shading']) {
    await page.click(`.sftabbtn[data-t="${tb}"]`); await idle(page);
    await page.evaluate(() => new Promise((r) => { const t = document.querySelector('.sftabs'), s = document.querySelector('.sftabsen'), cs = getComputedStyle(t); scrollTo(0, Math.round(scrollY + s.getBoundingClientRect().top + parseFloat(cs.marginTop) - parseFloat(cs.top))); requestAnimationFrame(() => requestAnimationFrame(r)); }));
    await idle(page);
    // (the row of chips is extra room zones take, one 40px row of tap targets: the rest still fits as before)
    // (Shading's "Shade Bell" line is extra too: v281)
    const m = await page.evaluate((s) => { const h = (e) => (e ? e.getBoundingClientRect().height + parseFloat(getComputedStyle(e).marginTop) + parseFloat(getComputedStyle(e).marginBottom) : 0), r = document.querySelector(s + ' .sfzrow'); return { h: document.querySelector(s).scrollHeight, chips: h(r), shade: h(document.querySelector(s + ' .sfzshade')), room: parseFloat(getComputedStyle(document.getElementById('sfWork')).getPropertyValue('--tabMin')), info: document.querySelectorAll(s + ' button.sfinfo:not(.open)').length }; }, `.sftab[data-tab="${tb}"]`);
    assert.ok(m.chips > 0 && m.chips <= 64, `${tb}: the chips take one row (${m.chips}px)`);
    assert.ok(tb !== 'shading' || (m.shade > 0 && m.shade <= 40), `shading: "Shade Bell" is one line (${m.shade}px)`);
    assert.ok(m.h - m.chips - m.shade <= m.room * 1.5 + 2 + 16 * m.info, `${tb}: ${m.h}px (${m.chips}px of chips, ${m.shade}px of Shade Bell) against ${m.room}px of room`);
  }
  assert.deepEqual(errors, []);
});

test('sections found again (Enhance in Edit sections): each joins the zone most of its pixels were in', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const secs = await bigSecs(page, 4, 'top');
  await makeZone(page, secs, 'Bell');
  // where the zone's sections are (their middles), to find them again after the sections are found afresh
  const pts = await page.evaluate((secs) => secs.map((l) => { const p = __mstest.labelPos(l); return [Math.round(p.x), Math.round(p.y)]; }), secs);
  await page.click('#sfBack2'); await idle(page);
  page.on('dialog', (d) => d.accept());
  await page.click('#sfAdjToggle'); await idle(page);
  await page.click('#sfEnh'); await idle(page, 2000);
  await page.click('#sfBuild'); await idle(page);
  const r = await page.evaluate((pts) => { const t = __mstest; return pts.map(([x, y]) => { const l = t.labels[y * t.W + x]; return l > 0 ? t.zoneOf(l) : -1; }); }, pts);
  const zid = (await Z(page)).list[0] && (await Z(page)).list[0].id;
  assert.ok(zid, 'the zone is still there');
  assert.ok(r.filter((z) => z === zid).length >= 3, `the zone's parts are in it again (${r})`);
  assert.deepEqual(errors, []);
});

test('a zone with the Photo pattern takes its colours from the one photo; Main keeps its pattern; the photo is kept in a shared guide file', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await makeZone(page, await bigSecs(page, 6, 'bottom'), 'Foot');
  const zo = await zoneOfAll(page), before = await assignOf(page);
  // a two-colour photo: blue on top, red below
  const b64 = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#2350c8'; g.fillRect(0, 0, 600, 400); g.fillStyle = '#d0282c'; g.fillRect(0, 400, 600, 400); const blob = await new Promise((r) => c.toBlob(r, 'image/png')); return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(blob); }); });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking); await idle(page);
  // stretched over the picture: the foot (the bottom of the picture) is under the red half
  await page.evaluate(() => { const M = __mstest, r = M.photoRef; M.photoXf = { cx: M.W / 2, cy: M.H / 2, sx: M.W / r.w, sy: M.H / r.h, r: 0 }; M.photoRecolour(); });
  await idle(page);
  const after = await assignOf(page);
  const reds = await page.evaluate((zo) => { const t = __mstest, a = t.assignData.assign; let red = 0, n = 0; for (const l in a) if (zo[l] !== 0) { n++; const L = a[l].lab; if (L && L[1] > 25) red++; } return { red, n }; }, zo);
  assert.ok(reds.red >= reds.n - 1, `the foot's sections are red (${reds.red} of ${reds.n})`);
  for (const l in before) if (zo[l] === 0) assert.equal(after[l], before[l], `Main section ${l} kept its marker`);
  const d = await page.evaluate(() => __mstest.currentDesignObj(true));
  assert.ok(d.payload.ref, 'a shared guide file keeps the photo a zone uses');
  assert.equal(d.payload.style.family, 'gradient', 'Main is still a Gradient');
  assert.equal(d.payload.zones[0].style.family, 'photo');
  assert.deepEqual(errors, []);
});

test('a zone with no sections (Main, when every section is in a zone) says so, and every pattern still builds', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await makeZone(page, await bigSecs(page, 2, 'top'), 'Bell');
  const zid = (await Z(page)).cur;
  assert.equal(await page.$('#sfPanel-pattern .sfznone'), null, 'no note while the zone has sections');
  await page.evaluate((id) => { const t = __mstest; t.zoneMove(t.zoneSecs(0), id); t.reassign(); }, zid);
  await idle(page);
  await page.click('#sfPanel-pattern .sfzchip[data-z="0"]'); await idle(page);
  assert.match(await page.textContent('#sfPanel-pattern .sfznone'), /Every section is in a zone, so Main has none to colour/);
  assert.match(await page.textContent('#sfPanel-colours .sfznone'), /Main has none/);
  for (const f of ['random', 'blend', 'manual', 'gradient']) { await page.click('#sfFam [data-v="' + f + '"]'); await idle(page); }
  await page.click('#sfShape [data-v="radial"]'); await idle(page);
  // Colour along zone by zone: no heading for Main
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfAlOrder [data-v="zones"]'); await idle(page);
  assert.deepEqual(await page.$$eval('.sfazh', (hs) => hs.map((h) => h.firstChild.textContent)), ['Bell']);
  await page.click('#sfAlOrder [data-v="whole"]'); await idle(page);
  await page.click('#sfDoneBtn'); await idle(page);
  // the zone's sections all back in Main: now it's the zone that says so
  await page.evaluate((id) => { const t = __mstest; t.zoneMove(t.zoneSecs(id), 0); t.reassign(); }, zid);
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click(`#sfPanel-pattern .sfzchip[data-z="${zid}"]`); await idle(page);
  assert.match(await page.textContent('#sfPanel-pattern .sfznone'), /No sections in Bell now: tap its chip to add some/);
  assert.deepEqual(errors, []);
});
