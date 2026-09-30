// Match a colour: photo (default), hex and live camera; errors that clear, unreadable photos, and its layout at large
// text sizes.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { setup, teardown, openApp, welcome, idle, until, shot, ROOT, ENGINE, openAtScale, notOnWebKit, WK } from './helpers.mjs';

before(setup);
after(teardown);

async function openMatch(page) {
  await welcome(page, 'look');
  await page.click('#mCollection');
  await page.click('#mkMatchBtn');
  await idle(page);
}
const best = (page) => page.evaluate(() => { const b = document.querySelector('#matchResult .mbname'); return b ? b.textContent.trim() : ''; });

test('opens on Photo; tapping a photo gives a best match from your markers', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp();
  await openMatch(page);
  assert.equal(await page.getAttribute('.msrc button.on', 'data-src'), 'photo');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#matchPhotoBtn')]);
  await fc.setFiles(join(ROOT, 'src/assets/sample-jellyfish.png')); await idle(page);
  const cb = await page.locator('#matchCanvas').boundingBox();
  await page.mouse.click(cb.x + cb.width * 0.5, cb.y + cb.height * 0.15); await idle(page);
  assert.ok((await best(page)).length > 0, 'shows a match');
  await shot(page, 'match-photo');
  assert.deepEqual(errors, []);
});

test('a typed hex code finds the closest owned marker', async () => {
  const { page, errors } = await openApp();
  await openMatch(page);
  await page.click('.msrc [data-src="hex"]');
  await page.fill('#matchHex', '#2b2c2b'); await idle(page);
  assert.match(await best(page), /120/, 'near-black matches Ohuhu 120 Black');
  assert.deepEqual(errors, []);
});

test('the live camera shows a match and turns off when the dialog closes', { skip: ENGINE !== 'chromium' && 'needs Chromium\u2019s fake camera' }, async () => {
  const { ctx, page, errors } = await openApp();
  await ctx.grantPermissions(['camera']);
  await openMatch(page);
  await page.click('.msrc [data-src="camera"]');
  await page.click('#matchCamBtn');
  await page.waitForFunction(() => { const v = document.getElementById('matchVideo'); return v && v.readyState >= 2; });
  await idle(page);
  assert.ok((await best(page)).length > 0, 'live match shown');
  await shot(page, 'match-camera');
  await page.click('#matchClose'); await idle(page);
  const live = await page.evaluate(() => { const v = document.getElementById('matchVideo'), s = v && v.srcObject; return !!(s && s.getTracks().some((t) => t.readyState === 'live')); });
  assert.equal(live, false, 'camera released');
  assert.deepEqual(errors, []);
});

// ---- From the fourth review (outside the guide screen) ----
const KEY = 'ohuhu-hb320-picker-v3';
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v263', ...extra });
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36', 'Ohuhu|BV310', 'Ohuhu|YR313', 'Ohuhu|RV08', 'Ohuhu|BG311'];
const appState = (extra = {}) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved: [], ...extra });

test('unreadable photos are said by their button, in Match and in Palette › Photo', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  await page.setInputFiles('#matchFile', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
  await page.waitForSelector('#matchOverlay .mserr');
  assert.match(await page.textContent('#matchOverlay .mserr'), /Couldn’t read that image/);
  await page.click('#matchClose');
  await page.click('#mPalette'); await page.click('#harm [data-h="photo"]');
  await page.setInputFiles('#photoFile', { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') });
  await page.waitForSelector('#photoWrap .mserr');
  assert.equal(await page.evaluate(() => document.getElementById('photoPick').nextElementSibling.classList.contains('mserr')), true);
  assert.deepEqual(errors, []);
});

test('Match: a new colour clears a stale hex error; #f00 works; no purple before a colour; one instruction per source', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  assert.equal(await page.textContent('#matchResult'), '', 'no second instruction under the drop zone');
  await page.click('.msrc [data-src="hex"]');
  assert.equal(await page.evaluate(() => document.querySelector('.mpick').classList.contains('empty')), true, 'an empty swatch before a colour');
  await page.fill('#matchHex', 'zzzzzzz'); await idle(page);
  assert.ok(await page.isVisible('#matchHexHint'));
  await page.evaluate(() => window.msMatchHex('#3a7bd5')); await idle(page);
  assert.equal(await page.isVisible('#matchHexHint'), false, 'hint gone');
  assert.equal(await page.evaluate(() => document.getElementById('matchResult').style.opacity), '', 'results not greyed');
  assert.equal(await page.evaluate(() => document.querySelector('.mpick').classList.contains('empty')), false);
  await page.fill('#matchHex', '#f00'); await page.press('#matchHex', 'Enter'); await idle(page);
  assert.equal(await page.inputValue('#matchHex'), '#ff0000');
  assert.match(await page.getAttribute('.mcmp span', 'style'), /background: ?(#ff0000|rgb\(255, 0, 0\))/);
  // reopening starts clean
  await page.click('#matchClose'); await page.click('#mkMatchBtn');
  assert.equal(await page.evaluate(() => document.querySelector('.mpick').classList.contains('empty')), true);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review (outside the guide screen) ----
const SHOTS = process.env.SHOTS || '';// a folder: the layout tests save their screenshots there
const onboardedV265 = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-last-ver': 'v265', ...extra });
async function shotToDir(page, name) { if (!SHOTS) return; await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/g3-${name}.png` }); }

for (const [w, scale] of [[360, 1.6], [390, 1.3]]) {
  test(`Match at ${w}px, ${scale}x: tab names whole, and + To buy under the name`, async () => {
    const { page, errors } = await openAtScale(scale, { width: w, height: 760, storage: onboardedV265({ [KEY]: appState() }) });
    await page.click('#mCollection'); await page.click('#mkMatchBtn');
    await page.evaluate(() => { document.getElementById('matchCamBtn').style.display = ''; });
    const tabs = await page.$$eval('#matchOverlay .msrc button', (l) => l.filter((b) => b.getClientRects().length).map((b) => { const s = getComputedStyle(b); return { t: b.textContent, lines: Math.round(b.getBoundingClientRect().height / parseFloat(s.lineHeight) - 0.2), over: b.scrollWidth > b.clientWidth + 1 }; }));
    assert.ok(tabs.some((x) => x.t === 'Hex'), 'called "Hex"');
    for (const x of tabs) { assert.ok(!x.over, x.t + ' fits its tab'); assert.ok(x.lines <= 2, JSON.stringify(x)); }
    const tabText = await page.$$eval('#matchOverlay .msrc button', (l) => l.filter((b) => b.getClientRects().length).map((b) => { const r = document.createRange(); r.selectNodeContents(b); return r.getClientRects().length; }));
    assert.ok(tabText.every((n) => n === 1), 'each name on one line: ' + tabText);
    await page.click('#matchOverlay .msrc [data-src="hex"]'); await page.fill('#matchHex', '#3a7bd5'); await idle(page);
    const rows = await page.$$eval('#matchResult .mrow.buy', (l) => l.map((r) => { const n = r.querySelector('.mnm').getBoundingClientRect(), b = r.querySelector('.wishbtn').getBoundingClientRect(), h = [...document.querySelectorAll('#matchResult .mlh')].pop().getBoundingClientRect(); return { nw: n.width, below: b.top >= n.bottom - 1, left: Math.round(b.left - n.left), inFlow: r.getBoundingClientRect().top >= h.bottom - 1 }; }));
    assert.ok(rows.length, 'there are markers to buy');
    for (const r of rows) { assert.ok(r.inFlow, 'under its heading'); assert.ok(r.nw >= 80, 'the name has room: ' + JSON.stringify(r)); assert.ok(r.below && r.left === 0, '+ To buy on its own line under the name: ' + JSON.stringify(r)); }
    await page.evaluate(() => document.querySelector('#matchResult .mrow.buy').scrollIntoView({ block: 'center' })); await idle(page);
    await shotToDir(page, `match-${w}-${scale}x`);
    assert.deepEqual(errors, []);
  });
}

// ---- Colour engines round 2 (v270): ranked by eye, words on CIEDE2000, a buy list only when clearly closer, the
// camera's pointer to a photo, and Tap the white paper ----
test('Match ranks by eye (CIEDE2000): where plain L*a*b* distance would pick a violet, a blue wins; words and tooltips say ΔE00', async () => {
  const { page, errors } = await openApp();
  await openMatch(page);
  // with Honolulu 120, #005ab4 is 18.2 from V216 Morning Glory and 20.7 from B115 Classic Blue in plain distance, but
  // by eye B115 is much closer (CIEDE2000 4.7 against 14.4)
  const why = await page.evaluate(() => { const t = hexToLab('#005ab4'), f = (c) => COLORS.findIndex((m) => m.brand === 'Ohuhu' && m.code === c); const d76 = (i) => Math.hypot(t[0] - LAB[i][0], t[1] - LAB[i][1], t[2] - LAB[i][2]); return [isOwned(f('V216')) && isOwned(f('B115')), d76(f('V216')) < d76(f('B115')), de2000(t, LAB[f('B115')]) < de2000(t, LAB[f('V216')]) - 5]; });
  assert.deepEqual(why, [true, true, true], 'both owned, and the two measures disagree here');
  await page.evaluate(() => window.msMatchHex('#005ab4')); await idle(page);
  assert.match(await best(page), /B115/);
  assert.equal(await page.textContent('#matchResult .mbq'), 'Close match', '4.7 is Close (4 to 7)');
  assert.equal(await page.getAttribute('#matchResult .mbq', 'title'), 'ΔE00 4.7');
  const rows = await page.$$eval('#matchResult .mrow', (l) => l.map((r) => { const m = /^ΔE00 ([\d.]+) · tap to copy$/.exec(r.title); return [r.title, r.querySelector('.mq').textContent, m && matchWord(+m[1])]; }));
  assert.ok(rows.length && rows.every(([, w, want]) => w === want), JSON.stringify(rows));
  // a marker you own matches itself exactly (Find similar on the Markers screen opens Match this way)
  const own = await page.evaluate(() => COLORS[COLORS.findIndex((m, i) => isOwned(i))].hex);
  await page.evaluate((h) => window.msMatchHex(h), own); await idle(page);
  assert.equal(await page.textContent('#matchResult .mbq'), 'Near-exact match');
  assert.deepEqual(errors, []);
});

test('Match: markers to buy are listed only when at least 2 ΔE00 closer than your best', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  const buyHead = () => page.evaluate(() => [...document.querySelectorAll('#matchResult .mlh')].some((h) => h.textContent === 'Closer ones you could buy'));
  // #cc6666: your best is 5.8 away and R410 5.2: barely closer, so not listed (it was before)
  await page.evaluate(() => window.msMatchHex('#cc6666')); await idle(page);
  const near = await page.evaluate(() => { const t = hexToLab('#cc6666'); let bo = 1e9, bu = 1e9; for (let i = 0; i < LAB.length; i++) { const d = de2000(t, LAB[i]); if (isOwned(i)) bo = Math.min(bo, d); else bu = Math.min(bu, d); } return { bo, bu }; });
  assert.ok(near.bu < near.bo && near.bo - near.bu < 2, JSON.stringify(near));
  assert.equal(await buyHead(), false, 'no near-ties to buy');
  assert.equal(await page.locator('#matchResult .mrow.buy').count(), 0);
  // #3a7bd5: B06 is 2.9 against your 5.5: listed, and every row listed is at least 2 closer
  await page.evaluate(() => window.msMatchHex('#3a7bd5')); await idle(page);
  assert.equal(await buyHead(), true);
  const gains = await page.evaluate(() => { const r = matchNearest(hexToLab('#3a7bd5')); return r.buy.map((o) => r.owned[0].d - o.d); });
  assert.ok(gains.length && gains.every((g) => g >= 2), JSON.stringify(gains));
  assert.equal(await page.locator('#matchResult .mrow.buy').count(), gains.length);
  assert.deepEqual(errors, []);
});

test('Match › Camera says a still photo gives a truer match', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  await page.evaluate(() => { document.getElementById('matchCamBtn').style.display = ''; navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
  assert.equal(await page.isVisible('#matchCamTip'), false, 'not on the Photo pane');
  await page.click('.msrc [data-src="camera"]');
  assert.equal(await page.textContent('#matchCamTip'), 'For the truest match, take a photo and tap the white paper.');
  assert.ok(await page.isVisible('#matchCamTip'));
  assert.deepEqual(errors, []);
});

// a photo of a page: warm grey paper (as a phone takes white paper under a lamp) on the left, a red and a blue patch
// on the right; as a PNG file for the file input
const pagePhoto = (page, paper = '#baafa0') => page.evaluate((paper) => { const c = document.createElement('canvas'); c.width = 240; c.height = 160; const g = c.getContext('2d'); g.fillStyle = paper; g.fillRect(0, 0, 240, 160); g.fillStyle = '#b8363c'; g.fillRect(140, 10, 90, 60); g.fillStyle = '#2c4f8c'; g.fillRect(140, 90, 90, 60); return c.toDataURL('image/png').split(',')[1]; }, paper).then((b) => ({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
// a tap on the photo, at fractions of its width and height
async function tapPhoto(page, fx, fy) {
  const r = await page.locator('#matchCanvas').boundingBox();
  await page.mouse.click(r.x + r.width * fx, r.y + r.height * fy); await idle(page);
}
const hexNow = (page) => page.inputValue('#matchHex');
// (the canvas is set to 1 pixel first, so its width says when the new photo is drawn; the photo is sized to the space
// it has, not to the canvas before it)
const loadPhoto = async (page, paper) => {
  await page.evaluate(() => { document.getElementById('matchCanvas').width = 1; });
  await page.setInputFiles('#matchFile', await pagePhoto(page, paper));
  await until(page, () => document.getElementById('matchCanvas').width === 240, null, 'the photo drawn'); await idle(page);
};

test('Match › Photo: a photo after a tall one is drawn as sharp as it was on its own', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  const file = (w, h) => page.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#3a7bd5'; g.fillRect(0, 0, w, h); return c.toDataURL('image/png').split(',')[1]; }, [w, h]).then((b) => ({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }));
  // (the hint under the photo is hidden first: it shows again when the photo is drawn)
  const load = async (w, h) => {
    await page.evaluate(() => { document.getElementById('mPhotoHint').style.display = 'none'; });
    await page.setInputFiles('#matchFile', await file(w, h));
    await until(page, () => document.getElementById('mPhotoHint').style.display === '', null, 'the photo drawn'); await idle(page);
    return page.evaluate(() => document.getElementById('matchCanvas').width);
  };
  const alone = await load(2000, 1500);
  await load(400, 3000);
  assert.equal(await load(2000, 1500), alone, 'the same size after a tall photo');
  assert.ok(alone >= 600, 'drawn at the dialog’s width in device pixels: ' + alone);
  assert.deepEqual(errors, []);
});

test('Match › Photo: Tap the white paper corrects the lighting; a bad spot says so; ✕ and a new photo take it away; Escape leaves the mode', notOnWebKit(WK.photo), async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState({ mode: 'collection' }) }) });
  await page.click('#mkMatchBtn'); await page.waitForSelector('#matchOverlay.on');
  assert.equal(await page.isVisible('#matchPaper'), false, 'no paper button before a photo');
  await loadPhoto(page);
  assert.ok(await page.isVisible('#matchPaper'));
  assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
  assert.equal(await page.textContent('#matchPaper'), 'Tap the white paper');
  await tapPhoto(page, 0.77, 0.25);
  const red0 = await hexNow(page);
  assert.equal(red0, '#b8363c', 'the red as photographed');
  // into the mode: the next tap sets the paper, not a sample
  await page.click('#matchPaper');
  assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#matchPaperNote'), /tap a plain white part of the paper/);
  // Escape leaves the mode, not the dialog
  await page.keyboard.press('Escape'); await idle(page);
  assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
  assert.ok(await page.isVisible('#matchOverlay'), 'the dialog stays open');
  assert.equal(await page.textContent('#matchPaperNote'), '');
  // the red patch can't be paper: said plainly, and the mode stays for another try
  await page.click('#matchPaper'); await tapPhoto(page, 0.77, 0.25);
  assert.equal(await page.textContent('#matchPaperNote'), 'That spot is too dark or too coloured to be white paper. Tap a plain white part of the page.');
  assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'true');
  assert.equal(await page.isVisible('#matchLight'), false);
  assert.equal(await hexNow(page), red0, 'no sample taken');
  // the paper: corrected, and the red sampled before is sampled again through the correction
  await tapPhoto(page, 0.2, 0.5);
  assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
  assert.ok(await page.isVisible('#matchLight'));
  assert.match(await page.textContent('#matchLight'), /^Lighting corrected/);
  const want = await page.evaluate(() => { const f = lightFix([srgbToLin(0xba), srgbToLin(0xaf), srgbToLin(0xa0)]), c = lightApply(f, 0xb8, 0x36, 0x3c); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); });
  assert.notEqual(want, red0);
  assert.equal(await hexNow(page), want, 'the red, corrected');
  assert.ok((await page.getAttribute('#matchResult .mcmp', 'title')).includes(want.toUpperCase()), 'the result shows the corrected colour');
  // the paper now reads as white, and the photo shows the correction
  await tapPhoto(page, 0.2, 0.5);
  const paper = await page.evaluate(() => { const l = hexToLab(document.getElementById('matchHex').value); return [l[0], Math.hypot(l[1], l[2])]; });
  assert.ok(paper[0] > 92 && paper[1] < 3, 'paper about white: ' + paper);
  const px = () => page.evaluate(() => [...document.getElementById('matchCanvas').getContext('2d').getImageData(20, 20, 1, 1).data].slice(0, 3));
  assert.ok((await px()).every((v) => v > 230), 'the photo shows the paper white: ' + (await px()));
  // ✕ takes it away: the sample and the photo as they were
  await tapPhoto(page, 0.77, 0.25);
  await page.click('#matchLight'); await idle(page);
  assert.equal(await page.isVisible('#matchLight'), false);
  assert.equal(await hexNow(page), red0);
  assert.deepEqual(await px(), [0xba, 0xaf, 0xa0]);
  // a new photo starts without a correction
  await page.click('#matchPaper'); await tapPhoto(page, 0.2, 0.5);
  assert.ok(await page.isVisible('#matchLight'));
  await loadPhoto(page, '#c0b8a8');
  assert.equal(await page.isVisible('#matchLight'), false, 'the chip goes with the old photo');
  assert.equal(await page.getAttribute('#matchPaper', 'aria-pressed'), 'false');
  await tapPhoto(page, 0.77, 0.25);
  assert.equal(await hexNow(page), red0, 'samples uncorrected');
  // paper that is already white: nothing to correct
  await loadPhoto(page, '#f1f1f1');
  await page.click('#matchPaper'); await tapPhoto(page, 0.2, 0.5);
  assert.equal(await page.textContent('#matchPaperNote'), 'The paper already looks white: nothing to correct.');
  assert.equal(await page.isVisible('#matchLight'), false);
  assert.deepEqual(errors, []);
});
