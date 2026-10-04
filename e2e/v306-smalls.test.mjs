// v306 small changes: find by code for a code that's only a highlight or shadow in the guide; "Did any run low?" ›
// Another… says when a marker is already marked (and Escape clears, then closes, its box); the run-low chips follow
// a change to a marker made while they show; the shorter untick toast; a guide smoothed with shading on reopens as
// saved.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// the sample at one marker per section from Ben's 451
async function benGuide(page) {
  await sampleGuide(page);
  await idle(page);
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    save();
    SF.setCollection(sfCollection());
    __mstest.styleVars.limitN = 999;
    SF.reassign();
  });
  await idle(page);
}
const along = async (page) => {
  await page.click('#sfColor');
  await idle(page);
};
const rowKeys = (page) => page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => r.dataset.k));
async function finishInList(page) {
  await along(page);
  const k = await page.evaluate(() => {
    const t = __mstest,
      k = t.assignData.assign[t.assignData.order[0]].mkey;
    t.assignData.order.forEach((l) => {
      if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
    });
    t.updateProgress();
    return k;
  });
  await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
  await idle(page);
  await page.click('#sfMarkAll');
  await idle(page);
}

// ---- find by code: only a highlight or shadow here ----

test('find by code: a code that’s only a highlight here, in both brands, says what each goes with and shows those markers’ rows (it asked “Two …s: which is in your hand?” with no row of its own)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benGuide(page);
  // two markers, one of each brand, whose highlights share a code no section has: given to a few sections each
  const s = await page.evaluate(() => {
    const t = __mstest;
    t.shadeMode = 'full';
    const A = t.assignData.assign,
      ls = t.assignData.order.slice(1),
      zs = t.zshOf(ls[0]),
      by = {};
    for (const m of t.coll) {
      const x = t.shadeTones(m, zs).light;
      if (x) ((by[x.code] ||= {})[x.brand] ||= []).push(m);
    }
    for (const q in by) {
      if (!by[q].Ohuhu || !by[q].Copic) continue;
      const mO = by[q].Ohuhu[0],
        mC = by[q].Copic[0];
      const keep = ls.slice(6).map((l) => A[l]);
      if (keep.some((m) => m.code === q || m.code === mO.code || m.code === mC.code)) continue;
      ls.slice(0, 3).forEach((l) => (A[l] = mO));
      ls.slice(3, 6).forEach((l) => (A[l] = mC));
      t.renderGuide();
      return { q, o: mO.mkey, oc: mO.code, c: mC.mkey, cc: mC.code };
    }
    return null;
  });
  assert.ok(s, 'such a pair');
  await along(page);
  await page.fill('#sfFindIn', s.q.toLowerCase());
  await page.press('#sfFindIn', 'Enter');
  await idle(page);
  assert.equal(
    await page.textContent('#sfFindL'),
    `${s.q} is a highlight here: Copic for ${s.cc} · Ohuhu for ${s.oc}`,
  );
  assert.deepEqual((await rowKeys(page)).sort(), [s.c, s.o].sort(), 'the rows of the markers it goes with');
  assert.match(await page.textContent('#sfLive'), new RegExp('^' + s.q + ' is a highlight here'));
  assert.deepEqual(errors, []);
});

test('find by code: a code that’s only a highlight or shadow in one brand says “… is a highlight for …” on Return', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await benGuide(page);
  const p = await page.evaluate(() => {
    const t = __mstest;
    t.shadeMode = 'full';
    const A = t.assignData.assign,
      bases = new Set(Object.values(A).map((m) => m.code)),
      P = {};
    for (const l in A) {
      const s = t.shadeSec(+l);
      if (!s) continue;
      for (const [k, x] of [
        ['highlight', s.light],
        ['shadow', s.dark],
      ])
        if (x && !bases.has(x.code))
          (((P[x.code] ||= { k: {}, b: new Set(), m: new Set() }).k[k] ||= new Set()).add(A[l].code),
            P[x.code].b.add(x.brand),
            P[x.code].m.add(A[l].mkey));
    }
    for (const q in P)
      if (P[q].b.size === 1 && Object.keys(P[q].k).length === 1) {
        const k = Object.keys(P[q].k)[0];
        return { q, k, bases: [...P[q].k[k]], rows: [...P[q].m] };
      }
    return null;
  });
  assert.ok(p, 'a highlight or shadow that isn’t a base anywhere');
  await along(page);
  await page.fill('#sfFindIn', p.q);
  await page.press('#sfFindIn', 'Enter');
  await idle(page);
  const line = await page.textContent('#sfFindL');
  assert.ok(line.startsWith(`${p.q} is a ${p.k} for `), line);
  for (const b of p.bases.slice(0, 4)) assert.ok(line.includes(b), b + ' in ' + line);
  assert.deepEqual((await rowKeys(page)).sort(), p.rows.sort());
  assert.deepEqual(errors, []);
});

// ---- Did any run low? › Another… ----

test('run low: Another… says “… is already marked low” or “… is dry” for one already marked, and keeps the box; Escape clears the box, then closes it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
  await benGuide(page);
  await finishInList(page);
  await page.evaluate(() => {
    state.ink['Ohuhu|R310'] = 'low';
    state.ink['Ohuhu|G410'] = 'dry';
    save();
  });
  await page.click('#sfLowA [data-lmore]');
  await idle(page);
  await page.keyboard.type('r310');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.textContent('#sfLowLA'), 'Ohuhu R310 is already marked low');
  assert.match(await page.textContent('#sfLive'), /Ohuhu R310 is already marked low/);
  assert.equal(
    await page.getAttribute('#sfLowA [data-lk="Ohuhu|R310"]', 'aria-pressed'),
    'true',
    'its chip, on',
  );
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfLowInA', 'the box stays for another');
  assert.equal(await page.inputValue('#sfLowInA'), '');
  assert.deepEqual(
    await page.evaluate(() => ({ ink: state.ink['Ohuhu|R310'], wish: state.wish.length })),
    { ink: 'low', wish: 0 },
    'nothing changed',
  );
  await page.keyboard.type('g410');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.textContent('#sfLowLA'), 'Ohuhu G410 is dry');
  // Escape: the code first, then the box, focus back on Another…; Colour along stays
  await page.keyboard.type('b0');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.inputValue('#sfLowInA'), '');
  assert.equal(await page.textContent('#sfLowLA'), '');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$$eval('#sfLowA form', (f) => f.length), 0, 'closed');
  assert.equal(await page.getAttribute('#sfLowA [data-lmore]', 'aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.lmore), '1');
  assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
  assert.deepEqual(errors, []);
});

test('run low: the chips follow a marker marked running low or dry while the finished page shows', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820, storage: { 'ms-wake-told': '1' } });
  await benGuide(page);
  await finishInList(page);
  const top = await page.evaluate(() => [...__mstest.lowTop()]);
  const pressed = (k) => page.getAttribute(`#sfLowA [data-lk="${k}"]`, 'aria-pressed');
  assert.equal(await pressed(top[0]), 'false');
  // the marker's details (as from Markers in another tab): Running low
  await page.evaluate((k) => setInk(keyIdx(k), 'low'), top[0]);
  await idle(page);
  assert.equal(await pressed(top[0]), 'true');
  // dry: no longer a button
  await page.evaluate((k) => setInk(keyIdx(k), 'dry'), top[1]);
  await idle(page);
  assert.equal(await page.$$eval(`#sfLowA button[data-lk="${top[1]}"]`, (b) => b.length), 0);
  // a code being typed in Another…'s box stays
  await page.click('#sfLowA [data-lmore]');
  await idle(page);
  await page.keyboard.type('r3');
  await page.evaluate((k) => setInk(keyIdx(k), ''), top[0]);
  await idle(page);
  assert.equal(await pressed(top[0]), 'false');
  assert.equal(await page.inputValue('#sfLowInA'), 'r3');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sfLowInA');
  assert.deepEqual(errors, []);
});

// ---- the untick toast ----

test('the untick toast: “Removed Copic BG0000”, one line at 390 with Undo', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844 });
  await page.evaluate(() => {
    state.owned = new Set(defaultOwned());
    state.owned.add('Copic|BG0000');
    state.mode = 'collection';
    save();
  });
  await page.reload();
  await idle(page);
  if (await page.isVisible('#mCollection')) await page.click('#mCollection');
  await idle(page);
  await page.fill('#q', 'BG0000');
  await idle(page);
  const i = await page.evaluate(() => keyIdx('Copic|BG0000'));
  await page.click(`#results .cell[data-i="${i}"]`);
  await idle(page);
  assert.equal(
    await page.evaluate(() => document.getElementById('msToast').textContent.replace(/\s*Undo$/, '')),
    'Removed Copic BG0000',
  );
  const lines = await page.evaluate(() => {
    const r = document.createRange();
    r.selectNodeContents(document.getElementById('msToast'));
    return new Set(
      [...r.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top + q.height / 2)),
    ).size;
  });
  assert.equal(lines, 1, 'one line');
  await page.click('#toastAct');
  await idle(page);
  assert.equal(await page.evaluate((i) => isOwned(i), i), true, 'Undo: yours again');
  assert.deepEqual(errors, []);
});

// ---- a smoothed, shaded guide reopens as saved ----

test('a guide smoothed with shading on reopens with its markers exactly as saved, one the fix now leaves out too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await benGuide(page);
  const r = await page.evaluate(() => {
    const t = __mstest;
    t.shadeMode = 'full';
    t.styleVars.gradFix = true;
    SF.reassign();
    const d = t.currentDesignObj(),
      p = JSON.parse(JSON.stringify(d.payload)),
      A = t.assignData.assign;
    // as an earlier build may have smoothed it: a section given the other brand of a highlight's code
    let put = null;
    for (const l of t.assignData.order.slice(1)) {
      const s = t.shadeSec(l),
        x = s && s.light;
      if (!x) continue;
      const o = t.coll.find((m) => m.code === x.code && m.brand !== x.brand);
      if (o && !Object.values(A).some((m) => m.mkey === o.mkey)) {
        const l2 = t.assignData.order.find((q) => q !== l && q !== t.assignData.order[0]);
        p.assign[l2] = o.mkey;
        put = o.mkey;
        break;
      }
    }
    t.openDesignObj(Object.assign({}, p, { name: 'Smoothed', W: d.W, H: d.H }), null);
    return { want: p.assign, put };
  });
  await idle(page);
  assert.ok(r.put, 'a marker to put in');
  const got = await page.evaluate(() => {
    const A = __mstest.assignData.assign,
      o = {};
    for (const l in A) o[l] = A[l].mkey;
    return o;
  });
  assert.deepEqual(got, r.want);
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradFix), true);
  assert.deepEqual(errors, []);
});

test('on a phone the code box folds behind ⌕ in the order row, so the first rows show above the bar; ✕ folds it again', async () => {
  for (const [w, h] of [
    [390, 844],
    [375, 667],
  ]) {
    const { page, errors } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const vis = (s) =>
      page.evaluate((s) => {
        const e = document.querySelector(s);
        return !!e && e.offsetParent !== null;
      }, s);
    assert.equal(await vis('#sfFindIn'), false, `${w}: folded`);
    assert.equal(await page.getAttribute('#sfFindOpen', 'aria-expanded'), 'false');
    const ok = await page.evaluate(() => {
      const r = document.querySelector('#sfAlist .sfarow').getBoundingClientRect(),
        b = document.querySelector('#sfWork>.sfbar').getBoundingClientRect();
      return r.bottom <= b.top + 0.5;
    });
    assert.ok(ok, `${w}×${h}: the first row is above the bar`);
    await page.click('#sfFindOpen');
    assert.equal(await vis('#sfFindIn'), true, 'open');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFindIn', 'and in the box');
    await page.keyboard.type('YG211');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await vis('#sfFindIn'), true, 'stays open with a search');
    await page.click('#sfFindX');
    await idle(page);
    assert.equal(await vis('#sfFindIn'), false, '✕ folds it');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFindOpen');
    // the order row's choices still work beside it
    await page.click('#sfAlSort [data-v="rainbow"]');
    assert.equal(await page.getAttribute('#sfAlSort [data-v="rainbow"]', 'aria-pressed'), 'true');
    assert.equal(await page.getAttribute('#sfFindOpen', 'aria-pressed'), null);
    assert.deepEqual(errors, []);
  }
  // an iPad keeps the box open
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await page.click('#sfColor');
  await idle(page);
  assert.equal(await page.isVisible('#sfFindIn'), true);
  assert.equal(await page.isVisible('#sfFindOpen'), false);
  assert.deepEqual(errors, []);
});
