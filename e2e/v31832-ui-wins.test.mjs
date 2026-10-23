// v318.32, stage 1C (Fable U1-2, U1-3, U1-4, U1-8, U1-9, U1-10; V1-8, V1-9): the welcome's Done on "Add your markers
// one by one" and on the Markers sheet; a fresh photo's corner step says to drag the yellow corners and makes
// Straighten the main button when the corners cover most of the photo; What's new as its own Help section and one
// Home line after an update; the Marker texture hint and the Neuro line; the mandala box's one sentence; "Start from a
// marker… (random)"; the tester card's chevron never alone on a line, and the foot's Tester tasks line away meanwhile.
// Each fails on v318.31.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, openAtScale, idle, haveSet, welcome, sampleGuide, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

const IPAD = { width: 820, height: 1180, touch: true };
const PHONE = { width: 390, height: 844 };
const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
const vis = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0; }, sel);
const rect = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; });

// ---- 1. the welcome's Done ----

for (const [name, o] of [['phone', PHONE], ['iPad portrait', IPAD]]) {
  test(`welcome (${name}): "Add your markers one by one" has Done, 44px, in view, that opens the sample as "That's all" does`, async () => {
    const { page, errors } = await openAtScale(name === 'phone' ? 1.3 : 1, o);
    await page.waitForSelector('#wcOneByOne');
    await page.click('#wcOneByOne');
    await idle(page);
    assert.ok(await vis(page, '#wcOneDone'), 'Done shows');
    const r = await rect(page, '#wcOneDone');
    assert.ok(r.h >= 44, 'Done is ' + r.h + 'px tall');
    assert.ok(r.b <= o.height && r.y >= 0, 'Done is in view: ' + JSON.stringify(r));
    assert.equal((await page.textContent('#wcOneDone')).trim(), 'Done');
    await page.click('#wcOneDone');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData), null, { timeout: 60000 });
    assert.equal(await vis(page, '#welcome'), false, 'the welcome is closed');
    assert.deepEqual(errors, []);
  });
}

test('Markers › Add markers (the welcome as a sheet): Done closes the sheet, as Back does', async () => {
  const { page, errors } = await openApp(PHONE);
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  assert.ok(await page.isVisible('#mkAddBtn'), 'Add markers is there');
  await page.click('#mkAddBtn');
  await page.waitForSelector('#wcStepAdd', { state: 'visible' });
  assert.ok(await vis(page, '#wcAddDone'), 'Done shows on the sheet');
  await page.click('#wcAddDone');
  await idle(page);
  assert.equal(await vis(page, '#welcome'), false, 'the sheet is closed');
  assert.equal(await page.evaluate(() => state.mode), 'collection', 'still on Markers');
  assert.deepEqual(errors, []);
});

// ---- 2. a fresh photo's corner step ----

async function freshPhotoApp(o = {}) {
  const a = await openApp(o);
  await haveSet(a.page);
  await a.page.check('#wcSets input[data-i="3"]');
  await a.page.click('#wcAdd');
  return a;
}
async function pickFixture(page, name) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name, mimeType: 'image/png', buffer: await readFile(join(ROOT, 'e2e', 'fixtures', name)) });
}
const pgBtns = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.sfpgbtns button')].map((b) => b.id + ':' + b.className + ':' + b.textContent));

test('the finder unsure, the corners right (a page under a lamp): the note says to drag the yellow corners, and Straighten is the main button', async () => {
  const { page, errors } = await freshPhotoApp();
  await pickFixture(page, 'lit-mandala-table.png');
  await page.waitForSelector('#sfPgGo', { timeout: 40000 });
  const note = await page.textContent('.sfpgnote');
  assert.match(note, /hidden or bent|outside the photo/, 'v313’s reason stays');
  assert.match(note, /Drag the yellow corners onto the page’s corners, then Straighten\./);
  assert.deepEqual(await pgBtns(page), ['sfPgGo:btn-primary:Straighten', 'sfPgNo:btn-soft:Keep as is']);
  // the corners cover most of the photo
  const cover = await page.evaluate(() => {
    const e = __mstest.pgEd, q = e.q, cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const area = Math.abs(cr(q[0], q[1], q[2])) / 2 + Math.abs(cr(q[0], q[2], q[3])) / 2;
    return area / (720 * 720);
  });
  assert.ok(cover > 0.5, 'covers ' + cover.toFixed(2));
  // a corner dragged well inside: no longer most of the photo, so Keep as is is first again
  await page.evaluate(() => { const e = __mstest.pgEd; e.q[2] = [360, 360]; e.q[1] = [360, e.q[1][1]]; });
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  assert.deepEqual(await pgBtns(page), ['sfPgNo:btn-primary:Keep as is', 'sfPgGo:btn-soft:Straighten']);
  assert.deepEqual(errors, []);
});

test('a corner off the photo: Keep as is stays the main button, and the note still says how to drag', async () => {
  const { page, errors } = await freshPhotoApp();
  await pickFixture(page, 'lit-mandala-table.png');
  await page.waitForSelector('#sfPgGo', { timeout: 40000 });
  // the same step with one corner past the photo's edge (as the finder's 'off' outline has)
  await page.evaluate(() => { const e = __mstest.pgEd; e.q[1] = [760, e.q[1][1]]; __mstest.renderControls(); });
  await idle(page);
  assert.deepEqual(await pgBtns(page), ['sfPgNo:btn-primary:Keep as is', 'sfPgGo:btn-soft:Straighten']);
  assert.match(await page.textContent('.sfpgnote'), /Drag the yellow corners onto the page’s corners, then Straighten\./);
  // Adjust corners later (not a fresh photo): its note and buttons as they were
  await page.click('#sfPgNo');
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
  await idle(page);
  assert.deepEqual(errors, []);
});

// ---- 3. What's new ----

test('Help: What’s new is its own section, second after the beta tester guide, listing this version’s', async () => {
  const { page, errors } = await openApp({ storage: ONB });
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  const secs = await page.$$eval('#helpOverlay .hlpsec > summary', (l) => l.map((s) => s.textContent));
  assert.equal(secs[0], 'Beta tester guide', 'v308: the tester guide first');
  assert.equal(secs[1], 'What’s new');
  assert.equal(await page.$('#helpAbout .hlpwnt'), null, 'no longer in About');
  await page.click('#helpNews > summary');
  await page.waitForSelector('#helpNews .hlpwnt', { state: 'visible' });
  const ver = (await page.textContent('#appVer')).trim();
  assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), `What’s new in ${ver}`);
  const items = await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent));
  assert.deepEqual(items, await page.evaluate((v) => WHATS_NEW.filter((x) => x.v === v).map((x) => x.t), ver));
  assert.ok(items.length >= 1);
  assert.deepEqual(errors, []);
});

for (const [name, o] of [['phone, Larger text', { ...PHONE, scale: 1.3 }], ['iPad portrait', { ...IPAD, scale: 1 }]]) {
  test(`Home (${name}): one line "Updated to vX · What’s new" after an update; What’s new opens Help there and the line goes for good; never on a fresh install`, async () => {
    const { scale, ...vp } = o;
    // an update from an older version (the version seen is remembered; nothing shown by itself under the test seam,
    // so the switch is set and the page opened again: openAtScale on WebKit has an init of its own)
    const { ctx, page, errors } = await openAtScale(scale, { ...vp, storage: { ...ONB, 'ms-last-ver': 'v200' } });
    await ctx.addInitScript(() => { window.__MS_HELP_AUTO = true; });
    await page.reload();
    await idle(page);
    const ver = (await page.textContent('#appVer')).trim();
    assert.ok(await vis(page, '#whatsNew'), 'the line shows on Home');
    assert.equal((await page.textContent('#wnTitle')).trim(), `Updated to ${ver}`);
    assert.equal((await page.textContent('#whatsNew')).replace(/\s+/g, ' ').trim(), `Updated to ${ver} · What’s new`);
    assert.equal(await page.$('#whatsNew li'), null, 'a line, not the card of items');
    const r = await rect(page, '#whatsNew');
    assert.ok(r.w <= vp.width && r.x >= 0 && r.r <= vp.width, 'fits the width: ' + JSON.stringify(r));
    assert.ok((await rect(page, '#wnOpen')).h >= 40 && (await rect(page, '#wnClose')).h >= 40, 'tappable');
    assert.equal(await page.getAttribute('#wnClose', 'aria-label'), 'Dismiss what’s new');
    await page.reload();
    await idle(page);
    assert.ok(await vis(page, '#whatsNew'), 'still there until tapped');
    await page.click('#wnOpen');
    await page.waitForSelector('#helpOverlay.on');
    assert.ok(await page.evaluate(() => document.getElementById('helpNews').open), 'Help opens at What’s new');
    // (v318.37: every version since the one last seen, e2e/v31837-shell)
    assert.equal((await page.textContent('#helpNews .hlpwnt')).trim(), 'What’s new since v200');
    assert.equal(await page.$('#whatsNew'), null, 'the line is gone');
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), ver, 'this version remembered as seen');
    await page.click('#helpClose');
    await idle(page);
    await page.waitForFunction(() => !(history.state && history.state.msLayer));
    await page.reload();
    await idle(page);
    assert.equal(await page.$('#whatsNew'), null, 'and stays gone');
    assert.deepEqual(errors, []);
  });
}

test('What’s new: ✕ dismisses the line; a fresh install never sees it', async () => {
  {
    const { page, errors } = await openApp({ storage: { ...ONB, 'ms-last-ver': 'v200' }, init: () => { window.__MS_HELP_AUTO = true; } });
    await idle(page);
    assert.ok(await vis(page, '#whatsNew'));
    await page.click('#wnClose');
    await idle(page);
    assert.equal(await page.$('#whatsNew'), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-last-ver')), (await page.textContent('#appVer')).trim());
    assert.deepEqual(errors, []);
  }
  {
    const { page, errors } = await openApp({ init: () => { window.__MS_HELP_AUTO = true; } });
    await welcome(page, 'look');
    await idle(page);
    assert.equal(await page.$('#whatsNew'), null, 'nothing on a fresh install');
    await page.reload();
    await idle(page);
    assert.equal(await page.$('#whatsNew'), null, 'nor on its next launch');
    assert.deepEqual(errors, []);
  }
});

// ---- 5. Shading's hints ----

for (const [name, o] of [['phone, Larger text', { ...PHONE, scale: 1.3 }], ['iPad portrait', { ...IPAD, scale: 1 }]]) {
  test(`Shading (${name}): a hint under Marker texture, and a line saying what Neuro is`, async () => {
    const { scale, ...vp } = o;
    const { page, errors } = await openAtScale(scale, vp);
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await idle(page);
    assert.ok(await vis(page, '#sfShNeuro'), 'the Neuro line shows with shading off');
    assert.match(await page.textContent('#sfShNeuro'), /^Neuro is for neurographic art/);
    if (vp.width < 600) {
      const more = await page.$('#sfPanel-shading .sfmorebar button, #sfPanel-shading [data-more]');
      if (more && !(await vis(page, '#sfTex'))) await more.click();
      await idle(page);
    }
    assert.ok(await vis(page, '#sfTexHint'), 'the texture hint shows');
    assert.match(await page.textContent('#sfTexHint'), /^Higher: /);
    assert.equal(await page.getAttribute('#sfTex', 'aria-describedby'), 'sfTexHint');
    assert.equal(await page.getAttribute('#sfTex', 'aria-label'), 'Marker texture');
    // under the slider, not beside it, and inside the pane
    const h = await rect(page, '#sfTexHint'), s = await rect(page, '#sfTex');
    assert.ok(h.y >= s.b - 1, 'hint under the slider');
    assert.ok(h.r <= vp.width, 'fits');
    assert.deepEqual(errors, []);
  });
}

// ---- 6. the mandala box ----

async function mandala(page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1100; c.height = 1100;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1100, 1100);
    g.strokeStyle = '#000'; g.lineWidth = 5;
    for (const r of [75, 200, 350, 500]) { g.beginPath(); g.arc(550, 550, r, 0, 6.2832); g.stroke(); }
    for (const [r0, r1, k] of [[75, 200, 8], [200, 350, 16], [350, 500, 24]])
      for (let i = 0; i < k; i++) {
        const a = (i * 2 * Math.PI) / k;
        g.beginPath(); g.moveTo(550 + r0 * Math.cos(a), 550 + r0 * Math.sin(a)); g.lineTo(550 + r1 * Math.cos(a), 550 + r1 * Math.sin(a)); g.stroke();
      }
    return c.toDataURL('image/png').split(',')[1];
  });
  return { name: 'mandala.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

test('Pattern › Gradient on a mandala: the box is one sentence, "Matching shapes get the same colour (mandalas)", no heading over it', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.setInputFiles('#sfFile', await mandala(page));
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, { timeout: 60000 });
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  await page.click('#sfFam [data-v="gradient"]');
  await idle(page);
  assert.equal(await page.isVisible('#sfMatchAlike'), true);
  const label = await page.evaluate(() => document.getElementById('sfMatchAlike').closest('label').textContent.trim());
  assert.equal(label, 'Matching shapes get the same colour (mandalas)');
  assert.equal(await page.$('#sfMandLbl'), null, 'no "Looks like a mandala" heading');
  assert.deepEqual(errors, []);
});

// ---- 7. Start from a marker… ----

test('Palette: the base button reads "Start from a marker… (random)" until one is chosen, then "Start from  Ohuhu R014"', async () => {
  const { page, errors } = await openApp(PHONE);
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mPalette');
  await idle(page);
  assert.equal((await page.textContent('#seedBtn')).replace(/\s+/g, ' ').trim(), 'Start from a marker… (random)');
  assert.equal(await vis(page, '#seedWrap .szlbl'), false, 'the row’s "Start from" label is away: the button says it');
  assert.ok((await rect(page, '#seedBtn')).h >= 44, '44px');
  await page.click('#seedBtn');
  await page.waitForSelector('#seedOverlay.on');
  await page.click('#seedGrid [data-i="' + (await page.evaluate(() => keyIdx('Ohuhu|R014'))) + '"]');
  await idle(page);
  assert.ok(await vis(page, '#seedWrap .szlbl'), 'with a marker chosen the label is back');
  assert.equal((await page.textContent('#seedWrap .szlbl')).trim(), 'Start from');
  assert.match((await page.textContent('#seedBtn')).trim(), /^Ohuhu R014/);
  assert.deepEqual(errors, []);
});

// ---- 8. the tester card ----

// (v318.36 kept the foot's Tester tasks line while the card shows, V1-8 undone: the test said "away" until v318.37)
test('Home’s tester card on an iPad in portrait: the › sits with the last word, never alone on a line; the foot’s Tester tasks line stays while the card shows', async () => {
  const { page, errors } = await openApp({ ...IPAD, storage: ONB });
  await idle(page);
  const r = await page.evaluate(() => {
    const nw = document.querySelector('#homeTaskCard .ttnw');
    if (!nw) return null;
    const rects = [...nw.getClientRects()].filter((q) => q.width > 0);
    const tops = new Set(rects.map((q) => Math.round(q.top)));
    return { text: nw.textContent.replace(/\s+/g, ' ').trim(), lines: tops.size, style: getComputedStyle(nw).whiteSpace };
  });
  assert.ok(r, 'the nowrap span is there');
  assert.equal(r.style, 'nowrap');
  assert.equal(r.lines, 1, 'the last word and › on one line');
  assert.match(r.text, /^markers ›$/);
  assert.equal(await page.evaluate(() => document.getElementById('homeTaskCard').innerText.replace(/\s+/g, ' ').trim()), '0/6 Beta tester tasks Next to answer: 1 · Add your markers ›');
  assert.equal(await vis(page, '#homeTasks'), true, 'the foot line stays (v318.36)');
  assert.deepEqual(errors, []);
});
