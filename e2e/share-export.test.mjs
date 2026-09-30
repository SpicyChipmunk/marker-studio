// Handing files over (Share › Guide file, image, PDF): the share sheet on a phone, with a Share button when the tap has
// expired and a download when sharing fails; a download on a computer.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, sampleGuide, idle } from './helpers.mjs';

before(setup);
after(teardown);

// ---- From the third full review (v259) ----
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

test('when the phone refuses to share (the tap has expired), the PDF is offered with a Share button, not lost', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE });
  await sampleGuide(page);
  await page.evaluate(() => { window.__shares = 0; navigator.canShare = () => true; navigator.share = () => { window.__shares++; return window.__shares === 1 ? Promise.reject(new DOMException('x', 'NotAllowedError')) : Promise.resolve(); }; });
  // from inside the Print sheet
  await page.click('.sftabbtn[data-t="share"]'); await page.click('#sfPrint'); await page.click('#sfSheet #sfPDF');
  await page.waitForSelector('#toastAct', { timeout: 20000 });
  assert.match(await page.textContent('#msToast'), /PDF is ready/);
  await page.click('#toastAct'); await idle(page);
  assert.equal(await page.evaluate(() => window.__shares), 2, 'shared from the new tap');
  // any other failure downloads it instead
  await page.evaluate(() => { navigator.share = () => Promise.reject(new DOMException('x', 'DataError')); });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
  assert.match(dl.suggestedFilename(), /\.pdf$/);
  assert.deepEqual(errors, []);
});

// ---- From the fifth review’s leftovers ----
const stubShare = (fail) => {
  window.__shares = [];
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d) => !!(d && d.files && d.files.length) });
  Object.defineProperty(navigator, 'share', { configurable: true, value: (d) => { window.__shares.push(d.files[0].name); const n = window.__shares.length; return (fail === 'notallowed' && n === 1) ? Promise.reject(new DOMException('no gesture', 'NotAllowedError')) : fail === 'data' ? Promise.reject(new DOMException('x', 'DataError')) : Promise.resolve(); } });
};
const shareTab = (page) => page.click('.sftabbtn[data-t="share"]');

test('Share › Guide file on a phone: a Share button when the tap has expired, a download when sharing fails', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE });
  await sampleGuide(page);
  await page.evaluate(stubShare, 'notallowed');
  await shareTab(page); await page.click('#sfShareGuide');
  await page.waitForSelector('#msToast.on #toastAct');
  assert.match(await page.textContent('#msToast'), /Your guide file is ready\./);
  await page.click('#toastAct');
  await page.waitForFunction(() => window.__shares.length === 2);
  assert.match((await page.evaluate(() => window.__shares))[1], /\.msguide\.json$/);
  await page.evaluate(stubShare, 'data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfShareGuide')]);
  assert.match(dl.suggestedFilename(), /\.msguide\.json$/);
  await page.waitForFunction(() => /Guide file downloaded/.test(document.body.textContent));
  assert.deepEqual(errors, []);
});

test('on a computer the guide file, image and PDF download even where the browser could share them', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.evaluate(stubShare, '');
  await shareTab(page);
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfShareGuide')]);
  assert.match(dl.suggestedFilename(), /\.msguide\.json$/);
  [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfExport')]);
  assert.match(dl.suggestedFilename(), /\.png$/);
  await page.click('#sfPrint');
  assert.equal(await page.textContent('#sfPDF'), 'Download PDF', 'the button says what it does');
  [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('#sfPDF')]);
  assert.match(dl.suggestedFilename(), /\.pdf$/);
  assert.deepEqual(await page.evaluate(() => window.__shares), [], 'nothing went to a share sheet');
  assert.deepEqual(errors, []);
});

test('handOver: the share sheet on a phone (cancel is left alone), a download on a computer or when asked', async () => {
  const { page, errors } = await openApp({ userAgent: IPHONE });
  await page.evaluate(stubShare, '');
  const go = (o) => page.evaluate((o) => handOver(new Blob(['x'], { type: 'text/plain' }), 'x.txt', o), o);
  assert.equal(await go({ title: 'X' }), 'share');
  const [dl, r] = await Promise.all([page.waitForEvent('download'), go({ preferShare: false })]);
  assert.equal(r, 'download'); assert.equal(dl.suggestedFilename(), 'x.txt');
  const refuse = (name) => page.evaluate((name) => { Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.reject(new DOMException('x', name)) }); }, name);
  await refuse('AbortError');
  assert.equal(await go({ title: 'X' }), 'cancel');
  // no Share button offered when retry is off: it downloads
  await refuse('NotAllowedError');
  const [dl2, r2] = await Promise.all([page.waitForEvent('download'), go({ title: 'X', retry: false })]);
  assert.equal(r2, 'download'); assert.ok(dl2);
  assert.deepEqual(errors, []);
});
