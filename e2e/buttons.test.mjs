// One button height across the app (src/css/02-picker.css): an action button is 44px tall, a choice (one of several)
// 40px with a 44px tap area, the tab bars keep their own heights, and a small icon or pill button keeps its size with a
// 44px tap area. At a large text size buttons grow with their text (min-height) and never cut their label. Also: tap
// areas of small controls, and disabled buttons that look disabled.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, openMenu, welcome, sampleGuide, saveGuide, answerAsks, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
// markers, a shopping list, a backup that's due, What's new and the Add to Home Screen card
const storage = () => ({
  'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v200', 'ms-first-use': String(Date.now() - 15 * 864e5),
  [KEY]: JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], wish: [{ k: 'Ohuhu|R16', why: 'blend for R14', ts: 1 }] }),
});
const init = () => { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => false }); window.__MS_HELP_AUTO = true; };

// kinds of button that aren't actions or choices: tab bars, cards and list rows (bigger), small icons and pills
const TAB = '.modes button,.sftabbtn';
// (v288: a palette band's own button fills the band; the Print sheet's choices with a drawing over the word)
// (v306: Home's latest piece's picture)
// (v309: the welcome's ways in and its two-line choices, the colour chart's swatches)
const BIG = '.homecard,.sopen,.mdrop,.hlphiw,.sfRecCard,.sfah,.sfinfo,.focmk,.bhit,.sfprsh .segs button:has(.sfprpv),.hhpic,.wcc,.wcseg button,.wccount button,.chsw';
const CHOICE = '.segs button,.chip,.msrc button,.wcbrands button,#sfRoot .sfedit';
// a link inside a sentence; the guide's tool-row icons and Save pill, whose tap areas stop at the picture's edge,
// and ✎, whose lower edge the Save pill under it shares
const INLINE = '.instnote .sflink,.sfmeta .sflink,#sfRoot .sftools .sfz,#sfSave,#sfRename';

// every visible button in the top dialog (or the page): its height, whether a tap 21px above and below its centre
// still reaches it (44px, give or take a pixel), and whether its label sits inside it (and, on one line, centred)
function buttons(page) {
  return page.evaluate(([TAB, BIG, CHOICE, INLINE]) => {
    const ovs = [...document.querySelectorAll('.overlay.on')], scope = ovs[ovs.length - 1] || document, out = [];
    for (const b of scope.querySelectorAll('button')) {
      if (!b.checkVisibility({ visibilityProperty: true }) || b.closest('.sfSheet,#sfSheet')?.style.display === 'none') continue;
      // from the top of the page (the guide's pinned picture covers what scrolls under it), then into view
      if (!ovs.length) scrollTo({ top: 0, behavior: 'instant' });
      let r = b.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      if (r.top < 30 || r.bottom > innerHeight - 30) { b.scrollIntoView({ block: 'center', behavior: 'instant' }); r = b.getBoundingClientRect(); }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hits = (y) => { const e = document.elementFromPoint(cx, y); return !!e && (e === b || b.contains(e)); };
      if (!hits(cy)) continue; // covered (the page under Focus mode)
      const tap = hits(cy - 21) && hits(cy + 21), who = tap ? '' : [cy - 21, cy + 21].map((y) => { const e = document.elementFromPoint(cx, y); return e ? e.id || e.className || e.tagName : '-'; }).join(' / '); // (21, not 22: hit testing snaps to whole pixels)
      const rg = document.createRange(); rg.selectNodeContents(b); const t = rg.getBoundingClientRect(), lines = rg.getClientRects().length;
      const inside = !t.height || (t.top >= r.top - 1 && t.bottom <= r.bottom + 1);
      const centred = !t.height || Math.abs((t.top + t.bottom) / 2 - cy) <= 2.5;
      const kind = b.matches(TAB) ? 'tab' : b.matches(BIG) ? 'big' : b.matches(INLINE) ? 'inline' : b.matches(CHOICE) ? 'choice' : 'other';
      out.push({ b: b.id ? '#' + b.id : (b.className || 'button') + ' "' + b.textContent.trim().slice(0, 20) + '"', h: Math.round(r.height * 10) / 10, kind, tap, who, inside, centred, oneLine: lines <= 1 });
    }
    return out;
  }, [TAB, BIG, CHOICE, INLINE]);
}

// at the default text size: actions are exactly 44px, choices 40px, anything smaller has a 44px tap area; labels fit
async function check(page, screen, big) {
  await idle(page);
  const bs = await buttons(page), bad = [];
  assert.ok(bs.length > 0, `${screen}: buttons found`);
  for (const x of bs) {
    const why = [];
    if (!x.inside) why.push('label cut off');
    if (!big) {
      if (x.kind === 'choice' && x.h !== 40 && x.h !== 44) why.push('choice not 40px');
      if (x.kind === 'other' && x.h > 44) why.push('action taller than 44px');
      if (x.kind === 'other' && x.h === 44 && x.oneLine && !x.centred) why.push('label off centre');
    } else if (x.kind === 'choice' && x.h < 40) why.push('choice under 40px');
    if ((x.kind === 'choice' || x.kind === 'other') && x.h < 44 && !x.tap) why.push('tap area under 44px (' + x.who + ')');
    if (why.length) bad.push(`${x.b} ${x.h}px: ${why.join(', ')}`);
  }
  assert.deepEqual(bad, [], screen);
  return bs;
}
const close = (page) => page.evaluate(() => { for (const o of document.querySelectorAll('.overlay.on')) o.classList.remove('on'); scrollTo(0, 0); });
const h = (bs, id) => bs.find((x) => x.b === id)?.h;

async function walk(page, big) {
  const home = await check(page, 'Home (the backup card, first when due)', big);
  if (!big) {
    assert.equal(h(home, '#homeNew'), 44, 'New colouring guide: 44px, not 52');
  }
  // one Home card at a time (v265): with a backup due its card comes first (v267); Later brings up the install card
  if (!big) assert.equal(h(home, '#bkGo'), 44, 'the backup card’s button: 44px, not 38');
  if (await page.isVisible('[data-bk="later"]')) { await page.click('[data-bk="later"]'); await idle(page); }
  await check(page, 'Home (install card)', big);
  await page.click('#mCollection'); await idle(page);
  const mk = await check(page, 'Markers', big);
  if (!big) {
    for (const id of ['#mkDrawBtn', '#mkMatchBtn', '#toPalette', '#presetHdr', '#mkMore', '#swatchBtn']) assert.equal(h(mk, id), 44, id);
    assert.deepEqual([...new Set(mk.filter((x) => /ownView|segs/.test(x.b) || x.kind === 'choice').map((x) => x.h))], [40], 'Owned / Unowned / All / To buy: 40px');
  }
  await page.click('#ownView [data-v="wish"]'); await check(page, 'Markers: To buy', big);
  await page.click('#ownView [data-v="all"]'); await check(page, 'Markers: All', big);
  await page.click('#ownView [data-v="owned"]'); await idle(page);
  await page.click('#presetHdr'); await check(page, 'Markers: Add a set you own', big); await page.click('#presetHdr');
  await page.click('#filterBar'); await check(page, 'Markers: filters', big); await page.click('#filterBar');
  await page.click('#mkMore'); await check(page, 'Markers: ⋯ menu', big); await page.click('#mkMore');
  await page.evaluate(() => openBackup()); await page.waitForSelector('#backupOverlay.on'); await check(page, 'Back up & restore', big); await close(page);
  await page.click('#swatchBtn'); await page.waitForSelector('#swOverlay.on'); await check(page, 'swatch chart', big); await close(page);
  // (v309) Tick colours on a chart
  await page.click('#chartOpen'); await page.waitForSelector('#chartOverlay.on'); await check(page, 'colour chart', big); await close(page);
  await page.click('#mkMatchBtn'); await check(page, 'Match: Photo', big);
  await page.click('#matchOverlay .msrc [data-src="hex"]'); await page.fill('#matchHex', '#3a7bd5'); await check(page, 'Match: Hex code', big); await close(page);
  await page.click('#mkDrawBtn'); await idle(page); await check(page, 'Markers: Random', big);
  if (await page.isVisible('#rndBack')) await page.click('#rndBack');
  await page.click('#mPalette'); await idle(page);
  await check(page, 'Palette', big);
  await page.click('#draw'); await idle(page);
  const pal = await check(page, 'Palette after Generate', big);
  if (!big) for (const id of ['#draw', '#undo', '#reset', '#saveBtn', '#libMore', '#useInGuide']) assert.equal(h(pal, id), 44, id);
  // Library and Save image, in the ⋯ menu beside Save
  await page.click('#libMore');
  const more = await check(page, 'Palette: the ⋯ menu', big);
  if (!big) for (const id of ['#savedBtn', '#exportBtn']) assert.equal(h(more, id), 44, id);
  await page.keyboard.press('Escape');
  await page.click('#harm [data-h="photo"]'); await check(page, 'Palette: Photo', big);
  await page.click('#harm [data-h="complementary"]');
  await page.click('#saveBtn'); await idle(page); await page.click('#libMore'); await page.click('#savedBtn'); await check(page, 'Library', big); await close(page);
}

test('one button height: 44px actions, 40px choices, 44px tap areas, on every screen at 390×844', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE, init, storage: storage() });
  await idle(page);
  await walk(page, false);
  assert.deepEqual(errors, []);
});

test('Welcome and the guide keep the rule: 44px actions, 40px choices, a 44px Focus bar', async () => {
  const { page, errors } = await openApp();
  // (v309: the three ways in, then the set list, the find step and one by one, each a step of its own)
  const w0 = await check(page, 'Welcome', false);
  assert.deepEqual([h(w0, '#wcSkip'), h(w0, '#wcRestore')], [44, 44]);
  await page.click('#wcNotSure'); await check(page, 'Welcome: find my set', false);
  await page.click('#wcStepFind .wcback'); await page.click('#wcOneByOne'); await check(page, 'Welcome: one by one', false);
  await page.click('#wcStepOne .wcback');
  await haveSet(page);
  const w = await check(page, 'Welcome: the set list', false);
  assert.deepEqual([h(w, '#wcAdd')], [44]);
  assert.deepEqual([...new Set(w.filter((x) => x.kind === 'choice').map((x) => x.h))], [40], 'brand tabs: 40px');
  await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd'); await idle(page);
  await check(page, 'Welcome: next steps', false);
  await page.click('#wcSample'); await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  await page.evaluate(() => scrollTo(0, 0));
  const g = await check(page, 'guide: Colours', false);
  assert.deepEqual([h(g, '#sfColor'), h(g, '#sfBack2')], [44, 44], 'the bar');
  assert.equal(h(g, '#sfZin'), 34, 'the tool row’s icons keep their size');
  assert.equal(h(g, '#sfTab-colours'), 42, 'the tabs keep theirs');
  await page.click('.sftabbtn[data-t="share"]'); await check(page, 'guide: Share', false);
  await page.click('#sfPrint'); await check(page, 'guide: the Print sheet', false);
  await page.keyboard.press('Escape'); await idle(page);
  await openMenu(page); await check(page, 'guide: the ⋯ menu', false); await page.keyboard.press('Escape');
  await page.click('.sftabbtn[data-t="colours"]'); await page.click('#sfColor'); await idle(page);
  await page.click('#sfFocus'); await idle(page);
  const f = await check(page, 'Focus', false);
  assert.deepEqual(['#sfFBack', '#sfFDone', '#sfFSkip'].map((id) => h(f, id)), [44, 44, 44], 'Focus bar: 44px, not 52');
  assert.deepEqual(errors, []);
});

// v306: Home's latest piece, Reveal & share and Print…: 44px actions, on a phone and an iPad
test('Home’s latest piece keeps the rule: Reveal & share and Print… are 44px', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page); await saveGuide(page);
  await page.evaluate(() => { const t = __mstest; t.assignData.order.forEach((l) => { t.colored[l] = 1; }); t.guideDirty = true; t.updateProgress(); t.renderGuide(); });
  await page.evaluate(() => __mstest.flushSave()); await idle(page, 1500);
  await page.click('#mHome'); await page.waitForSelector('#homeHero .hhbox img');
  for (const [w, hh] of [[390, 844], [820, 1180], [1180, 820]]) {
    await page.setViewportSize({ width: w, height: hh }); await idle(page);
    const bs = await check(page, `Home (latest piece) at ${w}`, false);
    assert.deepEqual([h(bs, '#homeHeroGo'), h(bs, '#homeHeroPrint')], [44, 44], `${w}: Reveal & share, Print…`);
  }
  assert.deepEqual(errors, []);
});

test('at 1.6x text, buttons grow with their labels rather than cutting them', async () => {
  const { page, errors } = await openAtScale(1.6, { userAgent: IPHONE, init, storage: storage() });
  await idle(page);
  await walk(page, true);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (v263 guide screen) ----
test('buttons in the guide are 40px (choices) or 44px (actions), never the app\'s 54px', async () => {
  const { page, errors } = await openApp();
  await welcome(page, 'look'); await page.click('#mSections'); await idle(page);
  const hs = (sel) => page.$$eval(sel, (b) => b.filter((x) => x.getClientRects().length).map((x) => (x.id || x.textContent.trim()) + ':' + Math.round(x.getBoundingClientRect().height)));
  assert.deepEqual(await hs('#sfPick,#sfSample,#sfLib,#sfImport'), ['sfPick:44', 'sfSample:44', 'sfLib:44', 'sfImport:44']);
  await page.click('#sfSample'); await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData)); await idle(page);
  const none54 = async (what) => { const all = await hs('#sfRoot button'); assert.deepEqual(all.filter((x) => x.endsWith(':54')), [], what); };
  for (const t of ['colours', 'pattern', 'shading', 'share']) { await page.click(`.sftabbtn[data-t="${t}"]`); await none54(t); }
  await page.click('.sftabbtn[data-t="pattern"]'); await page.click('#sfFam [data-v="manual"]'); await idle(page); await page.click('#sfPaint'); await idle(page);
  assert.deepEqual(await hs('#sfPaint,#sfBrush'), ['sfPaint:40', 'sfBrush:40']);
  await page.click('#sfBrush'); await page.waitForSelector('#sfSheet.sfpicksh');
  assert.deepEqual(await hs('#sfSheet .sfshft button'), ['sfPopCancel:44', 'sfPopConfirm:44'], 'sheet footers match the bar');
  await page.click('#sfPopCancel'); await page.click('#sfPaint');
  await answerAsks(page);
  await page.click('#sfBack2'); await idle(page); await page.click('#sfAdjToggle'); await idle(page);
  assert.deepEqual(await hs('#sfRotL,#sfRotR,#sfCrop,#sfAutoCrop'), ['sfRotL:44', 'sfRotR:44', 'sfCrop:44', 'sfAutoCrop:44']);
  assert.deepEqual(await hs('#sfEdit button'), ['sfEmToggle:40', 'sfEmMerge:40', 'sfEmSplit:40', 'sfEmAdd:40']);
  await none54('Edit sections');
  await page.click('#sfCrop'); await idle(page);
  assert.deepEqual(await hs('#sfCropApply,#sfCropReset,#sfCropCancel'), ['sfCropApply:44', 'sfCropReset:44', 'sfCropCancel:44']);
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('small controls have 44px tap areas; long palette codes wrap; the To buy view is tidy', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ saved: [{ id: 5, type: 'guide', name: 'G', keys: [], ts: Date.now() }] }) }) });
  // a tap 4px outside a control still reaches it
  const hit = (sel) => page.evaluate((sel) => { const b = document.querySelector(sel), r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top - 4); return !!el && (el === b || b.contains(el)); }, sel);
  await page.waitForSelector('#sfRecent .sfSeeAll');
  assert.ok(await hit('#sfRecent .sfSeeAll'), 'See all');
  await page.click('#homeLibCard');
  assert.ok(await hit('#savedClose'), 'dialog ✕');
  await page.keyboard.press('Escape');
  // (v308: eight markers, one of each colour, can't fill a Complementary of 6, so it isn't offered; a Rainbow of 6 is)
  await page.click('#mPalette'); await page.click('#harm [data-h="rainbow"]'); await page.click('#segs [data-n="6"]'); await page.click('#draw'); await idle(page);
  assert.ok(await page.evaluate(() => { const h = document.querySelector('.readout .hex'); return h.scrollWidth <= h.clientWidth + 1 && h.getBoundingClientRect().right <= document.getElementById('stage').getBoundingClientRect().right + 1; }), 'codes stay on the card');
  await page.click('#mCollection'); await page.click('#ownView [data-v="wish"]'); await idle(page);
  assert.equal(await page.isVisible('#mkDraw'), false, 'no Random / Match in To buy');
  assert.equal(await page.getAttribute('#filterBar', 'aria-expanded'), 'false');
  await page.click('#ownView [data-v="owned"]'); await page.click('#filterBar');
  assert.equal(await page.getAttribute('#filterBar', 'aria-expanded'), 'true');
  assert.equal(await page.getAttribute('#q', 'aria-label'), 'Search markers');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.rgn')).opacity), '1', 'family counts not faded further');
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (guide screen) ----
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().toJSON() : null; }, sel);

test('tap areas: the header\'s Save pill and the ⓘ lines (guide and Markers) are 44px tall to tap', async () => {
  const { page, errors } = await openApp({ storage: { 'ms-seen-hints': '["along","tap","mk-grid","markers"]' } });
  await sampleGuide(page); await idle(page);
  // (v285: the pill shows as Put back, after the open guide was deleted in the Library, or Save after a failed save)
  await saveGuide(page);
  await page.evaluate(() => { const g = state.saved.find((s) => s.type === 'guide'); sfDeleteDesign(g.id); SF.libChanged(g.id, false); }); await idle(page);
  const sv = await page.evaluate(() => { const b = document.getElementById('sfSave'), r = b.getBoundingClientRect(), a = getComputedStyle(b, '::after'); return { h: r.height, tap: parseFloat(a.height), w: r.width }; });
  assert.ok(sv.h < 44 && sv.tap >= 44, `Save looks ${sv.h}px, taps ${sv.tap}px`);
  // the tap area is centred on the pill: a tap 20px above its middle still saves
  const r = await rect(page, '#sfSave');
  assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [r.x + r.width / 2, r.y + r.height / 2 - 20]), 'sfSave');
  await page.click('#sfColor'); await idle(page);
  const info = await page.$$eval('#sfCtl button.sfinfo', (bs) => bs.map((b) => b.getBoundingClientRect().height));
  assert.ok(info.length && info.every((h) => h >= 44), 'collapsed ⓘ lines: ' + info);
  await page.click('#sfCtl button.sfinfo'); await idle(page);
  assert.ok((await page.$eval('#sfCtl button.sfinfo', (b) => b.getBoundingClientRect().height)) >= 44, 'open too');
  await page.click('#mCollection'); await idle(page);
  const mk = await page.$$eval('.mkhint .sfinfo', (bs) => bs.filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height));
  assert.ok(mk.every((h) => h >= 44), 'Markers\' hint: ' + mk);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });

test('disabled buttons look disabled; Clear only when there is something to clear; choices announced', async () => {
  const { page, errors } = await openApp({ storage: onboardedV265({ [KEY]: appState() }) });
  await page.click('#mPalette'); await idle(page);
  const look = (sel) => page.evaluate((s) => { const e = document.querySelector(s), c = getComputedStyle(e); return { dis: e.disabled, op: +c.opacity, cur: c.cursor }; }, sel);
  // (Palette opens on a preview palette since v305: it can be saved, but there's none of yours to clear yet)
  assert.equal((await look('#saveBtn')).dis, false, 'the preview can be saved');
  assert.deepEqual(await look('#reset'), { dis: true, op: 0.4, cur: 'not-allowed' }, 'nothing to clear');
  assert.equal(await page.textContent('#reset'), 'Clear');
  await page.click('#draw'); await idle(page);
  // (the fade back in can still be under way when idle on GitHub's WebKit)
  await page.waitForFunction(() => getComputedStyle(document.getElementById('saveBtn')).opacity === '1', null, { timeout: 3000 }).catch(() => {});
  assert.equal((await look('#saveBtn')).op, 1);
  assert.equal((await look('#reset')).dis, false);
  await page.click('#saveBtn');
  assert.equal((await look('#saveBtn')).op, 1, '"Saved ✓" is not faint');
  // announced choices: Harmony, Colours, and Markers › Show
  const pressed = (sel) => page.$$eval(sel + ' button', (l) => l.filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('aria-pressed')));
  assert.equal((await pressed('#harm')).filter((x) => x === 'true').length, 1);
  assert.ok((await pressed('#harm')).every((x) => x === 'true' || x === 'false'));
  assert.equal(await page.getAttribute('#segs [data-n="4"]', 'aria-pressed'), 'true');
  await page.click('#segs [data-n="5"]');
  assert.equal(await page.getAttribute('#segs [data-n="5"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('#segs [data-n="4"]', 'aria-pressed'), 'false');
  await page.click('#mCollection');
  assert.deepEqual(await pressed('#ownView'), ['true', 'false', 'false', 'false']);
  // the top tabs: 38px to look at, 44px to tap
  const tab = await page.evaluate(() => { const b = document.getElementById('mHome'), r = b.getBoundingClientRect(), a = getComputedStyle(b, '::after'); return { h: r.height, after: parseFloat(a.height), hit: document.elementFromPoint(r.left + r.width / 2, r.top - 2) === b }; });
  assert.equal(Math.round(tab.h), 38);
  assert.ok(tab.after >= 44);
  assert.ok(tab.hit, 'a tap just above the tab reaches it');
  assert.deepEqual(errors, []);
});
