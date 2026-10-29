// A colouring page made from a photo, v326 (docs/PLAN-v326-photo-page.md): the markers that would help it most and
// Try it with these (1), the page step in its markers' colours and its taps (2), Plan's Photo panel (3), Subject only
// and its crop (4), the Detail steps kept (6), the Photo button on the page step (8). Made-up photos only (the
// author's stay out of the repo).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { answerAsks, idle, openApp, setup, teardown, until } from './helpers.mjs';

before(setup);
after(teardown);

const ONBOARDED = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-photo-tips': '1' };
const VIEW = { width: 820, height: 1180, storage: ONBOARDED };
// a made-up photo (JPEG): sky to ground, soft blobs and hard shapes in colour, a white patch, texture and noise; with
// subject, a big dark-red disc in the middle on a pale, even ground (a subject the finder can find)
function photo(page, { w = 1200, h = 900, seed = 7, subject = false } = {}) {
  return page.evaluate(
    ({ w, h, seed, subject }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      if (subject) {
        g.fillStyle = '#dfe6ea';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#7a1f26';
        g.beginPath();
        g.ellipse(w * 0.5, h * 0.52, w * 0.2, h * 0.3, 0.3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e0a33a';
        g.beginPath();
        g.ellipse(w * 0.47, h * 0.45, w * 0.07, h * 0.09, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        const lg = g.createLinearGradient(0, 0, 0, h);
        lg.addColorStop(0, '#7fb2e0');
        lg.addColorStop(0.55, '#d8e4ec');
        lg.addColorStop(0.56, '#6c8a3c');
        lg.addColorStop(1, '#3d4f22');
        g.fillStyle = lg;
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          const x = rnd() * w,
            y = rnd() * h,
            r = 20 + rnd() * 160,
            rg = g.createRadialGradient(x, y, 0, x, y, r),
            hue = Math.round(rnd() * 360);
          rg.addColorStop(0, `hsla(${hue},60%,${35 + rnd() * 35}%,0.9)`);
          rg.addColorStop(1, `hsla(${hue},60%,50%,0)`);
          g.fillStyle = rg;
          g.fillRect(x - r, y - r, 2 * r, 2 * r);
        }
        for (let i = 0; i < 10; i++) {
          g.fillStyle = `hsl(${Math.round(rnd() * 360)},65%,${30 + rnd() * 35}%)`;
          g.beginPath();
          g.ellipse(rnd() * w, rnd() * h, 30 + rnd() * 120, 20 + rnd() * 80, rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#fcfcfa';
        g.fillRect(w * 0.72, h * 0.08, w * 0.18, h * 0.16);
      }
      const id = g.getImageData(0, 0, w, h),
        d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (rnd() - 0.5) * 14;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      g.putImageData(id, 0, 0);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    },
    { w, h, seed, subject },
  );
}
const file = (b64) => ({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
const pageReady = (page, d) =>
  until(
    page,
    (d) =>
      !!__mstest.pp &&
      !__mstest.ppBusy &&
      (d == null || __mstest.pp.d === d) &&
      /This page:/.test((document.getElementById('sfPpCount') || {}).textContent || ''),
    d,
    'the page step, its page made',
    60000,
  );
// your markers: these (mkeys), or a set's
const own = (page, keys) =>
  page.evaluate((keys) => {
    state.owned = new Set(keys);
    SF.setCollection(sfCollection());
  }, keys);
const setKeys = (page, name) => page.evaluate((n) => presetMkeys(MARKER_SETS.find((s) => s.n === n)), name);
async function fromHome(page, opts) {
  const b64 = await photo(page, opts);
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('[data-start="ppage"]:visible').first().click(),
  ]);
  await fc.setFiles(file(b64));
  await pageReady(page, 2);
  await idle(page);
}
// the markers-to-add line, once its numbers are in
const helpLine = (page, re) =>
  until(
    page,
    (src) => new RegExp(src).test((document.getElementById('sfPpHelp') || {}).textContent || ''),
    re.source,
    'the markers-to-add line',
    30000,
  ).then(() => page.textContent('#sfPpHelp'));
// a section's colour on the page step's canvas, at its middle, and its marker as made
const sectionPx = (page) =>
  page.evaluate(() => {
    const p = __mstest.pp,
      cv = document.getElementById('sfCanvas'),
      g = cv.getContext('2d'),
      byKey = {};
    COLORS.forEach((c, i) => (byKey[mkey(i)] = c.hex));
    // (the biggest section made with a marker: its middle is inside it)
    let best = 0,
      bl = 0;
    for (const l in p.made)
      if (__mstest.comps[l] && __mstest.comps[l].area > best) ((best = __mstest.comps[l].area), (bl = +l));
    // (a point well inside it: its own label 4 pixels each way)
    const L = __mstest.labels,
      Wd = __mstest.W;
    let px = -1;
    for (let i = 0; i < L.length && px < 0; i += 3) {
      if (L[i] !== bl) continue;
      const x = i % Wd,
        y = Math.floor(i / Wd);
      if ([-4, 4].every((d) => L[(y + d) * Wd + x] === bl && L[y * Wd + x + d] === bl)) px = i;
    }
    const cx = px % Wd,
      cy = Math.floor(px / Wd),
      d = g.getImageData(cx, cy, 1, 1).data,
      hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    return {
      l: bl,
      hex: hex,
      made: byKey[p.made[bl]].toLowerCase(),
      cx: cx + 0.5,
      cy: cy + 0.5,
      W: __mstest.W,
      H: __mstest.H,
    };
  });
const toastNow = (page) =>
  page.evaluate(() => (document.querySelector('#msToast.on') || {}).textContent || '');

test('the markers that would help: suggested with To buy chips, Try it with these, Plan says the same, Colour along tags them', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  // four markers of a set: little of a colourful photo matched, so markers to add are suggested
  await own(page, (await setKeys(page, 'Honolulu 24')).slice(0, 4));
  await fromHome(page, { seed: 7 });
  const t = await helpLine(page, /Your \d+ markers? match(es)? \d+% of this photo\./);
  const m = t.match(/match (\d+)% of this photo\.\s*Adding .* would make it (\d+)%/);
  assert.ok(m, t);
  // (v327.1: whose markers, counted: the figure is all of them)
  assert.match(t, /Your 4 markers match/);
  assert.ok(+m[2] - +m[1] >= 15, 'shown when they add 15 points or more: ' + t);
  const chips = await page.$$eval('#sfPpHelp .wishchip', (b) => b.map((x) => x.getAttribute('data-wk')));
  assert.ok(chips.length >= 1, 'To buy chips');
  const owned = await page.evaluate(() => Array.from(state.owned));
  chips.forEach((k) => assert.ok(!owned.includes(k), k + ' isn’t yours'));
  // Try it with these: the page made with them added, said, and they're used
  await page.click('#sfPpHelp [data-pp="try"][data-l="a"], #sfPpHelp [data-pp="try"]');
  await until(page, () => !!__mstest.pp.add && !__mstest.ppBusy, null, 'made with them', 60000);
  await pageReady(page);
  await idle(page);
  const add = await page.evaluate(() => __mstest.pp.add);
  assert.ok(add.length >= 1);
  assert.match(await helpLine(page, /Made with your markers and \d+ you don’t own/), /Use only yours/);
  // (v327.1: the page step's Made for line counts them apart: they'd been counted as yours)
  assert.equal(
    await page.textContent('#sfPpMade'),
    'Made for your 4 markers and the ' + add.length + ' added.',
  );
  // Build: the plan as made, and Plan's Photo panel says the same
  await page.click('#sfBuild');
  await until(page, () => __mstest.sfmode === 'guide' && !!__mstest.assignData, null, 'built', 30000);
  await idle(page);
  await page.click('#sfTab-pattern');
  await idle(page);
  assert.match(await page.textContent('#sfPpHelp'), /Made with your markers and \d+ you don’t own/);
  assert.equal(await page.$('#sfPhSug'), null, 'no Use N on a photo-made page');
  assert.doesNotMatch(await page.textContent('#sfCtl'), /of sections are a close match|Closer with/);
  // Colour along: the markers you don't own tagged
  await page.click('#sfColor');
  await idle(page);
  const tags = await page.$$eval('#sfCtl .sfarow .sflowtag', (e) =>
    e.map((x) => x.textContent).filter((t) => t === 'not yours'),
  );
  assert.ok(tags.length >= 1, 'not yours, in Colour along');
  assert.deepEqual(errors, []);
});

test('the page step in its markers’ colours: tints while editing, a tap edits only with Edit sections open, tints with a reason when the markers changed', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  const keys = await setKeys(page, 'Honolulu 72');
  await own(page, keys);
  await fromHome(page, { seed: 11 });
  const a = await sectionPx(page);
  assert.equal(a.hex, a.made, 'the section in its marker’s colour');
  assert.equal(await page.$('#sfPpWhy'), null);
  // a tap with Edit sections closed: said, nothing changed
  const st0 = await page.evaluate((l) => __mstest.secState[l], a.l);
  // (where the section is on the screen now: the picture moves as the panel scrolls)
  const tapAt = async () => {
    const box = await page.$eval('#sfCanvas', (c) => {
      c.scrollIntoView({ block: 'center' });
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    await page.mouse.click(box.x + (a.cx / a.W) * box.w, box.y + (a.cy / a.H) * box.h);
  };
  await tapAt();
  await idle(page);
  assert.match(await toastNow(page), /To change the sections, open Edit sections\./);
  assert.equal(await page.evaluate((l) => __mstest.secState[l], a.l), st0, 'not left out');
  // Edit sections open: the tints; a tap leaves the section out
  await page.click('#sfPpTools');
  await idle(page);
  const b = await sectionPx(page);
  assert.notEqual(b.hex, b.made, 'a tint while editing');
  await tapAt();
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.secState[l], a.l), 2, 'left out');
  await page.click('#sfPlanUndo');
  await idle(page);
  await page.click('#sfPpTools');
  await idle(page);
  assert.equal((await sectionPx(page)).hex, a.made, 'its colour again');
  // a marker added to your collection: still as made
  const extra = await page.evaluate((ks) => {
    const all = COLORS.map((c, i) => mkey(i)).filter((k) => !ks.includes(k) && k.startsWith('Ohuhu|'));
    return all[0];
  }, keys);
  await own(page, keys.concat([extra]));
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  assert.equal(
    await page.evaluate(() => __mstest.ppAsMade(__mstest.ppPool())),
    true,
    'a marker added: as made',
  );
  assert.equal(await page.$('#sfPpWhy'), null);
  // one of its markers gone: the tints, and why
  const gone = await page.evaluate((l) => __mstest.pp.made[l], a.l);
  await own(
    page,
    keys.filter((k) => k !== gone),
  );
  await page.evaluate(() => {
    __mstest.renderControls();
    __mstest.render();
  });
  await idle(page);
  assert.match(await page.textContent('#sfPpWhy'), /your markers changed since this page was made/);
  assert.equal(await page.evaluate(() => __mstest.ppStepWhy() !== ''), true);
  assert.deepEqual(errors, []);
});

test('the Photo button on the page step: the photo over the page, off when Edit sections opens; Detail steps seen come back at once', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, await setKeys(page, 'Honolulu 72'));
  await fromHome(page, { seed: 5 });
  assert.notEqual(
    await page.$eval('#sfPhPeek', (b) => getComputedStyle(b).display),
    'none',
    'the Photo button',
  );
  await page.click('#sfPhPeek');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoPeek), true);
  assert.notEqual(await page.$eval('.sfphov', (e) => getComputedStyle(e).display), 'none', 'the photo shown');
  await page.click('#sfPpTools');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.photoPeek), false, 'off with Edit sections open');
  assert.equal(await page.$eval('#sfPhPeek', (b) => getComputedStyle(b).display), 'none');
  await page.click('#sfPpTools');
  await idle(page);
  // Detail: Medium, Simple, Medium again: the same page, at once
  const sig = () =>
    page.evaluate(() => {
      let h = 0;
      const L = __mstest.labels;
      for (let i = 0; i < L.length; i += 7) h = (h * 31 + L[i]) | 0;
      return h + '|' + (__mstest.comps.length - 1);
    });
  const med = await sig();
  const setD = (v) =>
    page.evaluate((v) => {
      const d = document.getElementById('sfPpDet');
      // (as a drag: its pointer down first, and up after; a change without one waits for the next, v329.1)
      d.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      d.value = String(v);
      d.dispatchEvent(new Event('change', { bubbles: true }));
      d.dispatchEvent(new Event('pointerup', { bubbles: true }));
    }, v);
  const t1 = Date.now();
  await setD(1);
  await pageReady(page, 1);
  const fresh = Date.now() - t1;
  await idle(page);
  assert.ok((await page.evaluate(() => __mstest.ppMemN)) >= 2, 'both kept');
  const t0 = Date.now();
  await setD(2);
  await pageReady(page, 2);
  const ms = Date.now() - t0;
  await idle(page);
  assert.equal(await sig(), med, 'the same page as before');
  assert.ok(ms < fresh, 'sooner than one made: ' + ms + ' ms, against ' + fresh + ' ms');
  assert.deepEqual(errors, []);
});

test('Subject only: the background left white and out of the count, kept when Edit sections is used, the crop reusing the subject found, and no clear subject goes back to Even', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, await setKeys(page, 'Honolulu 72'));
  await fromHome(page, { seed: 3, subject: true });
  await answerAsks(page, true);
  await page.click('#sfPpFoc [data-v="subject"]');
  await until(
    page,
    () =>
      __mstest.pp.f === 'subject' &&
      !__mstest.ppBusy &&
      /This page:/.test(document.getElementById('sfPpCount').textContent),
    null,
    'Subject only',
    120000,
  );
  await idle(page);
  const s = await page.evaluate(() => ({
    bgs: __mstest.pp.bgs,
    bg: (__mstest.pp.bgs || []).every((l) => __mstest.comps[l].bg && !__mstest.secState[l]),
    count: document.getElementById('sfPpCount').textContent,
    hint: document.getElementById('sfPpFocHint').textContent,
    made: (__mstest.pp.bgs || []).some((l) => __mstest.pp.made[l]),
  }));
  assert.ok(s.bgs && s.bgs.length >= 1, 'a background');
  assert.ok(s.bg, 'background sections, not counted');
  assert.equal(s.made, false, 'no marker for the background');
  assert.match(s.count, /background left white$/);
  assert.equal(s.hint, 'Leaves the background white, like a colouring book.');
  // Leave out on the background: said, nothing changed
  await page.click('#sfPpTools');
  await idle(page);
  const bgAt = await page.evaluate(() => {
    const L = __mstest.labels,
      b = new Set(__mstest.pp.bgs);
    // (well inside the picture: a tap at its very edge can miss it)
    for (let i = 0; i < L.length; i += 97) {
      const x = i % __mstest.W,
        y = Math.floor(i / __mstest.W);
      if (b.has(L[i]) && x > 40 && y > 40 && x < __mstest.W - 40 && y < __mstest.H - 40)
        return { x, y, l: L[i] };
    }
    return null;
  });
  const box = await page.$eval('#sfCanvas', (c) => {
    c.scrollIntoView({ block: 'center' });
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  const W = await page.evaluate(() => __mstest.W),
    H = await page.evaluate(() => __mstest.H);
  await page.mouse.click(box.x + (bgAt.x / W) * box.w, box.y + (bgAt.y / H) * box.h);
  await idle(page);
  assert.match(await toastNow(page), /The background stays white with Subject only/);
  assert.equal(await page.evaluate((l) => __mstest.secState[l], bgAt.l), 0);
  await page.click('#sfPpTools');
  await idle(page);
  // the crop: the subject's box, the map cropped with the photo (found once), and back with Undo (not found again)
  const found = () => page.evaluate(() => holdLines().filter((l) => /^Subject found/.test(l)).length);
  assert.equal(await found(), 1);
  const pid = await page.evaluate(() => __mstest.ppPrep.pid);
  await page.evaluate(() => __mstest.ppCropSubject());
  await until(
    page,
    (pid) =>
      __mstest.ppPrep &&
      __mstest.ppPrep.pid !== pid &&
      !__mstest.ppBusy &&
      /This page:/.test(document.getElementById('sfPpCount').textContent),
    pid,
    'cropped',
    60000,
  );
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.pp.f), 'subject');
  assert.ok(await page.evaluate(() => !!__mstest.ppPrep.sal), 'the map, cropped');
  assert.equal(await found(), 1, 'not found again for the crop');
  await page.click('#sfPlanUndo');
  await pageReady(page);
  await idle(page);
  assert.equal(await found(), 1, 'nor for Undo of it');
  // a map with no clear subject: Even, said
  await page.click('#sfPpFoc [data-v="even"]');
  await until(page, () => __mstest.pp.f === 'even' && !__mstest.ppBusy, null, 'Even', 60000);
  await idle(page);
  await page.evaluate(() => __mstest.ppPrep.sal.fill(0.02));
  await page.click('#sfPpFoc [data-v="subject"]');
  // (the page made, back at Even: waited for together, as the click's remake may not have started yet on a slow
  // engine, which had read the choice before it went back)
  await until(
    page,
    () =>
      !__mstest.ppBusy &&
      __mstest.pp.f === 'even' &&
      /This page:/.test(document.getElementById('sfPpCount').textContent),
    null,
    'made, back at Even',
    60000,
  );
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.pp.f), 'even');
  assert.deepEqual(errors, []);
});

test('Remake to use your newer markers: said for markers you didn’t have when the page was made, not for the ones it didn’t use', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  // made with a few, then more bought: those are newer, and said
  await own(page, (await setKeys(page, 'Honolulu 24')).slice(0, 4));
  await fromHome(page, { seed: 7 });
  await helpLine(page, /Your \d+ markers? match(es)? \d+% of this photo\./);
  await own(page, await setKeys(page, 'Honolulu 72'));
  await page.evaluate(() => __mstest.renderControls());
  const t = await helpLine(page, /Your newer markers match more of it \(\d+% as made, \d+% now\)/);
  assert.match(t, /Remake to use them/);
  // remade with them: the page uses some of the set, and the rest aren't newer (v326 as first built had said so)
  await page.click('#sfPpHelp [data-pp="new"]');
  await until(page, () => !__mstest.ppBusy && __mstest.pp.sig.split(',').length > 60, null, 'remade', 60000);
  await pageReady(page);
  await idle(page);
  // (its numbers in: on the step the line shows only with markers to suggest)
  await until(page, () => !!(__mstest.ppFill && __mstest.ppFill.res), null, 'the numbers', 30000);
  const r = await page.evaluate(() => ({ own: __mstest.ppFill.res.own, made: __mstest.ppFill.res.made }));
  assert.equal(r.made, -1, 'nothing newer to work out: ' + JSON.stringify(r));
  const used = await page.evaluate(() => new Set(Object.values(__mstest.pp.made)).size);
  assert.ok(used < 72, 'the page uses some of the set: ' + used);
  await page.waitForTimeout(500);
  assert.doesNotMatch(await page.textContent('#sfPpHelp'), /newer markers/);
  assert.deepEqual(errors, []);
});

test('markers to add from a brand you don’t have carry its letter: a Copic list never reads as your Ohuhu codes', async () => {
  const { page, errors } = await openApp(VIEW);
  await idle(page);
  await own(page, (await setKeys(page, 'Honolulu 24')).slice(0, 4));
  await page.evaluate(() => {
    state.buyBrands = ['Copic'];
  });
  await fromHome(page, { seed: 7 });
  await helpLine(page, /Adding .* would make it \d+%/);
  const chips = await page.$$eval('#sfPpHelp .wishchip', (b) =>
    b.map((x) => [x.getAttribute('data-wk'), x.textContent.trim()]),
  );
  assert.ok(chips.length >= 1);
  const tag = await page.evaluate(() => bTag('Copic'));
  chips.forEach(([k, t]) => {
    assert.equal(k.split('|')[0], 'Copic', 'from Brands I’d buy: ' + k);
    assert.ok(t.startsWith(tag + ' '), 'its brand’s letter: ' + t);
  });
  assert.deepEqual(errors, []);
});

test('v327.1: a colouring page from any photo is a button, under the colouring page one, on Home (phone and iPad) and the Guide screen’s start card, each opening the photo picker', async () => {
  for (const vp of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
  ]) {
    const { page, ctx, errors } = await openApp({ ...vp, storage: ONBOARDED });
    await answerAsks(page, true);
    await idle(page);
    const b = page.locator('[data-start="ppage"]:visible').first();
    assert.equal(await b.textContent(), 'Make a colouring page from any photo', vp.width + ': Home');
    assert.match(await b.getAttribute('class'), /btn-primary/, 'a button, not a link');
    // (under the colouring page button: second in the start area's order)
    const order = await page.evaluate(() => {
      const all = [...document.querySelectorAll('#homeView button')].filter((e) => e.offsetParent);
      return [
        all.findIndex(
          (e) => /colouring page$/.test(e.textContent.trim()) && !e.dataset.start?.startsWith('pp'),
        ),
        all.findIndex((e) => e.dataset.start === 'ppage'),
      ];
    });
    assert.ok(order[0] >= 0 && order[1] === order[0] + 1, 'straight after it: ' + order);
    const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), b.click()]);
    assert.ok(fc, 'the photo picker');
    // the Guide screen's start card
    await page.click('#mSections');
    await idle(page);
    assert.equal(await page.textContent('#sfPpPick'), 'Make a colouring page from any photo');
    assert.equal(await page.$('#sfStPp'), null, 'the old line gone');
    const [fc2] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      page.click('#sfPpPick'),
    ]);
    assert.ok(fc2);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
