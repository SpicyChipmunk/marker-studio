// v318 review (UI/UX pass), and its audit: Escape leaves the photo's editors in Check the sections (Adjust corners,
// Crop) as their Cancel does, only while the Guide screen shows; the browser's Back in the first-run welcome goes back
// a step; Colour along's tap on another marker's section is said, with Undo; Tester tasks' Send results with nothing
// answered sends nothing; on a phone, a PDF that won't open is said in view. Each fails on v318 as released.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  setup,
  teardown,
  openApp,
  idle,
  ROOT,
  sampleGuide,
  sectionPoint,
  scrollTop,
  notOnWebKit,
  WK,
  pause,
} from './helpers.mjs';

before(setup);
after(teardown);

const shown = (page, id) =>
  page.evaluate((id) => {
    const e = document.getElementById(id);
    return !!e && e.getClientRects().length > 0;
  }, id);

test('Escape leaves Crop (as Cancel) and then Adjust corners (as Cancel)', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.click('#mSections');
  await idle(page);
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
  // Crop, then Escape: back to Check the sections with nothing cropped
  await page.click('#sfAdjToggle');
  await idle(page);
  await page.click('#sfCrop');
  await idle(page);
  assert.ok(await shown(page, 'sfCropApply'), 'the crop editor is open');
  const size = await page.evaluate(() => [__mstest.W, __mstest.H]);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.ok(!(await shown(page, 'sfCropApply')), 'Escape closed the crop editor');
  assert.ok(await shown(page, 'sfBuild'), 'Check the sections is back');
  assert.deepEqual(await page.evaluate(() => [__mstest.W, __mstest.H]), size, 'nothing cropped');
  // Adjust corners (the scan has no corners of its own: the editor opens on starting corners), then Escape
  if (
    !(await shown(page, 'sfAdjToggle')) ||
    (await page.getAttribute('#sfAdjToggle', 'aria-expanded')) !== 'true'
  ) {
    await page.click('#sfAdjToggle');
    await idle(page);
  }
  const adj = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#sfCtl button')].find(
      (x) => x.offsetParent && /Adjust corners|Straighten page/.test(x.textContent),
    );
    if (b) {
      b.click();
      return b.textContent.trim();
    }
    return null;
  });
  assert.ok(adj, 'a way into the corners');
  await idle(page);
  assert.ok(await shown(page, 'sfPgGo'), 'the corners editor is open');
  assert.equal(await page.textContent('#sfPgNo'), 'Cancel', 'as an adjustment, not the first corners');
  const was = await page.evaluate(() => [__mstest.W, __mstest.H]);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.ok(!(await shown(page, 'sfPgGo')), 'Escape closed the corners editor');
  assert.ok(await shown(page, 'sfBuild'), 'Check the sections is back');
  assert.deepEqual(await page.evaluate(() => [__mstest.W, __mstest.H]), was, 'the picture as it was');
  assert.deepEqual(errors, []);
});

// (v318 audit) Crop left open on the Guide screen, then Markers: an Escape there is Markers' own (it closes its ⋯ menu),
// not a crop cancelled out of sight. Fails on the review branch before the audit
test('Crop left open, then Markers: Escape closes Markers’ ⋯ menu, and the crop is still open back on the Guide screen', async () => {
  const { page, errors } = await openApp({
    width: 1180,
    height: 820,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.click('#mSections');
  await idle(page);
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
  await page.click('#sfAdjToggle');
  await idle(page);
  await page.click('#sfCrop');
  await idle(page);
  assert.ok(await shown(page, 'sfCropApply'), 'the crop editor is open');
  await page.click('#mCollection');
  await idle(page);
  await page.click('#mkMore');
  await idle(page);
  const menu = () => page.evaluate(() => !document.getElementById('mkMenu').hidden);
  assert.ok(await menu(), 'Markers’ ⋯ menu is open');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.ok(!(await menu()), 'Escape closed the menu');
  await page.click('#mSections');
  await idle(page);
  assert.ok(await shown(page, 'sfCropApply'), 'the crop is as it was left');
  assert.deepEqual(errors, []);
});

// The first-run welcome's steps: the browser's Back (an iPad's swipe from the edge in a Safari tab, Android's Back) goes
// back a step, as its Back link does. Fails on v318 as released: Back left the app from any step.
test('Back in the welcome goes back a step, not out of the app', notOnWebKit(WK.back), async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await page.waitForSelector('#welcome.on');
  await idle(page);
  const url = page.url();
  const step = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#welcome .wcstep')]
        .filter((s) => s.getClientRects().length)
        .map((s) => s.id)
        .join(),
    );
  await page.click('#wcHaveSet');
  await idle(page);
  assert.equal(await step(), 'wcStep1');
  await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
  await page.goBack();
  await idle(page);
  assert.equal(page.url(), url, 'still in the app');
  assert.equal(await step(), 'wcStep0', 'back on the first step');
  assert.ok(await page.isVisible('#welcome.on'));
  // two steps in (one by one, then the chart over it): Back closes the chart, then goes back a step
  await page.click('#wcOneByOne');
  await idle(page);
  await page.click('#wcOneChart');
  await idle(page);
  await page.waitForFunction(() => history.state && history.state.msLayer >= 2);
  await page.goBack();
  await idle(page);
  assert.ok(!(await page.isVisible('#chartOverlay')), 'the chart closed');
  assert.equal(await step(), 'wcStepOne');
  await page.waitForFunction(() => history.state && history.state.msLayer >= 1);
  await page.goBack();
  await idle(page);
  assert.equal(await step(), 'wcStep0');
  assert.equal(page.url(), url);
  // Skip, then its Back link: no entry left over once the welcome is done
  await page.click('#wcSkip');
  await idle(page);
  await page.click('#wcLook');
  await idle(page);
  await page.waitForFunction(() => !(history.state && history.state.msLayer));
  assert.ok(!(await page.isVisible('#welcome.on')));
  assert.deepEqual(errors, []);
});

// Colour along with a marker's row open: a tap on a faded section (another marker's) asks first, beside it: Open that
// marker or Tick it (Untick it when ticked). (Wave one ticked it and said so, with Undo; v318 as released ticked it
// silently.)
test('a tap on another marker’s section while one is open asks first: Open it, or Tick it / Untick it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfAlist .sfarow button.sfah');
  await idle(page);
  await scrollTop(page);
  const l = await page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order
      .filter((x) => t.assignData.assign[x].mkey !== t.hlKey)
      .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
  });
  const p = await sectionPoint(page, l),
    hk = await page.evaluate(() => __mstest.hlKey),
    code = await page.evaluate((l) => __mstest.assignData.assign[l].code, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'nothing ticked yet');
  assert.ok(await page.isVisible('.sftip.sftipask'), 'the question, beside the section');
  assert.match(await page.textContent('.sftipask'), new RegExp(`not \\S+Open ${code}Tick it$`));
  // a second tap on it closes the question, ticking nothing
  await page.mouse.click(p.x, p.y);
  await idle(page);
  assert.equal(await page.isVisible('.sftip.sftipask'), false);
  assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)));
  // Tick it
  await page.mouse.click(p.x, p.y);
  await idle(page);
  await page.click('.sftipask [data-a="tick"]');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'ticked');
  assert.equal(await page.evaluate(() => __mstest.hlKey), hk, 'the open row stays');
  // ticked, it asks Untick it; and the question stays while the tick's fade draws the picture again
  await page.mouse.click(p.x, p.y);
  await pause(page, 800, 'the tick just made fades in over the next moments, each step drawing the picture again');
  await idle(page);
  assert.ok(await page.isVisible('.sftip.sftipask'), 'still asked');
  assert.match(await page.textContent('.sftipask [data-a="tick"]'), /^Untick it$/);
  await page.click('.sftipask [data-a="tick"]');
  await idle(page);
  assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'unticked');
  // Open: that marker's row, as a press and hold does
  await page.mouse.click(p.x, p.y);
  await idle(page);
  await page.click('.sftipask [data-a="open"]');
  await idle(page);
  assert.equal(
    await page.evaluate((l) => __mstest.hlKey === __mstest.assignData.assign[l].mkey, l),
    true,
    'its row open',
  );
  assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'and nothing ticked');
  await scrollTop(page);
  // its own marker's section: no word
  const own = await page.evaluate(
    () =>
      __mstest.assignData.order
        .filter((x) => __mstest.assignData.assign[x].mkey === __mstest.hlKey)
        .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0],
  );
  const q = await sectionPoint(page, own);
  await page.mouse.click(q.x, q.y);
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], own), 1);
  assert.ok(
    !(await page.evaluate(() =>
      /not the marker/.test((document.querySelector('#msToast.on') || {}).textContent || ''),
    )),
  );
  assert.deepEqual(errors, []);
});

// (v318 audit) the tap that finishes the page isn't said as another marker's: the page's banner says it's done, with
// the open row closed. And Colour along zone by zone: the open row's marker, tapped in another zone, is said as that
// zone, not as another marker. Fail on the review branch before the audit
test('a tap that finishes the page isn’t said as another marker’s; the same marker in another zone is said as that zone', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-along-zones': '1' } });
  await sampleGuide(page);
  await idle(page);
  // a zone of the bottom part, and one marker in both zones
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
  const k = await page.evaluate(() => {
    const t = __mstest,
      A = t.assignData.assign,
      ls = Object.keys(A).map(Number),
      main = ls.filter((l) => t.zoneOf(l) === 0).sort((a, b) => t.comps[b].area - t.comps[a].area),
      m = A[main[0]],
      tail = ls.filter((l) => t.zoneOf(l) !== 0).sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    A[tail] = m;
    t.renderGuide();
    return { mk: m.mkey, main: main[0], tail: tail };
  });
  await page.click('#sfColor');
  await idle(page);
  // the marker's row in the Tail opened, then a tap on its section in Main
  await page.evaluate((mk) => {
    const r = [...document.querySelectorAll('#sfAlist .sfarow')].find(
      (x) => x.dataset.k.startsWith(mk + '@') && !x.dataset.k.endsWith('@0'),
    );
    r.querySelector('button.sfah').click();
  }, k.mk);
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.hlKey), k.mk);
  await scrollTop(page);
  const p = await sectionPoint(page, k.main);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  // (v318 review, second pass: asked first, the zones named)
  assert.match(await page.textContent('.sftipask'), /not \S+ in Tail.*Open \S+ in Main/);
  await page.click('.sftipask [data-a="tick"]');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], k.main), 1, 'ticked');
  // every other section ticked but one of another marker: its tap finishes the page, and nothing says "not the marker"
  const last = await page.evaluate((mk) => {
    const t = __mstest,
      A = t.assignData.assign,
      ls = t.assignData.order,
      l = ls
        .filter((x) => A[x].mkey !== mk && !t.colored[x])
        .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    ls.forEach((x) => x !== l && (t.colored[x] = 1));
    t.renderGuide();
    return l;
  }, k.mk);
  await page.evaluate(() => hideToast());
  // (asked first: Tick it)
  await scrollTop(page);
  const q = await sectionPoint(page, last);
  await page.mouse.click(q.x, q.y);
  await idle(page);
  await page.click('.sftipask [data-a="tick"]');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], last), 1);
  assert.ok(
    !(await page.evaluate(() =>
      /not the marker/.test((document.querySelector('#msToast.on') || {}).textContent || ''),
    )),
    'no word of another marker over the finished page',
  );
  assert.deepEqual(errors, []);
});

// Tester tasks' Send results with nothing answered says so and sends nothing. Fails on v318 as released (it shared six
// "not yet"s).
test('Send results with nothing answered sends nothing and says why', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    init: () => {
      window.__shared = [];
      Object.defineProperty(navigator, 'share', {
        value: (d) => (window.__shared.push(d), Promise.resolve()),
        configurable: true,
      });
    },
  });
  await idle(page);
  await page.click('#homeTasks');
  await idle(page);
  await page.click('#ttSendTop');
  await idle(page);
  assert.equal(await page.evaluate(() => window.__shared.length), 0);
  assert.match(await page.textContent('#ttSaid'), /^Nothing to send yet/);
  await page.click('.ttrow[data-k="add"] [data-r="ok"]');
  await idle(page);
  await page.click('#ttSend');
  await idle(page);
  assert.equal(await page.evaluate(() => window.__shared.length), 1);
  assert.match(await page.textContent('#ttSaid'), /^Shared/);
  assert.deepEqual(errors, []);
});

// A PDF (or photo) that won't open, from the Guide screen's start card on a phone: the card saying so is brought into
// view. Fails on v318 as released (it was below the screen's foot: the tap seemed to do nothing).
test('on a phone, a PDF that won’t open is said where it can be seen', async () => {
  const { page, errors } = await openApp({
    width: 390,
    height: 844,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.click('#mSections');
  await idle(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPdf')]);
  await fc.setFiles({
    name: 'broken.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a PDF at all'),
  });
  await page.waitForFunction(
    () => /Couldn’t open that PDF/.test((document.querySelector('#sfRoot .mserr') || {}).textContent || ''),
    null,
    { timeout: 60000 },
  );
  await idle(page);
  const r = await page.evaluate(() => {
    const b = document.querySelector('#sfRoot .mserr').getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, vh: innerHeight };
  });
  assert.ok(r.top >= 0 && r.bottom <= r.vh, `the card in view: ${JSON.stringify(r)}`);
  assert.deepEqual(errors, []);
});
