// v318.3: a question from a photo shows the cap it's about, cut from the photo the right way up as the reader read it;
// a tap shows it larger, and a tap, Escape or Back closes that. The photo is drawn here (nothing of anyone's), the
// reader's lines made up. Fails on v318.2.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, scanFromMarkers, ENGINE } from './helpers.mjs';

before(setup);
after(teardown);

// a photo 400×400: round the box at (200, 200), red where the reading starts, blue where it ends, with the box turned
// `a` degrees; the reader's lines: eight codes as they are now, and "808" (asked about) in that box, read at `turn`
function read(page, a, turn) {
  return page.evaluate(
    ([a, turn]) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 400;
      const g = cv.getContext('2d');
      g.fillStyle = '#888';
      g.fillRect(0, 0, 400, 400);
      g.translate(200, 200);
      g.rotate((a * Math.PI) / 180);
      g.fillStyle = '#f00';
      g.fillRect(-60, -40, 60, 80);
      g.fillStyle = '#00f';
      g.fillRect(0, -40, 60, 80);
      const data = cv.getContext('2d').getImageData(0, 0, 400, 400);
      scanList = [];
      scanBrand = '';
      const r = {
        n: 1,
        items: new Map(),
        taken: new Set(),
        brands: {},
        sure: 0,
        p: null,
        done: false,
        note: '',
      };
      r.img = { w: 400, h: 400, data: data };
      ocrRun = r;
      const lines = ['B015', 'B03', 'B05', 'B09', 'B111', 'B112', 'B114', 'B115'].map((t, k) => ({
        id: k + 1,
        look: 1,
        text: t,
        conf: 0.98,
        unsure: false,
        nameOf: 0,
        box: [20 + k * 40, 380, 30, 14, 0],
      }));
      lines.push({
        id: 20,
        look: 1,
        text: '808',
        conf: 0.97,
        unsure: false,
        nameOf: 0,
        box: [200, 200, 100, 40, a],
        turn: turn,
      });
      lines.forEach((it) => ocrLine(r, it));
      ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
      clearTimeout(r.soon);
      scanRender();
      const q = scanList.find((e) => e.ask);
      return { asks: scanList.filter((e) => e.ask).map((e) => e.title), crop: q && q.crop };
    },
    [a, turn],
  );
}
// the crop's colour on its left and on its right (the reading's start and end once it's upright)
// (v318.8: read back once more, a frame later, when a side is neither: one run of WebKit here read 'other' twice,
// once in some hundreds, and the picture itself read right at once and a frame later in 80 more. A picture that is
// itself wrong still fails; the pixels read go in the message, to tell the two apart if it happens again)
const sides = (page, url) =>
  page.evaluate(async (url) => {
    const look = async () => {
      const im = new Image();
      im.src = url;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      const px = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
      return [px(im.width * 0.35, im.height / 2), px(im.width * 0.65, im.height / 2)];
    };
    const col = (p) => (p[0] > 150 && p[2] < 100 ? 'red' : p[2] > 150 && p[0] < 100 ? 'blue' : 'other');
    let ps = await look();
    if (ps.some((p) => col(p) === 'other')) {
      const first = ps.map((p) => p.join(','));
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
      ps = await look();
      if (ps.some((p) => col(p) === 'other'))
        return ps
          .map(col)
          .concat(['read ' + first.join(' ') + ', then ' + ps.map((p) => p.join(',')).join(' ')]);
    }
    return ps.map(col);
  }, url);

test('a question from a photo shows its cap, upright as the reader read it, whatever the turn', async () => {
  const { page, errors } = await openApp({
    width: 390,
    height: 844,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await scanFromMarkers(page);
  for (const [a, turn, want] of [
    [0, 0, ['red', 'blue']],
    [90, 0, ['red', 'blue']],
    [-35, 0, ['red', 'blue']],
    [0, 180, ['blue', 'red']],
    [90, 180, ['blue', 'red']],
  ]) {
    const o = await read(page, a, turn);
    assert.deepEqual(o.asks, ['“808” read: is it this one?']);
    assert.match(o.crop || '', /^data:image\/jpeg;base64,/, 'a picture of the cap');
    assert.deepEqual(await sides(page, o.crop), want, `turned ${a}°, read at ${turn}°`);
  }
  // the row: the picture in place of the "?"
  assert.equal(await page.locator('#scList .scask .sccrop img').count(), 1);
  assert.equal(await page.locator('#scList .scask .scmark').count(), 0);
  assert.deepEqual(errors, []);
});

// (v318.7: Not now in Close's place, still data-a="close")
test('a tap on the picture shows it larger; Not now, Escape or Back closes it, and focus goes back', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await scanFromMarkers(page);
  await read(page, 20, 0);
  // (Back: not in Safari's engine under test automation, where it's left to the browser: helpers.mjs WK.back)
  for (const how of ENGINE === 'webkit' ? ['tap', 'Escape'] : ['tap', 'Escape', 'back']) {
    await page.click('#scList .sccrop');
    await page.waitForSelector('.sczoom.on');
    assert.equal(await page.locator('.sczoom img').count(), 1);
    assert.match(await page.textContent('.sczoom'), /“808” read: is it this one\?/);
    await page.waitForTimeout(350);
    if (how === 'tap') await page.click('.sczoom [data-a="close"]');
    else if (how === 'Escape') await page.keyboard.press('Escape');
    else await page.goBack().catch(() => {});
    await page.waitForSelector('.sczoom', { state: 'detached' });
    assert.ok(await page.isVisible('#scList'), `Scan still open after ${how}`);
    if (how !== 'back')
      assert.equal(
        await page.evaluate(() => document.activeElement.classList.contains('sccrop')),
        true,
        'focus back on the picture',
      );
  }
  // answering the question takes the picture with it
  await page.click('#scList .scchoose');
  assert.equal(await page.locator('#scList .sccrop').count(), 0);
  assert.deepEqual(errors, []);
});

// (v318.3 debug) Safari doesn't focus a button that's tapped: focus was given back to what had it before, the box (on an
// iPad, its keyboard over the list), not the picture tapped; nor found again once the list was drawn again under it
test('the larger view gives focus back to the picture tapped, not to what had it before, even with the list redrawn', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await scanFromMarkers(page);
  await read(page, 0, 0);
  for (const redraw of [false, true]) {
    // (a tap as Safari makes it: a click, with no focus on the button)
    await page.evaluate(() => {
      document.getElementById('scBox').focus();
      document.querySelector('#scList .sccrop').click();
    });
    await page.waitForSelector('.sczoom.on');
    if (redraw) await page.evaluate(() => scanRender());
    await page.keyboard.press('Escape');
    await page.waitForSelector('.sczoom', { state: 'detached' });
    assert.equal(
      await page.evaluate(() => document.activeElement.className),
      'sccrop',
      redraw ? 'on the picture drawn again' : 'on the picture',
    );
  }
  assert.deepEqual(errors, []);
});

// (v318.3 debug) a phone held sideways: the picture kept square (it had been squashed to 320×257 by the dialogs' own
// height limit) and Close in view (v318.7: Not now, with the answers beside the picture there)
test('the larger view on a phone held sideways: the picture square, Not now in view', async () => {
  const { page, errors } = await openApp({
    width: 844,
    height: 390,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await scanFromMarkers(page);
  await read(page, 0, 0);
  await page.evaluate(() => document.querySelector('#scList .sccrop').click());
  await page.waitForSelector('.sczoom.on');
  const o = await page.evaluate(() => {
    const i = document.querySelector('.sczoom img').getBoundingClientRect(),
      b = document.querySelector('.sczoom [data-a="close"]').getBoundingClientRect();
    return { w: Math.round(i.width), h: Math.round(i.height), bottom: b.bottom };
  });
  assert.ok(Math.abs(o.w - o.h) <= 1, `square: ${o.w}×${o.h}`);
  assert.ok(o.bottom <= 390, `Not now in view: its foot at ${o.bottom}`);
  assert.deepEqual(errors, []);
});

// (v318.3 debug) "Which G410?" (G410, or G24 by its old code) on a photo whose G24 was read before it: the picture was
// G24's cap, already added, not the G410 asked about
test('a question about a code shows the cap read as that code, not another of its answers read before it', async () => {
  const { page, errors } = await openApp({
    width: 390,
    height: 844,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await scanFromMarkers(page);
  const o = await page.evaluate(() => {
    // red round the first line (G24), blue round the second (G410)
    const cv = document.createElement('canvas');
    cv.width = 400;
    cv.height = 400;
    const g = cv.getContext('2d');
    g.fillStyle = '#f00';
    g.fillRect(0, 0, 200, 400);
    g.fillStyle = '#00f';
    g.fillRect(200, 0, 200, 400);
    scanList = [];
    scanBrand = 'Ohuhu';
    const r = {
      n: 1,
      items: new Map(),
      taken: new Set(),
      brands: {},
      sure: 0,
      p: null,
      done: false,
      note: '',
    };
    r.img = { w: 400, h: 400, data: g.getImageData(0, 0, 400, 400) };
    ocrRun = r;
    const lines = ['G24', 'G410'].map((t, k) => ({
      id: k + 1,
      look: 1,
      text: t,
      conf: 0.97,
      unsure: false,
      nameOf: 0,
      box: [100 + k * 200, 200, 40, 20, 0],
      turn: 0,
    }));
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    const q = scanList.find((e) => e.ask);
    return { asks: scanList.filter((e) => e.ask).map((e) => e.title), crop: q && q.crop };
  });
  assert.deepEqual(o.asks, ['Which G410?']);
  assert.deepEqual(await sides(page, o.crop), ['blue', 'blue'], 'the G410 cap');
  assert.deepEqual(errors, []);
});
