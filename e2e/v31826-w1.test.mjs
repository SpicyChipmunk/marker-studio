// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, sampleGuide, addFromMarkers } from './helpers.mjs';

before(setup);
after(teardown);

const visible = (page, id) =>
  page.evaluate((id) => !!document.getElementById(id).getClientRects().length, id);
const toastOn = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    return !!t && t.classList.contains('on') && getComputedStyle(t).visibility !== 'hidden';
  });

// ---- A6: the welcome's Undo, a link on "Anything else?" ----
test('A6 a set added in the welcome: no toast; an Undo link under the sentence takes them out and goes back to the list', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  assert.equal(
    await page.textContent('#wcDone'),
    'Honolulu 120 and its Colorless Blender are in your collection. Anything else?',
  );
  assert.equal(await toastOn(page), false, 'no toast over the step');
  assert.ok(await visible(page, 'wcUndoBtn'));
  assert.equal(await page.getAttribute('#wcUndoBtn', 'aria-label'), 'Undo: take these 120 markers back out');
  await page.click('#wcUndoBtn');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  assert.ok(await visible(page, 'wcStep1'), 'back on the list');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'wcT1');
  // added again, then another step: the link goes with the step, and isn't back when Back returns there
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.ok(await visible(page, 'wcUndoBtn'));
  await page.click('#wcMoreExtra');
  await idle(page);
  await page.click('#wcStepOne .wcback');
  await idle(page);
  assert.ok(await visible(page, 'wcStep2'));
  assert.equal(await visible(page, 'wcUndoBtn'), false);
  assert.equal(await page.evaluate(() => state.owned.size), 121, 'still added');
  assert.deepEqual(errors, []);
});

test('A6 the chart from the welcome: its Undo is the link too, named for what it does; Markers’ own Add a set keeps its toast', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneChart');
  await idle(page);
  await page.click('#chGrid .chsw >> nth=0');
  await page.click('#chGrid .chsw >> nth=1');
  await page.click('#chSave');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '2 markers added');
  assert.equal(await toastOn(page), false);
  assert.equal(await page.getAttribute('#wcUndoBtn', 'aria-label'), 'Undo: take these 2 markers back out');
  await page.click('#wcUndoBtn');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 0);
  assert.ok(await visible(page, 'wcStepOne'), 'back where the chart was opened from');
  // a set and then Some are missing, unticking one: "put your collection back as it was"
  await page.click('#wcStepOne .wcback');
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  await page.click('#wcMoreMiss');
  await idle(page);
  await page.click('#chGrid .chsw[aria-pressed="true"] >> nth=0');
  await page.click('#chSave');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '1 marker removed');
  assert.equal(
    await page.getAttribute('#wcUndoBtn', 'aria-label'),
    'Undo: put your collection back as it was',
  );
  await page.click('#wcUndoBtn');
  await idle(page);
  assert.equal(await page.evaluate(() => state.owned.size), 121);
  assert.equal(await page.textContent('#wcT2'), '120 markers added', 'as it said before');
  assert.equal(await visible(page, 'wcUndoBtn'), false, 'only the latest add is undone by the link');
  // Markers' Add markers sheet: its set still says so in a toast with Undo
  await page.click('#wcLook');
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set();
    save();
    fullRender();
  });
  await addFromMarkers(page, 'set');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.ok(await toastOn(page));
  assert.match(await page.textContent('#msToast'), /^Added 120 markers/);
  assert.deepEqual(errors, []);
});

test('A6 a small phone at 1.6× text: the link fits under the sentence, its tap area clear of the choices, no toast', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  const g = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect(),
      b = document.getElementById('wcUndoBtn'),
      a = getComputedStyle(b, '::after'),
      bb = r(b),
      mid = (bb.top + bb.bottom) / 2,
      more = r(document.getElementById('wcMore')),
      done = r(document.getElementById('wcDone'));
    return {
      h: bb.height,
      w: bb.width,
      tapTop: mid - parseFloat(a.height) / 2,
      tapBottom: mid + parseFloat(a.height) / 2,
      doneBottom: done.bottom,
      moreTop: more.top,
      sideways: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.ok(g.h > 10 && g.h < 44, 'a line, not a 44px button: ' + g.h);
  assert.ok(g.tapBottom <= g.moreTop + 1, 'its tap area ends above the choices: ' + JSON.stringify(g));
  assert.equal(g.sideways, false);
  assert.equal(await toastOn(page), false);
  assert.deepEqual(errors, []);
});

// ---- A2: a batch's photos not read ----
test('A2 Done after a batch: the photos not read said; all of them, said as that; Undo counts only the photos read', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.evaluate(() => openScan());
  await idle(page);
  const r = await page.evaluate(() => {
    const f = new File([new Uint8Array(8)], 'a.jpg', { type: 'image/jpeg' }),
      out = {};
    // three photos, the second not read (the first and third added 2 and 1)
    const per = () => [
      { added: 2, asked: 0 },
      { added: 0, asked: 0, failed: true },
      { added: 1, asked: 0 },
    ];
    ocrQ = { files: [f, f, f], k: 3, n0: 1, per: per(), stop: false, t0: 0 };
    ocrRun = { n: 3, done: true, added: 1, asked: 0, note: '' };
    if (!document.getElementById('ocrBtns')) {
      const b = document.createElement('div');
      b.id = 'ocrBtns';
      document.body.appendChild(b);
    }
    ocrButtons(ocrRun);
    out.undo = document.getElementById('ocrUndo').textContent;
    ocrFinish();
    out.done = document.getElementById('scStat').textContent;
    // every photo not read
    ocrQ = {
      files: [f, f, f],
      k: 3,
      n0: 1,
      per: per().map(() => ({ added: 0, asked: 0, failed: true })),
      stop: false,
      t0: 0,
    };
    ocrRun = { n: 3, done: true, failed: true, added: 0, asked: 0, note: 'This photo couldn’t be opened.' };
    ocrFinish();
    out.none = document.getElementById('scStat').textContent;
    out.noneKind = document.getElementById('scStat').className;
    return out;
  });
  assert.equal(r.undo, 'Undo these 2 photos');
  assert.match(r.done, /From 3 photos: 3 added to the list1 not read/);
  assert.match(r.none, /None of the 3 photos could be readThis photo couldn’t be opened\./);
  assert.match(r.noneKind, /\bnone\b/);
  assert.deepEqual(errors, []);
});

// ---- A3: Focus mode's Back ----
test('A3 Focus mode’s Back says Back beside its arrow, and fits a small phone at 1.6× text on one line', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
  await sampleGuide(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
  await page.click('#sfFSkip');
  await idle(page);
  assert.equal((await page.textContent('#sfFBack')).trim(), '← Back');
  assert.equal(await page.getAttribute('#sfFBack', 'aria-label'), 'Back');
  const g = await page.evaluate(() => {
    const bar = document.querySelector('.sffocbot'),
      ids = ['sfFBack', 'sfFDone', 'sfFSkip'].map((id) =>
        document.getElementById(id).getBoundingClientRect(),
      );
    return {
      h: ids.map((r) => Math.round(r.height)),
      tops: ids.map((r) => Math.round(r.top)),
      right: Math.max(...ids.map((r) => r.right)),
      w: innerWidth,
      over: bar.scrollWidth > bar.clientWidth,
      oneLine: [...bar.querySelectorAll('button')].every(
        (b) => b.getClientRects().length && b.scrollHeight <= b.clientHeight + 1,
      ),
    };
  });
  assert.deepEqual(g.h, [44, 44, 44], 'one line each');
  assert.equal(new Set(g.tops).size, 1, 'in one row');
  assert.ok(g.right <= g.w && !g.over, JSON.stringify(g));
  assert.deepEqual(errors, []);
});

// ---- A7: an older cap's name in Markers' search ----
test('A7 Markers’ search: an older cap’s name finds its marker, the cell named for that cap', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await page.click('#wcLook');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await page.fill('#q', 'rose red');
  await idle(page);
  const cell = await page.evaluate(() => {
    const el = document.querySelector('#results .cell[data-i="' + keyIdx('Ohuhu|R213') + '"]');
    return el && { label: el.getAttribute('aria-label'), code: el.querySelector('.cc').textContent };
  });
  assert.ok(cell, 'R213 found by its older cap’s name');
  assert.equal(cell.code, 'R213', 'the code shown as the setting says');
  assert.match(cell.label, /^Ohuhu R213 Pomegranate, older cap R6 Rose Red, /);
  assert.deepEqual(errors, []);
});

// ---- A9: Print's paper, a link to its choices ----
test('A9 Print: the summary’s paper is a link to the Paper choices, focusing the one chosen; the foot no taller', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
  const link = await page.$('#sfPrSum button[data-pr="topaper"]');
  assert.ok(link);
  const paper = (await link.textContent()).trim();
  assert.match(await page.textContent('#sfPrSum'), new RegExp('page.* · ' + paper + ' · '));
  // the foot as tall as with the paper's name as plain text
  const hs = await page.evaluate(() => {
    const s = document.getElementById('sfPrSum'),
      a = s.getBoundingClientRect().height,
      html = s.innerHTML;
    s.innerHTML = html.replace(/<button[^>]*data-pr="topaper"[^>]*>([^<]*)<\/button>/, '$1');
    const b = s.getBoundingClientRect().height;
    s.innerHTML = html;
    return [a, b];
  });
  assert.ok(Math.abs(hs[0] - hs[1]) < 1, 'foot height ' + hs);
  // (and Download PDF on one line: it had wrapped, "PDF" cut off at the button's foot)
  const pdf = await page.evaluate(() => {
    const b = document.getElementById('sfPDF');
    return { sh: b.scrollHeight, ch: b.clientHeight, sw: b.scrollWidth, cw: b.clientWidth, t: b.textContent };
  });
  assert.ok(pdf.sh <= pdf.ch + 1 && pdf.sw <= pdf.cw + 1, JSON.stringify(pdf));
  await page.click('#sfPrSum button[data-pr="topaper"]');
  await page.waitForTimeout(600);
  const f = await page.evaluate(() => {
    const a = document.activeElement,
      r = a.getBoundingClientRect();
    return {
      paper: a.dataset.paper || null,
      pressed: a.getAttribute('aria-pressed'),
      top: r.top,
      bottom: r.bottom,
      h: innerHeight,
    };
  });
  assert.ok(f.paper, 'a Paper choice has the keyboard');
  assert.equal(f.pressed, 'true', 'the one chosen');
  assert.ok(f.top >= 0 && f.bottom <= f.h, 'in view: ' + JSON.stringify(f));
  assert.deepEqual(errors, []);
});

// ---- D: Send feedback's waits, in the form's Message ----
const FORM =
  'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
  Array.from({ length: 27 }, (_, i) => 'entry.' + (1000 + i) + '=x').join('&');
test('D Send feedback by the form: this visit’s longest waits after the Screen line; a long note cut, the details kept whole', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    init: `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};`,
  });
  const msgs = [];
  await page.route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
    const q = new URLSearchParams(r.request().postData() || '');
    // (the Message field: the 27th, whatever the fields after it)
    msgs.push(q.get('entry.1026'));
    return r.fulfill({ status: 200, body: 'ok' });
  });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await page.click('#wcLook');
  await idle(page);
  await page.evaluate(() => {
    holdAdd('Sections', 2345, '2048×1536');
    holdAdd('Build', 812, '2048×1536');
  });
  await page.click('#homeFeedback');
  await page.fill('#fbText', 'Slow on my iPad.');
  await page.click('#fbSend');
  await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
  assert.match(
    msgs[0],
    /^Slow on my iPad\.\n\nNo errors recorded\.\nScreen: [^\n]+\nLongest waits, this visit:\nSections 2345 ms \(2048×1536\)\nBuild 812 ms \(2048×1536\)$/,
  );
  // the longest note, three long errors and eight waits: within the form's 4000, the waits all there
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) errLog('Opening a guide', new Error('long '.repeat(60) + i));
    for (let i = 0; i < 8; i++) holdAdd('Finding the page and sections ' + i, 3000 + i, '4032×3024');
  });
  await page.click('#homeFeedback');
  await page.fill('#fbText', 'x'.repeat(3000));
  await page.click('#fbSend');
  await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
  const m = msgs[1];
  assert.ok(m.length <= 4000, String(m.length));
  assert.match(
    m,
    /\nScreen: [^\n]+\nLongest waits, this visit:\n(Finding the page and sections \d 300\d ms \(4032×3024\)\n?){8}$/,
  );
  assert.ok(m.startsWith('x'.repeat(2000)));
  assert.deepEqual(errors, []);
});
