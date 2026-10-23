// v318.32 bug fixes (Fable R32: U1-1, D3-1, D1-3, decisions 6.9 and 6.10). Each fails on v318.31.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, sampleGuide, answerAsks } from './helpers.mjs';

before(setup);
after(teardown);

async function focusOn(page) {
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  await page.click('#sfFocus');
  await idle(page);
}
// Done until the hand-off card shows
async function toCard(page) {
  for (let i = 0; i < 80; i++) {
    await page.click('#sfFDone');
    await idle(page);
    if (await page.isVisible('#sfHand')) return true;
    if (await page.locator('#sfFReveal').count()) return false;
  }
  return false;
}

// U1-1: Adjust photo opens into view, its rows above the Build bar (they had opened under the sticky bar, or below the
// fold, so nothing seemed to happen)
async function adjustGeo(page) {
  return page.evaluate(() => {
    const r = (s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect() : null;
    };
    const tg = r('#sfAdjToggle'),
      // (the panel's last row: Tilt, or Sensitivity when Enhance is on)
      sens = document.getElementById('sfSensWrap'),
      last = sens && sens.offsetParent !== null ? sens : document.getElementById('sfTilt').closest('label'),
      pn = last ? last.getBoundingClientRect() : null,
      bar = r('#sfWork>.sfbar'),
      pic = r('#sfView');
    return {
      toggleTop: tg && tg.top,
      panelBottom: pn && pn.bottom,
      barTop: bar && bar.top,
      picBottom: pic && pic.bottom,
      vh: innerHeight,
    };
  });
}
for (const [name, size] of [
  ['phone 390×844', { width: 390, height: 844, touch: true }],
  ['iPad portrait 820×1180', { width: 820, height: 1180, touch: true }],
]) {
  test('U1-1 ' + name + ': Adjust photo opens with its rows in view above the Build bar', async () => {
    const { page, errors } = await openApp(size);
    await sampleGuide(page);
    await idle(page);
    await answerAsks(page);
    await page.click('#sfBack2');
    await idle(page);
    // (as a finger would: the toggle in view, the page not scrolled further by the click)
    await page.$eval('#sfAdjToggle', (b) => b.scrollIntoView({ block: 'center' }));
    await idle(page);
    await page.$eval('#sfAdjToggle', (b) => b.click());
    await idle(page);
    const g = await adjustGeo(page);
    assert.ok(g.panelBottom != null && g.barTop != null, 'panel and bar: ' + JSON.stringify(g));
    assert.ok(
      g.panelBottom <= g.barTop + 1,
      `the panel's last row above the Build bar: ${g.panelBottom} vs ${g.barTop} (v318.31: under it)`,
    );
    assert.ok(g.panelBottom <= g.vh, 'and on the screen');
    assert.ok(
      g.toggleTop >= g.picBottom - 1,
      `the toggle below the pinned picture: ${g.toggleTop} vs ${g.picBottom}`,
    );
    assert.deepEqual(errors, []);
  });
}

// D3-1: the hand-off card on a small phone at the largest text: the whole of it shows (it had scrolled inside with
// nothing to say so, "your hand" cut in half)
test('D3-1 320×568 at 1.6× text: the hand-off card is not cut', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568, touch: true });
  await focusOn(page);
  assert.ok(await toCard(page), 'a hand-off');
  const g = await page.evaluate(() => {
    const card = document.querySelector('#sfHand .sfhcard'),
      r = card.getBoundingClientRect(),
      bar = document.querySelector('.sffocbar').getBoundingClientRect(),
      bot = document.querySelector('.sffocbot').getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      barB: bar.bottom,
      botT: bot.top,
      sh: card.scrollHeight,
      ch: card.clientHeight,
      tight: document.getElementById('sfHand').classList.contains('sfhtight'),
      text: card.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  assert.ok(g.sh <= g.ch + 1, `nothing cut: scrollHeight ${g.sh} vs ${g.ch} (tight: ${g.tight})`);
  assert.ok(g.top >= g.barB - 1 && g.bottom <= g.botT + 1, `between the bars: ${JSON.stringify(g)}`);
  assert.match(g.text, /Pick up/);
  assert.deepEqual(errors, []);
});

// 6.10: Focus's entry framed again once the bars have measured (Safari on an iPad held upright had laid the bars out
// after the frame, which used their heights before: the picture whole, a blank band above). Here the bars' late
// measure is played: a style keeps them 0 tall through the entry's frames and goes 100 ms later; the frame a plain
// entry gives is the truth to match
test('6.10 iPad portrait: Focus reframes the section once the bars have measured', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  // the truth: a plain entry's frame of the first section
  await page.click('#sfFocus');
  await idle(page);
  const truth = await page.evaluate(() => ({
    zoom: __mstest.zoom,
    panY: __mstest.panY,
    l: __mstest.focusCur(),
  }));
  await page.click('#sfExitFoc');
  await idle(page);
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '.sffocbar,.sffocbot{display:none !important}';
    document.head.appendChild(st);
    setTimeout(() => st.remove(), 100);
  });
  await page.click('#sfFocus');
  await idle(page);
  await page.waitForTimeout(600);
  await idle(page);
  const g = await page.evaluate(() => ({
    zoom: __mstest.zoom,
    panY: __mstest.panY,
    l: __mstest.focusCur(),
    focus: __mstest.focus,
    bars: document.querySelector('.sffocbar').offsetHeight,
    // (the picture's room between the bars: fitFocus pads the view by their heights)
    padT: parseFloat(document.getElementById('sfView').style.paddingTop) || 0,
  }));
  assert.ok(
    g.focus && g.bars > 0 && g.l === truth.l,
    'Focus on the same section, the bars back: ' + JSON.stringify(g),
  );
  assert.ok(
    Math.abs(g.padT - g.bars) <= 1,
    `the picture's room starts under the top bar: padding ${g.padT} vs bar ${g.bars} (v318.31: 0, the frame of the bars' first measure stayed)`,
  );
  assert.ok(
    Math.abs(g.zoom - truth.zoom) <= truth.zoom * 0.02 && Math.abs(g.panY - truth.panY) <= 4,
    `framed as a plain entry frames it: ${JSON.stringify(g)} vs ${JSON.stringify(truth)}`,
  );
  assert.deepEqual(errors, []);
});

// D1-3: the page left while a photo is read: the busy mark cleared (left, the next photo was read gently for a
// fortnight, with a note blaming the device). A read under way is stood in for: the mark set as ocrGo sets it
test('D1-3 pagehide during a read clears the busy mark; a page put in the cache keeps it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const r = await page.evaluate(() => {
    const out = {};
    localStorage.setItem('ms-ocr-busy', '1');
    // (nothing being read: the mark isn't this page's to clear)
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    out.idle = localStorage.getItem('ms-ocr-busy');
    ocrRun = { n: 1, done: false };
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    out.persisted = localStorage.getItem('ms-ocr-busy');
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    out.left = localStorage.getItem('ms-ocr-busy');
    ocrRun = null;
    return out;
  });
  assert.deepEqual(r, { idle: '1', persisted: '1', left: null });
  assert.deepEqual(errors, []);
});

// 6.9: a picture pasted into Scan's box (an iPad's Photos, Copy): said, with where to go, when the reader isn't stored
// (it had done nothing). Read by the reader when it is: e2e/v31832-ocr-start.test.mjs
test('6.9 a picture pasted into the box, the reader not stored: "Paste text, or use Photograph your caps"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcOneByOne');
  await page.click('#wcOneType');
  await idle(page);
  const r = await page.evaluate(async () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png')),
      f = new File([blob], 'cap.png', { type: 'image/png' }),
      dt = new DataTransfer();
    dt.items.add(f);
    const box = document.getElementById('scBox');
    box.focus();
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    box.dispatchEvent(ev);
    await new Promise((res) => setTimeout(res, 400));
    return {
      prevented: ev.defaultPrevented,
      files: dt.files.length,
      stat: document.getElementById('scStat').textContent.replace(/\s+/g, ' ').trim(),
      reading: !!(ocrRun && !ocrRun.done),
    };
  });
  assert.equal(r.files, 1, 'the paste carried the picture');
  assert.match(r.stat, /Paste text, or use Photograph your caps/);
  assert.equal(r.reading, false);
  assert.deepEqual(errors, []);
});
