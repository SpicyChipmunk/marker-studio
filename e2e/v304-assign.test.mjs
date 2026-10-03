// v304 (plan patterns): removing Blend's last anchor brings back three (Blend never colours everything with one
// marker), and its Undo step says so, "Last anchor removed: Blend starts again from 3"; Undo puts the anchor back.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, scrollTop } from './helpers.mjs';

before(setup);
after(teardown);

test('Blend: the last anchor removed brings three back, named so for Undo, and Undo puts it back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="blend"]');
  await idle(page);
  await scrollTop(page);
  // one anchor left, where it shows on the picture
  const ap = await page.evaluate(() => {
    const t = __mstest, c = document.getElementById('sfCanvas'), r = c.getBoundingClientRect();
    const i = t.anchors.findIndex((a) => { const y = r.top + (a.y / t.H) * r.height; return y > Math.max(r.top, 0) + 20 && y < innerHeight - 20; });
    const a = t.anchors[i];
    t.anchors.splice(0, t.anchors.length, a);
    // (laid with it, a step of its own, as removing the others one by one would be)
    t.reassign();
    return { x: r.left + (a.x / t.W) * r.width, y: r.top + (a.y / t.H) * r.height, a: { x: a.x, y: a.y, mkey: a.mkey } };
  });
  await page.mouse.click(ap.x, ap.y);
  await idle(page);
  assert.equal(await page.textContent('#sfPopExtra'), 'Remove anchor');
  await page.click('#sfPopExtra');
  await idle(page);
  const after1 = await page.evaluate(() => ({ n: __mstest.anchors.length, label: __mstest.planLabel, mk: new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size }));
  assert.equal(after1.n, 3, 'three anchors again');
  assert.ok(after1.mk > 1, 'not one marker everywhere');
  assert.equal(after1.label, 'Last anchor removed: Blend starts again from 3');
  await page.click('#sfPlanUndo');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify(__mstest.anchors))), [ap.a], 'Undo: the anchor that was removed');
  assert.deepEqual(errors, []);
});
