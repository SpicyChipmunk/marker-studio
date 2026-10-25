// A colouring page made from any photo (v325, 47-photo-page): the way in, the page step (Detail, its count, Undo),
// Build as made, the Plan's Photo pattern and its remake, saving and opening again, Print's light lines and the
// photo by the key, and the warnings' offer. Made-up photos only (the author's stay out of the repo).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { answerAsks, asked, idle, openApp, setup, teardown, until } from './helpers.mjs';

before(setup);
after(teardown);

const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-photo-tips': '1' };
const VIEW = { width: 820, height: 1180, storage: ONBOARDED };
// a made-up photo (JPEG): sky to ground, soft blobs and hard shapes in colour, a white patch, texture and noise
function photo(page, { w = 1200, h = 900, seed = 7 } = {}) {
  return page.evaluate(
    ({ w, h, seed }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, '#7fb2e0');
      lg.addColorStop(0.55, '#d8e4ec');
      lg.addColorStop(0.56, '#6c8a3c');
      lg.addColorStop(1, '#3d4f22');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const x = rnd() * w,
          y = rnd() * h,
          r = 20 + rnd() * 160,
          rg = g.createRadialGradient(x, y, 0, x, y, r),
          hue = Math.round(rnd() * 360);
        rg.addColorStop(0, `hsla(${hue},60%,${35 + rnd() * 35}%,0.9)`);
        rg.addColorStop(1, `hsla(${hue},60%,50%,0)`);
        g.fillStyle = rg;
        g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      for (let i = 0; i < 10; i++) {
        g.fillStyle = `hsl(${Math.round(rnd() * 360)},65%,${30 + rnd() * 35}%)`;
        g.beginPath();
        g.ellipse(rnd() * w, rnd() * h, 30 + rnd() * 120, 20 + rnd() * 80, rnd() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fcfcfa';
      g.fillRect(w * 0.72, h * 0.08, w * 0.18, h * 0.16);
      const id = g.getImageData(0, 0, w, h),
        d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (rnd() - 0.5) * 14;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      g.putImageData(id, 0, 0);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    { w, h, seed },
  );
}
const file = (b64) => ({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
// the page step showing its page (no make under way)
const pageReady = (page, d) =>
  until(
    page,
    (d) =>
      !!__mstest.pp &&
      !__mstest.ppBusy &&
      (d == null || __mstest.pp.d === d) &&
      /This page:/.test((document.getElementById('sfPpCount') || {}).textContent || ''),
    d,
    'the page step, its page made',
    60000,
  );
// Home's start card link, its picker, the photo
async function fromHome(page, seed) {
  const b64 = await photo(page, { seed });
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('[data-start="ppage"]:visible').first().click(),
  ]);
  await fc.setFiles(file(b64));
  await pageReady(page, 2);
  await idle(page);
}
const detail = (page, v) =>
  page.evaluate((v) => {
    const d = document.getElementById('sfPpDet');
    d.value = String(v);
    d.dispatchEvent(new Event('input', { bubbles: true }));
    d.dispatchEvent(new Event('change', { bubbles: true }));
  }, v);
const count = (page) => page.evaluate(() => __mstest.comps.length - 1);
// every section's marker, as the plan laid it, against the page as made
const asMade = (page) =>
  page.evaluate(() => {
    const p = __mstest.pp,
      A = __mstest.assignData;
    let same = 0,
      diff = 0;
    for (const l in p.made) {
      const m = A.assign[l];
      if (!m) continue;
      if (m.mkey === p.made[l]) same++;
      else diff++;
    }
    return { same, diff };
  });

test('Home’s link makes a page from a photo: the page step, its count, Made for, and the Guide screen behind it', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await fromHome(page, 7);
  const s = await page.evaluate(() => ({
    mode: state.mode,
    head: document.getElementById('sfSecHead').textContent,
    det: document.getElementById('sfPpDetName').textContent,
    cnt: document.getElementById('sfPpCount').textContent,
    made: document.getElementById('sfPpMade').textContent,
    W: __mstest.W,
    H: __mstest.H,
    fam: __mstest.family,
    secs: __mstest.comps.length - 1,
  }));
  assert.equal(s.mode, 'sections', 'on the Guide screen');
  assert.equal(s.head, 'Your colouring page');
  assert.equal(s.det, 'Medium');
  assert.match(s.cnt, new RegExp(`^This page: ${s.secs} sections, \\d+ markers$`));
  // (no markers added: every one in the catalogue)
  assert.match(s.made, /^Made for the full Ohuhu and Copic ranges\.$/);
  assert.equal(Math.max(s.W, s.H), 2000, 'the page at the guide’s size');
  assert.equal(s.fam, 'photo');
  assert.ok(s.secs > 10, 'sections: ' + s.secs);
  // nothing here that's for a photographed colouring page: no warning, Min section size, Straighten or Enhance
  for (const id of ['sfMin', 'sfPgAdj', 'sfEnh']) assert.equal(await page.$('#' + id), null, id);
  assert.equal(await page.$('.sfc-segwarn'), null, 'no warning');
  assert.deepEqual(errors, []);
});

test('Detail makes the page again (fewer sections at Very simple), and Undo brings the page before back', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await fromHome(page, 11);
  const med = await count(page);
  await detail(page, 0);
  await pageReady(page, 0);
  await idle(page);
  const vs = await count(page);
  assert.ok(vs < med, `Very simple ${vs} under Medium ${med}`);
  assert.equal(await page.textContent('#sfPpDetName'), 'Very simple');
  await page.click('#sfPlanUndo');
  await pageReady(page, 2);
  await idle(page);
  assert.equal(await count(page), med, 'the Medium page back');
  assert.equal(
    await page.evaluate(() => __mstest.limitN === __mstest.pp.n),
    true,
    'Markers in this guide with it, so Build lays it as made',
  );
  assert.equal(
    await page.evaluate(() => document.getElementById('sfPpDet').value),
    '2',
    'and the slider with it',
  );
  assert.deepEqual(errors, []);
});

test('Build: the plan is the page as made; the Photo pattern says so; another count offers to remake it', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await fromHome(page, 13);
  await page.click('#sfBuild');
  await until(page, () => __mstest.sfmode === 'guide' && !!__mstest.assignData, null, 'the Plan', 30000);
  await idle(page);
  const m = await asMade(page);
  assert.equal(m.diff, 0, 'every section its marker as made');
  assert.ok(m.same > 10);
  await page.click('#sfTab-pattern');
  await idle(page);
  assert.match(
    await page.textContent('.sftab[data-tab="pattern"]'),
    /Colours come from your photo, as the page was made\./,
  );
  for (const id of ['sfPhAlign', 'sfPhPick'])
    assert.equal(await page.$('#' + id), null, id + ': nothing to line up or change');
  // Markers in this guide moved: the plan isn't as made, and the page can be made again for it
  await page.evaluate(() => {
    const sl = document.getElementById('sfMkCount');
    sl.value = '5';
    sl.dispatchEvent(new Event('input', { bubbles: true }));
    sl.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await idle(page, 2500);
  assert.match(
    await page.textContent('#sfPpRemake'),
    /^This page was made for \d+ markers, so with 5 some sections side by side may share a marker\. Remake page for 5 markers$/,
  );
  await page.click('#sfPpRemakeGo');
  // (nothing ticked or edited: no question)
  await pageReady(page);
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'review', 'the page step, to build again');
  assert.equal(await page.evaluate(() => [__mstest.pp.n, __mstest.pp.hand].join()), '5,true');
  await page.click('#sfBuild');
  await until(page, () => __mstest.sfmode === 'guide', null, 'the Plan again', 30000);
  await idle(page);
  assert.equal((await asMade(page)).diff, 0, 'as made again');
  assert.equal(await page.$('#sfPpRemake'), null, 'no offer now');
  assert.deepEqual(errors, []);
});

test('saved and opened again: the page’s settings and markers as made, and Detail works once its photo is read', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await fromHome(page, 17);
  await detail(page, 1);
  await pageReady(page, 1);
  await idle(page);
  await page.click('#sfBuild');
  await until(page, () => __mstest.sfmode === 'guide' && __mstest.inLibrary, null, 'built and saved', 30000);
  await idle(page);
  const id = await page.evaluate(() => __mstest.curId),
    was = await page.evaluate(() => ({
      n: __mstest.pp.n,
      made: Object.keys(__mstest.pp.made).length,
      S: __mstest.comps.length,
    }));
  await page.click('#mHome');
  await idle(page);
  await page.reload();
  await idle(page, 2500);
  await page.evaluate(() => openLibrary());
  await idle(page);
  await page.click(`.srow[data-id="${id}"] button.sopen`);
  await until(page, (g) => __mstest.curId === g && !!__mstest.assignData, id, 'opened');
  await idle(page);
  if (await page.evaluate(() => __mstest.sfmode === 'color')) {
    await page.click('#sfDoneBtn');
    await idle(page);
  }
  const now = await page.evaluate(() => ({
    d: __mstest.pp && __mstest.pp.d,
    n: __mstest.pp && __mstest.pp.n,
    made: __mstest.pp && Object.keys(__mstest.pp.made).length,
    S: __mstest.comps.length,
    remake: __mstest.ppRemakeFor(),
  }));
  assert.deepEqual(now, { d: 1, n: was.n, made: was.made, S: was.S, remake: 0 });
  assert.equal((await asMade(page)).diff, 0, 'opened as made');
  // Edit sections: the photo is read from this device, then Detail can make the page again
  await page.click('#sfBack2');
  await until(
    page,
    () => {
      const d = document.getElementById('sfPpDet');
      return d && !d.disabled;
    },
    null,
    'Detail usable',
    30000,
  );
  await idle(page);
  await detail(page, 3);
  await pageReady(page, 3);
  assert.ok((await count(page)) > was.S - 1, 'Detailed has more sections than Simple');
  assert.deepEqual(errors, []);
});

test('Print: the colouring page’s lines are light unless Darker lines is ticked, and the photo is by the key', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await fromHome(page, 19);
  await page.click('#sfBuild');
  await until(page, () => __mstest.sfmode === 'guide', null, 'the Plan', 30000);
  await idle(page);
  await page.click('#sfTab-share');
  await idle(page);
  await page.click('#sfPrint');
  await idle(page);
  assert.ok(await page.isVisible('#sfPdfPpDark'), 'Darker lines, for a photo-made page');
  // the colouring page's picture: a line pixel's colour, as drawn onto page 1
  const lineColour = () =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        od = P.drawImage,
        L = __mstest.labels,
        W = __mstest.W,
        cols = [];
      let q = -1;
      for (let i = 0; i < L.length; i++)
        if (L[i] === -1) {
          q = i;
          break;
        }
      // (read as it's drawn: the pages' pictures are let go once drawn)
      P.drawImage = function (img) {
        if (img && img.width === W && img.height === __mstest.H && img.getContext)
          cols.push([...img.getContext('2d').getImageData(q % W, Math.floor(q / W), 1, 1).data].slice(0, 3));
        return od.apply(this, arguments);
      };
      try {
        __mstest.buildPDFPages();
      } finally {
        P.drawImage = od;
      }
      return cols[0];
    });
  const light = await lineColour();
  assert.ok(light[0] > 120, 'light grey: ' + light);
  await page.check('#sfPdfPpDark');
  await idle(page);
  const dark = await lineColour();
  assert.ok(dark[0] < 60, 'dark: ' + dark);
  await page.uncheck('#sfPdfPpDark');
  await idle(page);
  // the photo, small by the key's reference: drawn at the reference's shape, never over it
  const ph = await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      od = P.drawImage,
      seen = [];
    P.drawImage = function (img, x, y, w, h) {
      if (
        arguments.length === 5 &&
        img &&
        img.width === __mstest.photoRef.w &&
        img.height === __mstest.photoRef.h
      )
        seen.push({ x, y, w, h });
      if (arguments.length === 5 && img && img.width === __mstest.W && img.height === __mstest.H)
        seen.push({ ref: true, x, y, w, h });
      return od.apply(this, arguments);
    };
    try {
      __mstest.buildPDFPages();
    } finally {
      P.drawImage = od;
    }
    return seen;
  });
  const p = ph.filter((x) => !x.ref),
    r = ph.filter((x) => x.ref).pop();
  assert.equal(p.length, 1, 'the photo once: ' + JSON.stringify(ph));
  assert.ok(p[0].w < r.w, 'smaller than the reference');
  assert.ok(p[0].x >= r.x + r.w || p[0].y >= r.y + r.h, 'beside or under it, not over it');
  // a smaller paper than the page was made for: said, with a remake
  await page.click('[data-paper="half"]');
  await idle(page);
  assert.match(
    await page.textContent('#sfPrPp'),
    /^This page was made for (Letter|A4): on Half Letter its smallest sections are about [\d.]+ mm across\. Remake page for Half Letter$/,
  );
  assert.deepEqual(errors, []);
});

test('a photo opened as a colouring page is offered a page made from it, and that makes one', async () => {
  const { page, errors } = await openApp(VIEW);
  await page.click('#mSections');
  await idle(page);
  await page.setInputFiles('#sfFile', file(await photo(page, { seed: 23 })));
  await until(page, () => !!document.getElementById('sfPpFrom'), null, 'the offer', 30000);
  await idle(page);
  await page.click('#sfPpFrom');
  await pageReady(page, 2);
  await idle(page);
  assert.equal(await page.textContent('#sfSecHead'), 'Your colouring page');
  assert.equal(await page.$('#sfPpFrom'), null, 'offered no more');
  assert.deepEqual(errors, []);
});

test('the sample and a line-art page aren’t offered a page made from them', async () => {
  const { page, errors } = await openApp(VIEW);
  await page.click('#mSections');
  await idle(page);
  await page.click('#sfSample');
  await until(page, () => !!__mstest.assignData, null, 'the sample');
  await idle(page);
  await page.click('#sfBack2');
  await idle(page);
  assert.equal(await page.$('#sfPpFrom'), null);
  assert.deepEqual(errors, []);
});

test('with colouring done, Detail asks first: Cancel keeps the page and the slider, Make again remakes it', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await fromHome(page, 29);
  await page.click('#sfBuild');
  await until(page, () => __mstest.sfmode === 'guide', null, 'the Plan', 30000);
  await idle(page);
  // a section coloured, then back to the page step
  await page.evaluate(() => {
    __mstest.colored[1] = 1;
  });
  await page.click('#sfBack2');
  await idle(page);
  const S = await count(page);
  await answerAsks(page, false);
  await detail(page, 4);
  await until(page, () => (window.__asked || []).length > 0, null, 'asked', 10000);
  await idle(page);
  assert.match((await asked(page))[0], /^This makes a new page and clears your colouring progress/);
  assert.equal(await count(page), S, 'the page as it was');
  assert.equal(await page.evaluate(() => document.getElementById('sfPpDet').value), '2', 'the slider back');
  await answerAsks(page, true);
  await detail(page, 4);
  await pageReady(page, 4);
  await idle(page);
  assert.ok((await count(page)) > S, 'Very detailed: more sections');
  assert.equal(
    await page.evaluate(() => __mstest.colored[1] || 0),
    0,
    'its progress cleared (Undo brings it back)',
  );
  assert.deepEqual(errors, []);
});

// (v325.1) Focus: Sharper subject asks to download the subject finder the first time; Not now keeps Even; once it's
// stored, the page is made with the subject found, kept with the guide
test('Focus: the subject finder downloaded after asking, the page made with it, Even again without asking', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await fromHome(page, 31);
  assert.equal(await page.getAttribute('#sfPpFoc [data-v="even"]', 'aria-pressed'), 'true');
  // Not now: nothing downloaded, still Even
  await answerAsks(page, false);
  await page.click('#sfPpFoc [data-v="sharp"]');
  await until(page, () => (window.__asked || []).length > 0, null, 'asked', 10000);
  await idle(page);
  assert.match(
    (await asked(page))[0],
    /^Sharper subject finds what your photo is of, on this device: your photo never leaves it\. It’s a one-time download of about \d+ MB/,
  );
  assert.equal(await page.evaluate(() => __mstest.pp.f), 'even');
  assert.equal(
    await page.evaluate(async () => (await __mstest.subMissing()).length > 0),
    true,
    'nothing stored',
  );
  // yes: downloaded, checked, the subject found, the page made again
  await answerAsks(page, true);
  await page.click('#sfPpFoc [data-v="sharp"]');
  await until(
    page,
    () =>
      __mstest.pp.f === 'sharp' &&
      !__mstest.ppBusy &&
      !!__mstest.ppPrep.sal &&
      /This page:/.test(document.getElementById('sfPpCount').textContent),
    null,
    'made with the subject',
    120000,
  );
  await idle(page);
  assert.equal(await page.evaluate(async () => (await __mstest.subMissing()).length), 0, 'stored');
  assert.equal(
    await page.textContent('#sfPpFocHint'),
    'More detail on the photo’s subject, the rest as Even.',
  );
  const sal = await page.evaluate(() => {
    const s = __mstest.ppPrep.sal;
    let lo = 1,
      hi = 0;
    for (const v of s) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return [s.length === __mstest.ppPrep.w * __mstest.ppPrep.h, lo, hi];
  });
  assert.deepEqual(
    sal.map((v, i) => (i ? Math.round(v) : v)),
    [true, 0, 1],
    'a map from 0 to 1 over the photo',
  );
  // Even again: no question, no subject needed
  const n = (await asked(page)).length;
  await page.click('#sfPpFoc [data-v="even"]');
  await until(page, () => __mstest.pp.f === 'even' && !__mstest.ppBusy, null, 'Even', 60000);
  await idle(page);
  assert.equal((await asked(page)).length, n, 'not asked');
  assert.deepEqual(errors, []);
});
