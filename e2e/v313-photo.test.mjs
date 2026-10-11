// v313 (photos): D6, a page photographed under a lamp. The page finder no longer takes the bright half of a lit page for
// the page (the drawing runs across that outline, and the light changes gently there, not in a step), and a drawing's
// outline wins a tie with the paper's only when it fits the drawing. When the finder isn't sure, Keep as is comes first
// and Straighten shows what it's about to do before it does it. The two pictures are made up (a drawn mandala, lit
// unevenly), in e2e/fixtures. Each test fails on v312.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, idle, haveSet, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

const find = (page, name) =>
  page.evaluate(async (name) => {
    const img = new Image();
    img.src = '/e2e/fixtures/' + name;
    await img.decode();
    const r = __mstest.pgFind(img);
    return { tier: r.tier, why: r.why, kind: r.kind, q: r.q };
  }, name);
async function fresh() {
  const a = await openApp();
  await haveSet(a.page);
  await a.page.check('#wcSets input[data-i="3"]');
  await a.page.click('#wcAdd');
  return a;
}
async function pick(page, name) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({
    name,
    mimeType: 'image/png',
    buffer: await readFile(join(ROOT, 'e2e', 'fixtures', name)),
  });
}
const sections = (page) => page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });

test('a page lit unevenly by a lamp: its bright half isn’t taken for the page, so nothing is offered to straighten', async () => {
  const { page, errors } = await fresh();
  const f = await find(page, 'lit-mandala.png');
  assert.deepEqual([f.tier, f.why], ['none', 'lit'], JSON.stringify(f));
  let opened = false;
  await pick(page, 'lit-mandala.png');
  await Promise.race([
    page.waitForSelector('#sfPgGo', { timeout: 40000 }).then(() => (opened = true)),
    sections(page),
  ]);
  assert.equal(opened, false, 'no corner handles');
  await sections(page);
  assert.equal(await page.evaluate(() => __mstest.pgQ), null);
  assert.deepEqual(errors, []);
});

test('a page on a table under a lamp: the paper’s outline, not a diamond round the drawing; Keep as is first; Straighten shows what it’s about to do, then does it', async () => {
  const { page, errors } = await fresh();
  const f = await find(page, 'lit-mandala-table.png');
  assert.equal(f.tier, 'unsure');
  assert.equal(f.kind, 'paper');
  const want = [
    [73, 95],
    [624, 73],
    [648, 629],
    [95, 646],
  ];
  const err = Math.max(...f.q.map((p, i) => Math.hypot(p[0] - want[i][0], p[1] - want[i][1])));
  assert.ok(err < 20, 'the page’s corners, within ' + err.toFixed(1) + ' px');
  await pick(page, 'lit-mandala-table.png');
  await page.waitForSelector('#sfPgGo', { timeout: 40000 });
  // Keep as is first, and the main button; Straighten beside it
  const btns = await page.evaluate(() =>
    [...document.querySelectorAll('.sfpgbtns button')].map(
      (b) => b.id + ':' + b.className + ':' + b.textContent,
    ),
  );
  assert.deepEqual(btns, ['sfPgNo:btn-primary:Keep as is', 'sfPgGo:btn-soft:Straighten']);
  await page.click('#sfPgGo');
  await page.waitForFunction(
    () => {
      const n = document.querySelector('.sfpgnote');
      return !!n && /Straightening the page/.test(n.textContent) && !document.getElementById('sfPgGo');
    },
    null,
    { timeout: 20000 },
  );
  await sections(page);
  await idle(page);
  assert.match(await page.textContent('.sfpgline'), /Page straightened/);
  assert.ok(await page.evaluate(() => !!__mstest.pgQ));
  assert.deepEqual(errors, []);
});
