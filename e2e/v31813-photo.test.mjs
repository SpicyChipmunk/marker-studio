// v318.13: the photo tips. The first time a photo is chosen on a device (here the welcome's Choose a photo), a card of
// tips comes first, and its own Choose a photo opens the picker in that tap (iOS opens it only from a tap); after that
// the picker opens straight away (Home's Choose a photo). Its close or Escape opens nothing; the Guide screen's
// Photo tips link shows it again. A new photo's Min section size is about 1 mm on the page, shown beside the slider.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, haveSet } from './helpers.mjs';

before(setup);
after(teardown);

const tipsOn = () => {
  window.__MS_PHOTO_TIPS = true;
};
// a 900 x 1200 line drawing (a grid of rings) as a PNG
async function drawing(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 1200;
    const g = c.getContext('2d');
    g.fillStyle = '#fbfaf6';
    g.fillRect(0, 0, 900, 1200);
    g.strokeStyle = '#111';
    g.lineWidth = 4;
    for (let y = 150; y < 1200; y += 220)
      for (let x = 150; x < 900; x += 220) {
        g.beginPath();
        g.arc(x, y, 80, 0, 6.283);
        g.stroke();
        g.beginPath();
        g.arc(x, y, 40, 0, 6.283);
        g.stroke();
      }
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return await new Promise((r) => {
      const f = new FileReader();
      f.onload = () => r(f.result.split(',')[1]);
      f.readAsDataURL(blob);
    });
  });
  return { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}
const tipsShown = (page) =>
  page.evaluate(() => {
    const o = document.getElementById('ptOverlay');
    return !!o && o.classList.contains('on') && !!o.getClientRects().length;
  });
// counts file pickers opened
async function watchPickers(page) {
  const n = { v: 0 };
  page.on('filechooser', () => n.v++);
  return n;
}

test('the first photo: the tips first, their Choose a photo opens the picker; the next photo goes straight to it', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180, init: tipsOn });
  const n = await watchPickers(page);
  await haveSet(page);
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await page.click('#wcPhoto');
  await idle(page);
  assert.equal(await tipsShown(page), true, 'the tips show');
  assert.equal(n.v, 0, 'no picker yet');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ptGo', 'focus on its Choose a photo');
  const tips = await page.$$eval('#ptOverlay .pttips li', (l) => l.map((x) => x.textContent));
  assert.equal(tips.length, 5);
  assert.match(tips.join(' '), /flat.*above.*shadow.*whole page.*sent by message/is);
  // the card fits an iPad's screen without scrolling
  const fit = await page.evaluate(() => {
    const c = document.querySelector('#ptOverlay .ptcard');
    return c.scrollHeight <= c.clientHeight + 1;
  });
  assert.ok(fit, 'no scrolling in the card');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#ptGo')]);
  assert.equal(await tipsShown(page), false);
  await fc.setFiles(await drawing(page));
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 40000 });
  await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-photo-tips')), '1');
  // Min section size: about 1 mm on the page for a new photo
  assert.match(await page.textContent('#sfMinMm'), /about 1(\.\d)? mm/);
  // the next photo (Home's start card: the guide isn't begun): straight to the picker
  await page.click('#mHome');
  await idle(page);
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#homeCont [data-start="photo"]')]);
  assert.ok(fc2);
  assert.equal(await tipsShown(page), false, 'not again');
  assert.deepEqual(errors, []);
});

test('the tips’ close and Escape open nothing; the Guide screen’s Photo tips link shows them again', async () => {
  const { page, errors } = await openApp({ init: tipsOn });
  const n = await watchPickers(page);
  await haveSet(page);
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await page.click('#wcLook');
  await page.click('#mSections');
  await idle(page);
  await page.click('#sfPick');
  await idle(page);
  assert.equal(await tipsShown(page), true, 'the Guide screen’s Choose a photo: the tips first');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await tipsShown(page), false, 'Escape closes them');
  assert.equal(n.v, 0, 'and opens no picker');
  // seen: the next Choose a photo goes to the picker
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sfPick')]);
  assert.ok(fc);
  // the link on the start card shows them again; the close button opens nothing
  await page.click('#sfMeta [data-pttips]');
  await idle(page);
  assert.equal(await tipsShown(page), true, 'Photo tips shows them again');
  await page.click('#ptClose');
  await idle(page);
  assert.equal(await tipsShown(page), false);
  assert.equal(n.v, 1);
  assert.deepEqual(errors, []);
});
