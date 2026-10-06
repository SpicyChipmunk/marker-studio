// v306 (home branch): Home's "latest piece" hero; the Rainbow palette scheme; the shorter To buy toasts; From photo's
// "Paper looks warm · Make it white".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  idle,
  welcome,
  until,
  sampleGuide,
  saveGuide,
  openAtScale,
} from './helpers.mjs';

before(setup);
after(teardown);

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
    await page.evaluate(() => rainbowOrder(SF.rainbowPick(16, 'neutral', COLORS.map((c, i) => i).filter(inPool), {}))),
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

// ---- Home's latest piece -------------------------------------------------------------------------------------------
// the sample guide, every section ticked and saved: { id }
async function finishedSample(page) {
  await sampleGuide(page);
  await saveGuide(page);
  await page.evaluate(() => {
    const t = __mstest;
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
    return h && h.offsetParent && h.querySelector('.hhname') ? h.querySelector('.hhname').textContent : null;
  });
const heroArt = (page) => page.waitForSelector('#homeHero .hhbox img', { timeout: 10000 });
const rect = (page, sel) =>
  page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e || !e.getClientRects().length) return null;
    const r = e.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  }, sel);

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
  // deleted: the next newest is not finished (reset): the start card, no latest piece
  await copyOf(page, a, 9204, 'Reset', 'none', -2000);
  await goHome(page);
  assert.equal(await heroName(page), null, 'the newest isn’t finished');
  assert.ok(await page.isVisible('#homeCont .hcstart'));
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
