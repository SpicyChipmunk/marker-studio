// v306, the Gradient's colours: the Scatter slider (Polished, Natural, Textured, Sparkle, Confetti), "all" on a page
// with more sections than clear markers (U6's label), shading-aware picks offered in the Shading tab (U7), and rough
// spots with "Smooth them".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const keys = (page) =>
  page.evaluate(() => {
    const a = __mstest.assignData;
    return a.order.map((l) => a.assign[l].mkey);
  });
// each section's marker, by section number; the markers used
const bySec = (page) =>
  page.evaluate(() => {
    const A = __mstest.assignData.assign;
    return Object.keys(A)
      .sort((a, b) => a - b)
      .map((l) => l + ':' + A[l].mkey);
  });
const used = (k) => [...new Set(k)].sort();
const tab = async (page, t) => {
  await page.click(`.sftabbtn[data-t="${t}"]`);
  await idle(page);
};
const slide = (page, id, v) =>
  page.evaluate(
    ([id, v]) => {
      const el = document.getElementById(id);
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [id, v],
  );
const undoLabel = () => __mstest.planLabel;
// Ben's own 451 markers, the count at all of them (the sample has 166 sections: one marker each)
const bens = async (page) => {
  await page.evaluate(() => {
    const t = __mstest;
    state.owned = new Set(defaultOwned());
    save();
    t.coll = sfCollection();
    t.styleVars.limitN = 999;
    t.reassign();
  });
  await idle(page);
};

test('Scatter: five stops under Look, each one Undo step that says which; its line says what it does; below 9 markers it is off and says why', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'pattern');
  // (Radial, so Auto's note shows under Look)
  await page.click('#sfShape [data-v="radial"]');
  await idle(page);
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#sfLook, #sfLookNote, #sfGradScat')].map((e) => e.id),
  );
  assert.deepEqual(
    order,
    ['sfLook', 'sfLookNote', 'sfGradScat'],
    'the Look note stays under Look, Scatter after it',
  );
  assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
  // (v308: Polished has its line too)
  assert.equal(await page.textContent('#sfGradScatNote'), 'Neat bands in flow order');
  const names = ['Polished', 'Natural', 'Textured', 'Sparkle', 'Confetti'];
  let prev = await keys(page);
  for (let v = 1; v <= 4; v++) {
    const n = await page.evaluate(() => __mstest.planCount);
    await slide(page, 'sfGradScat', v);
    await idle(page);
    assert.equal(await page.textContent('#sfGradScatName'), names[v]);
    assert.equal(await page.getAttribute('#sfGradScat', 'aria-valuetext'), names[v]);
    assert.ok(await page.isVisible('#sfGradScatNote'), names[v] + ': its line');
    assert.equal(await page.evaluate(() => __mstest.planCount), n + 1, names[v] + ': one step');
    assert.equal(await page.evaluate(undoLabel), 'Scatter: ' + names[v]);
    const k = await keys(page);
    assert.notDeepEqual(k, prev, names[v] + ': laid again');
    prev = k;
    if (v >= 2)
      assert.match(
        await page.textContent('#sfLookNote'),
        /Scatter places them\.$/,
        names[v] + ': the Look note',
      );
  }
  assert.equal(
    await page.textContent('#sfGradScatNote'),
    'Colours stray further: confetti close up, a rainbow from afar',
  );
  // Undo goes back a stop
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.textContent('#sfGradScatName'), 'Sparkle');
  // 8 markers: off, Polished, and why
  await tab(page, 'colours');
  await slide(page, 'sfMkCount', 8);
  await idle(page);
  await tab(page, 'pattern');
  assert.equal(await page.isDisabled('#sfGradScat'), true);
  assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
  assert.equal(await page.textContent('#sfGradScatNote'), 'Scatter needs 9 or more markers in this guide.');
  assert.equal(await page.evaluate(() => __mstest.grad.scattered), null, 'laid as Polished');
  assert.deepEqual(errors, []);
});

test('Scatter: Shuffle at Textured and up mixes again but keeps the Start colour; at Polished it turns the start as before', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'pattern');
  const state = () =>
    page.evaluate(() => ({
      seed: __mstest.styleVars.gradSeed,
      jit: __mstest.styleVars.gradJit,
      start: document.getElementById('sfGStart') && document.getElementById('sfGStart').value,
    }));
  // Polished: Shuffle turns the start (gradSeed)
  const p0 = await state();
  await page.click('#sfVary');
  await idle(page);
  const p1 = await state();
  assert.notEqual(p1.seed, p0.seed, 'Polished: a new start');
  assert.equal(p1.jit, p0.jit);
  // Sparkle: only the scatter's seed
  await slide(page, 'sfGradScat', 3);
  await idle(page);
  const s0 = await state(),
    k0 = await keys(page);
  for (let i = 0; i < 3; i++) {
    await page.click('#sfVary');
    await idle(page);
    const s1 = await state(),
      k1 = await keys(page);
    assert.equal(s1.seed, s0.seed, 'the Start colour’s seed kept');
    assert.equal(s1.start, s0.start, 'the Start colour slider where it was');
    assert.notEqual(s1.jit, s0.jit);
    assert.notDeepEqual(k1, k0, 'mixed again');
    assert.equal(k1[0], k0[0], 'the first section keeps the Start colour');
    assert.deepEqual(used(k1), used(k0), 'the same markers');
    assert.equal(await page.evaluate(undoLabel), 'Colours shuffled');
  }
  assert.deepEqual(errors, []);
});

test('Scatter: a guide saved at each stop reopens exactly as it was saved, after a reload; a new picture starts at Polished', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'pattern');
  const saved = [];
  for (let v = 0; v <= 4; v++) {
    if (v) {
      await slide(page, 'sfGradScat', v);
      await idle(page);
    }
    await page.evaluate((v) => {
      __mstest.curName = 'Scatter ' + v;
    }, v);
    await saveGuide(page);
    saved.push({
      id: await page.evaluate(() => __mstest.curId),
      keys: await bySec(page),
      style: await page.evaluate(() => __mstest.currentDesignObj().payload.style),
    });
    // (each stop a guide of its own)
    if (v < 4) {
      await page.evaluate(() => {
        const d = __mstest.currentDesignObj();
        __mstest.openDesignObj(Object.assign({}, d.payload, { name: 'next', W: d.W, H: d.H }), null);
      });
      await page.waitForFunction(() => __mstest.curName === 'next' && __mstest.assignData);
      await idle(page);
      await tab(page, 'pattern');
    }
  }
  // what is written: nothing at Polished, then the stop, and its seed from Textured
  assert.deepEqual(
    saved.map((s) => [s.style.gradScat, s.style.gradJit]),
    [
      [undefined, undefined],
      [1, undefined],
      [2, 0],
      [3, 0],
      [4, 0],
    ],
  );
  await page.reload();
  await idle(page);
  for (const s of saved) {
    await page.evaluate((id) => loadGuide({ id }), s.id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, s.id, {
      timeout: 10000,
    });
    await idle(page);
    assert.deepEqual(await bySec(page), s.keys, 'reopened as saved: ' + s.id);
    assert.equal(await page.evaluate(() => __mstest.styleVars.gradScat), s.style.gradScat || 0);
  }
  // a new picture: Polished
  await page.evaluate(() => SF.loadSample());
  await page.waitForFunction(() => __mstest.assignData && __mstest.curId == null);
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => [
      __mstest.styleVars.gradScat,
      __mstest.styleVars.gradJit,
      __mstest.styleVars.gradFix,
    ]),
    [0, 0, false],
  );
  await tab(page, 'pattern');
  assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
  assert.deepEqual(errors, []);
});

test('Scatter: moving the sun never lays a scattered guide again (a Polished one in bands still turns to face it)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'pattern');
  await page.click('#sfShape [data-v="vertical"]');
  await idle(page);
  await page.click('#sfLook [data-v="ltd"]');
  await idle(page);
  const sunMoved = async () => {
    await tab(page, 'shading');
    await page.click('#sfShade [data-v="full"]');
    await idle(page);
    const k0 = await keys(page);
    // the sun to the other side, and the shading turned off and on, which faces the bands to it
    await page.evaluate(() => {
      __mstest.shadeSun = { x: 0.5, y: 0.95 };
    });
    await page.click('#sfShade [data-v="off"]');
    await idle(page);
    await page.click('#sfShade [data-v="full"]');
    await idle(page);
    const k1 = await keys(page);
    await page.click('#sfShade [data-v="off"]');
    await idle(page);
    await page.evaluate(() => {
      __mstest.shadeSun = { x: 0.2, y: 0.12 };
    });
    await tab(page, 'pattern');
    return [k0, k1];
  };
  const [p0, p1] = await sunMoved();
  assert.notDeepEqual(p1, p0, 'Polished: its bands turned to face the light');
  await slide(page, 'sfGradScat', 3);
  await idle(page);
  const [s0, s1] = await sunMoved();
  assert.deepEqual(s1, s0, 'Sparkle: kept as it was');
  assert.deepEqual(errors, []);
});

test('U6: the marker count says how many the Gradient lays (v308: “all · 130”, Ben’s vivid markers); more sections than markers left: “all · N”, no greys', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await bens(page);
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  assert.equal(await page.textContent('#sfMkNlbl'), 'all · 130');
  // (v308: the slider ends at the 130 left: 300 is all)
  await slide(page, 'sfMkCount', 300);
  await idle(page);
  assert.equal(await page.textContent('#sfMkNlbl'), 'all · 130');
  // Honolulu 120's clear markers: fewer than the sample's sections
  await page.evaluate(() => {
    const t = __mstest;
    state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')));
    save();
    t.coll = sfCollection();
    t.styleVars.limitN = 999;
    t.reassign();
  });
  await idle(page);
  const r = await page.evaluate(() => {
    const t = __mstest,
      A = t.assignData.assign,
      ks = new Set(t.assignData.order.map((l) => A[l].mkey));
    return {
      lbl: document.getElementById('sfMkNlbl').textContent,
      n: ks.size,
      dull: t.assignData.order.filter((l) => t.colour.lch(A[l])[1] < 20).length,
      cnt: t.grad.countNow(),
    };
  });
  assert.ok(r.cnt.all && r.cnt.M < 166, JSON.stringify(r.cnt));
  assert.equal(r.lbl, 'all · ' + r.cnt.M);
  assert.equal(r.n, r.cnt.M);
  assert.equal(r.dull, 0, 'no greys or dull browns');
  assert.deepEqual(errors, []);
});

test('U7: turning shading on doesn’t pick other markers; the note offers “Pick shadeable ones”, one Undo step, then it’s gone', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  // (Honolulu 120 at 16 markers: 13 of the sample's 16 shade)
  const k0 = await keys(page);
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="full"]');
  await idle(page);
  assert.deepEqual(await keys(page), k0, 'shading on: the same markers');
  // (v308: 11 of the new guide's 16 vivid markers; 13 of v307's)
  assert.match(
    await page.textContent('.sfshnote .sfonelh'),
    /^11 of 16 can be shaded · Pick shadeable onesShow$/,
  );
  await page.click('#sfShPickGo');
  await idle(page);
  const k1 = await keys(page);
  assert.notDeepEqual(k1, k0);
  assert.equal(await page.evaluate(undoLabel), 'Shadeable markers picked');
  assert.equal(await page.locator('#sfShPickGo').count(), 0, 'gone once picked');
  const ok = await page.evaluate(() => {
    const t = __mstest,
      A = t.assignData.assign,
      ms = [...new Set(t.assignData.order.map((l) => A[l]))];
    return ms.filter((m) => t.grad.shadeOK(m)).length;
  });
  // (v308: 14 of the 16, picked from Honolulu 120's vivid markers; 16 from v307's wider pool)
  assert.equal(ok, 14);
  // Undo: back as it was, and the offer with it
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.deepEqual(await keys(page), k0);
  // a gradient in bands that turns to face the light when shading goes on keeps the markers it had
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="off"]');
  await idle(page);
  await tab(page, 'pattern');
  await page.click('#sfShape [data-v="vertical"]');
  await idle(page);
  await page.click('#sfLook [data-v="ltd"]');
  await idle(page);
  const b0 = await keys(page);
  await page.evaluate(() => {
    __mstest.shadeSun = { x: 0.5, y: 0.95 };
  });
  await tab(page, 'shading');
  await page.click('#sfShade [data-v="full"]');
  await idle(page);
  const b1 = await keys(page);
  assert.notDeepEqual(b1, b0, 'turned to face the light');
  assert.deepEqual(used(b1), used(b0), 'with the same markers');
  assert.deepEqual(errors, []);
});

test('rough spots: at Polished with markers to spare, rings and “N rough spots · Smooth them”; one Undo step; never a grey or a second of a code; kept by Shuffle', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  // (v308: a new guide's "all" from Ben's 451 is his 130 vivid markers, fewer than the sample's 166 sections, so none
  // to spare: a guide from before v308, with all 451 in play, has them)
  await page.evaluate(() => {
    __mstest.styleVars.gradIncl = null;
  });
  await bens(page);
  // (the first-time "Tap a section" line has the slot under the tabs first)
  await tab(page, 'pattern');
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  const n0 = await page.evaluate(() => __mstest.grad.roughNow().pairs.length);
  assert.ok(n0 >= 10, n0 + ' rough spots');
  assert.equal(await page.textContent('#sfRough span'), n0 + ' rough spots ·');
  assert.equal(await page.locator('.sfroughs .sfring').count(), n0);
  const A0 = await page.evaluate(() => {
    const A = __mstest.assignData.assign;
    return Object.fromEntries(Object.keys(A).map((l) => [l, A[l].mkey]));
  });
  await page.click('#sfRoughGo');
  await idle(page);
  assert.equal(await page.evaluate(undoLabel), 'Rough spots smoothed');
  const r = await page.evaluate((A0) => {
    const t = __mstest,
      A = t.assignData.assign,
      changed = Object.keys(A).filter((l) => A[l].mkey !== A0[l]),
      by = {};
    for (const l in A) (by[A[l].code] = by[A[l].code] || new Set()).add(A[l].mkey);
    return {
      changed: changed.length,
      added: changed.map((l) => {
        const x = t.colour.lch(A[l]);
        return [A[l].code, x[0], x[1]];
      }),
      twins: Object.keys(by).filter((c) => by[c].size > 1),
      left: t.grad.roughNow().pairs.length,
      first: A[t.assignData.order[0]].mkey === A0[t.assignData.order[0]],
    };
  }, A0);
  assert.ok(r.changed > 0 && r.left < n0 / 2, `${n0} -> ${r.left}`);
  for (const [code, L, C] of r.added) assert.ok(C >= 20 && L >= 34 && L <= 90, code + ' is a clear colour');
  assert.ok(r.first, 'the Start colour kept');
  const tw0 = await page.evaluate((A0) => {
    const by = {};
    for (const l in A0) {
      const m = __mstest.coll.find((x) => x.mkey === A0[l]);
      (by[m.code] = by[m.code] || new Set()).add(m.mkey);
    }
    return Object.keys(by).filter((c) => by[c].size > 1);
  }, A0);
  assert.deepEqual(
    r.twins.filter((c) => !tw0.includes(c)),
    [],
    'no second of a code',
  );
  // nothing left it can do: no line, no rings
  assert.equal(await page.locator('#sfRough').count(), 0);
  assert.equal(await page.locator('.sfroughs .sfring').count(), 0);
  // saved with the guide, and kept through Shuffle
  assert.equal((await page.evaluate(() => __mstest.currentDesignObj().payload.style)).gradFix, true);
  await page.click('#sfVary');
  await idle(page);
  assert.ok(
    await page.evaluate(() => __mstest.grad.fixed && __mstest.grad.fixed.swaps.length > 0),
    'smoothed again after Shuffle',
  );
  await page.keyboard.press('Control+z');
  await idle(page);
  // Undo the smoothing: the rings come back
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.styleVars.gradFix), false);
  assert.equal(await page.locator('.sfroughs .sfring').count(), n0);
  // at Natural: none
  await slide(page, 'sfGradScat', 1);
  await idle(page);
  assert.equal(await page.locator('#sfRough').count(), 0);
  assert.equal(await page.locator('.sfroughs .sfring').count(), 0);
  // ✕ closes the line and the rings until the guide changes
  await slide(page, 'sfGradScat', 0);
  await idle(page);
  await page.click('#sfRoughX');
  await idle(page);
  assert.equal(await page.locator('#sfRough').count(), 0);
  assert.equal(await page.locator('.sfroughs .sfring').count(), 0);
  assert.deepEqual(errors, []);
});

test('rough spots: none with the marker count below all your markers (a guide of 16 stays 16)', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await tab(page, 'pattern');
  await page.evaluate(() => __mstest.renderControls());
  await idle(page);
  assert.equal(await page.evaluate(() => __mstest.grad.roughNow().ids.length), 0);
  assert.equal(await page.locator('#sfRough').count(), 0);
  assert.deepEqual(errors, []);
});
