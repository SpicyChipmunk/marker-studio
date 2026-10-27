// v328, Tick off from a photo (decisions 11.1-11.6, Part D): a guide made from a page, then a photo of that page
// coloured some more on paper. Colour along's line opens the picker; the photo is lined up with the guide's own
// picture or the page as printed (asked once, and kept), and the sections coloured since are offered, with Check them;
// nothing new, a photo of another page, and a ticked section that looks blank are each said. The Plan's line comes on
// opening the guide again when nothing was ticked in the visit before. Fails on v327.1 (no Tick off from a photo).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { idle, letterGuide, openApp, sampleGuide, setup, teardown, welcome } from './helpers.mjs';

before(setup);
after(teardown);

// a 1200 x 1600 page: a 5 x 7 grid of 180 px cells in 8 px lines in a blank margin, a mark in a corner cell (so only
// one turn fits); o.fills cells coloured in; o.dim the light, o.dx/o.dy moved, o.k scaled about the middle; o.rings,
// another page altogether. As a PNG
async function picture(page, o = {}) {
  const b64 = await page.evaluate(async (o) => {
    const W = 1200,
      H = 1600,
      M = 110,
      S = 180,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = o.bg || '#fff';
    g.fillRect(0, 0, W, H);
    g.translate(W / 2 + (o.dx || 0), H / 2 + (o.dy || 0));
    g.scale(o.k || 1, o.k || 1);
    g.translate(-W / 2, -H / 2);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#111';
    g.lineWidth = 8;
    if (o.rings) {
      for (let r = 60; r < 700; r += 90) {
        g.beginPath();
        g.arc(600, 800, r, 0, Math.PI * 2);
        g.stroke();
      }
    } else {
      (o.fills || []).forEach(([cx, cy, col]) => {
        g.fillStyle = col;
        g.fillRect(M + cx * S - 2, M + cy * S - 2, S + 4, S + 4);
      });
      for (let i = 0; i <= 5; i++) {
        g.beginPath();
        g.moveTo(M + i * S, M);
        g.lineTo(M + i * S, M + 7 * S);
        g.stroke();
      }
      for (let j = 0; j <= 7; j++) {
        g.beginPath();
        g.moveTo(M, M + j * S);
        g.lineTo(M + 5 * S, M + j * S);
        g.stroke();
      }
      g.fillStyle = '#111';
      g.fillRect(M + 30, M + 30, 60, 30);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (o.dim) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = o.dim;
      g.fillRect(0, 0, W, H);
    }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  }, o);
  return { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}
// (the cells coloured since: a pale yellow, a pink and a blue)
const SINCE = [
  [1, 3, 'rgb(250,236,170)'],
  [3, 1, 'rgb(240,190,210)'],
  [2, 5, 'rgb(150,180,225)'],
];
const PHOTO = { fills: SINCE, dim: 'rgb(236,234,228)', dx: 6, dy: -4, k: 0.985 };
async function guide(page, fills) {
  await sampleGuide(page);
  await page.setInputFiles('#sfFile', await picture(page, { fills }));
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !__mstest.segBusy);
  await idle(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
}
const cellsOf = (page, cells) =>
  page.evaluate(
    (cells) =>
      cells
        .map(([cx, cy]) => __mstest.labels[(110 + cy * 180 + 90) * __mstest.W + 110 + cx * 180 + 90])
        .sort((a, b) => a - b),
    cells,
  );
const ticked = (page) =>
  page.evaluate(() => [...__mstest.colored].map((x, i) => (x ? i : 0)).filter((x) => x));
const toastOn = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    return t && t.classList.contains('on') ? t.textContent : '';
  });
// a photo given to Tick off from a photo: through its button, the corners kept as they are if they're asked for
async function tickPhoto(page, file, sel = '#sfTickAlGo') {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(sel)]);
  await fc.setFiles(file);
  await page.waitForFunction(
    () =>
      document.getElementById('sfFinEd') ||
      document.getElementById('sfEdAsk') ||
      (!__mstest.tickBusy &&
        (__mstest.tickOffer || /photo/i.test(document.getElementById('msToast')?.textContent))),
    null,
    { timeout: 60000 },
  );
  if (await page.locator('#sfFinEd').count()) {
    await page.click('#sfFinEd [data-a="keep"]');
    await page.waitForFunction(
      () =>
        document.getElementById('sfEdAsk') ||
        (!__mstest.tickBusy &&
          (__mstest.tickOffer || /photo|coloured/i.test(document.getElementById('msToast')?.textContent))),
      null,
      { timeout: 60000 },
    );
  }
}
const settled = (page) =>
  page.waitForFunction(() => !__mstest.tickBusy && !document.getElementById('sfEdAsk'), null, {
    timeout: 60000,
  });

test('Tick off from a photo: lined up, asked once which page it is, the cells coloured since offered; Mark them done and Undo', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await guide(page);
  await page.click('#sfColor');
  await page.waitForFunction(() => __mstest.sfmode === 'color');
  await idle(page);
  assert.equal(
    (await page.textContent('#sfTickAl')).replace(/\s+/g, ' ').trim(),
    'Coloured on paper? Tick them off from a photo',
  );
  await tickPhoto(page, await picture(page, PHOTO));
  // the guide has its own picture, and a printout of it would line up too: asked, once
  await page.waitForSelector('#sfEdAsk');
  assert.match(
    await page.textContent('#sfEdAsk'),
    /a printout from Marker Studio, or your own copy of the page this guide was made from/,
  );
  await page.click('#sfEdAsk [data-a="o"]');
  await settled(page);
  await idle(page);
  const want = await cellsOf(page, SINCE);
  assert.deepEqual(
    [...(await page.evaluate(() => __mstest.tickOffer.secs))].sort((a, b) => a - b),
    want,
  );
  assert.match(
    await page.textContent('#sfColOffer'),
    /^3 sections look coloured since\. Mark them done · Check them$/,
  );
  assert.equal(await page.evaluate(() => __mstest.olSet.length), 3, 'outlined');
  assert.equal(await page.locator('#sfTickAl').count(), 0, 'the way in gives way to the offer');
  await page.click('#sfColGo');
  await idle(page);
  assert.deepEqual(await ticked(page), want);
  assert.match(await toastOn(page), /^Marked 3 sections done/);
  await page.click('#toastAct');
  await idle(page);
  assert.deepEqual(await ticked(page), [], 'Undo');
  assert.equal(await page.isVisible('#sfColOffer'), true, 'and the offer is back');
  // the answer is kept with the guide, and the photo isn't
  assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.tickRef), 'o');
  // again: no question now; Check them, one left out, Done
  await page.click('#sfColX');
  await tickPhoto(page, await picture(page, PHOTO));
  await settled(page);
  assert.equal(await page.locator('#sfEdAsk').count(), 0, 'not asked again');
  await page.click('#sfColCk');
  await idle(page);
  assert.equal(await page.textContent('#sfChkSum'), '3 to tick');
  await page.click('#sfChkDone');
  await idle(page);
  assert.deepEqual(await ticked(page), want);
  assert.equal(await page.evaluate(() => __mstest.tickOffer), null, 'taken');
  // (v328 review) a check left open isn't carried into the guide opened again: nothing half-applied
  await page.evaluate((l) => {
    __mstest.colored[l] = 0;
    __mstest.renderGuide();
  }, want[0]);
  await page.evaluate((l) => __mstest.colCheckOpen({ secs: [l] }), want[0]);
  await idle(page);
  assert.ok(await page.evaluate(() => !!__mstest.colCheck));
  const id = await page.evaluate(() => __mstest.curId);
  await page.evaluate((id) => loadGuide({ id }), id);
  await idle(page);
  if ((await page.evaluate(() => __mstest.sfmode)) !== 'color') {
    await page.click('#sfColor');
    await idle(page);
  }
  assert.equal(await page.locator('#sfChk').count(), 0, 'no check left over');
  assert.deepEqual(errors, []);
});

test('Tick off from a photo: nothing new, another page, and a ticked section that looks blank', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: {} });
  await guide(page);
  await page.evaluate(() => {
    __mstest.styleVars.tickRef = 'o';
  });
  await page.click('#sfColor');
  await page.waitForFunction(() => __mstest.sfmode === 'color');
  await idle(page);
  // the page as it was: nothing new
  await tickPhoto(page, await picture(page, { dim: PHOTO.dim, dx: 4 }));
  await settled(page);
  assert.match(
    await toastOn(page),
    /^Nothing looks newly coloured\. Very pale markers may not show in a photo\./,
  );
  assert.equal(await page.evaluate(() => __mstest.tickOffer), null);
  // another page
  await tickPhoto(page, await picture(page, { rings: true }));
  await settled(page);
  assert.match(
    await toastOn(page),
    /doesn’t line up with your page\. Try again with the whole page in view\./,
  );
  // a section ticked in the app that's still blank on paper: said apart, dashed in Check them
  const [blank] = await cellsOf(page, [[4, 6]]);
  await page.evaluate((l) => {
    __mstest.colored[l] = 1;
    __mstest.renderGuide();
  }, blank);
  await tickPhoto(page, await picture(page, PHOTO));
  await settled(page);
  assert.deepEqual([...(await page.evaluate(() => __mstest.tickOffer.blank))], [blank]);
  await page.click('#sfColCk');
  await idle(page);
  assert.match(
    await page.textContent('#sfChk'),
    /One ticked section doesn’t look coloured in your photo \(dashed\)\. Pale markers may not show\./,
  );
  assert.equal(await page.evaluate(() => (__mstest.olGroups || []).some((q) => q.dash)), true, 'dashed');
  await page.click('#sfChkCancel');
  assert.deepEqual(errors, []);
});

// (opened again: a new visit, after a reload; the guide that's open already, opened again, is the same visit)
async function reopen(page, id) {
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
  await idle(page);
}
test('the Plan’s line: on opening the guide again with nothing ticked in the visit before; not straight after Build', async () => {
  // (the first-time lines seen: they have their turn first)
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-seen-hints': JSON.stringify(['tap', 'along', 'strip']) },
  });
  await guide(page);
  assert.equal(await page.locator('#sfTickLine').count(), 0, 'not straight after Build');
  const id = await page.evaluate(() => __mstest.curId);
  await page.evaluate(() => {
    __mstest.guideDirty = true;
  });
  await idle(page, 2300);
  await reopen(page, id);
  assert.equal(
    (await page.textContent('#sfTickLine')).replace(/\s+/g, ' ').trim(),
    'Coloured some on paper since? Tick them off from a photo',
  );
  // ✕: gone until the next opening
  await page.click('#sfTickX');
  assert.equal(await page.locator('#sfTickLine').count(), 0);
  // a visit with ticks: the next opening has no line
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.slice(0, 2).forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.renderGuide();
    t.updateProgress();
  });
  await idle(page, 2300);
  // (counted on this device as the ticks change)
  assert.equal(
    await page.evaluate((id) => JSON.parse(localStorage.getItem('ms-tick-visits'))['g' + id], id),
    2,
  );
  await reopen(page, id);
  assert.equal(await page.locator('#sfTickLine').count(), 0, 'ticked in the visit before');
  assert.deepEqual(errors, []);
});

test('a guide opened again: its picture is read from this device for the photo to be lined up with', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // (a cell coloured before the guide was made: against the page as printed it would read as coloured since)
  const BEFORE = [[4, 0, 'rgb(232,96,96)']];
  await guide(page, BEFORE);
  const id = await page.evaluate(() => {
    __mstest.styleVars.tickRef = 'o';
    __mstest.guideDirty = true;
    return __mstest.curId;
  });
  await idle(page, 2300);
  await reopen(page, id);
  assert.equal(await page.evaluate(() => __mstest.styleVars.tickRef), 'o', 'kept with the guide');
  await page.click('#sfColor');
  await page.waitForFunction(() => __mstest.sfmode === 'color');
  await idle(page);
  await tickPhoto(page, await picture(page, PHOTO));
  await settled(page);
  assert.deepEqual(
    [...(await page.evaluate(() => (__mstest.tickOffer ? __mstest.tickOffer.secs : [])))].sort(
      (a, b) => a - b,
    ),
    await cellsOf(page, SINCE),
  );
  assert.deepEqual(errors, []);
});

// (v328 review) Colour along's link takes the taps on its own words: on a phone the first-time hint's More sits just
// above them, and More's tap strip under it had taken them (the photo picker never opened)
test('Colour along: Tick them off from a photo takes the taps on its words, More keeps its own, on a phone and an iPad', async () => {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [820, 1180],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h, touch: true });
    await welcome(page, 'look');
    await letterGuide(page);
    await page.click('#sfColor');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = document.getElementById('sfTickAlGo'),
        m = document.getElementById('sfAlMore');
      t.scrollIntoView({ block: 'center' });
      const at = (x, y) => {
          const e = document.elementFromPoint(x, y);
          return e ? e.id : '';
        },
        rt = t.getBoundingClientRect(),
        rm = m.getBoundingClientRect(),
        // (the words' own box: the link's padding, 1 px above and 9 below, taken off)
        y0 = rt.top + 1,
        y1 = rt.bottom - 9,
        xs = [rt.left + 4, rt.left + rt.width / 2, rt.right - 4];
      return {
        tick: xs.flatMap((x) => [at(x, y0 + 1), at(x, (y0 + y1) / 2), at(x, y1 - 1)]),
        more: [at(rm.left + rm.width / 2, rm.top + 1), at(rm.left + rm.width / 2, rm.bottom - 1)],
      };
    });
    assert.ok(
      r.tick.every((id) => id === 'sfTickAlGo'),
      w + ': ' + r.tick.join(' '),
    );
    assert.deepEqual(r.more, ['sfAlMore', 'sfAlMore'], w + ' More');
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 8000 }),
      page.click('#sfTickAlGo'),
    ]);
    assert.ok(fc, w + ': the picker');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
