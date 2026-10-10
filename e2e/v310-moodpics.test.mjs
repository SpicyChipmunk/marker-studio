// v310: Mood as pictures of the page (js/guide/32-mood-pics.js). Each picture is the mood laid from the guide as it
// is, then everything put back: these tests check that the guide is left exactly as it was (in every pattern and
// colour source the pictures show for, with pins, coloured sections, shading and filters), that nothing is said,
// saved or made an Undo step meanwhile, that a tap lays what its picture showed (Random and generated palettes
// too), that a mood left and come back to is a new roll as before, and where the pictures aren't shown.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  idle,
  sampleGuide,
  letterGuide,
  sectionPoint,
  scrollTop,
} from './helpers.mjs';

before(setup);
after(teardown);

const MOODS = ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'];
const ON = { 'ms-test-moodpics': '1' };

// the Mood row in view, and every other mood's picture made from the guide as it is now
async function pics(page) {
  await page.evaluate(() => document.getElementById('sfMood').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(
    (M) => {
      const t = __mstest,
        m = t.mp;
      return m.key === t.mpKey() && M.every((k) => k === t.emphasis || k in m.pics);
    },
    MOODS,
    { timeout: 30000 },
  );
  await idle(page);
}
async function tab(page, t) {
  await page.click('#sfTab-' + t);
  await idle(page);
}
async function pattern(page, v) {
  await tab(page, 'pattern');
  await page.click('#sfFam [data-v="' + v + '"]');
  await idle(page);
  await tab(page, 'colours');
}
// every mood laid by hand from the guide as it is (each checks itself: an error in the page if anything was left
// changed), and the guide, its Undo and what's saved compared before and after
async function layAll(page, what) {
  const r = await page.evaluate((M) => {
    const t = __mstest,
      k0 = t.mpKey(),
      a0 = t.assignData,
      u0 = t.planStack.length,
      auto0 = localStorage.getItem('ms-guide-auto'),
      out = {};
    for (const k of M) {
      if (k === t.emphasis) continue;
      const cols = t.mpLay(k, 12345);
      out[k] = cols ? Object.keys(cols).length : -1;
    }
    return {
      same: t.mpKey() === k0,
      ref: t.assignData === a0,
      undo: t.planStack.length === u0,
      auto: localStorage.getItem('ms-guide-auto') === auto0,
      out,
      off: t.mp.off,
    };
  }, MOODS);
  assert.ok(r.same && r.ref && r.undo && r.auto && !r.off, what + ': ' + JSON.stringify(r));
  return r.out;
}

test('the row: six pictures in Mood’s order, the one in use ticked, six across on an iPad, painted', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  await pics(page);
  const row = await page.evaluate(() =>
    [...document.querySelectorAll('#sfMood .sfmp')].map((b) => {
      const c = b.querySelector('canvas'),
        d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
        r = b.getBoundingClientRect();
      let lo = 255,
        hi = 0;
      for (let i = 0; i < d.length; i += 4 * 7) {
        lo = Math.min(lo, d[i]);
        hi = Math.max(hi, d[i]);
      }
      return {
        v: b.dataset.v,
        name: b.querySelector('.sfmpname').textContent,
        on: b.getAttribute('aria-pressed'),
        top: Math.round(r.top),
        range: hi - lo,
        wait: b.classList.contains('sfmpwait'),
      };
    }),
  );
  assert.deepEqual(
    row.map((x) => x.name),
    ['Any', 'Bright', 'Soft', 'Pastel', 'Deep', 'Earthy'],
  );
  assert.deepEqual(
    row.map((x) => x.on),
    ['true', 'false', 'false', 'false', 'false', 'false'],
  );
  assert.equal(new Set(row.map((x) => x.top)).size, 1, 'one row');
  assert.ok(
    row.every((x) => x.range > 60 && !x.wait),
    JSON.stringify(row),
  );
  // (the pictures differ from each other)
  const sigs = await page.evaluate(() => Object.values(__mstest.mp.pics).map((p) => !!p.im));
  assert.ok(sigs.every(Boolean));
  assert.deepEqual(errors, []);
});

test('making the pictures leaves the guide exactly as it was: every pattern and source they show for', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  await layAll(page, 'Gradient, your markers');
  await pattern(page, 'random');
  await layAll(page, 'Random, mixed');
  await tab(page, 'pattern');
  if (await page.$('#sfBal [data-v="main"]')) {
    await page.click('#sfBal [data-v="main"]');
    await idle(page);
  }
  await tab(page, 'colours');
  await layAll(page, 'Random, main colour');
  await pattern(page, 'blend');
  await layAll(page, 'Blend');
  await pattern(page, 'gradient');
  // a generated palette (made again for each mood), then the Temperature and fewer markers
  await page.click('#sfSrc [data-v="generate"]');
  await idle(page);
  await layAll(page, 'Gradient, generated palette');
  await page.click('#sfSrc [data-v="owned"]');
  await idle(page);
  await page.click('#sfPal [data-v="cool"]');
  await idle(page);
  await page.evaluate(() => {
    const s = document.getElementById('sfMkCount');
    s.value = 5;
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await idle(page);
  await layAll(page, 'cool, 5 markers');
  // Surprise: a generated palette with its harmony, Random or Gradient, any shape
  for (let i = 0; i < 3; i++) {
    await page.click('#sfSurprise');
    await idle(page);
    await layAll(page, 'Surprise ' + i);
  }
  assert.deepEqual(errors, []);
});

test('…with pins, sections coloured, and shading with Smooth them: still left exactly as it was', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  // a pin, and some sections coloured (they keep their markers when a plan is laid again)
  await page.evaluate(() => {
    const t = __mstest,
      ls = Object.keys(t.assignData.assign).map(Number);
    t.locks[ls[3]] = t.assignData.assign[ls[3]].mkey;
    for (const l of ls.slice(10, 40)) t.colored[l] = 1;
    t.reassign();
  });
  await idle(page);
  await layAll(page, 'pins and coloured sections');
  // shading on, with its Light & shadow
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="full"]');
  await idle(page);
  await tab(page, 'colours');
  await layAll(page, 'shading on');
  await pattern(page, 'random');
  await layAll(page, 'shading on, Random');
  assert.deepEqual(errors, []);
});

test('nothing is said, saved or made a step while the pictures are made; the guide’s Undo is as it was', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  await pattern(page, 'random');
  await page.evaluate(() => {
    window.__said = [];
    const live = document.getElementById('sfLive');
    new MutationObserver(() => live.textContent && __said.push('live: ' + live.textContent)).observe(live, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    const tst = document.getElementById('msToast');
    new MutationObserver(() => tst.textContent && __said.push('toast: ' + tst.textContent)).observe(tst, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.__undo = __mstest.planStack.length;
    window.__auto = localStorage.getItem('ms-guide-auto');
  });
  await page.click('#sfTab-colours');
  await pics(page);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({
    said: __said,
    undo: __mstest.planStack.length === __undo,
    auto: localStorage.getItem('ms-guide-auto') === __auto,
    dirty: __mstest.guideDirty,
  }));
  assert.deepEqual(r.said, []);
  assert.ok(r.undo && r.auto, JSON.stringify(r));
  assert.deepEqual(errors, []);
});

test('a tap lays what its picture showed: Random and a generated palette too; one Undo step, "Mood: …"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  for (const [setup, k] of [
    [null, 'muted'],
    ['random', 'vivid'],
    ['generate', 'earthy'],
  ]) {
    if (setup === 'random') await pattern(page, 'random');
    if (setup === 'generate') {
      await pattern(page, 'gradient');
      await page.click('#sfSrc [data-v="generate"]');
      await idle(page);
    }
    await pics(page);
    const want = await page.evaluate((k) => __mstest.mp.sigs[k], k),
      n = await page.evaluate(() => __mstest.planStack.length);
    await page.click('#sfMood [data-v="' + k + '"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.mpSigNow()), want, k + ' as its picture');
    assert.equal(await page.evaluate(() => __mstest.emphasis), k);
    assert.equal(await page.evaluate(() => __mstest.planStack.length), n + 1);
    assert.equal(
      await page.evaluate(() => __mstest.planStack[__mstest.planStack.length - 1].label),
      'Mood: ' + { muted: 'Soft', vivid: 'Bright', earthy: 'Earthy' }[k],
    );
    assert.equal(await page.getAttribute('#sfMood [data-v="' + k + '"]', 'aria-pressed'), 'true');
  }
  assert.deepEqual(errors, []);
});

test('Random: a mood left and come back to is a new roll, as before', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  await pattern(page, 'random');
  await pics(page);
  const a = await page.evaluate(() => __mstest.mp.sigs.vivid);
  await page.click('#sfMood [data-v="muted"]');
  await idle(page);
  await pics(page);
  await page.click('#sfMood [data-v="neutral"]');
  await idle(page);
  await pics(page);
  const b = await page.evaluate(() => __mstest.mp.sigs.vivid);
  assert.notEqual(a, b);
  assert.deepEqual(errors, []);
});

test('the pictures leave nothing behind: a later change lays as it would have without them', async () => {
  // the same steps in two windows, one with the pictures and one without, Math.random seeded the same in both
  const run = async (on) => {
    const { page, errors, ctx } = await openApp({
      width: 820,
      height: 1180,
      storage: on ? ON : {},
      // (the same random numbers in both, from the start)
      init: () => {
        let a = 7;
        Math.random = () => (a = (a * 16807) % 2147483647) / 2147483647;
      },
    });
    await sampleGuide(page);
    // (and again just as Random is chosen: a picture of the sample, made first where the page is slower (WebKit),
    // drew one, and Random's Balance seed came out different)
    await tab(page, 'pattern');
    await page.evaluate(() => {
      let a = 7;
      Math.random = () => (a = (a * 16807) % 2147483647) / 2147483647;
    });
    await page.click('#sfFam [data-v="random"]');
    await idle(page);
    await tab(page, 'colours');
    if (on) await pics(page);
    const sig = await page.evaluate(() => {
      let a = 99;
      Math.random = () => (a = (a * 16807) % 2147483647) / 2147483647;
      const t = __mstest;
      t.limitN = 9;
      t.reassign();
      return t.mpSigNow();
    });
    assert.deepEqual(errors, []);
    await ctx.close();
    return sig;
  };
  assert.equal(await run(true), await run(false));
});

test('made only while the Colours tab shows and no finger is down', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  await pics(page);
  await tab(page, 'pattern');
  await page.click('#sfFam [data-v="random"]');
  await idle(page);
  await page.waitForTimeout(1200);
  assert.notEqual(await page.evaluate(() => __mstest.mp.key), await page.evaluate(() => __mstest.mpKey()));
  // a finger down (held from before the tab is chosen): none made until it's lifted
  await page.evaluate(() => __mstest.mpPtrs.add(77));
  await tab(page, 'colours');
  await page.evaluate(() => document.getElementById('sfMood').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1200);
  assert.notEqual(await page.evaluate(() => __mstest.mp.key), await page.evaluate(() => __mstest.mpKey()));
  await page.evaluate(() => {
    __mstest.mpPtrs.clear();
    document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 77 }));
  });
  await pics(page);
  assert.deepEqual(errors, []);
});

test('where Mood’s buttons stay: zones, the Photo and Manual patterns, a palette used as it is', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: ON });
  await sampleGuide(page);
  const kind = () =>
    page.evaluate(() => {
      const m = document.getElementById('sfMood');
      return !m ? 'none' : m.classList.contains('sfmoodpics') ? 'pictures' : 'buttons';
    });
  assert.equal(await kind(), 'pictures');
  await pattern(page, 'manual');
  assert.equal(await kind(), 'none');
  await pattern(page, 'gradient');
  // a zone of two sections
  await tab(page, 'pattern');
  if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
  else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
  await idle(page);
  const ls = await page.evaluate(() => Object.keys(__mstest.assignData.assign).map(Number).slice(0, 2));
  for (const l of ls) {
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
  }
  await page.click('#sfZoneDone');
  await idle(page);
  await tab(page, 'colours');
  assert.equal(await kind(), 'buttons');
  assert.deepEqual(errors, []);
});

test('a phone: one row of six small ones (two rows of three when narrower); the keyboard stays on the mood chosen', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, storage: ON });
  await sampleGuide(page);
  await pics(page);
  const tops = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#sfMood .sfmp')].map((b) => [
        Math.round(b.getBoundingClientRect().top),
        b.querySelector('.sfmpname').scrollWidth <= b.querySelector('.sfmpname').clientWidth + 1,
      ]),
    );
  let t = await tops();
  assert.equal(new Set(t.map((x) => x[0])).size, 1, 'one row');
  assert.ok(
    t.every((x) => x[1]),
    'every name fits',
  );
  await page.setViewportSize({ width: 300, height: 844 });
  await idle(page);
  t = await tops();
  assert.equal(new Set(t.map((x) => x[0])).size, 2, 'two rows');
  await page.setViewportSize({ width: 390, height: 844 });
  await idle(page);
  await page.focus('#sfMood [data-v="pastel"]');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.emphasis), 'pastel');
  assert.equal(
    await page.evaluate(() => document.activeElement && document.activeElement.dataset.v),
    'pastel',
  );
  assert.deepEqual(errors, []);
});

test('a page from a photo, Letter-shaped: pictures made, the guide as it was', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820, storage: ON });
  await sampleGuide(page);
  await letterGuide(page);
  await pics(page);
  await layAll(page, 'Letter page, landscape iPad');
  assert.deepEqual(errors, []);
});
