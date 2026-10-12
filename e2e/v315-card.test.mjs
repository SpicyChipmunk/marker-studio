// v315 (Q7): the plan-and-your-page card stays 1080 × 1350, and lays the two side by side or one over the other,
// whichever shows both pictures bigger (v314: side by side only for a tall plan, whatever the photo); THE PLAN and MY
// PAGE are never under 2% of its width; on a phone held sideways its dialog's Share is on the screen. Fails on v314.1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, welcome } from './helpers.mjs';

before(setup);
after(teardown);

// the card for a grey photo w × h: { w, h, side, lab, plan, page }
const card = (page, w, h) =>
  page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#ddd';
      g.fillRect(0, 0, w, h);
      const k = __mstest.fin.cardOf(c);
      return {
        w: k.width,
        h: k.height,
        side: k.finAt.side,
        lab: k.finAt.lab,
        plan: k.finAt.plan,
        page: k.finAt.page,
      };
    },
    [w, h],
  );
const area = (r) => Math.min(r.plan.w * r.plan.h, r.page.w * r.page.h);

test('a tall plan: side by side for a page-shaped photo, one over the other for a panorama; labels at least 2% of the width', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const a = await card(page, 900, 1200);
  assert.deepEqual([a.w, a.h, a.side], [1080, 1350, true]);
  const pano = await card(page, 1800, 600);
  assert.deepEqual([pano.w, pano.h, pano.side], [1080, 1350, false], 'a panorama under the plan');
  for (const r of [a, pano]) assert.ok(r.lab >= 0.02 * 1080 - 0.01, 'label ' + r.lab);
  // the one chosen shows the smaller picture bigger than the other would
  const other = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1800;
    c.height = 600;
    const k = __mstest.fin.cardOf(c, true);
    return { plan: k.finAt.plan, page: k.finAt.page };
  });
  assert.ok(area(pano) > area(other), 'stacked shows them bigger');
  assert.deepEqual(errors, []);
});

test('a wide plan beside a tall photo (v314 stacked them, both small)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  // a wide page of boxes, drawn here
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 1200, 800);
    g.lineWidth = 6;
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++) g.strokeRect(60 + i * 180, 60 + j * 170, 160, 150);
    return c.toDataURL('image/png').split(',')[1];
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
  const r = await card(page, 900, 1200);
  assert.equal(r.side, true, 'side by side');
  const v314 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    const k = __mstest.fin.cardOf(c, false);
    return { plan: k.finAt.plan, page: k.finAt.page };
  });
  assert.ok(area(r) > area(v314), `bigger than v314’s stack: ${area(r)} > ${area(v314)}`);
  assert.deepEqual(errors, []);
});

test('a phone held sideways: the card’s Share is on the screen', async () => {
  const { page, errors } = await openApp({ width: 844, height: 390 });
  await sampleGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.styleVars.smpTry = 0;
    t.curName = 'Finished jellyfish';
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.saveNow();
  });
  await page.waitForFunction(() => __mstest.inLibrary);
  const id = await page.evaluate(() => __mstest.curId);
  await page.evaluate((id) => {
    const c = document.createElement('canvas');
    c.width = 850;
    c.height = 1100;
    const g = c.getContext('2d');
    g.fillStyle = '#c33';
    g.fillRect(0, 0, 850, 1100);
    return IDB.put('fin-' + id, {
      u: c.toDataURL('image/jpeg', 0.8),
      w: 850,
      h: 1100,
      ts: Date.now(),
      flat: 1,
    });
  }, id);
  await page.click('#sfColor');
  await idle(page);
  await page.waitForSelector('#sfFin [data-fin="show"]');
  await page.click('#sfFin .sflink[data-fin="show"]');
  await page.waitForSelector('#sfFinCard img');
  await page.waitForFunction(() => document.querySelector('#sfFinCard img').complete);
  const b = await page.evaluate(
    () => document.querySelector('#sfFinCard [data-a="share"]').getBoundingClientRect().bottom,
  );
  assert.ok(b <= 390, 'Share’s bottom ' + b + ' on a 390 px screen');
  assert.deepEqual(errors, []);
});
