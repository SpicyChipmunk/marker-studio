// v304 (backup and saving): in a browser tab where Safari's seven-day rule applies (any browser on an iPhone or iPad,
// Safari on a Mac; not the Home Screen app), the backup reminder is also due once after a guide's first coloured
// section and on a visit after five days or more away, for guides or palettes (not markers only); a guide the last
// backup couldn't read makes it due at once; a restore says what it kept beside the backup's guides; and markers.json
// may only grow at the end (saved palettes and draws keep positions in it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createApp, memoryStorage } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3',
  DAY = 864e5;
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const stored = (saved = []) => JSON.stringify({ mode: 'home', ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: OWN, saved });
const UA = {
  ipad: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', maxTouchPoints: 5, standalone: false },
  iphone: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', maxTouchPoints: 5, standalone: false },
  homeScreen: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', maxTouchPoints: 5, standalone: true },
  macSafari: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', maxTouchPoints: 0 },
  macChrome: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', maxTouchPoints: 0 },
  android: { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', maxTouchPoints: 5 },
  linuxWebKit: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', maxTouchPoints: 0 },
};
const guide = (id, extra = {}) => ({ id, type: 'guide', name: 'G' + id, keys: [], W: 1, H: 1, n: 4, ts: Date.now() - DAY / 2, ...extra });
function boot(nav, saved, extra = {}) {
  const ls = memoryStorage({ [KEY]: stored(saved), 'ms-onboarded': '1', ...extra });
  const a = createApp({ localStorage: ls, navigator: nav });
  return { a, ls, why: () => a.__eval('(backupDue() || {}).why || null') };
}

test('v304 D8: in a Safari tab, due once after a guide’s first coloured section; never in the Home Screen app or other browsers', () => {
  const coloured = [guide(5, { done: 1 })];
  assert.equal(boot(UA.ipad, coloured).why(), 'first', 'iPad tab');
  assert.equal(boot(UA.iphone, coloured).why(), 'first', 'iPhone tab');
  assert.equal(boot(UA.macSafari, coloured).why(), 'first', 'Safari on a Mac');
  for (const k of ['homeScreen', 'macChrome', 'android', 'linuxWebKit'])
    assert.equal(boot(UA[k], coloured).why(), null, k + ': only the 14-day rule (v303)');
  // a guide only built (nothing coloured), or markers only: not yet
  assert.equal(boot(UA.ipad, [guide(5, { fresh: 1 })]).why(), null);
  assert.equal(boot(UA.ipad, [guide(5)]).why(), null, 'saved but nothing coloured');
  assert.equal(boot(UA.ipad, []).why(), null, 'markers only');
  // once: put away (Later / Not now), it doesn't come back as "first"
  const b = boot(UA.ipad, coloured);
  b.a.__eval('backupLater()');
  assert.equal(b.ls.getItem('ms-backup-first'), '1');
  assert.ok(+b.ls.getItem('ms-backup-snooze') > Date.now() + 6 * DAY, 'a week’s rest');
  assert.equal(b.why(), null);
  // a backup was made once: then it's the gap rule's turn, not this one
  assert.equal(boot(UA.ipad, coloured, { 'ms-guides-backup-ts': String(Date.now() - 3 * DAY) }).why(), null);
});

test('v304 D8: in a Safari tab, due on a visit after five days or more away, for guides or palettes changed since the last backup', () => {
  const at = { 'ms-guides-backup-ts': String(Date.now() - 8 * DAY) },
    changed = [guide(5, { done: 2, bk: Date.now() - 8 * DAY })];
  assert.equal(boot(UA.ipad, changed, { ...at, 'ms-last-visit': String(Date.now() - 6 * DAY) }).why(), 'gap');
  assert.equal(boot(UA.ipad, changed, { ...at, 'ms-last-visit': String(Date.now() - 4 * DAY) }).why(), null, 'four days away');
  assert.equal(boot(UA.ipad, changed, at).why(), null, 'no visit before this one');
  assert.equal(boot(UA.macChrome, changed, { ...at, 'ms-last-visit': String(Date.now() - 6 * DAY) }).why(), null, 'not Chrome');
  // markers only (changed since the backup): the 14-day rule as before
  assert.equal(boot(UA.ipad, [], { ...at, 'ms-backup-sig': 'old', 'ms-last-visit': String(Date.now() - 6 * DAY) }).why(), null);
  // nothing changed since the backup: nothing to say
  const safe = [guide(5, { done: 2, ts: Date.now() - 9 * DAY, bk: Date.now() - 8 * DAY })];
  assert.equal(boot(UA.ipad, safe, { ...at, 'ms-last-visit': String(Date.now() - 6 * DAY) }).why(), null);
  // this visit is noted for the next one
  const b = boot(UA.ipad, changed, at);
  assert.ok(Math.abs(+b.ls.getItem('ms-last-visit') - Date.now()) < 5000);
  // the 14-day rule is unchanged everywhere
  assert.equal(boot(UA.macChrome, changed, { 'ms-guides-backup-ts': String(Date.now() - 15 * DAY) }).why(), 'age');
});

test('v304 P4: a guide the last backup couldn’t read makes the reminder due at once, until it is backed up or gone', () => {
  const gs = [guide(5, { done: 1, bk: 1 }), guide(6, { done: 1, bk: Date.now() })];
  const b = boot(UA.macChrome, gs, { 'ms-guides-backup-ts': String(Date.now()), 'ms-backup-missed': '[5]' });
  assert.equal(b.why(), 'missed');
  assert.equal(b.a.__eval('backupDue().miss'), 1);
  b.a.__eval('state.saved = state.saved.filter((s) => s.id !== 5)');
  assert.equal(b.why(), null, 'deleted: nothing left to back up');
  assert.equal(boot(UA.macChrome, gs, { 'ms-guides-backup-ts': String(Date.now()) }).why(), null, 'without it (v303): two weeks');
});

test('v304: what a restore kept beside the backup’s guides, in words', () => {
  const { a } = boot(UA.macChrome, []);
  assert.equal(a.restoreKeptWords({}), '');
  assert.equal(a.restoreKeptWords({ kept: 1 }), ' 1 guide changed here since your last backup was kept as “… (before restore)”.');
  assert.equal(a.restoreKeptWords({ lost: 1 }), ' 1 guide stored on this device but not in your Library was left as it is — add it back from Home.');
  assert.equal(a.restoreKeptWords({ lost: 2, copies: 1 }), ' 1 guide was newer here, so it was kept and the backup’s version added as “(from backup)”. 2 guides stored on this device but not in your Library were left as they are — add them back from Home.');
});

// P10: saved palettes, draws, the pool, locked colours and Custom keep positions in markers.json (state.js), so a marker
// may only ever be added at the end. This pins every position a saved state can already hold (722 markers at v303).
test('v304 P10: markers.json only grows at the end — every saved position still names the same marker', () => {
  const now = JSON.parse(fs.readFileSync(new URL('../src/data/markers.json', import.meta.url), 'utf8')).map((c) => c.brand + '|' + c.code);
  const pinned = JSON.parse(fs.readFileSync(new URL('./fixtures/marker-order.json', import.meta.url), 'utf8'));
  assert.equal(pinned.length, 722);
  assert.ok(now.length >= pinned.length, 'no marker removed');
  const moved = pinned.map((k, i) => (now[i] === k ? null : i + ': ' + k + ' → ' + now[i])).filter(Boolean);
  assert.deepEqual(moved.slice(0, 5), [], moved.length + ' positions changed');
});
