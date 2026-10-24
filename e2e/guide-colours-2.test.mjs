// A guide’s colours: Mood, Colours from, filters, Change colour, pins, Paint, brand letters.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  answerAsks,
  idle,
  letterGuide,
  openApp,
  openAtScale,
  openBackupDialog,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v310-moodpics.test.mjs ----
// v310: Mood as pictures of the page (js/guide/32-mood-pics.js). Each picture is the mood laid from the guide as it
// is, then everything put back: these tests check that the guide is left exactly as it was (in every pattern and
// colour source the pictures show for, with pins, coloured sections, shading and filters), that nothing is said,
// saved or made an Undo step meanwhile, that a tap lays what its picture showed (Random and generated palettes
// too), that a mood left and come back to is a new roll as before, and where the pictures aren't shown.
{
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
    await page.click('#sfSrc [data-v="palette"]');
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
    await page.evaluate(() => __mstest.shadeTo('full'));
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
      // (v318.27: the toast's element is made with the first toast; since v318.26 the welcome shows none, so it may not
      // be there yet: made here, empty, as the first toast would)
      if (!document.getElementById('msToast')) {
        toastShow('', 1);
        document.getElementById('msToast').classList.remove('on');
      }
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
        await page.click('#sfSrc [data-v="palette"]');
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
}

// ---- from v3101-d1.test.mjs ----
// v310.1 (making a guide): the Mood picture of the mood in use is the guide as it is, after Change colour and Unpin
// too (they change a section's marker in place); in the quick section check, Colour it from the keyboard leaves the
// keyboard on Build guide (the tools it went to are hidden there); a dense page whose Min section size would leave no
// section isn't offered that.
{
  const MOODS = ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'];
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
  // the picture on the mood in use (a hash of its pixels)
  const onCard = (page) =>
    page.evaluate(() => {
      const c = document.querySelector('#sfMood .sfmp.on canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d[i]) | 0;
      return h;
    });
  // a page with a frame 90 px in (as e2e/v306-frame draws it)
  const DRAW = `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=6;
const ring=(x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();};
g.strokeRect(90,90,W-180,H-180);
ring(600,700,300);ring(600,700,180);g.beginPath();g.moveTo(300,700);g.lineTo(900,700);g.moveTo(600,400);g.lineTo(600,1000);g.stroke();`;
  test('the picture of the mood in use follows Change colour and Unpin', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-test-moodpics': '1' },
    });
    await sampleGuide(page);
    await pics(page);
    const first = await onCard(page);
    const l = await page.evaluate(() => {
      const t = __mstest;
      return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
    });
    const m0 = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    const k = await page.evaluate((not) => {
      const b = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')],
        cur = b.find((x) => x.dataset.k === not),
        g = cur && cur.closest('.sfswg');
      return b.find((x) => x.dataset.k !== not && x.closest('.sfswg') !== g).dataset.k;
    }, m0);
    await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
    await page.click('#sfPopConfirm');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), k);
    await pics(page);
    const changed = await onCard(page);
    assert.notEqual(changed, first, 'the picture shows the new colour');
    // Unpin: back to the pattern's colour, and the picture with it
    await scrollTop(page);
    const q = await sectionPoint(page, l);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), m0);
    await page.keyboard.press('Escape');
    await pics(page);
    assert.equal(await onCard(page), first, 'the picture as it was');
    assert.deepEqual(errors, []);
  });
  test('the quick check: Colour it from the keyboard leaves the keyboard on Build guide', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
    await welcome(page, 'look');
    await idle(page);
    const b64 = await page.evaluate(async (src) => {
      const W = 1200,
        H = 1500,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      new Function('g', 'W', 'H', src)(c.getContext('2d'), W, H);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      return await new Promise((res) => {
        const f = new FileReader();
        f.onload = () => res(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, DRAW);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    assert.ok(await page.isVisible('#sfQuick'), 'the quick check');
    await page.focus('#sfFrameColour');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.isVisible('#sfFrameColour'), false, 'the paper is a section now');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfBuild');
    assert.deepEqual(errors, []);
  });
  test('a dense page of even squares: the question doesn’t offer to leave out the small ones when that leaves none', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
    await welcome(page, 'look');
    await idle(page);
    // a grid of 70 × 88 squares: about 6,000 sections, all the same size
    const b64 = await page.evaluate(async () => {
      const W = 1600,
        H = 2000,
        N = 70,
        M = 88,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = '#111';
      g.lineWidth = 3;
      const sx = (W - 40) / N,
        sy = (H - 40) / M;
      for (let i = 0; i <= N; i++) {
        g.beginPath();
        g.moveTo(20 + i * sx, 20);
        g.lineTo(20 + i * sx, H - 20);
        g.stroke();
      }
      for (let j = 0; j <= M; j++) {
        g.beginPath();
        g.moveTo(20, 20 + j * sy);
        g.lineTo(W - 20, 20 + j * sy);
        g.stroke();
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'grid.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 });
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForSelector('[data-confirm]');
    const q = await page.textContent('[data-confirm]');
    assert.match(q, /This page has [\d,]+ sections/);
    assert.doesNotMatch(q, /keeps 0/);
    assert.equal(await page.$('[data-confirm] [data-a="min"]'), null, 'no Leave out the small ones');
    assert.match(await page.textContent('[data-confirm] .btn-primary'), /^Build all/);
    await page.click('[data-confirm] [data-a="all"]');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 120000,
    });
    assert.ok((await page.evaluate(() => __mstest.assignData.order.length)) > 3000);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3101-d4.test.mjs ----
// v310.1 (reviewer 4: the first run and the app as a whole): a returning tester's backup restored on a new device keeps
// the full section step (a backup made before v310); the quick check is said to a screen reader; Ctrl+Z from a Mood picture keeps the keyboard there.
{
  test('Ctrl+Z from a Mood picture: the keyboard stays on the picture', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-test-moodpics': '1' },
    });
    await sampleGuide(page);
    await idle(page);
    await page.focus('#sfMood .sfmp[data-v="vivid"]');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.getAttribute('#sfMood .sfmp[data-v="vivid"]', 'aria-pressed'), 'true');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.getAttribute('#sfMood .sfmp[data-v="vivid"]', 'aria-pressed'), 'false', 'undone');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.v), 'vivid');
    // and on Pattern's buttons too
    await page.click('#sfTab-pattern');
    await idle(page);
    const b = await page.evaluate(() => {
      const x = [...document.querySelectorAll('#sfCtl [data-v]')].find(
        (e) =>
          e.tagName === 'BUTTON' &&
          !e.id &&
          e.getAttribute('aria-pressed') === 'false' &&
          e.getClientRects().length &&
          !e.disabled,
      );
      return x ? x.dataset.v : null;
    });
    assert.ok(b, 'a Pattern button with no id');
    await page.focus(`#sfCtl button[data-v="${b}"]:not([id])`);
    await page.keyboard.press('Enter');
    await idle(page);
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.v), b, 'Pattern: ' + b);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3101-me.test.mjs ----
// v310.1, from the debugging pass: v310's first-start decision on the section step waits for data it can read; the
// Mood pictures in iPad landscape's column are three a row, the bigger ones (a phone on its side keeps one row of six).
{
  // (v311: one row of six in iPad landscape's column too, as Ben chose: v310.1's three a row made the Colours tab longer
  // than the screen there, the only tab to scroll; e2e/guide-frame-2)
  test('Mood pictures: one row of six in iPad landscape’s column and on a phone on its side', async () => {
    for (const [w, h, rows, tall] of [
      [1180, 820, 1, 60],
      [1366, 1024, 1, 60],
      [932, 430, 1, 60],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      if (w > 1000) await letterGuide(page);
      await page.click('#sfTab-colours');
      await idle(page);
      const r = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#sfMood .sfmp')];
        return {
          rows: new Set(b.map((x) => Math.round(x.getBoundingClientRect().top))).size,
          h: Math.round(b[0].querySelector('canvas').getBoundingClientRect().height),
        };
      });
      assert.deepEqual(r, { rows: rows, h: tall }, w + '×' + h);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v313-plan.test.mjs ----
// v313 (the Plan): D3, a marker's family from its code for a guide made since v313 (famRule 1), and a guide saved before
// keeping v312's rule for good, its tones' markers and blend companions as they were. D7, a marker running low: a line
// under the tabs with Swap it, and "low" on its Colour along row and in the markers on the page. D4, the one-time
// "Screens and ink differ" line, whose link opens Print with Test strip, and the tab "Share & print" where it fits.
{
  async function reopen(page, id) {
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
  }
  async function markLow(page, k, low = true) {
    await page.click('#mCollection');
    await idle(page);
    await page.evaluate(
      ([k, low]) => {
        if (low) state.ink[k] = 'low';
        else delete state.ink[k];
        save();
        chrome();
      },
      [k, low],
    );
    await page.click('#mSections');
    await idle(page);
  }
  // the markers on the page by how many sections still to colour, most first
  const byCount = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        n = {};
      for (const l of t.assignData.order) {
        const k = t.assignData.assign[l].mkey;
        if (!t.colored[l]) n[k] = (n[k] || 0) + 1;
      }
      return Object.entries(n).sort((a, b) => b[1] - a[1]);
    });
  test('the running-low line’s ✕ is remembered for that guide and marker; the next marker running low has its turn', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    const [[k1], [k2]] = await byCount(page);
    await markLow(page, k1);
    await markLow(page, k2);
    assert.match(await page.textContent('#sfLowLine'), new RegExp(k1.split('|')[1]));
    await page.click('#sfLowX');
    await idle(page);
    assert.match(await page.textContent('#sfLowLine'), new RegExp(k2.split('|')[1]), 'the next one');
    await page.click('#sfLowX');
    await idle(page);
    assert.equal(await page.isVisible('#sfLowLine'), false);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await reopen(page, id);
    assert.equal(await page.isVisible('#sfLowLine'), false, 'still closed when it opens again');
    assert.deepEqual(errors, []);
  });
  test('the Share & print tab says Share where its words don’t fit (a small phone at larger text)', async () => {
    const { page, errors } = await openAtScale(1.5, { width: 320, height: 640 });
    await sampleGuide(page);
    const t = await page.textContent('.sftabbtn[data-t="share"]');
    assert.ok(t === 'Share' || t === 'Share & print');
    const fits = await page.evaluate(() => {
      const b = document.querySelector('.sftabbtn[data-t="share"]');
      return b.scrollWidth <= b.clientWidth + 1;
    });
    assert.ok(fits, 'never cut off: ' + t);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31818.test.mjs ----
// v318.18 in the browser: Theme, its own row of twelve under Lean towards (Any, Cool, Warm), each with a strip of its
// colours from your markers; 3 across on a phone, 4 on an iPad; tap again for none; a temperature that empties the
// theme turns it off in the same step. Fails on v318.17.
{
  const tab = async (page, t) => {
    await page.click(`.sftabbtn[data-t="${t}"]`);
    await idle(page);
  };
  const cols = (page) =>
    page.$eval('#sfTheme', (g) => getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length);
  test('Theme: twelve in order, 3 across on a phone and 4 on an iPad, strips, tap on and off, Undo', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await tab(page, 'colours');
    const chips = await page.$$eval('#sfTheme button', (b) =>
      b.map((x) => ({
        v: x.dataset.v,
        name: x.textContent,
        pressed: x.getAttribute('aria-pressed'),
        strip: !!x.querySelector('.sfstrip[aria-hidden="true"]'),
        grad: /linear-gradient/.test(getComputedStyle(x.querySelector('.sfstrip')).backgroundImage),
      })),
    );
    assert.deepEqual(
      chips.map((c) => c.name),
      [
        'Blossom',
        'Tropical',
        'Autumn',
        'Winter',
        'Sunset',
        'Desert',
        'Forest',
        'Ocean',
        'Coral',
        'Berry',
        'Galaxy',
        'Twilight',
      ],
    );
    assert.ok(
      chips.every((c) => c.pressed === 'false' && c.strip && c.grad),
      JSON.stringify(chips),
    );
    assert.equal(await page.getAttribute('#sfTheme', 'aria-labelledby'), 'sfThemeLbl');
    assert.equal(await cols(page), 3);
    // nothing cut off, no sideways scroll
    const fit = await page.evaluate(() => {
      const g = document.getElementById('sfTheme');
      return {
        clipped: [...g.querySelectorAll('.sfthn')].filter(
          (n) => n.getBoundingClientRect().right > n.parentNode.getBoundingClientRect().right + 1,
        ).length,
        page: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.deepEqual(fit, { clipped: 0, page: false });
    // on
    await page.click('#sfTheme [data-v="coral"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.theme), 'coral');
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Theme: Coral');
    assert.equal(await page.getAttribute('#sfTheme [data-v="coral"]', 'aria-pressed'), 'true');
    assert.match(await page.textContent('#sfPoolCt'), / in Coral/);
    // every marker on the page is one of the theme's
    const inPool = await page.evaluate(() => {
      const t = __mstest,
        pool = new Set(t.colour.poolFor('all', 'coral').map((m) => m.mkey));
      return t.assignData.order.every((l) => pool.has(t.assignData.assign[l].mkey));
    });
    assert.equal(inPool, true);
    // off again: tapped a second time
    await page.click('#sfTheme [data-v="coral"]');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.theme), '');
    assert.equal(await page.evaluate(() => __mstest.planLabel), 'Theme off');
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.theme), 'coral');
    // an iPad: four across
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(300);
    await tab(page, 'colours');
    assert.equal(await cols(page), 4);
    assert.deepEqual(errors, []);
  });
  test('Warm with a cool theme: greyed chips say why; Warm tapped with Ocean on turns Ocean off, one Undo step', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await tab(page, 'colours');
    await page.click('#sfTheme [data-v="ocean"]');
    await idle(page);
    await page.click('#sfPal [data-v="warm"]');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [__mstest.styleVars.palette, __mstest.styleVars.theme]), [
      'warm',
      '',
    ]);
    assert.match(
      await page.textContent('#sfThemeNote'),
      /Ocean is off: next to none of its colours are warm\./,
    );
    assert.match(
      await page.textContent('#sfThemeNote'),
      /Greyed themes have next to none of your warm colours\./,
    );
    assert.equal(await page.getAttribute('#sfTheme [data-v="ocean"]', 'aria-disabled'), 'true');
    assert.equal(await page.getAttribute('#sfTheme [data-v="sunset"]', 'aria-disabled'), null);
    // a greyed one tapped: nothing changes, a note says why (aria-disabled: still a button)
    await page.click('#sfTheme [data-v="ocean"]', { force: true });
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.theme), '');
    // Undo: Any and Ocean back together
    await page.keyboard.press('Control+z');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [__mstest.styleVars.palette, __mstest.styleVars.theme]), [
      'all',
      'ocean',
    ]);
    assert.equal(await page.$('#sfThemeNote'), null, 'the note goes with it');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31828-y3.test.mjs ----
// v318.28 in the browser: using a guide, saving, output (Y3).
{
  const toastOn = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : null;
    });
  const biggest = (page, n = 1) =>
    page.evaluate(
      (n) =>
        __mstest.assignData.order
          .slice()
          .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)
          .slice(0, n),
      n,
    );
  async function scrollTop(page) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await idle(page);
  }
  // E1: a plan step's toast Undo undoes that step, not a later one that said nothing of its own
  test('Y3 E1: Surprise’s toast goes when a pin follows (its Undo had undone the pin); alone, it undoes the Surprise', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await idle(page);
    await page.click('#sfSurprise');
    await idle(page);
    assert.match((await toastOn(page)) || '', /^Surprise\b.*Undo$/);
    // its Undo, while it's the last step: the Surprise
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => __mstest.assign.planStack.length), 0);
    assert.match(await page.textContent('#msToast'), /^Undone: Surprise/);
    // again, then a pin within the toast's 8 s (↶ Undo showing: the pin says nothing in a toast of its own)
    await page.click('#sfSurprise');
    await idle(page);
    assert.ok(await toastOn(page), 'Surprise toasts');
    const [l] = await biggest(page);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="pin"]');
    await idle(page);
    assert.ok(await page.evaluate((l) => !!__mstest.locks[l], l), 'pinned');
    assert.equal(
      await toastOn(page),
      null,
      'the Surprise’s toast is gone: its Undo would have undone the pin',
    );
    assert.deepEqual(errors, []);
  });
  // E2: Paint over a section left white says so
  test('Y3 E2: Paint on a section left white keeps it white and says how to colour it', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.click('#sfFam [data-v="manual"]');
    await idle(page);
    const [l] = await biggest(page);
    await page.evaluate((l) => __mstest.leaveWhite(l), l);
    await idle(page);
    await page.mouse.click(3, 3);
    await idle(page);
    await page.click('#sfPaint');
    await idle(page);
    await scrollTop(page);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await idle(page);
    assert.ok(
      await page.evaluate((l) => __mstest.whitePins[l] !== undefined && !__mstest.assignData.assign[l], l),
    );
    assert.equal(
      await toastOn(page),
      'That section is left white. To colour it: Done painting, then tap it.',
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31829-z2.test.mjs ----
// v318.29 fixer Z2: the Colours tab's count of markers left out a marker you pinned that the guide isn't laid from (Q2).
{
  test('Q2: a section changed to a marker the guide isn’t laid from: Markers in this guide counts it, as the list under it does', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const pageCount = async () =>
      +/^(\d+) markers? on this page/.exec((await page.textContent('#sfMkList')).trim())[1];
    const label = async () => +/(\d+)\D*$/.exec(await page.textContent('#sfMkNlbl'))[1];
    assert.equal(await label(), await pageCount(), 'the two counts agree to start with');
    // the biggest section, changed (Change colour pins it) to a grey or brown the guide's pattern doesn't draw from
    // (one whose marker other sections have too, so the page has a marker more after; the guide laid afresh first, by a
    // step of the count and back, so it isn't the guide as it was opened, whose count was its own already)
    await page.click('#sfMkMinus');
    await idle(page);
    await page.click('#sfMkPlus');
    await idle(page);
    const l = await page.evaluate(() => {
      const A = __mstest.assignData.assign,
        n = {};
      for (const s in A) n[A[s].mkey] = (n[A[s].mkey] || 0) + 1;
      return __mstest.assignData.order
        .filter((s) => n[A[s].mkey] > 1)
        .sort((a, b) => __mstest.comps[b].area - __mstest.comps[a].area)[0];
    });
    const k = await page.evaluate(() => {
      const used = new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey));
      return sfCollection().find((m) => !used.has(m.mkey) && /^(CG|WG|BG9|E)/.test(m.mkey.split('|').pop()))
        .mkey;
    });
    const pt = await sectionPoint(page, l);
    await page.mouse.click(pt.x, pt.y);
    await page.click('.sftip [data-a="change"]');
    await page.waitForSelector('#sfSheet', { state: 'visible' });
    await page.locator(`#sfSheet .sfsw[data-k="${k}"]`).first().click();
    await page.click('#sfPopConfirm');
    await idle(page);
    const n = await pageCount();
    assert.equal(
      await label(),
      n,
      `Markers in this guide says “${await page.textContent('#sfMkNlbl')}” over “${n} markers on this page”`,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31834-colours-from.test.mjs ----
// v318.34 Stage 3 F: Colours from is Your markers | A palette. "A palette" is whatever palette the guide holds, shown
// on a card (swatches, name, count, scheme, where from: Made here / From Palette / From your Library) with ✕ back to
// your markers; under it New palette with the harmony select, Change it in Palette › (the Palette screen, and Use in
// a guide › Recolour brings it back), Choose a saved palette ▾ and Save to Library. Choosing a saved palette copies
// its keys into the guide (genPal, fromPal.from 'library') and keeps savedPalId as the link, so a palette deleted
// from the Library changes nothing; an older guide whose palette is gone reads "Palette deleted · Choose another".
// A palette used as it is caps the count: "A palette of 8: tick Expand for more". Surprise keeps a palette you
// chose and says "Kept your palette". Before: Owned | Saved palette | Generate palette, a handed-over palette lit
// "Generate palette" with no swatches, and Surprise set a saved palette aside without a word (G5, P2-10, U1-5).
{
  const sv = (page) =>
    page.evaluate(() => {
      const s = __mstest.styleVars;
      return {
        src: s.paletteSource,
        savedPalId: s.savedPalId,
        genPal: s.genPal.slice(),
        fromPal: s.fromPal && { ...s.fromPal },
        genHarmony: s.genHarmony,
        expand: s.expand,
        limitN: s.limitN,
      };
    });
  const pageKeys = (page) =>
    page.evaluate(() => [...new Set(Object.values(__mstest.assignData.assign).map((a) => a.mkey))].sort());
  const card = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfPalCard');
      if (!c) return null;
      return {
        name: c.querySelector('.sfpntx b').textContent,
        line: c.querySelector('.sfpntx span').textContent,
        swatches: c.querySelectorAll('.sstrip span').length,
        gone: c.classList.contains('sfpalgone'),
      };
    });
  const segs = (page) =>
    page.$$eval('#sfSrc button', (bs) =>
      bs.map((b) => [b.dataset.v, b.textContent.trim(), b.getAttribute('aria-pressed')]),
    );
  const has = (page, sel) => page.evaluate((sel) => !!document.querySelector(sel), sel);
  const text = (page, sel) =>
    page.evaluate((sel) => (document.querySelector(sel) || {}).textContent || '', sel);
  const toastText = (page) =>
    page.evaluate(() => (document.querySelector('#msToast.on') || {}).textContent || '');
  const undoLabel = (page) => page.evaluate(() => (document.getElementById('sfPlanUndo') || {}).title || '');
  const addSaved = (page, id, name, n) =>
    page.evaluate(
      ([id, name, n]) => {
        state.saved.unshift({
          id,
          type: 'palette',
          name,
          h: 'triadic',
          keys: [...state.owned].slice(0, n),
          ts: id,
        });
        save();
      },
      [id, name, n],
    );
  test('the two segments; A palette makes one here (the card: Made here, the harmony name, the cap note), ✕ goes back to your markers and A palette brings the same palette back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    assert.deepEqual(await segs(page), [
      ['owned', 'Your markers', 'true'],
      ['palette', 'A palette', 'false'],
    ]);
    assert.equal(await card(page), null, 'no card under Your markers');
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    let s = await sv(page);
    assert.equal(s.src, 'generate');
    assert.ok(s.genPal.length >= 3, 'a palette was made: ' + s.genPal.length);
    assert.equal(s.fromPal, null);
    const c = await card(page);
    assert.equal(c.name, 'Analogous');
    assert.match(c.line, /^\d+ markers · Made here$/);
    assert.equal(c.swatches, s.genPal.length);
    assert.equal(
      await page.$eval('#sfSrc [data-v="palette"]', (b) => b.getAttribute('aria-pressed')),
      'true',
    );
    // the cap note: the guide had asked for more markers than the palette holds, Expand off
    assert.ok(s.limitN > s.genPal.length && !s.expand);
    assert.equal(
      await text(page, '#sfPalCap'),
      'A palette of ' + s.genPal.length + ': tick Expand for more.',
    );
    assert.equal(await page.$eval('#sfHarm', (el) => el.value), 'analogous');
    for (const id of ['sfGenNew', 'sfPalEdit', 'sfPalSave']) assert.ok(await has(page, '#' + id), id);
    assert.ok(!(await has(page, '#sfPalPick')), 'no saved palettes: no picker');
    assert.match(await text(page, '#sfPalNone'), /No saved palettes yet/);
    assert.match(await undoLabel(page), /Colours from: A palette/);
    const keys = s.genPal.slice();
    // Expand on: the cap note goes
    await page.click('#sfExpand');
    await idle(page);
    assert.ok(!(await has(page, '#sfPalCap')));
    await page.click('#sfPalOff');
    await idle(page);
    s = await sv(page);
    assert.equal(s.src, 'owned');
    assert.equal(await card(page), null);
    assert.deepEqual(s.genPal, keys, 'the palette is kept');
    assert.match(await undoLabel(page), /Colours from: Your markers/);
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    s = await sv(page);
    assert.equal(s.src, 'generate');
    assert.deepEqual(s.genPal, keys, 'the same palette again');
    // New palette: another, of the harmony chosen
    await page.selectOption('#sfHarm', 'triadic');
    await idle(page);
    s = await sv(page);
    assert.equal(s.genHarmony, 'triadic');
    assert.equal((await card(page)).name, 'Triadic');
    const tri = s.genPal.slice();
    await page.click('#sfGenNew');
    await idle(page);
    s = await sv(page);
    assert.equal(s.genHarmony, 'triadic');
    assert.notDeepEqual(s.genPal, tri, 'New palette made another');
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('a saved palette chosen: its keys are copied into the guide (From your Library), the Library palette deleted changes nothing; Undo labels', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await addSaved(page, 777001, 'Clementine', 5);
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    assert.ok(await has(page, '#sfPalPick'));
    assert.equal(await page.$eval('#sfPalPick', (el) => el.value), '', 'the placeholder, none chosen');
    await page.selectOption('#sfPalPick', '777001');
    await idle(page);
    let s = await sv(page);
    const want = await page.evaluate(() => [...state.owned].slice(0, 5));
    assert.equal(s.src, 'saved');
    assert.equal(s.savedPalId, 777001);
    assert.deepEqual(s.genPal, want, 'the keys copied in');
    assert.deepEqual(s.fromPal, { name: 'Clementine', h: 'triadic', from: 'library' });
    let c = await card(page);
    assert.equal(c.name, 'Clementine');
    assert.equal(c.line, '5 markers · Triadic · From your Library');
    assert.ok(!(await has(page, '#sfPalSave')), 'in the Library already: no Save to Library');
    assert.match(await undoLabel(page), /Palette: Clementine/);
    const laid = await pageKeys(page);
    assert.ok(
      laid.every((k) => want.includes(k)),
      'laid from the palette: ' + laid.join(),
    );
    // the Library palette deleted: the guide keeps its colours and its card
    await page.evaluate(() => {
      state.saved = state.saved.filter((x) => x.id !== 777001);
      save();
    });
    await page.click('#sfExpand');
    await idle(page);
    await page.click('#sfExpand');
    await idle(page);
    s = await sv(page);
    assert.equal(s.src, 'saved');
    assert.deepEqual(s.genPal, want);
    c = await card(page);
    assert.equal(c.name, 'Clementine');
    assert.equal(c.gone, false);
    assert.deepEqual(await pageKeys(page), laid, 'laid the same');
    // saved and reopened after a reload: still so
    await page.evaluate(() => __mstest.saveNow());
    await page.waitForFunction(() => __mstest.inLibrary);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
    await idle(page);
    s = await sv(page);
    assert.deepEqual(
      [s.src, s.savedPalId, s.genPal, s.fromPal],
      ['saved', 777001, want, { name: 'Clementine', h: 'triadic', from: 'library' }],
    );
    // (v318.37: the Library palette was deleted above, so the card says so and offers Save to Library again, X3-6)
    assert.equal((await card(page)).line, '5 markers · Triadic · From your Library (deleted)');
    assert.ok(await has(page, '#sfPalSave'), 'Save to Library offered again');
    // New palette in its place: an Undo step of its own
    await page.click('#sfGenNew');
    await idle(page);
    s = await sv(page);
    assert.equal(s.src, 'generate');
    assert.equal(s.fromPal, null);
    assert.match(await undoLabel(page), /New palette/);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('an older guide whose saved palette is gone: "Palette deleted · Choose another", your markers until one is chosen', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // an older guide: paletteSource saved, savedPalId only (no keys copied in), the palette no longer in the Library
    await page.evaluate(() => {
      const d = __mstest.currentDesignObj(),
        p = d.payload;
      p.style.paletteSource = 'saved';
      p.style.savedPalId = 4242;
      delete p.style.fromPal;
      p.style.genPal = [];
      __mstest.openDesignObj(Object.assign({}, p, { name: 'Older', W: d.W, H: d.H }), null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Older' && __mstest.assignData);
    await idle(page);
    let c = await card(page);
    assert.equal(c.gone, true);
    assert.equal(c.name, 'Palette deleted');
    assert.equal(c.line, 'Choose another');
    assert.equal(c.swatches, 0);
    assert.ok(
      !(await has(page, '#sfPalEdit')) && !(await has(page, '#sfPalSave')),
      'nothing to change or save',
    );
    assert.ok(await has(page, '#sfGenNew'));
    // a saved one chosen: copied in, as any
    await addSaved(page, 777002, 'Marigold', 4);
    await page.evaluate(() => __mstest.renderControls());
    await idle(page);
    await page.selectOption('#sfPalPick', '777002');
    await idle(page);
    const s = await sv(page);
    assert.equal(s.savedPalId, 777002);
    assert.equal(s.genPal.length, 4);
    assert.deepEqual(s.fromPal, { name: 'Marigold', h: 'triadic', from: 'library' });
    c = await card(page);
    assert.equal(c.gone, false);
    assert.equal(c.name, 'Marigold');
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('Save to Library saves the palette on the card (named, with its scheme) and links the guide to it; Change it in Palette opens it on the Palette screen and Use in a guide › Recolour brings it back', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    await page.selectOption('#sfHarm', 'complementary');
    await idle(page);
    const made = (await sv(page)).genPal.slice();
    const laid = await pageKeys(page);
    await page.click('#sfPalSave');
    await idle(page);
    const lib = await page.evaluate(() =>
      state.saved
        .filter((x) => x.type === 'palette')
        .map((x) => ({ id: x.id, keys: x.keys, h: x.h, name: x.name })),
    );
    assert.equal(lib.length, 1);
    assert.deepEqual(lib[0].keys, made);
    assert.equal(lib[0].h, 'complementary');
    assert.ok(lib[0].name, 'named');
    let s = await sv(page);
    assert.equal(s.src, 'saved');
    assert.equal(s.savedPalId, lib[0].id);
    assert.deepEqual(s.fromPal, { name: lib[0].name, h: 'complementary', from: 'library' });
    assert.match(await toastText(page), /Saved to your Library as/);
    assert.deepEqual(await pageKeys(page), laid, 'the page is as it was');
    const c = await card(page);
    assert.equal(c.name, lib[0].name);
    assert.equal(c.line, made.length + ' markers · Complementary · From your Library');
    assert.ok(!(await has(page, '#sfPalSave')), 'saved: the button goes');
    // Change it in Palette: the Palette screen, this palette as its own scheme
    await page.click('#sfPalEdit');
    await idle(page);
    assert.equal(await page.evaluate(() => state.mode), 'palette');
    assert.equal(await page.evaluate(() => state.harmony), 'complementary');
    assert.deepEqual(await page.evaluate(() => currentPaletteIdxs().map(mkey)), made);
    // re-roll one band there, then Use in a guide › Recolour: the guide takes the changed palette, as handed over
    await page.click('#draw');
    await until(page, () => !rolling, null, 'the roll');
    await idle(page);
    const changed = await page.evaluate(() => currentPaletteIdxs().map(mkey));
    await page.click('#useInGuide');
    await page.click('#sfEdAsk [data-a="recolour"]');
    await page.waitForFunction((k) => __mstest.styleVars.genPal.join() === k, changed.join());
    await idle(page);
    s = await sv(page);
    assert.equal(await page.evaluate(() => state.mode), 'sections');
    assert.equal(s.src, 'generate');
    assert.equal(s.fromPal.from, undefined);
    assert.match((await card(page)).line, /From Palette$/);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
  test('Surprise with a palette you chose keeps it and surprises the rest; the toast says so; Undo as today', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await addSaved(page, 777003, 'Rosehip', 4);
    await page.click('#sfSrc [data-v="palette"]');
    await idle(page);
    await page.selectOption('#sfPalPick', '777003');
    await idle(page);
    const before = await sv(page),
      laid = await pageKeys(page);
    const want = await page.evaluate(() => [...state.owned].slice(0, 4));
    assert.deepEqual(
      laid,
      want.filter((k) => laid.includes(k)),
    );
    await page.click('#sfSurprise');
    await answerAsks(page);
    await idle(page);
    const s = await sv(page);
    assert.equal(s.src, 'saved');
    assert.deepEqual(s.genPal, before.genPal);
    assert.deepEqual(s.fromPal, before.fromPal);
    assert.equal(s.expand, before.expand, 'Expand left');
    const after = await pageKeys(page);
    assert.ok(
      after.every((k) => want.includes(k)),
      'still the palette: ' + after.join(),
    );
    assert.match(await toastText(page), /^Surprise: Kept your palette · /);
    assert.match(await undoLabel(page), /Surprise: Kept your palette/);
    assert.equal((await card(page)).name, 'Rosehip');
    // a palette made here is Surprise's own, made again as before
    await page.click('#sfGenNew');
    await idle(page);
    const made = (await sv(page)).genPal.slice();
    await page.click('#sfSurprise');
    await answerAsks(page);
    await idle(page);
    const s2 = await sv(page);
    assert.equal(s2.src, 'generate');
    assert.notDeepEqual(s2.genPal, made);
    assert.doesNotMatch(await toastText(page), /Kept your palette/);
    assert.deepEqual(errors, []);
    await page.context().close();
  });
}
