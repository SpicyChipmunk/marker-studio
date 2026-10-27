// Speed and the worker: redraws, jobs, controls wiring.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGINE,
  ROOT,
  answerAsks,
  buildGo,
  haveSet,
  idle,
  openApp,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
} from './helpers.mjs';
import { CTL_INIT, SESSIONS, choose, click, slide } from './controls-states.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from controls-wiring.test.mjs ----
// The guide's controls (js/guide/50-53): every state of the broad set in e2e/controls-states.mjs renders without an
// error and wires each of its controls every time it is drawn, and the few controls no other test uses (the saved
// palette picker, Tilt, Sensitivity, Join the ends of a loop, focus mode's colour list) do what they say.
// (scripts/controls-compare.mjs uses the same states to compare the controls' markup, wiring and styles with an
// earlier version of the code.)
{
  // each control and the events its handlers listen for
  const WIRED = {
    // Plan: Colours
    sfSrc: ['click'],
    sfHarm: ['change'],
    sfPalPick: ['change'],
    sfPal: ['click'],
    sfTheme: ['click'],
    sfMood: ['click'],
    sfMkCount: ['input', 'change'],
    sfExpand: ['change'],
    sfExpChar: ['input', 'change'],
    sfFiltToggle: ['click'],
    // (v308: the count's − and +, held down to keep going, the count to type one, and the Include row)
    sfMkMinus: ['pointerdown', 'pointerup', 'click'],
    sfMkPlus: ['pointerdown', 'pointerup', 'click'],
    sfMkNum: ['click'],
    sfIncl: ['click'],
    // Pattern
    sfFam: ['click'],
    sfShape: ['click'],
    sfDir: ['click'],
    sfGStart: ['input', 'change'],
    sfLook: ['click'],
    sfShuffle: ['click'],
    sfVary: ['click'],
    sfLock: ['click'],
    sfNoAdj: ['change'],
    sfResetA: ['click'],
    sfSpread: ['input', 'change'],
    sfMix: ['click'],
    sfPaint: ['click'],
    sfBrush: ['click'],
    sfFillAll: ['click'],
    sfPhPick: ['click'],
    sfPhAlign: ['click'],
    sfPhAuto: ['click'],
    sfPhFit: ['click'],
    sfPhOp: ['input'],
    sfPhRough: ['change'],
    sfPhPaper: ['change'],
    // Shading
    sfShade: ['click'],
    sfShLight: ['click'],
    sfHiStyle: ['change'],
    sfShStyle: ['change'],
    sfRound: ['input', 'change'],
    sfShHi: ['input', 'change'],
    sfShLo: ['input', 'change'],
    sfShLines: ['change'],
    sfShFlat: ['click'],
    sfShNoteT: ['click'],
    sfTex: ['change', 'input'],
    // Share and the bar
    sfReveal: ['click'],
    sfExport: ['click'],
    sfPrint: ['click'],
    sfPlan: ['click'],
    sfAsPal: ['click'],
    sfShareGuide: ['click'],
    sfBack2: ['click'],
    sfColor: ['click'],
    // focus mode
    sfExitFoc: ['click'],
    sfFocCols: ['click'],
    sfFocAll: ['click'],
    sfToneSteps: ['change'],
    sfFocMk: ['click'],
    // crop
    sfCropApply: ['click'],
    sfCropReset: ['click'],
    sfCropCancel: ['click'],
    // Edit sections
    sfPgUndo: ['click'],
    sfPgAdj: ['click'],
    sfAdjToggle: ['click'],
    sfRotL: ['click'],
    sfRotR: ['click'],
    sfPgOpen: ['click'],
    sfCrop: ['click'],
    sfAutoCrop: ['click'],
    sfEnh: ['change'],
    sfTilt: ['input'],
    sfSens: ['input'],
    sfMin: ['input'],
    sfBg: ['input'],
    sfEmToggle: ['click'],
    sfEmMerge: ['click'],
    sfEmSplit: ['click'],
    sfEmAdd: ['click'],
    sfAutoClose: ['change'],
    sfBuild: ['click'],
  };
  test('every state of the controls renders without an error, and each drawing of them wires every control in it', async () => {
    let states = 0,
      drawn = 0,
      checked = 0;
    const seen = new Set();
    for (const ses of SESSIONS) {
      const { page, errors } = await openApp({ init: CTL_INIT, storage: ses.storage });
      await idle(page);
      const cap = async (name) => {
        const r = await page.evaluate(() => window.__ctlTake());
        states++;
        if (!r.writes.length) return;
        drawn++;
        // the controls as last drawn, and the listeners added after that
        const n = r.writes.length,
          html = r.writes[n - 1],
          after = r.listen.filter((x, i) => r.listenAt[i] === n);
        for (const [id, evs] of Object.entries(WIRED)) {
          if (!html.includes(' id="' + id + '"')) continue;
          seen.add(id);
          for (const ev of evs) {
            checked++;
            assert.ok(
              after.some((x) => x[0] === '#' + id && x[1] === ev),
              `${ses.name}/${name}: #${id} has a ${ev} listener`,
            );
          }
        }
      };
      await ses.run(page, cap, idle);
      assert.deepEqual(errors, [], ses.name);
      await page.context().close();
    }
    // the states reach every control in the list
    assert.deepEqual(
      Object.keys(WIRED).filter((id) => !seen.has(id)),
      [],
      'controls never drawn',
    );
    assert.ok(
      states >= 100 && drawn >= 80 && checked > 1000,
      `${states} states, ${drawn} drawn, ${checked} checks`,
    );
  });
  test('the saved palette picker chooses which palette the guide uses', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    const keys = await page.evaluate(() => {
      const own = [...state.owned];
      state.saved.unshift({ id: 881001, type: 'palette', name: 'First', keys: own.slice(0, 5), ts: 881001 });
      state.saved.unshift({
        id: 881002,
        type: 'palette',
        name: 'Second',
        keys: own.slice(20, 26),
        ts: 881002,
      });
      save();
      return own.slice(20, 26);
    });
    // (v318.34: A palette, then Choose a saved palette ▾ with a placeholder until one is chosen)
    await click(page, '#sfSrc [data-v="palette"]');
    await idle(page);
    const opts = await page.$$eval('#sfPalPick option', (o) =>
      o.map((x) => [x.value, x.textContent, x.selected]),
    );
    assert.deepEqual(opts, [
      ['', 'Choose a saved palette…', true],
      ['881002', 'Second (6)', false],
      ['881001', 'First (5)', false],
    ]);
    await choose(page, 'sfPalPick', '881002');
    await idle(page);
    const first = await page.evaluate(() => __mstest.styleVars.savedPalId);
    assert.equal(first, 881002);
    assert.equal(
      await page.$eval('#sfPalPick', (s) => s.value),
      '881002',
      'the palette chosen is the one shown',
    );
    await choose(page, 'sfPalPick', first === 881001 ? '881002' : '881001');
    await idle(page);
    const now = await page.evaluate(() => __mstest.styleVars.savedPalId);
    assert.notEqual(now, first);
    assert.equal(await page.$eval('#sfPalPick', (s) => s.value), String(now), 'still shown after the redraw');
    if (now === 881002) {
      const used = await page.evaluate(() => [
        ...new Set(__mstest.assignData.order.map((l) => __mstest.assignData.assign[l].mkey)),
      ]);
      assert.ok(
        used.every((k) => keys.includes(k)),
        'the guide uses only the second palette’s markers',
      );
    }
    assert.deepEqual(errors, []);
  });
  // found in the v268 review: drawing the controls (as opening a guide does) used to switch a guide whose saved palette
  // had been deleted to the first palette in the list, without a word, so its next change recoloured it from that one
  test('a guide whose saved palette was deleted reopens saying so, and keeps it until you choose another', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      const own = [...state.owned];
      state.saved.unshift({ id: 882001, type: 'palette', name: 'Keep', keys: own.slice(0, 5), ts: 882001 });
      state.saved.unshift({ id: 882002, type: 'palette', name: 'Gone', keys: own.slice(20, 26), ts: 882002 });
      save();
    });
    await click(page, '#sfSrc [data-v="palette"]');
    await idle(page);
    await choose(page, 'sfPalPick', '882002');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.savedPalId), 882002);
    await saveGuide(page);
    await idle(page);
    const guide = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    const used = () =>
      page.evaluate(() => __mstest.assignData.order.map((l) => __mstest.assignData.assign[l].mkey).join());
    const before = await used();
    // the palette is deleted, then the guide is opened again from the Library
    await page.evaluate(() => {
      state.saved = state.saved.filter((x) => x.id !== 882002);
      save();
    });
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await idle(page);
    await page.click(`#savedList .srow[data-id="${guide}"] .sname`);
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.styleVars.savedPalId),
      882002,
      'not switched to another palette',
    );
    // (v318.34: its keys were copied into the guide when chosen, so the card still shows "Gone" and the picker offers
    // the rest; before, the picker said "Palette deleted — choose another")
    assert.deepEqual(
      await page.$$eval('#sfPalPick option', (o) => o.map((x) => [x.value, x.textContent, x.selected])),
      [
        ['', 'Choose a saved palette…', true],
        ['882001', 'Keep (5)', false],
      ],
    );
    assert.equal(await page.textContent('#sfPalCard .sfpntx b'), 'Gone');
    assert.equal(await used(), before, 'the guide opens as it was saved');
    // choosing one uses it
    await choose(page, 'sfPalPick', '882001');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.savedPalId), 882001);
    assert.equal(await page.$eval('#sfPalPick', (s) => s.value), '882001');
    assert.deepEqual(errors, []);
  });
  test('Edit sections: Tilt and Sensitivity show their values, Join the ends of a loop changes the Add hint', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await click(page, '#sfBack2');
    await idle(page);
    await click(page, '#sfAdjToggle');
    await idle(page);
    await slide(page, 'sfTilt', 1.4);
    await idle(page);
    assert.equal(await page.textContent('#sfTiltVal'), '1.4°');
    // Sensitivity is there only with Enhance on
    const on = await page.evaluate(() => __mstest.enhance);
    assert.equal(await page.isVisible('#sfSensWrap'), on);
    await click(page, '#sfEnh');
    await idle(page);
    assert.equal(await page.isVisible('#sfSensWrap'), !on);
    if (on) {
      await click(page, '#sfEnh');
      await idle(page);
    }
    await slide(page, 'sfSens', 7);
    await idle(page);
    assert.equal(await page.textContent('#sfSensVal'), '7');
    await click(page, '#sfEmAdd');
    await idle(page);
    assert.equal(
      await page.isVisible('#sfAutoCloseWrap'),
      true,
      'Join the ends of a loop is offered with Add',
    );
    const h1 = await page.textContent('#sfHint');
    await click(page, '#sfAutoClose');
    await idle(page);
    const h2 = await page.textContent('#sfHint');
    assert.match(h1, /^Add: draw across a region/);
    assert.match(h2, /^Add: draw a loop to enclose a new section/);
    await click(page, '#sfEmMerge');
    await idle(page);
    assert.equal(await page.isVisible('#sfAutoCloseWrap'), false);
    assert.deepEqual(
      await page.$$eval('#sfEdit button', (b) => b.map((x) => x.getAttribute('aria-pressed'))),
      ['false', 'true', 'false', 'false'],
    );
    assert.deepEqual(errors, []);
  });
  test('focus mode: a colour chosen in the Colours sheet is the one shown', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await idle(page);
    await click(page, '#sfColor');
    await idle(page);
    await click(page, '#sfFocus');
    await idle(page);
    await click(page, '#sfFocCols');
    await idle(page);
    assert.equal(await page.isVisible('#sfFocSheet'), true);
    const k = await page.$eval('#sfFocMk .focmk:nth-child(3)', (b) => b.getAttribute('data-k'));
    await click(page, '#sfFocMk .focmk:nth-child(3)');
    await idle(page);
    const cur = await page.evaluate(
      () => __mstest.assignData.assign[__mstest.focusOrd[__mstest.focusPos]].mkey,
    );
    assert.equal(cur, k);
    assert.equal(await page.isVisible('#sfFocSheet'), false, 'the sheet closes');
    assert.deepEqual(errors, []);
  });
}

// ---- from speed.test.mjs ----
// Speed work must not change what you see: partial redraws have to match a full redraw pixel for pixel (pinned
// sections too), big phone photos (up to 48 megapixels) are kept at working size, and the cheap paths (one section
// per Done, no PNG re-encode on autosave, one-section zone markers) give the same answers as the slow ones.
{
  // compare the canvas as it is now with a from-scratch redraw of the same state
  const vsFull = (page) =>
    page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        g = c.getContext('2d'),
        // (v328: the clock held for both drawings: a fresh ✓ fades by the time (40-render tkStep), and a full redraw
        // of a big photo on a slow runner took long enough to cross a step of its fade, GitHub's run #81: the same
        // state drawn at two moments, not a partial redraw that differs)
        pn = performance.now,
        t0 = pn.call(performance);
      performance.now = () => t0;
      let a, b;
      try {
        // the focus bar can change height after a step (longer text), which resizes the picture and the outline;
        // a normal (partial) redraw catches that up first, as the app's next redraw would
        __mstest.renderGuide();
        a = g.getImageData(0, 0, c.width, c.height).data.slice();
        __mstest.forceFullRender();
        __mstest.renderGuide();
        b = g.getImageData(0, 0, c.width, c.height).data;
      } finally {
        performance.now = pn;
      }
      let n = 0,
        mx = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d) {
          n++;
          if (d > mx) mx = d;
        }
      }
      return { n, mx };
    });
  const same = async (page, what) => {
    const r = await vsFull(page);
    assert.equal(r.n, 0, `${what}: ${r.n} channel values differ (max ${r.mx})`);
  };
  test('partial redraws match a full redraw (colour along, focus mode, shading, tone steps)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.click('.sftabbtn[data-t="colours"]');
    await page.click('#sfColor');
    await idle(page);
    await same(page, 'entering colour along');
    const ls = await page.evaluate(() => __mstest.assignData.order.slice(0, 5));
    await scrollTop(page);
    for (const l of ls.slice(0, 3)) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
    }
    await same(page, 'after ticking sections');
    const p0 = await sectionPoint(page, ls[0]);
    await page.mouse.click(p0.x, p0.y);
    await idle(page);
    await same(page, 'after un-ticking one');
    await page.evaluate(() => {
      __mstest.hlKey = __mstest.assignData.assign[__mstest.assignData.order[4]].mkey;
      __mstest.renderGuide();
    });
    await same(page, 'after highlighting a colour');
    await page.evaluate(() => {
      __mstest.hlKey = null;
      __mstest.renderGuide();
    });
    await page.click('#sfFocus');
    await idle(page);
    await same(page, 'entering focus mode');
    for (let i = 0; i < 4; i++) {
      await page.click('#sfFDone');
      await idle(page);
      await same(page, `after Done #${i + 1}`);
    }
    await page.click('#sfFBack');
    await idle(page);
    await same(page, 'after Back');
    await page.click('#sfFDone');
    await idle(page);
    await same(page, 'after Undo');
    // jump to a different colour (most of the picture changes)
    await page.evaluate(() => {
      const t = __mstest,
        cur = t.focusOrd[t.focusPos],
        k = t.assignData.assign[cur].mkey;
      const j = t.focusOrd.findIndex((l) => t.assignData.assign[l].mkey !== k);
      t.goFocus(j, false);
    });
    await idle(page);
    await same(page, 'after switching colour');
    // step through each tone
    await page.evaluate(() => {
      __mstest.toneSteps = true;
      __mstest.buildFocusOrder();
      __mstest.goFocus(__mstest.nextUndone(-1), false);
    });
    await idle(page);
    for (let i = 0; i < 3; i++) {
      await page.click('#sfFDone');
      await idle(page);
      await same(page, `after tone step #${i + 1}`);
    }
    assert.deepEqual(errors, []);
  });
  test('a big phone photo is kept at working size, Done repaints one section, autosave skips re-encoding', async () => {
    const { page, errors } = await openApp();
    // a 4000 x 3000 "photo" of line art
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 4000;
      c.height = 3000;
      const g = c.getContext('2d');
      g.fillStyle = '#f2ece2';
      g.fillRect(0, 0, 4000, 3000);
      g.strokeStyle = '#222';
      g.lineWidth = 10;
      let s = 7;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 220; i++) {
        g.beginPath();
        g.arc(r() * 4000, r() * 3000, 60 + r() * 300, 0, 6.283);
        g.stroke();
      }
      for (let i = 0; i < 40; i++) {
        g.beginPath();
        g.moveTo(r() * 4000, r() * 3000);
        g.lineTo(r() * 4000, r() * 3000);
        g.stroke();
      }
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9));
      return await new Promise((res) => {
        const f = new FileReader();
        f.onload = () => res(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    const size = await page.evaluate(() => ({ src: __mstest.srcSize, W: __mstest.W, H: __mstest.H }));
    assert.ok(Math.max(...size.src) <= 2400, `photo kept at working size, got ${size.src}`);
    assert.equal(size.W, 2400);
    assert.equal(size.H, 1800);
    await buildGo(page);
    await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData), null, { timeout: 60000 });
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page, 2200); // let the first autosave happen
    const t = await page.evaluate(async () => {
      let png = 0;
      const orig = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (type, q) {
        if ((!type || type === 'image/png') && this.width === __mstest.W) png++;
        return orig.call(this, type, q);
      };
      let t0 = performance.now();
      __mstest.forceFullRender();
      __mstest.renderGuide();
      const full = performance.now() - t0;
      const before = __mstest.colored.reduce((a, b) => a + b, 0);
      // what Done puts back on the picture: a whole redraw puts the whole picture, one section just its patch
      let put = 0,
        whole = 0;
      const P = CanvasRenderingContext2D.prototype,
        oput = P.putImageData;
      P.putImageData = function (im, x, y, dx, dy, dw, dh) {
        if (this.canvas.width === __mstest.W) {
          if (arguments.length >= 7) put += dw * dh;
          else {
            whole++;
            put += im.width * im.height;
          }
        }
        return oput.apply(this, arguments);
      };
      t0 = performance.now();
      document.getElementById('sfFDone').click();
      const done = performance.now() - t0;
      P.putImageData = oput;
      await window.__idle.wait(2200, 20000); // until the auto-save (1.5 s after the change) has run
      // (v285: built, it's in the Library, so its changes save into its entry)
      const saved = await IDB.get('guide-' + __mstest.curId);
      return {
        full,
        done,
        png,
        before,
        savedProg: saved && saved.prog.length,
        put: put / (__mstest.W * __mstest.H),
        whole,
      };
    });
    assert.equal(t.whole, 0, 'Done did not redraw the whole picture');
    assert.ok(t.put > 0 && t.put < 0.2, `Done repainted ${(t.put * 100).toFixed(1)}% of the picture`);
    // (the time only in Chromium: GitHub's WebKit redraws the whole picture in about 50 ms, so the gap is too small to time)
    if (ENGINE !== 'webkit')
      assert.ok(
        t.done < t.full * 0.5,
        `Done took ${t.done.toFixed(0)} ms vs ${t.full.toFixed(0)} ms for a full redraw`,
      );
    assert.equal(t.png, 0, 'autosave reused the saved section map');
    assert.equal(t.savedProg, t.before + 1, 'autosave still stored the new tick');
    await page.click('#sfFDone');
    await idle(page);
    await same(page, 'big photo after Done');
    assert.deepEqual(errors, []);
  });
  test('zone markers worked out per section match the whole-picture calculation', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const r = await page.evaluate(() => {
      const t = __mstest;
      t.shadeMode = 'full';
      const sh = t.shadePrep(false);
      const key = (z) => [z.l, z.zone, z.x, z.y, z.r.toFixed(3)].join(':');
      const whole = t.shadeZoneLabels(sh, 4).map(key),
        per = t.shadeZoneLabelsAll(sh, 4).map(key);
      return { whole, per };
    });
    assert.ok(r.whole.length > 3);
    assert.deepEqual(r.per, r.whole);
    assert.deepEqual(errors, []);
  });
  test('the section map is only re-encoded when the sections change', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        a = t.lmapURL(),
        s1 = t.labelsSig();
      const b = t.lmapURL();
      const o = t.assignData.order;
      t.mergeCellsSnap(o[0], o[1]);
      const s2 = t.labelsSig(),
        c = t.lmapURL();
      return { same: a === b, sigChanged: s1 !== s2, reencoded: c !== a };
    });
    assert.ok(r.same && r.sigChanged && r.reencoded, JSON.stringify(r));
    assert.deepEqual(errors, []);
  });
  test('undo snapshots are packed and undo restores the sections exactly', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('#sfBack2');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        before = t.labelsSig(),
        o = t.assignData.order,
        b0 = t.undoBytes;
      t.mergeCellsSnap(o[0], o[1]);
      t.render();
      const used = t.undoBytes - b0,
        full = t.W * t.H * 4,
        changed = t.labelsSig() !== before;
      t.doUndoSeg();
      return { used, full, changed, restored: t.labelsSig() === before };
    });
    assert.ok(r.changed && r.restored, JSON.stringify(r));
    assert.ok(r.used < r.full / 4, `snapshot ${r.used} bytes vs ${r.full} unpacked`);
    assert.deepEqual(errors, []);
  });
  test('pinning colours (labels that stick out of their section) still redraws pixel for pixel', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="shading"]');
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    await page.evaluate(() => document.getElementById('sfLock').click());
    await idle(page);
    await scrollTop(page);
    const ls = await page.evaluate(() => __mstest.assignData.order.slice(10, 14));
    // Pin colours mode: a tap pins (or unpins) straight away
    for (const l of ls) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
      assert.ok(await page.evaluate((l) => !!__mstest.locks[l], l), 'pinned');
      await same(page, `after pinning section ${l}`);
    }
    const p0 = await sectionPoint(page, ls[0]);
    await page.mouse.click(p0.x, p0.y);
    await idle(page);
    await same(page, 'after unpinning one');
    // a new colour from the section's tip: previewed, then undone with Escape
    await page.evaluate(() => document.getElementById('sfLock').click());
    await idle(page);
    await scrollTop(page);
    for (const l of ls.slice(1, 3)) {
      const p = await sectionPoint(page, l);
      await page.mouse.click(p.x, p.y);
      await idle(page);
      await page.click('.sftip [data-a="change"]');
      await idle(page);
      const picked = await page.evaluate(() => {
        const b = document.querySelectorAll('#sfPopSw .sfsw');
        if (b.length < 4) return false;
        b[3].click();
        return true;
      });
      assert.ok(picked, 'colour picker opened');
      await idle(page);
      await same(page, `after a new colour for section ${l}`);
      await page.keyboard.press('Escape');
      await idle(page);
      await same(page, `after closing the picker for ${l}`);
    }
    assert.deepEqual(errors, []);
  });
  test('H/S markers follow the shading mode and marker changes, not just the light', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        count = () => {
          const sh = t.shadePrep(false);
          const all = t.shadeZoneLabelsAll(sh, 4),
            fresh = t.shadeZoneLabels(sh, 4);
          return {
            h: all.filter((z) => z.tone === 'H').length,
            same: JSON.stringify(all) === JSON.stringify(fresh),
          };
        };
      t.shadeMode = 'full';
      const full = count();
      t.shadeMode = 'shadow';
      const shadow = count();
      t.shadeMode = 'full';
      const back = count();
      return { full, shadow, back };
    });
    assert.ok(r.full.h > 0 && r.full.same, JSON.stringify(r.full));
    assert.ok(
      r.shadow.h === 0 && r.shadow.same,
      'no highlight markers in shadow-only mode: ' + JSON.stringify(r.shadow),
    );
    assert.ok(r.back.h === r.full.h && r.back.same, JSON.stringify(r.back));
    assert.deepEqual(errors, []);
  });
  test('a 48-megapixel photo loads, is scaled to working size, and builds', async () => {
    const { page, errors } = await openApp();
    const b64 = await page.evaluate(async () => {
      const W = 8000,
        H = 6000,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#f3efe6';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = '#1d1d1d';
      g.lineWidth = 18;
      let s = 3;
      const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 160; i++) {
        g.beginPath();
        g.arc(r() * W, r() * H, 120 + r() * 700, 0, 6.283);
        g.stroke();
      }
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
      c.width = c.height = 1;
      return await new Promise((res) => {
        const f = new FileReader();
        f.onload = () => res(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const t0 = Date.now();
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 90000 });
    const sz = await page.evaluate(() => ({ src: __mstest.srcSize, W: __mstest.W, H: __mstest.H }));
    assert.ok(Math.max(...sz.src) <= 2400, 'kept at working size: ' + sz.src);
    assert.equal(Math.max(sz.W, sz.H), 2400);
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData && __mstest.assignData.N > 20, null, {
      timeout: 90000,
    });
    assert.ok(Date.now() - t0 < 60000, 'done in under a minute on the test machine');
    assert.deepEqual(errors, []);
  });
  // ---- From the review leftovers ----
  test('pinning sections redraws exactly as a full redraw would (both pin styles)', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    for (const fam of ['gradient', 'manual']) {
      await page.click('.sftabbtn[data-t="pattern"]');
      await page.click(`#sfFam [data-v="${fam}"]`);
      await idle(page);
      const d = await page.evaluate(() => {
        const t = __mstest,
          c = document.getElementById('sfCanvas'),
          g = c.getContext('2d');
        let worst = 0;
        const cmp = () => {
          t.renderGuide();
          const a = g.getImageData(0, 0, c.width, c.height).data.slice();
          t.forceFullRender();
          t.renderGuide();
          const b = g.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
          return n;
        };
        cmp();
        for (let k = 0; k < 8; k++) {
          const l = t.assignData.order[k * 3];
          t.locks[l] = t.assignData.assign[l].mkey;
          t.renderGuide();
          worst = Math.max(worst, cmp());
        }
        for (let k = 0; k < 8; k++) {
          delete t.locks[t.assignData.order[k * 3]];
          t.renderGuide();
          worst = Math.max(worst, cmp());
        }
        return worst;
      });
      assert.equal(d, 0, `${fam}: pixels differ`);
    }
    assert.deepEqual(errors, []);
  });
}

// ---- from style-fields.test.mjs ----
// A guide's style settings (pattern, palette, shading, texture, the photo's settings...) and the section settings saved
// beside them (minSize, bgTrim, addAutoClose; minPos is also written, on the old scale, for older copies of the app): what is saved, what comes back, what Undo takes back, what a new
// picture keeps, and what a saved file with a missing or odd value opens with. These pin today's behaviour, so the
// code that lists the fields can change without the guides people have saved opening any differently.
//
// The golden test drives the app through a set of states and compares what currentDesignObj() saves with
// e2e/fixtures/style-golden.json (the JSON with the label map and photo left out, hashed, plus its style in the
// clear). STYLE_GOLDEN=write rewrites the fixture; STYLE_GOLDEN_DUMP=DIR also writes each capture in full (with
// the pictures) to DIR, to compare two versions of the code byte for byte.
{
  const GOLDEN = join(ROOT, 'e2e', 'fixtures', 'style-golden.json');
  // Math.random from a seed: __seed(n) before anything random (Shuffle, Surprise, a Random pattern) makes it repeatable
  const SEEDED = () => {
    let a = 1;
    window.__seed = (n) => {
      a = n >>> 0;
    };
    Math.random = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // today's defaults: what a guide that says nothing opens with
  const DEF_STYLE = {
    family: 'gradient',
    palette: 'all',
    gradShape: 'serpentine',
    dir: 1,
    look: 'auto',
    emphasis: 'neutral',
    limitN: 16,
    noAdj: false,
    balance: 'main',
    balM: 'auto',
    balS: 'auto',
    balA: 'auto',
    balSeed: 0,
    noRep: false,
    gradSeed: 0,
    blendFall: 2,
    blendVivid: false,
    blendMix: 'soft',
    texAmt: 0.5,
    radC: null,
    // (lightSrc: where the light comes from, v281; light: what older copies are told, the sun only when it's chosen)
    shade: {
      mode: 'off',
      x: 0.2,
      y: 0.12,
      round: 0.5,
      lines: true,
      hi: 0.5,
      lo: 0.5,
      lightSrc: 'auto',
      light: 'photo',
      main: true,
      shadow: 'same',
      hilite: 'same',
      // (v327: Two tone sets, and whether the Photo style is chosen)
      sets: false,
      pstyle: false,
      flat: [],
    },
    photo: null,
    expand: false,
    expandChar: 0.5,
    paletteSource: 'owned',
    savedPalId: null,
    genHarmony: 'analogous',
    genPal: [],
  };
  const DEF_PAY = { minSize: 30, bgTrim: 50, addAutoClose: false };
  // (v306) Scatter's settings, written only when used (a guide at Polished says nothing of them, as before): Sparkle,
  // its seed and rough spots smoothed
  const SCAT = { gradScat: 3, gradJit: 0.6, gradFix: true };
  // the style and section settings of the open guide, as saved
  const settings = (page, share, edits) =>
    page.evaluate(
      ([s, e]) => {
        const d = __mstest.currentDesignObj(s, e);
        return (
          d && {
            style: d.payload.style,
            minSize: d.payload.minSize,
            bgTrim: d.payload.bgTrim,
            addAutoClose: d.payload.addAutoClose,
          }
        );
      },
      [!!share, !!edits],
    );
  // ... plus the photo's see-through and white-areas settings, which are saved only with a photo
  const allSettings = async (page) => ({
    ...(await settings(page)),
    photoOp: await page.evaluate(() => __mstest.styleVars.photoOp),
    photoPaper: await page.evaluate(() => __mstest.styleVars.photoPaper),
  });
  // a non-default value for every field (the flat sections and palette keys come from the open guide)
  async function nonDefault(page) {
    return page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order,
        keys = [...new Set(o.map((l) => t.assignData.assign[l].mkey))];
      return {
        style: {
          family: 'random',
          palette: 'warm',
          theme: 'coral',
          gradShape: 'radial',
          dir: -1,
          look: 'ltd',
          emphasis: 'earthy',
          limitN: 11,
          noAdj: true,
          balance: 'mixed',
          balM: 'blue',
          balS: 'teal',
          balA: 'orange',
          balSeed: 0.4,
          noRep: true,
          gradSeed: 0.37,
          blendFall: 3.2,
          blendVivid: false,
          blendMix: 'paint',
          texAmt: 0.2,
          radC: { x: 0.3, y: 0.6 },
          shade: {
            mode: 'full',
            x: 0.7,
            y: 0.8,
            round: 0.9,
            lines: false,
            hi: 0.3,
            lo: 0.65,
            lightSrc: 'sun',
            light: 'sun',
            main: false,
            shadow: 'cool',
            hilite: 'warm',
            sets: true,
            pstyle: true,
            flat: [o[2], o[5]],
          },
          photo: null,
          expand: true,
          expandChar: 0.25,
          paletteSource: 'generate',
          savedPalId: 4242,
          genHarmony: 'triadic',
          genPal: keys.slice(0, 3),
        },
        minSize: 40,
        bgTrim: 30,
        addAutoClose: true,
      };
    });
  }
  // the open guide, reopened (as a new guide called `name`) with its payload changed by `edit`
  async function reopenAs(page, name, edit) {
    await page.evaluate(
      ([name, edit]) => {
        const d = __mstest.currentDesignObj(),
          p = d.payload;
        // eslint-disable-next-line no-new-func
        new Function('p', edit)(p);
        __mstest.openDesignObj(Object.assign({}, p, { name, W: d.W, H: d.H }), null);
      },
      [name, edit],
    );
    await page.waitForFunction((name) => __mstest.curName === name && __mstest.assignData, name);
    await idle(page);
  }
  // the open guide reopened with this style and these section settings
  const openWith = (page, name, v) =>
    reopenAs(
      page,
      name,
      `const v = ${JSON.stringify(v)}; for (const k in v) { if (v[k] === '__delete') delete p[k]; else p[k] = v[k]; }`,
    );
  // the controls: buttons and checkboxes are clicked, sliders set and let go (input, then change), selects changed
  const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
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
  const choose = (page, id, v) =>
    page.evaluate(
      ([id, v]) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      [id, v],
    );
  const seed = (page, n) => page.evaluate((n) => window.__seed(n), n);
  // Save (a new guide into the Library), then reopen it after a reload, the way the Library does
  const saveNew = (page) => saveGuide(page);
  const openSaved = async (page, id) => {
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id, { timeout: 10000 });
    await idle(page);
  };
  // a two-colour picture to use as the Photo pattern's photo
  async function pickPhoto(page) {
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 800;
      const g = c.getContext('2d');
      g.fillStyle = '#2350c8';
      g.fillRect(0, 0, 600, 400);
      g.fillStyle = '#d0282c';
      g.fillRect(0, 400, 600, 400);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      click(page, '#sfFam [data-v="photo"]'),
    ]);
    await fc.setFiles({ name: 'ref.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForFunction(() => !!__mstest.photoRef && !__mstest.photoChecking);
    await idle(page);
    // lining up (where Place it and See-through are) stays on unless the photo lined itself up
    if (!(await page.evaluate(() => __mstest.photoAlign))) {
      await click(page, '#sfPhAlign');
      await idle(page);
    }
  }
  // ---- golden captures ----

  async function captureAll() {
    const caps = {};
    const cap = async (page, name, share, edits) => {
      const r = await page.evaluate(
        ([s, e]) => {
          const d = __mstest.currentDesignObj(s, e);
          if (!d) return null;
          return {
            full: JSON.stringify(d),
            norm: JSON.stringify(d, (k, v) =>
              (k === 'lmap' || k === 'ref') && typeof v === 'string' ? '<' + k + '>' : v,
            ),
            style: d.payload.style,
          };
        },
        [!!share, !!edits],
      );
      assert.ok(!(name in caps), name);
      caps[name] = r;
    };
    const step = async (page, name, fn) => {
      await fn();
      await idle(page);
      await cap(page, name);
    };

    // the sample, then each control in turn
    {
      const { page, errors } = await openApp({ init: SEEDED });
      await sampleGuide(page);
      await idle(page);
      // (a new guide's made-up name is seeded with the time: named here so the captures repeat)
      await page.evaluate(() => {
        __mstest.curName = 'Golden';
      });
      await cap(page, 'sample');
      await cap(page, 'sample-share', true);
      await cap(page, 'sample-edits', false, true);
      await step(page, 'limitN', () => slide(page, 'sfMkCount', 10));
      await step(page, 'palette', () => click(page, '#sfPal [data-v="warm"]'));
      await step(page, 'emphasis', () => click(page, '#sfMood [data-v="vivid"]'));
      await step(page, 'generate', async () => {
        await seed(page, 11);
        await click(page, '#sfSrc [data-v="palette"]');
      });
      await step(page, 'harmony', async () => {
        await seed(page, 12);
        await choose(page, 'sfHarm', 'triadic');
      });
      await step(page, 'expand', () => click(page, '#sfExpand'));
      await step(page, 'expandChar', () => slide(page, 'sfExpChar', 80));
      await step(page, 'gradShape', () => click(page, '#sfShape [data-v="radial"]'));
      await step(page, 'dir', () => click(page, '#sfDir [data-d="-1"]'));
      await step(page, 'shuffle', async () => {
        await seed(page, 13);
        await click(page, '#sfVary');
      });
      await step(page, 'look', () => click(page, '#sfLook [data-v="ltd"]'));
      await step(page, 'look-auto', () => click(page, '#sfLook [data-v="auto"]'));
      await step(page, 'random', async () => {
        await seed(page, 14);
        await click(page, '#sfFam [data-v="random"]');
      });
      await step(page, 'random-shuffle', async () => {
        await seed(page, 17);
        await click(page, '#sfShuffle');
      });
      await step(page, 'noAdj', async () => {
        await seed(page, 15);
        await click(page, '#sfNoAdj');
      });
      await step(page, 'blend', () => click(page, '#sfFam [data-v="blend"]'));
      await step(page, 'blendFall', () => slide(page, 'sfSpread', 3));
      await step(page, 'blendMix-paint', () => click(page, '#sfMix [data-v="paint"]'));
      // (Vivid last: the captures after it are with the Mix that the old "Keep colours vivid" became)
      await step(page, 'blendMix', () => click(page, '#sfMix [data-v="vivid"]'));
      await step(page, 'shadeMode', () => page.evaluate(() => __mstest.shadeTo('full')));
      await step(page, 'shadeHi', () => slide(page, 'sfShHi', 30));
      await step(page, 'shadeLo', () => slide(page, 'sfShLo', 70));
      await step(page, 'shadeRound', () => slide(page, 'sfRound', 80));
      await step(page, 'shadeLines', () => click(page, '#sfShLines'));
      await step(page, 'shadeHilite', () => choose(page, 'sfHiStyle', 'warm'));
      await step(page, 'shadeShadow', () => choose(page, 'sfShStyle', 'grey'));
      await step(page, 'shadeSunFlat', () =>
        page.evaluate(() => {
          const t = __mstest,
            o = t.assignData.order;
          t.shadeSun = { x: 0.6, y: 0.3 };
          t.shadeFlat[o[4]] = 1;
          t.shadeFlat[o[1]] = 1;
          t.guideDirty = true;
          t.renderGuide();
        }),
      );
      await step(page, 'texAmt', () => slide(page, 'sfTex', 25));
      await cap(page, 'texAmt-share', true);
      await step(page, 'manual', () => click(page, '#sfFam [data-v="manual"]'));
      await step(page, 'gradient', () => click(page, '#sfFam [data-v="gradient"]'));
      await step(page, 'pins', () =>
        page.evaluate(() => {
          const t = __mstest,
            o = t.assignData.order;
          t.locks[o[3]] = t.assignData.assign[o[3]].mkey;
          t.locks[o[8]] = t.assignData.assign[o[8]].mkey;
          t.guideDirty = true;
          t.renderGuide();
        }),
      );
      await step(page, 'surprise', async () => {
        await seed(page, 16);
        await click(page, '#sfSurprise');
      });
      await answerAsks(page);
      await step(page, 'savedPalette', () =>
        page.evaluate(() => {
          const id = 777001;
          state.saved.unshift({ id, type: 'palette', name: 'P', keys: [...state.owned].slice(0, 6), ts: id });
          save();
          SF.setSavedSource(id);
        }),
      );
      // (v318.34: the segment is A palette, lit already: tapped again it lays the plan again, as before)
      await step(page, 'savedPalette-render', () => click(page, '#sfSrc [data-v="palette"]'));
      // section edits not built yet: saved only as the "edits" copy
      await page.click('#sfBack2');
      await idle(page);
      await page.evaluate(() => {
        const t = __mstest,
          l = t.assignData.order[6];
        t.secState[l] = 2;
        t.guideDirty = true;
        t.render();
      });
      await cap(page, 'edits-pending');
      await cap(page, 'edits-pending-edits', false, true);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    // the Photo pattern: the photo is saved with the guide, and left out of a shared file once the pattern changes
    {
      const { page, errors } = await openApp({ init: SEEDED });
      await sampleGuide(page);
      await page.evaluate(() => {
        __mstest.curName = 'Golden photo';
      });
      await pickPhoto(page);
      await cap(page, 'photo');
      await cap(page, 'photo-share', true);
      await step(page, 'photoOp', () => slide(page, 'sfPhOp', 40));
      await step(page, 'photoPaper', () => click(page, '#sfPhPaper'));
      await step(page, 'photo-shade', () => page.evaluate(() => __mstest.shadeTo('shadow')));
      await step(page, 'photo-shadeLight', () => click(page, '#sfShLight [data-v="sun"]'));
      await step(page, 'photo-gradient', () => click(page, '#sfFam [data-v="gradient"]'));
      await cap(page, 'photo-gradient-share', true);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    // saved guides opened: every field set, odd values, and nothing said at all
    {
      const { page, errors } = await openApp({ init: SEEDED });
      await sampleGuide(page);
      const v = await nonDefault(page);
      await openWith(page, 'All set', v);
      await cap(page, 'open-all-set');
      await openWith(page, 'Odd', { style: ODD_TYPES, ...ODD_TYPES_PAY });
      await cap(page, 'open-odd-types');
      await openWith(page, 'High', { style: ODD_HIGH, ...ODD_HIGH_PAY });
      await cap(page, 'open-odd-high');
      await openWith(page, 'Low', { style: ODD_LOW, ...ODD_LOW_PAY });
      await cap(page, 'open-odd-low');
      await openWith(page, 'Unknown', { style: ODD_ENUM, ...DEF_PAY });
      await cap(page, 'open-odd-enum');
      await openWith(page, 'Nothing', {
        style: '__delete',
        minPos: '__delete',
        minSize: '__delete',
        bgTrim: '__delete',
        addAutoClose: '__delete',
      });
      await cap(page, 'open-nothing');
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    return caps;
  }
  // odd values in a saved file, and what each opens as today
  const ODD_TYPES = {
    family: 5,
    palette: null,
    gradShape: ['radial'],
    dir: '-1',
    look: 2,
    emphasis: true,
    limitN: '12',
    noAdj: 'true',
    gradSeed: '0.5',
    blendFall: 'abc',
    blendVivid: 1,
    blendMix: 2,
    texAmt: null,
    radC: 'middle',
    balance: 3,
    balM: 'purple',
    balS: 1,
    balA: null,
    balSeed: 'x',
    noRep: 'yes',
    shade: {
      mode: 1,
      x: '0.3',
      y: null,
      round: true,
      lines: 'no',
      hi: {},
      lo: [],
      light: 3,
      shadow: 1,
      hilite: {},
      sets: 'yes',
      pstyle: 1,
      flat: 'x',
    },
    photo: 'x',
    expand: 'yes',
    expandChar: false,
    paletteSource: 1,
    savedPalId: '12',
    genHarmony: 7,
    genPal: 'Ohuhu|R16',
  };
  const ODD_TYPES_PAY = { minSize: '30', minPos: '__delete', bgTrim: null, addAutoClose: 1 };
  // (every one of them opens as the default: a shading "lines" that isn't false is on, a photo that isn't an object
  // is no photo)
  const ODD_TYPES_OPEN = DEF_STYLE;
  const ODD_HIGH = {
    ...DEF_STYLE,
    limitN: 1e9,
    gradSeed: 1.5,
    blendFall: 9,
    texAmt: 2,
    radC: { x: 3, y: 1.5 },
    balSeed: 2,
    expandChar: 7,
    savedPalId: 1e300,
    shade: {
      mode: 'shadow',
      x: 3,
      y: 1.01,
      round: 5,
      lines: false,
      hi: 2,
      lo: 100,
      light: 'sun',
      shadow: 'grey',
      hilite: 'paper',
      flat: [],
    },
  };
  const ODD_HIGH_PAY = { minSize: 500, minPos: '__delete', bgTrim: 101, addAutoClose: true };
  const ODD_HIGH_OPEN = {
    ...DEF_STYLE,
    limitN: 999,
    gradSeed: 1,
    blendFall: 4,
    texAmt: 1,
    radC: { x: 1, y: 1 },
    balSeed: 1,
    expandChar: 1,
    savedPalId: 1e300,
    shade: {
      mode: 'shadow',
      x: 1,
      y: 1,
      round: 1,
      lines: false,
      hi: 1,
      lo: 1,
      lightSrc: 'sun',
      light: 'sun',
      main: true,
      shadow: 'grey',
      hilite: 'paper',
      sets: false,
      pstyle: false,
      flat: [],
    },
  };
  const ODD_LOW = {
    ...DEF_STYLE,
    limitN: -5,
    gradSeed: -1,
    blendFall: 0,
    texAmt: -5,
    radC: { x: -1, y: -0.5 },
    balSeed: -1,
    expandChar: -0.1,
    savedPalId: -7,
    shade: {
      mode: 'full',
      x: -1,
      y: -0.5,
      round: -2,
      lines: true,
      hi: -1,
      lo: -0.01,
      light: 'photo',
      flat: [],
    },
  };
  const ODD_LOW_PAY = { minSize: -3, minPos: '__delete', bgTrim: -50, addAutoClose: false };
  const ODD_LOW_OPEN = {
    ...DEF_STYLE,
    limitN: 2,
    gradSeed: 0,
    blendFall: 0.6,
    texAmt: 0,
    radC: { x: 0, y: 0 },
    balSeed: 0,
    expandChar: 0,
    savedPalId: -7,
    // (light 'photo' in a file from before v281 was its default: auto)
    shade: {
      mode: 'full',
      x: 0,
      y: 0,
      round: 0,
      lines: true,
      hi: 0,
      lo: 0,
      lightSrc: 'auto',
      light: 'photo',
      main: true,
      shadow: 'same',
      hilite: 'same',
      sets: false,
      pstyle: false,
      flat: [],
    },
  };
  // (genHarmony is checked against the harmony names' object, so a name it inherits, like "constructor", is let
  // through, as are "custom" and "photo", which Generate palette doesn't offer: today's behaviour, kept)
  const ODD_ENUM = {
    ...DEF_STYLE,
    family: 'rainbow',
    palette: 'hot',
    gradShape: 'spiral',
    dir: 0,
    look: 'fancy',
    emphasis: 'loud',
    limitN: 11.6,
    blendMix: 'loud',
    balance: 'loud',
    balM: 'magenta',
    balA: 'Blues',
    shade: { ...DEF_STYLE.shade, mode: 'on', light: 'moon', shadow: 'dark', hilite: 'glow' },
    paletteSource: 'bought',
    genHarmony: 'constructor',
    genPal: [5, 'Ohuhu|R16', null, 9999999, 'no such key'],
  };
  const ODD_ENUM_OPEN = {
    ...DEF_STYLE,
    limitN: 12,
    genHarmony: 'constructor',
    genPal: ['<mkey 5>', 'Ohuhu|R16', 'no such key'],
  };
  // each control, then Undo: back to exactly what it was (one step each)
  const CONTROLS = [
    ['limitN', 'colours', (p) => slide(p, 'sfMkCount', 10)],
    ['palette', 'colours', (p) => click(p, '#sfPal [data-v="warm"]')],
    // (v318.18: a theme the warm markers have)
    ['theme', 'colours', (p) => click(p, '#sfTheme [data-v="sunset"]')],
    ['emphasis', 'colours', (p) => click(p, '#sfMood [data-v="muted"]')],
    [
      'paletteSource',
      'colours',
      async (p) => {
        await seed(p, 21);
        await click(p, '#sfSrc [data-v="palette"]');
      },
    ],
    [
      'genHarmony',
      'colours',
      async (p) => {
        await seed(p, 22);
        await choose(p, 'sfHarm', 'tetradic');
      },
    ],
    ['expand', 'colours', (p) => click(p, '#sfExpand')],
    ['expandChar', 'colours', (p) => slide(p, 'sfExpChar', 70)],
    ['gradShape', 'pattern', (p) => click(p, '#sfShape [data-v="vertical"]')],
    ['dir', 'pattern', (p) => click(p, '#sfDir [data-d="-1"]')],
    ['look', 'pattern', (p) => click(p, '#sfLook [data-v="ltd"]')],
    [
      'gradSeed',
      'pattern',
      async (p) => {
        await seed(p, 23);
        await click(p, '#sfVary');
      },
    ],
    // (v306: Scatter, then Shuffle at Sparkle, which turns only its seed)
    ['gradScat', 'pattern', (p) => slide(p, 'sfGradScat', 3)],
    [
      'gradJit',
      'pattern',
      async (p) => {
        await seed(p, 26);
        await click(p, '#sfVary');
      },
    ],
    [
      'family',
      'pattern',
      async (p) => {
        await seed(p, 24);
        await click(p, '#sfFam [data-v="random"]');
      },
    ],
    [
      'noAdj',
      'pattern',
      async (p) => {
        await seed(p, 25);
        await click(p, '#sfNoAdj');
      },
    ],
    ['family', 'pattern', (p) => click(p, '#sfFam [data-v="blend"]')],
    ['blendFall', 'pattern', (p) => slide(p, 'sfSpread', 3.4)],
    ['blendMix', 'pattern', (p) => click(p, '#sfMix [data-v="vivid"]')],
    ['blendMix', 'pattern', (p) => click(p, '#sfMix [data-v="paint"]')],
    ['shadeHi', 'shading', (p) => slide(p, 'sfShHi', 20)],
    ['shadeLo', 'shading', (p) => slide(p, 'sfShLo', 90)],
    ['shadeRound', 'shading', (p) => slide(p, 'sfRound', 15)],
    ['shadeLines', 'shading', (p) => click(p, '#sfShLines')],
    ['texAmt', 'shading', (p) => slide(p, 'sfTex', 70)],
    ['shadeHilite', 'shading', (p) => choose(p, 'sfHiStyle', 'paper')],
    ['shadeShadow', 'shading', (p) => choose(p, 'sfShStyle', 'cool')],
    // (last: Shadows has no Highlight slider)
    ['shadeMode', 'shading', (p) => p.evaluate(() => __mstest.shadeTo('shadow'))],
  ];
  test(
    'golden: what a guide saves is unchanged across a set of states',
    { skip: ENGINE !== 'chromium' && 'the fixture is Chromium’s' },
    async () => {
      const caps = await captureAll();
      const dump = process.env.STYLE_GOLDEN_DUMP;
      if (dump) {
        await mkdir(dump, { recursive: true });
        for (const [k, v] of Object.entries(caps))
          await writeFile(join(dump, k + '.json'), v ? v.full : 'null');
      }
      const out = {};
      for (const [k, v] of Object.entries(caps))
        out[k] = v && {
          sha256: createHash('sha256').update(v.norm).digest('hex'),
          bytes: v.norm.length,
          style: v.style,
        };
      if (process.env.STYLE_GOLDEN === 'write') {
        await mkdir(join(ROOT, 'e2e', 'fixtures'), { recursive: true });
        await writeFile(GOLDEN, JSON.stringify(out, null, 1) + '\n');
        return;
      }
      const want = JSON.parse(await readFile(GOLDEN, 'utf8'));
      assert.deepEqual(Object.keys(out), Object.keys(want), 'the same captures');
      for (const k of Object.keys(want)) {
        assert.deepEqual(out[k] && out[k].style, want[k] && want[k].style, k + ': style');
        assert.deepEqual(out[k], want[k], k + ': the whole guide');
      }
    },
  );
  test('every field: a value that isn’t the default is kept through save, reload and reopening from the Library', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const v = await nonDefault(page);
    v.style = { ...v.style, ...SCAT };
    await openWith(page, 'All set', v);
    const s1 = await allSettings(page);
    // what it opened with is what the file said (the flat sections are renumbered the way the map is read)
    assert.deepEqual(
      { ...s1.style, shade: { ...s1.style.shade, flat: [] } },
      { ...v.style, shade: { ...v.style.shade, flat: [] } },
    );
    assert.equal(s1.style.shade.flat.length, 2);
    assert.deepEqual([s1.minSize, s1.bgTrim, s1.addAutoClose], [40, 30, true]);
    await saveNew(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await openSaved(page, id);
    const s2 = await allSettings(page);
    assert.deepEqual(s2, s1);
    // the other values of each choice, the same way
    await openWith(page, 'Others', {
      style: {
        ...v.style,
        family: 'blend',
        palette: 'cool',
        gradShape: 'diagonal',
        look: 'smooth',
        emphasis: 'vivid',
        shade: { ...v.style.shade, mode: 'shadow', lightSrc: 'photo' },
        paletteSource: 'owned',
        genHarmony: 'split',
      },
    });
    const s3 = await allSettings(page);
    assert.deepEqual(
      [
        s3.style.family,
        s3.style.palette,
        s3.style.gradShape,
        s3.style.look,
        s3.style.emphasis,
        s3.style.shade.mode,
        s3.style.shade.lightSrc,
        s3.style.paletteSource,
        s3.style.genHarmony,
      ],
      ['blend', 'cool', 'diagonal', 'smooth', 'vivid', 'shadow', 'photo', 'owned', 'split'],
    );
    await saveNew(page);
    const id3 = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await openSaved(page, id3);
    assert.deepEqual(await allSettings(page), s3);
    await openWith(page, 'Manual vertical', {
      style: { ...v.style, family: 'manual', gradShape: 'vertical' },
    });
    assert.deepEqual(
      [(await settings(page)).style.family, (await settings(page)).style.gradShape],
      ['manual', 'vertical'],
    );
    assert.deepEqual(errors, []);
  });
  test('the Photo pattern’s photo, see-through and white areas are kept through save, reload and reopening', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await pickPhoto(page);
    await slide(page, 'sfPhOp', 40);
    await click(page, '#sfPhPaper');
    await idle(page);
    const s1 = await allSettings(page);
    assert.equal(s1.style.photo.op, 0.4);
    assert.equal(s1.style.photo.paper, false);
    await saveNew(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await openSaved(page, id);
    await page.waitForFunction(() => !!__mstest.photoRef);
    await idle(page);
    assert.deepEqual(await allSettings(page), s1);
    assert.deepEqual(errors, []);
  });
  test('the Photo pattern’s settings from a file: kept in range, or today’s default', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await pickPhoto(page);
    const xf = (await settings(page)).style.photo.xf;
    const photoOf = async (name, photo) => {
      await reopenAs(page, name, `p.style.photo = ${JSON.stringify(photo)};`);
      return {
        photo: (await settings(page)).style.photo,
        op: await page.evaluate(() => __mstest.styleVars.photoOp),
        paper: await page.evaluate(() => __mstest.styleVars.photoPaper),
      };
    };
    // (light: this photo isn't a page, so a file without a lighting correction reopens with none found, false)
    assert.deepEqual(await photoOf('op high', { xf, op: 5, paper: true }), {
      photo: { xf, op: 0.9, paper: true, light: false },
      op: 0.9,
      paper: true,
    });
    assert.deepEqual(await photoOf('op low', { xf, op: 0.05, paper: false }), {
      photo: { xf, op: 0.2, paper: false, light: false },
      op: 0.2,
      paper: false,
    });
    assert.deepEqual(await photoOf('op odd', { xf, op: 'x', paper: 'no' }), {
      photo: { xf, op: 0.65, paper: true, light: false },
      op: 0.65,
      paper: true,
    });
    assert.deepEqual(await photoOf('no paper', { xf }), {
      photo: { xf, op: 0.65, paper: true, light: false },
      op: 0.65,
      paper: true,
    });
    // a saved lighting correction is used as saved (on or off); one that can't be used is found again
    const light = { on: false, from: 'lined', gain: [1.5, 1.8, 2.2] };
    assert.deepEqual((await photoOf('light off', { xf, light })).photo, { xf, op: 0.65, paper: true, light });
    assert.deepEqual(
      (await photoOf('light on', { xf, light: { ...light, on: true, from: 'x' } })).photo.light,
      { on: true, from: 'page', gain: [1.5, 1.8, 2.2] },
    );
    assert.equal(
      await page.evaluate(() => __mstest.photoRef.data !== __mstest.photoRef.raw),
      true,
      'the saved correction is applied',
    );
    assert.equal(
      (await photoOf('light odd', { xf, light: { on: true, gain: [1, 'x', 2] } })).photo.light,
      false,
    );
    // a placement that can't be used: no photo (the see-through still goes back to its default)
    await photoOf('op set', { xf, op: 0.3, paper: false });
    assert.deepEqual(await photoOf('bad xf', { xf: { ...xf, sx: 0 }, op: 0.5, paper: false }), {
      photo: null,
      op: 0.65,
      paper: true,
    });
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.ref), undefined);
    assert.deepEqual(await photoOf('no photo', null), { photo: null, op: 0.65, paper: true });
    assert.deepEqual(errors, []);
  });
  test('Undo: every field it keeps goes back after a change that was never committed; section settings stay', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const v = await nonDefault(page);
    await openWith(page, 'All set', v);
    const s1 = await allSettings(page);
    // every field changed at once behind the controls' backs (nothing committed), then Ctrl+Z
    const flat2 = await page.evaluate(() => {
      const t = __mstest,
        sv = t.styleVars,
        o = t.assignData.order;
      Object.assign(sv, {
        family: 'blend',
        palette: 'cool',
        gradShape: 'diagonal',
        dir: 1,
        look: 'smooth',
        emphasis: 'vivid',
        limitN: 9,
        noAdj: false,
        gradSeed: 0.81,
        blendFall: 1.4,
        blendMix: 'vivid',
        texAmt: 0.9,
        radC: { x: 0.2, y: 0.25 },
        balance: 'main',
        balM: 'green',
        balS: 'auto',
        balA: 'red',
        balSeed: 0.9,
        noRep: false,
        shadeMode: 'shadow',
        shadeSun: { x: 0.1, y: 0.9 },
        shadeRound: 0.1,
        shadeLines: true,
        shadeHi: 0.8,
        shadeLo: 0.2,
        shadeLight: 'photo',
        shadeMain: true,
        shadeFlat: { [o[9]]: 1 },
        photoOp: 0.33,
        photoPaper: false,
        expand: false,
        expandChar: 0.9,
        paletteSource: 'owned',
        savedPalId: 55,
        shadeShadow: 'grey',
        shadeHilite: 'paper',
        genHarmony: 'split',
        genPal: [],
        minPos: 12,
        bgTrim: 70,
        addAutoClose: false,
      });
      return [o[9]];
    });
    const changed = await allSettings(page);
    assert.deepEqual(changed.style.shade.flat, flat2);
    assert.equal(changed.style.family, 'blend');
    await page.keyboard.press('Control+z');
    await idle(page);
    const s2 = await allSettings(page);
    // the section settings (Sections screen) aren't part of the plan's Undo
    assert.deepEqual(s2, { ...s1, minSize: 12, bgTrim: 70, addAutoClose: false });
    assert.deepEqual(errors, []);
  });
  test('Undo: each style control’s change is one step, and Undo puts every setting back', async () => {
    const { page, errors } = await openApp({ init: SEEDED });
    await sampleGuide(page);
    // shading on first, so its controls are there
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    for (const [what, tab, act] of CONTROLS) {
      await page.click(`.sftabbtn[data-t="${tab}"]`);
      await idle(page);
      const before = await allSettings(page),
        n = await page.evaluate(() => __mstest.planCount);
      await act(page);
      await idle(page);
      const mid = await allSettings(page);
      assert.notDeepEqual(mid, before, what + ' changed something');
      assert.equal(await page.evaluate(() => __mstest.planCount), n + 1, what + ': one step');
      await page.keyboard.press('Control+z');
      await idle(page);
      assert.deepEqual(await allSettings(page), before, what + ': Undo');
      // and again, to carry on from the change
      await act(page);
      await idle(page);
      assert.deepEqual(await allSettings(page), mid, what + ': the same change again');
    }
    assert.deepEqual(errors, []);
  });
  test('Undo: the photo’s see-through, white areas and placement are steps too', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await pickPhoto(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    await page.evaluate(() => __mstest.shadeTo('full'));
    await idle(page);
    const steps = [
      ['photoOp', (p) => slide(p, 'sfPhOp', 55)],
      ['photoPaper', (p) => click(p, '#sfPhPaper')],
      ['photoXf', (p) => click(p, '#sfPhFit [data-v="fit"]')],
      ['shadeLight', (p) => click(p, '#sfShLight [data-v="sun"]')],
    ];
    for (const [what, act] of steps) {
      const before = await allSettings(page);
      await act(page);
      await idle(page);
      assert.notDeepEqual(await allSettings(page), before, what + ' changed something');
      await page.keyboard.press('Control+z');
      await idle(page);
      assert.deepEqual(await allSettings(page), before, what + ': Undo');
    }
    assert.deepEqual(errors, []);
  });
  test('a guide file: every field survives Share › Guide file and Import', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const v = await nonDefault(page);
    await openWith(page, 'Shared', v);
    const s1 = await allSettings(page);
    const [dl] = await Promise.all([page.waitForEvent('download'), click(page, '#sfShareGuide')]);
    const text = await readFile(await dl.path(), 'utf8');
    const file = JSON.parse(text);
    assert.deepEqual(file.payload.style, s1.style);
    await page.evaluate(
      (text) => SF.importFile(new File([text], 'shared.msguide.json', { type: 'application/json' })),
      text,
    );
    await page.waitForFunction(
      () => __mstest.curName === 'Shared' && __mstest.curId != null && __mstest.assignData,
      null,
      { timeout: 10000 },
    );
    await idle(page);
    assert.deepEqual(await allSettings(page), s1);
    assert.deepEqual(errors, []);
  });
  test('a new picture (the sample) keeps the style and section settings; only the flat sections go, and Scatter starts at Polished', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const v = await nonDefault(page);
    v.style = { ...v.style, ...SCAT };
    await openWith(page, 'All set', v);
    await page.evaluate(() => {
      __mstest.styleVars.photoOp = 0.44;
      __mstest.styleVars.photoPaper = false;
    });
    const s1 = await allSettings(page);
    assert.deepEqual([s1.style.gradScat, s1.style.gradJit, s1.style.gradFix], [3, 0.6, true]);
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction(() => __mstest.assignData && __mstest.curName !== 'All set');
    await idle(page);
    // (the photo's white areas go back to white; its see-through stays; "Shade Main" is shaded again, as it goes with
    // the zones, which a new picture doesn't have; Radial's centre is the middle again, a place on the old picture)
    // (v306, deliberately: Scatter is chosen per guide, so a new picture starts at Polished with none smoothed, and
    // saves nothing of it)
    const { gradScat, gradJit, gradFix, ...rest } = s1.style;
    (void gradScat, void gradJit, void gradFix);
    // (v308: a guide from before Include gets the Include row with a new picture, as the Mood has it: {})
    assert.deepEqual(await allSettings(page), {
      ...s1,
      style: { ...rest, radC: null, incl: {}, shade: { ...s1.style.shade, flat: [], main: true } },
      photoPaper: true,
    });
    assert.deepEqual(
      await page.evaluate(() => [
        __mstest.styleVars.gradScat,
        __mstest.styleVars.gradJit,
        __mstest.styleVars.gradFix,
      ]),
      [0, 0, false],
    );
    assert.deepEqual(errors, []);
  });
  test('an old guide missing a field opens with today’s default for it, and the rest as saved', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    const v = await nonDefault(page);
    await openWith(page, 'All set', v);
    const s1 = await settings(page);
    let n = 0;
    for (const k of Object.keys(DEF_STYLE)) {
      if (k === 'photo') continue; // (no photo either way: see the Photo pattern tests)
      const style = { ...v.style };
      delete style[k];
      await openWith(page, 'Missing ' + k, { ...v, style });
      // (a Random guide from before Balance opens Mixed, as it looked)
      assert.deepEqual(
        await settings(page),
        { ...s1, style: { ...s1.style, [k]: k === 'balance' ? 'mixed' : DEF_STYLE[k] } },
        'missing ' + k,
      );
      n++;
    }
    for (const k of Object.keys(DEF_STYLE.shade)) {
      const shade = { ...v.style.shade };
      delete shade[k];
      await openWith(page, 'Missing shade ' + k, { ...v, style: { ...v.style, shade } });
      // (a guide from before v281 has no lightSrc: its light says, and this one's is the sun)
      // (and light, written for older copies, follows lightSrc, whatever the file said)
      const want = k === 'lightSrc' ? 'sun' : k === 'light' ? s1.style.shade.light : DEF_STYLE.shade[k];
      assert.deepEqual(
        await settings(page),
        { ...s1, style: { ...s1.style, shade: { ...s1.style.shade, [k]: want } } },
        'missing shade.' + k,
      );
      n++;
    }
    for (const k of Object.keys(DEF_PAY)) {
      // (the smallest section is also saved as minPos on the old scale, which is read when minSize isn't there)
      await openWith(page, 'Missing ' + k, {
        ...v,
        [k]: '__delete',
        ...(k === 'minSize' ? { minPos: '__delete' } : {}),
      });
      assert.deepEqual(await settings(page), { ...s1, [k]: DEF_PAY[k] }, 'missing ' + k);
      n++;
    }
    assert.equal(n, 27 + 15 + 3);
    // (v306) Scatter's: missing, Polished, with nothing else of it written
    {
      const sc = { ...v.style, ...SCAT };
      await openWith(page, 'Scatter', { ...v, style: sc });
      assert.deepEqual((await settings(page)).style, { ...s1.style, ...SCAT });
      const { gradScat, ...noScat } = sc;
      void gradScat;
      await openWith(page, 'Missing gradScat', { ...v, style: noScat });
      assert.deepEqual((await settings(page)).style, { ...s1.style, gradFix: true }, 'missing gradScat');
    }
    // a guide saved before v277 has only minPos, on the old scale: 26 (137 px) opens as about the same size
    await openWith(page, 'Before v277', { ...v, minSize: '__delete', minPos: 26 });
    assert.equal((await settings(page)).minSize, 80);
    // no shading at all, or not an object: all of it default
    for (const shade of ['__delete', null, 'full', 7]) {
      await openWith(page, 'Shade ' + shade, { ...v, style: { ...v.style, shade } });
      assert.deepEqual((await settings(page)).style.shade, DEF_STYLE.shade, 'shade: ' + shade);
    }
    // no style at all, or not an object
    for (const style of ['__delete', null, 'gradient', 3]) {
      await openWith(page, 'Style ' + style, { ...v, style });
      assert.deepEqual((await settings(page)).style, DEF_STYLE, 'style: ' + style);
    }
    await openWith(page, 'Nothing', {
      style: '__delete',
      minPos: '__delete',
      minSize: '__delete',
      bgTrim: '__delete',
      addAutoClose: '__delete',
    });
    assert.deepEqual(await settings(page), { style: DEF_STYLE, ...DEF_PAY });
    assert.deepEqual(errors, []);
  });
  test('odd values in a saved file (wrong type, out of range, unknown choice) open as they do today', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await openWith(page, 'Odd', { style: ODD_TYPES, ...ODD_TYPES_PAY });
    assert.deepEqual(await settings(page), { style: ODD_TYPES_OPEN, ...DEF_PAY });
    await openWith(page, 'High', { style: ODD_HIGH, ...ODD_HIGH_PAY });
    assert.deepEqual(await settings(page), {
      style: ODD_HIGH_OPEN,
      minSize: 100,
      bgTrim: 100,
      addAutoClose: true,
    });
    await openWith(page, 'Low', { style: ODD_LOW, ...ODD_LOW_PAY });
    assert.deepEqual(await settings(page), {
      style: ODD_LOW_OPEN,
      minSize: 0,
      bgTrim: 0,
      addAutoClose: false,
    });
    await openWith(page, 'Unknown', { style: ODD_ENUM, ...DEF_PAY });
    const mk5 = await page.evaluate(() => mkey(5));
    assert.deepEqual(await settings(page), {
      style: { ...ODD_ENUM_OPEN, genPal: ODD_ENUM_OPEN.genPal.map((k) => (k === '<mkey 5>' ? mk5 : k)) },
      ...DEF_PAY,
    });
    // more than 64 generated-palette markers: the first 64 are read
    await openWith(page, 'Long', {
      style: { ...DEF_STYLE, genPal: Array.from({ length: 70 }, (_, i) => 'k' + i) },
    });
    assert.deepEqual(
      (await settings(page)).style.genPal,
      Array.from({ length: 64 }, (_, i) => 'k' + i),
    );
    // other names the harmony check lets through today, and one it doesn't
    for (const [h, want] of [
      ['custom', 'custom'],
      ['photo', 'photo'],
      ['toString', 'toString'],
      ['mono', 'mono'],
      ['Triadic', 'analogous'],
    ]) {
      await openWith(page, 'Harmony ' + h, { style: { ...DEF_STYLE, genHarmony: h } });
      assert.equal((await settings(page)).style.genHarmony, want, h);
    }
    // numbers that aren't finite (possible through the test seam, not in a JSON file): the default, not the limit
    await page.evaluate(() => {
      const d = __mstest.currentDesignObj(),
        p = d.payload;
      p.style = {
        limitN: Infinity,
        gradSeed: NaN,
        blendFall: -Infinity,
        texAmt: NaN,
        radC: { x: NaN, y: Infinity },
        balSeed: NaN,
        expandChar: Infinity,
        savedPalId: Infinity,
        shade: { x: Infinity, y: NaN, round: -Infinity },
      };
      p.minSize = Infinity;
      delete p.minPos;
      p.bgTrim = NaN;
      __mstest.openDesignObj(Object.assign({}, p, { name: 'Infinite', W: d.W, H: d.H }), null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Infinite');
    await idle(page);
    assert.deepEqual(await settings(page), { style: DEF_STYLE, ...DEF_PAY });
    // an imported file goes through the same checks
    const good = await page.evaluate(() => __mstest.currentDesignObj());
    await page.evaluate(
      (d) => SF.importFile(new File([JSON.stringify(d)], 'odd.msguide.json', { type: 'application/json' })),
      { ...good, name: 'Imported odd', payload: { ...good.payload, style: ODD_HIGH, ...ODD_HIGH_PAY } },
    );
    // (v308: the same picture and sections are in the Library already, kept as the guides above opened: Add a copy, which
    // is named as a copy is)
    await page.click('#sfEdAsk [data-a="copy"]');
    await page.waitForFunction(
      () => __mstest.curName === 'Imported odd (2)' && __mstest.curId != null && __mstest.assignData,
      null,
      { timeout: 10000 },
    );
    await idle(page);
    assert.deepEqual(await settings(page), {
      style: ODD_HIGH_OPEN,
      minSize: 100,
      bgTrim: 100,
      addAutoClose: true,
    });
    assert.deepEqual(errors, []);
  });
}
