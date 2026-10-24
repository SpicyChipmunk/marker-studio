// The welcome (first run): sets, the steps, adding markers on the way in.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ROOT,
  addFromMarkers,
  chartFromMarkers,
  haveSet,
  idle,
  openApp,
  openAtScale,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  shot,
  teardown,
  welcome,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from welcome.test.mjs ----
// The welcome (first run): picking a set, the brand tabs, not coming back after the first run, its layout at large
// text sizes, and where focus goes after Try the sample.
{
  // ---- From the fifth review (outside the guide screen) ----
  const SHOTS = process.env.SHOTS || '';
  // a folder: the layout tests save their screenshots there
  async function shotToDir(page, name) {
    if (!SHOTS) return;
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/g3-${name}.png` });
  }
  test('first run: pick a set, then Home shows the collection, Library and the build number', async () => {
    const { page, errors } = await openApp();
    assert.ok(await page.isVisible('#welcome'));
    await welcome(page, 'look');
    assert.ok(!(await page.isVisible('#welcome')));
    assert.ok((await page.evaluate(() => state.owned.size)) > 100);
    await page.click('#mHome');
    assert.equal(await page.textContent('#homeLibSub'), 'Nothing yet');
    const sw = (await readFile(join(ROOT, 'service-worker.js'), 'utf8')).match(
      /marker-studio-(v\d+(?:\.\d+)?)/,
    )[1];
    assert.equal(await page.textContent('#appVer'), sw);
    await page.click('#homeLibCard');
    assert.ok(await page.evaluate(() => savedOverlay.classList.contains('on')));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#homeImport')]);
    assert.ok(fc, 'Import a guide file opens the file picker');
    await shot(page, 'library-empty');
    assert.deepEqual(errors, []);
  });
  test('the welcome dialog does not come back after the first run', async () => {
    const { page } = await openApp();
    await welcome(page, 'look');
    await page.reload();
    assert.ok(!(await page.isVisible('#welcome')));
  });
  // ---- From UX release 1 (v260) ----
  test('Welcome: the Copic tab jumps to the Copic sets', async () => {
    const { page, errors } = await openApp();
    await haveSet(page); // (v309: the list is behind "I have a set")
    await page.click('.wcbrands [data-b="Copic"]');
    await idle(page);
    const r = await page.evaluate(() => {
      const s = document.getElementById('wcSets'),
        h = [...s.querySelectorAll('.presetbrand')].find((x) => x.textContent === 'Copic'),
        a = h.getBoundingClientRect(),
        b = s.getBoundingClientRect();
      return { top: a.top - b.top, on: document.querySelector('.wcbrands button.on').dataset.b };
    });
    assert.ok(r.top >= -2 && r.top < 30, `Copic heading at the top of the list (${r.top})`);
    assert.equal(r.on, 'Copic');
    assert.deepEqual(errors, []);
  });
  // ---- From the fifth review (guide screen) ----
  test("after the welcome's Try the sample, focus is on the guide's name, not the page", async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await page.focus('#wcSample');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfGTitle');
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      await page.textContent('#sfGTitle'),
    );
    // Tab goes on from there into the header
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfRename');
    assert.deepEqual(errors, []);
  });
  for (const [w, h, scale] of [
    [844, 390, 1],
    [375, 667, 1.6],
    [360, 740, 1.6],
  ]) {
    test(`Welcome at ${w}×${h}, ${scale}x: its buttons are on screen without scrolling; brands are a boxed group`, async () => {
      const { page, errors } = await openAtScale(scale, { width: w, height: h });
      await page.waitForSelector('#welcome.on');
      // (v309: the first step's Skip and Restore; the set list's Add, behind "I have a set")
      const onScreen = (ids) =>
        page.evaluate((ids) => {
          const card = document.querySelector('.wcard').getBoundingClientRect();
          return ids.map((id) => {
            const r = document.getElementById(id).getBoundingClientRect();
            return {
              id,
              ok:
                r.top >= card.top && r.bottom <= card.bottom + 0.5 && r.bottom <= innerHeight && r.height > 0,
            };
          });
        }, ids);
      for (const v of await onScreen(['wcSkip', 'wcRestore'])) assert.ok(v.ok, v.id + ' is visible');
      assert.equal(await page.evaluate(() => document.querySelector('.wcard').scrollTop), 0);
      const st = await page.evaluate(() => {
        const g = getComputedStyle(document.querySelector('.wcbrands')),
          b = getComputedStyle(document.querySelector('.wcbrands button'));
        return { gb: g.borderTopWidth, bb: b.borderTopWidth, br: b.borderTopLeftRadius };
      });
      assert.deepEqual(st, { gb: '1px', bb: '0px', br: '8px' }, 'like .segs');
      assert.match(await page.getAttribute('#wcFile', 'accept'), /\.txt/);
      await shotToDir(page, `welcome-${w}x${h}-${scale}x`);
      // the list scrolls above the pinned buttons
      await haveSet(page);
      for (const v of await onScreen(['wcAdd'])) assert.ok(v.ok, v.id + ' is visible');
      await page.check('#wcSets input[data-i="3"]');
      assert.match(await page.textContent('#wcAdd'), /^Add \d+ markers( \+ blender)?$/);
      assert.deepEqual(errors, []);
    });
  }
}

// ---- from v285-review2.test.mjs ----
// v285's second review (after release prep): changes made just before the page goes away are kept; Resume's section
// edits, discarded, never overwrite the Library guide; edits left by an earlier visit are kept as a copy; a guide
// deleted while open stays out of the slot; blocked storage asks before a guide goes; Continue's row is on screen;
// Reveal gives the keyboard back; the Library's backup line; the welcome on a landscape phone; singular wording.
{
  test('the welcome on a landscape phone: the marker sets are in the one scrolling area', async () => {
    const { page, errors, ctx } = await openApp({ width: 667, height: 375 });
    await page.waitForSelector('#welcome.on');
    const g = await page.evaluate(() => {
      const s = document.getElementById('wcSets');
      return { inner: s.scrollHeight - s.clientHeight };
    });
    assert.ok(g.inner <= 1, 'the list doesn’t scroll inside another (' + g.inner + ')');
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    assert.ok(await page.isEnabled('#wcAdd'));
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// ---- from v306-welcome.test.mjs ----
// v306 (welcome branch): the welcome's picture (the sample page, its colour flooding down it from the bell, three
// times, then it stays coloured) and "You're all set"'s fan of the markers just added.
{
  // the picture's box, and whether it shows
  const picBox = (page) =>
    page.evaluate(() => {
      const p = document.querySelector('#welcome .wcpic');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      return {
        shown: r.width > 0 && r.height > 0,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        r: r.right,
        b: r.bottom,
      };
    });
  // the welcome's animations: where each is and when it ends
  const anims = (page) =>
    page.evaluate(() =>
      document.getAnimations().map((a) => ({
        pic: !!(a.effect.target && a.effect.target.closest('.wcpic')),
        fan: !!(a.effect.target && a.effect.target.closest('.wcfan')),
        end: a.effect.getComputedTiming().endTime,
        state: a.playState,
      })),
    );
  // a strip's colour and its angle, open as it rests (its opening animation cancelled)
  const strips = (page) =>
    page.evaluate(() => {
      document.getAnimations().forEach((a) => a.cancel());
      return [...document.querySelectorAll('#wcFan i')].map((i) => {
        const s = getComputedStyle(i),
          m = s.transform.match(/matrix\(([^,]+), ([^,]+)/),
          [r, g, b] = s.backgroundColor.match(/\d+/g).map(Number);
        return { rgb: [r, g, b], deg: m ? Math.round((Math.atan2(+m[2], +m[1]) * 180) / Math.PI) : 0 };
      });
    });
  const hue = ([r, g, b]) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      d = mx - mn;
    if (!d) return 0;
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
  };
  test('the picture is hidden from screen readers and has nothing to focus; nor has the fan', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.waitForSelector('#welcome.on');
    const p = await page.evaluate(() => {
      const w = document.querySelector('#welcome .wcpic');
      return {
        hidden: w.getAttribute('aria-hidden'),
        focusable: w.querySelectorAll('a,button,input,select,textarea,[tabindex]').length,
        imgs: [...w.querySelectorAll('img')].map((i) => i.alt),
      };
    });
    assert.equal(p.hidden, 'true');
    assert.equal(p.focusable, 0);
    assert.deepEqual(p.imgs, ['']);
    assert.ok((await picBox(page)).shown);
    // Tab round the dialog: never into the picture
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.wcpic'))),
        false,
      );
    }
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    const f = await page.evaluate(() => {
      const w = document.getElementById('wcFan');
      return {
        hidden: w.getAttribute('aria-hidden'),
        focusable: w.querySelectorAll('a,button,input,[tabindex]').length,
      };
    });
    assert.deepEqual(f, { hidden: 'true', focusable: 0 });
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'wcSample',
      'focus still goes to Try the sample',
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('reduced motion: nothing moves, and the picture shows coloured', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForSelector('#welcome.on');
    await idle(page);
    assert.deepEqual(
      (await anims(page)).filter((x) => x.pic),
      [],
    );
    const c = await page.evaluate(() => {
      const l = document.querySelector('.wcfl'),
        i = l.querySelector('img'),
        sl = getComputedStyle(l),
        si = getComputedStyle(i),
        lr = l.getBoundingClientRect(),
        ir = i.getBoundingClientRect(),
        pr = document.querySelector('.wcpic').getBoundingClientRect(),
        nr = document.querySelector('.wcpicin').getBoundingClientRect();
      return {
        names: [sl.animationName, si.animationName],
        op: +sl.opacity,
        moved: [sl.transform, si.transform],
        // the guide covers the whole picture (the box it shows through, past every edge of it; v320: upright, the
        // page's top part shown, the guide the page's own size)
        covers:
          lr.left <= nr.left + 0.5 &&
          lr.right >= nr.right - 0.5 &&
          lr.top <= pr.top + 0.5 &&
          lr.bottom >= pr.bottom - 0.5 &&
          Math.abs(ir.width - nr.width) < 1 &&
          Math.abs(ir.height - nr.height) < 1,
        ok: i.complete && i.naturalWidth > 0,
      };
    });
    assert.deepEqual(c.names, ['none', 'none']);
    assert.equal(c.op, 1);
    assert.deepEqual(c.moved, ['none', 'none']);
    assert.ok(c.covers, 'the guide lies over the whole picture');
    assert.ok(c.ok, 'the coloured picture loaded');
    assert.ok((await picBox(page)).shown);
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    assert.deepEqual(
      (await anims(page)).filter((x) => x.pic || x.fan),
      [],
      'the fan is open at once',
    );
    assert.equal(await page.locator('#wcFan i').count(), 28);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('the picture’s animation ends within 15 s, and stops when Add moves on', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.waitForSelector('#welcome.on');
    const a = await anims(page);
    assert.ok(
      a.some((x) => x.pic && x.state === 'running'),
      'the picture is moving',
    );
    for (const x of a)
      assert.ok(x.end > 0 && x.end <= 15000, 'every animation ends within 15 s (' + x.end + ')');
    // half way through a flood the guide's edge is part way down, the guide itself where it rests (over the page's lines)
    const at = (t) =>
      page.evaluate((t) => {
        document.getAnimations().forEach((a) => {
          if (a.effect.target.closest('.wcpic')) {
            a.pause();
            a.currentTime = t;
          }
        });
        // (v320: upright, the colour flooding down the page from its top: the edge measured down the page)
        const l = document.querySelector('.wcfl').getBoundingClientRect(),
          i = document.querySelector('.wcfl img').getBoundingClientRect(),
          p = document.querySelector('.wcpicin').getBoundingClientRect();
        return {
          edge: (l.bottom - p.top) / p.height,
          still: Math.max(Math.abs(i.left - p.left), Math.abs(i.top - p.top), Math.abs(i.right - p.right)),
          op: +getComputedStyle(document.querySelector('.wcfl')).opacity,
        };
      }, t);
    const mid = await at(600 + 900);
    assert.ok(mid.edge > 0.2 && mid.edge < 1, 'the colour part way along (' + mid.edge + ')');
    assert.ok(mid.still < 0.5, 'the guide doesn’t move (' + mid.still + ')');
    const end = await at(11000);
    assert.ok(end.edge >= 1 && end.still < 0.5 && end.op === 1, 'it rests coloured');
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const b = await anims(page);
    assert.equal(b.filter((x) => x.pic).length, 0, 'nothing of the picture runs on "You’re all set"');
    for (const x of b.filter((x) => x.fan)) assert.ok(x.end <= 1000, 'the fan opens in under a second');
    await idle(page);
    // (v307.1: a finished one is left out: Safari's engine lists the fan's finished swings until its next animation
    // update, a moment after they end, though they no longer run or hold anything in place)
    assert.deepEqual(
      (await anims(page)).filter((x) => (x.pic || x.fan) && x.state !== 'finished'),
      [],
    );
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('no picture on a short screen: a landscape phone, a small phone at a large text size', async () => {
    for (const [w, h, k] of [
      [844, 390, 1],
      [375, 667, 1.6],
    ]) {
      const { page, errors, ctx } = await openAtScale(k, { width: w, height: h });
      await page.waitForSelector('#welcome.on');
      await idle(page);
      assert.equal((await picBox(page)).shown, false, w + '×' + h);
      assert.equal(
        (await anims(page)).filter((x) => x.pic && x.state === 'running').length,
        0,
        'nothing drawn there',
      );
      await haveSet(page);
      await page.check('#wcSets input[data-i="3"]');
      assert.ok(await page.isEnabled('#wcAdd'));
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  // (v309: the picture is on the first step, the three ways in; the set list is a step of its own behind "I have a set")
  test('with the picture, the first step doesn’t scroll; the set list keeps room for its rows and scrolls on its own', async () => {
    for (const [w, h] of [
      [1180, 820],
      [390, 844],
      [820, 1180],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await page.waitForSelector('#welcome.on');
      await idle(page);
      assert.ok((await picBox(page)).shown, w + '×' + h + ': the picture shows');
      const first = await page.evaluate(() => {
        const sc = document.querySelector('#wcStep0 .wcscroll'),
          c = document.querySelector('.wcard').getBoundingClientRect(),
          sk = document.getElementById('wcSkip').getBoundingClientRect();
        return {
          outer: sc.scrollHeight - sc.clientHeight,
          cardB: c.bottom,
          skipB: sk.bottom,
          vh: innerHeight,
        };
      });
      assert.ok(first.outer <= 1, w + '×' + h + ': the three ways in don’t scroll (' + first.outer + ')');
      assert.ok(first.cardB <= first.vh && first.skipB <= first.cardB, 'the card and Skip are on the screen');
      await haveSet(page);
      const m = await page.evaluate(() => {
        const s = document.getElementById('wcSets'),
          c = document.querySelector('.wcard').getBoundingClientRect(),
          add = document.getElementById('wcAdd').getBoundingClientRect();
        return {
          list: s.clientHeight,
          inner: s.scrollHeight - s.clientHeight,
          cardB: c.bottom,
          addB: add.bottom,
          vh: innerHeight,
        };
      });
      assert.ok(m.list >= 180, w + '×' + h + ': the list keeps 180 px (' + m.list + ')');
      assert.ok(m.inner > 0, 'the list scrolls on its own');
      assert.ok(m.cardB <= m.vh && m.addB <= m.cardB, 'the card and Add are on the screen');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('a landscape iPad: the picture stands beside the list in a wider card; portrait, it lies above the heading', async () => {
    {
      const { page, errors, ctx } = await openApp({ width: 1180, height: 820 });
      await page.waitForSelector('#welcome.on');
      await idle(page);
      const p = await picBox(page);
      // (v309: beside the three ways in; the steps after it are the usual width)
      const g = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
        return {
          card: r('#welcome .wcard'),
          title: r('#wcTitle'),
          ways: r('#wcStep0 .wcch'),
          skip: r('#wcSkip'),
        };
      });
      assert.ok(p.h > p.w * 2, 'upright (' + p.w + '×' + p.h + ')');
      assert.ok(Math.abs(g.card.width - 760) <= 1, 'the card is 760 px wide (' + g.card.width + ')');
      for (const k of ['title', 'ways', 'skip'])
        assert.ok(g[k].left >= p.r + 16, k + ' is to the right of the picture');
      assert.ok(p.y < g.ways.bottom && p.b > g.ways.top, 'side by side with the ways in');
      assert.ok(p.h >= 600, 'it uses the height (' + p.h + ')');
      await haveSet(page);
      const cw1 = await page.evaluate(
        () => document.querySelector('#welcome .wcard').getBoundingClientRect().width,
      );
      assert.ok(Math.abs(cw1 - 440) <= 1, 'the set list in the usual card (' + cw1 + ')');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    {
      const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
      await page.waitForSelector('#welcome.on');
      await idle(page);
      const p = await picBox(page),
        t = await page.evaluate(() => document.getElementById('wcTitle').getBoundingClientRect().toJSON()),
        cw = await page.evaluate(
          () => document.querySelector('#welcome .wcard').getBoundingClientRect().width,
        );
      assert.ok(p.w > p.h * 2, 'on its side (' + p.w + '×' + p.h + ')');
      assert.ok(p.b <= t.top, 'above the heading');
      assert.ok(Math.abs(cw - 440) <= 1, 'the card as before (' + cw + ')');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('“You’re all set” fans out 28 of the markers added, in hue order, open as it rests; Skip fans the full range', async () => {
    {
      const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
      await page.waitForSelector('#welcome.on');
      await haveSet(page);
      await page.check('#wcSets input[data-i="0"]');
      await page.click('#wcAdd');
      const s = await strips(page);
      // (the greys left out: a fan in hue order)
      assert.ok(s.length >= 18 && s.length <= 24, 'Honolulu 24: its colours, not 28 (' + s.length + ')');
      await ctx.close();
      assert.deepEqual(errors, []);
    }
    {
      const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
      await page.waitForSelector('#welcome.on');
      await haveSet(page);
      await page.check('#wcSets input[data-i="3"]');
      await page.click('#wcAdd');
      const s = await strips(page);
      assert.equal(s.length, 28);
      assert.equal(s[0].deg, -78);
      assert.equal(s[27].deg, 78);
      for (let i = 1; i < s.length; i++) {
        assert.ok(s[i].deg > s[i - 1].deg, 'fanned out');
        assert.ok(hue(s[i].rgb) >= hue(s[i - 1].rgb) - 0.5, 'in hue order');
      }
      const owned = await page.evaluate(() =>
        [...state.owned].map((k) => COLORS[keyIdx(k)].hex.toLowerCase()),
      );
      const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
      for (const x of s) assert.ok(owned.includes(hex(x.rgb)), hex(x.rgb) + ' is one of the markers added');
      // (v309: says what was added, and asks for anything else)
      assert.equal(await page.textContent('#wcT2'), '121 markers added');
      assert.equal(await page.locator('#wcStep2 .wcsub').count(), 1, 'no caption of its own');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    {
      const { page, errors, ctx } = await openApp({ width: 390, height: 844 });
      await page.waitForSelector('#welcome.on');
      await page.click('#wcSkip');
      const s = await strips(page);
      assert.equal(s.length, 28);
      assert.equal(await page.textContent('#wcT2'), 'Explore with the full range');
      assert.ok(hue(s[27].rgb) - hue(s[0].rgb) > 270, 'right round the colour wheel');
      const f = await page.evaluate(() => {
        const r = document.getElementById('wcFan').getBoundingClientRect(),
          c = document.querySelector('#wcStep2').getBoundingClientRect();
        return {
          l: r.left,
          r: r.right,
          cl: c.left,
          cr: c.right,
          sc:
            document.getElementById('wcStep2').scrollHeight - document.getElementById('wcStep2').clientHeight,
        };
      });
      assert.ok(f.sc <= 1, 'it fits a phone without scrolling');
      const box = await page.evaluate(() => {
        const xs = [...document.querySelectorAll('#wcFan i')].map((i) => i.getBoundingClientRect());
        return { l: Math.min(...xs.map((x) => x.left)), r: Math.max(...xs.map((x) => x.right)) };
      });
      assert.ok(box.l >= f.cl - 1 && box.r <= f.cr + 1, 'within the card');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('a returning user: no picture is made', async () => {
    const { page, errors, ctx } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1' },
    });
    await idle(page);
    assert.equal(await page.isVisible('#welcome'), false);
    assert.equal(await page.evaluate(() => typeof SF.samplePics), 'function');
    const n = await page.evaluate(() => ({
      pic: document.querySelectorAll('.wcpic, .wcpicc, #wcFan').length,
      has: document.querySelectorAll('.wcard.haspic').length,
    }));
    assert.deepEqual(n, { pic: 0, has: 0 });
    assert.deepEqual(await anims(page), []);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// ---- from v309-1.test.mjs ----
// v309.1, from the pressure test of v309's first-collection flow: the welcome follows the toast's Undo (it went on
// saying "2 markers added"); the chart's removals are said as removals; a cap in no set doesn't spoil the
// match, and the caps a set hasn't are said and named on its button; Scan's "Fits so far" line is above the list.
{
  const type = async (page, codes) => {
    for (const c of codes) {
      await page.fill('#scBox', c);
      await page.press('#scBox', 'Enter');
    }
  };
  const visible = (page, id) =>
    page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
  test('one by one › Scan › Add, then its Undo (v318.29: the link on "Anything else?", not a toast): the welcome goes back to the ways to add, not "2 markers added"', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneScan');
    await type(page, ['R014', 'BG314']);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '2 markers added');
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.ok(await visible(page, 'wcStepOne'), 'back on one by one');
    assert.equal(await visible(page, 'wcStep2'), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'wcTO');
    // and Back from there goes to the first step
    await page.click('#wcStepOne .wcback');
    assert.ok(await visible(page, 'wcStep0'));
    assert.deepEqual(errors, []);
  });
  test('the chart from the welcome: an untick alone is said as removed; its Undo takes the welcome back too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneScan');
    await type(page, ['R014']);
    await page.click('#scAdd');
    await idle(page);
    await page.click('#wcMoreExtra');
    await page.click('#wcOneChart');
    await idle(page);
    await page.click('#chGrid .chsw[aria-label^="R014 "]');
    assert.equal(await page.textContent('#chSave'), 'Remove 1');
    await page.click('#chSave');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '1 marker removed');
    assert.equal(await page.textContent('#wcDone'), '0 markers are in your collection. Anything else?');
    // (v318.26: the welcome's Undo is a link under that sentence, not the toast's)
    assert.equal(
      await page.getAttribute('#wcUndoBtn', 'aria-label'),
      'Undo: put your collection back as it was',
    );
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 1);
    assert.ok(await visible(page, 'wcStepOne'));
    assert.deepEqual(errors, []);
  });
  test('not sure: a cap in no set (B04, sold on its own) still finds Honolulu 120 with all the caps that count; it’s named and added too', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcNotSure');
    await page.click('#wcFCount [data-n="3"]');
    await page.click('#wcFindNext');
    await idle(page);
    // the line saying what fits is above the list, in view on a phone with the list long
    assert.ok(
      await page.evaluate(
        () =>
          document.getElementById('scFind').compareDocumentPosition(document.getElementById('scList')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      'above the list',
    );
    await type(page, ['B04', 'R014', 'BG314']);
    assert.match(await page.textContent('#scFind'), /^Fits so far: Honolulu 120\./);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
    assert.match(
      await page.textContent('#wcRes'),
      /Best match.*Has all 2 caps you scanned: R014, BG314\.B04 isn’t in it: added as well\./,
    );
    assert.equal(await page.textContent('#wcFindYes'), 'Yes, add these 120 markers and the other cap');
    await page.click('#wcFindYes');
    await idle(page);
    // (120 colours, the blender that comes with it, and B04)
    assert.equal(await page.evaluate(() => state.owned.size), 122);
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.has('Ohuhu|B04')));
    assert.deepEqual(errors, []);
  });
  // v309.1, Ben's answers: the Ohuhu sets come with a Colorless Blender (added with the set, not counted in its size);
  // adding a set from the welcome has Undo, as Markers' Add a set has; "Is this your set?" fits a phone on its side.
  test('a set from the welcome: its blender comes with it, uncounted; the toast’s Undo takes them out and goes back to the list', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    assert.equal(await page.textContent('#wcSets label:has(input[data-i="3"]) .presetn'), '120');
    await page.check('#wcSets input[data-i="3"]');
    assert.equal(await page.textContent('#wcAdd'), 'Add 120 markers + blender');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.size === 121));
    // (v318.26: no toast in the welcome; its Undo is a link under "Anything else?")
    assert.equal(
      await page.getAttribute('#wcUndoBtn', 'aria-label'),
      'Undo: take these 120 markers back out',
    );
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 0);
    assert.ok(await visible(page, 'wcStep1'), 'back on the list');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'wcT1');
    assert.equal(await page.isChecked('#wcSets input[data-i="3"]'), false);
    // and Back from there to the first step
    await page.click('#wcStep1 .wcback');
    assert.ok(await visible(page, 'wcStep0'));
    assert.deepEqual(errors, []);
  });
  test('Markers › Add a set you own: the blender comes with the set; the toast counts the colours', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ohuhu-hb320-picker-v3': JSON.stringify({
          mode: 'collection',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: [],
          saved: [],
        }),
      },
    });
    await idle(page);
    // (v311: from the card of ways to add, at the top while there are no markers)
    await addFromMarkers(page, 'set');
    await page.check('#wcSets input[data-i="1"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.ok(await page.evaluate(() => state.owned.has('Ohuhu|0') && state.owned.size === 49));
    assert.match(await page.textContent('#msToast'), /^Added 48 markers/);
    // the set shows as yours (its colours), also for someone who has them all but not the blender
    assert.ok(
      await page.evaluate(() => {
        state.owned.delete('Ohuhu|0');
        const d = document.createElement('div');
        d.innerHTML = presetListHTML();
        return d.querySelector('input[data-i="1"]').closest('.presetrow').classList.contains('have');
      }),
    );
    assert.deepEqual(errors, []);
  });
  test('a phone on its side: "Is this your set?" shows the set, Yes, No and None of these without scrolling', async () => {
    for (const [w, h] of [
      [844, 390],
      [667, 375],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await page.click('#wcNotSure');
      await page.click('#wcFCount [data-n="3"]');
      await page.click('#wcFindNext');
      await type(page, ['R014', 'Y28', 'BG314']);
      await page.click('#scAdd');
      await idle(page);
      const m = await page.evaluate(() => {
        const c = document.querySelector('.wcard').getBoundingClientRect();
        return ['#wcRes', '#wcFindYes', '#wcFindOther', '#wcFindNone'].map((s) => {
          const r = document.querySelector(s).getBoundingClientRect();
          return { s, ok: r.top >= c.top && r.bottom <= c.bottom - 4 && r.height > 0 };
        });
      });
      for (const x of m) assert.ok(x.ok, w + '×' + h + ': ' + x.s + ' in the card');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v309-collection.test.mjs ----
// v309: a first collection without a set list to tick. The welcome opens on three ways in (I have a set, I bought them
// one by one, I'm not sure which set); "not sure" finds the set from about how many markers and a few caps read by
// Scan; "one by one" adds through Scan or the new colour chart, which Markers has too; after a set, the welcome asks
// whether there's anything else.
{
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      // (an overlay is fixed, with no offsetParent: shown when it has a box)
      return !!e && e.getClientRects().length > 0;
    }, id);
  const owned = (page) => page.evaluate(() => state.owned.size);
  const type = async (page, codes) => {
    for (const c of codes) {
      await page.fill('#scBox', c);
      await page.press('#scBox', 'Enter');
    }
  };
  test('three ways in; I have a set leads to the list, and Back (or Escape) comes back to the choice', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    for (const id of ['wcHaveSet', 'wcOneByOne', 'wcNotSure', 'wcSkip', 'wcRestore'])
      assert.ok(await shown(page, id), id);
    assert.equal(await shown(page, 'wcSets'), false, 'the set list waits behind I have a set');
    await page.click('#wcHaveSet');
    assert.ok(await shown(page, 'wcSets'));
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'wcT1',
      'the keyboard on the step’s heading',
    );
    await page.click('#wcStep1 .wcback');
    assert.ok(await shown(page, 'wcHaveSet'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'wcHaveSet', 'back on what led there');
    await page.click('#wcOneByOne');
    assert.ok(await shown(page, 'wcOneChart'));
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(await shown(page, 'wcOneByOne'), 'Escape is Back');
    assert.ok(
      await page.evaluate(() => document.getElementById('welcome').classList.contains('on')),
      'still open',
    );
    assert.deepEqual(errors, []);
  });
  test('not sure which set: about how many and 3 caps find Honolulu 120; the other match a tap away; Yes adds it and asks for anything else', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      // (a list kept from an earlier Scan visit: finding a set leaves it as it was)
      storage: { 'ms-scan-list': JSON.stringify([{ k: 'Copic|E00' }]) },
    });
    const kept = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('ms-scan-list') || '[]').map((e) => e.k));
    assert.deepEqual(await kept(), ['Copic|E00']);
    await page.click('#wcNotSure');
    assert.equal(await page.isDisabled('#wcFindNext'), true, 'about how many first');
    await page.click('#wcFCount [data-n="3"]');
    await page.click('#wcFindNext');
    await idle(page);
    assert.equal(await page.textContent('#scTitle'), 'Scan 3 caps');
    assert.equal(await shown(page, 'scBrand'), false, 'the brand is the one chosen');
    assert.equal(await page.locator('#scList li').count(), 0, 'a list of its own');
    assert.equal(await page.textContent('#scAdd'), 'Find my set');
    assert.equal(await page.isDisabled('#scAdd'), true);
    await type(page, ['R014', 'Y28']);
    assert.match(
      await page.textContent('#scFind'),
      /^Fits so far: Honolulu 120\..*One more cap to be sure\.$/,
    );
    await type(page, ['BG314']);
    assert.doesNotMatch(await page.textContent('#scFind'), /One more cap/);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await shown(page, 'scanOverlay'), false);
    assert.ok(await shown(page, 'wcStepRes'));
    assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
    assert.match(
      await page.textContent('#wcRes'),
      /Ohuhu Honolulu 120.*120 markers and a Colorless Blender.*Has all 3 caps you scanned: R014, Y28, BG314\./,
    );
    assert.equal(await page.textContent('#wcFindYes'), 'Yes, add these 120 markers');
    assert.equal(await page.textContent('#wcFindOther'), 'No: show Honolulu 168 (also matches)');
    await page.click('#wcFindOther');
    assert.match(await page.textContent('#wcRes'), /Also matches.*Honolulu 168/);
    // round to the first again
    while (!/Back to Honolulu 120/.test(await page.textContent('#wcFindOther')))
      await page.click('#wcFindOther');
    await page.click('#wcFindOther');
    assert.match(await page.textContent('#wcRes'), /Best match.*Honolulu 120/);
    await page.click('#wcFindYes');
    await idle(page);
    assert.equal(await owned(page), 121, '120 colours and the blender that comes with them (v309.1)');
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    // (v309.2: the blender that comes with the set is said)
    assert.equal(
      await page.textContent('#wcDone'),
      'Honolulu 120 and its Colorless Blender are in your collection. Anything else?',
    );
    assert.ok(await shown(page, 'wcMoreExtra'));
    assert.ok(await shown(page, 'wcMoreSet'));
    assert.equal(await page.textContent('#wcSample'), 'That’s all: try the sample');
    // Scan as it was: its own title, the list kept for Add
    assert.equal(await page.textContent('#scTitle'), 'Scan or type codes');
    assert.deepEqual(await kept(), ['Copic|E00']);
    assert.deepEqual(errors, []);
  });
  test('not sure, then Scan closed without finding: back on the find step, Scan as it was', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcNotSure');
    await page.click('#wcFBrand [data-b="Copic"]');
    await page.click('#wcFCount [data-n="0"]');
    await page.click('#wcFindNext');
    await type(page, ['E00']);
    await page.click('#scClose');
    await idle(page);
    assert.ok(await shown(page, 'wcStepFind'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'wcFindNext');
    assert.equal(await owned(page), 0, 'nothing added');
    await page.click('#wcFindNext');
    assert.equal(await page.locator('#scList li').count(), 0, 'each find starts afresh');
    await type(page, ['E00', 'R29']);
    await page.click('#scAdd');
    await idle(page);
    assert.match(await page.textContent('#wcRes'), /Copic Ciao 24/);
    assert.deepEqual(errors, []);
  });
  test('caps no set has: said, and they can be added on their own', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcNotSure');
    await page.click('#wcFCount [data-n="1"]');
    await page.click('#wcFindNext');
    // (Ohuhu's fluorescents are in none of its sets)
    const fl = await page.evaluate(() => {
      const inSets = new Set(MARKER_SETS.filter((p) => p.b === 'Ohuhu').flatMap((p) => presetMkeys(p)));
      return COLORS.filter((c, i) => c.brand === 'Ohuhu' && !inSets.has(mkey(i)))
        .slice(0, 2)
        .map((c) => c.code);
    });
    assert.equal(fl.length, 2);
    await type(page, fl);
    assert.match(await page.textContent('#scFind'), /No Ohuhu set has these/);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcTR'), 'No set found');
    assert.equal(await page.textContent('#wcFindYes'), 'Add the 2 markers you scanned');
    assert.equal(await shown(page, 'wcFindOther'), false);
    await page.click('#wcFindYes');
    await idle(page);
    assert.equal(await owned(page), 2);
    assert.equal(await page.textContent('#wcT2'), '2 markers added');
    assert.deepEqual(errors, []);
  });
  test('one by one: Scan’s Add, then the chart’s, each says what was added and asks for anything else', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneScan');
    await idle(page);
    assert.equal(await page.textContent('#scTitle'), 'Scan or type codes');
    // (codes only Ohuhu has: no question which brand)
    await type(page, ['R014', 'BG314']);
    assert.match(await page.textContent('#scCount'), /^2 markers/);
    assert.equal(await page.textContent('#scCount b'), '2', 'the number big');
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await owned(page), 2);
    assert.ok(await shown(page, 'wcStep2'), 'the welcome goes on');
    assert.equal(await page.textContent('#wcT2'), '2 markers added');
    assert.equal(await page.textContent('#wcDone'), '2 markers are in your collection. Anything else?');
    await page.click('#wcMoreExtra');
    await page.click('#wcOneChart');
    await idle(page);
    assert.ok(await shown(page, 'chartOverlay'));
    assert.equal(await page.isDisabled('#chSave'), true);
    // Red, as it opens: R014 already ticked (it's yours); two more
    assert.equal(await page.getAttribute('#chGrid .chsw[aria-label^="R014 "]', 'aria-pressed'), 'true');
    const two = await page.$$eval('#chGrid .chsw[aria-pressed="false"]', (l) =>
      l.slice(0, 2).map((b) => b.dataset.i),
    );
    for (const i of two) await page.click(`#chGrid .chsw[data-i="${i}"]`);
    assert.equal(await page.textContent('#chSave'), 'Add 2 markers');
    assert.match(await page.textContent('#chFamLbl'), /^Red · 3 of \d+ ticked$/);
    await page.click('#chSave');
    await idle(page);
    assert.equal(await owned(page), 4);
    assert.equal(await page.textContent('#wcT2'), '2 more markers added');
    assert.equal(await page.textContent('#wcDone'), '4 markers are in your collection. Anything else?');
    // I have another set: the list, the sets you have ticked off as before
    await page.click('#wcMoreSet');
    assert.ok(await shown(page, 'wcSets'));
    await page.click('#wcLook').catch(() => {});
    assert.deepEqual(errors, []);
  });
  test('Skip: the full range, without "anything else"', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcSkip');
    assert.equal(await page.textContent('#wcT2'), 'Explore with the full range');
    assert.equal(await shown(page, 'wcMore'), false);
    assert.equal(await page.textContent('#wcSample'), 'Try the sample');
    assert.deepEqual(errors, []);
  });
  test('Markers › Tick colours on a chart: yours ticked; untick one and tick two, Save, and Undo puts it all back', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ohuhu-hb320-picker-v3': JSON.stringify({
          mode: 'collection',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: ['Copic|E00', 'Copic|E11', 'Ohuhu|R014'],
          saved: [],
        }),
      },
    });
    await idle(page);
    await chartFromMarkers(page);
    await idle(page);
    assert.equal(
      await page.getAttribute('#chBrand [data-b="Copic"]', 'aria-pressed'),
      'true',
      'the brand of most of yours',
    );
    await page.click('#chFams .chfam[data-f="Earth / Skin / Brown"]');
    assert.equal(await page.textContent('#chFams [aria-pressed="true"]'), 'Earth & skin2');
    const e00 = await page.evaluate(() => COLORS.findIndex((c) => c.brand === 'Copic' && c.code === 'E00'));
    await page.click(`#chGrid .chsw[data-i="${e00}"]`);
    const two = await page.$$eval('#chGrid .chsw[aria-pressed="false"]', (l) =>
      l
        .filter((b) => !/^E00 /.test(b.getAttribute('aria-label')))
        .slice(0, 2)
        .map((b) => b.dataset.i),
    );
    for (const i of two) await page.click(`#chGrid .chsw[data-i="${i}"]`);
    assert.equal(await page.textContent('#chSave'), 'Save: +2 −1');
    assert.match(await page.textContent('#chSum'), /^4 ticked in all$/);
    await page.click('#chSave');
    await idle(page);
    assert.equal(await shown(page, 'chartOverlay'), false);
    assert.equal(await owned(page), 4);
    assert.equal(await page.evaluate(() => state.owned.has('Copic|E00')), false);
    assert.match(await page.textContent('#msToast'), /^Added 2, removed 1/);
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [...state.owned].sort()), [
      'Copic|E00',
      'Copic|E11',
      'Ohuhu|R014',
    ]);
    // (v311: what opened it on Markers: + Add markers, or the empty collection's card)
    assert.ok(
      ['mkAddBtn', 'mkcChart'].includes(
        await page.evaluate(() => document.activeElement && document.activeElement.id),
      ),
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v309-d1.test.mjs ----
// v309.1 (review 1): the welcome's steps. Back puts the keyboard back on what led on, wherever a step was reached from
// (not only from the first step), and a set or caps already yours say so rather than "0 more markers added".
{
  const type = async (page, codes) => {
    for (const c of codes) {
      await page.fill('#scBox', c);
      await page.press('#scBox', 'Enter');
    }
  };
  // what has the keyboard, and whether it is on screen
  const focus = (page) =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        id: (a && a.id) || (a && a.tagName),
        shown: !!a && a !== document.body && a.getClientRects().length > 0,
      };
    });
  test('Back from a step reached from "Anything else?", the set list or the result puts the keyboard back on what led there', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneScan');
    await type(page, ['R014', 'BG314']);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '2 markers added');
    // I have another set › Back
    await page.click('#wcMoreSet');
    await page.click('#wcStep1 .wcback');
    await idle(page);
    assert.deepEqual(await focus(page), { id: 'wcMoreSet', shown: true });
    // I have extra markers › Escape
    await page.click('#wcMoreExtra');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.deepEqual(await focus(page), { id: 'wcMoreExtra', shown: true });
    // the list › Find it from 3 caps › Back
    await page.click('#wcMoreSet');
    await page.click('#wcToFind');
    await page.click('#wcStepFind .wcback');
    await idle(page);
    assert.deepEqual(await focus(page), { id: 'wcToFind', shown: true });
    // Find › Scan › the result › None of these › Back, then Back to the find step
    await page.click('#wcToFind');
    await page.click('#wcFCount [data-n="3"]');
    await page.click('#wcFindNext');
    await type(page, ['R014', 'Y28', 'BG314']);
    await page.click('#scAdd');
    await idle(page);
    await page.click('#wcFindNone');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.deepEqual(await focus(page), { id: 'wcFindNone', shown: true });
    await page.keyboard.press('Escape');
    await idle(page);
    assert.deepEqual(await focus(page), { id: 'wcFindNext', shown: true });
    // and from the first step's ways in, as before
    await page.keyboard.press('Escape');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.querySelector('#welcome .wcard').dataset.step),
      'wcStep2',
    );
    assert.deepEqual(await focus(page), { id: 'wcMoreSet', shown: true });
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('a set already in your collection, added again: said so, not "0 more markers added"', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    await page.click('#wcMoreSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 121); // (with the blender that comes with it, v309.1)
    assert.equal(await page.textContent('#wcT2'), 'Nothing new to add');
    assert.equal(
      await page.textContent('#wcDone'),
      'Honolulu 120 was already in your collection. Anything else?',
    );
    // a set with some new: as before
    await page.click('#wcMoreSet');
    await page.check('#wcSets input[data-i="4"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.match(await page.textContent('#wcT2'), /^\d+ more markers added$/);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// ---- from v309-d2.test.mjs ----
// v309.1 (review 2): finding a set from a few caps. Copic caps from two sets offered "All Copic markers" (358) as "Is
// this your set?" whatever about how many said; a set further down with only some of the caps said "Also matches"; a
// Gray Tones set's strip was in no order of lightness.
{
  const type = async (page, codes) => {
    for (const c of codes) {
      await page.fill('#scBox', c);
      await page.press('#scBox', 'Enter');
    }
  };
  async function find(page, brand, n, caps) {
    await page.click('#wcNotSure');
    await page.click(`#wcFBrand [data-b="${brand}"]`);
    await page.click(`#wcFCount [data-n="${n}"]`);
    await page.click('#wcFindNext');
    await idle(page);
    await type(page, caps);
  }
  test('Copic caps from two sets, up to 30: the closest set, not all 358; All Copic markers last, a tap away', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    // R29 and E00 are in Ciao 24, B000 isn't
    await find(page, 'Copic', 0, ['R29', 'E00', 'B000']);
    assert.match(await page.textContent('#scFind'), /^No set has all of these\./);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcTR'), 'The closest set');
    assert.match(await page.textContent('#wcRes'), /^Has 2 of the 3 caps/);
    assert.doesNotMatch(await page.textContent('#wcFindYes'), /358/);
    const seen = [];
    for (let n = 0; n < 40; n++) {
      await page.click('#wcFindOther');
      const t = await page.innerText('#wcRes');
      seen.push(t.split('\n')[0] + ' / ' + t.split('\n')[1]);
      if (/Back to/.test(await page.textContent('#wcFindOther'))) break;
    }
    // further down, with only some of the caps: said so, not "Also matches"
    assert.ok(
      seen.slice(0, -1).every((s) => /^HAS [12] OF THE 3 CAPS/i.test(s)),
      seen.join('\n'),
    );
    assert.match(seen.at(-1), /^ALSO MATCHES \/ All Copic markers$/i, 'last, by its own name');
    // (v309.1: Copic counts its blender in a set's size, as its sets do; only Ohuhu's comes with a set uncounted)
    assert.equal(await page.textContent('#wcFindYes'), 'Yes, add these 358 markers');
    assert.deepEqual(errors, []);
  });
  test('Copic, more than 250: All Copic markers is the best match', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await find(page, 'Copic', 5, ['R29', 'E00', 'B000']);
    assert.match(await page.textContent('#scFind'), /^Fits so far: All Copic markers\./);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcTR'), 'Is this your set?');
    assert.match(await page.innerText('#wcRes'), /^BEST MATCH\nAll Copic markers\n358 markers\n/i);
    assert.deepEqual(errors, []);
  });
  test('the strip: colours by hue, then the greys light to dark (a Gray Tones set reads as a ramp)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const caps = await page.evaluate(() =>
      presetMkeys(MARKER_SETS.find((p) => p.n === '36 Gray Tones'))
        .slice(0, 3)
        .map((k) => k.split('|')[1]),
    );
    await find(page, 'Ohuhu', 1, caps);
    await page.click('#scAdd');
    await idle(page);
    assert.match(await page.textContent('#wcRes'), /36 Gray Tones/);
    const greys = await page.$$eval('#wcRes .wcstrip i', (l) => {
      // (the swatch's colour back to its marker in the set)
      const set = presetMkeys(MARKER_SETS.find((p) => p.n === '36 Gray Tones')).map(keyIdx);
      const hex = (s) =>
        '#' +
        s
          .match(/\d+/g)
          .slice(0, 3)
          .map((n) => (+n).toString(16).padStart(2, '0'))
          .join('');
      return l
        .map((i) => set.find((k) => COLORS[k].hex.toLowerCase() === hex(i.style.backgroundColor)))
        .filter((i) => i != null && HS[i].c < 0.12)
        .map((i) => HS[i].l);
    });
    assert.ok(greys.length > 10, 'most of it grey: ' + greys.length);
    for (let j = 1; j < greys.length; j++) assert.ok(greys[j] <= greys[j - 1], 'light to dark at ' + j);
    assert.deepEqual(errors, []);
  });
}

// ---- from v309-d3.test.mjs ----
// v309.1 (review 3): Tick colours on a chart. On a phone on its side the foot (Save) is in the card; the chosen
// family's chip is in view after a brand switch and when the chart opens again; each family's dot is a colour of its
// own, not a pale tint (Copic's Cool Grey was white, its Green cream).
{
  const ST = (owned) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ohuhu-hb320-picker-v3': JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned,
      saved: [],
    }),
  });
  test('a phone on its side (844×390): Save stays in the card while the swatches scroll, and saves', async () => {
    const { page, errors } = await openApp({ width: 844, height: 390, storage: ST(['Ohuhu|R014']) });
    await idle(page);
    await chartFromMarkers(page);
    await idle(page);
    const inCard = () =>
      page.evaluate(() => {
        const c = document.querySelector('.chcard').getBoundingClientRect(),
          s = document.getElementById('chSave').getBoundingClientRect(),
          x = s.left + s.width / 2,
          y = s.top + s.height / 2,
          hit = document.elementFromPoint(x, y);
        return s.top >= c.top && s.bottom <= c.bottom && !!hit && !!hit.closest('#chSave');
      });
    assert.ok(await inCard(), 'Save in the card, nothing over it');
    for (const top of [200, 99999]) {
      await page.evaluate((t) => {
        document.querySelector('.chcard').scrollTop = t;
      }, top);
      await idle(page);
      assert.ok(await inCard(), 'Save in view, scrolled to ' + top);
    }
    await page.click('#chGrid .chsw >> nth=-1');
    assert.equal(await page.textContent('#chSave'), 'Add 1 marker');
    await page.click('#chSave');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 2);
    assert.deepEqual(errors, []);
  });
  test('the chosen family’s chip is in view after a brand switch and when the chart opens again', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: ST(['Ohuhu|R014']) });
    await idle(page);
    await chartFromMarkers(page);
    await idle(page);
    const chip = () =>
      page.evaluate(() => {
        const row = document.getElementById('chFams'),
          c = row.querySelector('[aria-pressed="true"]'),
          r = row.getBoundingClientRect(),
          b = c.getBoundingClientRect();
        return { f: c.dataset.f, seen: b.left >= r.left && b.right <= r.right };
      });
    // the last family, the row scrolled to its end
    await page.evaluate(() => {
      document.getElementById('chFams').scrollLeft = 1e5;
    });
    await page.click('#chFams .chfam >> nth=-1');
    await idle(page);
    assert.deepEqual(await chip(), { f: 'Fluorescent', seen: true });
    await page.click('#chBrand [data-b="Copic"]');
    await idle(page);
    assert.deepEqual(await chip(), { f: 'Red', seen: true }, 'Copic: Red, in view');
    await page.click('#chFams .chfam >> nth=-1');
    await page.keyboard.press('Escape');
    await idle(page);
    await chartFromMarkers(page);
    await idle(page);
    assert.deepEqual(await chip(), { f: 'Red', seen: true }, 'opened again: Red, in view');
    assert.deepEqual(errors, []);
  });
  test('each family’s dot is one of its own markers, of middle lightness: no white or cream dots', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: ST([]) });
    await idle(page);
    const dots = await page.evaluate(() => {
      const out = [];
      for (const b of ['Ohuhu', 'Copic'])
        chartFams(b).forEach((f) => {
          const i = f.idxs.find((j) => COLORS[j].hex === f.dot);
          out.push({ b, f: f.name, ok: i != null, l: i == null ? -1 : +HS[i].l.toFixed(2) });
        });
      return out;
    });
    for (const d of dots) {
      assert.ok(d.ok, d.b + ' ' + d.f + ': one of its markers');
      if (d.f === 'Neutral / Black') continue;
      assert.ok(d.l >= 0.3 && d.l <= 0.75, d.b + ' ' + d.f + ' dot of middle lightness, not ' + d.l);
    }
    assert.deepEqual(errors, []);
  });
}

// ---- from v3091-d4.test.mjs ----
// v309.1 (review 4): the welcome. The toast's Undo of a set, tapped after the welcome went on (another set, extra
// markers), leaves no way Back to "120 markers added" (v318.26: Scan's toast; a set's Undo is a link on its step); the chosen brand's small print on the find step reads at 4.5:1.
{
  const where = (page) =>
    page.evaluate(() => ({
      step: document.querySelector('#welcome .wcard').dataset.step,
      owned: state.owned.size,
      focus: document.activeElement && (document.activeElement.id || document.activeElement.tagName),
    }));
  // (v318.26: a set's Undo in the welcome is a link on "Anything else?", gone once the welcome goes on, so a set can't be
  // undone from another step now; v318.29: nor caps typed in Scan, whose toast had covered the step's choices on a phone)
  test('Undo after the welcome went on: a set’s link, and Scan’s (v318.29), go with their step', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    // I have another set, then Back: still added, its Undo link gone with the step it was on
    await page.click('#wcMoreSet');
    await idle(page);
    await page.click('#wcStep1 .wcback');
    await idle(page);
    assert.equal((await where(page)).step, 'wcStep2');
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    assert.equal(await page.isVisible('#wcUndoBtn'), false);
    assert.equal((await where(page)).owned, 121);
    // caps typed in Scan (v318.29: its Undo a link on the step too, no toast over the step's choices), then on to
    // another set and Back: still added, the link gone with the step it was on, as a set's
    await page.click('#wcMoreExtra');
    await page.click('#wcOneType');
    await page.fill('#scBox', 'B04');
    await page.press('#scBox', 'Enter');
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '1 more marker added');
    assert.equal(await page.isVisible('#msToast'), false, 'no toast');
    assert.equal(await page.getAttribute('#wcUndoBtn', 'aria-label'), 'Undo: take this marker back out');
    await page.click('#wcMoreSet');
    await idle(page);
    await page.click('#wcStep1 .wcback');
    await idle(page);
    assert.equal((await where(page)).step, 'wcStep2');
    assert.equal(await page.textContent('#wcT2'), '1 more marker added');
    assert.equal(await page.isVisible('#wcUndoBtn'), false);
    assert.equal((await where(page)).owned, 122);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  test('the chosen brand’s small print on "Let’s find your set" reads at 4.5:1 or better', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcNotSure');
    await idle(page);
    const cr = await page.evaluate(() => {
      const p = (c) => c.match(/[\d.]+/g).map(Number);
      const L = ([r, g, b]) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const over = (t, b) => [0, 1, 2].map((i) => t[i] * (t[3] ?? 1) + b[i] * (1 - (t[3] ?? 1)));
      const el = document.querySelector('#wcFBrand [aria-pressed="true"] small'),
        layers = [];
      for (let a = el; a; a = a.parentElement) {
        const c = p(getComputedStyle(a).backgroundColor);
        if ((c[3] ?? 1) > 0) layers.push(c);
        if ((c[3] ?? 1) === 1) break;
      }
      const bg = layers.reverse().reduce((b, c) => over(c, b), [0, 0, 0]),
        fg = over(p(getComputedStyle(el).color), bg),
        a = L(fg),
        b = L(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    assert.ok(cr >= 4.5, 'contrast ' + cr.toFixed(2));
    assert.deepEqual(errors, []);
    await ctx.close();
  });
  // (v318.30: Open is a link in the step's line, "1 still to choose: Open · Undo", not the toast's)
  test('a question left in Scan from the welcome, answered through the step’s Open: the welcome counts it, and its Undo goes back to the count before', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcOneByOne');
    await page.click('#wcOneScan');
    // R014 is Ohuhu's alone; Y28 is a code in both brands: asked
    for (const c of ['R014', 'Y28']) {
      await page.fill('#scBox', c);
      await page.press('#scBox', 'Enter');
    }
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '1 marker added');
    // the step's Open (v318.30; was the toast's): Scan again, the question answered, Add
    assert.equal(await page.textContent('#wcUndo'), '1 still to choose: Open · Undo');
    await page.click('#wcOpenBtn');
    await idle(page);
    await page.click('#scList .scchoose >> nth=0');
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 2);
    assert.equal(await page.textContent('#wcT2'), '1 more marker added');
    assert.equal(await page.textContent('#wcDone'), '2 markers are in your collection. Anything else?');
    // its Undo (v318.29: the link on "Anything else?"): the welcome says what it said before
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.size), 1);
    assert.equal(
      await page.evaluate(() => document.querySelector('#welcome .wcard').dataset.step),
      'wcStep2',
    );
    assert.equal(await page.textContent('#wcT2'), '1 marker added');
    assert.equal(await page.textContent('#wcDone'), '1 marker is in your collection. Anything else?');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

// ---- from v318-adding-2.test.mjs ----
// v318 review (adding markers, 2): Some are missing (the welcome, after a set) opens the chart on your markers only,
// titled to untick the lost ones; an unticked one stays where it was, faded; None are missing closes it; Show all colours
// gives every colour back. Markers' own chart is as it was. Fails on v318.
{
  const shown = (page, id) =>
    page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
  const swatches = (page) =>
    page.$$eval('#chGrid .chsw', (l) =>
      l.map((b) => ({ i: +b.dataset.i, on: b.getAttribute('aria-pressed') === 'true' })),
    );
  test('Some are missing: only your markers, untick the lost, Remove; None are missing; Show all colours', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    await page.click('#wcMoreMiss');
    await idle(page);
    assert.equal(await page.textContent('#chTitle'), 'Untick any you’ve lost');
    assert.equal(await shown(page, 'chBrand'), false, 'one brand: no brand buttons');
    let sw = await swatches(page);
    assert.ok(sw.length > 3 && sw.every((s) => s.on), 'only the markers you have, all ticked');
    assert.ok(
      await page.evaluate(
        (is) => is.every((i) => state.owned.has(mkey(i))),
        sw.map((s) => s.i),
      ),
    );
    // nothing unticked: the button closes, all there
    assert.equal(await page.textContent('#chSave'), 'None are missing');
    assert.equal(await page.isEnabled('#chSave'), true);
    await page.click('#chSave');
    await idle(page);
    assert.equal(await shown(page, 'chGrid'), false, 'closed');
    assert.equal(await page.textContent('#wcT2'), '121 markers added', 'nothing changed');
    // again: two unticked stay in place, faded; Remove 2
    await page.click('#wcMoreMiss');
    await idle(page);
    await page.click(`#chGrid .chsw[data-i="${sw[0].i}"]`);
    await page.click(`#chGrid .chsw[data-i="${sw[2].i}"]`);
    const after1 = await swatches(page);
    assert.deepEqual(
      after1.map((s) => s.i),
      sw.map((s) => s.i),
      'the swatches stay where they were',
    );
    assert.equal(
      await page.$eval(`#chGrid .chsw[data-i="${sw[0].i}"] i`, (e) => getComputedStyle(e).opacity),
      '0.3',
    );
    assert.equal(await page.textContent('#chSave'), 'Remove 2');
    // Show all colours: every red, the two unticked still unticked
    await page.click('#chAll');
    assert.equal(await page.textContent('#chTitle'), 'Tick the colours you have');
    sw = await swatches(page);
    assert.ok(sw.length > after1.length && sw.some((s) => !s.on), 'every colour');
    assert.equal(await page.textContent('#chSave'), 'Remove 2');
    await page.click('#chSave');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '2 markers removed');
    assert.deepEqual(errors, []);
  });
  test('Markers’ chart: every colour, as before', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await chartFromMarkers(page);
    assert.equal(await page.textContent('#chTitle'), 'Tick the colours you have');
    assert.equal(await shown(page, 'chAll'), false);
    assert.equal(await page.isEnabled('#chSave'), false);
    assert.equal(await page.textContent('#chSave'), 'Tick your colours');
    assert.deepEqual(errors, []);
  });
}
