// Print and the PDF, the test strip.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOT,
  WK,
  addFromMarkers,
  idle,
  letterGuide,
  menuItem,
  notOnWebKit,
  openApp,
  openAtScale,
  pause,
  sampleGuide,
  saveArtifact,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';

before(setup);
after(teardown);

// ---- from v313-plan.test.mjs ----
// v313 (the Plan): D3, a marker's family from its code for a guide made since v313 (famRule 1), and a guide saved before
// keeping v312's rule for good, its tones' markers and blend companions as they were. D7, a marker running low: a line
// under the tabs with Swap it, and "low" on its Colour along row and in the markers on the page. D4, the one-time
// "Screens and ink differ" line, whose link opens Print with Test strip, and the tab "Share & print" where it fits.
{
  async function reopen(page, id) {
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
  }
  test('“Screens and ink differ”: once, after the first-time lines; its link opens Print with Test strip; the tab says Share & print where it fits', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    assert.equal(await page.textContent('.sftabbtn[data-t="share"]'), 'Share & print');
    assert.equal(
      await page.isVisible('#sfStripLine'),
      false,
      'not on the sample, nor beside the first-time line',
    );
    await page.evaluate(() => {
      markHint('tap');
      __mstest.curName = 'Strip test';
    });
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await reopen(page, id);
    const n = await page.evaluate(
      () => new Set(Object.values(__mstest.assignData.assign).map((m) => m.mkey)).size,
    );
    assert.equal(
      await page.textContent('#sfStripLine span'),
      `Screens and ink differ. Print a test strip of these ${n} markers to see them on your paper.`,
    );
    await page.click('#sfStripGo');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
    assert.equal(await page.getAttribute('[data-pwhat="strip"]', 'aria-pressed'), 'true');
    await page.click('#sfSheet [data-pr="cancel"]');
    await idle(page);
    // once only
    await reopen(page, id);
    assert.equal(await page.isVisible('#sfStripLine'), false, 'once');
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-review-guide.test.mjs ----
// v318 review (the guide's workflow, end to end). Each test fails on v318 as released.
{
  // A picture wider than it's tall had its colouring page printed across the top of an upright sheet. Page 1 is now on
  // its side when that prints the picture at least 10% bigger each way; the other pages stay upright, and a tall page
  // stays upright too.
  async function widePage(page) {
    const b64 = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 1500;
      c.height = 1000;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 1500, 1000);
      g.strokeStyle = '#000';
      g.lineWidth = 8;
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 4; j++) g.strokeRect(60 + i * 230, 60 + j * 220, 210, 200);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      return await new Promise((r) => {
        const f = new FileReader();
        f.onload = () => r(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'wide.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
  }
  async function pdfBoxes(page) {
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await idle(page);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sfPDF')]);
    const s = (await readFile(await dl.path())).toString('latin1');
    await page.keyboard.press('Escape');
    await idle(page);
    return [...s.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => [+m[1], +m[2]]);
  }
  test('a wide picture’s colouring page prints on its side; the key and a tall picture’s pages stay upright', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await idle(page);
    const tall = await pdfBoxes(page);
    await page.click('#sfPrint');
    await idle(page);
    assert.doesNotMatch(await page.textContent('#sfPrSum'), /landscape/);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.ok(
      tall.every(([w, h]) => w === 612 && h === 792),
      'the sample: every page upright Letter ' + JSON.stringify(tall),
    );
    await widePage(page);
    // the Print sheet says so
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await idle(page);
    assert.match(await page.textContent('#sfPrSum'), /page 1 landscape/);
    await page.keyboard.press('Escape');
    await idle(page);
    const wide = await pdfBoxes(page);
    assert.deepEqual(wide[0], [792, 612], 'page 1 on its side');
    assert.ok(wide.length >= 2, 'a key page too');
    assert.ok(
      wide.slice(1).every(([w, h]) => w === 612 && h === 792),
      'the other pages upright ' + JSON.stringify(wide),
    );
    // the picture fills the page across, as wide as it can be within the margins
    const r = await page.evaluate(() => {
      const P = CanvasRenderingContext2D.prototype,
        od = P.drawImage,
        imgs = [];
      P.drawImage = function (img, x, y, w, h) {
        if (arguments.length === 5) imgs.push({ cv: this.canvas, w, h });
        return od.apply(this, arguments);
      };
      let cvs;
      try {
        cvs = __mstest.buildPDFPages();
      } finally {
        P.drawImage = od;
      }
      const a = imgs.find((e) => e.cv === cvs[0] && e.w > 100);
      return { pw: cvs[0].width, ph: cvs[0].height, w: a && a.w };
    });
    assert.ok(r.pw > r.ph, 'page 1 drawn wider than tall');
    assert.ok(r.w > r.pw * 0.8, `the picture across the page: ${Math.round(r.w)} of ${r.pw}`);
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-review-ux.test.mjs ----
// v318 review (UI/UX pass), and its audit: Escape leaves the photo's editors in Check the sections (Adjust corners,
// Crop) as their Cancel does, only while the Guide screen shows; the browser's Back in the first-run welcome goes back
// a step; Colour along's tap on another marker's section is said, with Undo; Tester tasks' Send results with nothing
// answered sends nothing; on a phone, a PDF that won't open is said in view. Each fails on v318 as released.
{
  // A PDF (or photo) that won't open, from the Guide screen's start card on a phone: the card saying so is brought into
  // view. Fails on v318 as released (it was below the screen's foot: the tap seemed to do nothing).
  test('on a phone, a PDF that won’t open is said where it can be seen', async () => {
    const { page, errors } = await openApp({
      width: 390,
      height: 844,
      storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1' },
    });
    await page.click('#mSections');
    await idle(page);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPdf')]);
    await fc.setFiles({
      name: 'broken.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('not a PDF at all'),
    });
    await page.waitForFunction(
      () => /Couldn’t open that PDF/.test((document.querySelector('#sfRoot .mserr') || {}).textContent || ''),
      null,
      { timeout: 60000 },
    );
    await idle(page);
    const r = await page.evaluate(() => {
      const b = document.querySelector('#sfRoot .mserr').getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, vh: innerHeight };
    });
    assert.ok(r.top >= 0 && r.bottom <= r.vh, `the card in view: ${JSON.stringify(r)}`);
    assert.deepEqual(errors, []);
  });
}

// ---- from v31824.test.mjs ----
// v318.24 in the browser: the Print sheet shows the pages in order under its choices, as many as the summary says,
// following each choice, without pushing the Paper choices down or the sheet sideways.
{
  async function printSheet(page) {
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
  }
  const order = (page) =>
    page.evaluate(() => {
      const o = document.getElementById('sfPrOrd'),
        n = +/<b>(\d+) page/.exec(document.getElementById('sfPrSum').innerHTML)[1];
      return {
        n: n,
        tiles: o.querySelectorAll('.sfprordp').length,
        words: [...o.querySelectorAll('.sfprordw')].map((w) => w.textContent),
        said: o.querySelector('.sfsr').textContent,
        kinds: __mstest.pdfKinds.map((k) => k.k),
        // under the choices, before the note on what's printed; not in the summary's live region (v320: beside page
        // 1's picture, the two in a row of their own)
        after:
          o.parentNode.classList.contains('sfprtop') &&
          o.previousElementSibling.id === 'sfPrThumb' &&
          o.parentNode.previousElementSibling.classList.contains('swopts') &&
          o.parentNode.nextElementSibling.id === 'sfPrWhat',
        live: !!o.closest('[aria-live]'),
        hidden: o.querySelector('.sfprordr').getAttribute('aria-hidden'),
      };
    });
  test('the Print sheet: the pages in order, as the summary counts them, following each choice', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await printSheet(page);
    let o = await order(page);
    assert.equal(o.tiles, o.n, 'a page shape for each page');
    assert.equal(o.kinds.length, o.n);
    assert.equal(o.kinds[0], 'pic');
    assert.ok(o.kinds.includes('key'));
    assert.equal(o.words[0], 'Picture');
    assert.match(o.said, /^Page 1: your picture with (codes|numbers)[;.]/);
    assert.ok(!/; Pages/.test(o.said), 'lower case after the first');
    assert.equal(o.after, true);
    assert.equal(o.live, false, 'not read out on every tap');
    assert.equal(o.hidden, 'true');
    // (v320) page 1 as it will print, drawn once the sheet is up, in the page's shape; v321: a button, Preview the
    // pages
    await page.waitForSelector('#sfPrThumb canvas');
    const th = await page.evaluate(() => {
      const t = document.getElementById('sfPrThumb'),
        c = t.querySelector('canvas'),
        g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let ink = 0;
      for (let i = 0; i < g.length; i += 4) if (g[i] < 128) ink++;
      return {
        tag: t.tagName,
        name: t.getAttribute('aria-label'),
        ar: c.width / c.height,
        ink: ink / (g.length / 4),
      };
    });
    assert.equal(th.tag, 'BUTTON');
    assert.equal(th.name, 'Preview the pages');
    assert.ok(Math.abs(th.ar - 8.5 / 11) < 0.02, 'Letter: ' + th.ar);
    assert.ok(th.ink > 0.01 && th.ink < 0.6, 'the page drawn: ' + th.ink);
    // Key + reference with no labels: one page, the picture beside the key
    await page.click('[data-pwhat="ref"]');
    await page.click('[data-plabels="none"]');
    o = await order(page);
    assert.equal(o.kinds[0], 'refkey');
    assert.equal(o.words[0], 'Picture + key');
    assert.equal(o.tiles, o.n);
    // the test strip: only its pages
    await page.click('[data-pwhat="strip"]');
    o = await order(page);
    assert.ok(o.kinds.length >= 1 && o.kinds.every((k) => k === 'strip'));
    assert.deepEqual(o.words, ['Test strip']);
    assert.equal(o.tiles, o.n);
    assert.deepEqual(errors, []);
  });
  // (v321) a tap on page 1's picture: every page as it will print, one at a time; ‹ › and the arrow keys; Escape closes
  // the preview only, the Print sheet stays; Download PDF from it writes the PDF
  test('Preview: the pages one by one from page 1’s picture, as many as the summary says; Escape leaves the sheet open', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await printSheet(page);
    await page.waitForSelector('#sfPrThumb canvas');
    const n = await page.evaluate(
      () => +/<b>(\d+) page/.exec(document.getElementById('sfPrSum').innerHTML)[1],
    );
    await page.click('#sfPrThumb');
    await page.waitForSelector('#prevStage canvas');
    const at = () =>
      page.evaluate(() => {
        const c = document.querySelector('#prevStage canvas'),
          g = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 0; i < g.length; i += 16) if (g[i] < 128) ink++;
        return {
          title: document.getElementById('prevTitle').textContent,
          back: document.getElementById('prevBack').disabled,
          next: document.getElementById('prevNext').disabled,
          ink: ink / (g.length / 16),
          fits:
            c.getBoundingClientRect().bottom <= innerHeight && c.getBoundingClientRect().right <= innerWidth,
        };
      });
    let s = await at();
    assert.equal(s.title, 'Page 1 of ' + n);
    assert.equal(s.back, true);
    assert.ok(s.ink > 0.01, 'page 1 drawn: ' + s.ink);
    assert.ok(s.fits);
    for (let i = 2; i <= n; i++) {
      await page.click('#prevNext');
      s = await at();
      assert.equal(s.title, 'Page ' + i + ' of ' + n);
      assert.ok(s.ink > 0.002, 'page ' + i + ' drawn: ' + s.ink);
    }
    assert.equal(s.next, true, 'no page after the last');
    await page.keyboard.press('ArrowLeft');
    assert.equal((await at()).title, 'Page ' + (n - 1) + ' of ' + n);
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.getElementById('prevOverlay').classList.contains('on')),
      false,
    );
    assert.equal(await page.locator('#prevStage canvas').count(), 0, 'its page let go');
    assert.ok(await page.isVisible('#sfSheet.sfprsh'), 'the Print sheet still open');
    assert.deepEqual(errors, []);
  });
  // (v321 debug) a paper chosen just after Download PDF, while the PDF is written: page 1's picture follows it once
  // the PDF is done (it had stayed dimmed, showing the paper before)
  test('page 1’s picture follows a paper chosen while the PDF is being written', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await printSheet(page);
    await page.waitForSelector('#sfPrThumb canvas');
    await page.evaluate(() => {
      document.getElementById('sfPDF').click();
      document.querySelector('[data-paper="a5"]').click();
    });
    await page.waitForFunction(
      () => {
        const t = document.getElementById('sfPrThumb'),
          c = t.querySelector('canvas');
        return !t.classList.contains('wait') && c && Math.abs(c.width / c.height - 148 / 210) < 0.02;
      },
      null,
      { timeout: 30000 },
    );
    assert.deepEqual(errors, []);
  });
  test('the pages in order on a small phone at large text: on one sheet, nothing pushed sideways, Paper where it was', async () => {
    for (const scale of [1, 1.6]) {
      const { page, errors } = await openApp({ width: 320, height: 568 });
      if (scale > 1)
        await page.evaluate((s) => (document.documentElement.style.fontSize = 16 * s + 'px'), scale);
      await printSheet(page);
      const r = await page.evaluate(() => {
        const sh = document.getElementById('sfSheet'),
          o = document.getElementById('sfPrOrd'),
          paperTop = () => document.querySelector('#sfSheet [data-paper]').getBoundingClientRect().top;
        const withRow = paperTop();
        o.style.display = 'none';
        const without = paperTop();
        o.style.display = '';
        const b = o.getBoundingClientRect(),
          s = sh.getBoundingClientRect();
        return {
          moved: withRow - without,
          right: b.right - s.right,
          wide: sh.scrollWidth - sh.clientWidth,
          tiles: o.querySelectorAll('.sfprordp').length,
        };
      });
      assert.ok(r.tiles >= 2, 'tiles: ' + r.tiles);
      assert.equal(r.moved, 0, 'Paper not moved (' + scale + '×)');
      assert.ok(
        r.right <= 1 && r.wide <= 1,
        'nothing past the sheet’s edge (' + scale + '×): ' + JSON.stringify(r),
      );
      assert.deepEqual(errors, []);
      await page.context().close();
    }
  });
}

// ---- from v31825-x3.test.mjs ----
// v318.25 in the browser.
{
  const free = (page) =>
    page.waitForFunction(
      () =>
        !__mstest.segBusy &&
        !/Detecting|Reading/.test((document.getElementById('sfStat') || {}).textContent || ''),
      null,
      { timeout: 40000 },
    );
  // a one-page Letter PDF of circles stroked in grey g (0 black, 1 white)
  function greyPDF(g) {
    const circle = (cx, cy, r) => {
      const k = 0.5523 * r;
      return `${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c S\n`;
    };
    const content =
      `1.5 w ${g} G\n` +
      circle(306, 396, 250) +
      circle(306, 396, 120) +
      circle(200, 250, 60) +
      circle(420, 560, 60);
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 3 0 R /Resources << >> >>',
    ];
    let out = '%PDF-1.4\n';
    const offs = [];
    objs.forEach((o, i) => {
      offs.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const x = out.length;
    out +=
      `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
      offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
      `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
  test('X3 D2: a PDF page drawn in mid or light grey lines opens; it isn’t “blank”', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await page.setInputFiles('#sfPdfFile', {
      name: 'grey.pdf',
      mimeType: 'application/pdf',
      buffer: greyPDF(0.7),
    });
    await page.waitForFunction(
      () => __mstest.W !== 568 || /came out blank/.test(document.body.innerText),
      null,
      { timeout: 40000 },
    );
    await free(page);
    assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /came out blank/);
    assert.notEqual(await page.evaluate(() => __mstest.W), 568, 'the PDF’s page, not the sample');
    assert.ok((await page.evaluate(() => __mstest.comps.length)) > 3, 'its rings found');
    assert.deepEqual(errors, []);
  });
  test('X3 G1: Pages changed while the PDF is written: the file is named for what was written', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await page.click('[data-pwhat="page"]');
    await idle(page);
    let dl = page.waitForEvent('download', { timeout: 60000 });
    await page.click('#sfPDF');
    await page.click('[data-pwhat="strip"]');
    assert.equal((await dl).suggestedFilename(), 'sample-jellyfish.pdf');
    await page.waitForFunction(() => !document.getElementById('sfPDF').disabled);
    dl = page.waitForEvent('download', { timeout: 60000 });
    await page.click('#sfPDF');
    await page.click('[data-pwhat="ref"]');
    assert.equal((await dl).suggestedFilename(), 'sample-jellyfish-test-strip.pdf');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31826-w1.test.mjs ----
// v318.26 (W1) in the browser: the polish set (A2 a batch's photos not read, A3 Focus mode's Back in words, A6 the
// welcome's Undo link in place of its toast, A7 an older cap's name in Markers' search, A9 Print's paper a link to its
// choices, and Download PDF on one line) and Send feedback's waits in the form's Message (D). Each fails on v318.25.
{
  // ---- A9: Print's paper, a link to its choices ----
  test('A9 Print: the summary’s paper is a link to the Paper choices, focusing the one chosen; the foot no taller', async () => {
    const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
    const link = await page.$('#sfPrSum button[data-pr="topaper"]');
    assert.ok(link);
    const paper = (await link.textContent()).trim();
    assert.match(await page.textContent('#sfPrSum'), new RegExp('page.* · ' + paper + ' · '));
    // the foot as tall as with the paper's name as plain text
    const hs = await page.evaluate(() => {
      const s = document.getElementById('sfPrSum'),
        a = s.getBoundingClientRect().height,
        html = s.innerHTML;
      s.innerHTML = html.replace(/<button[^>]*data-pr="topaper"[^>]*>([^<]*)<\/button>/, '$1');
      const b = s.getBoundingClientRect().height;
      s.innerHTML = html;
      return [a, b];
    });
    assert.ok(Math.abs(hs[0] - hs[1]) < 1, 'foot height ' + hs);
    // (and Download PDF on one line: it had wrapped, "PDF" cut off at the button's foot)
    const pdf = await page.evaluate(() => {
      const b = document.getElementById('sfPDF');
      return {
        sh: b.scrollHeight,
        ch: b.clientHeight,
        sw: b.scrollWidth,
        cw: b.clientWidth,
        t: b.textContent,
      };
    });
    assert.ok(pdf.sh <= pdf.ch + 1 && pdf.sw <= pdf.cw + 1, JSON.stringify(pdf));
    await page.click('#sfPrSum button[data-pr="topaper"]');
    await page.waitForTimeout(600);
    const f = await page.evaluate(() => {
      const a = document.activeElement,
        r = a.getBoundingClientRect();
      return {
        paper: a.dataset.paper || null,
        pressed: a.getAttribute('aria-pressed'),
        top: r.top,
        bottom: r.bottom,
        h: innerHeight,
      };
    });
    assert.ok(f.paper, 'a Paper choice has the keyboard');
    assert.equal(f.pressed, 'true', 'the one chosen');
    assert.ok(f.top >= 0 && f.bottom <= f.h, 'in view: ' + JSON.stringify(f));
    assert.deepEqual(errors, []);
  });
}

// ---- from v31827-v1.test.mjs ----
// v318.27 (builder V1) in the browser: Print's Paper the second row, on a phone's first screen, with the close-ups note
// under Pages; Home's Markers card counts colours as the guide's card does; Home's button says it starts from a photo;
// ⋯ › Open a PDF with a guide open. Each fails on v318.26.
{
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
  // (v320, Ben's count rule: "markers" counts every marker owned, the blender too; the guide's card says colours)
  test('Home’s Markers card counts every marker, as Markers does; its button: New guide from a photo', async () => {
    const { page, errors, ctx } = await openAtScale(1.6, { width: 320, height: 568 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mHome');
    await idle(page);
    // (Honolulu 120 and its Colorless Blender: 121 owned, 120 colours)
    assert.equal(await page.evaluate(() => state.owned.size), 121);
    assert.equal(await page.textContent('.homecard[data-go="collection"] .hcsub'), '121 markers');
    const b = await page.evaluate(() => {
      const e = document.getElementById('homeNew');
      return {
        t: e.textContent,
        sw: e.scrollWidth,
        cw: e.clientWidth,
        sh: e.scrollHeight,
        ch: e.clientHeight,
      };
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
}

// ---- from v31828-y2.test.mjs ----
// v318.28 (deep debugging pass, step 2): Y2, a palette band's tap (reviewer C's C1, C4, C5) and a PDF of more than 60
// pages (reviewer D's D1). Each test fails on v318.27.
{
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
    await page.waitForFunction(
      () => document.querySelectorAll('#sfEdAsk .sfpdfth canvas').length === 5,
      null,
      {
        timeout: 30000,
      },
    );
    await page.click('#sfEdAsk .sfpdfpg[data-a="62"]');
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    const n = await page.evaluate(() => __mstest.countedList().length);
    assert.ok(n >= 30 && n <= 34, n + ' sections (30 boxes: page 62)');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31828-y3.test.mjs ----
// v318.28 in the browser: using a guide, saving, output (Y3).
{
  // G1: Key + reference's PDF named apart from Page + key's
  test('Y3 G1: the Key + reference PDF is “…-reference.pdf”', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await page.click('[data-pwhat="ref"]');
    await idle(page);
    const dl = page.waitForEvent('download', { timeout: 60000 });
    await page.click('#sfPDF');
    assert.equal((await dl).suggestedFilename(), 'sample-jellyfish-reference.pdf');
    assert.deepEqual(errors, []);
  });
}

// ---- from v31835-pdf-jpeg.test.mjs ----
// v318.35 (Stage 4.6, E1-8): the PDF's pages with the picture in colour (the key's reference, Key + reference's picture
// and its close-ups) are written as JPEG (DCTDecode, quality 0.9); the colouring page stays lossless (FlateDecode).
// Fails on v318.34, where every page was deflated RGB.
{
  async function sharePrint(page) {
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
  }
  // the PDF's image objects, in page order: { filter, w, h, len, jpegDims: [w, h] from the JPEG's own SOF marker }
  function images(bytes) {
    const s = bytes.toString('latin1'),
      out = [],
      re =
        /<< \/Type \/XObject \/Subtype \/Image \/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8( \/Filter \/(\w+))? \/Length (\d+) >>\nstream\n/g;
    let m;
    while ((m = re.exec(s))) {
      const at = m.index + m[0].length,
        len = +m[5],
        data = bytes.subarray(at, at + len),
        im = { filter: m[4] || 'none', w: +m[1], h: +m[2], len: len };
      if (im.filter === 'DCTDecode') {
        assert.equal(data[0] * 256 + data[1], 0xffd8, 'a JPEG starts with SOI');
        assert.equal(data[len - 2] * 256 + data[len - 1], 0xffd9, 'and ends with EOI');
        // (the frame header: height then width, after the marker and its length and the precision byte)
        for (let i = 2; i < len - 9;) {
          if (data[i] !== 0xff) break;
          const mk = data[i + 1],
            L = data[i + 2] * 256 + data[i + 3];
          if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
            im.jpegDims = [data[i + 7] * 256 + data[i + 8], data[i + 5] * 256 + data[i + 6]];
            break;
          }
          i += 2 + L;
        }
      }
      out.push(im);
    }
    assert.equal(s.slice(0, 5), '%PDF-');
    assert.match(s.slice(-6), /%%EOF/);
    return out;
  }
  async function pdf(page, name) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#sfPDF')]);
    const bytes = await readFile(await dl.path());
    await saveArtifact(name + '.pdf', bytes);
    return { bytes: bytes.length, images: images(bytes) };
  }
  test('Page + key: the colouring page deflated, the key page with the reference a JPEG of the page’s size; Key + reference: its picture a JPEG', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await sharePrint(page);
    const pk = await pdf(page, 'v31835-page-key');
    assert.ok(pk.images.length >= 2, pk.images.length + ' pages');
    assert.equal(pk.images[0].filter, 'FlateDecode', 'the colouring page stays lossless');
    const key = pk.images[pk.images.length - 1];
    assert.equal(key.filter, 'DCTDecode', 'the key page (with the reference in colour) is a JPEG');
    assert.deepEqual(key.jpegDims, [key.w, key.h], 'the JPEG is the page’s size');
    assert.ok(key.len < 1.5e6, 'the key page under 1.5 MB: ' + key.len);
    // (its close-ups, when the picture is line art, stay lossless too)
    pk.images.slice(1, -1).forEach((im, i) => assert.equal(im.filter, 'FlateDecode', 'close-up ' + (i + 1)));
    // Key + reference with labels: page 1 is the picture in colour
    await page.click('[data-pwhat="ref"]');
    await idle(page);
    const ref = await pdf(page, 'v31835-reference');
    assert.equal(ref.images[0].filter, 'DCTDecode', 'the reference picture is a JPEG');
    assert.deepEqual(ref.images[0].jpegDims, [ref.images[0].w, ref.images[0].h]);
    assert.ok(
      ref.images.every((im) => im.filter === 'DCTDecode'),
      'every page of it is in colour: ' + ref.images.map((im) => im.filter),
    );
    // (the sizes, for the notes)
    console.log(
      'v31835 sizes: page+key ' +
        pk.bytes +
        ' B ' +
        JSON.stringify(pk.images.map((im) => [im.filter, im.len])) +
        '; reference ' +
        ref.bytes +
        ' B ' +
        JSON.stringify(ref.images.map((im) => [im.filter, im.len])),
    );
    assert.deepEqual(errors, []);
  });
}
