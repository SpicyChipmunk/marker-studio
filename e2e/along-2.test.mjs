// Colour along: the list, ticks, codes, run low, finding a marker.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  frames,
  idle,
  longPress,
  openApp,
  pause,
  sampleGuide,
  saveGuide,
  sectionPoint,
  setup,
  teardown,
  toolStatus,
  until,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from v306-along.test.mjs ----
// v306 (along): the same code in both brands marked wherever a marker is picked up (warnings only), finding a marker by
// its code in Colour along, the trimmed finish in Focus mode, "Did any run low?", and the PDF close-ups' brand tags in
// print colours.
{
  const AMBER = '#ffb454';
  // (v307: print's amber is darker, with a white letter: the screen's showed through pale yellow ink)
  const PRINT_AMBER = '#b45f06';
  // the sample at one marker per section from Ben's 451: Ohuhu and Copic Y26, R46 and RV09 are all in it (v308: laid as
  // a guide from before v308, everything included: a new guide's "all" is his 130 vivid markers, without Y26's mustard)
  async function benGuide(page) {
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
      SF.setCollection(sfCollection());
      __mstest.styleVars.limitN = 999;
      __mstest.styleVars.gradIncl = null;
      SF.reassign();
    });
    await idle(page);
  }
  const sameKeys = (page) => page.evaluate(() => Object.keys(__mstest.sameCodeScan().b).sort());
  // every brand tag drawn: its box's fill, its letter and the code drawn just before it (what: 'screen', 'pdf', 'image')
  const tagsOf = (page, what) =>
    page.evaluate((what) => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fill,
        oa = P.arcTo,
        ot = P.fillText,
        log = [],
        cv = document.getElementById('sfCanvas');
      let last = '';
      P.arcTo = function () {
        this.__tag = 1;
        return oa.apply(this, arguments);
      };
      P.fill = function () {
        if (this.__tag) {
          this.__tag = 0;
          this.__box = this.fillStyle;
        }
        return of.apply(this, arguments);
      };
      P.fillText = function (t) {
        if (this.__box) log.push({ box: this.__box, t: String(t), code: last, cv: this.canvas });
        else last = String(t);
        this.__box = null;
        return ot.apply(this, arguments);
      };
      let cvs;
      try {
        if (what === 'screen') {
          cvs = [cv];
          __mstest.forceFullRender();
          __mstest.renderGuide();
        } else if (what === 'pdf') cvs = __mstest.buildPDFPages();
        else if (what === 'card') cvs = [__mstest.buildShareCard()];
        else cvs = [__mstest.buildExportCanvas()];
      } finally {
        P.fill = of;
        P.arcTo = oa;
        P.fillText = ot;
      }
      return log
        .filter((e) => cvs.indexOf(e.cv) >= 0)
        .map((e) => ({ box: e.box, t: e.t, code: e.code, p: cvs.indexOf(e.cv) }));
    }, what);
  const fills = (page, fn) =>
    page.evaluate((fn) => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fill,
        ofr = P.fillRect,
        log = new Set();
      P.fill = function () {
        log.add(String(this.fillStyle));
        return of.apply(this, arguments);
      };
      P.fillRect = function () {
        log.add(String(this.fillStyle));
        return ofr.apply(this, arguments);
      };
      try {
        __mstest[fn]();
      } finally {
        P.fill = of;
        P.fillRect = ofr;
      }
      return [...log];
    }, fn);
  const along = async (page) => {
    await page.click('#sfColor');
    await idle(page);
  };
  const rowKeys = (page) => page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => r.dataset.k));
  const openKey = (page) =>
    page.evaluate(() => document.querySelector('#sfAlist .sfarow.open')?.dataset.k || null);
  // ---- Focus mode's finish ----
  async function finishInList(page) {
    await page.click('#sfColor');
    await idle(page);
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
  async function finishInFocus(page) {
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        ord = t.assignData.order;
      ord.slice(1).forEach((l) => {
        t.colored[l] = 1;
      });
    });
    await page.click('#sfFocus');
    await idle(page);
    await page.evaluate(() => {
      const c = document.getElementsByClassName('sfconfetti');
      window.__cf = [];
      new MutationObserver(() => {
        for (const x of c) if (!window.__cf.includes(x.className)) window.__cf.push(x.className);
      }).observe(document.body, { childList: true });
    });
    await page.click('#sfFDone');
    await idle(page);
  }
  // ---- Did any run low? ----
  const chips = (page, w) =>
    page.$$eval(`#sfLow${w} .sflowb`, (b) =>
      b.map(
        (x) =>
          x.textContent.trim() +
          (x.getAttribute('aria-pressed') === 'true' ? ' (on)' : '') +
          (x.tagName === 'BUTTON' ? '' : ' [not a button]'),
      ),
    );
  const shop = (page) => page.evaluate(() => ({ ink: { ...state.ink }, wish: state.wish.map((w) => w.k) }));
  test('same code: both brands of a code in one guide get a "2 brands" chip on their rows and a filled amber tag on the labels, the saved image and the PDF (page 1, close-ups and key); not on Reveal’s card', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    const same = await sameKeys(page);
    for (const c of ['Y26', 'R46', 'RV09'])
      assert.ok(same.includes('Ohuhu|' + c) && same.includes('Copic|' + c), c + ': ' + same);
    const codes = new Set(same.map((k) => k.split('|')[1]));
    // the labels: amber for those codes only
    const scr = await tagsOf(page, 'screen');
    assert.ok(
      scr.some((e) => e.box === AMBER),
      'some amber tags on screen',
    );
    for (const e of scr) assert.equal(e.box === AMBER, codes.has(e.code), 'screen: ' + JSON.stringify(e));
    const img = await tagsOf(page, 'image');
    assert.ok(img.some((e) => e.box === AMBER));
    for (const e of img) assert.equal(e.box === AMBER, codes.has(e.code), 'image: ' + JSON.stringify(e));
    // the PDF: page 1's labels and the close-ups' too, and in the key a filled tag before the code (drawn after its letter)
    const pdf = await tagsOf(page, 'pdf');
    assert.ok(
      pdf.some((e) => e.p === 0 && e.box === PRINT_AMBER),
      'page 1',
    );
    const kp = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        ot = P.fillText;
      let kc = null;
      P.fillText = function (t) {
        if (t === 'Colour key' && !kc) kc = this.canvas;
        return ot.apply(this, arguments);
      };
      let cvs0 = [];
      try {
        cvs0 = __mstest.buildPDFPages();
      } finally {
        P.fillText = ot;
      }
      return cvs0.indexOf(kc);
    });
    assert.ok(kp > 0, 'the key’s page: ' + kp);
    const key = pdf.filter((e) => e.p >= kp);
    assert.ok(
      key.length >= codes.size * 2 - 1 && key.every((e) => e.box === PRINT_AMBER),
      'the key: a filled tag on each such row: ' + JSON.stringify(key),
    );
    // the share card (Reveal's) has no tags, and no amber
    assert.ok(!(await fills(page, 'buildShareCard')).includes(AMBER), 'not on the share card');
    // Colour along's rows
    await page.click('#sfColor');
    await idle(page);
    const rows = await page.$$eval('#sfAlist .sfarow', (rs) =>
      rs.map((r) => ({
        k: r.dataset.k,
        chip: !!r.querySelector('.sf2b'),
        sr: r.querySelector('.sfsr:not(:first-child)')?.textContent || '',
        nm: r.querySelector('.nm').textContent,
      })),
    );
    for (const r of rows) assert.equal(r.chip, same.includes(r.k), r.k);
    const y = rows.find((r) => r.k === 'Ohuhu|Y26');
    assert.match(y.nm, /\(Copic Y26 is in this guide too\)/, 'a screen reader hears which: ' + y.nm);
    assert.equal(await page.getAttribute('#sfAlist .sf2b', 'aria-hidden'), 'true');
    assert.deepEqual(errors, []);
  });
  test('same code: Focus mode keeps its header and says "Not the Copic Y26" on its second line, which fits a phone; Change colour says the other brand is in the guide too', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await benGuide(page);
    // Change colour on Ohuhu Y26's section
    const l = await page.evaluate(
      () =>
        +Object.keys(__mstest.assignData.assign).find(
          (l) => __mstest.assignData.assign[l].mkey === 'Ohuhu|Y26',
        ),
    );
    await page.evaluate((l) => __mstest.openSectionPop(l), l);
    await idle(page);
    assert.equal(await page.textContent('#sfPopSame'), 'Copic Y26 is in this guide too');
    assert.equal(await page.isVisible('#sfPopSame'), true);
    // another marker picked: the line goes; Copic Y26 picked, it's still the other brand that's in the guide
    await page.click('#sfPopSw .sfsw[data-k="Ohuhu|Y28"]');
    await idle(page);
    assert.equal(await page.isVisible('#sfPopSame'), false);
    await page.click('#sfPopSw .sfsw[data-k="Copic|Y26"]');
    await idle(page);
    assert.equal(await page.isVisible('#sfPopSame'), false, 'Copic Y26 is now the only Y26');
    await page.click('#sfPopCancel');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), 'Ohuhu|Y26');
    // Focus mode on it
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.goFocus(t.focusOrd.findIndex((l) => t.assignData.assign[l].mkey === 'Ohuhu|Y26'));
    });
    await idle(page);
    assert.match(await page.textContent('#sfFocName'), /^O Y26 · Light Gold$/);
    assert.match(await page.textContent('#sfFocSub'), /^Section 1 of 1 · Not the Copic Y26/);
    const fit = await page.evaluate(() => {
      const s = document.getElementById('sfFocSub'),
        n = document.querySelector('.sffocnot');
      const r = n.getBoundingClientRect(),
        b = document.querySelector('.sffocbar').getBoundingClientRect();
      return {
        clip: s.scrollHeight - s.clientHeight,
        right: r.right,
        barR: b.right,
        lines: Math.round(s.clientHeight / parseFloat(getComputedStyle(s).lineHeight)),
      };
    });
    assert.ok(
      fit.clip <= 1 && fit.lines === 1 && fit.right <= fit.barR,
      'one line at 390, nothing cut off: ' + JSON.stringify(fit),
    );
    await page.evaluate(() => {
      const t = __mstest;
      t.goFocus(t.focusOrd.findIndex((l) => t.assignData.assign[l].mkey === 'Copic|R46'));
    });
    await idle(page);
    assert.match(await page.textContent('#sfFocSub'), /Not the Ohuhu R46/);
    await page.evaluate(() => {
      const t = __mstest;
      t.goFocus(t.focusOrd.findIndex((l) => !t.sameName(t.assignData.assign[l])));
    });
    await idle(page);
    assert.doesNotMatch(await page.textContent('#sfFocSub'), /Not the/);
    assert.deepEqual(errors, []);
  });
  test('same code: worked out when the guide is shown, so a saved guide reopens exactly as saved and gets the marks; with shading on, highlights and shadows count', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId),
      before = await page.evaluate(() => {
        const o = {};
        for (const l in __mstest.assignData.assign) o[l] = __mstest.assignData.assign[l].mkey;
        return o;
      });
    const keys = await page.evaluate(
      (id) =>
        sfLoadDesign(id).then((d) => {
          const ks = [];
          const walk = (o) => {
            if (!o || typeof o !== 'object') return;
            for (const k in o) {
              ks.push(k);
              walk(o[k]);
            }
          };
          walk(d);
          return ks;
        }),
      id,
    );
    assert.deepEqual(
      keys.filter((k) => /same|brand2|twin/i.test(k)),
      [],
      'nothing new is saved',
    );
    await page.evaluate(() => SF.loadSample());
    await page.waitForFunction((id) => __mstest.curId !== id, id);
    await idle(page);
    await page.evaluate((id) => sfLoadDesign(id).then((d) => __mstest.openDesignObj(d, id)), id);
    await idle(page);
    const again = await page.evaluate(() => {
      const o = {};
      for (const l in __mstest.assignData.assign) o[l] = __mstest.assignData.assign[l].mkey;
      return o;
    });
    assert.deepEqual(again, before, 'the same markers in the same sections');
    assert.ok((await sameKeys(page)).includes('Copic|Y26'));
    // shading: a section's shadow marker whose code another brand's marker has, laid on another section
    const r = await page.evaluate(() => {
      const t = __mstest;
      t.shadeMode = 'full';
      const A = t.assignData.assign,
        coll = t.coll;
      for (const l in A) {
        const s = t.shadeSec(+l);
        if (!s || !s.dark) continue;
        const o = coll.find((m) => m.code === s.dark.code && m.brand !== s.dark.brand);
        if (!o) continue;
        const l2 = +Object.keys(A).find(
          (x) =>
            +x !== +l &&
            A[x].mkey !== s.dark.mkey &&
            !Object.values(A).some((m) => m.code === o.code && m.brand === o.brand),
        );
        return { l: +l, dark: s.dark.mkey, other: o.mkey, l2 };
      }
      return null;
    });
    if (r) {
      await page.evaluate((r) => {
        const t = __mstest,
          A = t.assignData.assign;
        A[r.l2] = t.coll.find((m) => m.mkey === r.other);
        t.renderGuide();
      }, r);
      const s = await sameKeys(page);
      assert.ok(
        s.includes(r.dark) && s.includes(r.other),
        'a shadow partner and another brand’s base: ' + JSON.stringify(r) + ' ' + s,
      );
    } else assert.fail('no shadow with a two-brand code found');
    assert.deepEqual(errors, []);
  });
  test('find by code: typing only says what matches, above the box; Return filters to that marker, opens it and closes the keyboard; two brands ask which; old codes find nothing; clearing brings the whole list back, in the same order', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    await page.evaluate(() => localStorage.setItem('ms-along-sort', 'brand'));
    await along(page);
    const all = await rowKeys(page);
    // the box: 16px text, no corrections, capitals, Go
    const at = await page.evaluate(() => {
      const i = document.getElementById('sfFindIn');
      return {
        fs: getComputedStyle(i).fontSize,
        ac: i.getAttribute('autocorrect'),
        sc: i.getAttribute('spellcheck'),
        cap: i.getAttribute('autocapitalize'),
        ekh: i.getAttribute('enterkeyhint'),
        lineAbove:
          document.getElementById('sfFindL').getBoundingClientRect().bottom <= i.getBoundingClientRect().top,
      };
    });
    assert.deepEqual(at, {
      fs: '16px',
      ac: 'off',
      sc: 'false',
      cap: 'characters',
      ekh: 'go',
      lineAbove: true,
    });
    await page.click('#sfFindIn');
    await page.keyboard.type('y2');
    await idle(page);
    assert.match(await page.textContent('#sfFindL'), /^Codes starting Y2: /);
    await page.keyboard.type('6');
    await idle(page);
    assert.equal(await page.textContent('#sfFindL'), 'Copic Y26 Mustard · Ohuhu Y26 Light Gold');
    assert.deepEqual(await rowKeys(page), all, 'nothing filtered or opened while typing');
    assert.equal(await openKey(page), null);
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfFindL'), 'Two Y26s: which is in your hand?');
    assert.deepEqual((await rowKeys(page)).sort(), ['Copic|Y26', 'Ohuhu|Y26']);
    assert.equal(await openKey(page), null, 'neither opened');
    assert.notEqual(await page.evaluate(() => document.activeElement.id), 'sfFindIn', 'the keyboard closed');
    // one marker: its row opens, its sections shown
    await page.fill('#sfFindIn', 'g410');
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.deepEqual(await rowKeys(page), ['Ohuhu|G410']);
    assert.equal(await openKey(page), 'Ohuhu|G410');
    assert.equal(await page.evaluate(() => __mstest.hlKey), 'Ohuhu|G410');
    assert.match(await page.textContent('#sfLive'), /G410/);
    // old codes are left out: Ohuhu RV18 (in the guide) was R14, which finds Copic R14 only
    assert.ok(
      await page.evaluate(() =>
        Object.values(__mstest.assignData.assign).some((m) => m.mkey === 'Ohuhu|RV18'),
      ),
    );
    await page.fill('#sfFindIn', 'R14');
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfFindL'), 'R14 Light Rouge');
    assert.deepEqual(await rowKeys(page), ['Copic|R14']);
    // a code no marker in the guide has
    await page.fill('#sfFindIn', 'E000');
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfFindL'), 'E000 isn’t in this guide');
    await page.fill('#sfFindIn', 'r99');
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfFindL'), 'No marker R99');
    // the ✕: the whole list again, in its order (By brand), and the order setting as it was
    await page.fill('#sfFindIn', 'g410');
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    await page.click('#sfFindX');
    await idle(page);
    assert.deepEqual(await rowKeys(page), all);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-along-sort')), 'brand');
    assert.equal(await page.getAttribute('#sfAlSort [data-v="brand"]', 'aria-pressed'), 'true');
    assert.equal(await openKey(page), 'Ohuhu|G410', 'the row opened stays open');
    assert.deepEqual(errors, []);
  });
  test('find by code: zone by zone shows each zone’s row and opens the first not finished; a match in the Done group shows; a highlight or shadow finds the markers it goes with', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-along-zones': '1' } });
    await sampleGuide(page);
    await idle(page);
    // a zone of the bottom part, then one marker in both zones
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    await page.fill('#sfZoneName', 'Tail');
    await page.press('#sfZoneName', 'Enter');
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy > t.H * 0.6);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    const k = await page.evaluate(() => {
      const t = __mstest,
        A = t.assignData.assign,
        ls = Object.keys(A).map(Number),
        m = A[ls.find((l) => t.zoneOf(l) === 0)];
      const tail = ls.filter((l) => t.zoneOf(l) !== 0).slice(0, 2);
      tail.forEach((l) => {
        A[l] = m;
      });
      // Main's sections of it all coloured
      ls.filter((l) => A[l].mkey === m.mkey && t.zoneOf(l) === 0).forEach((l) => {
        t.colored[l] = 1;
      });
      t.renderGuide();
      return { mk: m.mkey, code: m.code };
    });
    await along(page);
    // (Main's row finished, gathered in Done on entering)
    assert.ok(await page.isVisible('#sfDoneGrp'));
    await page.fill('#sfFindIn', k.code);
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    const rows = await rowKeys(page);
    assert.equal(rows.length, 2, 'a row for each zone: ' + rows);
    assert.ok(rows.every((r) => r.startsWith(k.mk + '@')));
    const op = await openKey(page);
    assert.ok(op && op !== rows.find((r) => r.endsWith('@0')), 'the Tail’s row, not finished, opens: ' + op);
    assert.match(await page.textContent('#sfAlist'), /Main/, 'the Done row says its zone');
    await page.click('#sfFindX');
    await idle(page);
    // a shadow: with shading on, its code finds the markers it shades
    await page.click('#sfDoneBtn');
    await idle(page);
    const p = await page.evaluate(() => {
      const t = __mstest;
      t.shadeMode = 'full';
      const A = t.assignData.assign,
        bases = new Set(Object.values(A).map((m) => m.code));
      for (const l in A) {
        const s = t.shadeSec(+l);
        if (s && s.light && !bases.has(s.light.code)) return { code: s.light.code, base: A[l].code };
      }
      return null;
    });
    assert.ok(p, 'a highlight that isn’t a base anywhere');
    await along(page);
    await page.fill('#sfFindIn', p.code);
    await idle(page);
    const line = await page.textContent('#sfFindL');
    assert.ok(line.startsWith(p.code + ': highlight for ') && line.includes(p.base), line);
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.ok(
      (await page.$$eval('#sfAlist .sfarow .nm b:not(.btag)', (b) => b.map((x) => x.textContent))).includes(
        p.base,
      ),
    );
    assert.deepEqual(errors, []);
  });
  test('find by code: "/" goes to the box; Escape clears it first and stays in Colour along; not in Focus mode', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    await along(page);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('/');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFindIn');
    assert.equal(await page.inputValue('#sfFindIn'), '', 'the / isn’t typed');
    await page.keyboard.type('g410');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal((await rowKeys(page)).length, 1);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.inputValue('#sfFindIn'), '');
    assert.ok((await rowKeys(page)).length > 10, 'the whole list');
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'color');
    // typed but not run: Escape clears that too, keeping the box focused
    await page.focus('#sfFindIn');
    await page.keyboard.type('y2');
    await idle(page);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.inputValue('#sfFindIn'), '');
    assert.equal(await page.textContent('#sfFindL'), '');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfFindIn');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.sfmode),
      'color',
      'Escape doesn’t leave Colour along (Back only)',
    );
    // Focus mode: no box, and / does nothing
    await page.click('#sfFocus');
    await idle(page);
    assert.equal(await page.$('#sfFindIn'), null);
    await page.keyboard.press('/');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.focus), true);
    assert.deepEqual(errors, []);
  });
  test('find by code with the iPad’s keyboard up in portrait: the picture stops being pinned and the line above the box shows with the box over the keyboard; pinned again once it goes', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    await along(page);
    const KB = 375;
    await page.focus('#sfFindIn');
    await page.evaluate((kb) => {
      __mstest.kbdSim = kb;
    }, KB);
    await frames(page);
    await page.keyboard.type('y26');
    await idle(page);
    const r = await page.evaluate(() => ({
      line: document.getElementById('sfFindL').getBoundingClientRect().toJSON(),
      box: document.getElementById('sfFindIn').getBoundingClientRect().toJSON(),
      pos: getComputedStyle(document.getElementById('sfView')).position,
      text: document.getElementById('sfFindL').textContent,
    }));
    assert.equal(r.pos, 'relative', 'not pinned');
    assert.ok(
      r.line.top >= 0 && r.box.bottom <= 1180 - KB,
      'the line and the box above the keyboard: ' + JSON.stringify(r),
    );
    assert.match(r.text, /Y26/);
    await page
      .screenshot({
        path: process.env.V306_SHOTS ? process.env.V306_SHOTS + '/find-keyboard-820.png' : '/dev/null',
      })
      .catch(() => {});
    await page.keyboard.press('Enter');
    await idle(page);
    await page.evaluate(() => {
      __mstest.kbdSim = 0;
    });
    await frames(page);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.getElementById('sfView')).position),
      'sticky',
      'pinned again',
    );
    assert.ok(
      (await page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue('--pinH')))) >
        100,
    );
    assert.deepEqual(errors, []);
  });
  // (v318.6: a GitHub run, Safari's engine, failed the test above once in a while: the picture, sized again as it stopped
  // being pinned, put back the height it takes when pinned, and Safari, showing the box as it was typed in, took the
  // page's scroll-padding from it and put the box under the keyboard)
  test('the keyboard up over the code box: the picture sized again keeps it unpinned, and the box stays above the keyboard as you type', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    await along(page);
    const KB = 375;
    await page.focus('#sfFindIn');
    await page.evaluate((kb) => {
      __mstest.kbdSim = kb;
    }, KB);
    await frames(page);
    // (what the picture's own resizing does)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await frames(page, 3);
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--pinH')), '0px');
    await page.keyboard.type('y26');
    await idle(page);
    const box = await page.evaluate(() => document.getElementById('sfFindIn').getBoundingClientRect().bottom);
    assert.ok(box <= 1180 - KB, 'the box above the keyboard: ' + box);
    // (the keyboard gone: pinned again, with its height)
    await page.keyboard.press('Enter');
    await page.evaluate(() => {
      __mstest.kbdSim = 0;
    });
    await frames(page);
    assert.ok(
      (await page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue('--pinH')))) >
        100,
    );
    assert.deepEqual(errors, []);
  });
  test('finishing in Focus mode: no toast over the art, a screen reader hears "Page finished" with what was coloured, and up to 80 marker strokes fly from the progress bar (none with Reduce motion); the list’s finished card has strokes of its own (v320: its confetti over the screen is gone)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    await finishInFocus(page);
    assert.match(await page.textContent('#sfFocName'), /Page finished/);
    const toast = await page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
    assert.doesNotMatch(toast, /Finished/, 'no toast');
    await page.waitForFunction(() =>
      /^Page finished\. 166 sections · 16 markers · coloured today\. Reveal & share is in the bar at the bottom\.$/.test(
        document.getElementById('sfLive').textContent,
      ),
    );
    assert.deepEqual(await page.evaluate(() => window.__cf), ['sfconfetti sfstrokes']);
    const n = await page.evaluate(() => __mstest.markerStrokesN);
    assert.ok(n > 0 && n <= 80, 'strokes: ' + n);
    // Reduce motion: none
    const b = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await b.page.emulateMedia({ reducedMotion: 'reduce' });
    await sampleGuide(b.page);
    await idle(b.page);
    await finishInFocus(b.page);
    await b.page.waitForFunction(() =>
      /^Page finished\./.test(document.getElementById('sfLive').textContent),
    );
    assert.deepEqual(await b.page.evaluate(() => window.__cf), [], 'no strokes');
    // (Colour along's list: the strokes in its finished card, from the card's edges; nothing over the whole screen)
    const c = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(c.page);
    await idle(c.page);
    await c.page.evaluate(() => {
      window.__cf = [];
      new MutationObserver(() => {
        for (const x of document.getElementsByClassName('sfconfetti'))
          if (!window.__cf.includes(x.className)) window.__cf.push(x.className);
      }).observe(document.body, { childList: true });
    });
    await finishInList(c.page);
    assert.deepEqual(await c.page.evaluate(() => window.__cf), []);
    await c.page.waitForFunction(() => __mstest.finishStrokesN > 0);
    errors.push(...c.errors);
    assert.deepEqual(errors.concat(b.errors), []);
  });
  test('run low: under Page finished and in Share, the five that covered most of the page; one tap is Running low and on To buy, with Undo; tapped again it goes back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    assert.equal(await page.$$eval('#sfLowS .sflow', (x) => x.length), 0, 'not before the page is finished');
    await finishInList(page);
    const top = await page.evaluate(() => [...__mstest.lowTop()]);
    assert.equal(top.length, 5);
    const c = await chips(page, 'A');
    assert.deepEqual(c, top.map((k) => k.split('|')[1]).concat('Another…'));
    const k = top[0],
      code = k.split('|')[1];
    await page.click(`#sfLowA [data-lk="${k}"]`);
    await idle(page);
    assert.equal(await page.textContent('#msToast'), code + ' running low · on To buy · Undo');
    assert.deepEqual(await shop(page), { ink: { [k]: 'low' }, wish: [k] });
    assert.equal(await page.getAttribute(`#sfLowA [data-lk="${k}"]`, 'aria-pressed'), 'true');
    await page.click('#toastAct');
    await idle(page);
    assert.deepEqual(await shop(page), { ink: {}, wish: [] }, 'Undo takes both back');
    // tapped again it goes back; one already on To buy keeps its entry
    await page.evaluate((k) => {
      state.wish.push({ k, why: 'from Markers', ts: 1 });
      save();
    }, top[1]);
    await page.click(`#sfLowA [data-lk="${top[1]}"]`);
    await idle(page);
    assert.deepEqual(await shop(page), { ink: { [top[1]]: 'low' }, wish: [top[1]] });
    await page.click(`#sfLowA [data-lk="${top[1]}"]`);
    await idle(page);
    assert.deepEqual(
      await shop(page),
      { ink: {}, wish: [top[1]] },
      'its To buy entry was there before: kept',
    );
    await page.click(`#sfLowA [data-lk="${k}"]`);
    await idle(page);
    await page.click(`#sfLowA [data-lk="${k}"]`);
    await idle(page);
    assert.deepEqual(await shop(page), { ink: {}, wish: [top[1]] }, 'the one this row added goes again');
    // Share › Show it off, from the Plan
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    assert.deepEqual(await chips(page, 'S'), c);
    assert.deepEqual(errors, []);
  });
  test('run low: a dry marker shows but can’t be tapped; Another… finds any marker of yours by code, two brands ask which; hidden with no markers of your own', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await benGuide(page);
    await finishInList(page);
    await page.evaluate(() => {
      state.ink['Ohuhu|Y26'] = 'dry';
      state.ink['Copic|Y26'] = 'low';
      save();
    });
    await page.click('#sfLowA [data-lmore]');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sfLowInA');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).fontSize), '16px');
    await page.keyboard.type('y26');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfLowLA'), 'Two Y26s: which is in your hand?');
    const c = await chips(page, 'A');
    assert.ok(c.includes('Ohuhu Y26 dry [not a button]'), c.join(' | '));
    assert.ok(c.includes('Copic Y26 (on)'), 'already marked: on');
    // one found: marked at once
    await page.fill('#sfLowInA', 'r310');
    await page.press('#sfLowInA', 'Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => state.ink['Ohuhu|R310']), 'low');
    assert.match(await page.textContent('#msToast'), /^R310 running low · on To buy/);
    await page.click('#sfLowA [data-lmore]');
    await idle(page);
    await page.fill('#sfLowInA', 'r99');
    await page.press('#sfLowInA', 'Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfLowLA'), 'No marker R99');
    // no markers of your own: no row
    await page.evaluate(() => {
      state.owned = new Set();
      save();
      __mstest.updateProgress();
      document.getElementById('sfLowA').innerHTML = '';
      __mstest.updateProgress();
    });
    assert.equal(await page.$$eval('#sfLowA .sflow', (x) => x.length), 0);
    assert.deepEqual(errors, []);
  });
  test('PDF close-ups: brand tags in print colours, near-black and white (they were the screen’s)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      COLORS.forEach((c, i) => {
        if (c.brand === 'Copic') state.owned.add(mkey(i));
      });
      save();
      SF.setCollection(sfCollection());
      __mstest.reassign();
    });
    await idle(page);
    const pdf = await tagsOf(page, 'pdf'),
      kp = await page.evaluate(() => __mstest.pdfCloseL);
    const cu = pdf.filter((e) => e.p > 0 && e.box !== PRINT_AMBER && !/^(Colour key)/.test(e.code));
    assert.ok(kp > 0 && cu.length > 0, 'close-ups with tags: ' + kp + ' ' + cu.length);
    for (const e of cu) assert.equal(e.box, e.t === 'C' ? '#ffffff' : '#1a1a1a', JSON.stringify(e));
    assert.deepEqual(errors, []);
  });
}

// ---- from v306-dbg-along.test.mjs ----
// v306 debugging pass (along): a search by code in Colour along keeps its rows when Whole picture / Zone by zone is
// chosen, and gives way to a press and hold on a section of another marker; "Did any run low?" names the brand in its
// toast for a code you own in both brands, as its chip does.
{
  const rows = (page) =>
    page.$$eval('#sfAlist .sfarow', (r) =>
      r.map((x) => x.dataset.k + (x.classList.contains('open') ? '*' : '')),
    );
  async function withTail(page) {
    await sampleGuide(page);
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    await page.fill('#sfZoneName', 'Tail');
    await page.press('#sfZoneName', 'Enter');
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy > t.H * 0.6);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
  }
  test('find by code: choosing Zone by zone or Whole picture with a search shown keeps that marker’s rows (the list had gone empty)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await withTail(page);
    const m = await page.evaluate(() => {
      const a = __mstest.assignData;
      return a.assign[a.order[0]];
    });
    await page.fill('#sfFindIn', m.code);
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.deepEqual(await rows(page), [m.mkey + '*']);
    await page.click('#sfAlOrder button[data-v="zones"]');
    await idle(page);
    const z = await rows(page);
    assert.ok(z.length >= 1, 'its rows, zone by zone: ' + z);
    assert.ok(
      z.every((k) => k.startsWith(m.mkey + '@')),
      z.join(),
    );
    assert.equal(await page.inputValue('#sfFindIn'), m.code, 'the search stays');
    await page.click('#sfAlOrder button[data-v="whole"]');
    await idle(page);
    assert.deepEqual(await rows(page), [m.mkey]);
    assert.deepEqual(errors, []);
  });
  test('find by code: press and hold a section of a marker the search doesn’t show: the whole list again, with its row open', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const code = await page.evaluate(() => __mstest.assignData.assign[__mstest.assignData.order[0]].code);
    await page.fill('#sfFindIn', code);
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.equal((await rows(page)).length, 1);
    const o = await page.evaluate((c) => {
      const t = __mstest,
        l = t.assignData.order.find((l) => t.assignData.assign[l].code !== c && t.comps[l].area > 3000);
      return { l, k: t.assignData.assign[l].mkey };
    }, code);
    const p = await sectionPoint(page, o.l);
    await longPress(page, p.x, p.y);
    await idle(page);
    const r = await rows(page);
    assert.ok(r.includes(o.k + '*'), 'its row is shown and open: ' + r.slice(0, 5));
    assert.ok(r.length > 1, 'the whole list');
    assert.equal(await page.inputValue('#sfFindIn'), '');
    assert.equal(await page.textContent('#sfFindL'), '');
    // a section of the marker searched for keeps the search
    await page.fill('#sfFindIn', code);
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    const q = await page.evaluate(() => __mstest.assignData.order[0]);
    const p2 = await sectionPoint(page, q);
    await longPress(page, p2.x, p2.y);
    await idle(page);
    assert.equal((await rows(page)).length, 1);
    assert.equal(await page.inputValue('#sfFindIn'), code);
    assert.deepEqual(errors, []);
  });
  test('run low: a code you own in both brands is named with its brand in the toast, as on its chip', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
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
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.updateProgress();
    });
    await idle(page);
    // (v311: the sample, now coloured, saves itself into the Library first, its "Saved in your Library" said in the same
    // live line; on GitHub's WebKit that came after the ink's, and was read instead)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('sfSaveSt');
        return !!el && el.style.display !== 'none' && /✓$/.test(el.textContent);
      },
      null,
      { timeout: 30000 },
    );
    // Another… Y26: both brands' chips, "Ohuhu Y26" and "Copic Y26"
    await page.click('#sfLowA [data-lmore]');
    await page.fill('#sfLowInA', 'Y26');
    await page.press('#sfLowInA', 'Enter');
    await idle(page);
    await page.click('#sfLowA [data-lk="Copic|Y26"]');
    await idle(page);
    assert.equal(await page.textContent('#sfLowA [data-lk="Copic|Y26"]'), 'Copic Y26');
    assert.equal(await page.textContent('#msToast'), 'Copic Y26 running low · on To buy · Undo');
    await page.click('#sfLowA [data-lk="Copic|Y26"]');
    await idle(page);
    assert.equal(await page.textContent('#sfLive'), 'Copic Y26 ink back to OK');
    assert.deepEqual(errors, []);
  });
}

// ---- from v306-smalls.test.mjs ----
// v306 small changes: find by code for a code that's only a highlight or shadow in the guide; "Did any run low?" ›
// Another… says when a marker is already marked (and Escape clears, then closes, its box); the run-low chips follow
// a change to a marker made while they show; the shorter untick toast; a guide smoothed with shading on reopens as
// saved.
{
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
    // (the guide's first save, said to a screen reader as it lands, over before the line read here: v320, run once)
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
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
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'sfLowInA',
      'the box stays for another',
    );
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
}

// ---- from v307-along.test.mjs ----
// v307 (along): Colour along through Reveal. A finished page stays in full colour after Focus mode, the code box
// survives another tab saving, shaded guides count their shading markers, a code in both brands outlines both
// markers, brand-aware names, the PDF key's order column, the find line naming zones, and the polish (the brand as
// a badge on screen and its name for screen readers, one "Page finished" announcement, "Saving…" only while
// writing, ticks fading out, the print tag, contrast).
{
  // the sample at one marker per section from Ben's 451: Ohuhu and Copic Y26, R46 and RV09 are all in it (v308: laid as
  // a guide from before v308, everything included: a new guide's "all" is his 130 vivid markers, without Y26's mustard)
  async function benGuide(page) {
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
      SF.setCollection(sfCollection());
      __mstest.styleVars.limitN = 999;
      __mstest.styleVars.gradIncl = null;
      SF.reassign();
    });
    await idle(page);
  }
  const along = async (page) => {
    await page.click('#sfColor');
    await idle(page);
  };
  const live = (page) => page.textContent('#sfLive');
  const rowKeys = (page) => page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => r.dataset.k));
  const openKey = (page) =>
    page.evaluate(() => document.querySelector('#sfAlist .sfarow.open')?.dataset.k || null);
  // how many of the guide's sections show in their own marker's colour at their label point (the picture as drawn)
  const inColour = (page) =>
    page.evaluate(() => {
      const t = __mstest,
        cv = document.getElementById('sfCanvas'),
        g = cv.getContext('2d'),
        A = t.assignData.assign;
      let n = 0,
        ok = 0;
      for (const l of t.assignData.order) {
        const p = t.labelPos(l),
          d = g.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data,
          h = A[l].hex,
          c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        n++;
        if (Math.max(Math.abs(d[0] - c[0]), Math.abs(d[1] - c[1]), Math.abs(d[2] - c[2])) <= 40) ok++;
      }
      return ok / n;
    });
  // ---- Bug 4: another tab saving the guide keeps the code box ----
  const AUTO = 2300;
  // ---- Bug 5: shaded guides count their shading markers ----
  // every line the PDF writes (fillText), page by page
  const pdfText = (page) =>
    page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        ot = P.fillText,
        log = [];
      P.fillText = function (t) {
        log.push({ cv: this.canvas, t: String(t) });
        return ot.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.fillText = ot;
      }
      return log.filter((e) => cvs.indexOf(e.cv) >= 0).map((e) => e.t);
    });
  // ---- Bug 7: a code in both brands outlines both markers ----
  // the outline over the picture: which sections, and which of the given colours its pixels have
  const outline = (page, hexes) =>
    page.evaluate((hexes) => {
      const o = document.querySelector('canvas.sfoutline');
      if (!o || o.style.display === 'none' || !o.dataset.secs) return null;
      const d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data,
        rgb = hexes.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))),
        n = hexes.map(() => 0);
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 250) continue;
        rgb.forEach((c, k) => {
          if (Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) < 12) n[k]++;
        });
      }
      return {
        secs: o.dataset.secs
          .split(' ')
          .map(Number)
          .sort((a, b) => a - b),
        px: n,
      };
    }, hexes);
  // ---- Bug 8 and the brand as a badge: brand-aware names wherever a code is named ----
  // what a screen reader hears of an element: its text without what's hidden from it (aria-hidden)
  const heard = (page, sel) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = el.cloneNode(true);
      c.querySelectorAll('[aria-hidden="true"]').forEach((x) => x.remove());
      return c.textContent.replace(/\s+/g, ' ').trim();
    }, sel);
  // what the eye sees: its text without the screen-reader-only parts, and its badges
  const seen = (page, sel) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = el.cloneNode(true);
      c.querySelectorAll('.sfsr').forEach((x) => x.remove());
      return {
        t: c.textContent.replace(/\s+/g, ' ').trim(),
        badges: [...el.querySelectorAll('.btag')].map((b) => b.textContent),
      };
    }, sel);
  // how strongly each ✓ is drawn on section l, in order, from now until it has gone
  // (v307.1: the watch is set up before the tap, then read: it was started alongside the tap, which could come first, so
  // the ✓ drawn at full strength could be missed; a very slow machine can still miss it, so it isn't required)
  const tickFade = async (page, l) => {
    await page.evaluate((l) => {
      const P = CanvasRenderingContext2D.prototype,
        ot = P.fillText,
        q = __mstest.labelPos(l),
        seen = [];
      P.fillText = function (t, x, y) {
        if (t === '✓' && Math.abs(x - q.x) < 0.5 && Math.abs(y - q.y) < 0.5) seen.push(this.globalAlpha);
        return ot.apply(this, arguments);
      };
      window.__tickFade = new Promise((res) => {
        const t0 = performance.now(),
          wait = () => {
            if (performance.now() - t0 > 1600) {
              P.fillText = ot;
              res(seen);
            } else setTimeout(wait, 50);
          };
        wait();
      });
    }, l);
    return () => page.evaluate(() => window.__tickFade);
  };
  // ---- Polish: contrast ----
  // the contrast of an element's text against what's behind it: its colour, faded by its own and its parents' opacity,
  // over the backgrounds under it (each laid over the page's)
  const contrast = (page, sel) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rgba = (s) => {
          const m = s.match(/[\d.]+/g).map(Number);
          return { c: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 };
        },
        over = (top, a, under) => top.map((v, i) => v * a + under[i] * (1 - a)),
        lum = (c) =>
          c
            .map((v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            })
            .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const chain = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
      let bg = rgba(getComputedStyle(document.body).backgroundColor).c;
      // backgrounds from the outside in, each with its element's opacity and its parents'
      const op = (n) => {
        let o = 1;
        for (let x = n; x && x.nodeType === 1; x = x.parentElement) o *= +getComputedStyle(x).opacity;
        return o;
      };
      for (let i = chain.length - 1; i >= 1; i--) {
        const b = rgba(getComputedStyle(chain[i]).backgroundColor);
        if (b.a > 0) bg = over(b.c, b.a * op(chain[i]), bg);
      }
      const own = rgba(getComputedStyle(el).backgroundColor);
      if (own.a > 0) bg = over(own.c, own.a * op(el), bg);
      const f = rgba(getComputedStyle(el).color),
        fg = over(f.c, f.a * op(el), bg),
        L1 = lum(fg),
        L2 = lum(bg);
      return Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100;
    }, sel);
  // ---- Bug 1: a finished page after Focus mode ----
  test('a page finished in Focus mode shows in full colour after ✕, with no row open', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await along(page);
    // a row open, then Focus mode from it; everything else already coloured
    const k = await page.evaluate(() => {
      const t = __mstest,
        ord = t.assignData.order,
        k = t.assignData.assign[ord[0]].mkey;
      ord.forEach((l) => {
        if (t.assignData.assign[l].mkey !== k) t.colored[l] = 1;
      });
      t.updateProgress();
      return k;
    });
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    assert.equal(await openKey(page), k);
    await page.click('#sfFocus');
    await idle(page);
    for (let i = 0; i < 400 && (await page.isVisible('#sfFDone')); i++) {
      await page.click('#sfFDone');
      await idle(page);
    }
    assert.match(await page.textContent('#sfFocName'), /Page finished/);
    await page.click('#sfExitFoc');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.focus), false);
    const f = await inColour(page);
    assert.ok(f > 0.95, 'the picture in its colours: ' + f);
    assert.equal(await openKey(page), null, 'no row reopened');
    assert.equal(await page.evaluate(() => __mstest.hlKey), null);
    // a row opened on the finished page doesn't fade the rest either
    await page.evaluate((k) => {
      const r = document.querySelector(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
      if (r && !r.closest('.sfarow').classList.contains('open')) r.click();
    }, k);
    await idle(page);
    assert.ok((await inColour(page)) > 0.95, 'still in full colour with a row open');
    assert.deepEqual(errors, []);
  });
  // idle(page, AUTO): until auto-save (1.5 s after the last change) has run
  test('another tab saving the same guide: the code box keeps its text, cursor and line, the row stays open and the box keeps the keyboard; a search run stays', async () => {
    const {
      ctx,
      page: a,
      errors,
    } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await benGuide(a);
    await saveGuide(a);
    await idle(a, AUTO);
    const id = await a.evaluate(() => __mstest.curId);
    const b = await ctx.newPage();
    b.on('pageerror', (e) => errors.push(e.message));
    await b.goto(a.url());
    await idle(b);
    await b.evaluate((id) => loadGuide({ id }), id);
    await b.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(b);
    await along(a);
    const k = (await rowKeys(a))[2];
    await a.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(a);
    await a.click('#sfFindIn');
    await a.keyboard.type('Y2');
    await a.keyboard.press('ArrowLeft');
    await idle(a);
    const line = await a.textContent('#sfFindL');
    assert.match(line, /^Codes starting Y2: /);
    // the other tab ticks a section and saves
    const n0 = await a.evaluate(() => __mstest.colored.reduce((x, y) => x + y, 0));
    await b.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order.find((l) => !t.colored[l]);
      t.colored[l] = 1;
      t.guideDirty = true;
      t.renderGuide();
    });
    await idle(b, AUTO);
    await until(
      a,
      (n) => __mstest.colored.reduce((x, y) => x + y, 0) === n + 1,
      n0,
      'the tick reaching this tab',
    );
    await idle(a);
    const st = await a.evaluate(() => {
      const i = document.getElementById('sfFindIn');
      return { v: i.value, foc: document.activeElement === i, s: i.selectionStart, e: i.selectionEnd };
    });
    assert.deepEqual(st, { v: 'Y2', foc: true, s: 1, e: 1 }, 'text, keyboard and cursor kept');
    assert.equal(await a.textContent('#sfFindL'), line, 'the line above the box');
    assert.equal(await openKey(a), k, 'the open row');
    assert.equal(await a.isVisible('#sfFindX'), true);
    // typing goes on into the box
    await a.keyboard.press('End');
    await a.keyboard.type('6');
    await idle(a);
    assert.equal(await a.inputValue('#sfFindIn'), 'Y26');
    assert.equal(await a.textContent('#sfFindL'), 'Copic Y26 Mustard · Ohuhu Y26 Light Gold');

    // a search run (Return): its rows and line stay through the next save
    await a.fill('#sfFindIn', 'g410');
    await a.press('#sfFindIn', 'Enter');
    await idle(a);
    assert.deepEqual(await rowKeys(a), ['Ohuhu|G410']);
    const line2 = await a.textContent('#sfFindL');
    await b.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order.find((l) => !t.colored[l]);
      t.colored[l] = 1;
      t.guideDirty = true;
      t.renderGuide();
    });
    await idle(b, AUTO);
    await until(
      a,
      (n) => __mstest.colored.reduce((x, y) => x + y, 0) === n + 2,
      n0,
      'the second tick reaching this tab',
    );
    await idle(a);
    assert.deepEqual(await rowKeys(a), ['Ohuhu|G410'], 'still only its rows');
    assert.equal(await openKey(a), 'Ohuhu|G410');
    assert.equal(await a.inputValue('#sfFindIn'), 'g410');
    assert.equal(await a.textContent('#sfFindL'), line2);
    assert.deepEqual(errors, []);
  });
  test('a shaded guide says "16 markers + 29 for shading" on Page finished, Focus mode’s finish, Reveal’s card, Home’s latest piece and the PDF; with shading off as before', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await benGuide(page);
    await saveGuide(page);
    // shading off: as before
    const n = await page.evaluate(
      () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
    );
    assert.ok(
      (await pdfText(page)).some((t) => new RegExp(` · ${n} markers · `).test(t)),
      'the PDF as before',
    );
    // shading on: how many markers the highlights and shadows take besides
    const x = await page.evaluate(() => {
      const t = __mstest;
      t.shadeMode = 'full';
      t.guideDirty = true;
      t.renderGuide();
      const A = t.assignData.assign,
        base = new Set(Object.values(A).map((m) => m.mkey)),
        ex = new Set();
      for (const l in A) {
        const s = t.shadeSec(+l);
        if (s) [s.light, s.dark].forEach((m) => m && !base.has(m.mkey) && ex.add(m.mkey));
      }
      return ex.size;
    });
    assert.ok(x > 0, 'shading takes other markers');
    const want = `${n} markers + ${x} for shading`;
    const pdf = await pdfText(page);
    assert.ok(
      pdf.some((t) => t.includes(want)),
      'the PDF key’s header: ' + pdf.filter((t) => / markers/.test(t)).join(' | '),
    );
    // finished in the list
    await along(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.checkComplete();
      t.updateProgress();
    });
    await idle(page);
    // (v320: the finished card shows the numbers; what a screen reader hears of them is its label, finishLine)
    assert.match(
      await page.getAttribute('#sfDoneSum', 'aria-label'),
      new RegExp(`^\\d+ sections · ${want.replace('+', '\\+')}`),
    );
    // Reveal's card
    const meta = await page.evaluate(() => __mstest.showModel().meta);
    assert.ok(meta.includes(want), meta);
    // Home's latest piece, once saved
    await idle(page, AUTO);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    assert.match(await page.textContent('#homeHero .hhmeta'), new RegExp(`· ${want.replace('+', '\\+')}$`));
    assert.deepEqual(errors, []);
  });
  test('a code in both brands: Return shows both markers’ sections on the picture, each outlined in its own colour, until a row is tapped', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    await along(page);
    const g = await page.evaluate(() => {
      const t = __mstest,
        A = t.assignData.assign,
        by = {};
      for (const l of t.assignData.order) {
        const m = A[l];
        if (m.code !== 'Y26') continue;
        (by[m.mkey] = by[m.mkey] || { hex: m.hex, s: [] }).s.push(l);
      }
      return by;
    });
    assert.deepEqual(Object.keys(g).sort(), ['Copic|Y26', 'Ohuhu|Y26']);
    const hexes = [g['Copic|Y26'].hex, g['Ohuhu|Y26'].hex];
    await page.fill('#sfFindIn', 'Y26');
    await page.press('#sfFindIn', 'Enter');
    await idle(page);
    assert.equal(await page.textContent('#sfFindL'), 'Two Y26s: which is in your hand?');
    assert.equal(await openKey(page), null, 'neither row opened');
    const o = await outline(page, hexes);
    assert.ok(o, 'outlined on the picture');
    assert.deepEqual(
      o.secs,
      [...g['Copic|Y26'].s, ...g['Ohuhu|Y26'].s].sort((a, b) => a - b),
    );
    assert.ok(o.px[0] > 0 && o.px[1] > 0, 'each in its own colour: ' + o.px);
    // their sections in full colour, the rest pale, as an open row shows
    const shown = await page.evaluate(() => {
      const t = __mstest,
        L = t.labels,
        d = document.getElementById('sfCanvas').getContext('2d').getImageData(0, 0, t.W, t.H).data,
        A = t.assignData.assign,
        r = { y26: 0, y26n: 0, rest: 0, restn: 0 },
        n = {},
        near = {};
      // how much of each section is near its marker's colour (its code drawn on it aside)
      for (let p = 0; p < L.length; p += 2) {
        const l = L[p],
          m = l > 0 && A[l];
        if (!m) continue;
        const c = [1, 3, 5].map((i) => parseInt(m.hex.slice(i, i + 2), 16));
        n[l] = (n[l] || 0) + 1;
        if (Math.max(...[0, 1, 2].map((i) => Math.abs(d[p * 4 + i] - c[i]))) <= 40)
          near[l] = (near[l] || 0) + 1;
      }
      for (const l of t.assignData.order) {
        if (!n[l]) continue;
        const own = (near[l] || 0) / n[l] > 0.5;
        if (A[l].code === 'Y26') {
          r.y26n++;
          if (own) r.y26++;
        } else {
          r.restn++;
          if (own) r.rest++;
        }
      }
      return r;
    });
    assert.equal(shown.y26, shown.y26n, 'both markers’ sections in their colours: ' + JSON.stringify(shown));
    assert.ok(shown.rest < shown.restn * 0.2, 'the rest pale: ' + JSON.stringify(shown));
    // a row tapped: that one marker, outlined as an open row is
    await page.click('#sfAlist .sfarow[data-k="Ohuhu|Y26"] .sfah');
    await idle(page);
    const o2 = await outline(page, hexes);
    assert.deepEqual(
      o2.secs,
      g['Ohuhu|Y26'].s.slice().sort((a, b) => a - b),
    );
    assert.deepEqual(o2.px, [0, 0], 'white and dark, as an open row’s');
    // closed again: both stay out (the search said which)
    await page.click('#sfAlist .sfarow[data-k="Ohuhu|Y26"] .sfah');
    await idle(page);
    assert.equal(await outline(page, hexes), null);
    assert.deepEqual(errors, []);
  });
  test('two brands in the collection: Mark all, its toast, Undo, the list’s and Focus mode’s screen-reader lines and the Colours sheet name the brand; the brand shows as a badge (Focus mode’s name line, Start colour), never a bare letter', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await benGuide(page);
    // Pattern › Start colour: a badge on screen, "Ohuhu R46" (or Copic) for a screen reader
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    const sc = await seen(page, '#sfGStartC'),
      m0 = await page.evaluate(() => __mstest.gradStartInfo().cols[0]);
    assert.deepEqual(sc.badges, [m0.brand[0]], 'the brand as a badge');
    assert.equal(await heard(page, '#sfGStartC'), `${m0.brand} ${m0.code} ${m0.name}`);
    // the list: opening a row, Mark all, its toast and Undo
    await along(page);
    await page.click('#sfAlist .sfarow[data-k="Ohuhu|Y26"] .sfah');
    await idle(page);
    assert.match(await live(page), /^Ohuhu Y26 Light Gold, 0 of \d+ coloured$/);
    await page.click('#sfMarkAll');
    await idle(page);
    assert.match(await live(page), /^(The Ohuhu Y26 section|All \d+ Ohuhu Y26 sections) coloured$/);
    assert.equal(await heard(page, '#msToast'), 'Marked all Ohuhu Y26 coloured Undo');
    assert.deepEqual((await seen(page, '#msToast')).badges, ['O']);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await live(page), 'Ticks as they were for Ohuhu Y26');
    // Focus mode from that row: the name line's badge, "Ohuhu Y26 · Light Gold" heard, the Colours sheet's Mark all
    await page.click('#sfFocus');
    await idle(page);
    const fn = await seen(page, '#sfFocName');
    assert.deepEqual(fn, { t: 'O Y26 · Light Gold', badges: ['O'] });
    assert.match(await live(page), /^Ohuhu Y26 · Light Gold\. Section 1 of \d+/);
    await page.click('#sfFocCols');
    await idle(page);
    assert.equal(await heard(page, '#sfFocAll'), 'Mark all Ohuhu Y26 done');
    assert.deepEqual((await seen(page, '#sfFocAll')).badges, ['O']);
    assert.ok(
      (await page.$$eval('#sfFocMk .focmk .fmc', (b) => b.map((x) => x.textContent))).includes('Ohuhu Y26'),
      'the sheet’s chips name the brand for a screen reader',
    );
    await page.click('#sfFocAll');
    await idle(page);
    assert.equal(await heard(page, '#msToast'), 'Marked all Ohuhu Y26 done Undo');
    assert.deepEqual(errors, []);
  });
  // (v320: the list's finished card has Reveal & share, the bar Share & print: each says where its Reveal is)
  test('finishing in the list says what was coloured, as Focus mode does: "Page finished. 166 sections · 16 markers … Reveal & share is in the card above the list."', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
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
    assert.match(
      await live(page),
      /^Page finished\. 166 sections · \d+ markers · coloured today\. Reveal & share is in the card above the list\.$/,
    );
    assert.deepEqual(errors, []);
  });
  // ---- Bug 10 and the print tag: the PDF key ----
  test('the PDF key: three-digit order numbers ("162nd") clear the tick box; a code in both brands has a darker amber tag with a white letter in print (the screen’s amber stays)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await benGuide(page);
    const r = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        osr = P.strokeRect,
        ot = P.fillText,
        of = P.fill,
        oa = P.arcTo,
        log = [];
      P.strokeRect = function (x, y, w, h) {
        log.push({ k: 'box', cv: this.canvas, x, w, h });
        return osr.apply(this, arguments);
      };
      P.arcTo = function () {
        this.__tag = 1;
        return oa.apply(this, arguments);
      };
      P.fill = function () {
        if (this.__tag) {
          this.__tag = 0;
          this.__box = String(this.fillStyle);
        }
        return of.apply(this, arguments);
      };
      P.fillText = function (t, x) {
        const s = String(t);
        // (v308: or the one NO. column, the same colouring order, where numbers stand in for codes on the page)
        if (/^\d+(st|nd|rd|th)?$/.test(s) && this.textAlign === 'right')
          log.push({ k: 'ord', cv: this.canvas, t: s, l: x - this.measureText(s).width });
        if (this.__box)
          log.push({ k: 'tag', cv: this.canvas, box: this.__box, ink: String(this.fillStyle), t: s });
        this.__box = null;
        return ot.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.strokeRect = osr;
        P.fillText = ot;
        P.fill = of;
        P.arcTo = oa;
      }
      const out = { gaps: [], tags: [] };
      let box = null;
      for (const e of log) {
        if (cvs.indexOf(e.cv) < 0) continue;
        if (e.k === 'box' && Math.abs(e.w - e.h) < 0.01 && e.w < 40) box = e;
        else if (e.k === 'ord' && box && box.cv === e.cv) {
          out.gaps.push({ t: e.t, gap: e.l - (box.x + box.w) });
          box = null;
        } else if (e.k === 'tag') out.tags.push({ box: e.box, ink: e.ink });
      }
      return out;
    });
    const three = r.gaps.filter((g) => g.t.replace(/\D/g, '').length >= 3);
    assert.ok(three.length > 50, 'three-digit order numbers: ' + three.length);
    const worst = Math.min(...r.gaps.map((g) => g.gap));
    assert.ok(worst >= 4, 'every order number clear of its box (device px): ' + worst);
    // print's amber: on page 1, the close-ups and the key
    const am = r.tags.filter((t) => t.box === '#b45f06');
    assert.ok(am.length > 3, 'print amber tags: ' + am.length);
    assert.ok(
      am.every((t) => t.ink === '#ffffff'),
      'white letters',
    );
    assert.ok(!r.tags.some((t) => t.box === '#ffb454'), 'not the screen’s amber');
    // the screen keeps its amber
    const scr = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        of = P.fill,
        seen = new Set();
      P.fill = function () {
        seen.add(String(this.fillStyle));
        return of.apply(this, arguments);
      };
      try {
        __mstest.forceFullRender();
        __mstest.renderGuide();
      } finally {
        P.fill = of;
      }
      return [...seen];
    });
    assert.ok(scr.includes('#ffb454') && !scr.includes('#b45f06'), 'the screen’s labels as they were');
    assert.deepEqual(errors, []);
  });
  // ---- Bug 11: the find line names the zones ----
  test('find by code with zones and shading: a highlight’s and a shadow’s zones are noted, and named in the line when they differ', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    // a zone of the bottom part
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    await page.fill('#sfZoneName', 'Tail');
    await page.press('#sfZoneName', 'Enter');
    await page.evaluate(() => {
      const t = __mstest,
        cl = Object.keys(t.assignData.assign)
          .map(Number)
          .filter((l) => t.comps[l].cy > t.H * 0.6);
      t.zoneMove(cl, t.zoneCur);
      t.reassign([0, t.zoneCur]);
    });
    await page.click('#sfZoneDone');
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest;
      t.shadeMode = 'full';
      t.renderGuide();
      const A = t.assignData.assign,
        want = {};
      // each highlight and shadow marker: the zones it's that in, from the guide itself
      for (const l in A) {
        const s = t.shadeSec(+l);
        if (!s) continue;
        [
          ['light', 'highlight'],
          ['dark', 'shadow'],
        ].forEach(([p, k]) => {
          const x = s[p];
          if (!x) return;
          const w = (want[x.code] = want[x.code] || {});
          (w[x.mkey] = w[x.mkey] || { highlight: {}, shadow: {} })[k][t.zoneOf(+l)] = 1;
        });
      }
      const out = { n: 0, bad: [], named: [] };
      for (const c in want) {
        const f = t.codeFind(c);
        for (const p of f.part) {
          out.n++;
          const w = want[c][p.m.mkey];
          if (JSON.stringify(w) !== JSON.stringify(p.zn)) out.bad.push([c, w, p.zn]);
          const ks = (o) => Object.keys(o).sort().join();
          if (ks(p.zn.highlight) && ks(p.zn.shadow) && ks(p.zn.highlight) !== ks(p.zn.shadow))
            out.named.push(t.findLine(f));
        }
      }
      return out;
    });
    assert.ok(r.n > 5, 'highlights and shadows found: ' + r.n);
    assert.deepEqual(r.bad, [], 'their zones noted');
    for (const line of r.named) assert.match(line, / in (Main|Tail)/, line);
    assert.deepEqual(errors, []);
  });
  // ---- Polish: "Saving…" only while writing; ticks fade out ----
  test('"Saving…" shows only while the guide is being written, not in the moment before every tick is saved', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page, AUTO);
    await along(page);
    // every text the line shows, and when the guide is written
    await page.evaluate(() => {
      const el = document.getElementById('sfSaveSt'),
        t0 = performance.now();
      window.__st = [];
      window.__w = [];
      new MutationObserver(() =>
        window.__st.push([Math.round(performance.now() - t0), el.textContent]),
      ).observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      const put = IDB.put,
        get = IDB.get;
      IDB.put = function (k) {
        if (/^guide-\d/.test(k)) window.__w.push(Math.round(performance.now() - t0));
        return put.apply(this, arguments);
      };
      // (v307.1: the save of a guide in the Library begins by reading its stored copy (sfSaveDesign), a moment before
      // it writes: "Saving…" from then on is right. Checked against the write alone, it once came 9 ms early in WebKit)
      window.__r = [];
      IDB.get = function (k) {
        if (/^guide-\d/.test(k)) window.__r.push(Math.round(performance.now() - t0));
        return get.apply(this, arguments);
      };
    });
    const l = await page.evaluate(() => __mstest.assignData.order[3]);
    const p = await sectionPoint(page, l);
    await page.mouse.click(p.x, p.y);
    await pause(page, 900, 'the moment before the save, which said "Saving…"');
    assert.match(await page.textContent('#sfSaveSt'), /Saved in your Library|Saves itself from now on/);
    assert.ok(await page.evaluate(() => __mstest.colored[__mstest.assignData.order[3]] === 1), 'ticked');
    await idle(page, AUTO);
    const { st, w, r } = await page.evaluate(() => ({ st: window.__st, w: window.__w, r: window.__r }));
    assert.equal(w.length, 1, 'written once: ' + JSON.stringify(w));
    // (the read just before the write: the save's own)
    const rd = r.filter((t) => t <= w[0]),
      began = rd.length ? Math.max(...rd) : w[0];
    // (v320, G1-13: a guide already in the Library keeps its line while a change is written, fainter, never
    // "Saving…": it had flickered after every tick)
    const saving = st.filter((x) => x[1] === 'Saving…');
    assert.deepEqual(saving, [], 'never "Saving…": ' + JSON.stringify({ st, w, r, began }));
    assert.match(await page.textContent('#sfSaveSt'), /^(Saved in your Library|Saves itself from now on) ✓$/);
    assert.deepEqual(errors, []);
  });
  test('a section ticked in Colour along: its ✓ shows for a second, then fades out over about 200 ms in three steps; at once with Reduce motion', async () => {
    for (const rm of [false, true]) {
      const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
      if (rm) await page.emulateMedia({ reducedMotion: 'reduce' });
      await sampleGuide(page);
      await along(page);
      const l = await page.evaluate(() => __mstest.assignData.order[5]);
      const p = await sectionPoint(page, l);
      const fade = await tickFade(page, l);
      await page.mouse.click(p.x, p.y);
      const a = await fade();
      // (v307.1: the draws as they come, each run of one value counted once, and not timed exactly: on a busy machine a
      // frame drawn at full strength can be missed, and the fade's steps can be drawn more than once)
      const steps = a.map((x) => Math.round(x * 100) / 100).filter((v, i, s) => !i || v !== s[i - 1]);
      if (rm) assert.deepEqual(steps, [1], 'Reduce motion: shown, then gone: ' + a);
      else {
        assert.ok(
          steps.length && steps.every((v) => [1, 0.75, 0.5, 0.25].includes(v)),
          'shown, then in steps: ' + a,
        );
        // (never back at full strength as the fade ends: it was, for a frame, in WebKit)
        assert.ok(
          steps.every((v, i) => !i || v < steps[i - 1]),
          'only ever fainter: ' + a,
        );
        assert.ok(steps.filter((v) => v < 1).length >= 2, 'at least two steps of the fade: ' + a);
      }
      // and then gone: drawn again, no ✓
      const left = await page.evaluate((l) => {
        const P = CanvasRenderingContext2D.prototype,
          ot = P.fillText,
          q = __mstest.labelPos(l);
        let n = 0;
        P.fillText = function (t, x, y) {
          if (t === '✓' && Math.abs(x - q.x) < 0.5 && Math.abs(y - q.y) < 0.5) n++;
          return ot.apply(this, arguments);
        };
        try {
          __mstest.renderGuide();
        } finally {
          P.fillText = ot;
        }
        return n;
      }, l);
      assert.equal(left, 0, 'gone');
      assert.deepEqual(errors, []);
    }
  });
  test('contrast: a finished row’s brand badge and Focus mode’s ← while there’s nothing to go back to are 4.5:1 or more', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await benGuide(page);
    await along(page);
    const k = (await rowKeys(page))[0];
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    await page.click('#sfMarkAll');
    await idle(page);
    const sel = `#sfAlist .sfarow.full[data-k="${k}"] .btag`;
    assert.ok(await page.$(sel), 'a finished row with a badge');
    const c1 = await contrast(page, sel);
    assert.ok(c1 >= 4.5, 'the badge: ' + c1);
    // (closed, not the open row's tint)
    await page.click(`#sfAlist .sfarow[data-k="${k}"] .sfah`);
    await idle(page);
    const c2 = await contrast(page, sel);
    assert.ok(c2 >= 4.5, 'the badge, row closed: ' + c2);
    await page.click('#sfFocus');
    await idle(page);
    // (at its first section, with nothing to go back to)
    await page.evaluate(() => __mstest.goFocus(0, false, true));
    await idle(page);
    assert.equal(await page.getAttribute('#sfFBack', 'disabled'), '');
    const c3 = await contrast(page, '#sfFBack');
    assert.ok(c3 >= 4.5, 'Focus mode’s ←: ' + c3);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3081-d4.test.mjs ----
// v308.2 (debugging pass, Colour along to outputs): contrast in Colour along and Focus mode, measured as the screen
// draws it (the text's colour, the opacity of it and everything it sits in, over the backgrounds under it).
{
  // the contrast of an element's text against what it's drawn on (WCAG's ratio)
  const contrast = (page, sel) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const parse = (c) => {
        const p = c
          .match(/rgba?\(([^)]+)\)/)[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      const over = (t, b) => ({
        r: t.r * t.a + b.r * (1 - t.a),
        g: t.g * t.a + b.g * (1 - t.a),
        b: t.b * t.a + b.b * (1 - t.a),
        a: 1,
      });
      const lum = (c) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
      };
      const layers = [];
      let op = 1;
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        op *= +cs.opacity;
        const c = parse(cs.backgroundColor);
        if (c.a > 0) layers.push(c);
      }
      let bg = { r: 0, g: 0, b: 0, a: 1 };
      for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
      const c0 = parse(getComputedStyle(el).color),
        fg = over({ ...c0, a: c0.a * op }, bg),
        a = lum(fg),
        b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }, sel);
  test('a finished page: Codes, off with nothing to show, has its words at 4.5:1 or better (it was faded to 1.8:1)', async () => {
    for (const [w, h] of [
      [820, 1180],
      [1180, 820],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h, storage: { 'ms-wake-told': '1' } });
      await sampleGuide(page);
      await idle(page);
      await page.click('#sfColor');
      await idle(page);
      await page.evaluate(() => {
        const t = __mstest;
        t.assignData.order.forEach((l) => (t.colored[l] = 1));
        t.updateProgress();
      });
      await idle(page);
      assert.equal(
        await page.evaluate(() => document.getElementById('sfCodes').disabled),
        true,
        'Codes is off',
      );
      // (its words where the row has room for them, else its icon, drawn in the same colour)
      const sel = (await page.isVisible('#sfCodes .sfzw')) ? '#sfCodes .sfzw' : '#sfCodes';
      const r = await contrast(page, sel);
      assert.ok(r >= 4.5, `${w}×${h}: Codes off reads at ${r.toFixed(2)}:1`);
      // and it still looks off: greyer than Greyscale beside it
      const ink = await page.evaluate(() =>
        ['sfCodes', 'sfVals'].map((id) => getComputedStyle(document.getElementById(id)).color),
      );
      assert.notEqual(ink[0], ink[1], 'not in the same ink as an active button');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Focus mode’s Colours sheet: each chip’s count is as clear as its code (it was faded under 4:1 on mid-tone markers)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFocCols');
    await idle(page);
    const n = await page.$$eval('#sfFocMk .focmk:not(.done)', (b) => b.length);
    assert.ok(n > 5);
    for (let i = 1; i <= n; i++) {
      const code = await contrast(page, `#sfFocMk .focmk:nth-child(${i}) .fmc`),
        count = await contrast(page, `#sfFocMk .focmk:nth-child(${i}) .fmn`);
      assert.ok(
        Math.abs(code - count) < 0.01,
        `chip ${i}: count ${count.toFixed(2)}:1, code ${code.toFixed(2)}:1`,
      );
    }
    assert.deepEqual(errors, []);
  });
  test('Focus mode’s Mark all … done, then ✕ while its Undo is still up: Undo puts the ticks back (it did nothing once Focus mode had closed)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-wake-told': '1' } });
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.click('#sfFocus');
    await idle(page);
    const done = () =>
      page.evaluate(() => __mstest.assignData.order.filter((l) => __mstest.colored[l]).length);
    await page.click('#sfFocCols');
    await idle(page);
    await page.click('#sfFocAll');
    await idle(page);
    const marked = await done();
    assert.ok(marked > 1, 'a marker’s sections marked done');
    assert.ok(await page.isVisible('#toastAct'), 'Undo offered');
    await page.click('#sfExitFoc');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.focus), false, 'Focus mode closed');
    assert.ok(await page.isVisible('#toastAct'), 'its Undo still showing');
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await done(), 0, 'the ticks as they were');
    // the list says so too
    assert.match(await toolStatus(page), /^0 of 166/);
    assert.deepEqual(errors, []);
  });
}
