// (v329.4) Fix the subject (docs/PLAN-fix-subject.md): the link under Focus, the mode's pieces, strokes by the
// first-touch rule, its own Undo and Redo (the tool row's and the keyboard's), Cancel, Done (the page made again with the
// fixed subject, one Undo step), Done with no change. At iPad width with the mouse and at phone width with touch pointer
// events. The subject map is made up (the subject finder isn't downloaded for these): a disc where the photo's is.
// Made-up photos only.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { idle, openApp, setup, teardown, until } from './helpers.mjs';

before(setup);
after(teardown);

const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-photo-tips': '1' };
// a pale ground with a dark-red disc in the middle (and a yellow spot on it)
function photo(page, { w = 1200, h = 900, seed = 3 } = {}) {
  return page.evaluate(
    ({ w, h, seed }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      g.fillStyle = '#dfe6ea';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a1f26';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.52, w * 0.2, h * 0.3, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e0a33a';
      g.beginPath();
      g.ellipse(w * 0.47, h * 0.45, w * 0.07, h * 0.09, 0, 0, Math.PI * 2);
      g.fill();
      // (and a blue square at the top left: the part a fix adds)
      g.fillStyle = '#2a4f9a';
      g.fillRect(w * 0.06, h * 0.08, w * 0.16, h * 0.18);
      const id = g.getImageData(0, 0, w, h),
        d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (rnd() - 0.5) * 14;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      g.putImageData(id, 0, 0);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    { w, h, seed },
  );
}
const file = (b64) => ({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
const pageReady = (page) =>
  until(
    page,
    () =>
      !!__mstest.pp &&
      !__mstest.ppBusy &&
      /This page:/.test((document.getElementById('sfPpCount') || {}).textContent || ''),
    null,
    'the page step, its page made',
    60000,
  );
async function fromHome(page) {
  const b64 = await photo(page);
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('[data-start="ppage"]:visible').first().click(),
  ]);
  await fc.setFiles(file(b64));
  await pageReady(page);
  await idle(page);
}
// the page made again with Simpler background, its subject the made-up disc (the finder's map, as it would be)
async function calmWithDisc(page) {
  await page.evaluate(() => {
    const p = __mstest.ppPrep,
      m = new Float32Array(p.w * p.h);
    for (let y = 0; y < p.h; y++)
      for (let x = 0; x < p.w; x++) {
        const u = (x / p.w - 0.5) / 0.2,
          v = (y / p.h - 0.52) / 0.3;
        m[y * p.w + x] = u * u + v * v < 0.8 ? 0.95 : 0.03;
      }
    p.sal = m;
    p.salF = m;
    __mstest.pp.f = 'calm';
    __mstest.ppRemade(false);
  });
  await until(page, () => __mstest.pp.f === 'calm' && !__mstest.ppBusy, null, 'Simpler background', 60000);
  await pageReady(page);
  await idle(page);
}
const fixReady = (page) =>
  until(page, () => __mstest.fixOn && !!__mstest.fx && !!__mstest.fx.pc, null, 'the mode, its pieces', 30000);
// a point of the photo (fractions) on the screen
const at = (page, u, v) =>
  page.$eval(
    '#sfCanvas',
    (c, [u, v]) => {
      const r = c.getBoundingClientRect();
      return { x: r.left + u * r.width, y: r.top + v * r.height };
    },
    [u, v],
  );
// a stroke from (u0, v0) to (u1, v1), as pointer events of a kind (mouse, touch)
async function stroke(page, a, b, type) {
  const p = await at(page, a[0], a[1]),
    q = await at(page, b[0], b[1]);
  await page.evaluate(
    ({ p, q, type }) => {
      const c = document.getElementById('sfCanvas'),
        o = { bubbles: true, cancelable: true, pointerId: 21, pointerType: type, isPrimary: true, button: 0 };
      c.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1, clientX: p.x, clientY: p.y }));
      for (let i = 1; i <= 8; i++)
        c.dispatchEvent(
          new PointerEvent('pointermove', {
            ...o,
            buttons: 1,
            clientX: p.x + ((q.x - p.x) * i) / 8,
            clientY: p.y + ((q.y - p.y) * i) / 8,
          }),
        );
      c.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0, clientX: q.x, clientY: q.y }));
    },
    { p, q, type },
  );
  await idle(page);
}
const share = (page) => page.evaluate(() => __mstest.fx.share);

for (const [name, view, type] of [
  ['iPad', { width: 820, height: 1180 }, 'mouse'],
  ['phone', { width: 390, height: 844 }, 'touch'],
])
  test(`Fix the subject (${name}): strokes by the first touch, the mode's Undo and Redo, Cancel, Done remakes the page with the fixed subject as one Undo step, and Done with no change makes nothing`, async () => {
    const { page, errors } = await openApp({ ...view, storage: ONBOARDED });
    await idle(page);
    await fromHome(page);
    await calmWithDisc(page);
    // the link under Focus
    assert.equal((await page.textContent('#sfPpFix')).trim(), 'Fix the subject');
    assert.equal(await page.evaluate(() => __mstest.fixDiagLine()), 'Subject: found');
    const pid0 = await page.evaluate(() => __mstest.ppPrep.pid);
    await page.click('#sfPpFix');
    await fixReady(page);
    await idle(page);
    assert.equal((await page.textContent('#sfFixHead')).trim(), 'Fix the subject');
    assert.ok(await page.isDisabled('#sfFixUndo'), 'Undo greyed before a stroke');
    assert.equal(await page.locator('#sfPpDet').count(), 0, 'the page step’s controls covered');
    assert.ok(await page.isVisible('#sfFixFinder'), 'Use the finder’s subject: the finder found one');
    const s0 = await share(page);
    assert.ok(s0 > 0.05 && s0 < 0.4, `the disc is the subject (${s0})`);
    // a stroke started on the background adds; across the blue square
    await stroke(page, [0.08, 0.12], [0.2, 0.22], type);
    const s1 = await share(page);
    assert.ok(s1 > s0, `added (${s0} -> ${s1})`);
    assert.equal(await page.evaluate(() => __mstest.fx.undo.length), 1);
    assert.ok(!(await page.isDisabled('#sfFixUndo')));
    // one started on the subject takes away
    await stroke(page, [0.5, 0.6], [0.52, 0.62], type);
    const s2 = await share(page);
    assert.ok(s2 < s1, `taken away (${s1} -> ${s2})`);
    // the tool row's Undo is the mode's: the last stroke, not the step before the mode
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await share(page), s1, 'the second stroke undone');
    assert.ok(await page.evaluate(() => __mstest.fixOn), 'still in the mode');
    // Redo from the keyboard
    await page.keyboard.press('Control+Shift+Z');
    await idle(page);
    assert.equal(await share(page), s2, 'redone');
    // Cancel: nothing kept
    await page.click('#sfFixCancel');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.fixOn), false);
    assert.equal(await page.evaluate(() => __mstest.pp.fix), null, 'Cancel keeps no fix');
    assert.ok(await page.isVisible('#sfPpDet'), 'the page step back');
    // again, and Done: the page made with the fixed subject
    await page.click('#sfPpFix');
    await fixReady(page);
    await stroke(page, [0.08, 0.12], [0.2, 0.22], type);
    const sDone = await share(page);
    await page.click('#sfFixDone');
    await until(page, () => !__mstest.fixOn, null, 'the mode closed', 10000);
    await pageReady(page);
    await idle(page);
    const d = await page.evaluate(() => ({
      fix: !!__mstest.pp.fix,
      key: __mstest.ppPrep.fixKey,
      pid: __mstest.ppPrep.pid,
      sh: __mstest.ppSubjectShare(__mstest.ppPrep),
      saved: !!__mstest.ppSave().fix,
    }));
    assert.ok(d.fix && /^[0-9a-f]{8}$/.test(d.key), 'the guide’s layer');
    assert.notEqual(d.pid, pid0, 'another subject: other markers and page memory keys');
    assert.ok(Math.abs(d.sh - sDone) < 0.02, `the page’s subject is the one fixed (${d.sh} vs ${sDone})`);
    assert.ok(d.saved, 'saved with the guide');
    // (Copy diagnostics: how much the fixes changed)
    assert.match(
      await page.evaluate(() => __mstest.fixDiagLine()),
      /^Subject: fixed by hand \((under 1|\d+)% of the photo changed\)$/,
    );
    // Done again with no change: nothing made
    await page.click('#sfPpFix');
    await fixReady(page);
    await page.click('#sfFixDone');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.fixOn), false);
    assert.equal(await page.evaluate(() => __mstest.ppBusy), false, 'no remake');
    // the main Undo: the page and the subject before Done, together
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.pp.fix), null, 'the old subject back with Undo');
    assert.deepEqual(errors, []);
  });
