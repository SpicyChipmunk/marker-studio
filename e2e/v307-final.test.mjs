// v307 (final): a worker that never answers (a test hook: __mstest.jobs.hang) leaves nothing stuck: opening a guide,
// Build, the PDF and Save image each finish on the page after a while, with the same results; Home's latest piece
// keeps "+ 21 for shading" on one line on a phone; Help › Your data's shorter iPhone and iPad item; "That already
// looks white" in Palette › From photo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  setup,
  teardown,
  openApp,
  welcome,
  sampleGuide,
  letterGuide,
  saveGuide,
  idle,
  until,
} from './helpers.mjs';

before(setup);
after(teardown);

// how long each job is given while the worker answers nothing (the app's own times are seconds: 03-jobs jobBudget)
const HANG = 300;
const stats = (page) => page.evaluate(() => JSON.parse(JSON.stringify(__mstest.jobs.stats)));
const hang = (page) => page.evaluate((ms) => __mstest.jobs.hang(ms), HANG);
// every text the guide's status line, the toast and a button showed from now on
const watch = (page, sel) =>
  page.evaluate((sel) => {
    const f = (window.__seen = []),
      add = (t) => t && f[f.length - 1] !== t && f.push(t);
    new MutationObserver(() => {
      for (const s of ['#sfMeta', '#msToast.on', sel]) {
        const e = s && document.querySelector(s);
        if (e) add(s + ': ' + e.textContent.trim());
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  }, sel || null);
const seen = (page) => page.evaluate(() => window.__seen);
// what's showing now that says something is still going on
const busyNow = (page) =>
  page.evaluate(() =>
    ['#sfMeta', '#msToast.on', '#sfPDF', '#sfBuild', '#sfExport']
      .map((s) => document.querySelector(s))
      .filter((e) => e && e.offsetParent !== null && /…\s*$/.test(e.textContent))
      .map((e) => e.id + ': ' + e.textContent.trim()),
  );

test('a worker that never answers: a guide opened from the Library opens on the page after a while, as it was saved, without staying on "Opening guide…"', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await saveGuide(page);
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
      };
    });
  const was = await look();
  // after a reload, so its label points aren't kept from before
  await page.reload();
  await idle(page);
  await hang(page);
  const s0 = await stats(page);
  await watch(page);
  await page.evaluate((id) => SF.openDesign(id), id);
  await until(page, (id) => __mstest.curId === id && !!__mstest.assignData, id, 'the guide open');
  await idle(page);
  const s1 = await stats(page);
  assert.equal(
    (s1.timedOut.lpts || 0) - (s0.timedOut.lpts || 0),
    1,
    'its label points weren’t answered in time',
  );
  assert.equal(s1.done.lpts || 0, s0.done.lpts || 0);
  assert.equal(await page.evaluate(() => __mstest.jobs.on), false, 'the worker given up on for the session');
  assert.ok(
    (await seen(page)).some((t) => /Opening guide…/.test(t)),
    'it said "Opening guide…" meanwhile: ' + (await seen(page)).join(' | '),
  );
  assert.deepEqual(await busyNow(page), [], 'nothing left saying it’s still working');
  assert.deepEqual(await look(), was, 'the same label points, markers and section map as when it was saved');
  assert.deepEqual(errors, []);
});

test('a worker that never answers: Build finishes on the page, and the new guide saves the same section map', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look');
  await idle(page);
  await hang(page);
  await letterGuide(page);
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
  const s = await stats(page);
  assert.equal(s.timedOut.lpts, 1, 'Build’s label points timed out');
  assert.equal(s.done.lpts || 0, 0);
  assert.equal(
    await page.evaluate(() => sfLoadDesign(__mstest.curId).then((d) => d.lmap === __mstest.lmapHere())),
    true,
    'the section map saved is the one encoded here',
  );
  assert.deepEqual(await busyNow(page), []);
  assert.deepEqual(errors, []);
});

test('a worker that never answers: the PDF finishes on the page, the same file byte for byte, and the button doesn’t stay on "Page 1 of N…"', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await welcome(page, 'look');
  await letterGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  // (the worker's warm-up on opening the sheet answered first: the PDF's own page is the job that hangs)
  await idle(page);
  await hang(page);
  await watch(page, '#sfPDF');
  const s0 = await stats(page);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
  const got = await readFile(await dl.path());
  await idle(page);
  const s1 = await stats(page);
  assert.equal((s1.timedOut.pdf || 0) - (s0.timedOut.pdf || 0), 1, 'a page timed out');
  assert.equal(s1.done.pdf || 0, s0.done.pdf || 0, 'none came from the worker');
  assert.ok(
    (await seen(page)).some((t) => /^#sfPDF: Page 1 of \d+…$/.test(t)),
    (await seen(page)).join(' | '),
  );
  assert.equal(await page.textContent('#sfPDF'), 'Download PDF', 'the button back as it was');
  assert.deepEqual(await busyNow(page), []);
  // the PDF drawn all at once and packed here, as v306 did
  const ref = Buffer.from(
    await page.evaluate(async () => {
      const t = __mstest,
        P = { letter: [612, 792], a4: [595.28, 841.89] }[localStorage.getItem('ms-paper') || 'letter'] || [
          612, 792,
        ];
      return Array.from(await t.canvasesToPDF(t.buildPDFPages(false, false), P[0], P[1], false));
    }),
  );
  assert.ok(got.equals(ref), 'the same bytes');
  assert.deepEqual(errors, []);
});

test('a worker that never answers: Save image finishes on the page, with the same pixels as the worker gives', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await idle(page);
  await page.click('.sftabbtn[data-t="share"]');
  await idle(page);
  const pngHash = (buf) =>
    page.evaluate(async (b64) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
        bm = await createImageBitmap(new Blob([bin], { type: 'image/png' })),
        c = document.createElement('canvas');
      c.width = bm.width;
      c.height = bm.height;
      const g = c.getContext('2d');
      g.drawImage(bm, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let a = 2166136261 | 0;
      for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619);
      return c.width + 'x' + c.height + ':' + a;
    }, buf.toString('base64'));
  const save = async () => {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.click('#sfExport'),
    ]);
    const h = await pngHash(await readFile(await dl.path()));
    await idle(page);
    return h;
  };
  // from the worker first
  const a = await save();
  const s0 = await stats(page);
  assert.ok(s0.done.png >= 1, 'encoded in the worker');
  // then with a worker that never answers
  await hang(page);
  await watch(page, '#sfExport');
  const b = await save();
  const s1 = await stats(page);
  assert.equal((s1.timedOut.png || 0) - (s0.timedOut.png || 0), 1, 'timed out');
  assert.equal(s1.done.png, s0.done.png);
  assert.equal(b, a, 'the same pixels');
  assert.deepEqual(await busyNow(page), []);
  assert.deepEqual(errors, []);
});

// ---- Home's latest piece on a phone --------------------------------------------------------------------------------
test('Home’s latest piece on a phone: "16 markers" and "+ 21 for shading" each stay on one line, breaking only before the "+"', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await saveGuide(page);
  // finished, with shading
  await page.evaluate(() => {
    const t = __mstest;
    t.shadeMode = 'full';
    t.assignData.order.forEach((l) => {
      t.colored[l] = 1;
    });
    t.guideDirty = true;
    t.renderGuide();
    t.checkComplete();
    t.updateProgress();
    t.saveNow();
  });
  await idle(page, 2300);
  await page.click('#mHome');
  await idle(page);
  // each character's line (its top), by the words it's in
  const lines = () =>
    page.evaluate(() => {
      const m = document.querySelector('#homeHero .hhmeta'),
        out = [];
      const walk = (n) => {
        if (n.nodeType === 3)
          for (let i = 0; i < n.data.length; i++) {
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const b = r.getBoundingClientRect();
            if (b.width) out.push([n.data[i], Math.round(b.top)]);
          }
        else n.childNodes.forEach(walk);
      };
      walk(m);
      return { text: m.textContent, chars: out };
    });
  const check = (l, why) => {
    const m = /^(\d+ sections · )(\d+ markers) (\+ \d+ for shading)$/.exec(l.text);
    assert.ok(m, l.text);
    const at = (from, len) =>
      new Set(
        l.chars
          .slice(from, from + len)
          .filter((c) => c[0] !== ' ')
          .map((c) => c[1]),
      );
    const mk = at(m[1].length, m[2].length),
      sh = at(m[1].length + m[2].length + 1, m[3].length);
    assert.equal(mk.size, 1, why + ': "' + m[2] + '" on one line');
    assert.equal(sh.size, 1, why + ': "' + m[3] + '" on one line');
    return [...mk][0] !== [...sh][0];
  };
  assert.equal(check(await lines(), 'the sample'), true, 'the line breaks before the "+"');
  // more markers than that (Ben's 166): the same
  await page.evaluate(() => {
    const g = state.saved.find((s) => s.id === __mstest.curId),
      el = document.getElementById('homeHero');
    el.removeAttribute('data-hid');
    homeHero(Object.assign({}, g, { n: 312, done: 312, keys: [...defaultOwned()].slice(0, 166), sk: 61 }));
  });
  check(await lines(), '166 markers');
  assert.deepEqual(errors, []);
});

// ---- Help › Your data ------------------------------------------------------------------------------------------------
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
test('Help › Your data: the shorter iPhone and iPad item, with whether Safari keeps your data and Restore a file, on a phone and an iPad', async () => {
  for (const [width, height] of [
    [390, 844],
    [820, 1180],
  ]) {
    const { page, errors } = await openApp({
      width,
      height,
      userAgent: IPAD,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.evaluate(() => openHelpSheet());
    await page.waitForSelector('#helpOverlay.on');
    await page.click('#helpData > summary');
    await idle(page);
    const items = await page.$$eval('#helpData li', (ls) =>
      ls.map((l) => l.textContent.replace(/\s+/g, ' ')),
    );
    assert.equal(
      items[2],
      'On iPhone and iPad, Safari deletes a site’s data after about seven days without opening it. On your Home Screen (Share › Add to Home Screen) Marker Studio isn’t cleared like that, but it has its own storage: back up here first, then restore the file there.',
    );
    assert.match(
      items[3],
      /^Safari (has agreed to keep|may clear) your data/,
      'whether Safari keeps it, next',
    );
    assert.match(items[4], /Restore a file brings it back on any iPhone, iPad or computer\./);
    assert.equal(items.filter((t) => /seven days/.test(t)).length, 1, 'said once');
    // nothing wider than the sheet
    const over = await page.evaluate(() => {
      const b = document.querySelector('#helpData .hlpbody');
      return b.scrollWidth - b.clientWidth;
    });
    assert.ok(over <= 0, 'no sideways scroll: ' + over);
    assert.deepEqual(errors, []);
  }
});

// ---- Palette › From photo: something already white ------------------------------------------------------------------
test('Palette › From photo: tapping something already white says "That already looks white: nothing to correct."', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.click('#mPalette');
  await page.click('#harm [data-h="photo"]');
  await idle(page);
  // white paper (242) with coloured spots, drawn here
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = 'rgb(242,242,242)';
    g.fillRect(0, 0, 300, 180);
    ['#d33', '#3a3', '#33c', '#fc0', '#c3c', '#3cc'].forEach((f, i) => {
      g.fillStyle = f;
      g.beginPath();
      g.arc(40 + i * 45, 90, 16, 0, 7);
      g.fill();
    });
    return c.toDataURL('image/png').split(',')[1];
  });
  const n = await page.evaluate(() => state.palettes.length);
  await page.setInputFiles('#photoFile', {
    name: 'page.png',
    mimeType: 'image/png',
    buffer: Buffer.from(b64, 'base64'),
  });
  await until(page, (n) => state.palettes.length > n, n, 'the photo palette');
  await idle(page);
  await page.click('#photoPaper');
  const r = await page.locator('#photoThumb').boundingBox();
  await page.mouse.click(r.x + r.width * 0.5, r.y + r.height * 0.12);
  await idle(page);
  assert.equal(await page.textContent('#photoPaperNote'), 'That already looks white: nothing to correct.');
  assert.equal(await page.isVisible('#photoLight'), false, 'nothing corrected');
  assert.deepEqual(errors, []);
});
