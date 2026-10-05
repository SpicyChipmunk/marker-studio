// v307 debugging pass (the UI where the guide, along and markers branches meet): the guide's main button while it
// works ("Page 2 of 3…" on the Print sheet's PDF button, "Building…") is read at 4.5:1 with the app's disabled primary
// look (the markers branch's), as Colour along is while every section is left white (the guide branch's).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setup, teardown, openApp, sampleGuide, idle, ROOT } from './helpers.mjs';

before(setup);
after(teardown);

// the text's contrast with what is behind it, as seen: colours and opacities composited down from the page
// (as e2e/v307-markers.test.mjs)
const contrastOf = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const P = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s);
      if (!m) return [0, 0, 0, 0];
      const v = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
    };
    const over = (c, b) => [0, 1, 2].map((k) => c[k] * c[3] + b[k] * (1 - c[3]));
    const mix = (a, b, o) => [0, 1, 2].map((k) => a[k] * o + b[k] * (1 - o));
    const chain = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
    function walk(i, behind) {
      const n = chain[i],
        cs = getComputedStyle(n),
        svg = n instanceof SVGElement,
        inner = over(svg ? [0, 0, 0, 0] : P(cs.backgroundColor), behind);
      let fg, b;
      if (i === chain.length - 1) {
        fg = over(svg && n.tagName !== 'svg' ? P(cs.fill) : P(cs.color), inner);
        b = inner;
      } else [fg, b] = walk(i + 1, inner);
      return [mix(fg, behind, +cs.opacity), mix(b, behind, +cs.opacity)];
    }
    const [fg, bg] = walk(0, [255, 255, 255]);
    const L = (c) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const a = L(fg),
      b = L(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }, sel);

// the same from the screen's pixels: the button's commonest colour (its fill, as composited over whatever is behind
// it, a gradient included) against the pixel of its text farthest from it
async function seenContrast(page, sel) {
  const png = (await page.locator(sel).screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data,
      y0 = Math.round(c.height * 0.2),
      y1 = Math.round(c.height * 0.8),
      x0 = Math.round(c.width * 0.05),
      x1 = Math.round(c.width * 0.95),
      n = new Map();
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * c.width + x) * 4,
          k = d[i] + ',' + d[i + 1] + ',' + d[i + 2];
        n.set(k, (n.get(k) || 0) + 1);
      }
    const bg = [...n.entries()]
      .sort((a, b) => b[1] - a[1])[0][0]
      .split(',')
      .map(Number);
    const L = (r, g, b) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const lb = L(...bg);
    let best = 1;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * c.width + x) * 4,
          l = L(d[i], d[i + 1], d[i + 2]);
        best = Math.max(best, (Math.max(l, lb) + 0.05) / (Math.min(l, lb) + 0.05));
      }
    return best;
  }, png);
}
const look = (page, sel) =>
  page.evaluate((s) => {
    const c = getComputedStyle(document.querySelector(s));
    return { bg: c.backgroundColor, shadow: c.boxShadow, op: c.opacity, cur: c.cursor };
  }, sel);
// once the button's transitions (its fill, text and fade) have run
const settled = (page, sel) =>
  page.waitForFunction((s) => document.querySelector(s).getAnimations().length === 0, sel);
// the button as the app sets it while it works (90-export's _exportPDF and printWait, 53-controls-stages' Build)
const busy = (page, sel, t) =>
  page.evaluate(
    ([s, t]) => {
      const b = document.querySelector(s);
      b.textContent = t;
      b.disabled = true;
    },
    [sel, t],
  );

test('the guide’s main button while it works (“Page 2 of 3…”, “Building…”) reads at 4.5:1 and still looks off; Colour along off for a photo with no colour too', async () => {
  for (const [w, h] of [
    [820, 1180],
    [1180, 820],
  ]) {
    const { page, errors, ctx } = await openApp({ width: w, height: h });
    await sampleGuide(page);
    await page.click('.sftabbtn[data-t="share"]');
    await page.click('#sfPrint');
    await page.waitForSelector('#sfSheet.sfprsh');
    await idle(page);
    const on = await look(page, '#sfPDF');
    await busy(page, '#sfPDF', 'Page 2 of 3\u2026');
    await settled(page, '#sfPDF');
    const r1 = Math.min(await contrastOf(page, '#sfPDF'), await seenContrast(page, '#sfPDF'));
    assert.ok(r1 >= 4.5, `“Page 2 of 3…”: ${r1.toFixed(2)}:1 at ${w}×${h} (2.3 before)`);
    const off = await look(page, '#sfPDF');
    assert.notEqual(off.bg, on.bg, 'a fill of its own while it works');
    assert.equal(off.shadow, 'none');
    assert.notEqual(off.cur, 'pointer');
    // the same look as the app's other disabled primary buttons (Tick a set above, Scan's Add)
    const wc = await page.evaluate(() => {
      const b = document.createElement('button');
      b.className = 'btn-primary';
      b.disabled = true;
      document.body.appendChild(b);
      const c = getComputedStyle(b),
        o = { bg: c.backgroundColor, color: c.color };
      b.remove();
      return o;
    });
    assert.deepEqual(
      await page.evaluate(() => {
        const c = getComputedStyle(document.getElementById('sfPDF'));
        return { bg: c.backgroundColor, color: c.color };
      }),
      wc,
    );
    await page.keyboard.press('Escape');
    await idle(page);
    // Edit sections' Build while it builds (a new picture: e2e/fixtures/letter-page.png)
    const pg = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'letter-page.png', mimeType: 'image/png', buffer: pg });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    await busy(page, '#sfBuild', 'Building\u2026');
    await settled(page, '#sfBuild');
    const r2 = await contrastOf(page, '#sfBuild');
    assert.ok(r2 >= 4.5, `“Building…”: ${r2.toFixed(2)}:1`);
    // Colour along while every section is left white (a photo with no colour): no fill, its word readable
    const b = await openApp({ width: w, height: h });
    await sampleGuide(b.page);
    await b.page.click('.sftabbtn[data-t="pattern"]');
    await idle(b.page);
    await b.page.evaluate(() => {
      const t = __mstest,
        s = Math.min(1, 1000 / Math.max(t.W, t.H)),
        pw = Math.round(t.W * s),
        ph = Math.round(t.H * s),
        c = document.createElement('canvas');
      c.width = pw;
      c.height = ph;
      const g = c.getContext('2d');
      g.fillStyle = 'rgb(240,232,214)';
      g.fillRect(0, 0, pw, ph);
      t.setPhotoRef(t.photoFromImage(c), true);
      t.photoXf = { cx: t.W / 2, cy: t.H / 2, sx: t.W / pw, sy: t.H / ph, r: 0 };
      t.photoRecolour();
      t.renderControls();
    });
    await idle(b.page);
    assert.ok(await b.page.isDisabled('#sfColor'));
    await settled(b.page, '#sfColor');
    // (seen on screen: the bar's fade behind it is a gradient, which the computed colours leave out)
    const r3 = await seenContrast(b.page, '#sfColor');
    assert.ok(r3 >= 4.5, `Colour along off: ${r3.toFixed(2)}:1`);
    const ca = await look(b.page, '#sfColor');
    assert.equal(ca.shadow, 'none', 'no glow');
    assert.equal(ca.cur, 'not-allowed');
    assert.deepEqual([...errors, ...b.errors], []);
    await Promise.all([ctx.close(), b.ctx.close()]);
  }
});
