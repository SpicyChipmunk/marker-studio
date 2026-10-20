// v318 review (prototype): during the beta, a card on Home under its cards says how many tester tasks are answered and
// which is next, opening the tasks at it; "ready to send" once all six are; gone once they're sent as they are (the
// line at Home's foot stays, as a way in).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle } from './helpers.mjs';

before(setup);
after(teardown);

const ONB = { 'ms-onboarded': '1', 'ms-setup-tip': '1' };
const KEYS = ['add', 'guide', 'plan', 'along', 'back', 'share'];
const tester = (n, sent) => {
  const t = {};
  KEYS.slice(0, n).forEach((k) => (t[k] = { r: 'easy', n: '', v: 'v318' }));
  const o = { id: 'TABC123', name: '', t, q: {}, sends: sent ? 1 : 0, sig: '' };
  if (sent) o.sig = JSON.stringify([o.t, o.q, o.name]);
  return JSON.stringify(o);
};
const card = async (page) => {
  await idle(page);
  return page.evaluate(() => {
    const c = document.getElementById('homeTaskCard'),
      f = document.getElementById('homeTasks');
    return {
      card: c && !c.hidden && c.getClientRects().length ? c.innerText.replace(/\s+/g, ' ').trim() : null,
      foot: f && f.getClientRects().length ? f.textContent : null,
    };
  });
};

test('the card: 0/6 with the first task, 2/6 with the third; it opens the tasks at the next one', async () => {
  let { page, errors } = await openApp({ storage: ONB });
  assert.deepEqual(await card(page), { card: '0/6 Beta tester tasks Next to answer: 1 · Add your markers ›', foot: 'Tester tasks · 0 of 6' });
  ({ page, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(2) } }));
  assert.equal((await card(page)).card, '2/6 Beta tester tasks Next to answer: 3 · Make the plan yours ›');
  await page.click('#homeTaskCard');
  await idle(page);
  assert.ok(await page.isVisible('#ttOverlay'), 'the tasks open');
  assert.match(await page.evaluate(() => document.getElementById('ttOverlay').innerText), /Make the plan yours/);
  assert.deepEqual(errors, []);
});

test('all six: ready to send; sent as they are: no card, the foot line still', async () => {
  let { page, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(6) } });
  assert.equal((await card(page)).card, '6/6 Beta tester tasks All 6 answered: ready to send ›');
  ({ page, errors } = await openApp({ storage: { ...ONB, 'ms-tester': tester(6, true) } }));
  assert.deepEqual(await card(page), { card: null, foot: 'Tester tasks · sent' });
  assert.deepEqual(errors, []);
});
