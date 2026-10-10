// v310.1 (making a guide): the Mood picture of the mood in use is the guide as it is, after Change colour and Unpin
// too (they change a section's marker in place); in the quick section check, Colour it from the keyboard leaves the
// keyboard on Build guide (the tools it went to are hidden there); a dense page whose Min section size would leave no
// section isn't offered that.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, sectionPoint, scrollTop, welcome } from './helpers.mjs';

before(setup);
after(teardown);

const MOODS = ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy'];
async function pics(page) {
  await page.evaluate(() => document.getElementById('sfMood').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(
    (M) => {
      const t = __mstest,
        m = t.mp;
      return m.key === t.mpKey() && M.every((k) => k === t.emphasis || k in m.pics);
    },
    MOODS,
    { timeout: 30000 },
  );
  await idle(page);
}
// the picture on the mood in use (a hash of its pixels)
const onCard = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('#sfMood .sfmp.on canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (Math.imul(h, 31) + d[i]) | 0;
    return h;
  });

test('the picture of the mood in use follows Change colour and Unpin', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-test-moodpics': '1' } });
  await sampleGuide(page);
  await pics(page);
  const first = await onCard(page);
  const l = await page.evaluate(() => {
    const t = __mstest;
    return t.assignData.order.slice().sort((a, b) => t.comps[b].area - t.comps[a].area)[0];
  });
  const m0 = await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l);
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  await page.click('.sftip [data-a="change"]');
  await page.waitForSelector('#sfSheet', { state: 'visible' });
  const k = await page.evaluate((not) => {
    const b = [...document.querySelectorAll('#sfPopSw .sfswg:not(.sfswrec) .sfsw')],
      cur = b.find((x) => x.dataset.k === not),
      g = cur && cur.closest('.sfswg');
    return b.find((x) => x.dataset.k !== not && x.closest('.sfswg') !== g).dataset.k;
  }, m0);
  await page.click(`#sfPopSw .sfswg:not(.sfswrec) .sfsw[data-k="${k}"]`);
  await page.click('#sfPopConfirm');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), k);
  await pics(page);
  const changed = await onCard(page);
  assert.notEqual(changed, first, 'the picture shows the new colour');
  // Unpin: back to the pattern's colour, and the picture with it
  await scrollTop(page);
  const q = await sectionPoint(page, l);
  await page.mouse.click(q.x, q.y);
  await idle(page);
  await page.click('.sftip [data-a="pin"]');
  await idle(page);
  assert.equal(await page.evaluate((l) => __mstest.assignData.assign[l].mkey, l), m0);
  await page.keyboard.press('Escape');
  await pics(page);
  assert.equal(await onCard(page), first, 'the picture as it was');
  assert.deepEqual(errors, []);
});

// a page with a frame 90 px in (as e2e/v306-frame draws it)
const DRAW = `
g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#111';g.lineWidth=6;
const ring=(x,y,r)=>{g.beginPath();g.arc(x,y,r,0,6.283);g.stroke();};
g.strokeRect(90,90,W-180,H-180);
ring(600,700,300);ring(600,700,180);g.beginPath();g.moveTo(300,700);g.lineTo(900,700);g.moveTo(600,400);g.lineTo(600,1000);g.stroke();`;

test('the quick check: Colour it from the keyboard leaves the keyboard on Build guide', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
  await welcome(page, 'look');
  await idle(page);
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
  assert.ok(await page.isVisible('#sfQuick'), 'the quick check');
  await page.focus('#sfFrameColour');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal(await page.isVisible('#sfFrameColour'), false, 'the paper is a section now');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfBuild');
  assert.deepEqual(errors, []);
});

test('a dense page of even squares: the question doesn’t offer to leave out the small ones when that leaves none', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-sec-tools': '0' } });
  await welcome(page, 'look');
  await idle(page);
  // a grid of 70 × 88 squares: about 6,000 sections, all the same size
  const b64 = await page.evaluate(async () => {
    const W = 1600,
      H = 2000,
      N = 70,
      M = 88,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    const sx = (W - 40) / N,
      sy = (H - 40) / M;
    for (let i = 0; i <= N; i++) {
      g.beginPath();
      g.moveTo(20 + i * sx, 20);
      g.lineTo(20 + i * sx, H - 20);
      g.stroke();
    }
    for (let j = 0; j <= M; j++) {
      g.beginPath();
      g.moveTo(20, 20 + j * sy);
      g.lineTo(W - 20, 20 + j * sy);
      g.stroke();
    }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'grid.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 120000 });
  await idle(page);
  await page.click('#sfBuild');
  await page.waitForSelector('[data-confirm]');
  const q = await page.textContent('[data-confirm]');
  assert.match(q, /This page has [\d,]+ sections/);
  assert.doesNotMatch(q, /keeps 0/);
  assert.equal(await page.$('[data-confirm] [data-a="min"]'), null, 'no Leave out the small ones');
  assert.match(await page.textContent('[data-confirm] .btn-primary'), /^Build all/);
  await page.click('[data-confirm] [data-a="all"]');
  await page.waitForFunction(() => __mstest.assignData && __mstest.sfmode === 'guide', null, {
    timeout: 120000,
  });
  assert.ok((await page.evaluate(() => __mstest.assignData.order.length)) > 3000);
  assert.deepEqual(errors, []);
});
