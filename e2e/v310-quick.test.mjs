// v310: the quick section check. A new picture's first Build asks only "Looks right?" (Build guide, and the tools
// behind Fix sections) when nothing is wrong with the sections; once Fix sections is tapped the full step stays.
// At the first start of v310, anyone with a guide in their Library keeps the full step.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, idle, welcome, haveSet, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const shown = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    return !!e && e.getClientRects().length > 0;
  }, sel);

async function pickPage(page, buf, name = 'letter-page.png', type = 'image/png') {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name, mimeType: type, buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}
const letter = () => readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));

test('a new user: "Looks right?" with Build guide and Fix sections; a tap changes nothing; Fix sections stays', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
  await welcome(page, 'look');
  await idle(page);
  await pickPage(page, await letter());
  assert.ok(await shown(page, '#sfQuick'));
  assert.match(await page.textContent('#sfQuick'), /^Looks right\?We found \d+ sections to colour/);
  assert.equal(await page.textContent('#sfQuickN'), await page.textContent('#sfCount'));
  for (const s of ['#sfEdit', '#sfMin', '#sfBg', '#sfAdjToggle'])
    assert.equal(await shown(page, s), false, s);
  assert.doesNotMatch(await page.innerText('#sfCtl'), /Check the sections/);
  assert.ok(await shown(page, '#sfFix'));
  assert.ok(await shown(page, '#sfBuild'));
  // a tap on a section: nothing left out, a word on where the tools are
  const before = await page.evaluate(() => __mstest.secState.join());
  const at = await page.evaluate(() => {
    const t = __mstest,
      cv = document.getElementById('sfCanvas'),
      r = cv.getBoundingClientRect();
    for (let y = (t.H / 3) | 0; y < t.H; y += 7)
      for (let x = (t.W / 3) | 0; x < t.W; x += 7) {
        const l = t.labels[y * t.W + x];
        if (l > 0 && t.comps[l] && !t.comps[l].bg && t.comps[l].area > 400)
          return { x: r.left + ((x + 0.5) * r.width) / t.W, y: r.top + ((y + 0.5) * r.height) / t.H };
      }
    return null;
  });
  assert.ok(at, 'a section to tap');
  await page.mouse.click(at.x, at.y);
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.secState.join()), before);
  assert.match(await page.textContent('#msToast'), /tap Fix sections/);
  // Fix sections: the tools, the keyboard on the first, kept from now on
  await page.click('#sfFix');
  assert.ok(await shown(page, '#sfEdit'));
  assert.equal(await shown(page, '#sfQuick'), false);
  assert.equal(await shown(page, '#sfFix'), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfEmToggle');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), '1');
  await pickPage(page, await letter(), 'again.png');
  assert.ok(await shown(page, '#sfEdit'), 'the next picture: the full step');
  assert.equal(await shown(page, '#sfQuick'), false);
  assert.deepEqual(errors, []);
});

test('Build guide from the quick check; the Plan’s ← Edit sections opens the full tools', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
  await welcome(page, 'look');
  await idle(page);
  await pickPage(page, await letter());
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
  await page.click('#sfBack2');
  await idle(page);
  assert.ok(await shown(page, '#sfEdit'));
  assert.equal(await shown(page, '#sfQuick'), false);
  // (came to fix something: not remembered as Fix sections was)
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), '0');
  assert.deepEqual(errors, []);
});

test('a warning about the sections: the full step, with the warning, for a new user too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
  await welcome(page, 'look');
  await idle(page);
  // the letter page, 40 px on its short side: too small
  const b64 = await page.evaluate(
    async (b) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b;
      await img.decode();
      const k = 40 / Math.min(img.naturalWidth, img.naturalHeight),
        c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    },
    (await letter()).toString('base64'),
  );
  await pickPage(page, Buffer.from(b64, 'base64'), 'tiny.png');
  assert.ok(await shown(page, '.sfc-segwarn'));
  assert.ok(await shown(page, '#sfEdit'));
  assert.equal(await shown(page, '#sfQuick'), false);
  assert.deepEqual(errors, []);
});

test('a photo straightened: the line with Undo and Adjust corners stays on the quick check', async () => {
  const src = await readFile(join(ROOT, 'e2e', 'straighten.test.mjs'), 'utf8');
  // (the photo maker of e2e/straighten: a page photographed at an angle on a table)
  const GEN = src.match(/const GEN = String\.raw`([\s\S]*?)`;/)[1];
  const { page, errors } = await openApp({ storage: { 'ms-sec-tools': '0' } });
  await haveSet(page);
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  const ph = await page.evaluate(
    async ([g, o]) => {
      eval(g);
      return makePhoto(o);
    },
    [GEN, { tilt: 25, roll: 8, size: 0.6 }],
  );
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
  await idle(page);
  assert.ok(await page.evaluate(() => !!__mstest.pgQ), 'straightened');
  assert.ok(await shown(page, '#sfQuick'));
  assert.ok(await shown(page, '.sfpgline'));
  assert.ok(await shown(page, '#sfPgAdj'));
  assert.deepEqual(errors, []);
});

test('the first start of v310: a Library with a guide keeps the full step; an empty one gets the quick check', async () => {
  const st = (saved) =>
    JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: [], saved });
  const g = { id: 5, type: 'guide', name: 'Owl', keys: ['Ohuhu|R014'], ts: Date.now() };
  for (const [saved, want] of [
    [[g], '1'],
    [[], '0'],
  ]) {
    const { page, errors, ctx } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-sec-tools': null, 'ms-onboarded': '1', 'ms-setup-tip': '1', [KEY]: st(saved) },
    });
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-sec-tools')), want);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
