// v307 debugging pass, the core paths where the speed branch meets the others: a guide reloaded in place into Colour
// along that turns out all white is still painted; Build waiting on the worker doesn't build over a guide opened
// meanwhile; idle() isn't left waiting on a worker stopped with a job in flight.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, sampleGuide, saveGuide, idle, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

// how much of the picture's canvas is painted (0: blank)
const painted = (page) =>
  page.evaluate(() => {
    const c = document.getElementById('sfCanvas'),
      d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n / (d.length / 4);
  });

test('a guide reloaded in place in Colour along that is now all white (another tab left it white) is painted, in the plan', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await saveGuide(page);
  await page.click('#sfColor');
  await page.waitForFunction(() => __mstest.sfmode === 'color');
  await idle(page);
  // what reloadOpen does when another tab saves the guide while this one colours along (quiet, col): the stored copy,
  // now with every section left white
  await page.evaluate(async () => {
    const t = __mstest,
      id = t.curId,
      d = await sfLoadDesign(id);
    d.paper = Object.keys(d.assign).map(Number);
    d.assign = {};
    d.prog = [];
    t.openDesignObj(d, id, false, true, true);
  });
  await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N === 0);
  await idle(page);
  assert.equal((await page.evaluate(() => __mstest.assign.guideWhite())) > 0, true, 'all white');
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
  assert.ok((await painted(page)) > 0.99, 'the picture painted, not left blank');
  assert.deepEqual(errors, []);
});

test('Build waiting on the worker for its label points: a guide opened meanwhile stays as it opened (Colour along, its plan)', async () => {
  const { page, errors } = await openApp({
    width: 1180,
    height: 820,
    // the worker's label points slow to come back, as on a big page on an iPad
    init: () => {
      const o = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (m, t) {
        if (m && m.k === 'lpts' && window.__slow) {
          setTimeout(() => o.call(this, m, t), 1500);
          return;
        }
        return o.call(this, m, t);
      };
    },
  });
  await sampleGuide(page);
  await saveGuide(page);
  // part-coloured, so it opens in Colour along
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.slice(0, 5).forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.renderGuide();
  });
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  const id = await page.evaluate(() => __mstest.curId);
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
  await page.evaluate(() => {
    window.__slow = true;
  });
  await page.click('#sfBuild');
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.sfmode === 'color', id);
  await page.evaluate(() => {
    window.__ad = __mstest.assignData;
  });
  await idle(page, 2300);
  const st = await page.evaluate(() => ({
    mode: __mstest.sfmode,
    same: window.__ad === __mstest.assignData,
    ticks: __mstest.colored.reduce((a, b) => a + b, 0),
  }));
  assert.deepEqual(st, { mode: 'color', same: true, ticks: 5 }, 'not built over: still colouring along');
  assert.deepEqual(errors, []);
});

test('idle() isn’t left waiting on a worker stopped with a job in flight', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    const px = new Uint8Array(1024 * 1024 * 4);
    __mstest.jobs.run('pdf', { buf: px.buffer, n: 1024 * 1024, z: true }, [px.buffer]).catch(() => {});
    __mstest.jobs.off();
  });
  const ms = await idle(page);
  assert.ok(ms < 5000, 'idle in ' + ms + ' ms');
  await page.evaluate(() => __mstest.jobs.off(false));
  assert.deepEqual(errors, []);
});
