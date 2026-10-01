// v284 polish: headings and landmarks for screen readers; Edit sections' sliders say what turning them up does, and
// Straighten is offered when the page's edges looked uneven; the tool row fits at 375px in the busiest case (Photo,
// zoomed in, with Undo); toasts stay while you're reading or reaching them; the first Save says in the header that
// the guide saves itself from then on.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

test('one h1, a Main nav, a main landmark, the screen named as an h2; dialog and sheet titles are h2s, the guide’s group labels h3s', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  assert.deepEqual(await page.$$eval('h1', (h) => h.map((x) => x.textContent)), ['Marker Studio']);
  assert.equal(await page.locator('nav[aria-label="Main"] button').count(), 4);
  assert.equal(await page.locator('[role="main"]').count(), 1);
  assert.equal(await page.textContent('#screenH'), 'Guide');
  await page.click('#mCollection'); await idle(page);
  assert.equal(await page.textContent('#screenH'), 'Markers');
  await page.click('#mSections'); await idle(page);
  await page.click('.sftabbtn[data-t="share"]'); await idle(page);
  assert.deepEqual(await page.$$eval('#sfCtl h3.sfglbl', (h) => h.filter((x) => x.offsetParent).map((x) => x.textContent)), ['Show it off', 'Print', 'Plan & keep']);
  await page.click('#sfMore'); await page.waitForSelector('#sfSheet'); await idle(page);
  assert.equal(await page.evaluate(() => document.getElementById('sfSheetT').tagName), 'H2');
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.evaluate(() => document.querySelector('#savedOverlay .mtitle').tagName), 'H2');
  assert.deepEqual(errors, []);
});

test('Edit sections: each slider says what turning it up does; Straighten is offered on a line of its own after Keep as is', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  // a photo of circles (no page in it to straighten: the finder stays quiet)
  const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 500; c.height = 700; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 500, 700); g.strokeStyle = '#111'; g.lineWidth = 6; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(100 + i * 60, 200 + (i % 2) * 200, 70, 0, 6.283); g.stroke(); } return c.toDataURL('image/png').split(',')[1]; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 20000 }); await idle(page);
  assert.equal(await page.locator('.sfpghint').count(), 0, 'nothing said when there was no page to find');
  assert.equal(await page.textContent('#sfMinHint'), 'Higher: small specks left out of the guide');
  assert.equal(await page.getAttribute('#sfMin', 'aria-describedby'), 'sfMinHint');
  assert.match(await page.textContent('#sfBgHint'), /^Higher: /);
  // (as after a photo whose outline the finder couldn't trust, kept as it was)
  await page.evaluate(() => { __mstest.pgHint = 'kept'; __mstest.renderControls(); });
  await idle(page);
  assert.match(await page.textContent('.sfpghint'), /^Page kept as photographed · Straighten$/);
  assert.deepEqual(errors, []);
});

test('the tool row fits at 375px with Photo, zoomed in and Undo showing', async () => {
  const { page, errors } = await openApp({ width: 375, height: 812 });
  await sampleGuide(page); await idle(page);
  await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 80; c.height = 60; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 60); g.fillStyle = '#36c'; g.fillRect(40, 0, 40, 60); __mstest.setPhotoRef(__mstest.photoFromImage(c), true); __mstest.reassign(); });
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]'); await idle(page);
  if (await page.isVisible('#sfPhDone')) { await page.click('#sfPhDone'); await idle(page); }
  await page.click('#sfShuffle').catch(() => {});
  await page.click('#sfZin'); await page.click('#sfZin'); await idle(page);
  const r = await page.evaluate(() => { const z = document.getElementById('sfZoomCtl'), b = [...z.querySelectorAll('button')].filter((x) => x.offsetParent); return { sw: z.scrollWidth, cw: z.clientWidth, right: Math.max(...b.map((x) => x.getBoundingClientRect().right)), undo: !!document.getElementById('sfPlanUndo').offsetParent, h: Math.min(...b.map((x) => x.getBoundingClientRect().height)) }; });
  assert.ok(r.undo, 'Undo showing');
  assert.ok(r.sw <= r.cw + 1, `the row fits: ${r.sw} in ${r.cw}`);
  assert.ok(r.right <= 375, 'no button off the screen: ' + r.right);
  assert.ok(r.h >= 34, 'buttons keep their height');
  assert.deepEqual(errors, []);
});

test('a toast with a button stays while the pointer is on it, and the first Save says in the header that it saves itself now', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await idle(page);
  await page.evaluate(() => toastAction('Something happened', 'Undo', () => {}, 1200));
  // (the toast lets taps through to the page; its button takes them)
  const box = await page.locator('#toastAct').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1800);
  assert.equal(await page.evaluate(() => document.getElementById('msToast').classList.contains('on')), true, 'kept while pointed at');
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => !document.getElementById('msToast').classList.contains('on'), null, { timeout: 4000 });
  // (v285: the sample, once changed, goes into the Library by itself)
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="random"]');
  await page.waitForFunction(() => /^Saves itself from now on ✓$/.test(document.getElementById('sfSaveSt').textContent));
  assert.ok(!(await page.evaluate(() => document.getElementById('msToast').classList.contains('on') && /Saved to your Library/.test(document.getElementById('msToast').textContent))), 'no toast over the tabs for it');
  assert.deepEqual(errors, []);
});
