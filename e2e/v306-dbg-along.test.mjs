// v306 debugging pass (along): a search by code in Colour along keeps its rows when Whole picture / Zone by zone is
// chosen, and gives way to a press and hold on a section of another marker; "Did any run low?" names the brand in its
// toast for a code you own in both brands, as its chip does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, sectionPoint, longPress } from './helpers.mjs';

before(setup);
after(teardown);

const rows = (page) =>
  page.$$eval('#sfAlist .sfarow', (r) =>
    r.map((x) => x.dataset.k + (x.classList.contains('open') ? '*' : '')),
  );

async function withTail(page) {
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
  else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
  await idle(page);
  await page.fill('#sfZoneName', 'Tail');
  await page.press('#sfZoneName', 'Enter');
  await page.evaluate(() => {
    const t = __mstest,
      cl = Object.keys(t.assignData.assign)
        .map(Number)
        .filter((l) => t.comps[l].cy > t.H * 0.6);
    t.zoneMove(cl, t.zoneCur);
    t.reassign([0, t.zoneCur]);
  });
  await page.click('#sfZoneDone');
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
}

test('find by code: choosing Zone by zone or Whole picture with a search shown keeps that marker’s rows (the list had gone empty)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await withTail(page);
  const m = await page.evaluate(() => {
    const a = __mstest.assignData;
    return a.assign[a.order[0]];
  });
  await page.fill('#sfFindIn', m.code);
  await page.press('#sfFindIn', 'Enter');
  await idle(page);
  assert.deepEqual(await rows(page), [m.mkey + '*']);
  await page.click('#sfAlOrder button[data-v="zones"]');
  await idle(page);
  const z = await rows(page);
  assert.ok(z.length >= 1, 'its rows, zone by zone: ' + z);
  assert.ok(
    z.every((k) => k.startsWith(m.mkey + '@')),
    z.join(),
  );
  assert.equal(await page.inputValue('#sfFindIn'), m.code, 'the search stays');
  await page.click('#sfAlOrder button[data-v="whole"]');
  await idle(page);
  assert.deepEqual(await rows(page), [m.mkey]);
  assert.deepEqual(errors, []);
});

test('find by code: press and hold a section of a marker the search doesn’t show: the whole list again, with its row open', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  const code = await page.evaluate(() => __mstest.assignData.assign[__mstest.assignData.order[0]].code);
  await page.fill('#sfFindIn', code);
  await page.press('#sfFindIn', 'Enter');
  await idle(page);
  assert.equal((await rows(page)).length, 1);
  const o = await page.evaluate((c) => {
    const t = __mstest,
      l = t.assignData.order.find((l) => t.assignData.assign[l].code !== c && t.comps[l].area > 3000);
    return { l, k: t.assignData.assign[l].mkey };
  }, code);
  const p = await sectionPoint(page, o.l);
  await longPress(page, p.x, p.y);
  await idle(page);
  const r = await rows(page);
  assert.ok(r.includes(o.k + '*'), 'its row is shown and open: ' + r.slice(0, 5));
  assert.ok(r.length > 1, 'the whole list');
  assert.equal(await page.inputValue('#sfFindIn'), '');
  assert.equal(await page.textContent('#sfFindL'), '');
  // a section of the marker searched for keeps the search
  await page.fill('#sfFindIn', code);
  await page.press('#sfFindIn', 'Enter');
  await idle(page);
  const q = await page.evaluate(() => __mstest.assignData.order[0]);
  const p2 = await sectionPoint(page, q);
  await longPress(page, p2.x, p2.y);
  await idle(page);
  assert.equal((await rows(page)).length, 1);
  assert.equal(await page.inputValue('#sfFindIn'), code);
  assert.deepEqual(errors, []);
});

test('run low: a code you own in both brands is named with its brand in the toast, as on its chip', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
    SF.setCollection(sfCollection());
    __mstest.styleVars.limitN = 999;
    SF.reassign();
  });
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.updateProgress();
  });
  await idle(page);
  // Another… Y26: both brands' chips, "Ohuhu Y26" and "Copic Y26"
  await page.click('#sfLowA [data-lmore]');
  await page.fill('#sfLowInA', 'Y26');
  await page.press('#sfLowInA', 'Enter');
  await idle(page);
  await page.click('#sfLowA [data-lk="Copic|Y26"]');
  await idle(page);
  assert.equal(await page.textContent('#sfLowA [data-lk="Copic|Y26"]'), 'Copic Y26');
  assert.equal(await page.textContent('#msToast'), 'Copic Y26 running low · on To buy · Undo');
  await page.click('#sfLowA [data-lk="Copic|Y26"]');
  await idle(page);
  assert.equal(await page.textContent('#sfLive'), 'Copic Y26 ink back to OK');
  assert.deepEqual(errors, []);
});
