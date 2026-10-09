// v309.1 (debugging pass, making a guide): fixes found by reviewer 1, each failing before its fix.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, sectionPoint, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

const focused = (page) => page.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'body' : a.id || (a.classList.contains('sfzchip') ? 'chip:' + a.dataset.z : a.tagName); });

// The zone editor closed by Escape from one of its own controls (Done, Delete zone, "Choose sections with the keys", or
// the name field once Escape there has put the name back) left the keyboard on the page itself: its controls are
// drawn again as the editor closes. Now the keyboard goes to the zone's chip, or to ＋ Zone when the new zone is dropped.
test('the zone editor closed by Escape from its own controls gives the keyboard to the zone’s chip (or ＋ Zone)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  // a new zone, no sections: Escape from Done drops it, the keyboard on ＋ Zone
  await page.focus('#sfZoneAdd'); await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await focused(page), 'sfZoneName');
  await page.focus('#sfZoneDone'); await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => __mstest.zones.length), 0, 'the empty zone is dropped');
  assert.equal(await focused(page), 'sfZoneAdd', 'the keyboard on ＋ Zone');
  // the name field: Escape puts the name back (the editor stays), a second Escape closes it
  await page.keyboard.press('Enter'); await idle(page);
  assert.equal(await focused(page), 'sfZoneName');
  await page.keyboard.press('Escape'); await idle(page);
  assert.ok(await page.isVisible('#sfZoneDone'), 'the editor is still open');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await focused(page), 'sfZoneAdd');
  // a zone with a section: Escape from "Choose sections with the keys" leaves the keyboard on the zone's chip
  await page.keyboard.press('Enter'); await idle(page);
  const l = await page.evaluate(() => Object.keys(__mstest.assignData.assign).map(Number).sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0]);
  await scrollTop(page);
  const p = await sectionPoint(page, l); await page.mouse.click(p.x, p.y); await idle(page);
  const z = await page.evaluate(() => __mstest.zoneCur);
  assert.ok(z > 0 && (await page.evaluate(() => __mstest.zones.length)) === 1, 'a zone with a section');
  await page.focus('#sfZoneKb'); await page.keyboard.press('Escape'); await idle(page);
  assert.ok(!(await page.isVisible('#sfZoneDone')), 'the editor closed');
  assert.equal(await focused(page), 'chip:' + z, 'the keyboard on the zone’s chip');
  assert.deepEqual(errors, []);
});
