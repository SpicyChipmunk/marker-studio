// v308 restore: Keep my markers is the highlighted answer, "Add the backup's" merges, and every change to your
// markers has Undo (and a 7-day fallback); a guide only further along here gets no "(from backup)" copy and each guide
// in the file is said once; a long restore shows its progress and holds the controls; damaged, empty and picture files
// and files from a newer version are said as such; toasts are plain text.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  setup,
  teardown,
  openApp,
  sampleGuide,
  saveGuide,
  idle,
  until,
  openBackupDialog,
  ROOT,
} from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const DAY = 864e5;
const onboarded = (extra = {}) => ({
  'ms-onboarded': '1',
  'ms-setup-tip': '1',
  'ms-last-ver': 'v307',
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
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const guide = (id, name) => ({
  id,
  name,
  W: 1,
  H: 1,
  keys: ['Ohuhu|R014'],
  n: 1,
  ts: Date.now() - DAY,
  payload: { lmap: PNG, assign: { 0: 'Ohuhu|R014' } },
});
const file = (o, name = 'b.json') => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)),
});
const toastText = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    return t && t.classList.contains('on') ? t.textContent : '';
  });
const hideToast = (page) =>
  page.evaluate(() => {
    const t = document.getElementById('msToast');
    if (t) t.classList.remove('on');
  });
const mk = (page) =>
  page.evaluate(() => ({ owned: [...state.owned].sort(), wish: state.wish.map((w) => w.k) }));
const openLib = async (page) => {
  if (!(await page.isVisible('#savedOverlay'))) {
    await page.evaluate(() => openLibrary());
    await page.waitForSelector('#savedOverlay.on');
  }
};
const restoreFile = async (page, o) => {
  await hideToast(page);
  await openLib(page);
  await page.setInputFiles('#guidesFile', file(o));
};
const ask = (page) => page.waitForSelector('#sfEdAsk', { timeout: 10000 });
const BK = (extra = {}) => ({
  v: 3,
  type: 'ms-backup',
  ts: Date.now() - DAY,
  owned: ['Ohuhu|R014', 'Ohuhu|B08', 'Copic|E09', 'Ohuhu|R16'],
  wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }],
  ink: {},
  saved: [],
  guides: [],
  ...extra,
});

test('different markers: Keep my 8 is highlighted; Add the backup’s merges and says so; Undo marker change puts them back', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: onboarded({ [KEY]: appState({ wish: [{ k: 'Copic|E09', why: 'mine', ts: 1 }] }) }),
  });
  await restoreFile(page, BK());
  await ask(page);
  assert.equal(await page.textContent('#sfEdAskT'), 'Your markers differ from the backup’s');
  assert.equal(
    await page.textContent('#sfEdAskD'),
    'You have 8 markers; the backup has 4 (2 of them yours too). Either way, the backup’s palettes are added.',
  );
  assert.deepEqual(
    await page.$$eval('#sfEdAsk [data-a]', (b) => b.map((x) => x.dataset.a + ':' + x.textContent)),
    [
      'keep:Keep my 8',
      'add:Add the backup’s 2 to mine (10)',
      'replace:Use the backup’s 4 (6 of yours go)',
      'stay:Cancel',
    ],
  );
  assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'keep');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'keep', 'and has the keyboard');
  await page.click('#sfEdAsk [data-a="add"]');
  await idle(page);
  const after = await mk(page);
  assert.equal(after.owned.length, 10);
  // E09 came in, so your To buy entry for it comes off; the backup's G43 (not yours) comes in
  assert.deepEqual(after.wish, ['Ohuhu|G43']);
  assert.equal(
    await toastText(page),
    'Added 2 markers from the backup (10 now); also 1 to buy. Undo marker change',
  );
  await page.click('#toastAct');
  await idle(page);
  assert.deepEqual(await mk(page), { owned: [...OWN].sort(), wish: ['Copic|E09'] }, 'as they were');
  assert.equal(await toastText(page), 'Put back your 8 markers as they were before the restore.');
  await page.reload();
  await idle(page);
  assert.equal((await mk(page)).owned.length, 8, 'kept');
  // with nothing new in the backup, no Add
  await restoreFile(page, BK({ owned: ['Ohuhu|R014'] }));
  await ask(page);
  assert.deepEqual(await page.$$eval('#sfEdAsk [data-a]', (b) => b.map((x) => x.dataset.a)), [
    'keep',
    'replace',
    'stay',
  ]);
  await page.click('#sfEdAsk [data-a="stay"]');
  await idle(page);
  assert.deepEqual(errors, []);
});

test('Use the backup’s: Undo in the toast, and for 7 days “Put back the 8 markers…” in the Library and Back up & restore until your markers change', async () => {
  const { page, errors } = await openApp({
    width: 1180,
    height: 820,
    storage: onboarded({ [KEY]: appState() }),
  });
  await restoreFile(page, BK());
  await ask(page);
  await page.click('#sfEdAsk [data-a="replace"]');
  await idle(page);
  assert.equal((await mk(page)).owned.length, 4);
  assert.match(await toastText(page), /^Restored — 4 markers\. Undo marker change$/);
  await page.reload();
  await idle(page);
  await openLib(page);
  assert.equal(
    await page.textContent('#libPreRestore'),
    'Put back the 8 markers you had before today’s restore',
  );
  await page.keyboard.press('Escape');
  await openBackupDialog(page);
  assert.ok(await page.isVisible('#bkPreRestore'));
  await page.click('#bkPreRestore');
  await idle(page);
  assert.deepEqual((await mk(page)).owned, [...OWN].sort());
  assert.equal(await page.isVisible('#bkPreRestore'), false, 'gone once used');
  await page.keyboard.press('Escape');
  // a change to your markers since: not offered (it would undo that too)
  await restoreFile(page, BK());
  await ask(page);
  await page.click('#sfEdAsk [data-a="replace"]');
  await idle(page);
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    state.owned.add('Ohuhu|G43');
    save();
  });
  await openLib(page);
  assert.equal(await page.isVisible('#libPreRestore'), false);
  assert.deepEqual(errors, []);
});

test('restore from text: Keep mine is said (with Undo when its lists changed); the same markers aren’t “restored”', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await openBackupDialog(page);
  const paste = (o) =>
    page.evaluate((t) => {
      document.getElementById('backupText').value = t;
      document.getElementById('backupRestore').click();
    }, JSON.stringify(o));
  await paste({
    v: 2,
    owned: ['Ohuhu|R014', 'Copic|E09'],
    wish: [{ k: 'Ohuhu|G43', why: 'x', ts: 1 }],
    saved: [],
  });
  await ask(page);
  await page.click('#sfEdAsk [data-a="keep"]');
  await idle(page);
  assert.equal(await page.textContent('#backupCap'), 'Kept your markers; added 1 to buy.');
  assert.equal(await toastText(page), 'Kept your markers; added 1 to buy. Undo marker change');
  // nothing new: still said (v307 gave no word at all)
  await hideToast(page);
  await paste({ v: 2, owned: ['Ohuhu|R014', 'Copic|E09'], saved: [] });
  await ask(page);
  await page.click('#sfEdAsk [data-a="keep"]');
  await idle(page);
  assert.equal(await page.textContent('#backupCap'), 'Kept your markers.');
  assert.equal(await toastText(page), 'Kept your markers.');
  // the same markers
  await paste({ v: 2, owned: OWN, saved: [] });
  await idle(page);
  assert.equal(await page.textContent('#backupCap'), 'Your markers already match the backup.');
  assert.doesNotMatch(await toastText(page), /restored/i);
  assert.deepEqual(errors, []);
});

// the toast once it says this (what it said instead, when it doesn't)
const waitToast = (page, re) =>
  page
    .waitForFunction(
      (src) => new RegExp(src).test((document.getElementById('msToast') || {}).textContent || ''),
      re.source,
      { timeout: 15000 },
    )
    .catch(async (e) => {
      const t = await page.textContent('#msToast').catch(() => '');
      const er = await page
        .evaluate(() =>
          errNet.list.map((x) => x.msg + ' @' + x.src + ':' + x.line + ' ' + x.stack).join(' | '),
        )
        .catch(() => '');
      throw new Error('the toast didn’t say ' + re + ': “' + t + '” ' + er + ' ' + e.message.split('\n')[0]);
    });
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
const guideNames = (page) =>
  page.evaluate(() => state.saved.filter((s) => s.type === 'guide').map((s) => s.name));

test('a guide only further along here gets no “(from backup)” copy, one with a plan change still does, and each guide is said once', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await saveGuide(page);
  await tickN(page, 2);
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  const bk = {
    v: 3,
    type: 'ms-backup',
    ts: Date.now(),
    owned: await page.evaluate(() => [...state.owned]),
    saved: [],
    guides: await page.evaluate(() => gatherGuides()),
  };
  // three more ticked here since
  await tickN(page, 3, 2);
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  await restoreFile(page, bk);
  await waitToast(page, /further along/);
  assert.equal(await toastText(page), '1 guide is further along here, so it was left as it is.');
  assert.deepEqual(
    (await guideNames(page)).filter((n) => /from backup/.test(n)),
    [],
    'no copy',
  );
  // a plan changed here too: the backup's version comes in beside it, said once (v307: "1 guide restored. 1 guide was
  // newer here…")
  await page.keyboard.press('Escape');
  await page.click('#mSections');
  await idle(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  const shape = await page.getAttribute('#sfShape .sfedit:not(.on)', 'data-v');
  await page.click(`#sfShape [data-v="${shape}"]`);
  await idle(page);
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
  await restoreFile(page, bk);
  await waitToast(page, /newer here/);
  const t = await toastText(page);
  assert.match(
    t,
    /^1 guide was newer here, so it was kept and the backup’s version added as “\(from backup\)”\.$/,
  );
  assert.equal((await guideNames(page)).filter((n) => /\(from backup\)$/.test(n)).length, 1);
  assert.deepEqual(errors, []);
});

test('a restore of many guides says “Restoring 3 of 6…” and holds the Welcome’s controls until it’s done; a second one waits', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.waitForSelector('#welcome.on');
  // (each guide's write slowed, as a big backup's are on an iPad)
  await page.evaluate(() => {
    const put = IDB.put;
    IDB.put = function (k, v) {
      return new Promise((r) => setTimeout(r, 120)).then(() => put.call(IDB, k, v));
    };
    window.__seen = new Set();
    window.__held = [];
    window.__toasts = [];
    const t = window.toast;
    window.toast = function (m, ms) {
      __toasts.push(String(m));
      return t(m, ms);
    };
    new MutationObserver(() => {
      const b = document.getElementById('wcRestore');
      __seen.add(b.textContent);
      if (/Restoring/.test(b.textContent)) {
        __held.push(
          ['wcAdd', 'wcSkip', 'wcHaveSet', 'wcOneByOne', 'wcNotSure'].every((id) => document.getElementById(id).disabled) &&
            document.querySelector('#wcSets input').disabled,
        );
        // a second restore meanwhile is turned away
        if (/Restoring 3 of 6/.test(b.textContent) && !window.__second) {
          window.__second = true;
          restoreAny(new File(['{}'], 'x.json'), 'guidesRestore');
        }
      }
    }).observe(document.getElementById('wcRestore'), { childList: true, characterData: true, subtree: true });
  });
  const bk = {
    v: 3,
    type: 'ms-backup',
    ts: Date.now() - DAY,
    owned: OWN,
    saved: [],
    guides: [1, 2, 3, 4, 5, 6].map((i) => guide(20 + i, 'G' + i)),
  };
  await page.setInputFiles('#wcFile', file(bk));
  await page.waitForFunction(() => !document.getElementById('welcome').classList.contains('on'), null, {
    timeout: 20000,
  });
  assert.ok(await page.evaluate(() => __held.length > 0 && __held.every(Boolean)), 'held throughout');
  // (each step said on the button, and the controls held all the while)
  assert.deepEqual(
    await page.evaluate(() => [1, 2, 3, 4, 5, 6].filter((i) => __seen.has('Restoring ' + i + ' of 6…'))),
    [1, 2, 3, 4, 5, 6],
  );
  assert.ok(
    await page.evaluate(() => __toasts.some((m) => /A restore is already under way/.test(m))),
    'the second waits',
  );
  assert.equal(await page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length), 6);
  assert.equal(
    await page.evaluate(() => document.querySelector('#wcSets input').disabled),
    false,
    'free again',
  );
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('msrestoring')), false);
  assert.deepEqual(errors, []);
});

test('a backup cut short, an empty file and a picture each have their own words', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  const full = JSON.stringify({
    v: 3,
    type: 'ms-backup',
    ts: 1,
    owned: OWN,
    saved: [],
    guides: [guide(21, 'Owl')],
  });
  const say = async (f) => {
    await openLib(page);
    await page.evaluate(() => document.querySelectorAll('.mserr').forEach((c) => c.remove()));
    await page.setInputFiles('#guidesFile', f);
    await page.waitForSelector('#savedOverlay .mserr');
    return page.textContent('#savedOverlay .mserr');
  };
  assert.match(
    await say(file(full.slice(0, Math.round(full.length * 0.6)))),
    /This backup is incomplete or damaged — it may not have finished downloading\. Download it again from Files or iCloud Drive, or choose an earlier backup\./,
  );
  assert.match(await say(file('')), /That file is empty\./);
  const png = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  assert.match(
    await say({ name: 'IMG_0001.png', mimeType: 'image/png', buffer: png }),
    /That’s a picture, not a backup\./,
  );
  assert.match(await say(file('{"hello":1}')), /That file isn’t a Marker Studio backup/, 'as before');
  assert.equal(await page.evaluate(() => state.owned.size), OWN.length, 'nothing changed');
  assert.deepEqual(errors, []);
});

test('backups carry the app’s version; one from a newer version is asked about, and Cancel restores nothing', async () => {
  const { page, errors } = await openApp({ storage: onboarded({ [KEY]: appState() }) });
  await openLib(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const made = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(made.app, await page.evaluate(() => appVersion()));
  assert.match(made.app, /^v\d+/);
  await idle(page);
  const newer = {
    v: 3,
    type: 'ms-backup',
    app: 'v999',
    ts: Date.now(),
    owned: OWN,
    saved: [{ id: 77, type: 'palette', name: 'Later', keys: ['Ohuhu|R014'], ts: 77 }],
    guides: [],
  };
  await restoreFile(page, newer);
  await ask(page);
  assert.equal(await page.textContent('#sfEdAskT'), 'Made by a newer Marker Studio');
  assert.match(
    await page.textContent('#sfEdAskD'),
    /^This backup was made by Marker Studio v999; this is v\d+(\.\d+)?\. Update first: close and reopen the app, then try again\.$/,
  );
  assert.equal(
    await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'),
    'stay',
    'Cancel is the highlighted answer',
  );
  await page.click('#sfEdAsk [data-a="stay"]');
  await idle(page);
  assert.equal(await toastText(page), 'Nothing restored.');
  assert.equal(await page.evaluate(() => state.saved.length), 0);
  await restoreFile(page, newer);
  await ask(page);
  await page.click('#sfEdAsk [data-a="go"]');
  await idle(page);
  assert.equal(await page.evaluate(() => state.saved.length), 1, 'Restore anyway');
  assert.deepEqual(errors, []);
});

test('toasts are plain text: a name with markup in it is shown as written', async () => {
  const { page, errors } = await openApp({
    storage: onboarded({
      [KEY]: appState({
        saved: [{ id: 5, type: 'palette', name: '<b>Bold</b> & <i>co</i>', keys: ['Ohuhu|R014'], ts: 5 }],
      }),
    }),
  });
  await openLib(page);
  await page.click('#savedList .srow .smore');
  await page.click('#savedList .srow .sdel');
  assert.equal(await toastText(page), 'Deleted “<b>Bold</b> & <i>co</i>” Undo');
  assert.equal(await page.locator('#msToast b, #msToast i').count(), 0);
  await page.click('#toastAct');
  assert.equal(await page.evaluate(() => state.saved.length), 1, 'Undo still works');
  // the plain toast never makes markup; toastHTML is the explicit way
  await page.evaluate(() => toast('<b>x</b>'));
  assert.equal(await toastText(page), '<b>x</b>');
  assert.equal(await page.locator('#msToast b').count(), 0);
  await page.evaluate(() => toastHTML('<b>x</b>'));
  assert.equal(await page.locator('#msToast b').count(), 1);
  assert.deepEqual(errors, []);
});
