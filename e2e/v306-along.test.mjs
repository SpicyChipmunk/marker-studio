// v306 (along): the same code in both brands marked wherever a marker is picked up (warnings only), finding a marker by
// its code in Colour along, the trimmed finish in Focus mode, "Did any run low?", and the PDF close-ups' brand tags in
// print colours.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle, saveGuide, frames } from './helpers.mjs';

before(setup);
after(teardown);

const AMBER = '#ffb454';
// (v307: print's amber is darker, with a white letter: the screen's showed through pale yellow ink)
const PRINT_AMBER = '#b45f06';
// the sample at one marker per section from Ben's 451: Ohuhu and Copic Y26, R46 and RV09 are all in it
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
const sameKeys = (page) => page.evaluate(() => Object.keys(__mstest.sameCodeScan()).sort());
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

const along = async (page) => {
  await page.click('#sfColor');
  await idle(page);
};
const rowKeys = (page) => page.$$eval('#sfAlist .sfarow', (rs) => rs.map((r) => r.dataset.k));
const openKey = (page) =>
  page.evaluate(() => document.querySelector('#sfAlist .sfarow.open')?.dataset.k || null);

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
  assert.deepEqual(at, { fs: '16px', ac: 'off', sc: 'false', cap: 'characters', ekh: 'go', lineAbove: true });
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
    await page.evaluate(() => Object.values(__mstest.assignData.assign).some((m) => m.mkey === 'Ohuhu|RV18')),
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
    (await page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue('--pinH')))) > 100,
  );
  assert.deepEqual(errors, []);
});

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
test('finishing in Focus mode: no toast over the art, a screen reader hears "Page finished" with what was coloured, and up to 80 marker strokes fly from the progress bar (none with Reduce motion); the list keeps its burst', async () => {
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
  await b.page.waitForFunction(() => /^Page finished\./.test(document.getElementById('sfLive').textContent));
  assert.deepEqual(await b.page.evaluate(() => window.__cf), [], 'no strokes');
  // (Colour along's list keeps its burst, not the strokes)
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
  assert.deepEqual(await c.page.evaluate(() => window.__cf), ['sfconfetti']);
  errors.push(...c.errors);
  assert.deepEqual(errors.concat(b.errors), []);
});

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
  assert.deepEqual(await shop(page), { ink: {}, wish: [top[1]] }, 'its To buy entry was there before: kept');
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
