// Finding the drawing in a photo of a page: grainy paper isn't ink, the table around the page and its blank margin
// are background, and a drawn frame isn't taken for the page's edge.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

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
  const b64 = await page.evaluate(async ([src, o]) => { const W = 1500, H = 2000, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); new Function('g', 'W', 'H', 'o', src)(g, W, H, o); const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85)); return await new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result.split(',')[1]); f.readAsDataURL(blob); }); }, [PAGE, o]);
  await haveSet(page); await page.check('#wcSets input[data-i="3"]'); await page.click('#wcAdd');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#wcPhoto')]);
  await fc.setFiles({ name: 'p.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 }); await idle(page);
  const r = await page.evaluate(() => { const t = __mstest, cl = t.countedList(); return { n: cl.length, biggest: Math.max(...cl.map((l) => t.comps[l].area)) / (t.W * t.H), warn: t.segWarn.ok ? '' : t.segWarn.code }; });
  return { page, errors, r };
}

test('grainy paper: the grain is not read as ink, so the page has just its drawn sections and no warning', async () => {
  for (const grain of [40, 70]) {
    const { r, errors } = await fromPage({ grain });
    // (21 since v277's smaller smallest section, 10 px: the 21st is a sliver of about 40 px where two circles cross,
    // the same size and place at both grains and with the table, so drawn, not grain; the grain's specks are 1-3 px)
    assert.equal(r.n, 21, `grain ${grain}: ${r.n} sections`);
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
  const f = await page.evaluate(() => { const t = __mstest, l = t.comps.findIndex((c) => c && !c.merged && c.framed); return { l, page: l > 0 && !!t.comps[l].page, area: l > 0 ? t.comps[l].area / (t.W * t.H) : 0 }; });
  assert.ok(f.l > 0 && f.area > 0.3, 'the big area inside the frame is the frame’s paper');
  assert.equal(f.page, false, 'not taken for the page');
  assert.ok(r.biggest < 0.3, 'left white');
  await page.click('#sfFrameColour'); await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.counted(l), f.l), true, 'Colour it: a section again');
  assert.deepEqual(errors, []);
});
