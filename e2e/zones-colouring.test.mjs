// Zones (v282): Paint and Manual change only the zone the tabs are editing; focus mode's Colours sheet has a chip for
// each marker in each zone when Colour along goes zone by zone; and a zone's sections can be chosen by keyboard.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, sectionPoint, idle, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

// a zone of the sections in the picture's bottom part (cy past `from` of its height), made in the editor and the
// sections moved in one go
async function bottomZone(page, name, from = 0.6) {
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
  else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
  await idle(page);
  await page.fill('#sfZoneName', name); await page.press('#sfZoneName', 'Enter');
  await page.evaluate((from) => { const t = __mstest, cl = Object.keys(t.assignData.assign).map(Number).filter((l) => t.comps[l].cy > t.H * from); t.zoneMove(cl, t.zoneCur); t.reassign([0, t.zoneCur]); }, from);
  await page.click('#sfZoneDone'); await idle(page);
  return page.evaluate(() => __mstest.zoneCur);
}
const assigns = (page) => page.evaluate(() => { const t = __mstest, o = {}; for (const l in t.assignData.assign) o[l] = t.assignData.assign[l].mkey; return o; });
const toastText = (page) => page.evaluate(() => { const t = document.getElementById('msToast'); return t ? t.textContent : ''; });

test('Paint in a zone colours only its sections, and says how many in other zones it left; Manual’s tap on another zone’s section gives its tip', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const zid = await bottomZone(page, 'Tail');
  await page.click('#sfFam [data-v="manual"]'); await idle(page);
  const before = await assigns(page);
  await page.click('#sfPaint'); await idle(page);
  const k = await page.evaluate(() => __mstest.paintKey);
  assert.ok(k);
  await scrollTop(page);
  // down the middle of the whole picture: through Main and Tail
  const c = await page.evaluate(() => document.getElementById('sfCanvas').getBoundingClientRect().toJSON());
  await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.05); await page.mouse.down();
  await page.mouse.move(c.x + c.width * 0.55, c.y + c.height * 0.95, { steps: 30 }); await page.mouse.up(); await idle(page);
  const after = await assigns(page);
  const zoneOf = await page.evaluate(() => { const t = __mstest, o = {}; for (const l in t.assignData.assign) o[l] = t.zoneOf(+l); return o; });
  const changed = Object.keys(after).filter((l) => after[l] !== before[l]);
  assert.ok(changed.length > 0, 'Tail’s sections painted');
  for (const l of changed) assert.equal(zoneOf[l], zid, 'section ' + l + ' is Tail’s');
  for (const l in before) if (zoneOf[l] === 0) assert.equal(after[l], before[l], 'Main’s section ' + l + ' left as it was');
  assert.match(await toastText(page), /^Painted Tail’s sections only: (one in another zone was left as it was|\d+ in other zones were left as they were)\.$/);
  assert.match(await page.getAttribute('#sfPlanUndo', 'aria-label'), /^Undo: Painted \d+ sections? with /);
  // a stroke only over Main's sections paints nothing, and says why
  await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.1); await page.mouse.down();
  await page.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.3, { steps: 10 }); await page.mouse.up(); await idle(page);
  assert.match(await toastText(page), /^Paint only colours Tail’s sections: (that one is in another zone|the \d+ you went over are in other zones)\.$/);
  await page.click('#sfPaint'); await idle(page);
  // Manual: a tap on one of Main's sections opens its tip (whose zone it is, and a way there), not Tail's picker
  const mainSec = await page.evaluate(() => { const t = __mstest; return Object.keys(t.assignData.assign).map(Number).filter((l) => t.zoneOf(l) === 0).sort((a, b) => t.comps[b].area - t.comps[a].area)[0]; });
  const p = await sectionPoint(page, mainSec);
  await page.mouse.click(p.x, p.y); await idle(page);
  assert.equal(await page.$('#sfSheet'), null, 'no marker picker');
  assert.match(await page.textContent('.sftipzone'), /Zone: Main/);
  assert.ok(await page.$('.sftipzb'), 'Edit this zone');
  // and one of Tail's opens the picker, as Manual does
  const tailSec = await page.evaluate((zid) => { const t = __mstest; return Object.keys(t.assignData.assign).map(Number).filter((l) => t.zoneOf(l) === zid).sort((a, b) => t.comps[b].area - t.comps[a].area)[0]; }, zid);
  await page.keyboard.press('Escape'); await idle(page);
  const q = await sectionPoint(page, tailSec);
  await page.mouse.click(q.x, q.y); await idle(page);
  assert.ok(await page.$('#sfSheet'), 'the marker picker');
  assert.deepEqual(errors, []);
});

test('focus mode zone by zone: the Colours sheet has a chip for each marker in each zone, naming it; a chip goes to that zone’s sections', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  const zid = await bottomZone(page, 'Tail', 0.5);
  // a marker in both zones
  const mk = await page.evaluate(() => { const t = __mstest, by = {}; t.assignData.order.forEach((l) => { const k = t.assignData.assign[l].mkey; (by[k] = by[k] || new Set()).add(t.zoneOf(l)); }); return Object.keys(by).find((k) => by[k].size > 1); });
  assert.ok(mk, 'a marker in Main and Tail');
  const pairs = await page.evaluate(() => { const t = __mstest, s = new Set(); t.assignData.order.forEach((l) => s.add(t.assignData.assign[l].mkey + '@' + t.zoneOf(l))); return s.size; });
  await page.click('#sfColor'); await idle(page);
  await page.click('#sfAlOrder [data-v="zones"]'); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFocCols'); await idle(page);
  const chips = await page.$$eval('#sfFocMk .focmk', (bs) => bs.map((b) => ({ k: b.dataset.k, z: b.querySelector('.fmz') ? b.querySelector('.fmz').textContent : null })));
  assert.equal(chips.length, pairs, 'one per marker per zone');
  assert.ok(chips.every((c) => c.z === 'Main' || c.z === 'Tail'));
  // Main's first, then Tail's
  const firstTail = chips.findIndex((c) => c.z === 'Tail');
  assert.ok(firstTail > 0 && chips.slice(firstTail).every((c) => c.z === 'Tail'));
  await page.click(`#sfFocMk .focmk[data-k="${mk}@${zid}"]`); await idle(page);
  const cur = await page.evaluate(() => { const t = __mstest, l = t.focusOrd[t.focusPos]; return { mk: t.assignData.assign[l].mkey, z: t.zoneOf(l) }; });
  assert.deepEqual(cur, { mk, z: zid });
  // the chip now open is the one lit
  await page.click('#sfFocCols'); await idle(page);
  assert.deepEqual(await page.$$eval('#sfFocMk .focmk.on', (bs) => bs.map((b) => b.dataset.k)), [mk + '@' + zid]);
  // the whole picture's order: one chip a marker, no zone names
  await page.click('#sfExitFoc'); await idle(page);
  await page.click('#sfAlOrder [data-v="whole"]'); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  await page.click('#sfFocCols'); await idle(page);
  const whole = await page.$$eval('#sfFocMk .focmk', (bs) => bs.map((b) => [b.dataset.k, !!b.querySelector('.fmz')]));
  assert.equal(whole.length, await page.evaluate(() => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size));
  assert.ok(whole.every((w) => !w[0].includes('@') && !w[1]));
  assert.deepEqual(errors, []);
});

test('a zone’s sections by keyboard: Tab to “Choose sections with the keys”, arrows move the ring, Space adds and takes out (one Undo step each), Escape back to the chip', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  assert.equal(await page.getAttribute('#sfCanvas', 'tabindex'), null, 'the picture takes no focus outside the editor');
  await page.focus('#sfZoneAdd'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfZoneName');
  await page.keyboard.type('Bell');
  // (out of sight until Tab reaches it)
  assert.ok((await page.$eval('#sfZoneKb', (b) => b.getBoundingClientRect().width)) <= 1);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfZoneKb');
  assert.ok((await page.$eval('#sfZoneKb', (b) => b.getBoundingClientRect().width)) > 100);
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfCanvas');
  assert.equal(await page.getAttribute('#sfCanvas', 'role'), 'application');
  assert.match(await page.getAttribute('#sfCanvas', 'aria-label'), /arrow keys go from section to section, Space adds one to Bell/);
  const live = () => page.textContent('#sfLive');
  const ring = () => page.evaluate(() => { const o = document.querySelector('.sfoutline'); return !!o && o.style.display !== 'none'; });
  assert.match(await live(page), /^[A-Z]+\d+ .+, in Main$/, 'what’s under the ring is said');
  assert.equal(await ring(), true);
  const y0 = await page.evaluate(() => { const t = __mstest; return t.comps[t.zKbL].cy; });
  await page.keyboard.press('ArrowUp'); await idle(page);
  assert.ok((await page.evaluate(() => { const t = __mstest; return t.comps[t.zKbL].cy; })) < y0, 'up is up');
  await page.keyboard.press(' '); await idle(page);
  assert.equal(await live(page), 'Added to Bell: 1 section');
  assert.match(await page.textContent('#sfZoneN'), /^1 section in Bell$/);
  assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Bell: 1 section added');
  await page.keyboard.press('ArrowLeft'); await idle(page);
  await page.keyboard.press('Enter'); await idle(page);
  assert.match(await page.textContent('#sfZoneN'), /^2 sections in Bell$/);
  // Space on one in the zone takes it out
  await page.keyboard.press(' '); await idle(page);
  assert.equal(await live(page), 'Taken out of Bell: 1 section');
  await page.keyboard.press(' '); await idle(page);
  // the edge of the picture: said, and the ring stays
  let edge = false;
  for (let i = 0; i < 60 && !edge; i++) { await page.keyboard.press('ArrowRight'); edge = /No more sections that way/.test(await live(page)); }
  assert.ok(edge);
  // Ctrl+Z still undoes, the focus kept
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await idle(page);
  assert.match(await page.textContent('#sfZoneN'), /^1 section in Bell$/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfCanvas');
  // Escape: the editor closes, the picture gives up the focus to the zone's chip
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.$('#sfZoneDone'), null);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('sfzchip') && document.activeElement.dataset.z), String(await page.evaluate(() => __mstest.zoneCur)));
  assert.equal(await page.getAttribute('#sfCanvas', 'tabindex'), null);
  assert.equal(await page.getAttribute('#sfCanvas', 'role'), 'img');
  assert.equal(await ring(), false);
  // by touch or mouse: a tap in the editor adds the section and shows no ring
  await page.click('#sfPanel-pattern .sfzchip.on'); await idle(page);
  const big = await page.evaluate(() => { const t = __mstest; return Object.keys(t.assignData.assign).map(Number).filter((l) => t.zoneOf(l) === 0).sort((a, b) => t.comps[b].area - t.comps[a].area)[0]; });
  await scrollTop(page);
  const pt = await sectionPoint(page, big);
  await page.mouse.click(pt.x, pt.y); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.zoneOf(l) === __mstest.zoneCur, big), true);
  assert.equal(await ring(), false, 'no ring after a click');
  assert.deepEqual(errors, []);
});


test('Undo back past a zone’s making while the picture has the keyboard’s focus: the editor closes and the picture leaves keyboard mode', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  await page.click('#sfShape [data-v="radial"]'); await idle(page);
  await page.click('#sfZoneAdd'); await idle(page);
  await page.focus('#sfZoneKb'); await page.keyboard.press('Enter'); await idle(page);
  await page.keyboard.press(' '); await idle(page);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press(' '); await idle(page);
  for (let i = 0; i < 6 && (await page.evaluate(() => __mstest.zones.length)); i++) { await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await idle(page); }
  assert.equal(await page.evaluate(() => __mstest.zones.length), 0);
  assert.equal(await page.$('#sfZoneDone'), null);
  assert.equal(await page.getAttribute('#sfCanvas', 'tabindex'), null);
  assert.equal(await page.getAttribute('#sfCanvas', 'role'), 'img');
  assert.equal(await page.evaluate(() => { const o = document.querySelector('.sfoutline'); return !!o && o.style.display !== 'none'; }), false, 'no ring left');
  // (the arrow keys no longer move a ring, nor does Space scroll the page)
  await page.keyboard.press(' ');
  assert.deepEqual(errors, []);
});
