// v310.1 (reviewer 4: the first run and the app as a whole): a returning tester's backup restored on a new device keeps
// the full section step (a backup made before v310); the quick check is said to a screen reader; Ctrl+Z from a Mood picture keeps the keyboard there.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  setup,
  teardown,
  openApp,
  idle,
  welcome,
  sampleGuide,
  saveGuide,
  answerAsks,
  openBackupDialog,
  ROOT,
} from './helpers.mjs';

before(setup);
after(teardown);

const flag = (page) => page.evaluate(() => localStorage.getItem('ms-sec-tools'));

test('guides from a backup made before v310, restored into a Library with none (a new iPad): the full section step stays', async () => {
  const a = await openApp({ width: 820, height: 1180 });
  await sampleGuide(a.page);
  await saveGuide(a.page);
  await openBackupDialog(a.page);
  const [dl] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#backupDownload')]);
  const d = JSON.parse(await readFile(await dl.path(), 'utf8'));
  // (the app's own version, whatever it is now: v310 or later)
  assert.match(d.app, /^v3(1\d|[2-9]\d)(\.\d+)?$/);
  assert.equal(d.guides.length, 1);
  const dir = await mkdtemp(join(tmpdir(), 'v3101-d4-'));
  const as = async (app, name) => {
    const f = join(dir, name);
    await writeFile(f, JSON.stringify({ ...d, app }));
    return f;
  };
  // [the version that made the backup, guides in it, the step after]: a v310 backup is a new tester moving from a
  // Safari tab to the Home Screen app (docs/TESTERS.md), who keeps the quick check
  for (const [app, guides, want] of [
    ['v309.2', true, '1'],
    [undefined, true, '1'],
    ['v310', true, '0'],
    ['v309.2', false, '0'],
  ]) {
    // a fresh install: the first start of v310 finds no guide and sets the quick check
    const b = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': null } });
    await answerAsks(b.page);
    assert.equal(await flag(b.page), '0');
    const f = await as(app, 'b-' + app + '-' + guides + '.json');
    if (!guides) await writeFile(f, JSON.stringify({ ...d, app, guides: [] }));
    const [fc] = await Promise.all([b.page.waitForEvent('filechooser'), b.page.click('#wcRestore')]);
    await fc.setFiles(f);
    await idle(b.page, 1500);
    assert.equal(await b.page.isVisible('#welcome'), false);
    assert.equal(
      await b.page.evaluate(() => state.saved.filter((s) => s.type === 'guide').length),
      guides ? 1 : 0,
    );
    assert.equal(await flag(b.page), want, app + (guides ? ' with guides' : ' without'));
    assert.deepEqual(b.errors, []);
    await b.ctx.close();
  }
  assert.deepEqual(a.errors, []);
});

test('the quick check is said to a screen reader once the sections are found', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
  await welcome(page, 'look');
  await idle(page);
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: buf });
  await page.waitForSelector('#sfQuick', { state: 'visible', timeout: 60000 });
  await idle(page);
  const n = await page.textContent('#sfQuickN');
  assert.match(n, /^\d+ sections$/);
  assert.equal(
    await page.textContent('#sfLive'),
    'Looks right? We found ' + n + ' to colour. Build guide, or Fix sections.',
  );
  assert.deepEqual(errors, []);
});

test('Ctrl+Z from a Mood picture: the keyboard stays on the picture', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-test-moodpics': '1' } });
  await sampleGuide(page);
  await idle(page);
  await page.focus('#sfMood .sfmp[data-v="vivid"]');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.getAttribute('#sfMood .sfmp[data-v="vivid"]', 'aria-pressed'), 'true');
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.getAttribute('#sfMood .sfmp[data-v="vivid"]', 'aria-pressed'), 'false', 'undone');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.v), 'vivid');
  // and on Pattern's buttons too
  await page.click('#sfTab-pattern');
  await idle(page);
  const b = await page.evaluate(() => {
    const x = [...document.querySelectorAll('#sfCtl [data-v]')].find(
      (e) =>
        e.tagName === 'BUTTON' &&
        !e.id &&
        e.getAttribute('aria-pressed') === 'false' &&
        e.getClientRects().length &&
        !e.disabled,
    );
    return x ? x.dataset.v : null;
  });
  assert.ok(b, 'a Pattern button with no id');
  await page.focus(`#sfCtl button[data-v="${b}"]:not([id])`);
  await page.keyboard.press('Enter');
  await idle(page);
  await page.keyboard.press('Control+z');
  await idle(page);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.v), b, 'Pattern: ' + b);
  assert.deepEqual(errors, []);
});
