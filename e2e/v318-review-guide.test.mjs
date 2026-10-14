// v318 review (the guide's workflow, end to end). Each test fails on v318 as released.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  setup,
  teardown,
  openApp,
  idle,
  sampleGuide,
  letterGuide,
  saveGuide,
  sectionPoint,
  scrollTop,
} from './helpers.mjs';

before(setup);
after(teardown);

// the sample's sections, biggest first
const biggest = (page) =>
  page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area);
  });

// The sample isn't in the Library until something changes it: finished by its last tick, it was saved then, but the
// Page finished panel had no "Add a photo of your page" until Colour along was left and opened again.
test('a page finished as its guide is first saved offers Add a photo of your page at once', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.inLibrary), false, 'the sample isn’t in the Library yet');
  await page.click('#sfColor');
  await idle(page);
  const order = await biggest(page);
  await page.evaluate((rest) => {
    const t = __mstest;
    rest.forEach((l) => (t.colored[l] = 1));
    t.renderGuide();
  }, order.slice(1));
  await scrollTop(page);
  const p = await sectionPoint(page, order[0]);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: 10000 });
  await idle(page);
  assert.ok(await page.isVisible('#sfFin .sffinadd'), 'Add a photo of your page is offered');
  assert.deepEqual(errors, []);
});

// A tap on a faded section (another marker's) asks first, beside it (the review's second pass; a toast's Undo before
// it, still on screen after another guide was opened, had unticked that guide's section of the same number). The
// question goes as another guide opens, and that guide's ticks are as they were.
test('the question over a faded section goes as another guide opens, which keeps its ticks', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.click('#mSections');
  await idle(page);
  // guide B (the letter page) with every section ticked, in the Library
  await letterGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.forEach((l) => (t.colored[l] = 1));
    t.guideDirty = true;
    t.renderGuide();
  });
  await saveGuide(page);
  await idle(page, 2300);
  const idB = await page.evaluate(() => __mstest.curId);
  // guide A (the sample): a marker's row open, a tap on another marker's section
  await page.evaluate(() => SF.loadSample());
  await idle(page, 1500);
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
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  assert.ok(await page.isVisible('.sftip.sftipask'), 'asked');
  // B opened from the Library while the question is up
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  await page.click(`#savedList .srow[data-id="${idB}"] .smeta`);
  await page.waitForFunction((id) => __mstest.curId === id && !!__mstest.assignData, idB, { timeout: 15000 });
  const before = await page.evaluate(() => Array.from(__mstest.colored).join(''));
  await idle(page);
  assert.equal(await page.isVisible('.sftip.sftipask'), false, 'the question gone');
  await page.evaluate(() => {
    const b = document.querySelector('.sftipask [data-a="tick"]');
    if (b) b.click();
  });
  await idle(page);
  assert.equal(
    await page.evaluate(() => Array.from(__mstest.colored).join('')),
    before,
    'B’s ticks as they were',
  );
  assert.deepEqual(errors, []);
});

// A finger drifts a few pixels as it taps. The picture took any move over 4 px (across and down added) as a drag, so
// a tap that rolled 3 across and 2 down ticked nothing.
test('a finger’s tap that drifts a few pixels still ticks its section; a drag doesn’t', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await scrollTop(page);
  const [a, b] = await biggest(page);
  const touchTap = async (l, dx, dy, type = 'touch') => {
    const p = await sectionPoint(page, l);
    await page.evaluate(
      ({ x, y, dx, dy, type }) => {
        const c = document.getElementById('sfCanvas'),
          o = {
            bubbles: true,
            cancelable: true,
            pointerId: 11,
            pointerType: type,
            isPrimary: true,
            button: 0,
          };
        c.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1, clientX: x, clientY: y }));
        c.dispatchEvent(
          new PointerEvent('pointermove', { ...o, buttons: 1, clientX: x + dx / 2, clientY: y + dy / 2 }),
        );
        c.dispatchEvent(
          new PointerEvent('pointermove', { ...o, buttons: 1, clientX: x + dx, clientY: y + dy }),
        );
        c.dispatchEvent(
          new PointerEvent('pointerup', { ...o, buttons: 0, clientX: x + dx, clientY: y + dy }),
        );
      },
      { x: p.x, y: p.y, dx, dy, type },
    );
    await idle(page);
    return page.evaluate((l) => __mstest.colored[l], l);
  };
  assert.equal(await touchTap(a, 4, 3), 1, 'a finger’s tap that rolled 4 across and 3 down ticks');
  assert.equal(await touchTap(b, 18, 12), 0, 'a drag ticks nothing');
  assert.equal(await touchTap(b, 4, 3, 'mouse'), 0, 'a mouse that moved as far is still a drag, as before');
  assert.deepEqual(errors, []);
});

// A picture wider than it's tall had its colouring page printed across the top of an upright sheet. Page 1 is now on
// its side when that prints the picture at least 10% bigger each way; the other pages stay upright, and a tall page
// stays upright too.
async function widePage(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1500;
    c.height = 1000;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 1500, 1000);
    g.strokeStyle = '#000';
    g.lineWidth = 8;
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++) g.strokeRect(60 + i * 230, 60 + j * 220, 210, 200);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
  await page.click('#sfBuild');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 60000,
  });
  await idle(page);
}
async function pdfBoxes(page) {
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await idle(page);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
  const s = (await readFile(await dl.path())).toString('latin1');
  await page.keyboard.press('Escape');
  await idle(page);
  return [...s.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => [+m[1], +m[2]]);
}
test('a wide picture’s colouring page prints on its side; the key and a tall picture’s pages stay upright', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const tall = await pdfBoxes(page);
  await page.click('#sfPrint');
  await idle(page);
  assert.doesNotMatch(await page.textContent('#sfPrSum'), /landscape/);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.ok(
    tall.every(([w, h]) => w === 612 && h === 792),
    'the sample: every page upright Letter ' + JSON.stringify(tall),
  );
  await widePage(page);
  // the Print sheet says so
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await idle(page);
  assert.match(await page.textContent('#sfPrSum'), /page 1 landscape/);
  await page.keyboard.press('Escape');
  await idle(page);
  const wide = await pdfBoxes(page);
  assert.deepEqual(wide[0], [792, 612], 'page 1 on its side');
  assert.ok(wide.length >= 2, 'a key page too');
  assert.ok(
    wide.slice(1).every(([w, h]) => w === 612 && h === 792),
    'the other pages upright ' + JSON.stringify(wide),
  );
  // the picture fills the page across, as wide as it can be within the margins
  const r = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      od = P.drawImage,
      imgs = [];
    P.drawImage = function (img, x, y, w, h) {
      if (arguments.length === 5) imgs.push({ cv: this.canvas, w, h });
      return od.apply(this, arguments);
    };
    let cvs;
    try {
      cvs = __mstest.buildPDFPages();
    } finally {
      P.drawImage = od;
    }
    const a = imgs.find((e) => e.cv === cvs[0] && e.w > 100);
    return { pw: cvs[0].width, ph: cvs[0].height, w: a && a.w };
  });
  assert.ok(r.pw > r.ph, 'page 1 drawn wider than tall');
  assert.ok(r.w > r.pw * 0.8, `the picture across the page: ${Math.round(r.w)} of ${r.pw}`);
  assert.deepEqual(errors, []);
});

// Colour along with a row open: its sections still to do are outlined. A tick drew the outline again whole (32 copies
// of a mask over the box round them all), most of a tick's time on a big page; now only round the section ticked. The
// outline must come out exactly as drawn whole.
test('a tick redraws the open row’s outline only round its section, exactly as a whole redraw', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  // the marker with the most sections, and three of them well inside the box round the rest
  const k = await page.evaluate(() => {
    const t = __mstest,
      n = {};
    t.assignData.order.forEach((l) => {
      const m = t.assignData.assign[l].mkey;
      n[m] = (n[m] || 0) + 1;
    });
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0];
  });
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  await scrollTop(page);
  const pick = await page.evaluate((k) => {
    const t = __mstest,
      W = t.W,
      box = {};
    t.labels.forEach((v, p) => {
      if (v < 1) return;
      const x = p % W,
        y = (p / W) | 0,
        b = box[v] || (box[v] = [x, y, x, y]);
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    });
    const secs = t.assignData.order.filter((l) => t.assignData.assign[l].mkey === k),
      e = [0, 1, 2, 3].map((i) => (i < 2 ? Math.min : Math.max)(...secs.map((l) => box[l][i])));
    return secs
      .filter(
        (l) =>
          box[l][0] > e[0] + 20 && box[l][1] > e[1] + 20 && box[l][2] < e[2] - 20 && box[l][3] < e[3] - 20,
      )
      .slice(0, 3);
  }, k);
  assert.equal(pick.length, 3);
  const outline = () =>
    page.evaluate(() => {
      const c = document.querySelector('.sfoutline'),
        d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      return { w: c.width, h: c.height, left: c.style.left, top: c.style.top, px: Array.from(d).join() };
    });
  const before = await outline();
  // (the outline's working canvases drawn during the ticks: none as big as the outline itself)
  await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      od = P.drawImage;
    window.__olBig = 0;
    P.drawImage = function (img) {
      const c = document.querySelector('.sfoutline');
      if (c && img instanceof HTMLCanvasElement && img.width === c.width && img.height === c.height)
        window.__olBig++;
      return od.apply(this, arguments);
    };
  });
  for (const l of pick) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  assert.equal(await page.evaluate(() => window.__olBig), 0, 'no whole-outline drawing for a tick');
  assert.deepEqual(await page.evaluate((s) => s.map((l) => __mstest.colored[l]), pick), [1, 1, 1]);
  const part = await outline();
  assert.notEqual(part.px, before.px, 'the outline changed');
  // the row closed and opened again: drawn whole
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  await scrollTop(page);
  const whole = await outline();
  assert.deepEqual([part.w, part.h, part.left, part.top], [whole.w, whole.h, whole.left, whole.top]);
  assert.ok(part.px === whole.px, 'the same pixels');
  assert.deepEqual(errors, []);
});

// The tool row was fitted to its width (each try a layout of the page) twice at every tick; now only when something it
// depends on changes. A figure gaining a digit still fits it again, and it still fits.
test('a tick doesn’t fit the tool row again unless its status changes shape; it still fits', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await scrollTop(page);
  await page.evaluate(() => {
    const z = document.getElementById('sfZoomCtl'),
      rm = DOMTokenList.prototype.remove;
    window.__fits = 0;
    DOMTokenList.prototype.remove = function () {
      if (this === z.classList && arguments[0] === 'sfzc1') window.__fits++;
      return rm.apply(this, arguments);
    };
  });
  const order = await biggest(page);
  const tap = async (l) => {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  };
  // 1 to 2 coloured: the same shape
  await tap(order[0]);
  const n1 = await page.evaluate(() => window.__fits);
  await tap(order[1]);
  assert.equal(await page.evaluate(() => window.__fits), n1, 'not fitted again for 2 of 166');
  // 9 to 10: one more digit, fitted again
  await page.evaluate(
    (s) => {
      const t = __mstest;
      s.forEach((l) => (t.colored[l] = 1));
    },
    order.slice(2, 9),
  );
  await tap(order[9]);
  assert.match(await page.textContent('#sfStat'), /10\sof\s166/);
  assert.ok((await page.evaluate(() => window.__fits)) > n1, 'fitted again for 10 of 166');
  const fit = await page.evaluate(() => {
    const z = document.getElementById('sfZoomCtl'),
      st = document.getElementById('sfStat');
    return z.scrollWidth <= z.clientWidth + 1 && st.scrollWidth <= st.clientWidth + 1;
  });
  assert.ok(fit, 'the row fits');
  assert.deepEqual(errors, []);
});

// Each save asked whether the sections had been edited since the guide was built, by reading every pixel of the
// section map: a hitch a moment after every tick on a big page. Out of Edit sections the answer is kept; an edit there
// is still noticed.
test('saving after ticks doesn’t read the whole section map each time; a section edit is still noticed', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await scrollTop(page);
  const order = await biggest(page);
  const p0 = await sectionPoint(page, order[0]);
  await page.mouse.click(p0.x, p0.y);
  await idle(page, 2300);
  const n0 = await page.evaluate(() => __mstest.labelsSigN);
  assert.equal(typeof n0, 'number', 'the reads are counted');
  for (const l of order.slice(1, 4)) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    // (auto-save 1.5 s later)
    await idle(page, 2300);
  }
  assert.equal(await page.evaluate(() => __mstest.saveErr), false);
  assert.equal(await page.evaluate(() => __mstest.labelsSigN), n0, 'three saves, no reading of the map');
  // Edit sections: a merge, and the guide knows its sections are edited and not built
  await page.click('#sfDoneBtn');
  await idle(page);
  await page.click('#sfBack2');
  await idle(page);
  await scrollTop(page);
  const [a, b] = await page.evaluate(() => {
    const t = __mstest,
      cl = t.countedList(),
      W = t.W,
      L = t.labels;
    for (const x of cl)
      for (let i = 0; i < L.length; i++)
        if (L[i] === x)
          for (const d of [3, 3 * W]) {
            const y = L[i + d];
            if (y > 0 && y !== x && cl.includes(y) && t.comps[x].area > 400 && t.comps[y].area > 400)
              return [x, y];
          }
    return [cl[0], cl[1]];
  });
  await page.click('#sfEdit [data-m="merge"]');
  for (const l of [a, b]) {
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  assert.equal(await page.evaluate(() => __mstest.secEdPending()), true, 'the merge is an edit not built');
  assert.equal(
    await page.evaluate(() => __mstest.currentDesignObj()),
    null,
    'not saved as the guide as built',
  );
  assert.deepEqual(errors, []);
});
