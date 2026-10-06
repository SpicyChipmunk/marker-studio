// v308 (beta branch): Send feedback (Home's foot, the guide's ⋯ menu, beside an error, Help › About), caught errors with
// friendly words, Copy details and a record that outlives a reload (Copy diagnostics), What's new by version, the Beta
// label and the one-time thanks, the tester guide in Help, Delete all my data, the welcome's privacy line, and
// Scatter's Polished line.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, openApp, idle, sampleGuide, saveGuide, openMenu, until } from './helpers.mjs';

before(setup);
after(teardown);

const KEY = 'ohuhu-hb320-picker-v3';
const OWN = ['Ohuhu|R014', 'Ohuhu|Y111', 'Ohuhu|B08'];
const appState = (extra = {}) =>
  JSON.stringify({
    mode: 'home',
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
    owned: OWN,
    saved: [],
    ...extra,
  });
const onboarded = (extra = {}) => ({ 'ms-onboarded': '1', 'ms-setup-tip': '1', [KEY]: appState(), ...extra });
const IPAD = { width: 820, height: 1180 };
// the share sheet and the clipboard, recorded
const spy = () => {
  window.__shared = [];
  window.__copied = [];
  navigator.share = (o) => (window.__shared.push(o), Promise.resolve());
  try {
    navigator.clipboard.writeText = (t) => (window.__copied.push(t), Promise.resolve());
  } catch (_) {}
};
const shared = (page) => page.evaluate(() => window.__shared);
const copied = (page) => page.evaluate(() => window.__copied);
const after_ = (page, sel) =>
  page.evaluate((s) => getComputedStyle(document.querySelector(s), '::after').content, sel);

test('Send feedback from Home’s foot: the share sheet with the version, device, Home Screen, screen and counts', async () => {
  const { page, errors } = await openApp({ ...IPAD, storage: onboarded(), init: spy });
  await idle(page);
  const ver = (await page.textContent('#appVer')).trim();
  assert.match(ver, /^v\d+(\.\d+)?$/, 'the version itself is unchanged');
  assert.equal(await after_(page, '#appVer'), '" · Beta"');
  const links = await page.$$eval('.homehelp button', (b) => b.map((x) => x.textContent));
  assert.deepEqual(links, ['How it works', 'Help', 'Send feedback']);
  await page.click('#homeFeedback');
  await until(page, () => window.__shared.length === 1, null, 'shared');
  const [s] = await shared(page);
  assert.equal(s.title, `Marker Studio ${ver} · Beta feedback`);
  for (const w of [
    `Marker Studio ${ver} · Beta`,
    'Device: ',
    'Home Screen app: no',
    'Screen: ',
    'window 820×1180',
    'Saved here: 3 markers, 0 guides, 0 palettes',
    'No errors recorded.',
  ])
    assert.ok(s.text.includes(w), w);
  // no share sheet (a computer's Chrome): copied, and said so
  await page.evaluate(() => {
    delete Navigator.prototype.share;
    navigator.share = undefined;
  });
  await page.click('#homeFeedback');
  await until(page, () => window.__copied.length === 1, null, 'copied');
  assert.equal((await copied(page))[0], s.text);
  await page.waitForSelector('#msToast.on');
  assert.match(await page.textContent('#msToast'), /^Report copied — paste it into your feedback message/);
  assert.deepEqual(errors, []);
});

test('a guide that can’t open: friendly words, Copy details and Send feedback; the record outlives a reload (Copy diagnostics)', async () => {
  const { page, errors } = await openApp({ ...IPAD, storage: onboarded(), init: spy });
  await page.evaluate(() => {
    setMode('sections');
    SF.loadSample();
  });
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await saveGuide(page);
  const id = await page.evaluate(() => state.saved.find((s) => s.type === 'guide').id);
  // the stored copy can't be read: Safari's words for it
  await page.evaluate((id) => {
    SF.configure({
      loadDesign: () => Promise.reject(new TypeError("null is not an object (evaluating 'd.assign')")),
    });
    state.saved.push(
      Object.assign(
        {},
        state.saved.find((s) => s.id === id),
        { id: id + 1, name: 'Other' },
      ),
    );
    SF.openDesign(id + 1);
  }, id);
  await page.waitForFunction(() =>
    /Couldn’t open that guide\./.test(
      (document.querySelector('.mserr') || document.getElementById('msToast') || {}).textContent,
    ),
  );
  const box = await page.evaluate(() => {
    const c = document.querySelector('.mserr') || document.getElementById('msToast');
    return {
      t: c.textContent,
      b: [...c.querySelectorAll('button')].map((x) => x.textContent.trim()).filter(Boolean),
    };
  });
  assert.ok(!box.t.includes('null is not'), 'not the engine’s words: ' + box.t);
  assert.ok(box.b.includes('Copy details') && box.b.includes('Send feedback'), String(box.b));
  // the meta line under the start card repeats the words without the buttons
  assert.equal(
    await page.evaluate(
      () =>
        [...document.querySelectorAll('.sfmeta .errbtns')].filter((e) => e.getClientRects().length).length,
    ),
    0,
  );
  await page.click('.mserr [data-errcopy], #msToast [data-errcopy]');
  await until(page, () => window.__copied.length === 1, null, 'copied');
  const d = (await copied(page))[0];
  assert.match(d, /· Opening a guide\nnull is not an object \(evaluating 'd\.assign'\)/);
  assert.match(
    d,
    /\nDevice: [^\n]+\nHome Screen app: no\nScreen: \d+×\d+, window 820×1180, 2× pixels, touch points \d+\n/,
  );
  // Send feedback beside it: the error is in the report
  await page.evaluate(() => {
    const c = document.querySelector('.mserr [data-feedback], #msToast [data-feedback]');
    c.click();
  });
  await until(page, () => window.__shared.length === 1, null, 'shared');
  assert.match(
    (await shared(page))[0].text,
    /Last errors:\n- \d{4}-\d\d-\d\d \d\d:\d\d · Opening a guide: null is not an object/,
  );
  // after a reload: Help › About › Copy diagnostics still has it
  await page.reload();
  await idle(page);
  await page.click('#mHome');
  await idle(page);
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpAbout > summary');
  await page.click('#helpDiag');
  await until(page, () => window.__copied.length === 1, null, 'copied after the reload');
  assert.match((await copied(page))[0], /Opening a guide\nnull is not an object/);
  await page.waitForSelector('#msToast.on');
  assert.match(await page.textContent('#msToast'), /^Diagnostics copied/);
  assert.deepEqual(errors, []);
});

test('the guide’s ⋯ menu has Send feedback, under Help', async () => {
  const { page, errors } = await openApp({ ...IPAD, init: spy });
  await sampleGuide(page);
  await idle(page);
  await openMenu(page);
  const items = await page.$$eval('#sfSheet [role="group"]:last-of-type .sfmitem', (b) =>
    b.map((x) => x.textContent),
  );
  assert.deepEqual(items, ['Help', 'Send feedback']);
  await page.click('#sfSheet .sfmitem:text-is("Send feedback")');
  await until(page, () => window.__shared.length === 1, null, 'shared');
  assert.match((await shared(page))[0].text, /Saved here: \d+ markers/);
  assert.deepEqual(errors, []);
});

test('an unexpected error: Send feedback beside Copy details', async () => {
  const { page } = await openApp({ storage: onboarded(), init: spy });
  await page.evaluate(() => {
    const o = state.owned;
    state.owned = null;
    setTimeout(backupDue, 0);
    setTimeout(() => {
      state.owned = o;
    }, 50);
  });
  await page.waitForSelector('#msToast.on #errCopy');
  assert.deepEqual(await page.$$eval('#msToast button', (b) => b.map((x) => x.textContent)), [
    'Copy details',
    'Send feedback',
  ]);
  await page.click('#msToast [data-feedback]');
  await until(page, () => window.__shared.length === 1, null, 'shared');
  assert.match((await shared(page))[0].text, /Last errors:\n- [^\n]*null/);
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ms-errors')).length >= 1), 'kept');
});

test('What’s new shows only what came after the version last seen; About lists this version’s', async () => {
  const { ctx, page, errors } = await openApp({
    ...IPAD,
    init: () => {
      window.__MS_HELP_AUTO = true;
    },
    storage: onboarded({ 'ms-last-ver': 'v306' }),
  });
  await idle(page);
  const ver = (await page.textContent('#appVer')).trim();
  const wn = await page.evaluate(() => WHATS_NEW);
  const num = (v) => {
    const m = /^v(\d+)(?:\.(\d+))?/.exec(v);
    return +m[1] + (+m[2] || 0) / 1000;
  };
  const want = wn
    .filter((x) => num(x.v) > 306 && num(x.v) <= num(ver))
    .slice(0, 4)
    .map((x) => x.t);
  assert.ok(want.length >= 1);
  assert.ok(await page.isVisible('#whatsNew'));
  assert.deepEqual(await page.$$eval('#whatsNew li', (l) => l.map((x) => x.textContent)), want);
  assert.ok(!(await page.textContent('#whatsNew')).includes(wn.find((x) => x.v === 'v306').t), 'not v306’s');
  // every entry has its version
  assert.ok(
    wn.every((x) => /^v\d+(\.\d+)?$/.test(x.v) && x.t),
    'tagged',
  );
  // About: this version's (or the newest that has any)
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpAbout > summary');
  const top = wn.find((x) => num(x.v) <= num(ver)).v;
  assert.equal((await page.textContent('#helpWnVer')).trim(), top);
  assert.deepEqual(
    await page.$$eval('#helpWnList li', (l) => l.map((x) => x.textContent)),
    wn.filter((x) => x.v === top).map((x) => x.t),
  );
  assert.equal(await after_(page, '#helpVer'), '" · Beta"');
  const about = await page.textContent('#helpAbout');
  assert.ok(about.includes('Marker Studio isn’t affiliated with or endorsed by Ohuhu or Copic.'));
  assert.ok(
    about.includes('It works offline, and the camera is used only when you Scan caps or Match a colour.'),
  );
  assert.ok(about.includes('Icons: Lucide (ISC License), some from Feather (MIT License).'));
  assert.ok((await page.isVisible('#helpFeedback')) && (await page.isVisible('#helpDiag')));
  await page.click('#helpClose');
  // seen this version already: nothing
  await page.evaluate((v) => localStorage.setItem('ms-last-ver', v), ver);
  await page.reload();
  await idle(page);
  assert.equal(await page.$('#whatsNew'), null);
  // from long ago: the four newest
  await page.evaluate(() => {
    localStorage.setItem('ms-last-ver', 'v200');
    localStorage.removeItem('ms-wn-shown');
  });
  await page.reload();
  await idle(page);
  assert.deepEqual(
    await page.$$eval('#whatsNew li', (l) => l.map((x) => x.textContent)),
    wn
      .filter((x) => num(x.v) <= num(ver))
      .slice(0, 4)
      .map((x) => x.t),
  );
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Thanks for testing: once, before What’s new; its Tester guide opens Help’s guide', async () => {
  const { page, errors } = await openApp({
    ...IPAD,
    init: () => {
      window.__MS_HELP_AUTO = true;
      window.__MS_THANKS_AUTO = true;
    },
    storage: onboarded({ 'ms-last-ver': 'v200' }),
  });
  await idle(page);
  assert.ok(await page.isVisible('#betaThanks'));
  assert.equal((await page.textContent('#btTitle')).trim(), 'Thanks for testing Marker Studio');
  assert.equal(await page.$('#whatsNew'), null, 'What’s new waits');
  await page.reload();
  await idle(page);
  assert.ok(await page.isVisible('#betaThanks'), 'until dismissed');
  await page.click('#btClose');
  await idle(page);
  assert.equal(await page.$('#betaThanks'), null);
  assert.ok(await page.isVisible('#whatsNew'), 'then What’s new');
  await page.reload();
  await idle(page);
  assert.equal(await page.$('#betaThanks'), null, 'once');
  // Tester guide: Help opens on the beta guide
  await page.evaluate(() => localStorage.removeItem('ms-beta-thanks'));
  await page.reload();
  await idle(page);
  await page.click('#btGuide');
  await page.waitForSelector('#helpOverlay.on');
  assert.equal(await page.evaluate(() => document.getElementById('helpBeta').open), true);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-beta-thanks')), '1');
  assert.deepEqual(errors, []);
});

test('Help: the beta tester guide first, the new glossary entries, “phone or iPad”, Library › Restore', async () => {
  const { page, errors } = await openApp({ ...IPAD, storage: onboarded() });
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  const secs = await page.$$eval('#helpOverlay .hlpsec > summary', (l) => l.map((s) => s.textContent));
  assert.deepEqual(secs, [
    'Beta tester guide',
    'Photographing a page',
    'Glossary',
    'Keyboard and screen readers',
    'Your data',
    'About',
  ]);
  await page.click('#helpBeta > summary');
  const g = await page.textContent('#helpBeta');
  for (const w of [
    'Add to Home Screen',
    'before you set up your markers',
    'Back up once a week',
    'Ohuhu and Copic markers only',
    'approximate',
    'screenshot the page',
    'Known limits',
    'What to try',
    'Send feedback',
    'Copy details',
  ])
    assert.ok(g.includes(w), w);
  await page.click('#helpGloss > summary');
  const terms = await page.$$eval('#helpGloss dt', (d) => d.map((x) => x.textContent));
  for (const t of ['Flow', 'Look', 'Scatter', 'Rough spots', 'Mood', 'Include', 'Surprise', 'Colour along'])
    assert.ok(terms.includes(t), t);
  await page.click('#helpPhoto > summary');
  const ph = await page.textContent('#helpPhoto');
  assert.ok(
    ph.includes('Hold your phone or iPad above the page') && ph.includes('take a screenshot of the page'),
  );
  await page.click('#helpData > summary');
  assert.ok((await page.textContent('#helpData')).includes('Library › Restore brings it back'));
  assert.deepEqual(errors, []);
});

test('Delete all my data: a backup first, DELETE typed, then everything of this app is gone (other sites’ keys stay)', async () => {
  const { page, errors } = await openApp({ ...IPAD, storage: onboarded({ 'other-site': 'keep' }) });
  // a guide in the Library, its picture stored in the database
  await page.evaluate(() => {
    setMode('sections');
    SF.loadSample();
  });
  await page.waitForFunction(() => !!(window.__mstest && __mstest.assignData));
  await saveGuide(page);
  await page.evaluate(() => setMode('home'));
  await idle(page);
  assert.equal(await page.evaluate(() => state.saved.length), 1);
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpData > summary');
  await page.click('#helpWipe');
  await page.waitForSelector('#sfEdAsk');
  assert.equal((await page.textContent('#sfEdAskT')).trim(), 'Delete all your data?');
  assert.ok(await page.isDisabled('#wipeGo'), 'not until DELETE is typed');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Back up first');
  assert.match(
    await page.textContent('#sfEdAskD'),
    /^This deletes your markers, palettes, guides and their photos from this device\. It can’t be undone\. Back up first/,
  );
  // Back up first: the backup, then the question again
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sfEdAsk [data-a="backup"]')]);
  assert.match(dl.suggestedFilename(), /^marker-studio-backup-\d{4}-\d\d-\d\d\.json$/);
  await page.waitForSelector('#sfEdAsk');
  assert.match(await page.textContent('#sfEdAskD'), /^Your backup is made\./);
  await page.fill('#wipeWord', 'delet');
  assert.ok(await page.isDisabled('#wipeGo'));
  await page.fill('#wipeWord', 'delete');
  assert.equal(await page.isDisabled('#wipeGo'), false);
  await Promise.all([page.waitForEvent('load'), page.click('#wipeGo')]);
  await idle(page);
  assert.ok(await page.isVisible('#welcome'), 'back to the welcome');
  const st = await page.evaluate(() => ({
    other: localStorage.getItem('other-site'),
    owned: state.owned.size,
    saved: state.saved.length,
    keys: Object.keys(localStorage),
  }));
  assert.equal(st.other, 'keep');
  assert.equal(st.owned, 0);
  assert.equal(st.saved, 0);
  assert.ok(!st.keys.includes('ms-onboarded') && !st.keys.includes('ms-errors'), String(st.keys));
  const left = await page.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open('ms-guides', 1);
        r.onupgradeneeded = () => {};
        r.onsuccess = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('g')) {
            d.close();
            res(0);
            return;
          }
          const t = d.transaction('g').objectStore('g').count();
          t.onsuccess = () => {
            d.close();
            res(t.result);
          };
        };
        r.onerror = () => res(-1);
      }),
  );
  assert.equal(left, 0, 'no guides stored');
  assert.deepEqual(errors, []);
});

test('Delete all my data: Cancel and Escape change nothing', async () => {
  const { page, errors } = await openApp({ storage: onboarded() });
  await page.click('#homeHelp');
  await page.waitForSelector('#helpOverlay.on');
  await page.click('#helpData > summary');
  await page.click('#helpWipe');
  await page.waitForSelector('#sfEdAsk');
  await page.click('#sfEdAsk [data-a="stay"]');
  assert.equal(await page.$('#sfEdAsk'), null);
  await page.click('#helpWipe');
  await page.waitForSelector('#sfEdAsk');
  await page.fill('#wipeWord', 'DELETE');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.equal(await page.$('#sfEdAsk'), null);
  assert.equal(await page.evaluate(() => state.owned.size), 3);
  assert.equal(await page.evaluate(() => localStorage.getItem('ms-onboarded')), '1');
  assert.deepEqual(errors, []);
});

test('the welcome says it works offline and what the camera is for', async () => {
  const { page, errors } = await openApp(IPAD);
  assert.ok(await page.isVisible('#welcome'));
  assert.equal(
    (await page.textContent('.wcpriv')).trim(),
    'Works offline. Nothing you add leaves this device; the camera is used only to Scan caps or Match a colour.',
  );
  assert.ok(await page.isVisible('.wcpriv'));
  assert.deepEqual(errors, []);
});

test('Scatter at Polished has its line', async () => {
  const { page, errors } = await openApp(IPAD);
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="pattern"]');
  await idle(page);
  assert.equal(await page.textContent('#sfGradScatName'), 'Polished');
  assert.ok(await page.isVisible('#sfGradScatNote'));
  assert.equal(await page.textContent('#sfGradScatNote'), 'Neat bands in flow order');
  // and back to it from another stop
  await page.evaluate(() => {
    const el = document.getElementById('sfGradScat');
    el.value = '1';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.ok(await page.isVisible('#sfGradScatNote'));
  assert.equal(await page.textContent('#sfGradScatNote'), 'Neat bands in flow order');
  assert.deepEqual(errors, []);
});
