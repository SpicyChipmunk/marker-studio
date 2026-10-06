// v308 Library: ⋯ › Duplicate; a guide file that's already here asks before making a twin; "… (n)" names; a damaged
// guide says so once, with Restore it from a backup and Delete it; a photo picked in Import a guide can become one;
// guide files carry the app's version and a name in any script.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, sampleGuide, saveGuide, idle, until, rename, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

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
const flush = async (page) => {
  await page.evaluate(() => __mstest.flushSave());
  await idle(page);
};
const guides = (page) =>
  page.evaluate(() =>
    state.saved.filter((s) => s.type === 'guide').map((s) => ({ id: s.id, name: s.name, done: s.done || 0 })),
  );
const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id), id);
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
const row = (id) => `#savedList .srow[data-id="${id}"]`;
// the open guide as Share › Guide file writes it
const guideFile = (page) =>
  page.evaluate(() => {
    const d = __mstest.currentDesignObj(true);
    d.app = appVersion();
    return JSON.stringify(d);
  });
const importFile = async (page, text, name = 'g.msguide.json') => {
  await openLib(page);
  await page.setInputFiles('#homeImpFile', { name, mimeType: 'application/json', buffer: Buffer.from(text) });
};

test('⋯ › Duplicate: “… (2)” with the same plan, ticks starting fresh; Open goes to it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  await tickN(page, 4);
  const [g] = await guides(page);
  await openLib(page);
  await page.click(row(g.id) + ' .smore');
  assert.deepEqual(await page.$$eval(row(g.id) + ' .smenu button', (b) => b.map((x) => x.textContent)), [
    'Rename',
    'Duplicate',
    'Delete',
  ]);
  await page.click(row(g.id) + ' .sdup');
  await until(page, () => state.saved.filter((s) => s.type === 'guide').length === 2, null, 'the copy');
  await idle(page);
  const copy = (await guides(page)).find((x) => x.id !== g.id);
  assert.equal(copy.name, g.name + ' (2)');
  assert.equal(copy.done, 0);
  const a = await stored(page, g.id),
    b = await stored(page, copy.id);
  assert.equal(a.prog.length, 4, 'the open guide’s ticks were saved first');
  assert.ok(!b.prog || !b.prog.length, 'the copy’s start fresh');
  assert.equal(b.lmap, a.lmap);
  assert.deepEqual(b.assign, a.assign, 'the same plan');
  assert.deepEqual(b.style, a.style);
  assert.equal(await toastText(page), 'Duplicated as “' + copy.name + '”, ticks start fresh Open');
  await page.click('#toastAct');
  await until(page, (id) => __mstest.curId === id && __mstest.assignData, copy.id, 'the copy open');
  // a duplicate of the copy counts on
  await openLib(page);
  await page.click(row(copy.id) + ' .smore');
  await page.click(row(copy.id) + ' .sdup');
  await until(page, () => state.saved.filter((s) => s.type === 'guide').length === 3, null, 'the third');
  assert.ok((await guides(page)).some((x) => x.name === g.name + ' (3)'));
  assert.deepEqual(errors, []);
});

test('Import a guide that’s already here: Open it, or Add a copy named “… (2)”; a file with ticks this device lacks leads with Add a copy', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await saveGuide(page);
  await tickN(page, 3);
  await flush(page);
  const [g] = await guides(page);
  const text = await guideFile(page);
  await importFile(page, text);
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.textContent('#sfEdAskT'), 'Already in your Library');
  assert.match(
    await page.textContent('#sfEdAskD'),
    new RegExp('^“' + g.name + '” is here, 3 of \\d+ coloured \\(the file: 3\\)\\.$'),
  );
  assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'open');
  await page.click('#sfEdAsk [data-a="open"]');
  await until(page, (id) => __mstest.curId === id && __mstest.assignData, g.id, 'the guide here open');
  assert.equal((await guides(page)).length, 1, 'no twin');
  // Add a copy
  await importFile(page, text);
  await page.waitForSelector('#sfEdAsk');
  await page.click('#sfEdAsk [data-a="copy"]');
  await until(page, () => state.saved.filter((s) => s.type === 'guide').length === 2, null, 'the copy');
  assert.ok((await guides(page)).some((x) => x.name === g.name + ' (2)'));
  // a file further along than this device
  const more = JSON.parse(text);
  more.payload.prog = more.payload.prog.concat(Object.keys(more.payload.assign).slice(30, 33).map(Number));
  await importFile(page, JSON.stringify(more));
  await page.waitForSelector('#sfEdAsk');
  assert.match(
    await page.textContent('#sfEdAskD'),
    /\(the file: 6\)\. The file has ticks this one doesn’t\.$/,
  );
  assert.equal(await page.getAttribute('#sfEdAsk .btn-primary', 'data-a'), 'copy');
  await page.click('#sfEdAsk [data-a="stay"]');
  await idle(page);
  assert.equal((await guides(page)).length, 2, 'Cancel adds nothing');
  assert.deepEqual(errors, []);
});

test('a damaged guide: one message, with Delete it (and Undo) and Restore it from a backup, which puts the backup’s copy in its place', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const [g] = await guides(page);
  await openLib(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#guidesBackup')]);
  const backup = await readFile(await dl.path());
  await idle(page);
  // its stored section map damaged, then the guide opened from the Library
  await page.evaluate(async (id) => {
    const p = await IDB.get('guide-' + id);
    p.lmap = 'data:image/png;base64,' + 'iVBORw0KGgo' + 'A'.repeat(60);
    await IDB.put('guide-' + id, p);
  }, g.id);
  // (opened afresh, as after a reload: the guide open now is the one in memory)
  await page.reload();
  await idle(page);
  await openLib(page);
  await page.click(row(g.id) + ' .sopen');
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.textContent('#sfEdAskT'), 'Can’t open this guide');
  assert.equal(
    await page.textContent('#sfEdAskD'),
    '“' + g.name + '” can’t be opened — its saved section map is damaged.',
  );
  assert.equal(await page.locator('.mserr').count(), 0, 'said once');
  await page.click('#sfEdAsk [data-a="del"]');
  await idle(page);
  assert.equal((await guides(page)).length, 0);
  assert.match(await toastText(page), /^Deleted “.+” Undo$/);
  await page.click('#toastAct');
  await idle(page);
  assert.equal((await guides(page)).length, 1, 'Undo');
  // Restore it from a backup: the file picker opens in the same tap, and the backup's copy replaces it
  await openLib(page);
  await page.click(row(g.id) + ' .sopen');
  await page.waitForSelector('#sfEdAsk');
  const [fc] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#sfEdAsk [data-a="restore"]'),
  ]);
  await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
  await until(
    page,
    () => /restored/.test((document.getElementById('msToast') || {}).textContent || ''),
    null,
    'the restore',
  );
  const gs = await guides(page);
  assert.deepEqual(
    gs.map((x) => x.id),
    [g.id],
    'in its place, no “(from backup)” copy',
  );
  await openLib(page);
  await page.click(row(g.id) + ' .sopen');
  await until(page, (id) => __mstest.curId === id && __mstest.assignData, g.id, 'it opens');
  assert.deepEqual(errors, []);
});

test('a photo picked in Import a guide can become a new guide; an empty or cut-short guide file says so', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const text = await guideFile(page);
  await importFile(page, '', 'empty.msguide.json');
  await page.waitForSelector('#savedOverlay .mserr');
  assert.match(await page.textContent('#savedOverlay .mserr'), /That file is empty\./);
  await page.evaluate(() => document.querySelectorAll('.mserr').forEach((c) => c.remove()));
  await importFile(page, text.slice(0, Math.round(text.length / 2)));
  await page.waitForSelector('#savedOverlay .mserr');
  assert.match(
    await page.textContent('#savedOverlay .mserr'),
    /This guide file is incomplete or damaged — it may not have finished downloading\./,
  );
  const png = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  await openLib(page);
  await page.setInputFiles('#homeImpFile', { name: 'IMG_0002.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.textContent('#sfEdAskT'), 'Make a guide from this photo?');
  await page.click('#sfEdAsk [data-a="go"]');
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  assert.equal(await page.isVisible('#savedOverlay'), false);
  assert.deepEqual(errors, []);
});

test('a guide file carries the app’s version and a name in any script; one from a newer version asks first', async () => {
  const { page, errors } = await openApp({ width: 1180, height: 820 });
  await sampleGuide(page);
  await saveGuide(page);
  await rename(page, '紫陽花の庭 №2');
  await idle(page);
  // (the name the file is handed over with: a download's own name isn't kept by every browser under test)
  await page.evaluate(() => {
    window.__names = [];
    const h = handOver;
    window.handOver = function (b, n, o) {
      __names.push(n);
      return h(b, n, o);
    };
  });
  await page.click('.sftabbtn[data-t="share"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfShareGuide')]);
  assert.deepEqual(await page.evaluate(() => __names), ['紫陽花の庭 2.msguide.json']);
  const d = JSON.parse(await readFile(await dl.path(), 'utf8'));
  assert.equal(d.name, '紫陽花の庭 №2');
  assert.equal(d.app, await page.evaluate(() => appVersion()));
  const n0 = (await guides(page)).length;
  d.app = 'v999';
  d.payload.prog = [];
  d.payload.assign[Object.keys(d.payload.assign)[0]] = 'Ohuhu|R014';
  await importFile(page, JSON.stringify(d));
  await page.waitForSelector('#sfEdAsk');
  assert.equal(await page.textContent('#sfEdAskT'), 'Made by a newer Marker Studio');
  assert.deepEqual(await page.$$eval('#sfEdAsk [data-a]', (b) => b.map((x) => x.textContent)), [
    'Open anyway',
    'Cancel',
  ]);
  await page.click('#sfEdAsk [data-a="stay"]');
  await idle(page);
  assert.equal((await guides(page)).length, n0, 'nothing added');
  assert.deepEqual(errors, []);
});
