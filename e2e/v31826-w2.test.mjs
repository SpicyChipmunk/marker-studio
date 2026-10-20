// v318.26 in the browser (builder W2): Blends with in a marker's details, the Tester questions (two new ones, and a
// form of 27 fields or 29), and the skin tones (Change colour's row; Markers' search is in e2e/v3083-data).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup,
  teardown,
  openApp,
  openAtScale,
  idle,
  welcome,
  sampleGuide,
  sectionPoint,
  scrollTop,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- Blends with ----

async function markers(o = {}) {
  const a = await openApp(o.width ? o : { width: 390, height: 844, ...o });
  await welcome(a.page, 'look');
  await idle(a.page);
  await a.page.click('#mCollection');
  await idle(a.page);
  return a;
}
const openSheet = (page, k) =>
  page.evaluate((k) => {
    openMarkerSheet(keyIdx(k));
  }, k);
const blend = (page) =>
  page.evaluate(() => {
    const g = document.getElementById('mkBlend');
    return {
      hidden: g.hidden,
      label: g.getAttribute('aria-label'),
      head: (g.querySelector('.mkblh, .mkblback') || {}).textContent || '',
      slots: [...g.querySelectorAll('.mkbl')].map((b) => ({
        i: +b.dataset.mkbl,
        k: mkey(+b.dataset.mkbl),
        code: b.querySelector('b').textContent,
        word: b.querySelector('.mkbls').textContent,
        aria: b.getAttribute('aria-label'),
      })),
    };
  });

test('Blends with: the lighter and darker markers, each opening its own details, with a way back', async () => {
  const { page, errors } = await markers();
  await openSheet(page, 'Ohuhu|R28');
  await page.waitForSelector('#mkOverlay.on');
  const b = await blend(page);
  assert.equal(b.hidden, false);
  assert.equal(b.label, 'Blends with');
  assert.equal(b.head, 'Blends with');
  assert.ok(b.slots.length >= 1, JSON.stringify(b));
  // as a guide made now would pick them, from your markers
  const want = await page.evaluate(() => {
    const c = SF.blendFor('Ohuhu|R28');
    return [c.light, c.dark].filter(Boolean).map((m) => m.mkey);
  });
  assert.deepEqual(
    b.slots.map((s) => s.k),
    want,
  );
  for (const s of b.slots) {
    const own = await page.evaluate((k) => state.owned.has(k), s.k);
    assert.equal(s.word, own ? 'you have it' : 'not yours');
    assert.match(s.aria, /^(Lighter|Darker): Ohuhu \S+ .+, (you have it|not yours|dry)$/);
  }
  // tapped: that marker's details, in the same sheet, with the focus on its code and a way back
  const to = b.slots[0];
  await page.click('#mkBlend .mkbl >> nth=0');
  await idle(page);
  assert.equal(await page.evaluate(() => mkOpenIdx), to.i);
  assert.match(await page.textContent('#mkCode'), new RegExp(to.code + '$'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mkCode');
  const b2 = await blend(page);
  assert.equal(b2.head, '← Back to Ohuhu R28');
  await page.click('#mkBlend .mkblback');
  await idle(page);
  assert.equal(await page.evaluate(() => mkey(mkOpenIdx)), 'Ohuhu|R28');
  assert.equal((await blend(page)).head, 'Blends with', 'one level back: the heading again');
  // closed and opened again: no way back
  await page.click('#mkClose');
  await openSheet(page, 'Ohuhu|R27');
  assert.equal((await blend(page)).head, 'Blends with');
  // a Colorless Blender has none
  await openSheet(page, 'Ohuhu|0');
  assert.equal((await blend(page)).hidden, true);
  assert.deepEqual(errors, []);
});

test('Blends with: another brand’s named with its brand; a dry one says so; with nothing owned, “not yours”', async () => {
  const { page, errors } = await markers();
  // a Copic marker's companions from your Ohuhu markers
  await openSheet(page, 'Copic|E00');
  const b = await blend(page);
  assert.ok(b.slots.length, JSON.stringify(b));
  for (const s of b.slots) {
    const br = s.k.split('|')[0];
    if (br !== 'Copic') assert.ok(s.code.startsWith(br + ' '), 'the brand shown: ' + s.code);
    else assert.ok(!/^Copic /.test(s.code));
  }
  // a companion of yours marked dry: no longer one you have. Owning only R28 and R210 (its darker), with R210 dry the
  // darker is still R210, to buy again: "dry"
  await openSheet(page, 'Ohuhu|R28');
  await page.evaluate(() => {
    state.owned = new Set(['Ohuhu|R28', 'Ohuhu|R210']);
    mkFill(mkOpenIdx);
  });
  const s0 = (await blend(page)).slots.find((s) => s.k === 'Ohuhu|R210');
  assert.equal(s0 && s0.word, 'you have it');
  await page.evaluate(() => {
    state.ink['Ohuhu|R210'] = 'dry';
    mkFill(mkOpenIdx);
  });
  const s1 = (await blend(page)).slots.find((s) => s.k === 'Ohuhu|R210');
  assert.equal(s1 && s1.word, 'dry');
  assert.match(s1.aria, /^Darker: Ohuhu R210 .+, dry$/);
  // nothing owned: the catalogue's, none of them yours
  await page.evaluate(() => {
    state.owned = new Set();
    mkFill(mkOpenIdx);
  });
  const b3 = await blend(page);
  assert.ok(b3.slots.length);
  assert.ok(
    b3.slots.every((s) => s.word === 'not yours'),
    JSON.stringify(b3.slots),
  );
  assert.deepEqual(errors, []);
});

test('Blends with: with an older guide open, its collection and rule are left as they were', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  const was = await page.evaluate(() => {
    __mstest.styleVars.famRule = 2;
    return { n: __mstest.coll.length, rule: __mstest.styleVars.famRule };
  });
  // (the sheet over the guide: what matters is the guide module's state)
  await openSheet(page, 'Ohuhu|R28');
  await page.waitForSelector('#mkOverlay.on');
  const b = await blend(page);
  assert.ok(b.slots.length);
  // the rule a guide made now uses (4), not the open guide's (2)
  const r4 = await page.evaluate(() => {
    const t = __mstest,
      c0 = t.coll;
    t.coll = sfCollection();
    t.styleVars.famRule = 4;
    const i = keyIdx('Ohuhu|R28'),
      c = t.colour.companions({
        mkey: 'Ohuhu|R28',
        code: 'R28',
        brand: 'Ohuhu',
        hex: COLORS[i].hex,
        lab: LAB[i],
        fam: COLORS[i].fam,
      });
    t.coll = c0;
    t.styleVars.famRule = 2;
    return [c.light, c.dark].filter(Boolean).map((m) => m.mkey);
  });
  assert.deepEqual(
    b.slots.map((s) => s.k),
    r4,
  );
  assert.deepEqual(
    await page.evaluate(() => ({ n: __mstest.coll.length, rule: __mstest.styleVars.famRule })),
    was,
  );
  assert.deepEqual(errors, []);
});

test('Blends with: at 320 wide and the largest text, nothing runs off the sheet', async () => {
  const { page, errors } = await openAtScale(1.6, { width: 320, height: 568 });
  await welcome(page, 'look');
  await idle(page);
  await page.click('#mCollection');
  await idle(page);
  await openSheet(page, 'Copic|E00');
  await page.waitForSelector('#mkOverlay.on');
  await page.evaluate(() => document.getElementById('mkBlend').scrollIntoView());
  const fit = await page.evaluate(() => {
    const card = document.querySelector('#mkOverlay .mkcard'),
      r = card.getBoundingClientRect(),
      out = [...card.querySelectorAll('#mkBlend .mkbl, #mkBlend .mkbl *')].filter((e) => {
        const q = e.getBoundingClientRect();
        return q.width && (q.left < r.left - 0.5 || q.right > r.right + 0.5);
      });
    return {
      sideways: card.scrollWidth - card.clientWidth,
      page: document.documentElement.scrollWidth - innerWidth,
      out: out.length,
      h: [...card.querySelectorAll('#mkBlend .mkbl')].map((b) =>
        Math.round(b.getBoundingClientRect().height),
      ),
    };
  });
  assert.ok(fit.sideways <= 0, 'no sideways scroll in the sheet: ' + JSON.stringify(fit));
  assert.ok(fit.page <= 0, 'nor on the page');
  assert.equal(fit.out, 0, 'every slot within the sheet');
  assert.ok(
    fit.h.every((h) => h >= 44),
    'a tap target each: ' + fit.h,
  );
  assert.deepEqual(errors, []);
});

// ---- Tester questions ----

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
  'Other brands',
  'Colour most',
];
const formOf = (n) =>
  'https://docs.google.com/forms/d/e/1FAIpQLSdTEST/viewform?usp=pp_url&' +
  Array.from({ length: n }, (_, i) => 'entry.' + (1000 + i) + '=x').join('&');
const STUBS = `window.__copied = []; window.__shared = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } });
  navigator.share = (o) => { window.__shared.push(o); return Promise.resolve(); };`;
function catchPosts(page) {
  const posts = [];
  return page
    .route(/docs\.google\.com\/forms\/d\/e\/1FAIpQLSdTEST\/formResponse/, (r) => {
      const q = new URLSearchParams(r.request().postData() || ''),
        o = { n: [...q.keys()].length };
      FIELDS.forEach((f, i) => (o[f] = q.get('entry.' + (1000 + i))));
      posts.push(o);
      return r.fulfill({ status: 200, body: 'ok' });
    })
    .then(() => posts);
}
async function tasks(n) {
  const a = await openApp({
    width: 820,
    height: 1180,
    init: `window.__MS_RESULTS_FORM = ${JSON.stringify(n ? formOf(n) : '')};` + STUBS,
  });
  a.warns = [];
  a.page.on('console', (m) => {
    if (m.type() === 'warning' && /RESULTS_FORM/.test(m.text())) a.warns.push(m.text());
  });
  await welcome(a.page, 'look');
  await idle(a.page);
  a.posts = n ? await catchPosts(a.page) : [];
  await a.page.click('#homeTasks');
  await idle(a.page);
  return a;
}
async function answer(page) {
  await page.click('.ttrow[data-k="add"] [data-r="easy"]');
  await page.fill('[data-q="brands"]', 'Copic, Spectrum Noir');
  await page.fill('[data-q="subjects"]', 'People and flowers');
}

test('Tester questions: the colours question asks which markers; two new ones, kept and copied', async () => {
  const { page, errors } = await tasks(0);
  const qs = await page.evaluate(() =>
    [...document.querySelectorAll('#ttQs .ttql')].map((e) => e.textContent),
  );
  assert.deepEqual(qs, [
    'What confused you most?',
    'What would you change first?',
    'Did the colours on paper match the screen well enough? Which markers looked most different?',
    'Which other marker brands do you use?',
    'What do you colour most (people, animals, flowers, patterns…)?',
    'Would you use it for your next page?',
  ]);
  await answer(page);
  await page.click('#ttCopy');
  await idle(page);
  const t = await page.evaluate(() => window.__copied.pop());
  assert.match(t, /\nOther brands: Copic, Spectrum Noir\nColour most: People and flowers$/);
  // kept through a reload
  await page.keyboard.press('Escape');
  await idle(page);
  await page.waitForFunction(() => !(history.state && history.state.msLayer));
  await page.reload();
  await idle(page);
  await page.click('#homeTasks');
  assert.equal(await page.inputValue('[data-q="brands"]'), 'Copic, Spectrum Noir');
  assert.equal(await page.inputValue('[data-q="subjects"]'), 'People and flowers');
  assert.deepEqual(errors, []);
});

test('Tester questions: to v318.25’s form (27 fields) the new answers go in Message; to the new one (29), their own', async () => {
  for (const n of [27, 29]) {
    const { page, errors, posts, warns, ctx } = await tasks(n);
    await answer(page);
    await page.click('#ttSend');
    await page.waitForFunction(() => /^Sent/.test(document.getElementById('ttSaid').textContent));
    assert.equal(posts.length, 1);
    const p = posts[0];
    assert.equal(p.n, n, 'one entry per field the form has');
    assert.equal(p.Kind, 'Results');
    assert.equal(p['1 Add your markers'], 'Easy');
    if (n === 27) {
      assert.equal(p.Message, 'Other brands: Copic, Spectrum Noir\nColour most: People and flowers');
      assert.equal(p['Other brands'], null);
    } else {
      assert.equal(p.Message, '');
      assert.equal(p['Other brands'], 'Copic, Spectrum Noir');
      assert.equal(p['Colour most'], 'People and flowers');
    }
    // Send feedback: its own dialog, the words in Message, nothing more
    await page.keyboard.press('Escape');
    await idle(page);
    await page.click('#homeFeedback');
    await idle(page);
    assert.ok(await page.isVisible('#fbOverlay'));
    await page.fill('#fbText', 'A note.');
    await page.click('#fbSend');
    await page.waitForFunction(() => !document.getElementById('fbOverlay').classList.contains('on'));
    assert.equal(posts.length, 2);
    assert.equal(posts[1].Kind, 'Feedback');
    assert.match(posts[1].Message, /^A note\./);
    assert.doesNotMatch(posts[1].Message, /Other brands/);
    assert.deepEqual(warns, []);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Tester questions: a form link of another length is passed over (the share sheet), said once in the console', async () => {
  const { page, errors, posts, warns } = await tasks(28);
  await answer(page);
  // the sheet redraws (formTarget asked each time): one warning
  await page.click('.ttrow[data-k="add"] [data-r="ok"]');
  await page.click('#ttSend');
  await idle(page);
  assert.equal(posts.length, 0);
  assert.equal(await page.evaluate(() => window.__shared.length), 1, 'the share sheet');
  assert.equal(warns.length, 1, JSON.stringify(warns));
  assert.match(warns[0], /RESULTS_FORM has 28 fields; this version sends 27 or 29/);
  assert.deepEqual(errors, []);
});

// ---- Skin tones in Change colour ----

const bigSection = (page) =>
  page.evaluate(() => {
    const t = __mstest,
      c = document.getElementById('sfCanvas'),
      r = c.getBoundingClientRect();
    return t.assignData.order.find((l) => {
      const q = t.labelPos(l),
        y = r.top + (q.y / c.height) * r.height,
        x = r.left + (q.x / c.width) * r.width;
      return y > r.top + 40 && y < r.bottom - 80 && x > r.left + 20 && x < r.right - 20;
    });
  });
async function changeColour(page) {
  const l = await bigSection(page);
  await scrollTop(page);
  const p = await sectionPoint(page, l);
  await page.mouse.click(p.x, p.y);
  await idle(page);
  await page.click('.sftip [data-a="change"]');
  await page.waitForSelector('#sfSheet', { state: 'visible' });
}
const rows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('#sfPopSw .sfswrec')].map((g) => ({
      h: g.querySelector('.sfswh').textContent,
      ks: [...g.querySelectorAll('.sfsw')].map((b) => b.dataset.k),
    })),
  );

test('Change colour: a Skin tones row after the shortcuts, with 3 or more of them; not with fewer', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await sampleGuide(page);
  await idle(page);
  await changeColour(page);
  const r = await rows(page),
    sk = r.find((x) => x.h === 'Skin tones');
  assert.ok(sk, JSON.stringify(r.map((x) => x.h)));
  assert.equal(r[r.length - 1].h, 'Skin tones', 'after Closest, In this guide and Recently used');
  // the skin tones you have here, lightest first
  const want = await page.evaluate(() => {
    const here = new Set(__mstest.coll.map((m) => m.mkey));
    return skinIdx()
      .map((i) => mkey(i))
      .filter((k) => here.has(k));
  });
  assert.ok(want.length >= 3);
  assert.deepEqual(sk.ks, want);
  // hidden while a code is typed in the filter, as the other shortcut rows are
  await page.fill('#sfPopFilter', 'YR');
  assert.equal(
    await page.evaluate(() => [...document.querySelectorAll('#sfPopSw .sfswrec')].every((g) => g.hidden)),
    true,
  );
  await page.click('#sfPopCancel');
  await idle(page);
  // two skin tones left in the guide's markers: no row
  await page.evaluate(() => {
    const sk = new Set(skinIdx().map((i) => mkey(i)));
    let n = 0;
    __mstest.coll = __mstest.coll.filter((m) => !sk.has(m.mkey) || n++ < 2);
  });
  await changeColour(page);
  assert.ok(!(await rows(page)).some((x) => x.h === 'Skin tones'));
  assert.deepEqual(errors, []);
});
