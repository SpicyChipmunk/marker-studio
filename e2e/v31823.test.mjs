// v318.23 in the browser: a new version's notice stays until it's used; a Library with a curly quote in a name still
// has the app's whole storage; the ink found in steps, a step per blur pass, as in one go; Copy diagnostics lists the
// longest waits; a guide's newer-version settings kept by its autosave.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, haveSet, welcome, sampleGuide, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

// ---- a new version is ready ----
// (the service worker's controllerchange, as when a new release takes this page over: the first, at install, is
// skipped, as with an app opened for the first time)
const updated = (page) =>
  page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  });
const back = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

test('a new version: a banner that stays through an Undo toast, only one, ✕ until the page comes back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await updated(page);
  await page.waitForSelector('#msUpd');
  assert.match(await page.textContent('#msUpd'), /A new version of Marker Studio is ready\./);
  // (v318.28: said from #msSay, a live region in the page from the start, not by the banner inserted holding its words)
  assert.equal(await page.textContent('#msSay'), 'A new version of Marker Studio is ready.');
  // a toast with Undo comes and goes: the banner stays
  await page.evaluate(() => toastAction('Section cleared.', 'Undo', () => {}));
  assert.equal(await page.isVisible('#toastAct'), true);
  assert.equal(await page.isVisible('#msUpd'), true);
  // only ever one
  await updated(page);
  await back(page);
  assert.equal(await page.locator('#msUpd').count(), 1);
  // ✕: gone until the page comes back to the screen
  const x = await page.locator('#msUpdX').boundingBox();
  assert.ok(x.width >= 44 && x.height >= 44, 'a finger-sized ✕');
  await page.click('#msUpdX');
  assert.equal(await page.locator('#msUpd').count(), 0);
  await back(page);
  assert.equal(await page.locator('#msUpd').count(), 1);
  assert.deepEqual(errors, []);
});

test('a new version on the guide’s screen: a toast, no banner (the picture doesn’t move), not over an Undo; the banner once back on Home', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const top = () => page.evaluate(() => document.querySelector('#sfView canvas').getBoundingClientRect().top);
  const y0 = await top();
  // an action toast showing: not taken over
  await page.evaluate(() => toastAction('Section cleared.', 'Undo', () => {}));
  await updated(page);
  await page.waitForTimeout(300);
  assert.match(await page.textContent('#msToast'), /Section cleared/);
  // the next time the page comes back
  await page.evaluate(() => document.getElementById('msToast').classList.remove('on'));
  await back(page);
  assert.match(await page.textContent('#msToast'), /A new version of Marker Studio is ready/);
  assert.equal(await page.locator('#msUpd').count(), 0, 'no banner on the guide’s screen');
  assert.equal(await top(), y0, 'the picture stays where it was');
  // leaving the guide's screen: the banner
  await page.evaluate(() => setMode('home'));
  await page.waitForSelector('#msUpd');
  assert.deepEqual(errors, []);
});

test('a new version: a page that already is it says nothing', async () => {
  const { page, errors } = await openApp();
  await page.evaluate(async () => {
    const v = /v?(\d+(?:\.\d+)?)/.exec(document.getElementById('appVer').textContent)[1];
    for (const k of await caches.keys()) await caches.delete(k);
    await caches.open('marker-studio-v' + v);
  });
  await updated(page);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#msUpd').count(), 0);
  assert.deepEqual(errors, []);
});

// ---- storage ----
test('a Library with a curly quote in a name: the app’s storage holds what plain names would (WebKit counted it twice)', async () => {
  const { page, errors } = await openApp();
  const r = await page.evaluate(() => {
    const t = 'data:image/jpeg;base64,' + 'A'.repeat(24000);
    for (let i = 0; i < 110; i++)
      state.saved.push({
        id: 900 + i,
        type: 'guide',
        name: 'g' + i,
        ts: i + 1,
        keys: [],
        W: 100,
        H: 100,
        n: 1,
        thumb: t,
      });
    state.saved[state.saved.length - 1].name = 'Ben’s page';
    const ok = save(true),
      raw = localStorage.getItem('ohuhu-hb320-picker-v3');
    // a rename with a curly quote, a few guides more
    state.saved[0].name = 'Ziqi’s Ⅱ 🌼 page';
    const ok2 = save(true);
    return {
      ok,
      ok2,
      len: raw.length,
      wide: [...raw].some((c) => c.charCodeAt(0) > 0x7e),
      thumbs: state.saved.filter((s) => s.thumb).length,
    };
  });
  assert.ok(r.len > 2.65e6, 'over half of 5 MB: ' + r.len);
  assert.equal(r.wide, false);
  assert.equal(r.ok, true);
  assert.equal(r.ok2, true);
  assert.equal(r.thumbs, 110, 'no thumbnail had to go');
  assert.deepEqual(errors, []);
});

// ---- the ink in steps ----
// a 1800 x 2400 page of rings with grain of the strength given, as a JPEG (as e2e/v31814-steps)
async function photo(page, grain) {
  const b64 = await page.evaluate(async (grain) => {
    const c = document.createElement('canvas');
    c.width = 1800;
    c.height = 2400;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, 1800, 2400);
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 6;
    for (let y = 200; y < 2400; y += 300)
      for (let x = 200; x < 1800; x += 300) {
        g.beginPath();
        g.arc(x, y, 120, 0, 6.283);
        g.stroke();
      }
    const im = g.getImageData(0, 0, 1800, 2400),
      d = im.data;
    let s = 7;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 16807) % 2147483647;
      const n = (s / 2147483647 - 0.5) * grain;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    g.putImageData(im, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  }, grain);
  return { name: 'page.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}
async function choose(page, grain) {
  await haveSet(page);
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles(await photo(page, grain));
  const first = await Promise.race([
    page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }).then(() => 'build'),
    page.waitForSelector('#sfPgNo', { state: 'visible', timeout: 60000 }).then(() => 'corners'),
  ]);
  if (first === 'corners') {
    await page.click('#sfPgNo');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  }
  await idle(page);
}

test('grainy photos (no blur, one pass, two): the ink found a step per pass, the same sections as in one go; the waits in Copy diagnostics', async () => {
  const passes = [];
  for (const grain of [0, 14, 70]) {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await choose(page, grain);
    const r = await page.evaluate(() => {
      const t = __mstest,
        one = () => ({ sig: t.labelsSig(), n: t.comps.length, faint: t.faintOffer });
      const a = one();
      t.segment();
      return { steps: a, once: one(), d: errDetails(), passes: t.inkPasses() };
    });
    assert.ok(r.steps.n > 20, grain + ': sections ' + r.steps.n);
    assert.deepEqual(r.steps, r.once, 'grain ' + grain);
    passes.push(r.passes);
    // what held the page longest is listed (in memory only; v318.26: and in Send feedback, by Ben's decision)
    assert.match(r.d, /\nLongest waits, this visit:\n(New photo|Sections)/);
    assert.match(
      await page.evaluate(() => feedbackReport()),
      /\nLongest waits, this visit:\n(New photo|Sections)/,
    );
    assert.deepEqual(errors, []);
    await page.context().close();
  }
  assert.deepEqual(passes, [0, 1, 2], 'no blur, one pass, two');
});

// ---- a guide's settings from a newer version ----
const idbGet = (page, id) =>
  page.evaluate(
    (id) =>
      new Promise((res) => {
        const r = indexedDB.open('ms-guides');
        r.onsuccess = () => {
          const q = r.result
            .transaction('g')
            .objectStore('g')
            .get('guide-' + id);
          q.onsuccess = () => res(q.result);
        };
      }),
    id,
  );
const idbPut = (page, id, v) =>
  page.evaluate(
    ([id, v]) =>
      new Promise((res) => {
        const r = indexedDB.open('ms-guides');
        r.onsuccess = () => {
          const t = r.result.transaction('g', 'readwrite');
          t.objectStore('g').put(v, 'guide-' + id);
          t.oncomplete = () => res(1);
        };
      }),
    [id, v],
  );

test('a guide saved by a newer version: its settings this version doesn’t know survive ticks and the autosave', async () => {
  const { page, errors } = await openApp({ width: 1024, height: 900 });
  await sampleGuide(page);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  const pl = await idbGet(page, id);
  pl.zzTop = { a: 1, list: [1, 2, 3] };
  pl.style.zzStyle = 3;
  if (pl.style.shade) pl.style.shade.zzShade = 'x';
  await idbPut(page, id, pl);
  await page.reload();
  await idle(page);
  await page.evaluate((id) => loadGuide({ id }), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 15000 });
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest;
    t.colored[t.assignData.order[0]] = 1;
    t.colored[t.assignData.order[1]] = 1;
    t.guideDirty = true;
    t.renderGuide();
  });
  // (the autosave: a moment after the change)
  let got = null;
  for (let t0 = Date.now(); Date.now() - t0 < 20000; await page.waitForTimeout(300)) {
    got = await idbGet(page, id);
    if (((got && got.prog) || []).length >= 2) break;
  }
  assert.ok(got.prog.length >= 2, 'the ticks saved');
  assert.deepEqual(got.zzTop, { a: 1, list: [1, 2, 3] });
  assert.equal(got.style.zzStyle, 3);
  if (pl.style.shade) assert.equal(got.style.shade.zzShade, 'x');
  assert.deepEqual(errors, []);
});
