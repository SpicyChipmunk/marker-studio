// v312: Tester tasks (tester.js). The ways in (Home's foot, the thanks card, Help's tester guide); answers kept on the
// device through a reload; Send results posting the answers to the Google Form, by field, and saying so (offline:
// kept, and said); no form: copied instead; Send feedback's own dialog posting to the same form, or sharing; tap areas
// and no sideways scroll on a small phone at a large text size.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, welcome } from './helpers.mjs';

before(setup);
after(teardown);

// a pre-filled link as docs/tester-form-setup.gs logs it: the form's 27 fields, entry.1000 to entry.1026
const FIELDS = [
  'Kind',
  'Tester',
  'Name',
  'Send',
  'Version',
  'Device',
  'App or tab',
  'Markers',
  'Use so far',
  '1 Add your markers',
  '1 Note',
  '2 Make a guide',
  '2 Note',
  '3 Make the plan yours',
  '3 Note',
  '4 Colour along',
  '4 Note',
  '5 Come back to it',
  '5 Note',
  '6 Share or print',
  '6 Note',
  'Extras',
  'Confused most',
  'Change first',
  'Colours matched',
  'Next page',
  'Message',
];
const FORM =
  'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
  FIELDS.map((_, i) => 'entry.' + (1000 + i) + '=x').join('&');
const withForm = (more = '') => `window.__MS_RESULTS_FORM = ${JSON.stringify(FORM)};` + more;
// the clipboard and share sheet, recorded (Chromium under test has neither to hand)
const STUBS = `window.__copied = []; window.__shared = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  navigator.share = (o) => { window.__shared.push(o); return Promise.resolve(); };`;
const NO_SHARE = `window.__copied = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  delete Navigator.prototype.share;`;

// what the form got: {field: value}, one object per post
function catchPosts(page, fail = false) {
  const posts = [];
  return page
    .route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
      if (fail) return r.abort();
      const q = new URLSearchParams(r.request().postData() || ''),
        o = {};
      FIELDS.forEach((f, i) => (o[f] = q.get('entry.' + (1000 + i))));
      posts.push(o);
      return r.fulfill({ status: 200, body: 'ok' });
    })
    .then(() => posts);
}
async function ready(o = {}) {
  const a = await openApp({ width: 820, height: 1180, ...o });
  await welcome(a.page, 'look');
  await idle(a.page);
  return a;
}
const said = (page) => page.textContent('#ttSaid');
const foot = (page) => page.textContent('#homeTasks');
const rate = (page, k, r) => page.click(`.ttrow[data-k="${k}"] [data-r="${r}"]`);
const openRow = (page, k) => page.click(`.ttrow[data-k="${k}"] .tttop`);

test('the ways in: Home’s foot counts, the thanks card and Help’s tester guide open it; Escape closes it, back where it was', async () => {
  const { page, errors } = await ready({ init: 'window.__MS_THANKS_AUTO = 1;' });
  assert.equal(await foot(page), 'Tester tasks · 0 of 6');
  await page.click('#homeTasks');
  await idle(page);
  assert.ok(await page.isVisible('#ttOverlay'));
  assert.equal(await page.textContent('#ttCount'), '0 of 6 answered');
  // the first one to answer is open
  assert.equal(await page.getAttribute('#ttTop-add', 'aria-expanded'), 'true');
  assert.equal(await page.isVisible('#ttBody-guide'), false);
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.isVisible('#ttOverlay'), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'homeTasks');
  // the thanks card's, which then goes (the foot keeps the way in)
  await page.click('#btTasks');
  await idle(page);
  assert.ok(await page.isVisible('#ttOverlay'));
  await page.click('#ttClose');
  assert.equal(await page.isVisible('#betaThanks'), false);
  // Help › Beta tester guide
  await page.evaluate(() => window.openHelpSheet());
  await page.evaluate(() => (document.getElementById('helpBeta').open = true));
  await page.click('#helpTasks');
  await idle(page);
  assert.ok(await page.isVisible('#ttOverlay'));
  assert.deepEqual(errors, []);
});

test('answers: a rating answers a task (tapped again, taken back), notes and questions kept through a reload; all six: "ready to send"', async () => {
  const { page, errors } = await ready();
  await page.click('#homeTasks');
  await rate(page, 'add', 'easy');
  assert.equal(await page.textContent('#ttCount'), '1 of 6 answered');
  assert.equal(await page.textContent('.ttrow[data-k="add"] .ttchip'), 'Easy');
  assert.equal(await page.getAttribute('.ttrow[data-k="add"] [data-r="easy"]', 'aria-pressed'), 'true');
  // tapped again: taken back
  await rate(page, 'add', 'easy');
  assert.equal(await page.textContent('#ttCount'), '0 of 6 answered');
  await rate(page, 'add', 'ok');
  await page.fill('.ttrow[data-k="add"] .ttnote', 'Found my set straight away.');
  await openRow(page, 'match');
  await rate(page, 'match', 'hard');
  await page.fill('[data-q="confused"]', 'The Shading tab.');
  await page.click('[data-next="maybe"]');
  await page.fill('#ttName', 'Sam');
  await page.keyboard.press('Escape');
  assert.equal(await foot(page), 'Tester tasks · 1 of 6', 'the extras don’t count');
  await page.reload();
  await idle(page);
  await page.click('#homeTasks');
  await openRow(page, 'add');
  assert.equal(await page.inputValue('.ttrow[data-k="add"] .ttnote'), 'Found my set straight away.');
  assert.equal(await page.inputValue('[data-q="confused"]'), 'The Shading tab.');
  assert.equal(await page.getAttribute('[data-next="maybe"]', 'aria-pressed'), 'true');
  assert.equal(await page.inputValue('#ttName'), 'Sam');
  for (const k of ['guide', 'plan', 'along', 'back', 'share']) {
    await openRow(page, k);
    await rate(page, k, k === 'along' ? 'skip' : 'easy');
  }
  assert.equal(
    await page.textContent('.ttrow[data-k="along"] .ttn'),
    '–',
    'Didn’t try: answered, not ticked',
  );
  await page.keyboard.press('Escape');
  assert.equal(await foot(page), 'Tester tasks · ready to send');
  assert.deepEqual(errors, []);
});

test('Send results posts each answer to its field, says so, and a second send is marked an update', async () => {
  const { page, errors } = await ready({ init: withForm() });
  const posts = await catchPosts(page);
  await page.click('#homeTasks');
  await rate(page, 'add', 'easy');
  await openRow(page, 'plan');
  await rate(page, 'plan', 'hard');
  await page.fill('.ttrow[data-k="plan"] .ttnote', 'Couldn’t find the marker count.');
  await openRow(page, 'low');
  await rate(page, 'low', 'ok');
  await page.click('[data-next="yes"]');
  await page.fill('#ttName', 'Sam');
  assert.match(await page.textContent('#ttWhat'), /nothing until you tap it/);
  await page.click('#ttSend');
  await page.waitForFunction(() => /^Sent/.test(document.getElementById('ttSaid').textContent));
  assert.equal(posts.length, 1);
  const p = posts[0];
  assert.equal(p.Kind, 'Results');
  assert.match(p.Tester, /^T[0-9A-Z]{6}$/);
  assert.equal(p.Name, 'Sam');
  assert.equal(p.Send, '1');
  assert.match(p.Version, /^v\d+(\.\d+)? · Beta$/);
  assert.equal(p['App or tab'], 'browser tab');
  assert.match(p.Markers, /^Ohuhu \d+/);
  assert.equal(p['1 Add your markers'], 'Easy');
  assert.equal(p['3 Make the plan yours'], 'Hard');
  assert.equal(p['3 Note'], 'Couldn’t find the marker count.');
  assert.equal(p['2 Make a guide'], 'not yet');
  assert.equal(p.Extras, 'Running low and To buy: OK');
  assert.equal(p['Next page'], 'Yes');
  assert.equal(p.Message, '');
  await page.keyboard.press('Escape');
  assert.equal(await foot(page), 'Tester tasks · sent');
  // a change, then sent again from the top: the same tester, an update
  await page.click('#homeTasks');
  assert.match(await said(page), /Sent\. Thank you/);
  await openRow(page, 'guide');
  await rate(page, 'guide', 'ok');
  await page.click('#ttSendTop');
  await page.waitForFunction(() => document.getElementById('ttSaid').textContent.startsWith('Sent'));
  assert.equal(posts.length, 2);
  assert.equal(posts[1].Send, '2 (an update)');
  assert.equal(posts[1].Tester, p.Tester);
  assert.equal(posts[1]['2 Make a guide'], 'OK');
  assert.deepEqual(errors, []);
});

test('offline: nothing lost, said so; Copy my answers copies them', async () => {
  const { page, errors } = await ready({ init: withForm(STUBS) });
  await catchPosts(page, true);
  await page.click('#homeTasks');
  await rate(page, 'add', 'easy');
  await page.click('#ttSend');
  await page.waitForFunction(() => /^Couldn’t send/.test(document.getElementById('ttSaid').textContent));
  assert.match(await said(page), /Your answers are kept here/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-tester')).sends), 0);
  assert.equal(await foot(page), 'Tester tasks · 1 of 6');
  await page.click('#ttCopy');
  await idle(page);
  const c = await page.evaluate(() => window.__copied[0] || '');
  assert.match(c, /^Kind: Results\nTester: T/);
  assert.match(c, /1 Add your markers: Easy/);
  assert.match(await said(page), /^Copied/);
  assert.deepEqual(errors, []);
});

test('no form: Send results opens the share sheet with the answers (or copies them, without one)', async () => {
  for (const init of [STUBS, NO_SHARE]) {
    const { page, errors, ctx } = await ready({ init });
    await page.click('#homeTasks');
    await rate(page, 'add', 'hard');
    assert.match(await page.textContent('#ttWhat'), /opens the share sheet/);
    await page.click('#ttSend');
    await idle(page);
    const out = await page.evaluate(
      () => (window.__shared && window.__shared[0] ? window.__shared[0].text : window.__copied[0]) || '',
    );
    assert.match(out, /1 Add your markers: Hard/);
    assert.match(await said(page), init === STUBS ? /^Shared/ : /^Copied/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Send feedback with a form: its own dialog posts what was written, as Feedback; Share it instead shares it', async () => {
  const { page, errors } = await ready({ init: withForm(STUBS) });
  const posts = await catchPosts(page);
  await page.click('#homeFeedback');
  await idle(page);
  assert.ok(await page.isVisible('#fbOverlay'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'fbText');
  await page.click('#fbSend');
  assert.match(await page.textContent('#fbSaid'), /Write a line first/);
  assert.equal(posts.length, 0);
  await page.fill('#fbText', 'The sun jumped when I dragged it.');
  await page.click('#fbSend');
  await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].Kind, 'Feedback');
  assert.match(posts[0].Message, /^The sun jumped when I dragged it\.\n\nNo errors recorded\./);
  assert.equal(posts[0]['1 Add your markers'], '');
  assert.equal(await page.inputValue('#fbText'), '', 'cleared once sent');
  // Share it instead: the share sheet, with what was written first
  await page.click('#homeFeedback');
  await page.fill('#fbText', 'A screenshot of the Plan.');
  await page.click('#fbShare');
  await idle(page);
  assert.equal(await page.isVisible('#fbOverlay'), false);
  assert.match(
    await page.evaluate(() => window.__shared[0].text),
    /^A screenshot of the Plan\.\n\n— Details/,
  );
  assert.deepEqual(errors, []);
});

test('Send feedback without a form shares as before; a small phone at 1.6× text: 44px tap areas, nothing sideways', async () => {
  const { page, errors, ctx } = await ready({ init: STUBS });
  await page.click('#homeFeedback');
  await idle(page);
  assert.equal(await page.isVisible('#fbOverlay'), false);
  assert.match(
    await page.evaluate(() => window.__shared[0].text),
    /^What happened, or what would you like\?/,
  );
  await ctx.close();
  const b = await openApp({ width: 320, height: 640 });
  await welcome(b.page, 'look');
  await b.page.evaluate(() => document.documentElement.style.setProperty('--tpx0', '1.6px'));
  await b.page.click('#homeTasks');
  await idle(b.page);
  const r = await b.page.evaluate(() => {
    const card = document.querySelector('#ttOverlay .dcard'),
      small = [];
    // (the ✕ is 36px with a 44px tap area, as every dialog's: e2e/buttons)
    for (const el of card.querySelectorAll('button:not(.mclose), textarea, input')) {
      const h = el.getBoundingClientRect().height;
      if (el.getClientRects().length && h < 40)
        small.push((el.id || el.className || el.tagName) + ' ' + Math.round(h));
    }
    return {
      small,
      side: card.scrollWidth > card.clientWidth + 1,
      page: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.deepEqual(r, { small: [], side: false, page: false });
  assert.deepEqual(errors, []);
  assert.deepEqual(b.errors, []);
});

test('the shipped form link (RESULTS_FORM) has every field this version sends: Send feedback posts to it', async () => {
  // (the tests' own "no form" taken away, so the app's link is used; the post is caught here, never sent)
  const { page, errors } = await ready({ init: 'window.__MS_RESULTS_FORM = undefined;' });
  const posts = [];
  await page.route(/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse/, (r) => {
    posts.push({ url: r.request().url(), body: r.request().postData() || '' });
    return r.fulfill({ status: 200, body: 'ok' });
  });
  await page.click('#homeFeedback');
  await idle(page);
  assert.ok(await page.isVisible('#fbOverlay'), 'the form’s dialog, not the share sheet');
  await page.fill('#fbText', 'Checking the form link.');
  await page.click('#fbSend');
  await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
  assert.equal(posts.length, 1);
  assert.match(posts[0].url, /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/);
  const q = new URLSearchParams(posts[0].body);
  assert.equal([...q.keys()].filter((k) => /^entry\.\d+$/.test(k)).length, FIELDS.length);
  assert.ok([...q.values()].includes('Feedback'));
  assert.deepEqual(errors, []);
});
