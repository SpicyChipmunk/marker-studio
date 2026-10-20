// v318.28 (deep debugging pass, step 2): Y2, a palette band's tap (reviewer C's C1, C4, C5) and a PDF of more than 60
// pages (reviewer D's D1). Each test fails on v318.27.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome } from './helpers.mjs';

before(setup);
after(teardown);

async function palette(page, owned) {
  await welcome(page, 'look');
  await idle(page);
  await page.evaluate((o) => {
    state.owned = new Set(o || presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 120')));
    state.ink = {};
    save();
  }, owned);
  await page.click('#mPalette');
  await idle(page);
}
const card = (page) =>
  page.evaluate(() => ({
    pal: state.palettes[state.palettes.length - 1].join(),
    palH: state.palH.slice(),
    sub: document.querySelector('#readout .fam').textContent,
    note: document.getElementById('palClose').textContent,
  }));
const tap = async (page, k) => {
  await page.click(`#bands .band:nth-child(${k + 1}) .bhit`);
  await idle(page, 1500);
};

test('C1: a band tap on a palette left on the card by a scheme that couldn’t be made keeps its own scheme', async () => {
  const { page, errors } = await openApp();
  await palette(page, ['Copic|R27', 'Copic|G07', 'Copic|B29', 'Copic|Y08', 'Copic|V09']);
  await page.click('#harm button[data-h="complementary"]');
  await idle(page);
  await page.click('#draw');
  await idle(page, 1500);
  // five clear markers can't make a Rainbow: the Complementary stays on the card
  await page.click('#harm button[data-h="rainbow"]');
  await idle(page, 800);
  const a = await card(page);
  assert.equal(a.sub, 'Complementary');
  // each band in turn (re-rolled by its own scheme's rules, or "No other marker fits this scheme")
  for (let k = 0; k < 4; k++) await tap(page, k);
  const b = await card(page);
  assert.ok(!b.palH.includes('rainbow'), 'never pushed as a Rainbow: ' + b.palH.join());
  assert.equal(b.sub, 'Complementary');
  assert.doesNotMatch(b.note, /rainbow/);
  await page.click('#saveBtn');
  await idle(page, 500);
  assert.equal(await page.evaluate(() => state.saved[0].h), 'complementary', 'saved as a Complementary');
  assert.deepEqual(errors, []);
});

test('C4: a Rainbow built from a base keeps “· X base” after another band is re-rolled', async () => {
  const { page, errors } = await openApp();
  await palette(page);
  await page.click('#harm button[data-h="rainbow"]');
  await idle(page, 800);
  const si = await page.evaluate(() => {
    const si = COLORS.findIndex((c, i) => inPool(i) && c.code === 'G310');
    state.palSize = 8;
    setSeed(mkey(si));
    return si;
  });
  await idle(page, 1500);
  assert.match((await card(page)).sub, /^Rainbow · Ohuhu .+ base$/);
  const k = await page.evaluate(
    (si) => (state.palettes[state.palettes.length - 1].indexOf(si) === 0 ? 1 : 0),
    si,
  );
  await tap(page, k);
  const b = await card(page);
  assert.ok(b.pal.split(',').includes(String(si)), 'the base is still in it');
  assert.match(b.sub, /^Rainbow · Ohuhu .+ base$/);
  assert.deepEqual(errors, []);
});

test('C5: From photo with an unusable photo: the scheme’s palette left on the card still re-rolls by its scheme', async () => {
  const { page, errors } = await openApp();
  await palette(page);
  await page.click('#harm button[data-h="complementary"]');
  await idle(page);
  await page.click('#draw');
  await idle(page, 1500);
  // a photo of a blank white page
  await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 120;
    c.height = 90;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 120, 90);
    _photoImg = c;
    setHarmony('photo');
  });
  await idle(page, 800);
  assert.match(await page.evaluate(() => document.body.textContent), /No usable colours in that image/);
  const a = await card(page);
  assert.equal(a.sub, 'Complementary');
  assert.match(
    await page.getAttribute('#bands .band:nth-child(2) .bhit', 'aria-label'),
    /tap for another like it$/,
  );
  await tap(page, 1);
  const b = await card(page);
  assert.notEqual(b.pal, a.pal, 'the tap re-rolled the band');
  assert.equal(b.palH[b.palH.length - 1], 'complementary');
  assert.equal(b.sub, 'Complementary');
  assert.deepEqual(errors, []);
});

// ---- D1: a PDF of more than 60 pages ----
function mkPdf(pages) {
  const objs = [];
  const add = (s) => objs.push(s) && objs.length;
  const cat = add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');
  const kids = [];
  for (const c of pages) {
    const st = add(`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${st} 0 R >>`));
  }
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const at = [];
  objs.forEach((o, i) => {
    at.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const a of at) out += String(a).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const grid = (cols, rows) => {
  let s = '3 w\n';
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      s += `${60 + i * (492 / cols)} ${90 + j * (612 / rows)} ${492 / cols - 8} ${612 / rows - 8} re S\n`;
  return s;
};

test('D1: a PDF of 65 pages: the next pages are a tap away, and page 62 opens', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
  const pages = Array.from({ length: 65 }, (_, i) => (i === 61 ? grid(5, 6) : grid(2, 2)));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPdf')]);
  await fc.setFiles({ name: 'book.pdf', mimeType: 'application/pdf', buffer: mkPdf(pages) });
  await page.waitForSelector('#sfEdAsk .sfpdfpg');
  assert.match(
    await page.textContent('#sfEdAsk .dsub'),
    /This PDF has 65 pages\. Pages 1–60 are shown here\./,
  );
  assert.equal(await page.locator('#sfEdAsk .sfpdfpg').count(), 60);
  assert.equal(await page.textContent('#sfEdAsk [data-a="next"]'), 'Pages 61–65');
  await page.click('#sfEdAsk [data-a="next"]');
  await page.waitForSelector('#sfEdAsk .sfpdfpg[data-a="61"]');
  assert.match(await page.textContent('#sfEdAsk .dsub'), /Pages 61–65 are shown here\./);
  assert.equal(await page.locator('#sfEdAsk .sfpdfpg').count(), 5);
  assert.equal(await page.textContent('#sfEdAsk [data-a="prev"]'), 'Pages 1–60');
  assert.equal(await page.locator('#sfEdAsk [data-a="next"]').count(), 0);
  // the small pictures of these pages are drawn
  await page.waitForFunction(() => document.querySelectorAll('#sfEdAsk .sfpdfth canvas').length === 5, null, {
    timeout: 30000,
  });
  await page.click('#sfEdAsk .sfpdfpg[data-a="62"]');
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  const n = await page.evaluate(() => __mstest.countedList().length);
  assert.ok(n >= 30 && n <= 34, n + ' sections (30 boxes: page 62)');
  assert.deepEqual(errors, []);
});
