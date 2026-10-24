// Home: tiles, the Continue card, the latest guide, counts.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import {
  ROOT,
  WK,
  answerAsks,
  haveSet,
  idle,
  letterGuide,
  libItem,
  notOnWebKit,
  openApp,
  openAtScale,
  openMenu,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { join } from 'node:path';

before(setup);
after(teardown);

// ---- from home.test.mjs ----
// Home: the app's name and the brands you own, guide names, the tiles at every text size, and one card at a time under
// the tiles (the backup reminder when due, then Add to Home Screen, then What's new).
{
  // ---- From the fourth review (outside the guide screen) ----
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v263',
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
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN,
      saved: [],
      ...extra,
    });
  // ---- From the fifth review (outside the guide screen) ----
  const SHOTS = process.env.SHOTS || '';
  // a folder: the layout tests save their screenshots there
  const onboardedV265 = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v265',
    ...extra,
  });
  async function shot(page, name) {
    if (!SHOTS) return;
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: `${SHOTS}/g3-${name}.png` });
  }
  // ---- From v265 ----
  const DAY = 864e5;
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const OWN3 = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
  const appState3 = (extra = {}) =>
    JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OWN3,
      saved: [],
      ...extra,
    });
  const onboardedNoVer = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', ...extra });
  // Safari in a tab (not on the Home Screen), with the automatic What's new switched on (it is off under the test seam)
  const safariTab = () => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false });
    window.__MS_HELP_AUTO = true;
  };
  const shown = (page, id) =>
    page.evaluate((id) => {
      const e = document.getElementById(id);
      return !!e && e.style.display !== 'none' && e.getClientRects().length > 0;
    }, id);
  const cards = async (page) => ({
    install: await shown(page, 'installCard'),
    backup: await shown(page, 'backupNudge'),
    news: await shown(page, 'whatsNew'),
  });
  const top = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().top, sel);
  const pal = (id, name) => ({ id, type: 'palette', name, keys: ['Ohuhu|R014'], ts: id });
  // ---- From v267 ----
  const toastText = (page) =>
    page.evaluate(() => {
      const t = document.getElementById('msToast');
      return t && t.classList.contains('on') ? t.textContent : '';
    });
  // ---- From v285 ----
  const hrect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // ---- From the review leftovers ----
  test('Home names the app once, and the header names the brands you own', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="0"]');
    await page.click('#wcAdd');
    await page.click('#wcLook');
    await idle(page);
    const count = await page.evaluate(
      () =>
        [...document.querySelectorAll('body *')].filter(
          (e) => e.offsetParent && e.children.length === 0 && /^Marker Studio$/.test(e.textContent.trim()),
        ).length,
    );
    assert.equal(count, 1, '"Marker Studio" shows once');
    assert.equal(await page.textContent('.head .set'), 'Ohuhu · your collection');
    await page.evaluate(() => {
      presetMkeys(MARKER_SETS.find((p) => p.n === 'Ciao 12')).forEach((k) => state.owned.add(k));
      save();
      fullRender();
    });
    assert.equal(await page.textContent('.head .set'), 'Ohuhu + Copic · your collection');
    assert.deepEqual(errors, []);
  });
  // ---- From the third full review (v259) ----
  test('Home shows a guide renamed in the Library', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    await page.click('#mHome');
    await page.click('#homeLibCard');
    await idle(page);
    await libItem(page, '#savedList', 'sren');
    await page.fill('#savedList .sname-in', 'Renamed here');
    await page.keyboard.press('Enter');
    await page.evaluate(() => savedOverlay.classList.remove('on'));
    await idle(page);
    assert.match(await page.textContent('#homeView'), /Renamed here/);
    assert.deepEqual(errors, []);
  });
  test('Home keeps < and > in guide names', async () => {
    const g = { id: 5, type: 'guide', name: 'Cats <3 & dogs >', keys: ['Ohuhu|R014'], ts: Date.now() };
    const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: [g] }) }) });
    // (v318.32: the newest guide, not started, is on Home's card, not in Your guides: e2e/v31832-g2)
    await page.waitForSelector('#homeCont .hccard[data-gid] .hcname');
    assert.equal(await page.textContent('#homeCont .hcname'), 'Cats <3 & dogs >');
    assert.deepEqual(errors, []);
  });
  test('Home keeps a name that starts with "Guide"; the Resume card uses the app’s buttons', async () => {
    const g = (id, name) => ({
      id,
      type: 'guide',
      name,
      keys: ['Ohuhu|R014', 'Ohuhu|B08'],
      ts: id,
      n: 4,
      W: 10,
      H: 10,
    });
    const auto = JSON.stringify({ name: 'Guide for Mum', dirty: true, ts: Date.now(), keys: ['Ohuhu|R014'] });
    const { page, errors } = await openAtScale(1.6, {
      storage: onboardedV265({
        [KEY]: appState({ saved: [g(2000, 'Guide for Mum'), g(1000, 'Guide')] }),
        'ms-guide-auto': auto,
      }),
    });
    // (v318.32: the newest guide is on Home's card, the others in Your guides: e2e/v31832-g2)
    await page.waitForSelector('#sfRecent .sfRecName');
    const names = await page.$$eval('#homeCont .hccard[data-gid] .hcname, #sfRecent .sfRecName', (l) =>
      l.map((x) => x.textContent),
    );
    assert.equal(names[0], 'Guide for Mum');
    assert.notEqual(names[1], 'Guide', 'the default name still gets a made-up one');
    await page.waitForSelector('#sfResumeGo');
    assert.equal(await page.textContent('#sfResume .rsnm'), 'Guide for Mum');
    const b = await page.evaluate(() =>
      ['sfResumeGo', 'sfResumeNo'].map((id) => {
        const e = document.getElementById(id),
          s = getComputedStyle(e);
        return {
          h: e.getBoundingClientRect().height,
          fs: parseFloat(s.fontSize),
          style: e.getAttribute('style'),
          primary: e.classList.contains('btn-primary'),
        };
      }),
    );
    assert.ok(b[0].primary && !b[1].primary, 'Resume is the main action');
    for (const x of b) {
      assert.ok(x.h >= 44, 'at least 44px');
      assert.equal(x.style, null, 'no inline style');
    }
    const other = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.getElementById('homeNew')).fontSize),
    );
    assert.ok(b[1].fs <= other, 'no bigger than the other buttons at 1.6x');
    assert.deepEqual(errors, []);
  });
  for (const [w, scale] of [
    [360, 1.3],
    [390, 1.3],
    [360, 1.6],
    [390, 1],
  ]) {
    test(`Home tiles at ${w}px, ${scale}x: all in one row, or each a full-width row`, async () => {
      const { page, errors } = await openAtScale(scale, {
        width: w,
        height: 800,
        storage: onboardedV265({ [KEY]: appState() }),
      });
      const t = await page.$$eval('.homegrid .homecard', (l) =>
        l.map((c) => {
          const r = c.getBoundingClientRect();
          return { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        }),
      );
      const grid = await page.evaluate(() =>
        Math.round(document.querySelector('.homegrid').getBoundingClientRect().width),
      );
      const oneRow = t.every((x) => x.top === t[0].top),
        rows = t.every((x) => x.w === grid);
      assert.ok(oneRow || rows, JSON.stringify({ t, grid }));
      if (scale > 1 && w === 360) assert.ok(rows, 'full-width rows here');
      if (rows) {
        const lay = await page.evaluate(() => {
          const c = document.querySelector('.homegrid .homecard'),
            i = c.querySelector('.hcicon').getBoundingClientRect(),
            l = c.querySelector('.hclabel').getBoundingClientRect();
          return i.right <= l.left;
        });
        assert.ok(lay, 'icon left, text right');
      }
      await shot(page, `home-${w}-${scale}x`);
      assert.deepEqual(errors, []);
    });
  }
  test('Home: one card at a time under the tiles, in order; putting one away shows the next', async () => {
    const storage = onboardedNoVer({
      [KEY]: appState3({ saved: [pal(7, 'P'), { id: 'x', type: 'guide' }] }), // one Library entry can't be read
      'ms-first-use': String(Date.now() - 15 * DAY), // the backup reminder is due
      'ms-last-ver': 'v200', // What's new is due
      'ms-guide-auto': JSON.stringify({ dirty: true, name: 'Owl', keys: ['Ohuhu|R014'], ts: Date.now() }), // Resume
    });
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
    await idle(page);
    assert.deepEqual(
      await cards(page),
      { install: false, backup: true, news: false },
      'only the backup reminder (v267: first when due)',
    );
    assert.ok(await shown(page, 'sfResume'), 'Resume is there too (not one of the three)');
    assert.ok(await shown(page, 'loadNote'), 'and the note about unreadable data');
    // Resume, then the note, then New colouring guide and the tiles, then the one card
    assert.ok((await top(page, '#sfResume')) < (await top(page, '#loadNote')));
    assert.ok((await top(page, '#loadNote')) < (await top(page, '#homeNew')));
    assert.ok((await top(page, '.homegrid')) < (await top(page, '#backupNudge')));
    assert.equal(
      await page.evaluate(() => localStorage.getItem('ms-wn-shown')),
      null,
      'What’s new waiting its turn has not been shown',
    );

    await page.focus('#backupNudge [data-bk="later"]');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.deepEqual(
      await cards(page),
      { install: true, backup: false, news: false },
      'Later: Add to Home Screen',
    );
    assert.match(await page.textContent('#installCard'), /Back up first/, 'which says to back up first');
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      'instBackup',
      'focus moves to the card that took its place',
    );
    assert.ok((await top(page, '.homegrid')) < (await top(page, '#installCard')));

    await page.click('#installCard [data-inst="later"]');
    await page.waitForSelector('#installCard', { state: 'hidden' });
    assert.deepEqual(await cards(page), { install: false, backup: false, news: true }, 'Not now: What’s new');
    const at = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-wn-shown')));
    assert.equal(at.v, (await page.textContent('#appVer')).trim());
    assert.ok(Math.abs(at.t - Date.now()) < 60000, 'shown now');

    await page.click('#wnClose');
    await page.waitForSelector('#whatsNew', { state: 'hidden' });
    assert.deepEqual(await cards(page), { install: false, backup: false, news: false }, '✕: nothing left');
    // (v318: a closed layer's history entry taken back before the reload, which it would otherwise cut short)
    await idle(page);
    await page.waitForFunction(() => !(history.state && history.state.msLayer));
    await page.reload();
    await idle(page);
    assert.deepEqual(await cards(page), { install: false, backup: false, news: false }, 'and after a reload');
    assert.ok(await shown(page, 'loadNote'), 'the note stays until it is dismissed');
    assert.deepEqual(errors, []);
  });
  test('Home cards: Back up comes first when it is due, then Add to Home Screen, then What’s new', async () => {
    const storage = onboardedNoVer({
      [KEY]: appState3(),
      'ms-first-use': String(Date.now() - 15 * DAY),
      'ms-last-ver': 'v200',
    });
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
    await idle(page);
    assert.deepEqual(
      await cards(page),
      { install: false, backup: true, news: false },
      'the backup reminder first',
    );
    assert.ok((await top(page, '.homegrid')) < (await top(page, '#backupNudge')));
    // Later: the install card takes its turn, with focus
    await page.focus('#backupNudge [data-bk="later"]');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.deepEqual(
      await cards(page),
      { install: true, backup: false, news: false },
      'Later: Add to Home Screen',
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.closest('#installCard') != null),
      true,
      'focus moves to it',
    );
    // Not now: What's new
    await page.click('#installCard [data-inst="later"]');
    await idle(page);
    assert.deepEqual(await cards(page), { install: false, backup: false, news: true }, 'Not now: What’s new');
    await page.click('#wnClose');
    await page.waitForSelector('#whatsNew', { state: 'hidden' });
    assert.deepEqual(await cards(page), { install: false, backup: false, news: false });
    assert.deepEqual(errors, []);
  });
  test('Home cards: after backing up, the install card takes its turn', async () => {
    const storage = onboardedNoVer({ [KEY]: appState3(), 'ms-first-use': String(Date.now() - 15 * DAY) });
    const { page, errors } = await openApp({ userAgent: IPHONE, init: safariTab, storage });
    await idle(page);
    assert.deepEqual(await cards(page), { install: false, backup: true, news: false });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bkGo')]);
    assert.match(dl.suggestedFilename(), /^marker-studio-backup-/);
    await page.waitForSelector('#installCard', { state: 'visible' });
    assert.deepEqual(
      await cards(page),
      { install: true, backup: false, news: false },
      'backed up: Add to Home Screen',
    );
    assert.equal(await toastText(page), 'Backed up ✓');
    assert.deepEqual(errors, []);
  });
  test('Home cards: with no backup due, Add to Home Screen comes first as before', async () => {
    // work made today: the reminder isn't due yet
    const { page, errors } = await openApp({
      userAgent: IPHONE,
      init: safariTab,
      storage: onboardedNoVer({ [KEY]: appState3(), 'ms-last-ver': 'v200' }),
    });
    await idle(page);
    assert.deepEqual(await cards(page), { install: true, backup: false, news: false });
    await page.click('#installCard [data-inst="later"]');
    await idle(page);
    assert.deepEqual(await cards(page), { install: false, backup: false, news: true }, 'Not now: What’s new');
    // a backup made recently: still the install card first (on another visit, once it's not snoozed)
    const b = await openApp({
      userAgent: IPHONE,
      init: safariTab,
      storage: onboardedNoVer({
        [KEY]: appState3(),
        'ms-first-use': String(Date.now() - 30 * DAY),
        'ms-guides-backup-ts': String(Date.now() - DAY),
      }),
    });
    await idle(b.page);
    assert.equal(await b.page.evaluate(() => !!backupDue()), false);
    assert.deepEqual(await cards(b.page), { install: true, backup: false, news: false });
    assert.deepEqual([...errors, ...b.errors], []);
  });
  test('v285: the Continue card is the newest guide part-way coloured — its picture, how far, the marker to pick up — and opens Colour along at that marker', async () => {
    const { page, errors } = await openApp({ width: 834, height: 1194 });
    await sampleGuide(page);
    await saveGuide(page);
    await letterGuide(page);
    await page.waitForFunction(() => __mstest.inLibrary);
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    // (v300: on an iPad, the start card in its place; v318.32: the newest guide, not started, on the card instead, as
    // Open, not Continue colouring: e2e/v31832-g2)
    assert.equal(
      await page.isVisible('#homeCont .hccard[data-cont]'),
      false,
      'nothing started: no Continue card',
    );
    assert.equal(
      await page.isVisible('#homeCont .hccard:not([data-cont])'),
      true,
      'the guide just built instead',
    );
    assert.equal(
      await page.isVisible('#homeView .homehead'),
      false,
      'and no intro line once there are guides',
    );
    assert.equal(await page.locator('#sfRecent .sfRecCard').count(), 1);
    // colour a few sections of the Letter page
    await page.click('#mSections');
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    const n = await page.evaluate(() => {
      const t = __mstest,
        o = t.assignData.order;
      o.slice(0, 7).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.updateProgress();
      t.renderGuide();
      return o.length;
    });
    await page.evaluate(() => __mstest.flushSave());
    await idle(page);
    await page.click('#sfDoneBtn');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.waitForSelector('#homeCont img');
    await page.waitForFunction(() => /next/.test(document.querySelector('#homeCont .hcmeta').textContent));
    assert.match(await page.textContent('#homeCont .hcmeta'), new RegExp(`^7 of ${n} coloured · next .+`));
    assert.match(
      await page.getAttribute('#homeCont .hccard', 'aria-label'),
      new RegExp(`^Continue colouring .+: 7 of ${n} sections coloured, next .+$`),
    );
    assert.equal(
      await page.evaluate(() => document.getElementById('homeNew').classList.contains('homenew2')),
      true,
      'New colouring guide is the second choice beside it',
    );
    assert.deepEqual(
      await page.$$eval('#sfRecent .sfRecName', (l) => l.map((x) => x.textContent)),
      ['Sample jellyfish'],
      'Your guides: the others',
    );
    // iPad portrait (v308.1): the Continue card across the page, its picture beside its words; New colouring guide and
    // the cards under it, the cards three in a row
    const c = await hrect(page, '#homeCont'),
      nb = await hrect(page, '#homeNew'),
      pic = await hrect(page, '#homeCont .hcpic'),
      body = await hrect(page, '#homeCont .hcbody');
    assert.ok(
      nb.top >= c.bottom && Math.abs(nb.width - c.width) <= 1,
      'New colouring guide under it, as wide: ' + JSON.stringify([c, nb]),
    );
    assert.ok(pic.right <= body.left + 1 && Math.abs(pic.top - body.top) < 2, 'its picture beside its words');
    const cards = await page.$$eval('#homeView .homegrid .homecard', (l) =>
      l.map((e) => Math.round(e.getBoundingClientRect().top)),
    );
    assert.equal(new Set(cards).size, 1, 'the cards in one row: ' + cards);
    // the marker to pick up: the one part-way done, lightest first
    const want = await page.evaluate(() => document.querySelector('#homeCont .hcmeta b').textContent);
    await page.click('#homeCont .hccard');
    await page.waitForFunction(() => __mstest.sfmode === 'color' && __mstest.hlKey);
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.hlKey.split('|')[1]),
      want,
      'Colour along opens at that marker',
    );
    assert.ok(await page.isVisible('.sfarow.open'), 'its row open');
    // a phone: the Continue card above New colouring guide
    await page.click('#mHome');
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    assert.ok((await hrect(page, '#homeCont')).bottom <= (await hrect(page, '#homeNew')).top + 1);
    assert.deepEqual(errors, []);
  });
  test('v285: with no guides, Home is the intro line, New colouring guide and the three cards (v300: on an iPad, the start card and the cards beside it)', async () => {
    const { page, errors } = await openApp({
      width: 834,
      height: 1194,
      storage: onboardedV265({ [KEY]: appState() }),
    });
    await idle(page);
    assert.equal(await page.isVisible('#sfRecent'), false);
    // iPad: the start card on the left, the cards beside it; no intro line or New colouring guide (the card is both)
    assert.equal(await page.isVisible('#homeCont .hcstart'), true);
    assert.equal(await page.isVisible('#homeView .homehead'), false);
    assert.equal(await page.isVisible('#homeNew'), false);
    const c = await hrect(page, '#homeCont'),
      g = await hrect(page, '.homegrid');
    assert.ok(
      c.right <= g.left + 1 && Math.abs(c.top - g.top) < 24,
      'side by side: ' + JSON.stringify([c, g]),
    );
    // (v309.2: the colours, as a set's Colorless Blender builds nothing; v318.27: Home's Markers card counts them too)
    assert.match(await page.textContent('#homeCont .hcstart'), /Built from your \d+ colours\./);
    // the whole sample page in the picture, not cut off
    const fit = await page.evaluate(() => {
      const i = document.querySelector('#homeCont .hcstart img'),
        b = i.parentElement.getBoundingClientRect(),
        r = i.getBoundingClientRect();
      return r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && i.complete;
    });
    assert.ok(fit);
    // a phone: as it was, the intro line, New colouring guide and the cards in one column
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    assert.equal(await page.isVisible('#homeView .homehead'), true);
    assert.equal(await page.isVisible('#homeCont'), false);
    assert.equal(
      await page.evaluate(() => document.getElementById('homeNew').classList.contains('homenew2')),
      false,
      'New colouring guide is the main button',
    );
    const g2 = await hrect(page, '.homegrid'),
      w = await page.evaluate(() => innerWidth);
    assert.ok(Math.abs(g2.left + g2.width / 2 - w / 2) < 2, 'one centred column');
    assert.deepEqual(errors, []);
  });
}

// ---- from tasks-card.test.mjs ----
// v318 review (prototype): during the beta, a card on Home under its cards says how many tester tasks are answered and
// which is next, opening the tasks at it; "ready to send" once all six are; gone once they're sent as they are (the
// line at Home's foot stays, as a way in).
{
  const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
  const KEYS = ['add', 'guide', 'plan', 'along', 'back', 'share'];
  const tester = (n, sent) => {
    const t = {};
    KEYS.slice(0, n).forEach((k) => (t[k] = { r: 'easy', n: '', v: 'v318' }));
    const o = { id: 'TABC123', name: '', t, q: {}, sends: sent ? 1 : 0, sig: '' };
    if (sent) o.sig = JSON.stringify([o.t, o.q, o.name]);
    return JSON.stringify(o);
  };
  const card = async (page) => {
    await idle(page);
    return page.evaluate(() => {
      const c = document.getElementById('homeTaskCard'),
        f = document.getElementById('homeTasks');
      return {
        card: c && !c.hidden && c.getClientRects().length ? c.innerText.replace(/\s+/g, ' ').trim() : null,
        foot: f && f.getClientRects().length ? f.textContent : null,
      };
    });
  };
  test('the card: 0/6 with the first task, 2/6 with the third; it opens the tasks at the next one', async () => {
    let { page, errors } = await openApp({ storage: ONB });
    assert.deepEqual(await card(page), {
      card: '0/6 Beta tester tasks Next to answer: 1 · Add your markers ›',
      foot: 'Tester tasks · 0 of 6',
    });
    ({ page, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(2) } }));
    assert.equal((await card(page)).card, '2/6 Beta tester tasks Next to answer: 3 · Make the plan yours ›');
    await page.click('#homeTaskCard');
    await idle(page);
    assert.ok(await page.isVisible('#ttOverlay'), 'the tasks open');
    assert.match(
      await page.evaluate(() => document.getElementById('ttOverlay').innerText),
      /Make the plan yours/,
    );
    assert.deepEqual(errors, []);
  });
  test('all six: ready to send; sent as they are: no card, the foot line still', async () => {
    let { page, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(6) } });
    assert.equal((await card(page)).card, '6/6 Beta tester tasks All 6 answered: ready to send ›');
    ({ page, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(6, true) } }));
    assert.deepEqual(await card(page), { card: null, foot: 'Tester tasks · sent' });
    assert.deepEqual(errors, []);
  });
}

// ---- from v285-review.test.mjs ----
// v285's pre-release review: narrow landscape phones keep the whole controls column; an automatic first save leaves a
// name being typed alone; Put back while the Library's delete is still waiting keeps the guide's stored copy; Home's
// Continue card follows a rename and isn't redrawn while Home is hidden; the marker sets' caret stays an icon.
{
  const tickInCode = (page, i) =>
    page.evaluate((i) => {
      const t = __mstest;
      t.colored[t.assignData.order[i]] = 1;
      t.guideDirty = true;
      t.renderGuide();
    }, i);
  test('on an iPad Home uses the width: the Continue card across it, the cards three in a row under it, not the phone’s 440px column', async () => {
    for (const [w, h] of [
      [1194, 834],
      [834, 1194],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await saveGuide(page);
      // (v313: the sample with ticks to try it isn't on Continue until it's printed or renamed: as if renamed)
      await page.evaluate(() => {
        __mstest.styleVars.smpTry = 0;
      });
      await tickInCode(page, 0);
      await page.evaluate(() => __mstest.flushSave());
      await idle(page);
      await page.click('#mHome');
      await idle(page);
      // (v308.1: the Continue card across the page with the cards under it; side by side, its tall picture had left an
      // empty column beside the short cards)
      const g = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        return {
          hub: r('.homehub').width,
          cont: r('#homeCont').width,
          sideT: r('.homeside').top,
          contB: r('#homeCont').bottom,
          rows: new Set(
            [...document.querySelectorAll('#homeView .homegrid .homecard')].map((e) =>
              Math.round(e.getBoundingClientRect().top),
            ),
          ).size,
        };
      });
      assert.ok(g.hub > 700, `${w}×${h}: Home is ${g.hub}px wide`);
      assert.ok(
        g.cont > g.hub - 2 && g.sideT >= g.contB && g.rows === 1,
        `${w}×${h}: the Continue card (${g.cont}px) across, the cards in a row under it`,
      );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
}

// ---- from v285-review2.test.mjs ----
// v285's second review (after release prep): changes made just before the page goes away are kept; Resume's section
// edits, discarded, never overwrite the Library guide; edits left by an earlier visit are kept as a copy; a guide
// deleted while open stays out of the slot; blocked storage asks before a guide goes; Continue's row is on screen;
// Reveal gives the keyboard back; the Library's backup line; the welcome on a landscape phone; singular wording.
{
  test('one marker: Home says "1 marker"', async () => {
    const { page, errors } = await openApp();
    await page.click('#wcSkip').catch(() => {});
    await page.click('#wcLook').catch(() => {});
    await page.evaluate(() => {
      state.owned = new Set([0]);
      save();
    });
    await page.click('#mPalette');
    await page.click('#mHome');
    await idle(page);
    assert.equal(await page.textContent('.homecard[data-go="collection"] .hcsub'), '1 marker');
    assert.deepEqual(errors, []);
  });
}

// ---- from v289.test.mjs ----
// v289: fixes from the fresh-eyes review of v288 — ← Plan › Discard of edits brought back by Resume, a palette held for
// the next guide and a photo that won't open, section edits beyond Undo, Use in a guide › Recolour from Colour along,
// Change colour after an iPad turns, a backup restored over a guide deleted while open, Generate keeping the keyboard,
// Edit sections' tools on a phone's first screen, the guide saved at once on leaving it, focus after Change colour.
{
  const tickN = (page, n, from = 0) =>
    page.evaluate(
      ([n, from]) => {
        const t = __mstest;
        t.assignData.order.slice(from, from + n).forEach((l) => {
          t.colored[l] = 1;
        });
        t.guideDirty = true;
        t.renderGuide();
      },
      [n, from],
    );
  test('leaving the guide saves at once: Home shows the guide just coloured, its Continue card there straight away', async () => {
    const { page, errors } = await openApp();
    await sampleGuide(page);
    // (v313: the sample with ticks to try it isn't on Continue until it's printed or renamed: as if renamed)
    await page.evaluate(() => {
      __mstest.styleVars.smpTry = 0;
    });
    await page.click('#sfColor');
    await idle(page);
    await tickN(page, 4);
    await idle(page, 200);
    await page.click('#mHome');
    await idle(page, 600);
    assert.equal(await page.isVisible('#homeCont'), true, 'Continue');
    assert.match(await page.textContent('#homeCont .hcmeta'), /^4 of \d+ coloured/);
    assert.deepEqual(errors, []);
  });
  test('iPad Home: with Your guides showing, the Library card stays beside All guides (v308.1); the backup card waits the usual 14 days', async () => {
    const g = (id, d) => ({
      id,
      type: 'guide',
      name: 'G' + id,
      keys: ['Ohuhu|R014', 'Ohuhu|Y111'],
      n: 40,
      done: d,
      ts: Date.now() - id,
    });
    const st = (first) => ({
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-last-ver': 'v289',
      'ms-first-use': String(Date.now() - first * 864e5),
      'ohuhu-hb320-picker-v3': JSON.stringify({
        mode: 'home',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R014', 'Ohuhu|Y111'],
        saved: [g(1, 5), g(2, 9), g(3, 0)],
      }),
    });
    // (v304: in a Safari tab a guide's first coloured section brings the backup card at once (v304-persist); the
    // 14 days are the rule for other browsers, so this checks them in Chrome, also in Safari's engine)
    const CHROME =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    {
      const { page, errors, ctx } = await openApp({
        width: 834,
        height: 1194,
        storage: st(1),
        userAgent: CHROME,
      });
      await idle(page);
      assert.equal(await page.isVisible('#sfRecent'), true);
      // (v308.1: it had been hidden here since v289, so it vanished from Home once a restore brought guides in)
      assert.equal(await page.isVisible('#homeLibCard'), true, 'the Library card beside All guides');
      assert.equal(
        await page.isVisible('#backupNudge'),
        false,
        'no backup card on day one, however many guides',
      );
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    {
      const { page, errors, ctx } = await openApp({
        width: 834,
        height: 1194,
        storage: st(15),
        userAgent: CHROME,
      });
      await page.waitForSelector('#backupNudge', { state: 'visible' });
      assert.doesNotMatch(await page.textContent('#backupNudge'), /One file holds/, 'one short line');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    {
      // a phone keeps its Library card
      const { page, errors, ctx } = await openApp({ storage: st(1) });
      await idle(page);
      assert.equal(await page.isVisible('#homeLibCard'), true);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Home › New colouring guide with section edits not built: the Guide screen asks first; Discard edits opens the picker', async () => {
    const { page, errors } = await openApp();
    await answerAsks(page);
    await sampleGuide(page);
    await saveGuide(page);
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order[4];
      t.secState[l] = 2;
      t.render();
    });
    await idle(page);
    assert.equal(await page.evaluate(() => SF.secEdPending()), true);
    await page.click('#mHome');
    await idle(page);
    let chose = false;
    page.on('filechooser', () => {
      chose = true;
    });
    await page.click('#homeNew');
    await page.waitForSelector('#sfEdAsk');
    assert.equal(await page.isVisible('#sfRoot'), true, 'on the Guide screen');
    assert.equal(await page.textContent('#sfEdAskT'), 'Section edits not saved');
    assert.equal(chose, false, 'no picker yet');
    await page.click('#sfEdAsk [data-a="stay"]');
    await idle(page);
    assert.equal(
      await page.evaluate(() => __mstest.sfmode),
      'review',
      'Cancel: still in Edit sections, edits kept',
    );
    // Discard edits: the photo picker opens in the same tap, the edits gone
    await page.click('#mHome');
    await idle(page);
    await page.click('#homeNew');
    await page.waitForSelector('#sfEdAsk');
    await Promise.all([page.waitForEvent('filechooser'), page.click('#sfEdAsk [data-a="discard"]')]);
    await idle(page);
    assert.equal(await page.evaluate(() => [__mstest.sfmode, SF.secEdPending()].join()), 'guide,false');
    await page.click('#mHome');
    await idle(page);
    await Promise.all([page.waitForEvent('filechooser'), page.click('#homeNew')]);
    assert.deepEqual(errors, []);
  });
}

// ---- from v300.test.mjs ----
// v300 (polish): Home on an iPad is two columns in every state — with no guide in progress, a start card in the
// Continue card's place — and guides' pictures on Home show the whole page. Until there's a guide of one's own, the
// start cards (Home's and the Guide tab's) show the sample page and its guide, tapped for the sample; then just words.
{
  const rect = (page, sel) =>
    page.evaluate((s) => {
      const e = document.querySelector(s);
      return e ? e.getBoundingClientRect().toJSON() : null;
    }, sel);
  // a picture inside its box, whole (not cut off at the top or bottom)
  const whole = (page, sel) =>
    page.evaluate(
      (s) =>
        [...document.querySelectorAll(s)].map((i) => {
          const b = i.parentElement.getBoundingClientRect(),
            r = i.getBoundingClientRect();
          return (
            i.complete &&
            r.height > 20 &&
            r.top >= b.top - 1 &&
            r.bottom <= b.bottom + 1 &&
            r.left >= b.left - 1 &&
            r.right <= b.right + 1
          );
        }),
      sel,
    );
  test('iPad Home with no guide in progress: the start card — Choose a photo opens the picker in the tap, or try the sample', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    assert.equal(await page.isVisible('#homeCont .hcstart'), true);
    assert.equal(await page.isVisible('#homeNew'), false, 'the card is New colouring guide');
    // the two columns start level, and Home's edges are the menu's (tour review)
    const sc = await rect(page, '#homeCont .hcstart'),
      mc = await rect(page, '.homegrid .homecard'),
      mn = await rect(page, '.wrap > .modes'),
      hs = await rect(page, '.homeside');
    assert.ok(Math.abs(sc.top - mc.top) < 2, 'level: ' + [sc.top, mc.top]);
    assert.ok(
      Math.abs(sc.left - mn.left) < 2 && Math.abs(hs.right - mn.right) < 2,
      'the menu’s edges: ' + JSON.stringify([sc.left, hs.right, mn.left, mn.right]),
    );
    // no guides yet: the sample page and its guide, whole
    await page.waitForFunction(() =>
      [...document.querySelectorAll('#homeCont .hcba img')].every((i) => i.complete),
    );
    assert.deepEqual(await whole(page, '#homeCont .hcba img'), [true, true]);
    // its buttons are 44px tall
    for (const s of ['[data-start="photo"]', '.hcalt[data-start="sample"]'])
      assert.ok((await rect(page, '#homeCont ' + s)).height >= 44, s);
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      page.click('#homeCont [data-start="photo"]'),
    ]);
    assert.ok(fc, 'the photo picker');
    await page.click('#homeCont .hcalt[data-start="sample"]');
    await page.waitForFunction(() => window.__mstest && __mstest.assignData, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => state.mode), 'sections');
    assert.deepEqual(errors, []);
  });
  test('the start cards’ picture of the sample, until there’s a guide: tapped, it opens the sample; then just the words', async () => {
    for (const [w, h] of [
      [820, 1100],
      [390, 844],
    ]) {
      const { page, errors } = await openApp({ width: w, height: h });
      await welcome(page, 'look');
      await idle(page);
      if (w > 700) {
        // Home's picture is a button for the sample
        await page.click('#homeCont button.hcpic');
        await page.waitForFunction(() => window.__mstest && __mstest.assignData, null, { timeout: 30000 });
        await page.evaluate(() => SF.showHome());
      } else await page.click('#mSections');
      await idle(page);
      // the Guide tab's start card: the picture beside the words on an iPad, above them on a phone
      assert.equal(await page.isVisible('#sfStPic'), true, 'the picture ' + w);
      await page.waitForFunction(() =>
        [...document.querySelectorAll('#sfStPic img')].every((i) => i.complete),
      );
      assert.deepEqual(await whole(page, '#sfStPic img'), [true, true]);
      const pic = await rect(page, '#sfStPic'),
        hd = await rect(page, '#sfStart h2');
      if (w > 700)
        assert.ok(pic.right <= hd.left && pic.height >= 300, 'beside: ' + JSON.stringify([pic, hd]));
      else
        assert.ok(
          pic.bottom <= hd.top && Math.abs(pic.width - (await rect(page, '#sfStart')).width) < 4,
          'above',
        );
      // its buttons: Choose a photo the whole width, all 44px
      const pk = await rect(page, '#sfPick'),
        sm = await rect(page, '#sfSample');
      assert.ok(sm.top >= pk.bottom && pk.height >= 44 && sm.height >= 44, JSON.stringify([pk, sm]));
      if (w < 700) {
        await page.click('#sfStPic');
        await page.waitForFunction(() => window.__mstest && __mstest.assignData, null, { timeout: 30000 });
      }
      // a guide of one's own (the sample, saved): just the words, on both cards
      await page.evaluate(() => __mstest.saveNow());
      await idle(page, 600);
      await page.evaluate(() => SF.showHome());
      await idle(page);
      assert.equal(await page.isVisible('#sfStPic'), false, 'no picture once there is a guide');
      assert.equal(await page.$$eval('#sfStPic img', (a) => a.length), 0, 'and not kept');
      // ...and back on the Guide tab when that guide is deleted from the Library (it's only on Home that a redraw ran)
      await page.evaluate(() => {
        SF.showHome();
        libDelete(state.saved.find((s) => s.type === 'guide').id);
      });
      await idle(page);
      assert.equal(await page.isVisible('#sfStPic img'), true, 'the picture back on the Guide tab');
      // Undo puts the guide back: words only again
      await page.click('#toastAct');
      await idle(page);
      assert.equal(await page.isVisible('#sfStPic'), false, 'Undo');
      if (w > 700) {
        await page.click('#mHome');
        await idle(page);
        assert.equal(await page.isVisible('#homeCont .hcstart.compact'), true);
        assert.equal(await page.$('#homeCont .hcpic'), null);
        // ...back if every guide is deleted
        await page.evaluate(() => {
          state.saved = state.saved.filter((s) => s.type !== 'guide');
          renderRecent();
        });
        assert.equal(await page.isVisible('#homeCont .hcba'), true);
      }
      assert.deepEqual(errors, []);
    }
  });
  test('Home’s guide pictures show the whole page: the Continue card and Your guides', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await saveGuide(page);
    // (v313: the sample with ticks to try it isn't on Continue until it's printed or renamed: as if renamed)
    await page.evaluate(() => {
      const t = __mstest;
      t.styleVars.smpTry = 0;
      t.assignData.order.slice(0, 20).forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      return t.saveNow();
    });
    await page.click('#mHome');
    await idle(page);
    await page.waitForSelector('#homeCont .hccard[data-cont] img');
    // (polled: a picture can be swapped for a sharper one just after it first loads)
    const wholeNow = (sel) =>
      page
        .waitForFunction(
          (s) => {
            const a = [...document.querySelectorAll(s)];
            return (
              a.length &&
              a.every((i) => {
                const b = i.parentElement.getBoundingClientRect(),
                  r = i.getBoundingClientRect();
                return (
                  i.complete &&
                  r.height > 20 &&
                  r.top >= b.top - 1 &&
                  r.bottom <= b.bottom + 1 &&
                  r.left >= b.left - 1 &&
                  r.right <= b.right + 1
                );
              })
            );
          },
          sel,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
    assert.equal(await wholeNow('#homeCont .hcpic img'), true, 'the Continue card');
    // finished: no guide in progress, and it's under Your guides
    await page.click('#mSections');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      return t.saveNow();
    });
    await page.click('#mHome');
    await idle(page);
    await page.waitForSelector('#sfRecent .sfRecThumb');
    assert.equal(await wholeNow('#sfRecent .sfRecThumb'), true, 'Your guides');
    // Your guides lines up with the columns above it
    const a = await rect(page, '#homeCont'),
      b = await rect(page, '#sfRecent');
    assert.ok(Math.abs(a.left - b.left) < 6, JSON.stringify([a.left, b.left]));
    assert.deepEqual(errors, []);
  });
  test('Palette on an iPad held sideways: the settings beside the palette, Generate on the first screen; upright, the sizes on one row', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 740 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await page.click('#draw');
    await idle(page, 1300);
    await page.evaluate(() => scrollTo(0, 0));
    const h = await rect(page, '#harmWrap'),
      p = await rect(page, '#palette'),
      d = await rect(page, '#draw');
    assert.ok(h.right <= p.left && Math.abs(h.top - p.top) < 30, 'side by side: ' + JSON.stringify([h, p]));
    assert.ok(d.bottom <= 740, 'Generate on the first screen: ' + d.bottom);
    // Triadic's 8 sizes on one row in the column (they had made a 4×2 block); Custom's, more than 9, in two
    const rowsOf = () =>
      page.$$eval(
        '#segs button',
        (bs) =>
          new Set(bs.filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().top)))
            .size,
      );
    await page.evaluate(() => setHarmony('triadic'));
    await idle(page);
    assert.equal(await rowsOf(), 1, 'Triadic');
    // 10 colours are tiles: the card as tall as they are, no empty space under them
    await page.click('#segs [data-n="10"]');
    await page.click('#draw');
    await idle(page, 1300);
    const pg = await rect(page, '#palette'),
      lastTile = await page.$$eval('#palette .band', (b) =>
        Math.max(...b.map((x) => x.getBoundingClientRect().bottom)),
      );
    assert.ok(pg.bottom - lastTile < 12, 'tiles fill the card: ' + [pg.bottom, lastTile]);
    await page.evaluate(() => setHarmony('custom'));
    await idle(page);
    assert.equal(await rowsOf(), 2, 'Custom');
    await page.evaluate(() => setHarmony('complementary'));
    await idle(page);
    // Filters with the settings, on the first screen; open, its choices in that column
    const fb = await rect(page, '#filterBar'),
      hw = await rect(page, '#harmWrap');
    assert.ok(
      Math.abs(fb.left - hw.left) < 4 && fb.right <= p.left && fb.bottom <= 740,
      'Filters with the settings: ' + JSON.stringify(fb),
    );
    await page.click('#filterBar');
    await idle(page);
    const fl = await rect(page, '#filters');
    assert.ok(fl.right <= p.left + 1 && fl.height > 100, 'the choices in the column: ' + JSON.stringify(fl));
    await page.click('#filterBar');
    await idle(page);
    // upright: one column, the sizes on one row
    await page.setViewportSize({ width: 820, height: 1100 });
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('filterBar').previousElementSibling.id),
      'trackWrap',
      'Filters back under the palette',
    );
    const h2 = await rect(page, '#harmWrap'),
      p2 = await rect(page, '#palette');
    assert.ok(p2.top > h2.bottom, 'one column');
    const tops = await page.$$eval('#segs button', (bs) => [
      ...new Set(bs.filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().top))),
    ]);
    assert.equal(tops.length, 1, 'one row');
    // sideways again, then Markers and Random: Filters where they always were there
    await page.setViewportSize({ width: 1180, height: 740 });
    await idle(page);
    assert.equal(
      await page.evaluate(() =>
        document.getElementById('filterBar').parentElement.classList.contains('palset'),
      ),
      true,
    );
    await page.click('#mCollection');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('filterBar').previousElementSibling.id),
      'trackWrap',
      'Markers',
    );
    await page.click('#mPalette');
    await idle(page);
    await page.setViewportSize({ width: 820, height: 1100 });
    await idle(page);
    // a phone: two rows for more than 7 sizes, as before
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    await page.evaluate(() => setHarmony('triadic'));
    await idle(page);
    const tops2 = await page.$$eval('#segs button', (bs) => [
      ...new Set(bs.filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().top))),
    ]);
    assert.equal(tops2.length, 2);
    assert.deepEqual(errors, []);
  });
  test('Markers on an iPad: the search and Owned / Unowned / All / To buy on one row, then the tools; a phone as before', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 740 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    const q = await rect(page, '#q'),
      ov = await rect(page, '#ownView'),
      rnd = await rect(page, '#mkDrawBtn'),
      jmp = await rect(page, '#mkJump');
    assert.ok(
      Math.abs(q.top + q.height / 2 - (ov.top + ov.height / 2)) < 4 && ov.left > q.right,
      'one row: ' + JSON.stringify([q, ov]),
    );
    assert.ok(
      rnd.top > q.bottom &&
        jmp.left > rnd.right &&
        Math.abs(jmp.top + jmp.height / 2 - (rnd.top + rnd.height / 2)) < 6,
      'the tools on the next: ' + JSON.stringify([rnd, jmp]),
    );
    // (v313: the line about the view under the tools' row, whole; v316: Owned has none, it said what the switch says)
    assert.equal(await page.isVisible('#ownHint'), false, 'Owned: no line');
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    const hint = await rect(page, '#ownHint'),
      rnd1 = await rect(page, '#mkDrawBtn');
    assert.ok(
      hint.height > 0 && hint.top >= rnd1.bottom - 1,
      'Unowned: its line under the tools: ' + JSON.stringify([rnd1, hint]),
    );
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    // the switch keeps its name for screen readers
    assert.equal(
      await page.evaluate(
        () =>
          document.getElementById(document.getElementById('ownView').getAttribute('aria-labelledby'))
            .textContent,
      ),
      'Show',
    );
    // the first markers within the first screen's top two thirds
    const sw = await page.evaluate(() => {
      const e = [...document.querySelectorAll('#findResults button, #findResults .tile')].find(
        (b) => b.offsetParent,
      );
      return e ? e.getBoundingClientRect().top : 9999;
    });
    assert.ok(sw < 500, 'the markers start at ' + sw);
    // To buy has no search: the switch stays where it was, at the right (it had jumped from under the finger)
    await page.click('#ownView [data-v="wish"]');
    await idle(page);
    assert.ok(Math.abs((await rect(page, '#ownView')).right - ov.right) < 2, 'the switch stays put');
    assert.equal(
      await page.isVisible('#mkJump'),
      false,
      'no Sets & swatch chart link in To buy: its sets aren’t there',
    );
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    // Unowned: Order on a row of its own, under the tools
    await page.click('#ownView [data-v="unowned"]');
    await idle(page);
    const ord = await rect(page, '#gapSort'),
      r2 = await rect(page, '#mkDrawBtn');
    assert.ok(ord.top >= r2.bottom + 10, 'Order under, with room: ' + JSON.stringify([ord, r2]));
    // a phone: one column, as before (the search over the switch over Random)
    await page.setViewportSize({ width: 390, height: 844 });
    await idle(page);
    await page.click('#ownView [data-v="owned"]');
    await idle(page);
    const q2 = await rect(page, '#q'),
      ov2 = await rect(page, '#ownView'),
      rn2 = await rect(page, '#mkDrawBtn');
    assert.ok(ov2.top >= q2.bottom && rn2.top >= ov2.bottom, 'one column: ' + JSON.stringify([q2, ov2, rn2]));
    // no markers yet: Add a set you own comes above the tools' row, not inside it (v300 review)
    await page.setViewportSize({ width: 1180, height: 740 });
    await page.evaluate(() => {
      state.owned.clear();
      save();
      chrome();
    });
    await idle(page);
    assert.equal(
      await page.evaluate(() =>
        document.getElementById('presetWrap').parentElement.classList.contains('wrap'),
      ),
      true,
      'Add a set in the page, not the row',
    );
    const ps = await rect(page, '#presetWrap'),
      dr = await rect(page, '#mkDrawBtn');
    assert.ok(
      ps.bottom <= dr.top && ps.width > 900,
      'above the row, the full width: ' + JSON.stringify([ps, dr]),
    );
    // and Palette, Random, the Guide: no stray space from the rows
    await page.setViewportSize({ width: 1180, height: 740 });
    await page.click('#mPalette');
    await idle(page);
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll('.mkh1, .mkh2')].map((e) => getComputedStyle(e).display).join(),
      ),
      'contents,contents',
    );
    assert.deepEqual(errors, []);
  });
  test('the guide card held sideways is as wide as the menu above it when the picture fits; a wide page keeps its picture', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 740 });
    await sampleGuide(page);
    await idle(page);
    await page.evaluate(() => scrollTo(0, 0));
    const m = await rect(page, '.wrap > .modes'),
      c = await rect(page, '#sfWork'),
      ctl = await rect(page, '#sfCtl');
    // the start card too (it had kept the guide's wide page)
    await page.evaluate(() => SF.showHome());
    await idle(page);
    const st = await rect(page, '#sfStart');
    assert.ok(
      Math.abs(st.left - m.left) < 2 && Math.abs(st.right - m.right) < 2,
      'the start card: ' + JSON.stringify([m, st]),
    );
    // its three smaller buttons even, no bigger than Choose a photo's words
    const fs = await page.$$eval('#sfPick, #sfSample, #sfLib, #sfImport', (b) =>
      b.map((x) => [parseFloat(getComputedStyle(x).fontSize), x.getBoundingClientRect().width]),
    );
    assert.ok(
      fs.slice(1).every(([f]) => f <= fs[0][0]),
      'sizes: ' + fs,
    );
    assert.ok(
      Math.max(...fs.slice(1).map((x) => x[1])) - Math.min(...fs.slice(1).map((x) => x[1])) < 2,
      'even: ' + fs,
    );
    await page.click('#sfSample');
    await page.waitForFunction(
      () => __mstest.sfmode === 'guide' && document.getElementById('sfWork').offsetParent,
    );
    await idle(page);
    assert.ok(
      Math.abs(c.left - m.left) < 2 && Math.abs(c.right - m.right) < 2,
      'as wide as the menu: ' + JSON.stringify([m, c]),
    );
    assert.ok(c.right - ctl.right < 16, 'the controls fill the card: ' + JSON.stringify([c, ctl]));
    // a Letter page too (the card had been wider than the menu for most pages); a sheet beside the picture ends at the
    // card's edge, not the screen's
    await letterGuide(page);
    await page.evaluate(() => scrollTo(0, 0));
    await idle(page);
    const c3 = await rect(page, '#sfWork');
    assert.ok(
      Math.abs(c3.left - m.left) < 2 && Math.abs(c3.right - m.right) < 2,
      'a Letter page: ' + JSON.stringify([m, c3]),
    );
    await openMenu(page);
    const sh = await rect(page, '#sfSheet');
    assert.ok(
      await page.evaluate(() => document.getElementById('sfSheet').classList.contains('sfshside')),
      'beside the picture',
    );
    assert.ok(Math.abs(sh.right - c3.right) < 2, 'the sheet ends at the card: ' + JSON.stringify([sh, c3]));
    await page.keyboard.press('Escape');
    await idle(page);
    // a landscape page on a 13-inch iPad: the picture as big as before (the card wider than the menu)
    const png = (await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'))).toString('base64');
    const wide = await page.evaluate(
      (b) =>
        new Promise((res) => {
          const im = new Image();
          im.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = im.height;
            cv.height = im.width;
            const x = cv.getContext('2d');
            x.translate(cv.width, 0);
            x.rotate(Math.PI / 2);
            x.drawImage(im, 0, 0);
            res(cv.toDataURL('image/png').split(',')[1]);
          };
          im.src = 'data:image/png;base64,' + b;
        }),
      png,
    );
    await page.setViewportSize({ width: 1366, height: 950 });
    await idle(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(wide, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    await page.evaluate(() => scrollTo(0, 0));
    const m2 = await rect(page, '.wrap > .modes'),
      c2 = await rect(page, '#sfWork'),
      pic = await rect(page, '#sfView'),
      root = await rect(page, '#sfRoot');
    assert.ok(c2.width > m2.width + 100, 'wider than the menu: ' + JSON.stringify([m2, c2]));
    assert.ok(
      pic.width >= (root.width - 36) * 0.58,
      'the picture keeps its 60%: ' + JSON.stringify([pic, root]),
    );
    assert.deepEqual(errors, []);
  });
  test('Edit sections’ tools: one even row, on a phone and an iPad', async () => {
    for (const [w, h] of [
      [390, 844],
      [1180, 740],
    ]) {
      const { page, errors } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await page.click('#sfBack2');
      await idle(page);
      const bs = await page.$$eval('#sfEdit button', (b) => b.map((x) => x.getBoundingClientRect().toJSON()));
      assert.equal(bs.length, 4);
      assert.equal(new Set(bs.map((r) => Math.round(r.top))).size, 1, 'one row');
      assert.ok(
        Math.max(...bs.map((r) => r.width)) - Math.min(...bs.map((r) => r.width)) < 2,
        'even: ' + bs.map((r) => r.width),
      );
      const row = await rect(page, '#sfEdit'),
        ctl = await rect(page, '#sfCtl');
      assert.ok(row.width > ctl.width - 40, 'the width of the controls');
      // every label whole
      assert.ok(
        await page.$$eval('#sfEdit button', (b) => b.every((x) => x.scrollWidth <= x.clientWidth + 1)),
        'labels fit',
      );
      assert.deepEqual(errors, []);
    }
  });
  test('a finished page keeps no outline from the marker row last open (after Focus mode); Page finished! reads clearly', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.click('#sfColor');
    await idle(page);
    await page.locator('#sfAlist .sfarow .sfah').nth(1).click();
    await idle(page);
    const pic00 = await page.evaluate(
      () => document.getElementById('sfCanvas').getBoundingClientRect().height,
    );
    await page.click('#sfFocus');
    await idle(page);
    await page.click('#sfFDone');
    await idle(page);
    const pic0 = pic00;
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).display),
      'block',
      'the open row is outlined',
    );
    // the picture as big as before Focus mode (it was measured with the page scrolled, and came back smaller)
    const pic1 = await page.evaluate(
      () => document.getElementById('sfCanvas').getBoundingClientRect().height,
    );
    assert.ok(Math.abs(pic1 - pic0) < 3, 'the picture’s size: ' + [pic0, pic1]);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      t.checkComplete();
    });
    await idle(page);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.querySelector('.sfoutline')).display),
      'none',
      'no outline on the finished page',
    );
    // the words on the panel's own colour, 4.5:1 at least (v316: light words on the dark card; before, dark on the green)
    const c = await page.evaluate(() => {
      const L = (r, g, b) =>
        [r, g, b]
          .map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const p = (s) => s.match(/\d+/g).map(Number);
      const d = document.getElementById('sfDone'),
        fg = p(getComputedStyle(d).color),
        bg = p(getComputedStyle(d).backgroundColor);
      const a = L(...fg),
        b = L(...bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    assert.ok(c >= 4.5, 'contrast ' + c);
    assert.deepEqual(errors, []);
  });
  test('Share: every button has its icon, and Save image keeps it after saving', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await idle(page);
    for (const id of ['sfReveal', 'sfExport', 'sfPrint', 'sfPlan', 'sfAsPal', 'sfShareGuide'])
      assert.ok(await page.$('#' + id + ' svg.ic'), id);
    await page.click('#sfExport');
    await page.waitForFunction(() => !document.getElementById('sfExport').disabled, null, { timeout: 15000 });
    await idle(page);
    assert.ok(await page.$('#sfExport svg.ic'), 'the icon back after Preparing…');
    assert.equal((await page.textContent('#sfExport')).trim(), 'Save image');
    assert.deepEqual(errors, []);
  });
  test('iPad sheets: Change colour as wide as the guide card, Cancel and Done sharing its width', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await page.evaluate(() => scrollTo(0, 0));
    await idle(page);
    const p = await page.evaluate(() => {
      const t = __mstest,
        l = t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[1],
        c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        q = t.labelPos(l);
      return { x: r.left + (q.x / c.width) * r.width, y: r.top + (q.y / c.height) * r.height };
    });
    await page.mouse.click(p.x, p.y);
    await idle(page);
    await page.click('.sftip [data-a="change"]');
    await idle(page);
    const sh = await rect(page, '#sfSheet'),
      card = await rect(page, '#sfWork'),
      cn = await rect(page, '#sfPopCancel'),
      dn = await rect(page, '#sfPopConfirm'),
      hd = await rect(page, '#sfSheet .sfshhd');
    assert.ok(
      Math.abs(sh.left - card.left) < 2 && Math.abs(sh.right - card.right) < 2,
      'the card’s width: ' + JSON.stringify([sh, card]),
    );
    assert.ok(
      cn.left - sh.left < 20 && sh.right - dn.right < 20 && Math.abs(cn.width - dn.width) < 3,
      'the buttons share the width: ' + JSON.stringify([cn, dn, sh]),
    );
    assert.ok(hd.width > 0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v306-dbg-home.test.mjs ----
// v306 debugging pass (home): Plan › Colours from › Generate palette › Rainbow, whose Shuffle gave the same Rainbow
// every time; Home's latest piece when the newest finished guide is a copy with section edits still to be built, and
// when it's the guide open in Colour along.
{
  const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const genPal = (page) => page.evaluate(() => JSON.stringify(__mstest.genPal));
  // the sample guide, every section ticked and saved: its id
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
  const revealing = (page) =>
    page.evaluate(() => document.getElementById('sfRoot').classList.contains('sfrev'));
  test('Plan › Generate palette › Rainbow: Shuffle rolls another rainbow, as Palette’s Generate does', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.evaluate(() => {
      state.owned = new Set(defaultOwned());
      save();
      __mstest.coll = sfCollection();
      SF.reassign();
    });
    await idle(page);
    await click(page, '.sftabbtn[data-t="colours"]');
    await idle(page);
    await click(page, '#sfSrc [data-v="palette"]');
    await idle(page);
    await page.selectOption('#sfHarm', 'rainbow');
    await idle(page);
    const first = await genPal(page);
    // chosen: the Gradient's own Rainbow, as Palette makes it first
    assert.equal(
      first,
      await page.evaluate(() =>
        JSON.stringify(
          genPalette(Math.max(6, Math.min(16, __mstest.styleVars.limitN)), 'rainbow', {
            mood: __mstest.styleVars.emphasis,
          }).map((i) => mkey(i)),
        ),
      ),
    );
    for (const fam of ['random', 'gradient']) {
      await page.evaluate((f) => {
        __mstest.styleVars.family = f;
        SF.reassign();
      }, fam);
      await idle(page);
      await click(page, '.sftabbtn[data-t="pattern"]');
      await idle(page);
      const seen = new Set([await genPal(page)]);
      for (let k = 0; k < 3; k++) {
        await click(page, fam === 'gradient' ? '#sfVary' : '#sfShuffle');
        await idle(page);
        const p = JSON.parse(await genPal(page));
        assert.ok(
          await page.evaluate((p) => palOnScheme(p.map(keyIdx), 'rainbow'), p),
          fam + ': still round the wheel',
        );
        seen.add(JSON.stringify(p));
      }
      assert.ok(seen.size >= 3, fam + ': ' + seen.size + ' different Rainbows in 4');
    }
    assert.deepEqual(errors, []);
  });
  // (v306 smalls: such a copy is left out of the latest piece, which went to it and opened it in Edit sections before)
  test('Home’s latest piece: a copy with section edits to build is left out; the guide it was kept from leads', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const a = await finishedSample(page);
    const name = await page.evaluate((a) => state.saved.find((s) => s.id === a).name, a);
    // as a tab kept it (keepSlot): "… (section edits)", the guide finished, its edits waiting
    await page.evaluate(
      (a) =>
        IDB.get('guide-' + a).then((pl) => {
          const e = state.saved.find((s) => s.id === a);
          return sfSaveDesign({
            id: 9401,
            name: 'Edited (section edits)',
            W: e.W,
            H: e.H,
            keys: e.keys,
            n: e.n,
            payload: { ...pl, edits: 1 },
            quiet: true,
          });
        }),
      a,
    );
    assert.equal(await page.evaluate(() => state.saved.find((s) => s.id === 9401).eds), 1);
    await page.click('#mCollection');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    assert.equal(await page.textContent('#homeHero .hhname'), name);
    await page.click('#homeHeroGo');
    await page.waitForFunction((a) => __mstest.curId === a, a);
    await idle(page, 1500);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
    assert.deepEqual(errors, []);
  });
  test('Home’s latest piece: Reveal & share for the guide open in Colour along plays its Reveal', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    const a = await finishedSample(page);
    await page.click('#sfColor');
    await page.waitForFunction(() => __mstest.sfmode === 'color');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    await page.click('#homeHeroGo');
    await page.waitForFunction((a) => __mstest.curId === a, a);
    await page.waitForFunction(() => document.getElementById('sfRoot').classList.contains('sfrev'));
    await page.keyboard.press('Escape');
    await idle(page, 1500);
    assert.equal(await revealing(page), false);
    assert.deepEqual(errors, []);
  });
}
