// v305 (guide): a Colour along row's outline goes once its marker is finished, and stays gone in Focus mode, the Plan
// and after zooming; Photo before its photo is chosen says the picture keeps the pattern before, with Back to it beside
// Choose a photo (and closing the picker without one goes back by itself); a new Blend's anchors sit on the drawing,
// not the paper round it, in vivid colours round the hue wheel, while a saved Blend guide reopens as it was; the
// Shading tab's drop-downs are readable in Safari's engine.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, letterGuide, idle, pause, until } from './helpers.mjs';

before(setup);
after(teardown);

const assignMap = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData.assign,
      o = {};
    for (const k in a) o[k] = a[k].mkey;
    return o;
  });
const anchorsOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(__mstest.anchors)));

// ---- B3 ----
test('the open row’s outline is hidden once its marker is finished, in Colour along, Focus mode, after zooming and in the Plan', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('#sfColor');
  await idle(page);
  const outline = () =>
    page.evaluate(() => {
      const o = document.querySelector('.sfoutline');
      return o && o.style.display !== 'none' ? o.dataset.secs.split(' ').length : 0;
    });
  const i = await page.evaluate(() => {
    const t = __mstest;
    return [...document.querySelectorAll('#sfAlist .sfarow')].findIndex(
      (r) => t.assignData.order.filter((l) => t.assignData.assign[l].mkey === r.dataset.k).length >= 3,
    );
  });
  await page.locator('#sfAlist .sfarow .sfah').nth(i).click();
  await idle(page);
  const n = await outline();
  assert.ok(n >= 3, 'the open row’s sections are outlined');
  await page.click('#sfMarkAll');
  await idle(page);
  assert.equal(await outline(), 0, 'no outline once every section is ticked');
  await pause(page, 400, 'past the double-tap window');
  await page.click('#sfMarkAll');
  await idle(page);
  assert.equal(await outline(), n, 'Clear ticks outlines them again');
  await page.click('#sfMarkAll');
  await idle(page);
  await page.click('#sfZin');
  await idle(page);
  assert.equal(await outline(), 0, 'not after zooming');
  await page.click('#sfFocus');
  await idle(page);
  assert.equal(await outline(), 0, 'not in Focus mode');
  await page.keyboard.press('Escape');
  await idle(page);
  await page.click('#sfDoneBtn');
  await idle(page);
  assert.equal(await outline(), 0, 'not back in the Plan');
  assert.deepEqual(errors, []);
});

// ---- B7 ----
test('Photo with no photo chosen: the picture keeps Blend’s colours, said so, with Back to Blend beside Choose a photo', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="blend"]');
  await idle(page);
  const a0 = await assignMap(page),
    k0 = await anchorsOf(page);
  // (the file picker is left open, as while it's up or in a browser without its cancel event)
  await page.evaluate(() => {
    HTMLInputElement.prototype.click = function () {};
  });
  await page.click('#sfFam [data-v="photo"]');
  await idle(page);
  assert.equal(await page.getAttribute('#sfFam [data-v="photo"]', 'aria-pressed'), 'true');
  assert.equal(
    await page.textContent('#sfPhWait'),
    'Until you choose a photo, the picture keeps its Blend colours.',
  );
  assert.equal(await page.textContent('#sfPhBack'), 'Back to Blend');
  const [p, b] = [
    await page.locator('#sfPhPick').boundingBox(),
    await page.locator('#sfPhBack').boundingBox(),
  ];
  assert.ok(Math.abs(p.y - b.y) < 2 && b.x > p.x + p.width, 'side by side on one row');
  assert.deepEqual(await assignMap(page), a0, 'Blend’s colours still');
  await page.click('#sfPhBack');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.family), 'blend');
  assert.deepEqual(await assignMap(page), a0, 'the same colours');
  assert.deepEqual(await anchorsOf(page), k0, 'and anchors');
  assert.equal(await page.locator('#sfPhWait').count(), 0);
  // (Photo straight from the start: nothing to go back to is offered for a pattern it never had)
  assert.deepEqual(errors, []);
});

test('closing the photo picker without a photo goes back to the pattern before; Choose a photo… closed again stays on Photo', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="random"]');
  await idle(page);
  const a0 = await assignMap(page);
  // (the picker closed without a photo: its cancel event)
  await page.evaluate(() => {
    window.__cancel = true;
    HTMLInputElement.prototype.click = function () {
      if (window.__cancel) setTimeout(() => this.dispatchEvent(new Event('cancel')), 50);
    };
  });
  await page.click('#sfFam [data-v="photo"]');
  await until(page, () => __mstest.family === 'random', null, 'back to Random');
  await idle(page);
  assert.equal(await page.getAttribute('#sfFam [data-v="random"]', 'aria-pressed'), 'true');
  assert.deepEqual(await assignMap(page), a0);
  assert.equal(await page.isVisible('#sfPlanUndo'), true, 'Random’s own step is still the one to undo');
  assert.notEqual(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: Pattern: Photo');
  // the picker left open, then Choose a photo… and closed again: Photo stays, Back to Random still offered
  await page.evaluate(() => {
    window.__cancel = false;
  });
  await page.click('#sfFam [data-v="photo"]');
  await idle(page);
  await page.evaluate(() => {
    window.__cancel = true;
  });
  await page.click('#sfPhPick');
  await pause(page, 300, 'the cancel event comes and goes');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.family), 'photo');
  assert.equal(await page.textContent('#sfPhBack'), 'Back to Random');
  // (Random's colours as they were, not shuffled afresh)
  await page.click('#sfPhBack');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.family), 'random');
  assert.deepEqual(await assignMap(page), a0);
  assert.deepEqual(errors, []);
});

// ---- B8 ----
test('a new Blend’s three anchors sit on sections of the drawing, not the paper round it, each on its own', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await letterGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="blend"]');
  await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest,
      inG = new Set(t.assignData.order);
    return t.anchors.map((a) => ({
      L: t.labels[Math.round(a.y) * t.W + Math.round(a.x)],
      on: inG.has(t.labels[Math.round(a.y) * t.W + Math.round(a.x)]),
    }));
  });
  assert.equal(r.length, 3);
  for (const a of r) assert.ok(a.on, 'section ' + a.L + ' is one coloured');
  assert.equal(new Set(r.map((a) => a.L)).size, 3, 'three sections');
  // Reset anchors: the same three places
  const k = await anchorsOf(page);
  await page.click('#sfResetA');
  await idle(page);
  assert.deepEqual(await anchorsOf(page), k);
  assert.deepEqual(errors, []);
});

test('a new Blend’s anchors are vivid markers round the hue wheel (with Ben’s 451, not the brown E713 first)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.evaluate(() => {
    state.owned = defaultOwned();
    save();
    __mstest.setCollection(sfCollection());
  });
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="blend"]');
  await idle(page);
  const m = await page.evaluate(() => {
    const t = __mstest,
      by = {};
    t.coll.forEach((m) => {
      by[m.mkey] = m;
    });
    const all = t.coll.map((m) => t.colour.lch(m)[1]).sort((a, b) => a - b),
      med = all[Math.floor(all.length / 2)];
    return {
      med,
      a: t.anchors.map((a) => {
        const x = t.colour.lch(by[a.mkey]);
        return { k: a.mkey, c: x[1], h: ((x[2] % 360) + 360) % 360 };
      }),
    };
  });
  assert.equal(m.a.length, 3);
  assert.ok(!m.a.some((a) => a.k === 'Ohuhu|E713'), JSON.stringify(m.a));
  for (const a of m.a) assert.ok(a.c >= m.med, a.k + ' vivid');
  for (let i = 0; i < 3; i++)
    for (let j = i + 1; j < 3; j++) {
      const d = Math.abs(m.a[i].h - m.a[j].h);
      assert.ok(Math.min(d, 360 - d) >= 60, `${m.a[i].k} and ${m.a[j].k} far apart in hue`);
    }
  assert.deepEqual(errors, []);
});

test('a saved Blend guide reopens with its own anchors and colours, even anchors on the paper', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="blend"]');
  await idle(page);
  // (as an older version placed them: over the whole picture, one in its corner on blank paper)
  await page.evaluate(() => {
    const t = __mstest,
      k = t.anchors.map((a) => a.mkey);
    t.anchors.splice(
      0,
      3,
      { x: 3, y: 3, mkey: k[0] },
      { x: t.W * 0.75, y: t.H * 0.3, mkey: k[1] },
      { x: t.W * 0.5, y: t.H * 0.75, mkey: k[2] },
    );
    t.reassign();
  });
  await idle(page);
  await page.evaluate(() => __mstest.saveNow());
  await page.waitForFunction(() => __mstest.inLibrary);
  await idle(page);
  const id = await page.evaluate(() => __mstest.curId),
    a0 = await assignMap(page),
    k0 = await anchorsOf(page);
  await page.reload();
  await idle(page);
  await page.evaluate((id) => sfLoadDesign(id).then((d) => __mstest.openDesignObj(d, id)), id);
  await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.family), 'blend');
  assert.deepEqual(await anchorsOf(page), k0);
  assert.deepEqual(await assignMap(page), a0);
  assert.deepEqual(errors, []);
});

// ---- Shading's drop-downs in Safari's engine ----
// (each drop-down's text against its box: the brightest or darkest pixel of its left part, away from the arrow, against
// the box's own colour, as WCAG contrast)
test('the Shading tab’s Highlights and Shadows drop-downs are readable (their text stands out from their box)', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="shading"]');
  await page.click('#sfShade [data-v="full"]');
  await idle(page);
  for (const id of ['sfHiStyle', 'sfShStyle']) {
    const el = page.locator('#' + id);
    await el.scrollIntoViewIfNeeded();
    const b = await el.boundingBox(),
      png = await page.screenshot({
        clip: { x: b.x + 4, y: b.y + 4, width: b.width * 0.5, height: b.height - 8 },
      });
    const c = await page.evaluate(
      async (src) => {
        const im = new Image();
        im.src = src;
        await im.decode();
        const cv = document.createElement('canvas');
        cv.width = im.naturalWidth;
        cv.height = im.naturalHeight;
        const g = cv.getContext('2d');
        g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, cv.width, cv.height).data,
          n = {},
          lum = (r, gg, b) => {
            const f = (v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
          };
        let mode = null,
          mc = 0;
        for (let i = 0; i < d.length; i += 4) {
          const k = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
          n[k] = (n[k] || 0) + 1;
          if (n[k] > mc) {
            mc = n[k];
            mode = [d[i], d[i + 1], d[i + 2]];
          }
        }
        const bg = lum(...mode);
        let best = 1;
        for (let i = 0; i < d.length; i += 4) {
          const l = lum(d[i], d[i + 1], d[i + 2]),
            r = (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05);
          if (r > best) best = r;
        }
        return best;
      },
      'data:image/png;base64,' + png.toString('base64'),
    );
    assert.ok(c >= 4.5, `${id}: contrast ${c.toFixed(2)}`);
    assert.equal(await el.evaluate((s) => getComputedStyle(s).colorScheme), 'dark');
  }
  assert.deepEqual(errors, []);
});
