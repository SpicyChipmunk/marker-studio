// Home: tiles, the Continue card, the latest guide, counts.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  answerAsks,
  haveSet,
  idle,
  letterGuide,
  openApp,
  openAtScale,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  setup,
  teardown,
  until,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from v306-home.test.mjs ----
// v306 (home branch): Home's "latest piece" hero; the Rainbow palette scheme; the shorter To buy toasts; From photo's
// "Paper looks warm · Make it white".
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v306',
    ...extra,
  });
  const OWN = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|BG311',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      collView: 'all',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      wish: [],
      ink: {},
      ...extra,
    });
  const toastText = (page) =>
    page.evaluate(() => document.getElementById('msToast').textContent.replace(/\s*Undo$/, ''));
  // the toast's lines: the distinct tops of its text and button
  const toastLines = (page) =>
    page.evaluate(() => {
      const r = document.createRange();
      r.selectNodeContents(document.getElementById('msToast'));
      return new Set(
        [...r.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top + q.height / 2)),
      ).size;
    });
  // ---- Palette › From photo: "Paper looks warm · Make it white" -----------------------------------------------------
  // a photo of a page: paper over most of it, colour patches on the right (as palette.test's)
  const photoOf = (page, paper) =>
    page
      .evaluate((paper) => {
        const c = document.createElement('canvas');
        c.width = 200;
        c.height = 120;
        const g = c.getContext('2d');
        g.fillStyle = paper;
        g.fillRect(0, 0, 200, 120);
        [
          '#c0392b',
          '#e67e22',
          '#f1c40f',
          '#27ae60',
          '#2980b9',
          '#8e44ad',
          '#6d4c41',
          '#1b1b1b',
          '#d35490',
        ].forEach((f, k) => {
          g.fillStyle = f;
          g.fillRect(110 + (k % 3) * 30, ((k / 3) | 0) * 40, 30, 40);
        });
        return c.toDataURL('image/png').split(',')[1];
      }, paper)
      .then((b) => ({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
  const photoPal = (page) => page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
  async function choosePhoto(page, paper) {
    const n = await page.evaluate(() => state.palettes.length);
    await page.setInputFiles('#photoFile', await photoOf(page, paper));
    await until(page, (n) => state.palettes.length > n, n, 'the photo palette');
    await idle(page);
  }
  // ---- Home's latest piece -------------------------------------------------------------------------------------------
  // the sample guide, every section ticked and saved: { id }
  async function finishedSample(page) {
    await sampleGuide(page);
    await saveGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      // (v313: the sample with ticks to try it isn't on Continue until it's printed or renamed: as if renamed)
      t.styleVars.smpTry = 0;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.updateProgress();
      t.renderGuide();
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page, 1500);
    return page.evaluate(() => __mstest.curId);
  }
  // a copy of guide `a` in the Library: prog 'all', 'some' or 'none' ticked, dated `ago` ms back; its id
  const copyOf = (page, a, id, name, prog, ago) =>
    page.evaluate(
      ([a, id, name, prog, ago]) =>
        IDB.get('guide-' + a).then((pl) => {
          const e = state.saved.find((s) => s.id === a),
            order = Object.keys(pl.assign).map(Number);
          const p = {
            ...pl,
            tones: undefined,
            prog: prog === 'all' ? order : prog === 'some' ? order.slice(0, 5) : [],
          };
          return sfSaveDesign({
            id,
            name,
            W: e.W,
            H: e.H,
            keys: e.keys,
            n: e.n,
            payload: p,
            quiet: true,
            keepTs: true,
            ts: Date.now() - ago,
          });
        }),
      [a, id, name, prog, ago],
    );
  const goHome = async (page) => {
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
  };
  const heroName = (page) =>
    page.evaluate(() => {
      const h = document.getElementById('homeHero');
      return h && h.offsetParent && h.querySelector('.hhname')
        ? h.querySelector('.hhname').textContent
        : null;
    });
  const heroArt = (page) => page.waitForSelector('#homeHero .hhbox img', { timeout: 10000 });
  const rect = (page, sel) =>
    page.evaluate((sel) => {
      const e = document.querySelector(sel);
      if (!e || !e.getClientRects().length) return null;
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    }, sel);
  // ---- the To buy toasts --------------------------------------------------------------------------------------------

  for (const [width, height] of [
    [390, 844],
    [820, 1180],
    [1180, 820],
  ]) {
    test(`To buy toasts: one line at ${width}: "Added Ohuhu BV310 · taken off To buy", "Added 12 markers · 3 off To buy"`, async () => {
      const wish = ['Ohuhu|BV310', 'Ohuhu|R210', 'Ohuhu|R215', 'Ohuhu|R211'].map((k, j) => ({
        k,
        why: 'from Match a colour',
        ts: j + 1,
      }));
      const own = OWN.filter((k) => k !== 'Ohuhu|BV310');
      const { page, errors } = await openApp({
        width,
        height,
        storage: onboarded({ [KEY]: appState({ owned: own, wish }) }),
      });
      await page.click('#mCollection');
      await idle(page);
      // the widest single code there is, to be sure
      await page.fill('#q', 'BV310');
      await idle(page);
      const i = await page.evaluate(() => keyIdx('Ohuhu|BV310'));
      await page.click(`#results .cell[data-i="${i}"]`);
      await idle(page);
      assert.equal(await toastText(page), 'Added Ohuhu BV310 · taken off To buy');
      assert.equal(await toastLines(page), 1, 'one line');
      // Tick all shown: 12 or more markers, 3 of them on To buy
      await page.fill('#q', 'R2');
      await idle(page);
      await page.click('#ownAll');
      await idle(page);
      const t = await toastText(page);
      assert.match(t, /^Added \d\d markers · 3 off To buy$/);
      assert.equal(await toastLines(page), 1, t);
      assert.deepEqual(errors, []);
    });
  }
  test('From photo: warm paper offers "Paper looks warm · Make it white", never applied by itself; ✕ undoes it', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.click('#mPalette');
    await page.click('#harm [data-h="photo"]');
    await idle(page);
    // white paper: no offer
    await choosePhoto(page, '#fbfbf8');
    assert.equal(await page.isVisible('#photoWarm'), false, 'white paper');
    // a grey, slightly warm page as a phone takes it (L 72): too dark to be sure it's paper
    await choosePhoto(page, '#baafa0');
    assert.equal(await page.isVisible('#photoWarm'), false, 'grey paper');
    // warm paper (L 80, b* 10): offered, and nothing corrected yet
    await choosePhoto(page, '#cec4b3');
    await page.click('#photoSize [data-n="6"]');
    await idle(page);
    assert.ok(await page.isVisible('#photoWarm'));
    assert.equal((await page.textContent('#photoWarm')).trim(), 'Paper looks warm · Make it white');
    assert.equal(await page.evaluate(() => _photoFix), null, 'never automatic');
    const p0 = await photoPal(page),
      src0 = await page.getAttribute('#photoThumb', 'src');
    assert.deepEqual(p0, await page.evaluate(() => extractPhotoPalette(_photoImg, 6, null).markers.slice()));
    const box = await page.locator('#photoWarm').boundingBox();
    assert.ok(box.height >= 40, 'a button you can tap: ' + box.height);
    // the tap: the palette from the corrected photo, which the thumbnail shows; the offer gives way to the ✕ chip
    await page.click('#photoWarm');
    await idle(page);
    assert.equal(await page.isVisible('#photoWarm'), false);
    assert.ok(await page.isVisible('#photoLight'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'photoLight');
    const p1 = await photoPal(page);
    assert.notDeepEqual(p1, p0);
    assert.deepEqual(
      p1,
      await page.evaluate(() => extractPhotoPalette(_photoImg, 6, _photoFix).markers.slice()),
    );
    // the same correction as tapping the paper would give
    const same = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = _photoImg.width;
      c.height = _photoImg.height;
      c.getContext('2d').drawImage(_photoImg, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
        s = paperSpot(patchLin(d, c.width, c.height, 40, 60, 4)).fix.gain;
      return _photoFix.gain.every((g, k) => Math.abs(g - s[k]) < 0.01);
    });
    assert.ok(same, 'the paper tap’s correction');
    assert.match(await page.getAttribute('#photoThumb', 'src'), /^data:image\/jpeg/);
    // ✕: as it was, and offered again
    await page.click('#photoLight');
    await idle(page);
    assert.equal(await page.evaluate(() => _photoFix), null);
    assert.deepEqual(await photoPal(page), p0);
    assert.equal(await page.getAttribute('#photoThumb', 'src'), src0);
    assert.ok(await page.isVisible('#photoWarm'), 'offered again');
    // tapping the paper by hand also takes the offer away; a new white photo has none
    await page.click('#photoPaper');
    const r = await page.locator('#photoThumb').boundingBox();
    await page.mouse.click(r.x + r.width * 0.2, r.y + r.height * 0.5);
    await idle(page);
    assert.equal(await page.isVisible('#photoWarm'), false);
    await choosePhoto(page, '#fbfbf8');
    assert.equal(await page.isVisible('#photoWarm'), false);
    assert.equal(await page.isVisible('#photoLight'), false);
    assert.deepEqual(errors, []);
  });
  // ---- Palette's Rainbow scheme ---------------------------------------------------------------------------------------
  test('Palette › Rainbow: its line, sizes 6–16, the Gradient’s own first, Generate rolls another, a band re-rolls in its gap', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.click('#mPalette');
    await idle(page);
    await page.click('#harm [data-h="rainbow"]');
    await idle(page);
    assert.equal(await page.textContent('#harmDesc'), 'Round the rainbow from red'); // (v308: lightness follows hue now)
    const sizes = await page.$$eval('#segs button', (bs) =>
      bs.filter((b) => b.offsetParent).map((b) => +b.dataset.n),
    );
    assert.deepEqual(sizes, [6, 8, 10, 12, 14, 16]);
    assert.equal(await page.evaluate(() => state.palSize), 6, 'the size moves into its range');
    await page.click('#segs [data-n="16"]');
    await idle(page);
    const pal = () => page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
    const p0 = await pal();
    assert.equal(p0.length, 16);
    assert.equal(await page.locator('#bands .band').count(), 16);
    // (v308: the Gradient's own markers, shown from red)
    assert.deepEqual(
      p0,
      await page.evaluate(() =>
        rainbowOrder(SF.rainbowPick(16, 'neutral', COLORS.map((c, i) => i).filter(inPool), {})),
      ),
    );
    assert.match(await page.textContent('#readout .fam'), /^Rainbow$/);
    assert.equal(await page.isVisible('#palClose'), false, 'no note: clearly different and round the wheel');
    // Generate: another rainbow
    await page.click('#draw');
    await until(page, () => !rolling, null, 'the roll');
    await idle(page);
    const p1 = await pal();
    assert.equal(p1.length, 16);
    assert.ok(await page.evaluate((p) => palOnScheme(p, 'rainbow'), p1));
    // a band: another marker, still round the wheel; Undo brings it back
    const band = page.locator('#bands .band').nth(3),
      box = await band.boundingBox();
    await band.click({ position: { x: box.width / 2, y: box.height - 8 } });
    await until(page, () => !rolling, null, 'the re-roll');
    await idle(page);
    const p2 = await pal();
    assert.notEqual(p2[3], p1[3]);
    assert.deepEqual(
      p2.filter((_, k) => k !== 3),
      p1.filter((_, k) => k !== 3),
    );
    assert.ok(await page.evaluate((p) => palOnScheme(p, 'rainbow'), p2));
    // a smaller size keeps it a rainbow; back to another scheme moves the size into that one's
    await page.click('#segs [data-n="8"]');
    await idle(page);
    assert.equal((await pal()).length, 8);
    await page.click('#harm [data-h="complementary"]');
    await idle(page);
    assert.equal(await page.evaluate(() => state.palSize), 8);
    assert.deepEqual(errors, []);
  });
  test('Palette › Rainbow: with fewer clear markers than asked, the clear ones and a line that says so', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await welcome(page, 'look');
    await page.evaluate(() => {
      state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === 'Ciao 12')));
      state.harmony = 'rainbow';
      state.palSize = 12;
      state.mode = 'palette';
      save();
      fullRender();
    });
    await page.click('#mPalette');
    await idle(page);
    await page.click('#draw');
    await until(page, () => !rolling, null, 'the roll');
    await idle(page);
    const p = await page.evaluate(() => state.palettes[state.palettes.length - 1].slice());
    assert.equal(p.length, 11);
    assert.ok(await page.evaluate((p) => p.every((i) => LCH[i][1] >= GREY_C), p), 'not the black');
    assert.equal(
      await page.textContent('#palClose'),
      'Your markers in play have 11 clear colours for a rainbow, not 12.',
    );
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: the newest guide, finished, above the columns; Choose a photo stays on screen; the box doesn’t move as the picture comes', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    // empty Home: none
    assert.equal(await page.isVisible('#homeHero'), false);
    const a = await finishedSample(page);
    await page.click('#mHome');
    await idle(page);
    // laid out at once from the Library: name, sections and markers, the ribbon, the box in the page's shape
    assert.equal(await heroName(page), await page.evaluate(() => homeName(state.saved[0])));
    const e = await page.evaluate((a) => state.saved.find((s) => s.id === a), a);
    assert.equal(await page.textContent('#homeHero .hhmeta'), `${e.n} sections · ${e.keys.length} markers`);
    assert.match(await page.getAttribute('#homeHero .hhribbon', 'style'), /linear-gradient/);
    assert.match(await page.getAttribute('#homeHero .hhcard', 'style'), /radial-gradient/);
    assert.doesNotMatch(await page.getAttribute('#homeHero .hhcard', 'style'), /blur/);
    const box0 = await rect(page, '#homeHero .hhbox'),
      hero0 = await rect(page, '#homeHero');
    await heroArt(page);
    await idle(page);
    const box1 = await rect(page, '#homeHero .hhbox'),
      hero1 = await rect(page, '#homeHero');
    assert.deepEqual(box1, box0, 'the box doesn’t move');
    assert.deepEqual(hero1, hero0, 'nor the page under it');
    assert.ok(Math.abs(box1.width / box1.height - e.W / e.H) < 0.02, 'the page’s shape');
    assert.match(await page.textContent('#homeHero .hhwhen'), /^Finished · \d{1,2} [A-Z][a-z]{2}$/);
    assert.equal(
      await page.evaluate(() => document.querySelector('#homeHero img').classList.contains('hhfade')),
      true,
    );
    // above the two columns, full width; the start card's Choose a photo still on screen, in both orientations
    for (const [w, h] of [
      [820, 1180],
      [1180, 820],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await idle(page);
      const hr = await rect(page, '#homeHero'),
        top = await rect(page, '.hometop'),
        go = await rect(page, '#homeCont [data-start="photo"]');
      assert.ok(hr.bottom <= top.top, `${w}: above the columns`);
      assert.ok(Math.abs(hr.width - top.width) < 2, `${w}: full width`);
      assert.ok(go && go.bottom <= h, `${w}: Choose a photo on screen (${go && go.bottom})`);
      const bx = await rect(page, '#homeHero .hhbox'),
        body = await rect(page, '#homeHero .hhbody');
      assert.ok(bx.right <= body.left, `${w}: picture and words side by side`);
    }
    // a phone: the Continue card's footprint, above New colouring guide
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    const hp = await rect(page, '#homeHero'),
      nb = await rect(page, '#homeNew'),
      pic = await rect(page, '#homeHero .hhpic');
    assert.ok(hp.height <= 240, 'phone height ' + hp.height);
    assert.ok(Math.abs(pic.width - 132) < 2);
    assert.ok(hp.bottom <= nb.top);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    // it isn't in Your guides too
    assert.equal(await page.locator(`#sfRecent .sfRecCard[data-gid="${a}"]`).count(), 0);
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: Continue keeps priority, a reset or a newer unfinished guide falls back, the newest finished wins, deleted drops out', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    const a = await finishedSample(page);
    // four older guides not started: with the latest piece left out first, Your guides still shows four
    for (let k = 0; k < 4; k++) await copyOf(page, a, 9101 + k, 'Older ' + k, 'none', (k + 1) * 3600e3);
    await goHome(page);
    assert.ok(await heroName(page));
    assert.equal(await page.locator('#sfRecent .sfRecCard:visible').count(), 4);
    assert.equal(await page.locator(`#sfRecent .sfRecCard[data-gid="${a}"]`).count(), 0);
    // an older finished one doesn't take its place
    await copyOf(page, a, 9201, 'Older finished', 'all', 7200e3);
    await goHome(page);
    assert.notEqual(await heroName(page), 'Older finished');
    // a newer finished one does
    await copyOf(page, a, 9202, 'Newer finished', 'all', -1000);
    await goHome(page);
    assert.equal(await heroName(page), 'Newer finished');
    await heroArt(page);
    // a guide in progress: Continue, and no latest piece
    await copyOf(page, a, 9203, 'In progress', 'some', 3 * 3600e3);
    await goHome(page);
    assert.equal(await heroName(page), null);
    assert.ok(await page.isVisible('#homeCont .hccard[data-cont]'));
    await page.evaluate(() => libDelete(9203));
    await goHome(page);
    assert.equal(await heroName(page), 'Newer finished');
    // deleted: the next newest is not finished (reset): no latest piece; (v318.32) it's on the card, as Open, where the
    // start card was
    await copyOf(page, a, 9204, 'Reset', 'none', -2000);
    await goHome(page);
    assert.equal(await heroName(page), null, 'the newest isn’t finished');
    assert.ok(await page.isVisible('#homeCont .hccard[data-gid="9204"]:not([data-cont])'));
    await page.evaluate(() => {
      libDelete(9204);
      libDelete(9202);
    });
    await goHome(page);
    assert.equal(
      await heroName(page),
      await page.evaluate((a) => homeName(state.saved.find((s) => s.id === a)), a),
    );
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: a guide whose picture can’t be read has none; Home is as it would be', async () => {
    const gone = {
      id: 77,
      type: 'guide',
      name: 'Unreadable',
      keys: ['Ohuhu|R014'],
      W: 3,
      H: 4,
      n: 1,
      done: 1,
      ts: Date.now(),
    };
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState({ mode: 'home', saved: [gone] }) }),
    });
    await idle(page);
    await page.waitForFunction(() => document.getElementById('homeHero').style.display === 'none', null, {
      timeout: 8000,
    });
    assert.ok(await page.isVisible('#homeCont .hcstart'), 'the start card');
    assert.ok(await page.isVisible('#sfRecent .sfRecCard[data-gid="77"]'), 'and the guide in Your guides');
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: Reveal & share and Print… open the guide and then act; the picture just opens it; not when another opens first', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const a = await finishedSample(page);
    await goHome(page);
    await heroArt(page);
    // the picture: the guide, in the plan
    await page.click('#homeHero .hhpic');
    await page.waitForFunction((a) => __mstest.curId === a && __mstest.sfmode === 'guide', a);
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')),
      false,
    );
    // Reveal & share, from another guide open: this one opens, then Reveal plays
    await copyOf(page, a, 9301, 'Other', 'none', 3600e3);
    await page.evaluate(() => SF.openDesign(9301));
    await page.waitForFunction(() => __mstest.curId === 9301);
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.click('#homeHeroGo');
    await page.waitForFunction(
      (a) => __mstest.curId === a && document.getElementById('sfRoot').classList.contains('sfrev'),
      a,
    );
    await page.keyboard.press('Escape');
    await idle(page, 1500);
    // Print…: the Print sheet
    await page.click('#mHome');
    await idle(page);
    await page.click('#homeHeroPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await page.keyboard.press('Escape');
    await idle(page);
    // another guide opened before it has: no Reveal
    await page.evaluate(() => SF.openDesign(9301));
    await page.waitForFunction(() => __mstest.curId === 9301);
    await page.click('#mHome');
    await idle(page);
    await page.evaluate((a) => {
      setMode('sections');
      SF.openThen(a, 'reveal');
      SF.openDesign(9301);
    }, a);
    await idle(page, 1500);
    assert.equal(await page.evaluate(() => __mstest.curId), 9301);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')),
      false,
    );
    // the open fails (its stored copy can't be read): nothing plays
    await page.evaluate(() => {
      window.__get = IDB.get;
      IDB.get = (k) =>
        /^guide-\d/.test(k)
          ? Promise.reject(new DOMException('gone', 'UnknownError'))
          : window.__get.call(IDB, k);
    });
    await page.evaluate((a) => {
      setMode('sections');
      SF.openThen(a, 'reveal');
    }, a);
    await idle(page, 1500);
    assert.equal(
      await page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev')),
      false,
    );
    assert.equal(await page.evaluate(() => __mstest.curId), 9301);
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: with Reduced motion the picture comes without a fade; large text keeps everything in its box', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await idle(page);
    await finishedSample(page);
    await goHome(page);
    await heroArt(page);
    assert.equal(
      await page.evaluate(() => document.querySelector('#homeHero img').classList.contains('hhfade')),
      false,
    );
    for (const w of [390, 360]) {
      await page.setViewportSize({ width: w, height: 844 });
      await idle(page);
      const r = await page.evaluate(() => {
        const card = document.querySelector('#homeHero .hhcard').getBoundingClientRect(),
          out = [];
        for (const e of document.querySelectorAll('#homeHero .hhbody *')) {
          const q = e.getBoundingClientRect();
          if (q.width && (q.right > card.right + 0.5 || q.left < card.left - 0.5))
            out.push(e.className || e.tagName);
          if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'hidden')
            out.push('cut ' + e.className);
        }
        return { out, sw: document.documentElement.scrollWidth, vw: innerWidth };
      });
      assert.deepEqual(r.out, [], w + ': inside the card');
      assert.ok(r.sw <= r.vw, w + ': no sideways scroll');
      for (const id of ['#homeHeroGo', '#homeHeroPrint']) {
        const b = await rect(page, id);
        assert.ok(b.height >= 44, id);
      }
    }
    assert.deepEqual(errors, []);
  });
}

// ---- from v3092.test.mjs ----
// v309.2: Ben's decisions after the v309.1 debugging pass. The blender a set brings is said, Home's guide card counts
// colours; the welcome warns when nothing can be kept; Back after "I'll do this later"; the welcome's adds come off
// To buy and lose Running low marks, as Markers' Add a set; Save image is named after the guide (e2e/v305-show); the
// keyboard on Reveal's ✕ while it plays; a very small picture is said to be too small; Scan's answer chips wrap as one
// line.
{
  const visible = (page, id) =>
    page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
  const KEY = 'ohuhu-hb320-picker-v3';
  // a page scaled down to a short side of `short` px, picked as a photo
  async function smallPage(page, short) {
    const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const b64 = await page.evaluate(
      async ([b, short]) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b;
        await img.decode();
        const k = short / Math.min(img.naturalWidth, img.naturalHeight),
          c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
      },
      [buf.toString('base64'), short],
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  // (v320, Ben's count rule: "markers" counts every marker, the blender too; "colours" the ink)
  test('a set from the welcome: its blender is said; Home counts every marker, its guide card colours', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), '121 markers added');
    assert.equal(
      await page.textContent('#wcDone'),
      'Honolulu 120 and its Colorless Blender are in your collection. Anything else?',
    );
    await page.click('#wcLook');
    await idle(page);
    assert.equal(await page.textContent('#homeView .hcsub'), '121 markers');
    assert.match(await page.textContent('#homeCont .hcstart'), /Built from your 120 colours\./);
    assert.deepEqual(errors, []);
  });
  test('all of a set’s colours already yours, not its blender: "Colorless Blender added"', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    // (owned, but not onboarded, so the welcome shows: the colours of Honolulu 24 + 48 bar the blender)
    await page.click('#wcHaveSet');
    await page.evaluate(() => {
      presetMkeys(MARKER_SETS[1])
        .filter((k) => k !== 'Ohuhu|0')
        .forEach((k) => state.owned.add(k));
    });
    await page.check('#wcSets input[data-i="1"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.equal(await page.textContent('#wcT2'), 'Colorless Blender added');
    assert.equal(
      await page.textContent('#wcDone'),
      'Honolulu 48 was already in your collection; its Colorless Blender is now too. Anything else?',
    );
    assert.deepEqual(errors, []);
  });
  test('storage blocked: the welcome says nothing will be kept, before anything is added', async () => {
    const block = () => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    };
    const { page, errors } = await openApp({ width: 820, height: 1180, init: block });
    await page.waitForSelector('#welcome.on');
    assert.ok(await page.isVisible('#wcStep0 .wcblocked'));
    assert.match(await page.textContent('#wcStep0 .wcblocked'), /nothing will be kept/);
    assert.deepEqual(errors, []);
  });
  test('"I’ll do this later" has Back (and Escape) to the three ways in', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcSkip');
    assert.equal(await page.textContent('#wcT2'), 'Explore with the full range');
    assert.ok(await visible(page, 'wcBack2'));
    await page.click('#wcBack2');
    assert.ok(await visible(page, 'wcStep0'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'wcSkip');
    await page.click('#wcSkip');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(await visible(page, 'wcStep0'), 'Escape is Back');
    // after a set, no Back on "Anything else?" (its Undo is the way back)
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="0"]');
    await page.click('#wcAdd');
    assert.equal(await visible(page, 'wcBack2'), false);
    assert.deepEqual(errors, []);
  });
  test('a set added in the welcome comes off To buy and loses its Running low mark; Undo puts both back', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        [KEY]: JSON.stringify({
          mode: 'home',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: [],
          saved: [],
          wish: [{ k: 'Ohuhu|R014', why: 'x', ts: 1 }],
          ink: { 'Ohuhu|R014': 'low' },
        }),
      },
    });
    await page.waitForSelector('#welcome.on');
    await page.click('#wcHaveSet');
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [
        state.owned.has('Ohuhu|R014'),
        state.wish.length,
        state.ink['Ohuhu|R014'] || null,
      ]),
      [true, 0, null],
    );
    // (v311: the Colorless Blender the set brings is said, as Markers' Add a set says it)
    assert.equal(
      await page.textContent('#wcDone'),
      'Honolulu 120 and its Colorless Blender are in your collection. Anything else?',
    );
    // (v318.26: the welcome's Undo is a link under that sentence, not a toast)
    await page.click('#wcUndoBtn');
    await idle(page);
    assert.deepEqual(
      await page.evaluate(() => [state.owned.size, state.wish.map((w) => w.k), state.ink['Ohuhu|R014']]),
      [0, ['Ohuhu|R014'], 'low'],
    );
    assert.deepEqual(errors, []);
  });
  test('Reveal: the keyboard is on its ✕ while it plays, then on Share', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfReveal');
    await page.waitForSelector('#sfRevX');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfRevX');
    await page.waitForSelector('#revShare', { timeout: 30000 });
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'revShare');
    assert.deepEqual(errors, []);
  });
  test('a very small picture is said to be too small, never told to raise Min section size', async () => {
    for (const [short, small] of [
      [40, true],
      [120, false],
    ]) {
      const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
      await welcome(page, 'look');
      await idle(page);
      await smallPage(page, short);
      const t = await page.evaluate(() => document.body.innerText);
      // (120 px: no warning in Chromium; Safari's scaling leaves it in fragments, said as too small too)
      if (small) assert.match(t, /This picture is very small \(\d+ × \d+ pixels\)/, short + ' px');
      assert.doesNotMatch(t, /Found a lot of tiny fragments/);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Scan’s answer chips: the words wrap as one line, "already yours" with them', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: {
        'ms-onboarded': '1',
        'ms-setup-tip': '1',
        'ms-scan-brand': '',
        [KEY]: JSON.stringify({
          mode: 'collection',
          ownedSeedV: 2,
          copicAdd1: 1,
          libAdj1: 1,
          setFix1: 1,
          owned: ['Ohuhu|R16'],
          saved: [],
        }),
      },
    });
    await idle(page);
    await scanFromMarkers(page);
    await page.fill('#scBox', 'R16');
    await page.press('#scBox', 'Enter');
    await idle(page);
    const chip = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.scchoose')].find((x) => /already yours/.test(x.textContent));
      const t = b.querySelector('.scchtx');
      return { inSpan: !!t && t.querySelector('i') != null, text: t.textContent };
    });
    assert.ok(chip.inSpan, 'already yours inside the words');
    assert.equal(chip.text, 'R16 Light Salmon · Ohuhu · already yours');
    assert.deepEqual(errors, []);
  });
}

// ---- from v3102.test.mjs ----
// v310.2: Ben's decisions from the v310.1 pass. An open guide follows a marker marked dry or unticked in Markers as
// opening it again would (sections still to colour show the closest you own; coloured ones keep theirs; the guide
// keeps the marker; back when it's yours again; not an Undo step); a locked Palette colour that can't be used is
// unlocked on Generate, with a word; Undo on "Page straightened" leaves "Page kept as photographed · Straighten";
// Home's guide card counts the colours guides use, saying how many marked dry are left out.
{
  test('Home’s guide card: the colours guides use, with how many marked dry are left out', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => {
      const ks = [...state.owned].filter((k) => k !== 'Ohuhu|0').slice(0, 2);
      ks.forEach((k) => (state.ink[k] = 'dry'));
      save();
    });
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    assert.match(
      await page.textContent('#homeCont .hcstart'),
      /Built from your 118 colours \(2 marked dry are left out\)\./,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v313-polish.test.mjs ----
// v313 polish (D11): Markers' line about the view under its row; Palette's Undo, Clear, Save and ⋯ on one row; the
// Library's empty state (what's kept there, Try the sample, no search box); the guide's start card in Home's words;
// Edit sections' shorter intro; the shimmer three times; the sample's ticks not on Home's Continue card until it's
// printed or renamed; Continue's "Last coloured N days ago". Each test fails on v312.
{
  const box = (page, s) => page.locator(s).boundingBox();
  // the sample, once the welcome has gone
  const loadSample = async (page) => {
    await page.evaluate(() => {
      window.__ld = __mstest.assignData;
      SF.loadSample();
    });
    await page.waitForFunction(() => !!__mstest.assignData && __mstest.assignData !== window.__ld, null, {
      timeout: 60000,
    });
    await idle(page);
  };
  const home = async (page) => {
    await page.click('#mHome');
    await idle(page);
  };
  const cont = (page) => page.evaluate(() => !!document.querySelector('#homeCont [data-cont]'));
  test('wording: the guide’s start card as Home says it; Edit sections’ intro; the shimmer runs three times', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await page.click('#mSections');
    await idle(page);
    assert.equal(
      await page.textContent('#sfStart .sftag'),
      'Turn a photo of a colouring page into a marker-by-number guide, built from the markers you own.',
    );
    assert.match(
      await page.textContent('#sfMeta'),
      /Lay the page flat in even light, and get all of it in the frame\./,
    );
    await loadSample(page);
    await answerAsks(page);
    // the shimmer on Colour along
    const it = await page.evaluate(() => {
      const b = document.querySelector('.sfcolorcta');
      return b ? getComputedStyle(b, '::before').animationIterationCount : null;
    });
    assert.equal(it, '3');
    await page.click('#sfBack2');
    await idle(page);
    const lines = await page.$$eval('#sfCtl .sfedline', (e) => e.map((x) => x.textContent.trim()));
    assert.ok(
      lines.includes('Merge, split or add where the lines didn’t come out right.'),
      JSON.stringify(lines),
    );
    assert.deepEqual(errors, []);
  });
  test('the sample with a few ticks isn’t on Home’s Continue card; once it’s no longer just tried (renamed or printed), it is', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      for (const l of t.assignData.order.slice(0, 3)) t.colored[l] = 1;
      t.guideDirty = true;
      t.saveNow();
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    await home(page);
    assert.equal(await cont(page), false, 'not on Continue');
    // renamed: on it
    await page.click('#mSections');
    await idle(page);
    await page.evaluate(() => {
      __mstest.styleVars.smpTry = 0;
      __mstest.guideDirty = true;
      __mstest.saveNow();
    });
    await idle(page);
    await home(page);
    assert.equal(await cont(page), true, 'on Continue');
    assert.deepEqual(errors, []);
  });
  test('the sample renamed with the name box, or its page printed, comes off "tried": smpTry', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 1);
    // the test strip doesn't count
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await page.click('[data-pwhat="strip"]');
    let [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
    await dl.path();
    assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 1, 'not for the test strip');
    await page.click('[data-pwhat="page"]');
    [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
    await dl.path();
    assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 0, 'its page printed');
    await page.click('#sfSheet [data-pr="cancel"]');
    await idle(page);
    // a fresh sample, renamed
    await loadSample(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 1);
    await page.click('#sfRename');
    await page.fill('#sfGName', 'My jellyfish');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.styleVars.smpTry), 0, 'renamed');
    assert.deepEqual(errors, []);
  });
  test('Home’s Continue card: “Last coloured 3 days ago” under how far along (nothing the same day)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.curName = 'Days test';
      for (const l of t.assignData.order.slice(0, 3)) t.colored[l] = 1;
      t.guideDirty = true;
      t.saveNow();
    });
    await page.waitForFunction(() => __mstest.inLibrary);
    await home(page);
    assert.equal(await page.isVisible('#homeCont .hcwhen'), false, 'today: nothing');
    await page.evaluate(() => {
      const g = state.saved.find((s) => s.type === 'guide' && s.name === 'Days test');
      g.lc = Date.now() - 3 * 864e5;
      renderRecent();
    });
    await idle(page);
    assert.equal(await page.textContent('#homeCont .hcwhen'), 'Last coloured 3 days ago');
    assert.match(
      await page.getAttribute('#homeCont [data-cont]', 'aria-label'),
      /\. Last coloured 3 days ago$/,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v31832-g2.test.mjs ----
// v318.32 (G2): Ben's iPad findings — Home features the guide worked on last, started or not; Edit sections after a
// guide is closed and opened again from the Library still offers the crop tools.
{
  // an iPad (11-inch class), portrait, with touch
  const IPAD = { width: 820, height: 1180, touch: true };
  const rect = (page, sel) =>
    page.evaluate((sel) => {
      const e = document.querySelector(sel);
      if (!e || !e.getClientRects().length) return null;
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    }, sel);
  // a copy of guide `a` in the Library: prog 'all', 'some' or 'none' ticked, dated `ago` ms back (as v306-home's)
  const copyOf = (page, a, id, name, prog, ago) =>
    page.evaluate(
      ([a, id, name, prog, ago]) =>
        IDB.get('guide-' + a).then((pl) => {
          const e = state.saved.find((s) => s.id === a),
            order = Object.keys(pl.assign).map(Number);
          const p = {
            ...pl,
            smp: undefined,
            tones: undefined,
            prog: prog === 'all' ? order : prog === 'some' ? order.slice(0, 5) : [],
          };
          return sfSaveDesign({
            id,
            name,
            W: e.W,
            H: e.H,
            keys: e.keys,
            n: e.n,
            payload: p,
            quiet: true,
            keepTs: true,
            ts: Date.now() - ago,
          });
        }),
      [a, id, name, prog, ago],
    );
  const goHome = async (page) => {
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
  };
  const card = (page) =>
    page.evaluate(() => {
      const c = document.querySelector('#homeCont .hccard[data-gid]');
      if (!c || !c.getClientRects().length) return null;
      const t = (s) => (c.querySelector(s) ? c.querySelector(s).textContent : null);
      return {
        gid: +c.getAttribute('data-gid'),
        cont: c.hasAttribute('data-cont'),
        eb: t('.hceb'),
        name: t('.hcname'),
        meta: t('.hcmeta'),
        go: t('.hcgo'),
        bar: !!c.querySelector('.hcbar'),
        label: c.getAttribute('aria-label'),
      };
    });
  const heroName = (page) =>
    page.evaluate(() => {
      const h = document.getElementById('homeHero');
      return h && h.offsetParent && h.querySelector('.hhname')
        ? h.querySelector('.hhname').textContent
        : null;
    });
  test('1: Home features the guide worked on last, started or not: a guide just built is on the card ("not started", Open → the plan); a newer one beats an older one started; a finished newer one leads as the latest piece', async () => {
    const { page, errors } = await openApp(IPAD);
    await sampleGuide(page);
    await saveGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const lid = await page.evaluate(() => __mstest.curId);
    await page.click('#mHome');
    await idle(page);
    // the newest guide, nothing coloured yet, on the card (it was the start card, the guide in Your guides)
    let c = await card(page);
    assert.ok(c, 'a guide on the card');
    assert.equal(c.gid, lid, 'the guide just built');
    assert.equal(c.cont, false, 'not Continue colouring');
    assert.equal(c.eb, 'Your latest guide');
    assert.equal(c.meta, 'not started · today');
    assert.equal(c.go, 'Open');
    assert.equal(c.bar, false, 'no progress bar');
    assert.match(c.label, /^Open your latest guide, .+: not started, saved today$/);
    await page.waitForSelector('#homeCont .hcpic img');
    assert.equal(await page.$('#homeCont .hcstart'), null, 'no start card');
    assert.deepEqual(
      await page.$$eval('#sfRecent .sfRecCard:not([hidden]) .sfRecName', (l) => l.map((x) => x.textContent)),
      ['Sample jellyfish'],
      'Your guides: the others',
    );
    assert.equal(
      await page.evaluate(() => document.getElementById('homeNew').classList.contains('homenew2')),
      true,
      'New colouring guide is the second choice beside it',
    );
    // the card and its Open on screen in both orientations
    for (const [w, h] of [
      [820, 1180],
      [1180, 820],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await idle(page);
      const go = await rect(page, '#homeCont .hcgo'),
        pic = await rect(page, '#homeCont .hcpic');
      assert.ok(go && go.bottom <= h && go.height >= 44, `${w}: Open on screen: ${JSON.stringify(go)}`);
      assert.ok(pic && pic.width > 80, `${w}: its picture`);
    }
    await page.setViewportSize({ width: 820, height: 1180 });
    await idle(page);
    // tap: the guide opens in the plan, not Colour along
    await page.click('#homeCont .hccard');
    await page.waitForFunction((id) => __mstest.curId === id && !!__mstest.assignData, lid);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide', 'the plan');
    // the sample, coloured a little, is older: the newest (not started) still leads
    const sid = await page.evaluate(
      (lid) => state.saved.find((s) => s.type === 'guide' && s.id !== lid).id,
      lid,
    );
    await copyOf(page, sid, 9301, 'Older started', 'some', 3600e3);
    await goHome(page);
    c = await card(page);
    assert.equal(c.gid, lid, 'the newest guide, not the older one started');
    // the older one started becomes the newest: Continue colouring, as before
    await copyOf(page, sid, 9301, 'Older started', 'some', -1000);
    await goHome(page);
    c = await card(page);
    assert.equal(c.gid, 9301);
    assert.equal(c.cont, true);
    assert.equal(c.eb, 'Continue colouring');
    assert.equal(c.go, 'Continue');
    // a finished guide newer than all: Continue keeps to the one part-way coloured, and no latest piece (as v306 had it)
    await copyOf(page, sid, 9302, 'Newest finished', 'all', -2000);
    await goHome(page);
    assert.equal(await heroName(page), null);
    c = await card(page);
    assert.equal(c && c.gid, 9301, 'Continue keeps to the guide part-way coloured');
    // a finished guide newer than a not-started one, none started: the latest piece, and the start card (as v306 had it)
    await page.evaluate(() => libDelete(9301));
    await goHome(page);
    assert.equal(await heroName(page), 'Newest finished');
    assert.equal(await card(page), null, 'no Continue card');
    assert.ok(await page.isVisible('#homeCont .hcstart'), 'the start card');
    assert.deepEqual(errors, []);
  });
  // Edit sections' Adjust photo (turn, straighten, crop, enhance, tilt) works on the photo, which a saved guide didn't
  // keep before v318.34: a guide opened again from the Library (after another guide, or a reload: the same guide opened
  // again straight away is still in memory, with its photo) had lost the whole group without a word
  test('2: Edit sections after a guide is opened again from the Library: Adjust photo stays, and says the photo isn’t kept, with the picker for a new guide', async () => {
    const { page, errors } = await openApp(IPAD);
    await sampleGuide(page);
    await saveGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId),
      other = await page.evaluate((id) => state.saved.find((s) => s.type === 'guide' && s.id !== id).id, id),
      adj = () =>
        page.evaluate(() => {
          const t = document.getElementById('sfAdjToggle');
          return {
            toggle: !!t && t.getClientRects().length > 0,
            crop: !!document.getElementById('sfCrop'),
            note: (document.getElementById('sfAdjNone') || {}).textContent || '',
          };
        }),
      openFromLib = async (gid) => {
        await page.click('#mHome');
        await idle(page);
        await page.evaluate(() => openLibrary());
        await idle(page);
        await page.click(`.srow[data-id="${gid}"] button.sopen`);
        await page.waitForFunction(
          (g) => __mstest.curId === g && !!__mstest.assignData && __mstest.sfmode === 'guide',
          gid,
        );
        await idle(page);
      };
    // as built: the tools
    await page.click('#sfBack2');
    await idle(page);
    if (!(await page.$('#sfCrop'))) await page.click('#sfAdjToggle');
    await idle(page);
    assert.deepEqual(await adj(), { toggle: true, crop: true, note: '' });
    // another guide, then this one again from the Library: opened from its stored copy
    // (v318.34: a guide saved since keeps its picture, so the tools come back once it's read, e2e/v31834-source-photo;
    // this is the guide without one: saved before v318.34, or its picture couldn't be kept)
    await page.evaluate((id) => IDB.del('src-' + id), id);
    await openFromLib(other);
    await openFromLib(id);
    await page.click('#sfBack2');
    await idle(page);
    let a = await adj();
    assert.ok(a.toggle, 'Adjust photo still there');
    if (!a.note) await page.click('#sfAdjToggle');
    await idle(page);
    // (v318.34: the record is looked for first; the note once it's found missing)
    await page.waitForSelector('#sfAdjNone');
    a = await adj();
    assert.equal(a.crop, false, 'no Crop: there is no photo to crop');
    assert.match(
      a.note,
      /^The photo isn’t kept with a saved guide, so this one can’t be turned, straightened or cropped again\./,
    );
    assert.ok(
      (await rect(page, '#sfRetake')).height >= 44,
      'Choose the photo again, a full tap, in the note',
    );
    // its link opens the picker, in the tap
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      page.click('#sfRetake'),
    ]);
    assert.ok(fc);
    // the sections are still editable and the guide as it was
    assert.ok(await page.isVisible('#sfEmMerge'));
    assert.equal(await page.evaluate(() => __mstest.curId), id);
    assert.deepEqual(errors, []);
  });
}

// ---- v322: the opening animation ----
// (Home Screen app only: window.__MS_INTRO stands for it here) on as the page is read, the drop's sections filling in,
// then it fades off Home and leaves the page within about a second; none with Reduce motion; none in a browser tab
{
  const seen = () => {
    // (whether it was on when the page's script had all run)
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        window.__introOn = document.documentElement.classList.contains('msintro-on');
        window.__introFills = document.querySelectorAll('#msIntro .msinf').length;
      },
      true,
    );
  };
  test('the opening animation: plays and goes once the page is in; none with Reduce motion, none in a tab', async () => {
    const { page, errors } = await openApp({
      init: () => {
        window.__MS_INTRO = true;
      },
    });
    await page.addInitScript(seen);
    await page.reload();
    assert.equal(await page.evaluate(() => window.__introOn), true, 'on');
    assert.equal(await page.evaluate(() => window.__introFills), 12, 'the drop’s twelve sections');
    await page.waitForFunction(() => !document.getElementById('msIntro'), null, { timeout: 3000 });
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('msintro-on')), false);
    // Reduce motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    assert.equal(await page.evaluate(() => window.__introOn), false, 'none with Reduce motion');
    assert.equal(await page.evaluate(() => !!document.getElementById('msIntro')), false);
    assert.deepEqual(errors, []);
    // a browser tab (no __MS_INTRO under test)
    const t = await openApp();
    await t.page.addInitScript(seen);
    await t.page.reload();
    assert.equal(await t.page.evaluate(() => window.__introOn), false, 'none in a tab');
    assert.equal(await t.page.evaluate(() => !!document.getElementById('msIntro')), false);
    assert.deepEqual(t.errors, []);
  });
}
