// v308 merge (reviewer 2): the dialogs the data and beta branches added under the output branch's focus trap. Each
// opens with its highlighted answer on the keyboard, Tab and Shift+Tab stay in it, and Escape answers Cancel.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, saveGuide, idle, until } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08', 'Ohuhu|G36'];
const onboarded = (extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v308',
  [KEY]: JSON.stringify({
    mode: 'home',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: OWN,
    saved: [],
  }),
  ...extra,
});
const file = (o, name = 'b.json') => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)),
});
const openLib = async (page) => {
  if (!(await page.isVisible('#savedOverlay'))) {
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
  }
};
const toastText = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    return t && t.classList.contains('on') ? t.textContent : '';
  });
// what has the keyboard: a dialog answer's data-a, else its id
const focused = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a ? (a.dataset && a.dataset.a) || a.id || a.tagName : null;
  });
// Tab round the dialog: every stop is inside it, and it comes back to where it started
async function tabRound(page, keys = 'Tab') {
  const start = await focused(page),
    seen = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(keys);
    assert.ok(
      await page.evaluate(() => document.getElementById('sfEdAsk').contains(document.activeElement)),
      keys + ' stays in the dialog',
    );
    const f = await focused(page);
    if (f === start) return seen;
    seen.push(f);
  }
  assert.fail(keys + ' never came back to ' + start + ': ' + seen.join(','));
}

test('a backup from a newer version: Cancel, the highlighted answer, has the keyboard; Enter restores nothing', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: onboarded() });
  const newer = {
    v: 3,
    type: 'ms-backup',
    app: 'v999',
    ts: Date.now(),
    owned: OWN,
    saved: [{ id: 77, type: 'palette', name: 'Later', keys: ['Ohuhu|R014'], ts: 77 }],
    guides: [],
  };
  await openLib(page);
  await page.setInputFiles('#guidesFile', file(newer));
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'stay');
  assert.equal(await focused(page), 'stay', 'Cancel has the keyboard, not Restore anyway');
  assert.deepEqual(await tabRound(page), ['go']);
  assert.deepEqual(await tabRound(page, 'Shift+Tab'), ['go']);
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.equal(await toastText(page), 'Nothing restored.');
  assert.equal(await page.evaluate(() => state.saved.length), 0);
  // Escape is Cancel too
  await page.setInputFiles('#guidesFile', file(newer));
  await page.waitForSelector('#sfEdAsk');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.equal(await page.evaluate(() => state.saved.length), 0);
  assert.deepEqual(errors, []);
});

test('restore choices: Keep my markers has the keyboard, Tab goes round its four answers, Escape restores nothing', async () => {
  const { page, errors } = await openApp({ width: 390, height: 844, storage: onboarded() });
  await openLib(page);
  const bk = {
    v: 3,
    type: 'ms-backup',
    ts: Date.now(),
    owned: ['Ohuhu|R014', 'Copic|E09'],
    saved: [],
    guides: [],
  };
  await page.setInputFiles('#guidesFile', file(bk));
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await focused(page), 'keep');
  assert.deepEqual(await tabRound(page), ['add', 'replace', 'stay']);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.equal(await page.evaluate(() => state.owned.size), OWN.length);
  assert.equal(await toastText(page), 'Nothing restored.');
  assert.deepEqual(errors, []);
});

test('Import a guide already here with ticks this device lacks: Add a copy, the highlighted answer, has the keyboard', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await saveGuide(page);
  const text = await page.evaluate(() => {
    const d = __mstest.currentDesignObj(true);
    d.payload.prog = Object.keys(d.payload.assign).slice(0, 3).map(Number);
    return JSON.stringify(d);
  });
  await openLib(page);
  await page.setInputFiles('#homeImpFile', file(text, 'g.msguide.json'));
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'copy');
  assert.equal(await focused(page), 'copy', 'Add a copy has the keyboard, not Open it');
  assert.deepEqual(await tabRound(page), ['stay', 'open']);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.equal(
    await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length),
    1,
    'Escape adds nothing',
  );
  assert.deepEqual(errors, []);
});

test('a damaged guide and Delete all my data: the highlighted answer has the keyboard, Tab stays in, Escape closes', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  await page.evaluate(async (id) => {
    const p = await IDB.get('guide-' + id);
    p.lmap = 'data:image/png;base64,' + 'iVBORw0KGgo' + 'A'.repeat(60);
    await IDB.put('guide-' + id, p);
  }, id);
  await page.reload();
  await idle(page);
  await openLib(page);
  await page.click(`#savedList .srow[data-id="${id}"] .sopen`);
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await focused(page), 'restore');
  assert.deepEqual(await tabRound(page), ['del', 'stay']);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.equal(await page.evaluate(() => state.saved.length), 1, 'Escape deletes nothing');
  // Delete all my data, over Help
  await page.evaluate(() => {
    for (const o of document.querySelectorAll('.overlay.on')) closeDialog(o);
    setMode('home');
  });
  await idle(page);
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpData > summary');
  await page.click('#helpWipe');
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await focused(page), 'backup');
  // (the box to type DELETE in is a stop too; Delete everything isn't until it's typed)
  assert.deepEqual(await tabRound(page), ['stay', 'wipeWord']);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.ok(await page.isVisible('#helpOverlay.on'), 'Help stays open under it');
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-onboarded')), '1');
  assert.deepEqual(errors, []);
});
