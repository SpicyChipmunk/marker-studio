// v306 (welcome branch): the welcome's picture (the sample page, its colour flooding down it from the bell, three
// times, then it stays coloured) and "You're all set"'s fan of the markers just added.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

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
  await haveSet(page); await page.check('#wcSets input[data-i="3"]');
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
      pr = document.querySelector('.wcpic').getBoundingClientRect();
    return {
      names: [sl.animationName, si.animationName],
      op: +sl.opacity,
      moved: [sl.transform, si.transform],
      // the guide covers the whole picture (the box it shows through, past every edge of it)
      covers:
        lr.left <= pr.left + 0.5 &&
        lr.right >= pr.right - 0.5 &&
        Math.abs(ir.width * ir.height - pr.width * pr.height) < 4,
      ok: i.complete && i.naturalWidth > 0,
    };
  });
  assert.deepEqual(c.names, ['none', 'none']);
  assert.equal(c.op, 1);
  assert.deepEqual(c.moved, ['none', 'none']);
  assert.ok(c.covers, 'the guide lies over the whole picture');
  assert.ok(c.ok, 'the coloured picture loaded');
  assert.ok((await picBox(page)).shown);
  await haveSet(page); await page.check('#wcSets input[data-i="3"]');
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
      const l = document.querySelector('.wcfl').getBoundingClientRect(),
        i = document.querySelector('.wcfl img').getBoundingClientRect(),
        p = document.querySelector('.wcpic').getBoundingClientRect();
      return {
        edge: (l.right - p.left) / p.width,
        still: Math.max(Math.abs(i.left - p.left), Math.abs(i.top - p.top), Math.abs(i.right - p.right)),
        op: +getComputedStyle(document.querySelector('.wcfl')).opacity,
      };
    }, t);
  const mid = await at(600 + 900);
  assert.ok(mid.edge > 0.2 && mid.edge < 1, 'the colour part way along (' + mid.edge + ')');
  assert.ok(mid.still < 0.5, 'the guide doesn’t move (' + mid.still + ')');
  const end = await at(11000);
  assert.ok(end.edge >= 1 && end.still < 0.5 && end.op === 1, 'it rests coloured');
  await haveSet(page); await page.check('#wcSets input[data-i="3"]');
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
    await haveSet(page); await page.check('#wcSets input[data-i="3"]');
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
      return { outer: sc.scrollHeight - sc.clientHeight, cardB: c.bottom, skipB: sk.bottom, vh: innerHeight };
    });
    assert.ok(first.outer <= 1, w + '×' + h + ': the three ways in don’t scroll (' + first.outer + ')');
    assert.ok(first.cardB <= first.vh && first.skipB <= first.cardB, 'the card and Skip are on the screen');
    await haveSet(page);
    const m = await page.evaluate(() => {
      const s = document.getElementById('wcSets'),
        c = document.querySelector('.wcard').getBoundingClientRect(),
        add = document.getElementById('wcAdd').getBoundingClientRect();
      return { list: s.clientHeight, inner: s.scrollHeight - s.clientHeight, cardB: c.bottom, addB: add.bottom, vh: innerHeight };
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
      return { card: r('#welcome .wcard'), title: r('#wcTitle'), ways: r('#wcStep0 .wcch'), skip: r('#wcSkip') };
    });
    assert.ok(p.h > p.w * 2, 'upright (' + p.w + '×' + p.h + ')');
    assert.ok(Math.abs(g.card.width - 760) <= 1, 'the card is 760 px wide (' + g.card.width + ')');
    for (const k of ['title', 'ways', 'skip'])
      assert.ok(g[k].left >= p.r + 16, k + ' is to the right of the picture');
    assert.ok(p.y < g.ways.bottom && p.b > g.ways.top, 'side by side with the ways in');
    assert.ok(p.h >= 600, 'it uses the height (' + p.h + ')');
    await haveSet(page);
    const cw1 = await page.evaluate(() => document.querySelector('#welcome .wcard').getBoundingClientRect().width);
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
      cw = await page.evaluate(() => document.querySelector('#welcome .wcard').getBoundingClientRect().width);
    assert.ok(p.w > p.h * 2, 'on its side (' + p.w + '×' + p.h + ')');
    assert.ok(p.b <= t.top, 'above the heading');
    assert.ok(Math.abs(cw - 440) <= 1, 'the card as before (' + cw + ')');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

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

test('“You’re all set” fans out 28 of the markers added, in hue order, open as it rests; Skip fans the full range', async () => {
  {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await page.waitForSelector('#welcome.on');
    await haveSet(page); await page.check('#wcSets input[data-i="0"]');
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
    await haveSet(page); await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const s = await strips(page);
    assert.equal(s.length, 28);
    assert.equal(s[0].deg, -78);
    assert.equal(s[27].deg, 78);
    for (let i = 1; i < s.length; i++) {
      assert.ok(s[i].deg > s[i - 1].deg, 'fanned out');
      assert.ok(hue(s[i].rgb) >= hue(s[i - 1].rgb) - 0.5, 'in hue order');
    }
    const owned = await page.evaluate(() => [...state.owned].map((k) => COLORS[keyIdx(k)].hex.toLowerCase()));
    const hex = (c) => '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
    for (const x of s) assert.ok(owned.includes(hex(x.rgb)), hex(x.rgb) + ' is one of the markers added');
    // (v309: says what was added, and asks for anything else)
    assert.equal(await page.textContent('#wcT2'), '120 markers added');
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
        sc: document.getElementById('wcStep2').scrollHeight - document.getElementById('wcStep2').clientHeight,
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
  const { page, errors, ctx } = await openApp({ width: 820, height: 1180, storage: { 'ms-onboarded': '1' } });
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
