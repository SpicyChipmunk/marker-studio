// v318.27 (builder V1) in the browser: Print's Paper the second row, on a phone's first screen, with the close-ups note
// under Pages; Home's Markers card counts colours as the guide's card does; Home's button says it starts from a photo;
// ⋯ › Open a PDF with a guide open. Each fails on v318.26.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, openAtScale, idle, sampleGuide, welcome, menuItem } from './helpers.mjs';

before(setup);
after(teardown);

async function printSheet(page) {
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfPrint');
  await page.waitForSelector('#sfSheet.sfprsh');
  await idle(page);
}
// where the Paper row sits against the sheet's foot, as the sheet opens
const paperRow = (page) =>
  page.evaluate(() => {
    const sh = document.getElementById('sfSheet'),
      foot = sh.querySelector('.sfshft').getBoundingClientRect(),
      bs = [...sh.querySelectorAll('[data-paper]')].map((b) => b.getBoundingClientRect()),
      lbl = sh.querySelector('.sfpaper').parentNode.querySelector('.swlbl').getBoundingClientRect(),
      link = sh.querySelector('#sfPrSum [data-pr="topaper"]').getBoundingClientRect();
    return {
      gap: Math.round(foot.top - Math.max(...bs.map((b) => b.bottom))),
      label: Math.round(foot.top - lbl.bottom),
      link: link.height > 0 && link.top >= foot.top - 1 && link.bottom <= innerHeight + 1,
      groups: [...sh.querySelectorAll('[role="group"]')].map((g) => g.getAttribute('aria-label')),
      sum: document.getElementById('sfPrSum').textContent,
      what: document.getElementById('sfPrWhat').textContent,
      wide: sh.scrollWidth - sh.clientWidth,
    };
  });

test('Print on a phone: Pages, Paper, Labels; Paper’s buttons on the first screen; the close-ups note under Pages', async () => {
  for (const [w, h, scale, full] of [
    [390, 844, 1, true],
    [375, 667, 1, true],
    [390, 844, 1.6, true],
    [320, 568, 1.6, false],
  ]) {
    const { page, errors, ctx } = await openAtScale(scale, { width: w, height: h });
    await printSheet(page);
    const r = await paperRow(page),
      at = `${w}×${h} ${scale}×: ${JSON.stringify(r)}`;
    assert.deepEqual(r.groups, ['What to print', 'Paper size', 'Labels on the picture'], at);
    if (full) assert.ok(r.gap >= 0, 'Paper’s buttons above the foot, ' + at);
    // (a small phone at large text: at least the row's label, and the summary's link to it)
    else assert.ok(r.label >= 0 && r.link, 'Paper’s label and the link, ' + at);
    assert.ok(r.wide <= 1, 'nothing sideways, ' + at);
    // (the sample has close-ups: said in full under Pages, the summary one line)
    assert.match(r.sum, /^\d+ pages · Letter · Codes$/, at);
    assert.match(
      r.what,
      /^Your picture with light codes to colour on, then the colour key\.\d+ small sections are on \d+ close-up pages?\./,
      at,
    );
    // (and it follows the choices: none for the test strip, which has no close-ups)
    await page.click('[data-pwhat="strip"]');
    assert.equal(await page.textContent('#sfPrWhat'), 'A box for each marker to try on your paper first.');
    await page.click('[data-pwhat="page"]');
    assert.match(await page.textContent('#sfPrWhat'), /close-up page/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Home’s Markers card counts colours, as the guide’s card and the welcome do; its button: New guide from a photo', async () => {
  const { page, errors, ctx } = await openAtScale(1.6, { width: 320, height: 568 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  // (Honolulu 120 and its Colorless Blender: 121 owned, 120 colours)
  assert.equal(await page.evaluate(() => state.owned.size), 121);
  assert.equal(await page.textContent('.homecard[data-go="collection"] .hcsub'), '120 markers');
  const b = await page.evaluate(() => {
    const e = document.getElementById('homeNew');
    return { t: e.textContent, sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight };
  });
  assert.equal(b.t, 'New guide from a photo');
  assert.ok(b.sw <= b.cw + 1 && b.sh <= b.ch + 1, 'it fits: ' + JSON.stringify(b));
  // (only a blender: it still counts, so the card doesn't ask to set markers up)
  await page.evaluate(() => {
    state.owned = new Set(['Ohuhu|0']);
    setMode('collection');
    setMode('home');
  });
  assert.equal(await page.textContent('.homecard[data-go="collection"] .hcsub'), '1 marker');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// a one-page Letter PDF of a grid of boxes (as e2e/v313-pdf writes them)
function gridPdf() {
  let c = '3 w\n';
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 5; j++) c += `${60 + i * 123} ${90 + j * 122.4} ${115} ${114.4} re S\n`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const at = [];
  objs.forEach((o, i) => {
    at.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const a of at) out += String(a).padStart(10, '0') + ' 00000 n \n';
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

test('with a guide open, ⋯ › Open a PDF: the PDF picker, and the page goes on to its sections', async () => {
  const { page, errors, ctx } = await openApp();
  await sampleGuide(page);
  await idle(page);
  // (the start card, with its Open the PDF, isn't there with a guide open)
  assert.equal(await page.isVisible('#sfPdf'), false);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), menuItem(page, 'Open a PDF')]);
  assert.match(await fc.element().getAttribute('accept'), /application\/pdf/);
  await fc.setFiles({ name: 'grid.pdf', mimeType: 'application/pdf', buffer: gridPdf() });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  const n = await page.evaluate(() => __mstest.countedList().length);
  assert.ok(n >= 20 && n <= 24, n + ' sections (20 boxes)');
  assert.deepEqual(errors, []);
  await ctx.close();
});
