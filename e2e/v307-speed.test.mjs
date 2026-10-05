// v307 speed work, in the browser: the PDF is drawn a page at a time and packed in the worker, Save image and a new
// guide's section map are encoded there, label points are worked out there and kept for the session, Continue paints
// once, and Home decodes its pictures before drawing them. Each gives exactly what the page gives doing it all itself.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, welcome, sampleGuide, letterGuide, saveGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const sharePrint = async (page) => {
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
};
// the PDF as the page writes it with everything drawn first and packed here (no worker): what v306 did
const pdfHere = (page) =>
  page.evaluate(async () => {
    const t = __mstest,
      P = { letter: [612, 792], a4: [595.28, 841.89] }[localStorage.getItem('ms-paper') || 'letter'] || [
        612, 792,
      ];
    const u8 = await t.canvasesToPDF(t.buildPDFPages(false, false), P[0], P[1], false);
    return Array.from(u8);
  });
const stats = (page) => page.evaluate(() => JSON.parse(JSON.stringify(__mstest.jobs.stats)));
// a downloaded PNG's pixels, as a hash
const pngHash = (page, buf) =>
  page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
      bm = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bm.width;
    c.height = bm.height;
    const g = c.getContext('2d');
    g.drawImage(bm, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let a = 2166136261 | 0;
    for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619);
    return c.width + 'x' + c.height + ':' + a;
  }, buf.toString('base64'));

test('the PDF is drawn a page at a time ("Page 2 of 3…"), packed in the worker, and is the same file byte for byte', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look');
  await letterGuide(page);
  // with shading too: tone lines and H/S marks on page 1, the coloured picture on the key
  for (const shade of [false, true]) {
    if (shade) {
      await page.click('.sftabbtn[data-t="shading"]');
      await page.click('#sfShade [data-v="full"]');
      await idle(page);
    }
    await sharePrint(page);
    await page.evaluate(() => {
      // the button's words as the PDF is written, and how many whole pages are drawn at once
      const f = (window.__pg = { txt: [], live: 0, most: 0 }),
        b = () => document.getElementById('sfPDF');
      new MutationObserver(() => {
        const t = b() && b().textContent;
        if (t && f.txt[f.txt.length - 1] !== t) f.txt.push(t);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
      const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
      Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
        configurable: true,
        get() {
          return d.get.call(this);
        },
        set(v) {
          const was = d.get.call(this) === 1700;
          d.set.call(this, v);
          const is = v === 1700;
          if (is && !was) {
            f.live++;
            f.most = Math.max(f.most, f.live);
          } else if (was && !is) f.live--;
        },
      });
      window.__pgUndo = () => Object.defineProperty(HTMLCanvasElement.prototype, 'width', d);
    });
    const s0 = await stats(page);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
    const got = await readFile(await dl.path());
    await idle(page);
    const pg = await page.evaluate(() => {
      __pgUndo();
      return window.__pg;
    });
    const n = await page.evaluate(() => __mstest.buildPDFPages(true));
    assert.ok(n >= 2, 'more than one page');
    for (let i = 2; i <= n; i++)
      assert.ok(pg.txt.includes(`Page ${i} of ${n}…`), `"Page ${i} of ${n}…" shown (${pg.txt.join(' | ')})`);
    assert.ok(
      pg.most <= 2 && pg.most < n,
      `a page’s canvas at a time (and the one before, until its pixels are packed): ${pg.most} of ${n}`,
    );
    assert.equal(await page.textContent('#sfPDF'), 'Download PDF', 'the button back as it was');
    const s1 = await stats(page);
    assert.equal((s1.done.pdf || 0) - (s0.done.pdf || 0), n, 'each page packed in the worker');
    await page.click('#sfSheet [data-pr="cancel"]');
    await idle(page);
    // the same bytes as drawn all at once and packed here, without a worker
    await page.evaluate(() => __mstest.jobs.off());
    const ref = Buffer.from(await pdfHere(page));
    await page.evaluate(() => __mstest.jobs.off(false));
    assert.equal(got.length, ref.length, (shade ? 'shaded: ' : '') + 'same size');
    assert.ok(got.equals(ref), (shade ? 'shaded: ' : '') + 'same bytes');
  }
  assert.deepEqual(errors, []);
});

test('Save image is encoded in the worker, with the same pixels; a new guide’s section map is encoded there before its first save, the same file', async () => {
  // (v307.1: the first save waits for the worker only while the Build bloom shows, so this test has the bloom; with
  // none it's saved at once, encoded on the page: v307-hotfix)
  const { page, errors } = await openApp({ width: 1180, height: 820, init: () => { window.__MS_BLOOM = true; } });
  await welcome(page, 'look');
  await letterGuide(page);
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
  // the first save after Build: its section map from the worker, the file the page makes itself
  assert.ok((await stats(page)).done.lmap >= 1, 'section map encoded in the worker');
  assert.equal(
    await page.evaluate(() => __mstest.lmapKept === __mstest.lmapHere()),
    true,
    'the same file as encoded here',
  );
  const saved = await page.evaluate(() =>
    sfLoadDesign(__mstest.curId).then((d) => d.lmap === __mstest.lmapHere()),
  );
  assert.equal(saved, true, 'and the one saved');
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  let [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfExport')]);
  const a = await pngHash(page, await readFile(await dl.path()));
  await idle(page);
  assert.ok((await stats(page)).done.png >= 1, 'encoded in the worker');
  // the same picture encoded here, with no worker
  await page.evaluate(() => __mstest.jobs.off());
  [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfExport')]);
  const b = await pngHash(page, await readFile(await dl.path()));
  await idle(page);
  assert.equal(a, b, 'the same pixels');
  assert.deepEqual(errors, []);
});

test('opening a guide: label points from the worker, kept for the session, the same as worked out here; the guide opens as saved', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await saveGuide(page);
  const sampleId = await page.evaluate(() => __mstest.curId);
  await letterGuide(page);
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
  const id = await page.evaluate(() => __mstest.curId);
  const look = () =>
    page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj();
      return {
        pts: JSON.stringify(t.labelPts),
        assign: JSON.stringify(d.payload.assign),
        lmap: d.payload.lmap,
        n: t.assignData.order.length,
        mk: [...new Set(Object.values(t.assignData.assign).map((m) => m.mkey))].sort().join(),
      };
    });
  const before = await look();
  // after a reload (nothing kept), opened from the Library: worked out in the worker
  await page.reload();
  await idle(page);
  let s0 = await stats(page);
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
  let s1 = await stats(page);
  assert.equal((s1.done.lpts || 0) - (s0.done.lpts || 0), 1, 'worked out in the worker');
  const opened = await look();
  assert.deepEqual(opened, before, 'the same label points, markers and section map as when it was saved');
  // worked out here instead: the same
  assert.equal(
    await page.evaluate(() => {
      const t = __mstest,
        k = JSON.stringify(t.labelPts);
      return JSON.stringify(t.labelPtsCore(t.labels, t.W, t.H, t.comps.length).lp) === k;
    }),
    true,
  );
  // another guide, then this one again: kept, not worked out again
  await page.evaluate((id) => SF.openDesign(id), sampleId);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, sampleId);
  await idle(page);
  s0 = await stats(page);
  await page.evaluate((id) => SF.openDesign(id), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
  s1 = await stats(page);
  assert.equal(s1.done.lpts || 0, s0.done.lpts || 0, 'kept for the session');
  assert.deepEqual(await look(), before);
  assert.deepEqual(errors, []);
});

test('Home’s Continue paints the picture once; Home decodes the pictures before drawing them', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  await letterGuide(page);
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest,
      o = t.assignData.order;
    o.slice(0, 7).forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.updateProgress();
    t.renderGuide();
  });
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  await page.click('#sfDoneBtn');
  await idle(page);
  // a fresh start, so Home draws its pictures and Continue opens the guide from the Library
  await page.addInitScript(() => {
    const o = HTMLImageElement.prototype.decode;
    window.__dec = 0;
    HTMLImageElement.prototype.decode = function () {
      window.__dec++;
      return o.apply(this, arguments);
    };
  });
  await page.reload();
  await idle(page);
  await page.click('#mHome');
  await page.waitForSelector('#homeCont img');
  await idle(page);
  assert.ok((await page.evaluate(() => window.__dec)) >= 1, 'decoded before drawing');
  await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      o = P.putImageData;
    window.__full = 0;
    P.putImageData = function (im) {
      if (this.canvas.id === 'sfCanvas' && im.width === this.canvas.width && im.height === this.canvas.height)
        __full++;
      return o.apply(this, arguments);
    };
  });
  await page.click('#homeCont .hccard');
  await page.waitForFunction(() => __mstest.sfmode === 'color');
  await idle(page);
  assert.equal(await page.evaluate(() => window.__full), 1, 'one full paint');
  assert.deepEqual(errors, []);
});
