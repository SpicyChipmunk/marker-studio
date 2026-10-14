// v318 data-safety review, and its audit: a guide whose section map can't be read for want of memory isn't called
// damaged, and an import, a lost guide or a restore says memory too (a restore keeps a "damaged" guide's whole stored
// copy aside rather than putting an older copy over it unseen); Tester tasks answers in backups; what Send feedback
// says it sends; the browser's storage not answering; a snooze given while the clock was ahead; a Library guide not
// stored at all, said apart by Back up.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, sampleGuide, saveGuide, idle, until } from './helpers.mjs';

before(setup);
after(teardown);

const guides = (page) =>
  page.evaluate(() =>
    state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, done: s.done || 0 })),
  );
const openLib = async (page) => {
  if (!(await page.isVisible('#savedOverlay'))) {
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
  }
};
// a guide in the Library, a backup of it, then 12 sections coloured and one section's marker changed since
async function guideAndOlderBackup(page) {
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  await openLib(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const backup = await readFile(await dl.path());
  await idle(page);
  await page.evaluate(() => closeDialog(savedOverlay));
  await idle(page);
  await page.evaluate(() => {
    const t = __mstest,
      a = t.assignData,
      l = a.order[20],
      o = a.order.find((x) => a.assign[x].mkey !== a.assign[l].mkey);
    a.assign[l] = a.assign[o];
    a.order.slice(0, 12).forEach((x) => {
      t.colored[x] = 1;
    });
    t.guideDirty = true;
    t.renderGuide();
  });
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  assert.equal((await guides(page))[0].done, 12);
  return { g, backup };
}

test('a section map that can’t be read for want of memory says so, isn’t called damaged, and opens next time', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const { g } = await guideAndOlderBackup(page);
  // (v318 review: the Guide tab keeps one entry of its own, a step above Home; only closed layers' entries are waited on)
  await page.waitForFunction(() => ((history.state && history.state.msLayer) || 0) <= (state.mode === 'home' ? 0 : 1));
  await page.reload();
  await idle(page);
  // the next canvas the size of the guide's section map gets no 2D context, as Safari's when its canvas memory is used up
  await page.evaluate(
    (g) => {
      const o = HTMLCanvasElement.prototype.getContext;
      let left = 1;
      HTMLCanvasElement.prototype.getContext = function (k, a) {
        if (k === '2d' && this.width === g.W && this.height === g.H && left > 0) {
          left--;
          return null;
        }
        return o.call(this, k, a);
      };
    },
    await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id),
  );
  await openLib(page);
  await page.click(`#savedList .srow[data-id="${g.id}"] .sopen`);
  await until(page, () => /short of memory/.test(document.body.innerText), null, 'said');
  assert.equal(await page.$('#sfEdAsk'), null, 'not the damaged guide’s question');
  assert.match(await page.evaluate(() => document.body.innerText), /Your guide is still saved/);
  assert.equal(await page.evaluate((id) => _damaged.has(id), g.id), false, 'not marked damaged');
  await openLib(page);
  await page.click(`#savedList .srow[data-id="${g.id}"] .sopen`);
  await until(page, (id) => __mstest.curId === id && !!__mstest.assignData, g.id, 'it opens');
  assert.equal(await page.evaluate(() => __mstest.colored.filter(Boolean).length), 12);
  assert.deepEqual(errors, []);
});

test('restoring over a guide called damaged keeps its stored copy as “… (before restore)” when that copy is whole', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  const { g, backup } = await guideAndOlderBackup(page);
  await page.evaluate((id) => guideDamaged(id), g.id);
  await openLib(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#guidesRestore')]);
  await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await until(
    page,
    () => /before restore/.test(document.getElementById('backupCap').textContent),
    null,
    'the restore',
  );
  const gs = await guides(page);
  assert.equal(gs.length, 2);
  const kept = gs.find((x) => / \(before restore\)$/.test(x.name)),
    back = gs.find((x) => x.id === g.id);
  assert.ok(kept, 'kept aside');
  assert.equal(kept.done, 12, 'with its colouring');
  assert.equal(back.done, 0, 'the backup’s copy in its place');
  assert.deepEqual(errors, []);
});

test('a lost guide that couldn’t be checked for want of memory is offered again, not put aside for good', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  const row = await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id);
  // its Library row gone (as when the list couldn't be read), its stored guide still here
  await page.evaluate((id) => {
    state.saved = state.saved.filter((s) => s.id !== id);
    save(true);
  }, g.id);
  await page.evaluate((r) => {
    const o = HTMLCanvasElement.prototype.getContext;
    let left = 1;
    HTMLCanvasElement.prototype.getContext = function (k, a) {
      if (k === '2d' && this.width === r.W && this.height === r.H && left > 0) {
        left--;
        return null;
      }
      return o.call(this, k, a);
    };
  }, row);
  // (v318 audit: said as memory, not as a guide that couldn't be read)
  assert.equal(
    await page.evaluate((id) => addLost([id]), g.id),
    '1 guide couldn’t be checked just now: this device is short of memory. Close other apps or tabs, then try again.',
  );
  assert.equal((await guides(page)).length, 0, 'not added this time');
  assert.equal(await page.evaluate((id) => lostSkip().includes(id), g.id), false, 'not put aside');
  assert.match(await page.evaluate((id) => addLost([id]), g.id), /^Added 1 guide back/);
  assert.equal((await guides(page)).length, 1);
  assert.deepEqual(errors, []);
});

// (v318 audit) a restore whose guide couldn't be checked for want of memory says so, not that it couldn't be read; the
// next restore brings it
test('a restore whose guide couldn’t be checked for want of memory says so, and restoring again brings it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  const row = await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id);
  await openLib(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const backup = await readFile(await dl.path());
  // on another device
  const fresh = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await fresh.page.evaluate((r) => {
    const o = HTMLCanvasElement.prototype.getContext;
    let left = 1;
    HTMLCanvasElement.prototype.getContext = function (k, a) {
      if (k === '2d' && this.width === r.W && this.height === r.H && left > 0) {
        left--;
        return null;
      }
      return o.call(this, k, a);
    };
  }, row);
  await openLib(fresh.page);
  const restore = async () => {
    const [fc] = await Promise.all([
      fresh.page.waitForEvent('filechooser'),
      fresh.page.click('#guidesRestore'),
    ]);
    await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  };
  await restore();
  await until(
    fresh.page,
    () => /short of memory/.test(document.getElementById('backupCap').textContent),
    null,
    'the restore',
  );
  const cap = await fresh.page.textContent('#backupCap');
  assert.match(cap, /1 guide couldn’t be checked — this device is short of memory/);
  assert.doesNotMatch(cap, /couldn’t be read/);
  assert.equal((await guides(fresh.page)).length, 0);
  await idle(fresh.page);
  await restore();
  await until(
    fresh.page,
    () => /1 guide restored/.test(document.getElementById('backupCap').textContent),
    null,
    'again',
  );
  assert.equal((await guides(fresh.page)).length, 1);
  assert.deepEqual([...errors, ...fresh.errors], []);
});

test('Tester tasks answers go in the backup and come back with it (all of them on a device with none; yours stay)', async () => {
  const answers = {
    id: 'TABC123',
    name: 'Sam',
    t: { add: { r: 'easy', n: 'quick', v: 'v318' }, guide: { r: 'hard', n: 'sections odd', v: 'v318' } },
    q: { confused: 'the tabs', next: 'yes' },
    sends: 0,
    sig: '',
  };
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-tester': JSON.stringify(answers) },
  });
  await page.evaluate(() => {
    state.owned = new Set(['Ohuhu|R014', 'Ohuhu|Y111']);
    save();
  });
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const backup = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(backup.tester.id, 'TABC123');
  assert.equal(backup.tester.t.guide.n, 'sections odd');
  // a fresh device (the Home Screen app): restored with the markers
  const fresh = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await fresh.page.evaluate(() => openLibrary());
  await fresh.page.waitForSelector('#savedOverlay.on');
  const [fc] = await Promise.all([
    fresh.page.waitForEvent('filechooser'),
    fresh.page.click('#guidesRestore'),
  ]);
  await fc.setFiles({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await until(fresh.page, () => state.owned.size === 2, null, 'restored');
  const got = await fresh.page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')));
  assert.equal(got.id, 'TABC123', 'the same tester');
  assert.deepEqual(got.t, answers.t);
  assert.deepEqual(got.q, answers.q);
  assert.match(await fresh.page.textContent('#homeTasks'), /2 of 6/);
  // a device with answers of its own keeps them, and gains only the ones it hasn't given
  const mine = await openApp({
    width: 820,
    height: 1180,
    storage: {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-tester': JSON.stringify({
        id: 'TMINE1',
        name: '',
        t: { add: { r: 'ok', n: '', v: 'v318' } },
        q: {},
        sends: 0,
        sig: '',
      }),
    },
  });
  await mine.page.evaluate((b) => testerRestore(b.tester), backup);
  const m = await mine.page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')));
  assert.equal(m.id, 'TMINE1');
  assert.equal(m.t.add.r, 'ok', 'yours stays');
  assert.equal(m.t.guide.r, 'hard', 'the one not given here comes in');
  assert.equal(m.name, 'Sam');
  assert.deepEqual([...errors, ...fresh.errors, ...mine.errors], []);
});

// (v318 audit) a backup's Tester tasks with only a name and a send, restored on a device with none: kept, the tester's
// id with them (it had been taken in but not stored)
test('Tester tasks with only a name, restored on a device with none: stored, with the tester’s id', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
  });
  await page.evaluate(() =>
    testerRestore({ id: 'TSAM42', name: 'Sam', t: {}, q: {}, sends: 1, sig: '[{},{},"Sam"]' }),
  );
  const got = await page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester') || 'null'));
  assert.ok(got, 'stored');
  assert.equal(got.id, 'TSAM42');
  assert.equal(got.name, 'Sam');
  assert.deepEqual(errors, []);
});

test('Send feedback says everything it sends: the counts and the tester number, not the name given in Tester tasks', async () => {
  const N = 27,
    FORM =
      'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
      Array.from({ length: N }, (_, i) => 'entry.' + (1000 + i) + '=x').join('&');
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-tester': JSON.stringify({ id: 'TABC123', name: 'Sam', t: {}, q: {}, sends: 0, sig: '' }),
    },
    init: `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};`,
  });
  const posts = [];
  await page.route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
    posts.push([...new URLSearchParams(r.request().postData() || '').values()]);
    return r.fulfill({ status: 200, body: 'ok' });
  });
  await page.click('#homeFeedback');
  await idle(page);
  const said = await page.textContent('#fbOverlay .ttwhat');
  await page.fill('#fbText', 'A note.');
  await page.click('#fbSend');
  await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
  assert.equal(posts.length, 1);
  // (v318.1: the name was given for the results; the tester number links the note to them)
  assert.ok(!posts[0].includes('Sam'), 'not the name');
  assert.ok(posts[0].includes('TABC123'), 'the tester number');
  assert.match(said, /a tester number made on this device \(not your name\)/);
  assert.match(said, /how many markers, guides and palettes/);
  assert.match(said, /screen/);
  assert.deepEqual(errors, []);
});

test('a guide the browser’s storage doesn’t give back says to reload, not that it is missing', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  // (v318 review: the Guide tab keeps one entry of its own, a step above Home; only closed layers' entries are waited on)
  await page.waitForFunction(() => ((history.state && history.state.msLayer) || 0) <= (state.mode === 'home' ? 0 : 1));
  await page.reload();
  await idle(page);
  await page.evaluate((id) => {
    const get = IDB.get;
    IDB.get = (k) =>
      k === 'guide-' + id ? Promise.reject(new DOMException('gone', 'UnknownError')) : get(k);
  }, g.id);
  await openLib(page);
  await page.click(`#savedList .srow[data-id="${g.id}"] .sopen`);
  await until(page, () => /isn’t answering/.test(document.body.innerText), null, 'said');
  assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /missing from this browser/);
  assert.match(await page.evaluate(() => document.body.innerText), /reload Marker Studio/);
  assert.deepEqual(errors, []);
});

test('a browser database that never answers: the guide says to reload, not “Saving…” for good', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    init: () => {
      // (an open request that fires no event at all)
      IDBFactory.prototype.open = function () {
        return {};
      };
    },
  });
  await sampleGuide(page);
  // (v285: a change to the sample is its first save)
  await page.click('.sftabbtn[data-t="pattern"]');
  await page.click('#sfFam [data-v="random"]');
  await until(
    page,
    () => document.getElementById('sfSaveSt').textContent === 'Not saved — reload to try again',
    null,
    'said',
    20000,
  );
  assert.equal(await page.evaluate(() => storeErr()), 'TimeoutError');
  assert.deepEqual(errors, []);
});

test('a Later (or Not now) given while the device’s clock was a year ahead rests a week, not a year', async () => {
  const now = Date.now(),
    yearOn = String(now + 365 * 864e5);
  const { page, errors } = await openApp({
    storage: {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ohuhu-hb320-picker-v3': JSON.stringify({
        mode: 'home',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'],
        saved: [],
      }),
      'ms-first-use': String(now - 15 * 864e5),
      'ms-backup-snooze': yearOn,
      'ms-install-snooze': yearOn,
    },
  });
  await page.waitForSelector('#backupNudge', { state: 'visible' });
  assert.match(await page.textContent('#backupNudge'), /Your 3 markers are only stored on this device/);
  assert.deepEqual(errors, []);
});

test('Back up with a Library guide not stored on this device at all: said by name, with what to do, and no endless reminder', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  await page.evaluate((id) => IDB.del('guide-' + id), g.id);
  await openLib(page);
  await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  await idle(page);
  assert.equal(
    await page.textContent('#msToast'),
    'Backed up, but “' +
      g.name +
      '” isn’t stored on this device any more, so it isn’t in it. If it won’t open from the Library, delete it there.',
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('ms-backup-missed')),
    null,
    'not “couldn’t be read”',
  );
  assert.equal(await page.evaluate(() => guidesAtRisk()), 0, 'not counted as still to back up');
  await page.evaluate(() => closeDialog(savedOverlay));
  await page.click('#mHome');
  await idle(page);
  assert.equal(
    await page.isVisible('#backupNudge'),
    false,
    'no reminder that a reload and a backup can’t answer',
  );
  assert.deepEqual(errors, []);
});
