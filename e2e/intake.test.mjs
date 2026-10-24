// Getting a picture in: photos, scans, PDFs, straightening, sections found, specks, frames, hatching.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGo,
  haveSet,
  idle,
  letterGuide,
  openApp,
  sampleGuide,
  saveGuide,
  scrollTop,
  sectionPoint,
  setup,
  shot,
  teardown,
  welcome,
} from './helpers.mjs';
import { GEN_STRAIGHTEN } from './photo-gens.mjs';
import { readFile } from 'node:fs/promises';

before(setup);
after(teardown);

// ---- from paper-and-background.test.mjs ----
// Finding the drawing in a photo of a page: grainy paper isn't ink, the table around the page and its blank margin
// are background, and a drawn frame isn't taken for the page's edge.
{
  // ---- From the review leftovers ----
  // a page photo: optional table around the paper, paper grain, a light-to-dark wash, nine circles, optional drawn frame
  const PAGE = `
let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;
g.fillStyle=o.table?'#6b5a48':'#efe9dc';g.fillRect(0,0,W,H);
const px=o.table?W*0.1:0,py=o.table?H*0.08:0,pw=W-2*px,ph=H-2*py;
const gr=g.createLinearGradient(px,py,px+pw,py+ph);gr.addColorStop(0,'#f4efe4');gr.addColorStop(1,'#cfc8b8');g.fillStyle=gr;g.fillRect(px,py,pw,ph);
if(o.grain){const im=g.getImageData(0,0,W,H),d=im.data;for(let i=0;i<d.length;i+=4){const n=(r()-0.5)*o.grain;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}g.putImageData(im,0,0);}
g.strokeStyle='#222';g.lineWidth=6;
if(o.frame)g.strokeRect(W*0.08,H*0.08,W*0.84,H*0.84);
for(let i=0;i<9;i++){g.beginPath();g.arc(W*0.3+r()*W*0.4,H*0.3+r()*H*0.4,60+r()*140,0,6.283);g.stroke();}`;
  async function fromPage(o) {
    const { page, errors } = await openApp();
    const b64 = await page.evaluate(
      async ([src, o]) => {
        const W = 1500,
          H = 2000,
          c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        new Function('g', 'W', 'H', 'o', src)(g, W, H, o);
        const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
        return await new Promise((res) => {
          const f = new FileReader();
          f.onload = () => res(f.result.split(',')[1]);
          f.readAsDataURL(blob);
        });
      },
      [PAGE, o],
    );
    await haveSet(page);
    await page.check('#wcSets input[data-i="3"]');
    await page.click('#wcAdd');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
    const r = await page.evaluate(() => {
      const t = __mstest,
        cl = t.countedList();
      return {
        n: cl.length,
        biggest: Math.max(...cl.map((l) => t.comps[l].area)) / (t.W * t.H),
        warn: t.segWarn.ok ? '' : t.segWarn.code,
      };
    });
    return { page, errors, r };
  }
  test('grainy paper: the grain is not read as ink, so the page has just its drawn sections and no warning', async () => {
    for (const grain of [40, 70]) {
      const { r, errors } = await fromPage({ grain });
      // (21 since v277's smaller smallest section, 10 px: the 21st is a sliver of about 40 px where two circles cross,
      // the same size and place at both grains and with the table, so drawn, not grain; the grain's specks are 1-3 px.
      // v318.13: 20, the sliver left out: a new photo's Min section size is about 1 mm on the page, 51 px in this one)
      assert.equal(r.n, 20, `grain ${grain}: ${r.n} sections`);
      assert.equal(r.warn, '');
      assert.deepEqual(errors, []);
    }
  });
  test('a photo showing the table around the page: the blank margin and the table are background', async () => {
    const { r, errors } = await fromPage({ table: 1, grain: 40 });
    assert.equal(r.n, 21, `${r.n} sections`);
    assert.ok(r.biggest < 0.05, 'the margin is not a section');
    assert.equal(r.warn, '');
    assert.deepEqual(errors, []);
  });
  // (v305: the paper inside the frame is left white on a fresh scan, as a page without a frame leaves its paper, with a
  // line to Colour it; it was a section before)
  test('a drawn frame on plain paper is not mistaken for the page edge: the area inside it is left white, with Colour it', async () => {
    const { page, r, errors } = await fromPage({ frame: 1 });
    const f = await page.evaluate(() => {
      const t = __mstest,
        l = t.comps.findIndex((c) => c && !c.merged && c.framed);
      return { l, page: l > 0 && !!t.comps[l].page, area: l > 0 ? t.comps[l].area / (t.W * t.H) : 0 };
    });
    assert.ok(f.l > 0 && f.area > 0.3, 'the big area inside the frame is the frame’s paper');
    assert.equal(f.page, false, 'not taken for the page');
    assert.ok(r.biggest < 0.3, 'left white');
    await page.click('#sfFrameColour');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), f.l), true, 'Colour it: a section again');
    assert.deepEqual(errors, []);
  });
}

// ---- from straighten.test.mjs ----
// Page straightening: a photographed page is found and flattened; unsure cases open the corner handles with a
// reason; scans, a page square to the camera and a white page on a white table are left alone. The corner editor,
// Undo and Adjust corners work, the lens's focal length is read from the photo, and the page's shape comes out right.
{
  // A made-up phone photo of a page: a Letter page (a drawing with margins, or one that fills the page), turned and
  // tilted in front of a 25 mm-equivalent phone lens, on a table, with uneven light, noise and JPEG. Returns the
  // photo and where its corners really are.
  const GEN = GEN_STRAIGHTEN;
  async function photo(page, o) {
    return page.evaluate(
      async ([src, o]) => {
        eval(src);
        return makePhoto(o);
      },
      [GEN, o],
    );
  }
  async function pick(page, ph, name = 'page.jpg') {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
    await fc.setFiles({ name, mimeType: 'image/jpeg', buffer: Buffer.from(ph.b64, 'base64') });
  }
  async function fresh() {
    const a = await openApp();
    await haveSet(a.page);
    await a.page.check('#wcSets input[data-i="3"]');
    await a.page.click('#wcAdd');
    return a;
  }
  const sections = (page) => page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
  // (the straightening's line: not v318.15's Trim it, offered for the strip of table round a page square to the camera)
  const info = (page) =>
    page.evaluate(() => {
      const t = __mstest;
      return {
        W: t.W,
        H: t.H,
        line: document.querySelector('.sfpgline:not(#sfTrimLine)')
          ? document.querySelector('.sfpgline:not(#sfTrimLine)').textContent
          : '',
        q: t.pgQ,
        src: t.srcSize,
      };
    });
  test('a page photographed at an angle is found and flattened to its true shape', async () => {
    for (const o of [
      { tilt: 25, roll: 8, size: 0.6 },
      { tilt: 20, yaw: 12, bleed: 1, bg: 'dark', size: 0.65 },
    ]) {
      const { page, errors } = await fresh();
      const ph = await photo(page, o);
      // what the finder sees, straight from the photo
      const f = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((r) => {
          img.onload = r;
          img.src = 'data:image/jpeg;base64,' + b64;
        });
        const r = __mstest.pgFind(img);
        return { tier: r.tier, q: r.q, kind: r.kind };
      }, ph.b64);
      assert.equal(f.tier, 'sure', JSON.stringify(o));
      const err = Math.max(...f.q.map((p, i) => Math.hypot(p[0] - ph.C[i][0], p[1] - ph.C[i][1])));
      assert.ok(err < ph.W * 0.012, `corners within ${err.toFixed(1)} px`);
      await pick(page, ph);
      // (the note is read in the same check that finds it: it changes once straightening is done)
      await page.waitForFunction(
        () => {
          const n = document.querySelector('.sfpgnote');
          return !!n && /Straightening the page/.test(n.textContent);
        },
        null,
        { timeout: 20000 },
      );
      await sections(page);
      await idle(page);
      const r = await info(page);
      assert.match(r.line, /Page straightened/);
      // said once, in that line: no toast repeating it over its Adjust corners and Undo
      assert.equal(
        await page.evaluate(() => {
          const t = document.getElementById('msToast');
          return !!(t && t.classList.contains('on') && /straighten/i.test(t.textContent));
        }),
        false,
        'no toast repeating the line',
      );
      // Adjust corners is offered once (in that line, not again in Adjust photo), and its small links have 44px to tap
      await page.click('#sfAdjToggle');
      await idle(page);
      assert.equal(
        await page.locator('#sfCtl button:text-is("Adjust corners")').count(),
        1,
        'one Adjust corners',
      );
      const lh = await page.$$eval('.sfpgline .sflink', (b) =>
        b.map((x) => Math.round(x.getBoundingClientRect().height)),
      );
      assert.ok(lh.length === 2 && lh.every((h) => h >= 44), 'links 44px tall: ' + lh.join());
      await page.click('#sfAdjToggle');
      const ratio = r.W / r.H;
      assert.ok(Math.abs(ratio / (8.5 / 11) - 1) < 0.02, `Letter shape: ${ratio.toFixed(3)}`);
      assert.deepEqual(errors, []);
    }
  });
  test('scans, a page square to the camera and a white page on a white table are left alone', async () => {
    for (const o of [
      { scan: 1 },
      { scan: 1, border: 1 },
      { tilt: 0, size: 0.97 },
      { tilt: 20, bg: 'white', size: 0.6 },
    ]) {
      const { page, errors } = await fresh();
      const ph = await photo(page, o);
      await pick(page, ph);
      await sections(page);
      await idle(page);
      const r = await info(page);
      assert.equal(r.line, '', 'no straightening: ' + JSON.stringify(o));
      assert.equal(r.q, null);
      assert.deepEqual(r.src, [ph.W, ph.H], 'the photo as taken');
      if (!(await page.isVisible('#sfPgOpen'))) await page.click('#sfAdjToggle');
      assert.ok(await page.isVisible('#sfPgOpen'), 'Straighten page is still offered in Adjust photo');
      assert.deepEqual(errors, []);
    }
  });
  test('a corner outside the photo opens the corner handles with a reason; Keep as is carries on unchanged', async () => {
    const { page, errors } = await fresh();
    const ph = await photo(page, { tilt: 15, size: 0.9, dx: 0.2 });
    await pick(page, ph);
    await page.waitForSelector('#sfPgGo', { timeout: 20000 });
    assert.match(await page.textContent('.sfpgnote'), /outside the photo/);
    assert.equal(await page.textContent('#sfPgNo'), 'Keep as is');
    await page.click('#sfPgNo');
    await sections(page);
    const r = await info(page);
    // (v284: a line offers Straighten again)
    assert.equal(r.line, 'Page kept as photographed · Straighten');
    assert.deepEqual(r.src, [ph.W, ph.H]);
    assert.equal(r.q, null);
    assert.deepEqual(errors, []);
  });
  test('the corner editor: drag a corner, straighten, undo, adjust again', async () => {
    const { page, errors } = await fresh();
    const ph = await photo(page, { tilt: 15, size: 0.9, dx: 0.2 });
    await pick(page, ph);
    await page.waitForSelector('#sfPgGo', { timeout: 20000 });
    await scrollTop(page);
    // drag the corner that's off the photo back inside it
    const pts = await page.evaluate(() => {
      const c = document.getElementById('sfCanvas'),
        r = c.getBoundingClientRect(),
        e = __mstest.pgEd,
        s = r.width / c.width;
      return e.q.map((p) => [r.left + (e.pad + p[0] * e.k) * s, r.top + (e.pad + p[1] * e.k) * s]);
    });
    const box = await page.locator('#sfCanvas').boundingBox();
    const i =
      pts.findIndex((p) => p[0] > box.x + box.width * 0.9) >= 0
        ? pts.findIndex((p) => p[0] > box.x + box.width * 0.9)
        : 1;
    await page.mouse.move(pts[i][0], pts[i][1]);
    await page.mouse.down();
    await page.mouse.move(pts[i][0] - 40, pts[i][1], { steps: 5 });
    assert.ok(await page.evaluate(() => __mstest.pgEd.drag >= 0), 'dragging a corner');
    await page.mouse.move(box.x + box.width * 0.85, pts[i][1], { steps: 5 });
    await page.mouse.up();
    await page.click('#sfPgShape [data-v="letter"]');
    await page.click('#sfPgGo');
    await sections(page);
    await idle(page);
    let r = await info(page);
    assert.match(r.line, /Page straightened/);
    assert.ok(Math.abs(r.W / r.H - 8.5 / 11) < 0.01, 'Letter, as chosen');
    await page.click('#sfPgUndo');
    await sections(page);
    await idle(page);
    r = await info(page);
    // (v310.2, deliberately: the way back stays one tap away, as after Cancel)
    assert.match(r.line, /Page kept as photographed · Straighten/);
    assert.deepEqual(r.src, [ph.W, ph.H], 'back to the photo as taken');
    // Adjust photo -> Straighten page opens the handles again; Cancel leaves things as they were
    await page.click('#sfAdjToggle');
    await page.click('#sfPgOpen');
    await page.waitForSelector('#sfPgGo');
    assert.equal(await page.textContent('#sfPgNo'), 'Cancel');
    await page.click('#sfPgNo');
    await sections(page);
    assert.match((await info(page)).line, /Page kept as photographed/);
    assert.deepEqual(errors, []);
  });
  test('the lens is read from the photo, and with it the page’s shape is measured, not guessed', async () => {
    const { page, errors } = await openApp();
    const r = await page.evaluate(() => {
      const t = __mstest;
      // a minimal JPEG: SOI, APP1 Exif (little-endian TIFF, IFD0 -> Exif IFD with FocalLengthIn35mmFilm = 23), EOI
      const b = [0xff, 0xd8, 0xff, 0xe1, 0, 0, 0x45, 0x78, 0x69, 0x66, 0, 0],
        tiff = [
          0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x69, 0x87, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 1, 0,
          0x05, 0xa4, 3, 0, 1, 0, 0, 0, 23, 0, 0, 0, 0, 0, 0, 0,
        ];
      const all = b.concat(tiff, [0xff, 0xd9]),
        len = 2 + 6 + tiff.length;
      all[4] = len >> 8;
      all[5] = len & 255;
      const withLens = t.pgExifFocal(new Uint8Array(all).buffer),
        without = t.pgExifFocal(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer);
      // corners of a Letter page seen by a 23 mm lens, tilted 30 degrees and turned: measured with the lens, and without
      const W = 3000,
        H = 4000,
        f = (23 / 43.27) * Math.hypot(W, H),
        tx = 0.52,
        rz = 0.3,
        Z = 16;
      const P = (X, Y) => {
        let y = Y * Math.cos(tx),
          z = Y * Math.sin(tx) + Z,
          x = X;
        const x1 = x * Math.cos(rz) - y * Math.sin(rz),
          y1 = x * Math.sin(rz) + y * Math.cos(rz);
        return [W / 2 + (f * x1) / z, H / 2 + (f * y1) / z];
      };
      const q = [P(-4.25, -5.5), P(4.25, -5.5), P(4.25, 5.5), P(-4.25, 5.5)];
      return {
        withLens,
        without,
        measured: t.pgShapeOf(q, W, H, 23, null),
        guessed: t.pgShapeOf(q, W, H, 0, null),
      };
    });
    assert.equal(r.withLens, 23);
    assert.equal(r.without, 0);
    assert.ok(
      Math.abs(r.measured.aspect / (8.5 / 11) - 1) < 0.005,
      'measured with the lens: ' + r.measured.aspect,
    );
    assert.equal(r.measured.shape, 'auto', 'no snapping needed');
    assert.ok(Math.abs(r.guessed.measured / (8.5 / 11) - 1) < 0.08, 'without it, a guessed lens is close');
    assert.deepEqual(errors, []);
  });
  test('Photo colour pattern: a coloured version photographed at an angle is straightened, turned and lined up by itself', async () => {
    const { page, errors } = await openApp();
    await haveSet(page);
    await page.check('#wcSets input[data-i="6"]');
    await page.click('#wcAdd');
    const scan = await photo(page, { scan: 1, bleed: 1 });
    await pick(page, scan);
    await sections(page);
    await buildGo(page);
    await page.waitForFunction(() => __mstest.assignData, null, { timeout: 60000 });
    await idle(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    for (const [o, turn] of [
      [{ bleed: 1, tilt: 22, roll: 6, size: 0.6 }, 0],
      [{ bleed: 1, tilt: 18, roll: 94, size: 0.6, W: 1600, H: 1200 }, 1],
    ]) {
      const ph = await photo(page, o);
      const had = await page.evaluate(() => !!__mstest.photoRef);
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser'),
        had ? page.evaluate(() => __mstest.pickPhotoRef()) : page.click('#sfFam [data-v="photo"]'),
      ]);
      await fc.setFiles({
        name: 'coloured.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(ph.b64, 'base64'),
      });
      await page.waitForFunction(() => __mstest.photoRef && !__mstest.photoChecking, null, {
        timeout: 30000,
      });
      await idle(page);
      const r = await page.evaluate(() => ({
        flat: __mstest.photoRef.flat,
        xf: __mstest.photoXf,
        toast: document.getElementById('msToast').textContent,
      }));
      assert.equal(r.flat, true, 'the photo’s page was straightened');
      assert.match(r.toast, /Straightened the page in the photo and lined it up/);
      const q = Math.round(r.xf.r / (Math.PI / 2)),
        want = turn;
      assert.ok(
        q % 2 === want % 2,
        `turned a quarter turn when the page was photographed sideways (r=${r.xf.r.toFixed(2)})`,
      );
    }
    assert.deepEqual(errors, []);
  });
  test('Adjust corners, then Cancel, leaves the straightened page and its section edits exactly as they were', async () => {
    const { page, errors } = await fresh();
    const ph = await photo(page, { tilt: 25, roll: 8, size: 0.6 });
    await pick(page, ph);
    await sections(page);
    await idle(page);
    const before = await page.evaluate(() => ({
      W: __mstest.W,
      H: __mstest.H,
      src: __mstest.srcSize,
      sig: __mstest.labelsSig(),
    }));
    await page.click('#sfPgAdj');
    await page.waitForSelector('#sfPgGo');
    await page.click('#sfPgNo');
    await sections(page);
    await idle(page);
    const r = await page.evaluate(() => ({
      W: __mstest.W,
      H: __mstest.H,
      src: __mstest.srcSize,
      sig: __mstest.labelsSig(),
      line: document.querySelector('.sfpgline:not(#sfTrimLine)')
        ? document.querySelector('.sfpgline:not(#sfTrimLine)').textContent
        : '',
    }));
    assert.deepEqual({ W: r.W, H: r.H, src: r.src, sig: r.sig }, before);
    assert.match(r.line, /Page straightened/);
    assert.deepEqual(errors, []);
  });
  // v318.11: a page photographed at a steep angle (its far edge much shorter than its near edge, the finder sure) is
  // straightened as before, then told once to hold the phone flatter; a gentle angle says nothing (the guide benchmark's
  // printed set: at about 45° half the sections were lost). (v318.13) Said in the sections' warning box, with Choose
  // another photo (the picker, in the tap), rather than a toast that went.
  test('a steep angle: straightened, then a note to hold the phone flatter with Choose another photo; a gentle one says nothing', async () => {
    for (const [o, steep] of [
      [{ tilt: 35, size: 0.7 }, true],
      [{ tilt: 25, roll: 8, size: 0.6 }, false],
    ]) {
      const { page, errors } = await fresh();
      const ph = await photo(page, o);
      const f = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((r) => {
          img.onload = r;
          img.src = 'data:image/jpeg;base64,' + b64;
        });
        const r = __mstest.pgFind(img);
        return { tier: r.tier, k: r.q ? __mstest.pgKeystone(r.q) : 1 };
      }, ph.b64);
      assert.equal(f.tier, 'sure', JSON.stringify(o));
      assert.equal(f.k < 0.67, steep, `keystone ${f.k.toFixed(3)}`);
      await pick(page, ph);
      await sections(page);
      await idle(page);
      assert.match((await info(page)).line, /Page straightened/);
      const box = await page.evaluate(() => {
        const b = document.querySelector('.sfc-segwarn');
        return b && b.getClientRects().length ? b.textContent : '';
      });
      assert.equal(/steep angle/.test(box), steep, JSON.stringify(o) + ' ' + box);
      // (v318.27: no toast at all is fine too: the welcome makes none since v318.26, so #msToast may not exist yet)
      const tt = await page.evaluate(() => (document.getElementById('msToast') || {}).textContent || '');
      assert.equal(/steep angle/.test(tt), false, 'not a toast');
      if (steep) {
        assert.match(box, /holding the phone flatter/);
        const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfRetake')]);
        assert.ok(fc, 'Choose another photo opens the picker');
      }
      assert.deepEqual(errors, []);
    }
  });
}

// ---- from v303.test.mjs ----
// v303: a small picture (a page downloaded at 400-800 pixels) is enlarged before its sections are found, and the guide
// remembers it; the sample and big photos are left as they are. Polish: the Library's two-line meta, a marker's brand
// line across the card, the picture still between Plan and Colour along, and a palette's codes within their colours.
{
  // a page downloaded small: rings 1.2 pixels wide, 2.8 apart, drawn smoothly on a 400 x 300 picture (they run together
  // at that size), and a box round them
  async function smallPage(page) {
    const b64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 300;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 400, 300);
      g.strokeStyle = '#111';
      g.lineWidth = 1.2;
      for (let r = 3; r < 120; r += 2.8) {
        g.beginPath();
        g.arc(200, 150, r, 0, 6.2832);
        g.stroke();
      }
      g.lineWidth = 2;
      g.strokeRect(20, 10, 360, 280);
      return c.toDataURL('image/png').split(',')[1];
    });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  const info = (page) =>
    page.evaluate(() => {
      const t = __mstest;
      return { W: t.W, H: t.H, k: t.srcK, n: t.countedList().length, src: t.srcSize };
    });
  test('a small download is enlarged to 1600 pixels before its sections are found; saved and opened again it keeps them', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await welcome(page, 'look');
    await idle(page);
    await smallPage(page);
    const a = await info(page);
    assert.deepEqual(a.src, [400, 300], 'the picture is kept at its own size');
    assert.deepEqual([a.W, a.H], [1600, 1200], 'its sections are found on it enlarged');
    assert.equal(a.k, 4);
    // a section between each two rings (41 of them), the ones in the middle too small to colour left out
    assert.ok(a.n >= 30, 'the rings come apart: ' + a.n);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 60000,
    });
    await idle(page);
    const built = await page.evaluate(() => __mstest.assignData.order.length);
    await saveGuide(page);
    const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
    // something else open, then the guide again from the Library
    await page.evaluate(() =>
      SF.openSample ? SF.openSample() : document.getElementById('sfSample').click(),
    );
    await page.waitForFunction(() => __mstest.srcK === 1 && __mstest.W === 568, null, { timeout: 30000 });
    await idle(page);
    await page.evaluate(() => openLibrary());
    await idle(page);
    await page.click(`#savedList .srow[data-id="${id}"] .smeta`);
    await page.waitForFunction(() => __mstest.W === 1600 && __mstest.assignData, null, { timeout: 30000 });
    await idle(page);
    const b = await info(page);
    assert.equal(b.k, 4, 'Min section size still measured on the picture as it came');
    assert.equal(await page.evaluate(() => __mstest.assignData.order.length), built, 'the same sections');
    assert.deepEqual(errors, []);
  });
  test('the sample and a photo the size of a page photo are not enlarged; a smaller page photo is', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    const s = await info(page);
    assert.deepEqual([s.W, s.H, s.k], [568, 1500, 1], 'the sample as it is (166 sections of its own)');
    // e2e/fixtures/letter-page.png, 850 x 1100: enlarged to 1600 tall
    await letterGuide(page);
    const l = await info(page);
    assert.deepEqual([l.W, l.H], [1236, 1600]);
    assert.ok(Math.abs(l.k - 1600 / 1100) < 0.01, 'k ' + l.k);
    assert.deepEqual(errors, []);
  });
  test('the Library: what an item is on one line, how far and when on the next, the dot between them for a screen reader', async () => {
    for (const [w, h] of [
      [1180, 820],
      [390, 844],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await saveGuide(page);
      await page.evaluate(() => openLibrary());
      await idle(page);
      const m = await page.$eval('#savedList .stile .smeta', (e) => {
        const sp = [...e.querySelectorAll(':scope > span:not(.smsep)')].map((s) =>
          Math.round(s.getBoundingClientRect().top),
        );
        return {
          text: e.textContent,
          lines: [...new Set(sp)].length,
          first: e.querySelector('span').textContent,
        };
      });
      // (v320: a guide's kind isn't said, its grid under Guides is: "16 markers", then how far and when)
      assert.match(m.text, /^16 markers · .+ · today$/, 'read as one line');
      assert.equal(m.lines, 2, w + ': two lines');
      assert.equal(m.first, '16 markers');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('a marker’s brand line ("Ohuhu · Yellow-Red / Orange — was YR4") is one line on a phone, the hex beside the last line', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await page.evaluate(() => setMode('random'));
    await idle(page);
    await page.click('#draw');
    await idle(page);
    await page.evaluate(() =>
      showColor(
        COLORS.findIndex((c) => c.code === 'YR07' && c.brand === 'Ohuhu'),
        false,
      ),
    );
    await idle(page);
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector('.readout ' + s).getBoundingClientRect();
      const f = q('.fam');
      return {
        fam: f.height,
        lh: parseFloat(getComputedStyle(document.querySelector('.readout .fam')).lineHeight) || 0,
        ts: q('.ts'),
        hex: q('.hex'),
      };
    });
    assert.ok(r.fam < 24, 'one line: ' + r.fam);
    assert.ok(Math.abs(r.ts.bottom - r.hex.bottom) < 3, 'the hex beside the last line');
    assert.deepEqual(errors, []);
  });
  test('the picture stays where it is between Plan and Colour along on an iPad held sideways', async () => {
    for (const h of [820, 740]) {
      const { page, errors, ctx } = await openApp({ width: 1180, height: h });
      await sampleGuide(page);
      await page.evaluate(() => scrollTo(0, 0));
      await idle(page);
      // (v324.1: once its size holds still for a few frames: under load, GitHub's WebKit reported the picture's size
      // transition finished while the size it laid out was still a few pixels short of it)
      const at = () =>
        page.evaluate(
          () =>
            new Promise((res) => {
              let last = '',
                same = 0;
              const c = document.getElementById('sfCanvas'),
                t0 = performance.now();
              const f = () => {
                const r = c.getBoundingClientRect(),
                  k = r.left.toFixed(1) + ',' + r.width.toFixed(1);
                same = k === last ? same + 1 : 0;
                last = k;
                if (same >= 3 || performance.now() - t0 > 3000) res([r.left, r.width]);
                else requestAnimationFrame(f);
              };
              f();
            }),
        );
      const a = await at();
      await page.click('#sfColor');
      await page.evaluate(() => scrollTo(0, 0));
      await idle(page);
      const b = await at();
      assert.ok(Math.abs(a[0] - b[0]) < 0.6 && Math.abs(a[1] - b[1]) < 0.6, h + ': ' + a + ' / ' + b);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('a palette’s codes stay within their colours, 8 of them on a phone', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mPalette');
    await page.click('#segs [data-n="8"]');
    await page.click('#draw');
    await idle(page);
    const r = await page.$$eval('.band', (bs) =>
      bs.map((b) => {
        const c = b.querySelector('.bcode'),
          br = b.getBoundingClientRect(),
          cr = c.getBoundingClientRect();
        return { t: c.textContent, room: br.width - cr.width, fs: parseFloat(getComputedStyle(c).fontSize) };
      }),
    );
    assert.equal(r.length, 8);
    for (const x of r) assert.ok(x.room >= 4, x.t + ' fits, room ' + x.room);
    assert.ok(r[0].fs >= 10, 'readable: ' + r[0].fs);
    assert.deepEqual(errors, []);
  });
  test('focus mode: Colours open frames the section above the sheet, the picture its own size; closed any way, framed again', async () => {
    for (const [w, h] of [
      [1180, 820],
      [390, 844],
    ]) {
      const { page, errors, ctx } = await openApp({ width: w, height: h });
      await sampleGuide(page);
      await page.click('#sfColor');
      await idle(page);
      await page.locator('#sfAlist .sfarow .sfah').nth(1).click();
      await idle(page);
      await page.click('#sfFocus');
      await idle(page);
      const size = () => page.$eval('#sfCanvas', (c) => [c.offsetWidth, c.offsetHeight]);
      const sec = () =>
        page.evaluate(() => {
          const t = __mstest,
            l = t.focusCur(),
            c = document.getElementById('sfCanvas'),
            r = c.getBoundingClientRect(),
            q = t.labelPos(l);
          return r.top + (q.y / c.height) * r.height;
        });
      const s0 = await size();
      await page.click('#sfFocCols');
      await idle(page);
      await page.waitForTimeout(450);
      const top = await page.$eval('#sfFocSheet', (e) => e.getBoundingClientRect().top);
      assert.ok((await sec()) < top - 8, w + ': the section above the sheet');
      assert.deepEqual(await size(), s0, 'the picture keeps its size');
      // closed by a tap on the picture: the section in the middle of the whole room again
      await page.mouse.click(w / 2, 120);
      await idle(page);
      await page.waitForTimeout(450);
      assert.equal(await page.isVisible('#sfFocSheet'), false);
      // (v320: held sideways on an iPad the bars are a column at the side, and the room is the screen's height)
      const g = await page.evaluate(() => {
        const v = document.getElementById('sfView').getBoundingClientRect(),
          b = document.querySelector('.sffocbar').getBoundingClientRect(),
          f = document.querySelector('.sffocbot').getBoundingClientRect();
        return document.documentElement.classList.contains('sfrailon')
          ? (v.top + v.bottom) / 2
          : (b.bottom + f.top) / 2;
      });
      assert.ok(
        Math.abs((await sec()) - g) < h * 0.2,
        w + ': framed in the whole room: ' + (await sec()) + ' / ' + g,
      );
      assert.deepEqual(await size(), s0);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  });
  test('Markers › All, Code order: each family brand by brand, by code within a brand (Ohuhu’s R12 and R14 with the other Ohuhu reds)', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await page.click('#ownView [data-v="all"]');
    await idle(page);
    // (v316: Lightest first is the order to start with; Code order is the one this checks)
    await page.selectOption('#gapSort', 'code');
    await idle(page);
    const red = await page.evaluate(() => {
      const g = [...document.querySelectorAll('.rgroup')].find((x) =>
        /^Red\b/.test(x.querySelector('.rghead').textContent.trim()),
      );
      return [...g.querySelectorAll('.cell, [data-i]')]
        .map((c) => +c.dataset.i)
        .filter((i) => i >= 0)
        .map((i) => COLORS[i].brand + ' ' + COLORS[i].code);
    });
    const firstCopic = red.findIndex((s) => s.startsWith('Copic'));
    assert.ok(firstCopic > 0, red.slice(0, 5).join());
    assert.ok(
      red.slice(firstCopic).every((s) => s.startsWith('Copic')),
      'no Ohuhu after the Copic markers: ' + red.slice(-4).join(),
    );
    const oh = red.slice(0, firstCopic).map((s) => s.slice(6));
    assert.deepEqual(oh, oh.slice().sort(), 'Ohuhu by code');
    assert.ok(oh.includes('R12') && oh.includes('R14'));
    assert.deepEqual(errors, []);
  });
  test('Colour along, a finished page: a colour with one section says "Coloured ✓", not "All 1 coloured"', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    // (laid as before v314: v314's Gradient, gradArea, leaves the sample no marker on a single section)
    await page.evaluate(() => {
      __mstest.styleVars.gradArea = 0;
      __mstest.reassign();
    });
    await idle(page);
    await page.click('#sfColor');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest;
      t.assignData.order.forEach((l) => {
        t.colored[l] = 1;
      });
      t.guideDirty = true;
      t.renderGuide();
      t.checkComplete();
      t.updateProgress && t.updateProgress();
    });
    await idle(page);
    // (any marker with exactly one section: the sample used YG211 for one until v308's Include defaults changed its colours)
    const one = await page.evaluate(() => {
      const t = __mstest,
        n = {};
      t.assignData.order.forEach((l) => {
        const k = t.assignData.assign[l].code;
        n[k] = (n[k] || 0) + 1;
      });
      return Object.keys(n).filter((k) => n[k] === 1);
    });
    assert.ok(one.length, 'the sample has a marker with one section');
    const rows = await page.$$eval('#sfAlist .sfarow', (rs) =>
      rs.map((r) => r.textContent.replace(/\s+/g, ' ')),
    );
    const yg = rows.find((t) => one.some((k) => new RegExp('\\b' + k + '\\b').test(t)));
    assert.ok(yg, 'its row: ' + one.join(' '));
    assert.match(yg, /Coloured ✓/);
    assert.doesNotMatch(rows.join('|'), /All 1 coloured/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v304-segmentation.test.mjs ----
// v304 (sections): a tilt followed at once by a Sensitivity change, or by Undo, is no longer lost or allowed to clear
// the Undo steps; Undo of a Sensitivity change puts the slider back; the picture's warning follows Enhance; a Split
// stroke begun on the outline works, one the system takes over cuts nothing, and the line drawn is as wide as the cut;
// a very dense page asks before it's built (more than 3,000 sections), can't be built when a guide couldn't keep it,
// and has its specks saved as part of the lines so it opens again. The warning also follows an Undo of a merge or
// split; the dense page's question never names a size under 3 px on the screen (a phone: "the smallest" instead).
{
  // the sample, back in Edit sections with Adjust photo open
  async function sampleSections(page) {
    await sampleGuide(page);
    await idle(page);
    await page.click('#sfBack2');
    await idle(page);
    if (!(await page.isVisible('#sfTilt'))) {
      await page.click('#sfAdjToggle');
      await idle(page);
    }
  }
  const input = (page, id, v) =>
    page.evaluate(
      ([id, v]) => {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      [id, v],
    );
  // a picture drawn in the page (draw: the body of a function of (g, W, H) on a W x H canvas), opened as a photo
  async function openPicture(page, W, H, draw) {
    const b64 = await page.evaluate(
      ([W, H, draw]) => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, W, H);
        new Function('g', 'W', 'H', draw)(g, W, H);
        return c.toDataURL('image/png').split(',')[1];
      },
      [W, H, draw],
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    // (a picture the page finder isn't sure of: kept as it is)
    const first = await Promise.race([
      page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 }).then(() => 'build'),
      page.waitForSelector('#sfPgNo', { state: 'visible', timeout: 120000 }).then(() => 'corners'),
    ]);
    if (first === 'corners') {
      await page.click('#sfPgNo');
      await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 });
    }
    await idle(page);
  }
  const dialog = (page) =>
    page.evaluate(() => {
      const o = document.getElementById('sfEdAsk');
      return o
        ? {
            title: o.querySelector('.mtitle').textContent,
            text: o.querySelector('.dsub').textContent,
            buttons: [...o.querySelectorAll('[data-a]')].map((b) => b.textContent),
          }
        : null;
    });
  const counted = (page) => page.evaluate(() => __mstest.countedList().length);
  // (v318.13) a new photo's Min section size is about 1 mm on the page (74 px at 2400 px), which leaves these pages'
  // small boxes out: the dense-page tests set it back to the old default (10 px) by hand, as someone keeping them would
  async function smallMin(page) {
    await input(page, 'sfMin', 30);
    await idle(page);
  }
  // (v318.35: a page of thousands of tiny cells is cross-hatching to Treat hatching as one section, on for a download:
  // these tests are about dense pages, so the box is unticked first and every cell kept)
  async function noHatch(page) {
    if (await page.isChecked('#sfHatch')) {
      await page.click('#sfHatch');
      await idle(page);
    }
  }
  // the biggest section of the sample, and screen points along a row through its middle: from just outside its left
  // edge (on the outline) to just past its right one, and from just inside to just inside
  async function across(page) {
    return page.evaluate(() => {
      const t = __mstest,
        W = t.W,
        H = t.H,
        L = t.labels,
        cs = t.comps;
      let best = 0;
      for (let l = 1; l < cs.length; l++) {
        const c = cs[l];
        if (c && !c.merged && !c.bg && (!best || c.area > cs[best].area)) best = l;
      }
      const y = Math.round(cs[best].cy);
      let x0 = -1,
        x1 = -1;
      for (let x = 0; x < W; x++)
        if (L[y * W + x] === best) {
          if (x0 < 0) x0 = x;
          x1 = x;
        }
      const r = document.getElementById('sfCanvas').getBoundingClientRect(),
        s = (x) => ({ x: r.left + ((x + 0.5) / W) * r.width, y: r.top + ((y + 0.5) / H) * r.height });
      return { onLine: L[y * W + x0 - 4], out: [s(x0 - 4), s(x1 + 4)], in: [s(x0 + 2), s(x1 - 2)] };
    });
  }
  const drag = async (page, a, b) => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 20 });
    await page.mouse.up();
    await idle(page);
  };
  const sections = (page) => page.evaluate(() => __mstest.comps.filter((c) => c && !c.merged).length);
  // 2400 x 1800: a grid of 300 big boxes, and in one corner a block of 4,800 small 7 x 7 boxes
  const MIXED = `g.fillStyle = '#000';
  for (let x = 0; x <= W; x += 120) g.fillRect(Math.min(x, W - 3), 0, 3, H);
  for (let y = 0; y <= H; y += 120) g.fillRect(0, Math.min(y, H - 3), W, 3);
  for (let x = 0; x <= 640; x += 8) g.fillRect(x, 0, 1, 480);
  for (let y = 0; y <= 480; y += 8) g.fillRect(0, y, 640, 1);`;
  // fine cross-hatching over the middle half of a 2400 x 1800 page, every `per` pixels
  const hatch = (per) => `const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 240; const j = (y * W + x) * 4;
    if (x === 597 || x === 1803) v = 20; else if (x > 600 && x < 1800 && ((x + y) % ${per} === 0 || (x - y + 9000) % ${per} === 0)) v = 20;
    d[j] = d[j + 1] = d[j + 2] = v; d[j + 3] = 255; }
  g.putImageData(im, 0, 0);
  g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(100, 100, 300, 300); g.strokeRect(1950, 1200, 300, 300);`;
  test('a tilt with a Sensitivity change straight after: the picture is turned (it was dropped)', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleSections(page);
    const w0 = await page.evaluate(() => __mstest.W);
    await page.evaluate(() => {
      for (const [id, v] of [
        ['sfTilt', '3'],
        ['sfSens', '7'],
      ]) {
        const el = document.getElementById(id);
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await page.waitForTimeout(600);
    await idle(page);
    assert.notEqual(await page.evaluate(() => __mstest.W), w0, 'the picture was turned');
    assert.equal(await page.inputValue('#sfTilt'), '3');
    assert.deepEqual(errors, []);
  });
  test('Undo of a Sensitivity change puts the slider back as it was', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleSections(page);
    assert.equal(await page.inputValue('#sfSens'), '5');
    await input(page, 'sfSens', '9');
    await page.waitForTimeout(400);
    await idle(page);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.inputValue('#sfSens'), '5');
    assert.deepEqual(errors, []);
  });
  test('Undo straight after a tilt: the tilt waiting is dropped, and the Undo steps before it stay', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleSections(page);
    // (an Undo step first: the sections found again at another Sensitivity)
    await input(page, 'sfSens', '7');
    await page.waitForTimeout(400);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.undoCount), 1);
    const w0 = await page.evaluate(() => __mstest.W);
    await input(page, 'sfTilt', '2');
    await page.evaluate(() => __mstest.doUndoSeg());
    await page.waitForTimeout(500);
    await idle(page);
    const r = await page.evaluate(() => ({ W: __mstest.W, undo: __mstest.undoCount }));
    assert.equal(r.W, w0, 'the picture as it was');
    assert.equal(r.undo, 1, 'the Sensitivity change can still be undone');
    assert.deepEqual(errors, []);
  });
  test('the warning about the picture follows Enhance', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await welcome(page, 'look');
    await idle(page);
    // a page lit from one side: Enhance copes; without it the dark side reads as ink
    await openPicture(
      page,
      1600,
      1200,
      `const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#303030'); gr.addColorStop(0.6, '#606060'); gr.addColorStop(0.75, '#f0f0f0'); gr.addColorStop(1, '#f8f8f8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#000'; g.lineWidth = 6; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(200 + i * 180, 600, 80, 0, 6.3); g.stroke(); }`,
    );
    if (!(await page.isVisible('#sfEnh'))) {
      await page.click('#sfAdjToggle');
      await idle(page);
    }
    assert.equal(await page.isVisible('.sfc-segwarn'), false);
    await page.click('#sfEnh');
    await page.waitForTimeout(300);
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.segWarn.code), 'dark');
    assert.equal(await page.isVisible('.sfc-segwarn'), true, 'shown');
    await page.click('#sfEnh');
    await page.waitForTimeout(300);
    await idle(page);
    assert.equal(await page.isVisible('.sfc-segwarn'), false, 'gone again');
    assert.deepEqual(errors, []);
  });
  test('the warning about the picture follows an Undo of a merge', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await welcome(page, 'look');
    await idle(page);
    // a page in two halves, a thick bar between them
    await openPicture(page, 1600, 1200, `g.fillStyle = '#000'; g.fillRect(780, 0, 40, H);`);
    assert.equal(await page.evaluate(() => __mstest.comps.filter((c) => c && !c.merged).length), 2);
    assert.equal(await page.isVisible('.sfc-segwarn'), false);
    // the two merged: one section is too few, said once the warning is checked again (Min section size let go)
    await page.evaluate(() => {
      const t = __mstest,
        ls = t.comps.map((c, l) => (c && !c.merged ? l : 0)).filter(Boolean);
      t.mergeCellsSnap(ls[0], ls[1]);
      t.render();
      document.getElementById('sfMin').dispatchEvent(new Event('change', { bubbles: true }));
    });
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.segWarn.code), 'few');
    assert.equal(await page.isVisible('.sfc-segwarn'), true, 'shown');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.segWarn.ok), true);
    assert.equal(await page.isVisible('.sfc-segwarn'), false, 'gone with the Undo');
    assert.deepEqual(errors, []);
  });
  test('Split: a stroke begun on the outline divides the section it runs across', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleSections(page);
    await page.click('#sfEmSplit');
    await idle(page);
    const a = await across(page),
      n0 = await sections(page);
    assert.equal(a.onLine, -1, 'the stroke starts on a line');
    await drag(page, a.out[0], a.out[1]);
    assert.equal(await sections(page), n0 + 1);
    assert.deepEqual(errors, []);
  });
  test('Split: the line drawn is as wide as the cut, and a stroke the system takes over cuts nothing', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleSections(page);
    await page.click('#sfEmSplit');
    await idle(page);
    const a = await across(page),
      n0 = await sections(page);
    // a stroke right across, cancelled by the system (a palm, a gesture) as it ends
    await page.evaluate(([p, q]) => {
      const cv = document.getElementById('sfCanvas'),
        ev = (type, pt) =>
          cv.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: 7,
              pointerType: 'pen',
              isPrimary: true,
              button: 0,
              buttons: 1,
              clientX: pt.x,
              clientY: pt.y,
            }),
          );
      ev('pointerdown', p);
      for (let i = 1; i <= 10; i++) ev('pointermove', { x: p.x + ((q.x - p.x) * i) / 10, y: p.y });
      ev('pointercancel', q);
    }, a.in);
    await idle(page);
    assert.equal(await sections(page), n0, 'nothing cut');
    // the same stroke let go
    await page.mouse.move(a.in[0].x, a.in[0].y);
    await page.mouse.down();
    await page.mouse.move(a.in[1].x, a.in[1].y, { steps: 10 });
    assert.equal(
      await page.evaluate(() => document.getElementById('sfCanvas').getContext('2d').lineWidth),
      7,
      'a cut 3 pixels each way',
    );
    await page.mouse.up();
    await idle(page);
    assert.equal(await sections(page), n0 + 1, 'the stroke let go cuts');
    assert.deepEqual(errors, []);
  });
  test('a page of more than 3,000 sections asks first; Leave out the small ones builds it with fewer', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await openPicture(page, 2400, 1800, MIXED);
    await noHatch(page);
    await smallMin(page);
    const n = await counted(page);
    assert.ok(n > 3000, 'sections: ' + n);
    await page.click('#sfBuild');
    await page.waitForSelector('#sfEdAsk');
    const d = await dialog(page);
    assert.equal(d.title, 'This page has ' + n.toLocaleString('en-US') + ' sections.');
    assert.match(
      d.text,
      /^About \d+ px each on this screen, so you’d zoom in for every one\. Leaving out (?:the smallest|sections smaller than (?:[3-9]|\d{2,}) px) keeps [\d,]+\.$/,
    );
    assert.deepEqual(d.buttons, [
      'Leave out the small ones',
      'Build all ' + n.toLocaleString('en-US'),
      'Cancel',
    ]);
    await page.click('#sfEdAsk [data-a="min"]');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 120000,
    });
    await idle(page);
    const after = await page.evaluate(() => __mstest.assignData.order.length);
    assert.ok(after <= 3000 && after >= 150, 'built with ' + after);
    assert.deepEqual(errors, []);
  });
  test('Build all builds them all, and Build again for the same picture doesn’t ask again', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await openPicture(page, 2400, 1800, MIXED);
    await noHatch(page);
    await smallMin(page);
    const n = await counted(page);
    await page.click('#sfBuild');
    await page.waitForSelector('#sfEdAsk');
    await page.click('#sfEdAsk [data-a="all"]');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 120000,
    });
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.assignData.order.length), n);
    await page.click('#sfBack2');
    await idle(page);
    await page.evaluate(() => {
      const t = __mstest,
        o = t.countedList();
      t.mergeCellsSnap(o[0], o[1]);
      t.render();
    });
    await buildGo(page);
    await page.waitForFunction(() => __mstest.sfmode === 'guide', null, { timeout: 120000 });
    await idle(page);
    assert.equal(await page.isVisible('#sfEdAsk'), false, 'not asked again');
    assert.deepEqual(errors, []);
  });
  test('on a phone the dense page’s question says “the smallest”, not a size under 3 px', async () => {
    const { page, errors } = await openApp({ width: 390, height: 844 });
    await welcome(page, 'look');
    await idle(page);
    await openPicture(page, 2400, 1800, MIXED);
    await noHatch(page);
    await smallMin(page);
    // (the size Leave out the small ones would leave out, as wide as it looks on this screen)
    await page.click('#sfBuild');
    await page.waitForSelector('#sfEdAsk');
    const d = await dialog(page),
      n = await counted(page);
    assert.match(
      d.text,
      /^About \d+ px each on this screen, so you’d zoom in for every one\. Leaving out the smallest keeps [\d,]+\.$/,
    );
    assert.doesNotMatch(d.text, /smaller than/);
    assert.deepEqual(d.buttons, [
      'Leave out the small ones',
      'Build all ' + n.toLocaleString('en-US'),
      'Cancel',
    ]);
    assert.deepEqual(errors, []);
  });
  test('a very dense page is saved with its specks as part of the lines, and opens again', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await welcome(page, 'look');
    await idle(page);
    await openPicture(page, 2400, 1800, hatch(5));
    const s = await page.evaluate(() => ({
      all: __mstest.comps.filter((c) => c && !c.merged).length,
      n: __mstest.countedList().length,
    }));
    assert.ok(s.all > 150000 && s.n < 3000, JSON.stringify(s));
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 120000,
    });
    await idle(page);
    await page.evaluate(() => __mstest.saveNow());
    await page.waitForFunction(() => __mstest.inLibrary, null, { timeout: 60000 });
    await idle(page);
    const id = await page.evaluate(() => __mstest.curId),
      order = await page.evaluate(() => __mstest.assignData.order.slice());
    const r = await page.evaluate(async (id) => {
      const d = await IDB.get('guide-' + id),
        ck = await SF.checkGuide(d);
      __mstest.openDesignObj(d, id);
      await new Promise((res) => setTimeout(res, 3000));
      return {
        ck,
        W: __mstest.W,
        all: __mstest.comps.filter((c) => c && !c.merged).length,
        order: __mstest.assignData.order.slice(),
      };
    }, id);
    assert.equal(r.ck.ok, true, 'a guide that can be opened');
    assert.equal(r.W, 2400);
    assert.equal(r.all, 90000);
    assert.deepEqual(r.order.sort(), order.sort(), 'its sections, as they were');
    assert.deepEqual(errors, []);
  });
  test('a page with more sections than a guide can keep is not built until Min section size is raised', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await welcome(page, 'look');
    await idle(page);
    await openPicture(page, 2400, 1800, hatch(6));
    await noHatch(page);
    await smallMin(page);
    const m0 = await page.inputValue('#sfMin');
    await page.click('#sfBuild');
    await page.waitForSelector('#sfEdAsk');
    const d = await dialog(page);
    assert.match(d.title, /^This page has [\d,]+ sections\.$/);
    assert.match(
      d.text,
      /^That’s more than a guide can keep\. Leaving out (?:the smallest|sections smaller than (?:[3-9]|\d{2,}) px) keeps [\d,]+\. Tiny specks are joined to the lines when it’s saved\.$/,
    );
    assert.deepEqual(d.buttons, ['Raise Min section size', 'Cancel']);
    await page.click('#sfEdAsk [data-a="min"]');
    await idle(page);
    assert.equal(await page.evaluate(() => !!__mstest.assignData), false, 'not built');
    assert.ok(+(await page.inputValue('#sfMin')) > +m0, 'Min section size raised');
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
      timeout: 120000,
    });
    assert.ok((await page.evaluate(() => __mstest.assignData.order.length)) <= 3000);
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-frame.test.mjs ----
// v305 (sections): a frame drawn round the picture on the same paper. On a fresh scan the paper inside it is left white,
// as a page without a frame leaves its paper, with a line on Edit sections and in the Plan: "Paper round the drawing
// is left white · Colour it" (v306's words). Colour it brings it back as a section (in the Plan, laid by the pattern, the rest keeping
// their markers), and that survives the guide being opened again. A guide saved before keeps its sections as saved.
// Pages drawn here in code; the rule itself is unit-tested in test/v305-frame.test.mjs.
{
  // a 1200 × 1500 page: o.frame (a frame 90 px in), o.figure (a flower in the middle), o.wm (a watermark's O under the
  // frame), o.horizon (a ruled horizon with a house below it), o.board (a board in the middle with flowers round it),
  // o.out (a shape breaking out of the frame on the left)
  const DRAW = `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=6;
const ring=(x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();};
if(o.frame)g.strokeRect(90,90,W-180,H-180);
if(o.figure){ring(600,700,300);ring(600,700,180);g.beginPath();g.moveTo(300,700);g.lineTo(900,700);g.moveTo(600,400);g.lineTo(600,1000);g.stroke();}
if(o.wm){g.lineWidth=4;ring(1050,1455,24);}
if(o.horizon){g.beginPath();g.moveTo(90,900);g.lineTo(W-90,900);g.stroke();g.strokeRect(250,1000,300,250);ring(850,330,90);}
if(o.board){g.strokeRect(300,300,600,900);ring(150,150,90);ring(1050,150,90);ring(150,1350,90);ring(1050,1350,90);}
if(o.out)g.strokeRect(30,500,400,500);`;
  async function fresh(page, o) {
    const b64 = await page.evaluate(
      async ([src, o]) => {
        const W = 1200,
          H = 1500,
          c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        new Function('g', 'W', 'H', 'o', src)(c.getContext('2d'), W, H, o);
        const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
        return await new Promise((res) => {
          const f = new FileReader();
          f.onload = () => res(f.result.split(',')[1]);
          f.readAsDataURL(blob);
        });
      },
      [DRAW, o],
    );
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  const paper = (page) => page.evaluate(() => __mstest.comps.findIndex((c) => c && !c.merged && c.framed));
  const inGuide = (page, l) => page.evaluate((l) => !!__mstest.assignData.assign[l], l);
  const markers = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
  const LINE = 'Paper round the drawing is left white · Colour it';
  test('a lone figure in a frame: the paper is left white with a line to Colour it; in the Plan it’s laid, the rest keep theirs; it stays after opening again', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await fresh(page, { frame: 1, figure: 1, wm: 1 });
    const p = await paper(page);
    assert.ok(p > 0, 'the frame is found');
    assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false, 'left white');
    // the watermark's O, under the frame: left white too
    const wm = await page.evaluate(() => __mstest.labels[1455 * __mstest.W + 1050]);
    assert.ok(
      wm > 0 && !(await page.evaluate((l) => __mstest.counted(l), wm)),
      'the watermark is left white',
    );
    assert.equal((await page.textContent('#sfFrameLine')).trim(), LINE);
    await shot(page, 'v305-frame-sections-820x1180');
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    assert.equal(await inGuide(page, p), false);
    assert.equal(await page.evaluate(() => __mstest.countedList().length), 8, 'the flower’s eight pieces');
    assert.equal((await page.textContent('#sfFrameLine')).trim(), LINE, 'the line in the Plan');
    await shot(page, 'v305-frame-plan-820x1180');
    const was = await markers(page);
    await page.click('#sfFrameColour');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'guide');
    assert.equal(await inGuide(page, p), true, 'the paper has a marker');
    const now = await markers(page);
    for (const l in was) assert.equal(now[l], was[l], 'section ' + l + ' keeps its marker');
    assert.equal(await page.$('#sfFrameLine'), null, 'the line goes');
    // opened again: still coloured, and no line
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
    assert.deepEqual(await markers(page), now);
    assert.equal(await page.$('#sfFrameLine'), null);
    assert.deepEqual(errors, []);
  });
  test('Colour it on Edit sections makes it a section; Undo leaves it white again', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    await sampleGuide(page);
    await fresh(page, { frame: 1, figure: 1 });
    const p = await paper(page);
    await shot(page, 'v305-frame-sections-1180x820');
    await page.click('#sfFrameColour');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), p), true);
    assert.equal(await page.$('#sfFrameLine'), null);
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false);
    assert.ok(await page.isVisible('#sfFrameLine'), 'the line is back');
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    await shot(page, 'v305-frame-plan-1180x820');
    assert.ok(await page.isVisible('#sfFrameLine'));
    assert.deepEqual(errors, []);
  });
  test('not a frame: a framed sky over a ruled horizon, a board in the middle of a drawing, art breaking out of the frame', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    for (const [what, o] of [
      ['sky over a horizon', { frame: 1, horizon: 1 }],
      ['board in the middle', { board: 1 }],
      ['art breaking out', { frame: 1, figure: 1, out: 1 }],
    ]) {
      await fresh(page, o);
      assert.equal(await paper(page), -1, what);
      assert.equal(await page.$('#sfFrameLine'), null, what);
    }
    assert.deepEqual(errors, []);
  });
  test('a guide saved before v305 with the paper inside its frame coloured opens just as it was', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await sampleGuide(page);
    await fresh(page, { frame: 1, figure: 1 });
    const p = await paper(page);
    await page.click('#sfFrameColour');
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    // as v304 saved it: the paper an ordinary section (no "brought back" state, since it was never left out)
    await page.evaluate((p) => {
      const t = __mstest,
        d = t.currentDesignObj(),
        pl = d.payload;
      delete pl.secStates[p];
      // (v306 saves the frame's paper, `frame`: a guide saved before has none)
      delete pl.frame;
      window.__want = JSON.stringify(pl.assign);
      t.openDesignObj(Object.assign({}, pl, { name: 'Old framed', W: d.W, H: d.H }), null);
    }, p);
    await page.waitForFunction(() => __mstest.curName === 'Old framed' && __mstest.assignData);
    await idle(page);
    assert.equal(
      await page.evaluate(() => JSON.stringify(__mstest.currentDesignObj().payload.assign)),
      await page.evaluate(() => window.__want),
    );
    assert.equal(await page.evaluate(() => __mstest.countedList().length), 9, 'the flower and the paper');
    assert.equal(await page.$('#sfFrameLine'), null, 'nothing found again on opening');
    // Edit sections: the paper is a section there too
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    assert.equal(await page.evaluate(() => __mstest.countedList().length), 9);
    assert.equal(await page.$('#sfFrameLine'), null);
    assert.deepEqual(errors, []);
  });
}

// ---- from v306-frame.test.mjs ----
// v306 (sections): the paper inside a drawn frame. Saved with the guide (`frame`), so a guide opened again (from the
// Library, a backup or a guide file) has "Paper round the drawing is left white · Colour it" while the paper is white;
// a guide saved before v306 has no `frame` and nothing is found again. Colour it in the Plan is one Undo step, the
// plan's earlier steps kept: Undo leaves the paper white again (in Edit sections too, nothing new to build), Redo
// colours it; with zones, and with the paper ticked (Undo takes the tick with it, Redo brings it back).
// Pages drawn here in code, as in e2e/v305-frame.
{
  // a 1200 × 1500 page: a frame 90 px in, a flower in the middle
  const DRAW = `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=6;
const ring=(x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();};
g.strokeRect(90,90,W-180,H-180);
ring(600,700,300);ring(600,700,180);g.beginPath();g.moveTo(300,700);g.lineTo(900,700);g.moveTo(600,400);g.lineTo(600,1000);g.stroke();`;
  async function fresh(page) {
    const b64 = await page.evaluate(async (src) => {
      const W = 1200,
        H = 1500,
        c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      new Function('g', 'W', 'H', src)(c.getContext('2d'), W, H);
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      return await new Promise((res) => {
        const f = new FileReader();
        f.onload = () => res(f.result.split(',')[1]);
        f.readAsDataURL(blob);
      });
    }, DRAW);
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
    await fc.setFiles({ name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
    await idle(page);
  }
  async function built(page) {
    await sampleGuide(page);
    await fresh(page);
    await page.click('#sfBuild');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    return paper(page);
  }
  const paper = (page) => page.evaluate(() => __mstest.comps.findIndex((c) => c && !c.merged && c.framed));
  const inGuide = (page, l) => page.evaluate((l) => !!__mstest.assignData.assign[l], l);
  const markers = (page) =>
    page.evaluate(() => {
      const a = __mstest.assignData.assign,
        o = {};
      for (const k in a) o[k] = a[k].mkey;
      return o;
    });
  const without = (o, l) => {
    const r = Object.assign({}, o);
    delete r[l];
    return r;
  };
  const line = async (page) => {
    const el = await page.$('#sfFrameLine');
    return el ? (await el.textContent()).trim() : null;
  };
  const live = (page) =>
    page
      .waitForFunction(() => document.getElementById('sfLive').textContent)
      .then(() => page.textContent('#sfLive'));
  async function undo(page) {
    await page.click('#sfPlanUndo');
    await idle(page);
  }
  async function redo(page) {
    await page.click('#sfPlanRedo');
    await idle(page);
  }
  async function reopen(page, id) {
    await page.reload();
    await idle(page);
    await page.evaluate((id) => loadGuide({ id }), id);
    await page.waitForFunction((id) => __mstest.curId === id && __mstest.assignData, id);
    await idle(page);
  }
  const LINE = 'Paper round the drawing is left white · Colour it';
  const STEP = 'Paper round the drawing coloured';
  test('saved and opened again: the line is back while the paper is white, and Colour it works', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const p = await built(page);
    assert.ok(p > 0, 'the frame is found');
    assert.equal(await line(page), LINE);
    const was = await markers(page);
    assert.equal(
      await page.evaluate(() => __mstest.currentDesignObj().payload.frame),
      p,
      'saved with the guide',
    );
    await saveGuide(page);
    const id = await page.evaluate(() => __mstest.curId);
    await reopen(page, id);
    assert.deepEqual(await markers(page), was, 'opens as it was saved');
    assert.equal(await inGuide(page, p), false, 'the paper still white');
    assert.equal(await line(page), LINE, 'the line is back');
    await shot(page, 'v306-frame-reopened-820x1180');
    // in Edit sections too
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await line(page), LINE, 'on Edit sections');
    await page.click('#sfFrameColour');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), p), true);
    assert.equal(await live(page), 'Paper round the drawing is a section');
    await page.click('#sfPlanUndo');
    await idle(page);
    assert.equal(await line(page), LINE, 'Undo: white again');
    await page.click('#sfToPlan');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    // Colour it: the paper has a marker, the rest keep theirs, one Undo step
    await page.click('#sfFrameColour');
    await idle(page);
    assert.equal(await inGuide(page, p), true, 'the paper has a marker');
    const now = await markers(page);
    assert.deepEqual(without(now, p), was, 'the rest keep their markers');
    assert.equal(await line(page), null, 'the line goes');
    assert.equal(await page.evaluate(() => __mstest.planLabel), STEP);
    assert.equal(await page.getAttribute('#sfPlanUndo', 'aria-label'), 'Undo: ' + STEP);
    // saved again and opened: coloured, no line, and it's still the frame's paper
    await saveGuide(page);
    assert.equal(await page.evaluate(() => __mstest.currentDesignObj().payload.frame), p);
    await reopen(page, id);
    assert.deepEqual(await markers(page), now);
    assert.equal(await line(page), null);
    assert.deepEqual(errors, []);
  });
  test('a guide file and a backup carry the frame; a guide saved before v306 gets no line back', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    const p = await built(page);
    const was = await markers(page);
    // a guide file to share, opened (Import a guide opens it the same way)
    await page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj(true);
      window.__file = d;
      t.openDesignObj(Object.assign({}, d.payload, { name: 'Shared framed', W: d.W, H: d.H }), null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Shared framed' && __mstest.assignData);
    await idle(page);
    assert.equal(await page.evaluate(() => window.__file.payload.frame), p);
    assert.deepEqual(await markers(page), was);
    assert.equal(await line(page), LINE, 'the line, from a guide file');
    // a backup keeps the guide as saved, frame and all
    await saveGuide(page);
    await page.evaluate(() => openBackup());
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupDownload')]);
    assert.match(
      await readFile(await dl.path(), 'utf8'),
      new RegExp('"frame":' + p + '\\b'),
      'in the backup',
    );
    await page.keyboard.press('Escape');
    await idle(page);
    // as v305 saved it: no `frame` (the paper left white, saved as left out)
    await page.evaluate(() => {
      const t = __mstest,
        d = t.currentDesignObj(),
        pl = d.payload;
      delete pl.frame;
      t.openDesignObj(Object.assign({}, pl, { name: 'Old framed', W: d.W, H: d.H }), null);
    });
    await page.waitForFunction(() => __mstest.curName === 'Old framed' && __mstest.assignData);
    await idle(page);
    assert.deepEqual(await markers(page), was, 'opens as it was saved');
    assert.equal(await inGuide(page, p), false, 'the paper white');
    assert.equal(await paper(page), -1, 'nothing found again');
    assert.equal(await line(page), null, 'no line');
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false, 'left out on Edit sections too');
    assert.equal(await line(page), null);
    assert.deepEqual(errors, []);
  });
  test('Colour it keeps the plan’s Undo: Undo leaves the paper white again, Redo colours it; nothing to build in Edit sections', async () => {
    const { page, errors } = await openApp({ width: 1180, height: 820 });
    const p = await built(page);
    const m0 = await markers(page);
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    // (v308: a Shuffle of this page's 8 sections can now and then lay the same markers again, as it did once in WebKit
    // on GitHub: Shuffle again until they differ; any Shuffle that changed nothing leaves the markers as m0, so one Undo
    // after Colour it's still brings m0 back)
    let m1 = m0;
    for (let i = 0; i < 6 && JSON.stringify(m1) === JSON.stringify(m0); i++) {
      await page.click('#sfVary');
      await idle(page);
      m1 = await markers(page);
    }
    assert.notDeepEqual(m1, m0, 'shuffled');
    const k = await page.evaluate(() => __mstest.planCount);
    assert.ok(k >= 1);
    await page.click('#sfFrameColour');
    await idle(page);
    const m2 = await markers(page);
    assert.equal(await inGuide(page, p), true);
    assert.deepEqual(without(m2, p), m1, 'the rest keep their markers');
    assert.equal(
      await page.evaluate(() => __mstest.planCount),
      k + 1,
      'the Shuffle step is kept, and Colour it is one more',
    );
    assert.equal(await live(page), STEP);
    await shot(page, 'v306-frame-coloured-1180x820');
    // Undo: white again, as after the Shuffle, the line back
    await undo(page);
    assert.equal(await inGuide(page, p), false);
    assert.deepEqual(await markers(page), m1);
    assert.equal(await line(page), LINE, 'the line is back');
    assert.equal(await page.getAttribute('#sfPlanRedo', 'aria-label'), 'Redo: ' + STEP);
    await shot(page, 'v306-frame-undone-1180x820');
    // and the Shuffle
    await undo(page);
    assert.deepEqual(await markers(page), m0);
    // Redo both: coloured again, with the marker it had
    await redo(page);
    assert.deepEqual(await markers(page), m1);
    await redo(page);
    assert.deepEqual(await markers(page), m2);
    assert.equal(await line(page), null);
    // Undo, then Edit sections: the paper left out there too, nothing to build
    await undo(page);
    await page.click('#sfBack2');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.sfmode), 'review');
    assert.equal(await page.evaluate(() => __mstest.secEdPending()), false, 'nothing to build');
    assert.equal(await page.evaluate((l) => __mstest.counted(l), p), false);
    assert.equal(await line(page), LINE);
    // ← Plan: as it was; saved and opened: white, with the line
    await page.click('#sfToPlan');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    assert.deepEqual(await markers(page), m1);
    await saveGuide(page);
    await reopen(page, await page.evaluate(() => __mstest.curId));
    assert.deepEqual(await markers(page), m1);
    assert.equal(await line(page), LINE);
    assert.deepEqual(errors, []);
  });
  test('Colour it with zones: Undo puts the zones back as they were, Redo colours the paper again', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const p = await built(page);
    // a zone of the flower's top two pieces
    const top = await page.evaluate(() => {
      const t = __mstest;
      return Object.keys(t.assignData.assign)
        .map(Number)
        .filter((l) => t.comps[l].cy < 700)
        .slice(0, 2);
    });
    await page.click('.sftabbtn[data-t="pattern"]');
    await idle(page);
    if (await page.$('#sfZoneAdd')) await page.click('#sfZoneAdd');
    else await page.click('#sfPanel-pattern .sfzchip.sfzadd');
    await idle(page);
    for (const l of top) {
      await scrollTop(page);
      const q = await sectionPoint(page, l);
      await page.mouse.click(q.x, q.y);
      await idle(page);
    }
    await page.click('#sfZoneDone');
    await idle(page);
    const zs = () =>
      page.evaluate(() =>
        JSON.stringify(
          __mstest.zones.map((z) =>
            Object.keys(z.secs)
              .map(Number)
              .sort((a, b) => a - b),
          ),
        ),
      );
    const z0 = await zs(),
      m0 = await markers(page);
    assert.equal(JSON.parse(z0)[0].length, 2, 'the zone has its two');
    const n0 = await page.evaluate(() => __mstest.planCount);
    await page.click('#sfFrameColour');
    await idle(page);
    assert.equal(await inGuide(page, p), true);
    assert.equal(await page.evaluate(() => __mstest.planCount), n0 + 1);
    assert.deepEqual(without(await markers(page), p), m0);
    const z1 = await zs(),
      m1 = await markers(page);
    await undo(page);
    assert.equal(await inGuide(page, p), false);
    assert.equal(await zs(), z0, 'the zones as they were');
    assert.deepEqual(await markers(page), m0);
    assert.equal(await line(page), LINE);
    await redo(page);
    assert.equal(await zs(), z1);
    assert.deepEqual(await markers(page), m1);
    assert.deepEqual(errors, []);
  });
  test('Colour it, the paper ticked: Undo takes the tick with it, Redo brings it back', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    const p = await built(page);
    await page.click('#sfFrameColour');
    await idle(page);
    const N = await page.evaluate(() => __mstest.assignData.N);
    // Colour along: a tap on the paper ticks it
    await page.click('#sfColor');
    await idle(page);
    await scrollTop(page);
    const q = await sectionPoint(page, p);
    await page.mouse.click(q.x, q.y);
    await idle(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 1, 'ticked');
    await page.click('#sfDoneBtn');
    await page.waitForFunction(() => __mstest.sfmode === 'guide');
    await idle(page);
    assert.equal(await page.evaluate(() => __mstest.planLabel), STEP, 'the tick is no step of its own');
    await undo(page);
    assert.equal(await inGuide(page, p), false);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 0, 'the tick goes with the paper');
    assert.equal(await page.evaluate(() => __mstest.assignData.N), N - 1);
    assert.equal(await line(page), LINE);
    await redo(page);
    assert.equal(await inGuide(page, p), true);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 1, 'ticked again');
    // and again: Undo, Redo
    await undo(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 0);
    await redo(page);
    assert.equal(await page.evaluate((l) => __mstest.colored[l], p), 1);
    // saved with the tick
    await saveGuide(page);
    assert.ok(await page.evaluate((l) => __mstest.currentDesignObj().payload.prog.includes(l), p));
    assert.deepEqual(errors, []);
  });
}
