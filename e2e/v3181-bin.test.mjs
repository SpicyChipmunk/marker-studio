// v318.1: Recently deleted. A guide or palette deleted from the Library waits there for a week after the Undo toast has
// gone, through reloads: Put back brings it back as it was (a guide's progress and picture with it); Delete them now,
// or the week up, removes it for good. Fails on v318 (the stored guide went 6 seconds after Delete).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, saveGuide } from './helpers.mjs';

before(setup);
after(teardown);

const stored = (page, id) => page.evaluate((id) => IDB.get('guide-' + id).then((v) => !!v), id);
const shown = (page, id) =>
  page.evaluate((id) => {
    const e = document.getElementById(id);
    return !!e && !e.hidden && e.getClientRects().length > 0;
  }, id);

test('Recently deleted: a guide deleted waits a week, through a reload; Put back brings it back as it was stored', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const g = await page.evaluate(() => {
    const s = state.saved.find((x) => x.type === 'guide');
    return { id: s.id, name: s.name, n: s.n };
  });
  await page.evaluate(() => setMode('home'));
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  assert.equal(await shown(page, 'libBin'), false, 'nothing deleted yet');
  await page.evaluate((id) => libDelete(id), g.id);
  await idle(page);
  // (the Undo toast's time up)
  await page.evaluate(() => libFinish());
  assert.equal(await page.textContent('#libBin'), 'Recently deleted (1)');
  assert.ok(await stored(page, g.id), 'its stored guide kept');
  await page.reload();
  await idle(page, 2500);
  assert.ok(await stored(page, g.id), 'kept through a reload');
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  assert.ok(await shown(page, 'libBin'));
  await page.click('#libBin');
  await page.waitForSelector('#sfEdAsk');
  assert.match(await page.textContent('#sfEdAsk'), /Kept on this device for 7 days/);
  assert.match(
    await page.textContent('#sfEdAsk'),
    new RegExp('Put back “' + g.name + '” guide, deleted today'),
  );
  await page.click('#sfEdAsk [data-a="put:' + g.id + '"]');
  await idle(page);
  const back = await page.evaluate((id) => state.saved.find((s) => s.id === id), g.id);
  assert.ok(back, 'in the Library again');
  assert.equal(back.n, g.n);
  assert.equal(await shown(page, 'libBin'), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-lib-deleting')), null);
  // it opens
  const d = await page.evaluate((id) => sfLoadDesign(id).then((d) => !!(d && d.W && d.assign)), g.id);
  assert.ok(d);
  assert.deepEqual(errors, []);
});

test('Recently deleted: a week up, it goes for good at the next start; Delete them now at once; a palette too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await saveGuide(page);
  const id = await page.evaluate(() => state.saved.find((x) => x.type === 'guide').id);
  await page.evaluate(() => setMode('home'));
  await page.evaluate((id) => (libDelete(id), libFinish()), id);
  // (deleted eight days ago)
  await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('ms-lib-deleting'));
    l.forEach((x) => (x.t = Date.now() - 8 * 864e5));
    localStorage.setItem('ms-lib-deleting', JSON.stringify(l));
  });
  await page.reload();
  await idle(page, 2500);
  await page.waitForFunction(() => localStorage.getItem('ms-lib-deleting') === null);
  assert.equal(await stored(page, id), false, 'gone for good');
  // a palette: deleted, put back; deleted again, Delete them now
  const pid = await page.evaluate(() => {
    const e = { id: 4242, type: 'palette', name: 'Sea', keys: ['Ohuhu|B08', 'Ohuhu|G07'], ts: Date.now() };
    state.saved.unshift(e);
    save();
    libDelete(4242);
    libFinish();
    return e.id;
  });
  await page.evaluate(() => openLibrary());
  await page.waitForSelector('#savedOverlay.on');
  await page.click('#libBin');
  await page.waitForSelector('#sfEdAsk');
  assert.match(await page.textContent('#sfEdAsk'), /Put back “Sea” palette, deleted today/);
  await page.click('#sfEdAsk [data-a="put:' + pid + '"]');
  await idle(page);
  assert.ok(await page.evaluate((id) => state.saved.some((s) => s.id === id), pid));
  await page.evaluate((id) => (libDelete(id), libFinish()), pid);
  await page.click('#libBin');
  await page.waitForSelector('#sfEdAsk');
  await page.click('#sfEdAsk [data-a="purge"]');
  await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-lib-deleting')), null);
  assert.equal(await shown(page, 'libBin'), false);
  assert.deepEqual(errors, []);
});
