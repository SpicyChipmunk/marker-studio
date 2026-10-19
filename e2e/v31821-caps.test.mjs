// v318.21 in the browser, the code on your cap: Markers shows an older cap's code and name ("R6 Rose Red", now R213),
// the marker's details have "My cap says" to switch it, Markers' ⋯ switches the rest; Scan's Add notes what the caps
// read say and, once, offers the rest; Colour along asks once which codes your caps show. Fails on v318.20.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, scanFromMarkers, sampleGuide } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const stored = (extra) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v318',
  'ms-scan-brand': '',
  [KEY]: JSON.stringify(
    Object.assign(
      {
        mode: 'collection',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R213', 'Ohuhu|B115', 'Ohuhu|CG18'],
        saved: [],
      },
      extra,
    ),
  ),
});
const cellText = (page, k) =>
  page.evaluate((k) => {
    const el = document.querySelector('#results .cell[data-i="' + keyIdx(k) + '"] .cc');
    return el ? el.textContent : null;
  }, k);

test('Markers: an older cap’s code; its details say "now R213" and switch it; ⋯ switches the rest, with Undo', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: stored({ cap: { 'Ohuhu|R213': 'old' } }),
  });
  await idle(page);
  await page.evaluate(() => {
    state.collView = 'owned';
    fullRender();
  });
  await idle(page);
  assert.equal(await cellText(page, 'Ohuhu|R213'), 'R6');
  assert.equal(await cellText(page, 'Ohuhu|CG18'), 'CG18');
  await page.evaluate(() => openMarkerSheet(keyIdx('Ohuhu|R213')));
  await page.waitForSelector('#mkOverlay.on');
  assert.equal(await page.textContent('#mkCode'), 'Ohuhu R6');
  assert.equal(await page.textContent('#mkName'), 'Rose Red');
  assert.match(await page.textContent('#mkMeta'), /now R213/);
  assert.match(await page.textContent('#mkCap'), /My cap says\s*R213 Pomegranate\s*R6 Rose Red/);
  await page.click('#mkCap button[data-cap="new"]');
  await idle(page);
  assert.equal(await page.textContent('#mkCode'), 'Ohuhu R213');
  assert.equal(await page.evaluate(() => state.cap['Ohuhu|R213']), 'new');
  await page.click('#mkClose');
  await idle(page);
  // (⋯: the rest show older caps' codes; Undo puts it back)
  await page.click('#mkMore');
  assert.match(await page.textContent('#mkCapDef'), /Show the codes on older Ohuhu caps/);
  await page.click('#mkCapDef');
  await idle(page);
  assert.equal(await cellText(page, 'Ohuhu|CG18'), 'CGII04');
  assert.equal(await cellText(page, 'Ohuhu|R213'), 'R213', 'its own switch wins');
  await page.click('#msToast button:has-text("Undo")');
  await idle(page);
  assert.equal(await cellText(page, 'Ohuhu|CG18'), 'CG18');
  assert.deepEqual(errors, []);
});

// a photo's reading made up (nothing of anyone's): older Ohuhu caps
function read(page, caps) {
  return page.evaluate((caps) => {
    scanList = [];
    ocrAnswered = [];
    ocrPhotos = 0;
    scanBrand = '';
    const r = {
      n: ++ocrPhotos,
      items: new Map(),
      taken: new Set(),
      brands: {},
      sure: 0,
      p: null,
      done: false,
      note: '',
    };
    ocrRun = r;
    const lines = caps.map((t, k) => ({
      id: k + 1,
      look: 1,
      text: t,
      conf: 0.97,
      unsure: false,
      nameOf: 0,
      box: [300 * (k % 6), 400 * Math.floor(k / 6), 60, 30, 0],
    }));
    lines.forEach((it) => ocrLine(r, it));
    ocrDone(r, { lines: lines, stat: {}, ms: 1, aborted: false });
    clearTimeout(r.soon);
    ocrRun = null;
    scanSaveList();
    scanRender();
    scanAddState();
  }, caps);
}

test('Scan: Add notes what the caps read say, and once offers the rest; a cap already yours is noted with nothing new to add', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await read(page, ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2']);
  await idle(page);
  // (the rows say the caps as read: "RP6", now its code)
  assert.match(await page.textContent('#scList'), /now /);
  await page.click('#scAdd');
  await idle(page);
  const t = await page.textContent('#msToast');
  assert.match(t, /Most caps read have Ohuhu’s older codes/);
  assert.equal(await page.evaluate(() => state.cap[mkey(scanIndex().byOld.get('RP6')[0])]), 'old');
  await page.click('#msToast button:has-text("Show older codes for the rest")');
  await idle(page);
  assert.equal(
    await page.evaluate(() => [state.capDef, state.capOffer, capCode('Ohuhu|CG18')].join(' ')),
    'old 1 CGII04',
  );
  // (R213, yours, read as R6 again: nothing new, Add notes it)
  await page.evaluate(() => {
    state.cap = {};
    save();
  });
  await scanFromMarkers(page);
  await idle(page);
  await read(page, ['R6']);
  await idle(page);
  assert.equal(await page.isDisabled('#scAdd'), false, 'Add: what the cap says, to note');
  await page.click('#scAdd');
  await idle(page);
  assert.match(await page.textContent('#msToast'), /Noted what 1 cap of yours says/);
  assert.equal(await page.evaluate(() => state.cap['Ohuhu|R213']), 'old');
  assert.deepEqual(errors, []);
});

test('Colour along asks once which codes your Ohuhu caps show; the answer shows them everywhere, with Undo', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    init: () => {
      window.__MS_CAPQ = true;
    },
  });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    state.cap = {};
    state.capQ = 0;
    save();
    SF.setCollection(sfCollection());
  });
  await page.click('#sfColor');
  await idle(page);
  await page.waitForSelector('#sfAlist .sfcapq');
  const q = await page.textContent('#sfAlist .sfcapq');
  assert.match(q, /Ohuhu changed its codes in 2025\. Does this cap say .+ or .+\?/);
  const i = await page.getAttribute('#sfAlist .sfcapq', 'data-i');
  // (what the picture's labels draw from here on)
  await page.evaluate(() => {
    const P = CanvasRenderingContext2D.prototype,
      ft = P.fillText;
    window.__drawn = [];
    P.fillText = function (t) {
      window.__drawn.push(String(t));
      return ft.apply(this, arguments);
    };
  });
  await page.click('#sfAlist .sfcapq button[data-capq="old"]');
  await idle(page);
  // (the picture's labels too, drawn again whole: the older cap's code of the marker asked about)
  const drawnOld = await page.evaluate((i) => window.__drawn.includes(oldCode(COLORS[+i])), i);
  assert.ok(drawnOld, 'the labels show the older caps’ codes');
  assert.equal(await page.evaluate(() => [state.capDef, state.capQ].join(' ')), 'old 1');
  assert.equal(await page.locator('#sfAlist .sfcapq').count(), 0, 'asked once');
  // (the rows show the older caps' codes, "now …" beside)
  const old = await page.evaluate((i) => oldCode(COLORS[+i]), i);
  assert.match(await page.textContent('#sfAlist'), new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await page.click('#msToast button:has-text("Undo")');
  await idle(page);
  assert.equal(await page.evaluate(() => [state.capDef, state.capQ].join(' ')), ' 0');
  assert.deepEqual(errors, []);
});

// (v318.21 debugging pass) the * on a section left as it was, when another section's change gives it one; another
// tab's change of what caps say reaching an open guide
test('the * follows a change elsewhere in the guide; another tab’s setting redraws an open guide', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest;
    state.owned = new Set([...defaultOwned()].concat(['Ohuhu|RV17', 'Ohuhu|R22']));
    state.cap = { 'Ohuhu|RV17': 'old' };
    state.capQ = 1;
    save();
    SF.setCollection(sfCollection());
    const by = {};
    sfCollection().forEach((m) => (by[m.mkey] = m));
    const A = t.assignData.assign,
      comps = t.comps,
      ls = Object.keys(A)
        .map(Number)
        .filter((l) => comps[l])
        .sort((a, b) => comps[b].area - comps[a].area);
    A[ls[0]] = by['Ohuhu|RV17'];
    SF.capChanged();
    const P = CanvasRenderingContext2D.prototype,
      ft = P.fillText;
    let drawn = [];
    P.fillText = function (s) {
      drawn.push(String(s));
      return ft.apply(this, arguments);
    };
    // (as Change colour does: the picture drawn again where it changed)
    A[ls[1]] = by['Ohuhu|R22'];
    t.renderGuide();
    const star = drawn.includes('R22*');
    drawn = [];
    const v = JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3'));
    v.capDef = 'old';
    localStorage.setItem('ohuhu-hb320-picker-v3', JSON.stringify(v));
    syncFromStorage();
    // (any older cap's code drawn: a small section's label is a dot)
    const synced = Object.values(A).some(
      (m) => m.brand === 'Ohuhu' && m.mkey !== 'Ohuhu|RV17' && capIsOld(m) && drawn.includes(capCode(m)),
    );
    P.fillText = ft;
    return { star, synced };
  });
  assert.deepEqual(r, { star: true, synced: true });
  assert.deepEqual(errors, []);
});

test('Add’s Undo takes back what the caps said and the offer; Add with a question just raised keeps Scan open', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: stored() });
  await idle(page);
  await scanFromMarkers(page);
  await idle(page);
  await read(page, ['YR170', 'RP6', 'BR3', 'YR030', 'G420', 'CG050', 'NG03', 'PB1', 'Y7', 'R10', 'YR2']);
  await idle(page);
  await page.click('#scAdd');
  await idle(page);
  assert.equal(await page.evaluate(() => state.capOffer), 1);
  await page.click('#msToast button:has-text("Undo")');
  await idle(page);
  assert.deepEqual(await page.evaluate(() => [Object.keys(state.cap).length, state.capOffer]), [0, 0]);
  // (R6 read for R213, yours: nothing new but the cap; R22 typed in the box raises a question: Scan stays open)
  await scanFromMarkers(page);
  await idle(page);
  await read(page, ['R6']);
  await idle(page);
  // (left in the box, read at Add: set without an input event, which WebKit's fill reads at once)
  await page.evaluate(() => {
    document.getElementById('scBox').value = 'R22';
  });
  await page.click('#scAdd');
  await idle(page);
  assert.ok(await page.isVisible('#scanOverlay.on'), 'Scan stays open over the question');
  assert.equal(await page.evaluate(() => state.cap['Ohuhu|R213'] || ''), '');
  assert.deepEqual(errors, []);
});

test('"I don’t have it" asks about another of your markers, the keyboard on its question; three such and it’s asked no more', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    init: () => {
      window.__MS_CAPQ = true;
    },
  });
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    state.cap = {};
    state.capQ = 0;
    save();
    SF.setCollection(sfCollection());
  });
  await page.click('#sfColor');
  await idle(page);
  const seen = [];
  for (let n = 0; n < 3; n++) {
    await page.waitForSelector('#sfAlist .sfcapq');
    seen.push(await page.getAttribute('#sfAlist .sfcapq', 'data-i'));
    await page.click('#sfAlist .sfcapq button[data-capq="none"]');
    await idle(page);
    if (n < 2)
      assert.equal(
        await page.evaluate(() => document.activeElement && document.activeElement.dataset.capq),
        'new',
        'the keyboard on the next question',
      );
  }
  assert.equal(new Set(seen).size, 3, seen.join(' '));
  assert.equal(await page.locator('#sfAlist .sfcapq').count(), 0);
  assert.equal(await page.evaluate(() => state.capQ), 1);
  assert.deepEqual(errors, []);
});
