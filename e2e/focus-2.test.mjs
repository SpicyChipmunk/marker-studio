// Focus mode.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFromMarkers,
  answerAsks,
  idle,
  letterGuide,
  openApp,
  openAtScale,
  pause,
  sampleGuide,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from v315-focus.test.mjs ----
// v315 (Q8): Focus mode's hand-off card goes above, below, left or right of the next marker's sections, wherever it
// covers least of them, then lets them be biggest, then hides least of the picture; while it's up the picture is
// centred in the room it leaves; never over the zoom buttons or the bars; placed again when the screen turns. Fails on
// v314.1, whose card went above or below only and, on a phone held sideways, over the picture.
{
  async function letterFocus(page) {
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mSections');
    await idle(page);
    await letterGuide(page);
    await answerAsks(page);
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
    }
    return false;
  }
  // the card against the picture, the next marker's sections (their middles), the zoom buttons and the top bar
  const geo = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        inter = (a, b) =>
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)),
        card = document.querySelector('#sfHand .sfhcard').getBoundingClientRect(),
        cv = document.getElementById('sfCanvas').getBoundingClientRect(),
        zc = document.getElementById('sfZoomCtl').getBoundingClientRect(),
        bar = document.querySelector('.sffocbar').getBoundingClientRect(),
        k = cv.width / t.W,
        l0 = t.focusOrd[t.focusPos],
        mk = t.assignData.assign[l0].mkey,
        secs = t.assignData.order.filter((l) => t.assignData.assign[l].mkey === mk && !t.colored[l]),
        under = secs.filter((l) => {
          const c = t.comps[l],
            x = cv.left + c.cx * k,
            y = cv.top + c.cy * k;
          return x > card.left && x < card.right && y > card.top && y < card.bottom;
        }).length;
      return {
        side: document.getElementById('sfHand').className,
        overPic: inter(card, cv) / (card.width * card.height),
        under,
        overZoom: inter(card, zc) > 0,
        // (v323: a phone on its side has the side rail; over the bar is any overlap with it, top bar or rail)
        overBar: inter(card, bar) > 1,
      };
    });
  // (v320: held sideways, Focus mode's buttons are a column at the side, and the picture's column is narrower: the card
  // beside the sections may lie over the page's paper, never over a section of the marker it names)
  test('an iPad held sideways: the card by the sections, hiding none of them', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await letterFocus(page);
    assert.ok(
      await page.evaluate(() => document.documentElement.classList.contains('sfrailon')),
      'the side rail',
    );
    for (let n = 0; n < 3; n++) {
      assert.ok(await toCard(page), 'a hand-off');
      // (beside the sections, above or below them: wherever the narrower column leaves them biggest)
      await page.waitForSelector('#sfHand:not([hidden]) .sfhcard');
      await idle(page);
      const g = await geo(page);
      assert.equal(g.under, 0, `${n}: ${g.side}: sections under the card`);
      assert.equal(g.overZoom, false);
      await page.click('#sfFDone');
      await idle(page);
    }
    assert.deepEqual(errors, []);
  });
  test('a phone held sideways: no next section under the card, clear of the zoom buttons and the bar; turned, placed again', async () => {
    // (set up upright: the welcome's buttons are below the fold on a phone held sideways)
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await letterFocus(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await idle(page);
    for (let n = 0; n < 3; n++) {
      assert.ok(await toCard(page), 'a hand-off');
      const g = await geo(page);
      assert.equal(g.under, 0, `${n}: ${g.side}: sections under the card`);
      assert.equal(g.overZoom, false, 'over the zoom buttons');
      assert.equal(g.overBar, false, 'over the top bar');
      if (n < 2) {
        await page.click('#sfFDone');
        await idle(page);
      }
    }
    // turned with the card up
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !/sfhleft|sfhright/.test(document.getElementById('sfHand').className));
    await idle(page);
    const g = await geo(page);
    assert.equal(g.under, 0, 'turned: no section under the card');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31825-x3.test.mjs ----
// v318.25 in the browser.
{
  // Focus mode on the sample, Done through to the next three hand-offs: for each, how many of the next marker's
  // uncoloured sections have their label point under the card, and whether the card says they're "shown on the picture"
  async function handOffs(page) {
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    const res = [];
    for (let i = 0; i < 80 && res.length < 3; i++) {
      await page.click('#sfFDone');
      await idle(page);
      if (!(await page.evaluate(() => !document.getElementById('sfHand').hidden))) continue;
      await pause(page, 400, 'the card’s entrance and the picture’s move to the sections');
      res.push(
        await page.evaluate(() => {
          const t = __mstest,
            c = document.getElementById('sfCanvas').getBoundingClientRect(),
            cv = document.getElementById('sfCanvas'),
            k = document.querySelector('#sfHand .sfhcard').getBoundingClientRect();
          let n = 0,
            under = 0;
          for (const l of t.assignData.order) {
            if (t.assignData.assign[l].mkey !== t.hlKey || t.colored[l]) continue;
            n++;
            const q = t.labelPos(l),
              x = c.left + (q.x / cv.width) * c.width,
              y = c.top + (q.y / cv.height) * c.height;
            if (x >= k.left && x <= k.right && y >= k.top && y <= k.bottom) under++;
          }
          return {
            n,
            under,
            shown: /shown on the picture/.test(document.querySelector('#sfHand .sfhsub').innerText),
          };
        }),
      );
      await page.click('#sfFDone');
      await idle(page);
    }
    return res;
  }
  test('X3 E1: the hand-off card on a small phone with large text leaves the next marker’s sections in sight', async () => {
    for (const [w, h] of [
      [375, 667],
      [320, 568],
    ]) {
      const { page, errors, ctx } = await openAtScale(1.6, { width: w, height: h });
      const r = await handOffs(page);
      assert.equal(r.length, 3);
      for (const x of r) {
        assert.equal(x.under, 0, `${w}×${h}: ${x.under} of ${x.n} under the card`);
        // (the short card, which doesn't say so: it's only the full card that is sure to leave them all in sight)
        assert.equal(x.shown, false);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // a phone with room: the full card, as before
    const { page, errors } = await openApp({ width: 390, height: 844 });
    for (const x of await handOffs(page)) assert.deepEqual([x.under, x.shown], [0, true]);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfHand').classList.contains('sfhtight')),
      false,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
{
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
    assert.equal((await page.textContent('#sfFBack')).trim(), 'Back');
    assert.equal(await page.locator('#sfFBack svg.icback').count(), 1, 'its arrow a chevron (v321)');
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
}

// ---- from v31832-fixes.test.mjs ----
// v318.32 bug fixes (Fable R32: U1-1, D3-1, D1-3, decisions 6.9 and 6.10). Each fails on v318.31.
{
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
}

// ---- from v31832-g1.test.mjs ----
// v318.32 G1: Focus mode on the iPad — "Exit" in a word in the top bar, and the hand-off card always on the screen.
// Fails on v318.31: the top bar's way out was a bare ✕ (Ben didn't read it as one), the card ran under the bars and off
// the screen in a short window with large text, and a quick second tap on Done could zoom the whole page (Safari).
{
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
  const rect = (page, sel) =>
    page.$eval(sel, (e) => {
      const b = e.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
    });
  test('G1 exit: "Exit" in a word, labelled, leaves Focus mode to Colour along as Escape does', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, touch: true });
    await focusOn(page);
    const b = await page.$eval('#sfExitFoc', (e) => ({
      text: e.textContent.trim(),
      label: e.getAttribute('aria-label'),
      touch: getComputedStyle(e.closest('.sffocbar')).touchAction,
    }));
    assert.equal(b.text, 'Exit', 'the word (v318.31: a bare ✕)');
    assert.equal(b.label, 'Exit Focus mode');
    assert.equal(b.touch, 'manipulation', 'no double-tap zoom of the page from the bar (v318.31: auto)');
    assert.equal(
      await page.$eval('.sffocbot', (e) => getComputedStyle(e).touchAction),
      'manipulation',
      'nor from Done tapped twice in a row',
    );
    // a few sections on, Exit: back on Colour along with that marker's row open, as Escape and the back swipe do
    await page.click('#sfFSkip');
    await idle(page);
    await page.click('#sfFSkip');
    await idle(page);
    const k = await page.evaluate(
      () => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey,
    );
    await page.click('#sfExitFoc');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.focus), false);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    assert.equal(await page.$eval('#sfAlist .sfarow.open', (r) => r.dataset.k), k, 'that marker’s row open');
    assert.deepEqual(errors, []);
  });
  test('G1 exit: at 320 px and 1.6× text the bar still fits: Exit, the swatch, two lines of name and Colours', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 320, height: 568, touch: true });
    await focusOn(page);
    const ex = await rect(page, '#sfExitFoc'),
      nm = await rect(page, '.sffocname'),
      co = await rect(page, '#sfFocCols'),
      sw = await rect(page, '#sfFocSw');
    assert.ok(ex.l >= 0 && co.r <= 320, `in the screen: Exit at ${ex.l}, Colours ends at ${co.r}`);
    assert.ok(ex.r <= sw.l && sw.r <= nm.l && nm.r <= co.l, 'in a row, none over another');
    assert.ok(nm.w >= 70, `the name line has room: ${nm.w}px`);
    assert.ok(ex.h >= 40, 'tall enough to tap');
    assert.deepEqual(errors, []);
  });
  test('G1 card: a short wide window with large text: the card between the bars, on the screen, whole', async () => {
    // (an iPad's Stage Manager window, or Safari with its keyboard up: the room between the bars is shorter than the card)
    const { page, errors } = await openAtScale(2, { width: 1180, height: 460, touch: true });
    await focusOn(page);
    assert.ok(await toCard(page), 'a hand-off');
    const g = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const card = r('#sfHand .sfhcard'),
        bar = r('.sffocbar'),
        bot = r('.sffocbot');
      const inter = (a, b) =>
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const rail = document.documentElement.classList.contains('sfrailon');
      return {
        rail,
        top: card.top,
        bottom: card.bottom,
        barB: rail ? (inter(card, bar) > 1 ? Infinity : -Infinity) : bar.bottom,
        botT: rail ? (inter(card, bot) > 1 ? -Infinity : Infinity) : bot.top,
        vh: innerHeight,
        scrolls: document.querySelector('#sfHand .sfhcard').scrollHeight > card.height + 1,
      };
    });
    assert.ok(
      g.top >= g.barB - 1,
      `the card starts below the top bar: ${g.top} vs ${g.barB} (v318.31: under it)`,
    );
    assert.ok(g.bottom <= g.botT + 1, `and ends above the bottom bar: ${g.bottom} vs ${g.botT}`);
    assert.ok(g.top >= 0 && g.bottom <= g.vh, 'on the screen');
    // (v323: this window now has the compact side rail; the card is then in the picture's column, clear of the rail)
    // (v318.32 D3-1: a card taller than its room is tried again as the short card, which fits here; the full card had
    // scrolled inside, nothing saying so. Were the short one too tall for the room, it would scroll as before)
    assert.ok(!g.scrolls, 'nothing cut: the short card fits');
    await page.click('#sfFDone');
    await idle(page);
    assert.equal(await page.isVisible('#sfHand'), false, 'Done closes it');
    assert.deepEqual(errors, []);
  });
  test('G1 card: turned with the card up, the bars measured again before it is placed', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820, touch: true });
    await focusOn(page);
    assert.ok(await toCard(page), 'a hand-off');
    // (the vars the card's room is laid out from, made stale as a turn would leave them)
    await page.evaluate(() => document.documentElement.style.setProperty('--focTop', '300px'));
    await page.setViewportSize({ width: 820, height: 1180 });
    await idle(page);
    const g = await page.evaluate(() => ({
      v: document.documentElement.style.getPropertyValue('--focTop'),
      bar: document.querySelector('.sffocbar').offsetHeight + 'px',
      up: document.getElementById('sfHand').hidden === false,
    }));
    assert.ok(g.up, 'the card still up');
    assert.equal(
      g.v,
      g.bar,
      'the top bar’s height, measured as the card was placed again (v318.31: left as it was)',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- v323: Continue opens Focus mode again ----
{
  // Left in Focus mode (the app closed or reloaded, not Exit), Home's Continue opens Focus mode on the section it was on;
  // left by Exit, it goes to Colour along as before. Kept with the guide (focusAt)
  test('Continue opens Focus mode again where it was left, unless it was left by Exit; after a reload too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await letterGuide(page);
    await page.evaluate(() => __mstest.flushSave());
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFDone');
    await idle(page);
    await page.click('#sfFDone');
    await idle(page);
    const at = await page.evaluate(() => __mstest.focusOrd[__mstest.focusPos]);
    assert.equal(await page.evaluate(() => __mstest.focusAt), at);
    await page.evaluate(() => __mstest.flushSave());
    const reopen = async () => {
      await page.reload();
      await page.waitForFunction(() => typeof state !== 'undefined' && document.readyState === 'complete');
      await idle(page, 1500);
      await page.click('#homeCont [data-cont]');
      await page.waitForFunction(() => window.__mstest && __mstest.sfmode === 'color', null, {
        timeout: 30000,
      });
      await idle(page);
    };
    await reopen();
    assert.equal(await page.evaluate(() => __mstest.focus), true, 'Focus mode again');
    assert.equal(await page.evaluate(() => __mstest.focusOrd[__mstest.focusPos]), at, 'on that section');
    // left by Exit: Continue goes to Colour along
    await page.click('#sfExitFoc');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.focusAt), null);
    await page.evaluate(() => __mstest.flushSave());
    await reopen();
    assert.equal(await page.evaluate(() => __mstest.focus), false, 'Colour along, as before');
    assert.deepEqual(errors, []);
  });
}
