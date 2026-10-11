// v313 (D10): a colouring page that came as a PDF opens with PDF.js (vendor/pdfjs). One page goes straight on, as a
// scan does (no straightening); several pages ask which, with a small picture of each; a blank page, or a file that
// isn't a PDF, says to screenshot the page instead. The PDFs are written here, a few lines of drawing each. Each test
// fails on v312, which only said to take a screenshot.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome } from './helpers.mjs';

before(setup);
after(teardown);

// a PDF of Letter pages, each drawn by its content stream (PDF drawing operators)
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
// a grid of boxes (cols × rows), outlined 3pt thick
const grid = (cols, rows) => {
  let s = '3 w\n';
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
      s += `${60 + i * (492 / cols)} ${90 + j * (612 / rows)} ${492 / cols - 8} ${612 / rows - 8} re S\n`;
  return s;
};
async function guideScreen(page) {
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mSections');
  await idle(page);
}
async function openPdf(page, buf, name = 'page.pdf') {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPdf')]);
  await fc.setFiles({ name, mimeType: 'application/pdf', buffer: buf });
}
const sections = (page) => page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
const errCard = (page) =>
  page
    .waitForFunction(() => /Take a screenshot/.test(document.getElementById('sfRoot').textContent), null, {
      timeout: 60000,
    })
    .then(() => page.evaluate(() => document.getElementById('sfRoot').textContent));

test('a one-page PDF: Open the PDF draws it at the working size and goes on to its sections, as a scan does', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await guideScreen(page);
  assert.match(await page.textContent('#sfStart .sfstpdf'), /Colouring page in a PDF\? Open the PDF/);
  assert.equal(await page.getAttribute('#sfFile', 'accept'), 'image/*', 'the photo picker as it was');
  await openPdf(page, mkPdf([grid(4, 5)]));
  await sections(page);
  const r = await page.evaluate(() => ({
    src: __mstest.srcSize,
    q: __mstest.pgQ,
    n: __mstest.countedList().length,
  }));
  assert.deepEqual(r.src, [Math.round((2400 * 612) / 792), 2400], 'its long side 2400');
  assert.equal(r.q, null, 'not straightened');
  assert.ok(r.n >= 20 && r.n <= 24, r.n + ' sections (20 boxes)');
  assert.deepEqual(errors, []);
});

test('a PDF of several pages asks which, with a small picture of each; Cancel leaves things as they were', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await guideScreen(page);
  const pdf = mkPdf(['BT /F1 24 Tf 200 700 Td ET', grid(3, 3), grid(5, 6)]);
  await openPdf(page, pdf);
  await page.waitForSelector('#sfEdAsk .sfpdfpg');
  assert.match(
    await page.textContent('#sfEdAsk .dsub'),
    /This PDF has 3 pages\. Choose the colouring page\./,
  );
  assert.equal(await page.locator('#sfEdAsk .sfpdfpg').count(), 3);
  await page.waitForFunction(() => document.querySelectorAll('#sfEdAsk .sfpdfth canvas').length === 3, null, {
    timeout: 30000,
  });
  await page.click('#sfEdAsk [data-a="cancel"]');
  await idle(page);
  assert.equal(await page.isVisible('#sfStart'), true, 'still the start card');
  // again, and the third page
  await openPdf(page, pdf);
  await page.waitForSelector('#sfEdAsk .sfpdfpg');
  await page.click('#sfEdAsk .sfpdfpg[data-a="3"]');
  await sections(page);
  const n = await page.evaluate(() => __mstest.countedList().length);
  assert.ok(n >= 30 && n <= 34, n + ' sections (30 boxes: page 3)');
  assert.deepEqual(errors, []);
});

test('a blank page, or a file that isn’t a PDF: it says to take a screenshot instead', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await guideScreen(page);
  await openPdf(page, mkPdf(['']));
  assert.match(
    await errCard(page),
    /That PDF page came out blank here\. Take a screenshot of the colouring page/,
  );
  await openPdf(page, Buffer.from('not a PDF at all'), 'broken.pdf');
  await page.waitForFunction(
    () => /Couldn’t open that PDF/.test(document.getElementById('sfRoot').textContent),
    null,
    {
      timeout: 60000,
    },
  );
  // (an error with Copy details is expected here, not a page error)
  assert.deepEqual(errors, []);
});

test('Home’s start card offers a PDF too', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await welcome(page, 'look');
  await page.click('#mHome');
  await idle(page);
  const b = page.locator('#homeCont [data-start="pdf"]');
  assert.ok(await b.isVisible());
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), b.click()]);
  await fc.setFiles({ name: 'p.pdf', mimeType: 'application/pdf', buffer: mkPdf([grid(2, 2)]) });
  await sections(page);
  assert.equal(await page.evaluate(() => state.mode), 'sections');
  assert.deepEqual(errors, []);
});
