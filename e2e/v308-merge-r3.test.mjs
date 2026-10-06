// v308 debug (reviewer 3): getting a picture in and what comes out of a guide, after the branches were merged.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

const opt = (page, o) =>
  page.evaluate((o) => {
    for (const k in o) __mstest.pdfOpt(k, o[k]);
  }, o);
// the texts drawn on the PDF's pages, in the order drawn
const pdfTexts = (page) =>
  page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      of = P.fillText,
      log = [];
    P.fillText = function (t, x, y) {
      const tr = this.getTransform();
      log.push({
        cv: this.canvas,
        t: String(t),
        y,
        al: this.textAlign,
        fill: this.fillStyle,
        id: tr.a === 1 && tr.e === 0,
      });
      return of.apply(this, arguments);
    };
    let cvs;
    try {
      cvs = __mstest.buildPDFPages();
    } finally {
      P.fillText = of;
    }
    return log
      .filter((e) => cvs.indexOf(e.cv) >= 0)
      .map((e) => ({ p: cvs.indexOf(e.cv), t: e.t, y: e.y, al: e.al, fill: e.fill, id: e.id }));
  });

test('Codes with numbers for the small sections: the key is in number order, so "14" on the page is the 14th row', async () => {
  // (Ben's 451 markers, every one the page can take, Half Letter: small sections get the marker's number. v308 made
  // the numbers the colouring order but left the key by colour family, so they came 8, 12, 13, 4, 6, 1 …)
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
    SF.setCollection(sfCollection());
    __mstest.styleVars.limitN = 999;
    SF.reassign();
  });
  await idle(page);
  await opt(page, { pwhat: 'page', plabels: 'codes', paper: 'half', blend: false });
  const t = await pdfTexts(page);
  const keyP = t.find((e) => e.t === 'Colour key').p,
    onKey = t.filter((e) => e.p >= keyP && e.id);
  const onPage = t.filter((e) => e.p < keyP && !e.id && /^\d+$/.test(e.t)).map((e) => +e.t);
  assert.ok(onPage.length, 'numbers on the colouring page or its close-ups');
  assert.ok(
    onKey.some((e) => e.t === 'NO.'),
    'NO. heads the column',
  );
  const nums = onKey
    .filter((e) => e.al === 'right' && /^\d+$/.test(e.t) && /^#(a0a0a0|111111)$/.test(e.fill))
    .map((e) => +e.t);
  const n = await page.evaluate(
    () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
  );
  assert.deepEqual(
    nums,
    Array.from({ length: n }, (_, i) => i + 1),
    'the key’s rows in number order',
  );
  assert.ok(
    onPage.every((v) => v >= 1 && v <= n),
    'each number on the page is a row of the key',
  );
  assert.deepEqual(errors, []);
});

test('the screen-on note is seen at every size: in the tool row where it fits, else as a toast (side by side, a phone)', async () => {
  const init = () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: () => Promise.resolve({ addEventListener() {}, release() {} }) },
      configurable: true,
    });
  };
  for (const [w, h, where] of [
    [1180, 820, 'toast'],
    [390, 844, 'toast'],
    [820, 1180, 'row'],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h, init });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await page.waitForFunction(
      () =>
        /screen stays on/.test(document.getElementById('msToast')?.textContent || '') ||
        /screen stays on/.test(document.getElementById('sfStat').textContent),
    );
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await page.evaluate(() => {
      const t = document.getElementById('msToast'),
        s = document.querySelector('#sfStat .sfsp2');
      return {
        toast: !!t && t.classList.contains('on') && /screen stays on/.test(t.textContent),
        row: !!s && s.getBoundingClientRect().width > 0 && /screen stays on/.test(s.textContent),
      };
    });
    assert.equal(r.toast, where === 'toast', `${w}×${h}: a toast`);
    assert.equal(r.row, where === 'row', `${w}×${h}: in the tool row`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
