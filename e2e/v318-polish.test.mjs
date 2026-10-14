// v318 polish sweep: smaller fixes found by the v318 reviews, and more of the same kind. Each test fails without its fix.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  setup,
  teardown,
  openApp,
  idle,
  until,
  sampleGuide,
  saveGuide,
  sectionPoint,
  scrollTop,
  haveSet,
} from './helpers.mjs';

before(setup);
after(teardown);

const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };

// What the screen showed, frame by frame: a status read as a frame starts (its callbacks) and still the same once it is
// laid out to be drawn (a ResizeObserver's callback, just before the drawing). A status set and replaced within one
// piece of work is never drawn, nor one replaced by work done in the frame's own callbacks.
function watchStatus(page) {
  return page.evaluate(() => {
    const seen = (window.__painted = new Set());
    const read = () =>
      ['sfMeta', 'sfBuild', 'sfPgGo']
        .map((id) => document.getElementById(id))
        .filter((e) => e && e.offsetParent)
        .map((e) => e.textContent.trim());
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;height:1px;width:1px;pointer-events:none';
    document.body.appendChild(probe);
    let a = [];
    new ResizeObserver(() => {
      const b = read();
      a.forEach((t) => b.includes(t) && seen.add(t));
    }).observe(probe);
    const tick = () => {
      a = read();
      probe.style.width = probe.style.width === '1px' ? '2px' : '1px';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const painted = (page) => page.evaluate(() => [...window.__painted]);

// The note before heavy work on the page was set in the same piece of work as it: "Reading photo…" stayed up while the
// sections were found, and Build's "Building…" never showed once the label points were already worked out.
test('Detecting sections…, Building… and Straightening… are on screen while that work is done', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
  await page.click('#mSections');
  await idle(page);
  await watchStatus(page);
  const buf = await readFile(new URL('./fixtures/letter-page.png', import.meta.url));
  // (into the file box straight, not through the file picker: Playwright's WebKit draws no frames while it's "open")
  await page.setInputFiles('#sfFile', { name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
  assert.ok(
    (await painted(page)).includes('Detecting sections…'),
    'Detecting sections… shown: ' + (await painted(page)).join(' / '),
  );
  // Adjust photo › Straighten page › Straighten
  if (!(await page.isVisible('#sfPgOpen'))) await page.click('#sfAdjToggle');
  await page.click('#sfPgOpen');
  await page.waitForSelector('#sfPgGo');
  await idle(page);
  await page.click('#sfPgGo');
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
  assert.ok(
    (await painted(page)).includes('Straightening…'),
    'Straightening… shown: ' + (await painted(page)).join(' / '),
  );
  assert.match(await page.textContent('.sfpgline'), /Page straightened/);
  // Build, its label points worked out on the page (as where there's no worker; with one, as when they're known)
  await page.evaluate(() => __mstest.jobs.off());
  await page.click('#sfBuild');
  await until(page, () => __mstest.assignData && __mstest.sfmode === 'guide', null, 'the guide', 60000);
  await idle(page);
  assert.ok(
    (await painted(page)).includes('Building…'),
    'Building… shown: ' + (await painted(page)).join(' / '),
  );
  assert.deepEqual(errors, []);
});

// Colour along with a marker's row open: a tap on another marker's section, done before, unticked it without a word.
// Since the review's second pass such a tap asks first, beside the section; a done one is unticked only by Untick it.
test('another marker’s done section, tapped while one is open: asked, Untick it, nothing changed before', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfAlist .sfarow button.sfah');
  await idle(page);
  await scrollTop(page);
  const l = await page.evaluate(() => {
    const t = __mstest;
    const l = t.assignData.order
      .filter((x) => t.assignData.assign[x].mkey !== t.hlKey)
      .sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    t.colored[l] = 1;
    t.renderGuide();
    return l;
  });
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.colored[l], l), 1, 'still ticked: asked first');
  assert.match(await page.textContent('.sftipask [data-a="tick"]'), /^Untick it$/);
  await page.click('.sftipask [data-a="tick"]');
  await idle(page);
  assert.ok(!(await page.evaluate((l) => __mstest.colored[l], l)), 'unticked by Untick it');
  assert.deepEqual(errors, []);
});

// The Photo pattern: the colours for where the photo was left come in two goes, a quick choice at once and the full one
// half a second later, with its Undo step. Colour along opened in between kept the quick choice, with no Undo step.
test('the photo dragged and the Plan left at once: its colours are finished, with their Undo step', async () => {
  const { page, errors } = await openApp();
  await haveSet(page);
  await page.check('#wcSets input[data-i="6"]');
  await page.click('#wcAdd');
  await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  // a photo: blue top half, red bottom half
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 800;
    const g = c.getContext('2d');
    g.fillStyle = '#2350c8';
    g.fillRect(0, 0, 600, 400);
    g.fillStyle = '#d0282c';
    g.fillRect(0, 400, 600, 400);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef);
  await idle(page);
  const n0 = await page.evaluate(() => __mstest.planCount);
  await scrollTop(page);
  const c = await page.locator('#sfCanvas').boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height * 0.6, { steps: 6 });
  await page.mouse.up();
  await page.click('#sfColor');
  await idle(page);
  const r = await page.evaluate(() => ({
    mode: __mstest.sfmode,
    n: __mstest.planCount,
    label: __mstest.planLabel,
  }));
  assert.equal(r.mode, 'color');
  assert.equal(r.n, n0 + 1, 'an Undo step for the move');
  assert.equal(r.label, 'Photo moved');
  assert.deepEqual(errors, []);
});

// The sample, finished in Colour along, is first saved a moment later: "Saved in your Library…" replaced "Page
// finished." in what a screen reader is told, before it could be read. Both are said now, Page finished first.
test('the page finished as the guide is first saved: screen readers are told both, Page finished first', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, storage: { 'ms-wake-told': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  const last = await page.evaluate(() => {
    const t = __mstest,
      ks = [...document.querySelectorAll('#sfAlist .sfarow')].map((r) => r.dataset.k),
      k = ks[ks.length - 1];
    t.assignData.order.forEach((l) => {
      if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
    });
    return k;
  });
  await page.click(`#sfAlist .sfarow[data-k="${last}"] .sfah`);
  await idle(page);
  await page.click('#sfMarkAll');
  await until(page, () => __mstest.inLibrary, null, 'the guide saved', 15000);
  await idle(page);
  const said = await page.textContent('#sfLive');
  assert.match(said, /^Page finished\. .*Saved in your Library\. Changes now save automatically\.$/);
  assert.deepEqual(errors, []);
});

// A guide the browser's storage doesn't give back says to reload (v318 review), but why the read failed was one note for
// every guide: a read of another guide begun before the open looked at it (a thumbnail's, a backup's) cleared it, and
// the guide was called missing from this browser, which sends people to an older backup.
test('a guide the storage doesn’t give back says to reload, also with another guide read meanwhile', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  // (the Guide tab keeps one entry of its own, a step above Home; only closed layers' entries are waited on)
  await page.waitForFunction(
    () => ((history.state && history.state.msLayer) || 0) <= (state.mode === 'home' ? 0 : 1),
  );
  await page.reload();
  await idle(page);
  await page.evaluate((id) => {
    const get = IDB.get;
    IDB.get = (k) => {
      if (k !== 'guide-' + id) return get(k);
      const p = Promise.reject(new DOMException('gone', 'UnknownError'));
      // (another guide's read begun after this one's failure is noted, before the open reads the note)
      p.catch(() => Promise.resolve().then(() => Promise.resolve().then(() => sfLoadDesign(-1))));
      return p;
    };
  }, id);
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  await page.click(`#savedList .srow[data-id="${id}"] .sopen`);
  await until(page, () => /Couldn’t open that guide/.test(document.body.innerText), null, 'said');
  const t = await page.evaluate(() => document.body.innerText);
  assert.match(t, /isn’t answering/);
  assert.doesNotMatch(t, /missing from this browser/);
  assert.deepEqual(errors, []);
});

// A restore over a guide called damaged as it opened kept its stored copy aside as "… (before restore)" when that copy's
// section map was a whole PNG (v318 review: it may only have been short of memory), even one that still can't open:
// here a map too big for any guide, which is said as damaged every time.
test('restoring over a guide called damaged keeps no “(before restore)” copy that can’t open either', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const backup = await readFile(await dl.path());
  await idle(page);
  await page.evaluate(() => closeDialog(savedOverlay));
  await idle(page);
  // its stored copy changed since (12 sections coloured) and its section map now a whole PNG too big to be a guide's
  await page.evaluate(() => {
    const t = __mstest;
    t.assignData.order.slice(0, 12).forEach((x) => (t.colored[x] = 1));
    t.guideDirty = true;
  });
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  await page.evaluate(async (id) => {
    const c = document.createElement('canvas');
    c.width = 5000;
    c.height = 8;
    const p = await IDB.get('guide-' + id);
    p.lmap = c.toDataURL('image/png');
    await IDB.put('guide-' + id, p);
    guideDamaged(id);
  }, id);
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await until(
    page,
    () => /Restored|restored|replaced/.test(document.getElementById('backupCap').textContent),
    null,
    'the restore',
  );
  await idle(page);
  const gs = await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.name));
  assert.deepEqual(
    gs.filter((n) => /before restore/.test(n)),
    [],
    'nothing kept aside',
  );
  assert.equal(gs.length, 1);
  assert.doesNotMatch(await page.textContent('#backupCap'), /before restore/);
  assert.deepEqual(errors, []);
});

// Tester tasks answers come back with a backup (v318 review), but the restore's summary didn't say so.
test('a restore says when Tester tasks answers came back', async () => {
  const answers = {
    id: 'TABC123',
    name: 'Sam',
    t: { add: { r: 'easy', n: 'quick', v: 'v318' } },
    q: { next: 'yes' },
    sends: 0,
    sig: '',
  };
  const a = await openApp({
    width: 820,
    height: 1180,
    storage: { ...ONBOARDED, 'ms-tester': JSON.stringify(answers) },
  });
  await a.page.evaluate(() => {
    state.owned = new Set(['Ohuhu|R014', 'Ohuhu|Y111']);
    save();
  });
  await a.page.evaluate(() => SF.loadSample());
  await idle(a.page, 1500);
  await saveGuide(a.page);
  await a.page.evaluate(() => openLibrary());
  await a.page.waitForSelector('#savedOverlay.on');
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#guidesBackup')]);
  const backup = await readFile(await dl.path());
  // a fresh device: the Library's Restore (a guide and markers in it), and the welcome's (Home's summary)
  const b = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
  await b.page.evaluate(() => openLibrary());
  await b.page.waitForSelector('#savedOverlay.on');
  const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
  await fc.setFiles({ name: 'b.json', mimeType: 'application/json', buffer: backup });
  await until(
    b.page,
    () => /restored/.test(document.getElementById('backupCap').textContent),
    null,
    'restored',
  );
  assert.match(await b.page.textContent('#backupCap'), /Your Tester tasks answers came back\./);
  // a restore of the same again: nothing new among the answers, and not said
  const [fc2] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#guidesRestore')]);
  await fc2.setFiles({ name: 'b.json', mimeType: 'application/json', buffer: backup });
  await until(
    b.page,
    () => /already here/.test(document.getElementById('backupCap').textContent),
    null,
    'restored again',
  );
  await idle(b.page);
  assert.doesNotMatch(await b.page.textContent('#backupCap'), /Tester/);
  assert.equal(
    await b.page.evaluate(() => restoreSummary({ tester: 2 }).text),
    'Restored your Tester tasks answers',
  );
  assert.deepEqual([...a.errors, ...b.errors], []);
});

// Section edits not built yet are kept for Resume as the page is hidden: the guide in the browser's database and a small
// note in localStorage, which Resume is offered from. With localStorage full to the last byte the note wasn't written
// and nothing said so: no Resume came. Said now, once the page is back.
test('section edits that can’t be kept for Resume (storage full) are said, once the page is back', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  await page.click('#sfBack2');
  await idle(page);
  await scrollTop(page);
  const l = await page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[2];
  });
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction((l) => !__mstest.counted(l), l);
  await page.evaluate(() => {
    const os = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'ms-guide-auto') throw new DOMException('full', 'QuotaExceededError');
      return os.call(this, k, v);
    };
  });
  const vis = (v) =>
    page.evaluate((v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    }, v);
  await vis('hidden');
  await until(
    page,
    () => IDB.get('guide-autosave').then((d) => !!(d && d.edits)),
    null,
    'the edits in the database',
  );
  await idle(page);
  await vis('visible');
  await idle(page);
  assert.match(await page.textContent('#msToast'), /isn’t kept for Resume: this browser’s storage is full/);
  assert.deepEqual(errors, []);
});

// A guide goes into the Library by itself as it's built, once its first bloom is over; leaving before then saves it
// as the page goes. In Chromium that database write, begun as the page went, was dropped by a reload (WebKit kept it):
// the write is now committed at once.
test('reloading just as a new guide appears keeps it in the Library', async () => {
  const buf = await readFile(new URL('./fixtures/letter-page.png', import.meta.url));
  // (the reload has to come before the save starts by itself, about a second on: on a busy machine the guide can be
  // seen only later, so up to three tries)
  let tried = 0;
  for (let i = 0; i < 3 && !tried; i++) {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
    await page.click('#mSections');
    await idle(page);
    await page.setInputFiles('#sfFile', { name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
      polling: 'raf',
    });
    const early = await page.evaluate(() => !state.saved.some((s) => s.type === 'guide'));
    await page.reload();
    if (!early) {
      await ctx.close();
      continue;
    }
    tried++;
    await page.waitForFunction(() => typeof state !== 'undefined' && document.readyState === 'complete');
    await idle(page);
    const r = await page.evaluate(async () => {
      const g = state.saved.filter((s) => s.type === 'guide');
      return { n: g.length, stored: g.length ? !!(await IDB.get('guide-' + g[0].id)) : false };
    });
    assert.deepEqual(r, { n: 1, stored: true });
    assert.deepEqual(errors, []);
  }
  assert.equal(tried, 1, 'reloaded before the save began by itself');
});

// The Photo pattern's lighting correction (white balance from the photo's paper) was saved rounded to 4 places, so a
// reopened guide's corrected photo, and shading lit from it, came out a level or two off in a few pixels.
test('a Photo pattern guide’s lighting correction reopens exactly as it was saved', async () => {
  const { page, errors } = await openApp();
  await haveSet(page);
  await page.check('#wcSets input[data-i="6"]');
  await page.click('#wcAdd');
  await page.click('#wcSample');
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  // a page photographed in dim, warm light: grey-brown paper, a dark red and a dull yellow, with noise
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 800;
    const g = c.getContext('2d'),
      px = (r, gg, b, x, y, w, h) => {
        g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')';
        g.fillRect(x, y, w, h);
      };
    px(182, 170, 152, 0, 0, 600, 800);
    px(128, 42, 36, 0, 400, 300, 400);
    px(186, 172, 98, 300, 400, 300, 400);
    const d = g.getImageData(0, 0, 600, 800);
    let sd = 12345;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (rnd() - 0.5) * 10;
      d.data[i] += n;
      d.data[i + 1] += n;
      d.data[i + 2] += n;
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfFam [data-v="photo"]')]);
  await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForFunction(() => !!__mstest.photoRef);
  await idle(page);
  const gain = await page.evaluate(() => __mstest.photoRef.lit && __mstest.photoRef.lit.fix.gain.slice());
  assert.ok(
    gain && gain.some((g) => Math.round(g * 1e4) / 1e4 !== g),
    'corrected, with gains that rounding changes',
  );
  await page.click('#sfPhAlign');
  await saveGuide(page);
  await idle(page);
  const id = await page.evaluate(() => __mstest.curId);
  await page.evaluate(() => SF.loadSample());
  await idle(page, 1200);
  await page.evaluate((id) => SF.openDesign(id), id);
  await idle(page, 1500);
  await page.waitForFunction(() => !!(__mstest.photoRef && __mstest.photoRef.lit));
  await idle(page);
  assert.deepEqual(await page.evaluate(() => __mstest.photoRef.lit.fix.gain.slice()), gain);
  assert.deepEqual(errors, []);
});

// Scan's reader decoded a photo whole before shrinking it to the 2048 px it reads (a 24 MP photo about 98 MB, 48 MP
// about 190 MB). Where the browser can, it's now decoded straight to that size, turned upright from its camera data as
// before; the pixels read are the same but for rounding.
test('the reader decodes a big photo straight to the size it reads, upright, with the same pixels', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ONBOARDED });
  const r = await page.evaluate(async () => {
    // a 6000 × 4000 photo with a green corner, stored on its side (EXIF orientation 6: turned a quarter clockwise)
    const c = document.createElement('canvas');
    c.width = 6000;
    c.height = 4000;
    const g = c.getContext('2d'),
      gr = g.createLinearGradient(0, 0, 6000, 4000);
    gr.addColorStop(0, '#c33');
    gr.addColorStop(1, '#33c');
    g.fillStyle = gr;
    g.fillRect(0, 0, 6000, 4000);
    g.fillStyle = '#fff';
    g.font = 'bold 300px sans-serif';
    g.fillText('B111 R14 Y15', 400, 2000);
    g.fillStyle = '#0f0';
    g.fillRect(0, 0, 600, 600);
    const jb = new Uint8Array(
      await (await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9))).arrayBuffer(),
    );
    c.width = c.height = 1;
    const ex = [
        0xff, 0xe1, 0, 34, 0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 1, 0x12, 0, 3,
        0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0,
      ],
      o = new Uint8Array(jb.length + ex.length);
    o.set(jb.subarray(0, 2));
    o.set(ex, 2);
    o.set(jb.subarray(2), 2 + ex.length);
    const file = new File([o], 'caps.jpg', { type: 'image/jpeg' }),
      asked = [],
      cib = window.createImageBitmap;
    window.createImageBitmap = function (src, opt) {
      if (src === file) asked.push(opt ? [opt.resizeWidth, opt.resizeHeight] : null);
      return cib.apply(this, arguments);
    };
    const a = await ocrPhoto(file);
    window.createImageBitmap = cib;
    // the same photo decoded whole, as before
    const img = new Image(),
      u = URL.createObjectURL(file);
    img.src = u;
    await img.decode();
    const k = document.createElement('canvas');
    k.width = a.w;
    k.height = a.h;
    const kx = k.getContext('2d');
    kx.drawImage(img, 0, 0, a.w, a.h);
    URL.revokeObjectURL(u);
    const b = kx.getImageData(0, 0, a.w, a.h).data;
    let sum = 0;
    for (let i = 0; i < b.length; i++) sum += Math.abs(a.data.data[i] - b[i]);
    const px = (x, y) => Array.from(a.data.data.slice((y * a.w + x) * 4, (y * a.w + x) * 4 + 3));
    return { size: [a.w, a.h], asked, diff: sum / b.length, topRight: px(a.w - 20, 20), topLeft: px(20, 20) };
  });
  assert.deepEqual(r.size, [1365, 2048], 'upright: taller than wide, 2048 px tall');
  assert.deepEqual(r.asked, [[1365, 2048]], 'decoded at the size it reads');
  assert.ok(
    r.topRight[1] > 200 && r.topRight[0] < 60,
    'the green corner at the top right, as taken: ' + r.topRight,
  );
  assert.ok(r.topLeft[1] < 100, 'not at the top left: ' + r.topLeft);
  assert.ok(r.diff < 0.5, 'the same pixels but for rounding: ' + r.diff);
  assert.deepEqual(errors, []);
});
