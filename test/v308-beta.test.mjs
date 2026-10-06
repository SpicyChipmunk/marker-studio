// v308 (beta branch): Send feedback's report, the errors kept for Copy details and Copy diagnostics, the device in
// words (an iPad asking for desktop websites included), Delete all my data, the service worker's one copy of the page,
// the release workflow and .nojekyll, the version in package.json, icon credits, and the tester guide's facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { createApp, memoryStorage } from './harness.mjs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');
const html = read('index.html');
const appVer = html.match(/id="appVer"[^>]*>(v\d+(?:\.\d+)?)</)[1];

// a document whose #appVer says the version; everything else is a do-nothing stub, as in the harness
function makeStub() {
  let s;
  s = new Proxy(function () {}, {
    get: (t, k) => {
      if (k === 'then' || k === Symbol.iterator) return undefined;
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'length') return 0;
      return s;
    },
    apply: () => s,
    construct: () => s,
    set: () => true,
    has: () => true,
  });
  return s;
}
const stub = makeStub();
const doc = new Proxy(
  {},
  {
    get: (t, k) =>
      k === 'getElementById' ? (id) => (id === 'appVer' ? { textContent: appVer } : stub) : stub,
  },
);
// Storage with key() and length, as a browser's
function storage(init = {}) {
  const s = memoryStorage(init);
  s.key = (i) => [...s._map.keys()][i] ?? null;
  Object.defineProperty(s, 'length', { get: () => s._map.size });
  return s;
}
const IPAD_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
function app(o = {}) {
  return createApp({
    localStorage: o.localStorage || storage(),
    document: doc,
    navigator: { userAgent: IPAD_DESKTOP, maxTouchPoints: 5, standalone: true, ...(o.navigator || {}) },
    screen: { width: 820, height: 1180 },
    innerWidth: 820,
    innerHeight: 1100,
    devicePixelRatio: 2,
    ...(o.extra || {}),
  });
}

test('the device in words: an iPad asking for desktop websites is named an iPad (by its touch points)', () => {
  const dw = app().__eval('deviceWords');
  assert.equal(dw(IPAD_DESKTOP, 5), 'iPad (shown to websites as a Mac), Safari 18.1');
  assert.equal(dw(IPAD_DESKTOP, 0), 'Mac, Safari 18.1');
  assert.equal(
    dw(
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      5,
    ),
    'iPad (iPadOS 17.4), Safari 17.4',
  );
  assert.equal(
    dw(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
      5,
    ),
    'iPhone (iOS 18.0), Chrome',
  );
  assert.equal(
    dw(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
      5,
    ),
    'Android 14 phone, Chrome 129',
  );
  assert.equal(
    dw(
      'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      10,
    ),
    'Android 13 tablet, Chrome 128',
  );
  assert.equal(
    dw(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
      0,
    ),
    'Windows, Edge',
  );
  assert.equal(dw('', 0), 'Unknown device');
});

test('caught errors are kept, the last 10, across a reload; Copy details has the device, screen and Home Screen', () => {
  const ls = storage();
  const a = app({ localStorage: ls });
  for (let i = 0; i < 12; i++) a.__eval(`errLog('Opening a guide', new Error('broke ${i}'))`);
  assert.equal(JSON.parse(ls.getItem('ms-errors')).length, 10);
  // a new visit sees them
  const b = app({ localStorage: ls });
  const d = b.__eval('errDetails()');
  assert.ok(d.startsWith(`Marker Studio ${appVer} · Beta\n`), d.slice(0, 60));
  assert.match(d, /\nDevice: iPad \(shown to websites as a Mac\), Safari 18\.1\n/);
  assert.match(d, /\nHome Screen app: yes\n/);
  assert.match(d, /\nScreen: 820×1180, window 820×1100, 2× pixels, touch points 5\n/);
  assert.match(d, /\nSaved here: \d+ markers, 0 guides, 0 palettes\n/);
  assert.ok(d.includes('Browser: ' + IPAD_DESKTOP));
  assert.ok(!d.includes('broke 1\n') && d.includes('broke 2') && d.includes('broke 11'), 'the last ten');
  assert.match(d, /· Opening a guide\nbroke 11\nError: broke 11/, 'where, what and its stack');
  // an error the net catches is kept too, after the caught ones
  b.__eval(`errReport('x is not a function', 'http://127.0.0.1/', 12, 3, '')`);
  assert.match(b.__eval('errDetails()'), /x is not a function\nSource: http:\/\/127\.0\.0\.1\/:12:3$/);
  // a Home Screen app or not
  assert.match(app({ navigator: { standalone: false } }).__eval('errDetails()'), /\nHome Screen app: no\n/);
});

test('storage that can’t be written: errors are kept for this visit', () => {
  const ls = storage();
  ls.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  const a = app({ localStorage: ls });
  a.__eval(`errLog('Saving the image', 'it couldn’t be encoded')`);
  assert.match(a.__eval('errDetails()'), /Saving the image\nit couldn’t be encoded/);
});

test('a caught error’s message gets Copy details and Send feedback; the raw error isn’t shown', () => {
  const a = app();
  const m = a.__eval(
    `errNote('Couldn’t open that guide.', 'Opening a guide', new TypeError("null is not an object (evaluating 'd.x')"))`,
  );
  assert.ok(m.startsWith('Couldn’t open that guide. <span class="errbtns">'), m);
  assert.match(m, /data-errcopy>Copy details<\/button>/);
  assert.match(m, /data-feedback>Send feedback<\/button>/);
  assert.ok(!m.includes('null is not'));
  assert.match(a.__eval('errDetails()'), /null is not an object/);
  // the shipped code routes these through it (no raw message any more)
  assert.ok(!/Couldn’t open that guide: '/.test(html) && !/Couldn’t process that photo: '/.test(html));
  assert.equal(
    (html.match(/errNote\('Couldn’t open that guide\.', 'Opening a guide', err\)/g) || []).length,
    2,
  );
  for (const w of [
    'Processing a photo',
    'Making the PDF',
    'Saving the image',
    'Reveal’s picture',
    'Restoring a backup',
    'Backing up',
    'Resuming',
  ])
    assert.ok(html.includes(`'${w}'`), w);
  assert.match(html, /errLog\('Worker', w\.k \+ ' job gave no answer in '/);
});

test('Send feedback’s report: version, device, Home Screen, screen, counts and the last errors, short', () => {
  const ls = storage({
    'ohuhu-hb320-picker-v3': JSON.stringify({
      mode: 'home',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: ['Ohuhu|R014', 'Ohuhu|Y111', 'Copic|B00'],
      saved: [
        { id: 1, type: 'guide', name: 'A', ts: 1, keys: [] },
        { id: 2, type: 'palette', name: 'P', ts: 1, keys: ['Ohuhu|R014'] },
      ],
    }),
  });
  const a = app({ localStorage: ls });
  for (let i = 0; i < 5; i++) a.__eval(`errLog('Opening a guide', new Error('${'long '.repeat(80)}${i}'))`);
  const r = a.__eval('feedbackReport()');
  assert.ok(r.startsWith('What happened, or what would you like? (A screenshot helps.)\n'));
  for (const s of [
    `Marker Studio ${appVer} · Beta`,
    'Device: iPad (shown to websites as a Mac), Safari 18.1',
    'Home Screen app: yes',
    'Screen: 820×1180',
    'Saved here: 3 markers, 1 guide, 1 palette',
    'Last errors:',
  ])
    assert.ok(r.includes(s), s);
  assert.equal(
    (r.match(/^- \d{4}-\d\d-\d\d \d\d:\d\d · Opening a guide: /gm) || []).length,
    3,
    'the last three',
  );
  assert.ok(r.length < 2000, String(r.length));
  assert.match(app().__eval('feedbackReport()'), /No errors recorded\.$/);
  // one constant switches it to an email
  assert.match(html, /const FEEDBACK_EMAIL = '';/);
  assert.match(
    html,
    /if \(FEEDBACK_EMAIL\) \{\n\s+location\.href = feedbackMailto\(FEEDBACK_EMAIL, subj, text\);/,
  );
  const m = a.__eval(
    `feedbackMailto('beta@example.com', 'Marker Studio v308 · Beta feedback', feedbackReport())`,
  );
  assert.ok(
    m.startsWith(
      'mailto:beta@example.com?subject=Marker%20Studio%20v308%20%C2%B7%20Beta%20feedback&body=What%20happened',
    ),
    m.slice(0, 120),
  );
  assert.equal(decodeURIComponent(m.split('&body=')[1]), r);
});

test('Send feedback: the share sheet with the report, or the clipboard without one', async () => {
  let shared = null;
  const a = app({ navigator: { share: (o) => ((shared = o), Promise.resolve()) } });
  assert.equal(await a.__eval('sendFeedback()'), 'share');
  assert.equal(shared.title, `Marker Studio ${appVer} · Beta feedback`);
  assert.equal(shared.text, a.__eval('feedbackReport()'));
  // closed without sending: nothing else happens
  const c = app({
    navigator: { share: () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })) },
  });
  assert.equal(await c.__eval('sendFeedback()'), 'cancel');
  // no share sheet (or it fails): copied
  let copied = null;
  const clip = { writeText: (t) => ((copied = t), Promise.resolve()) };
  const b = app({ navigator: { clipboard: clip } });
  assert.equal(await b.__eval('sendFeedback()'), 'copy');
  assert.equal(copied, b.__eval('feedbackReport()'));
  const f = app({
    navigator: { clipboard: clip, share: () => Promise.reject(new Error('NotAllowedError')) },
  });
  assert.equal(await f.__eval('sendFeedback()'), 'copy');
});

test('Delete all my data: only this app’s keys go (other sites at the same address keep theirs), and its database', async () => {
  const ls = storage({
    'ms-onboarded': '1',
    'ms-errors': '[]',
    'ohuhu-hb320-picker-v3': '{}',
    'ohuhu-hb320-picker-v2': '{}',
    'other-site': 'keep',
    'msx': 'keep',
  });
  let deleted = null;
  const a = app({
    localStorage: ls,
    extra: {
      indexedDB: {
        deleteDatabase: (n) => {
          deleted = n;
          const r = {};
          setImmediate(() => r.onsuccess && r.onsuccess());
          return r;
        },
        open: () => stub,
      },
    },
  });
  assert.ok((await a.__eval('wipeAllData()')) >= 4);
  assert.deepEqual([...ls._map.keys()].sort(), ['msx', 'other-site']);
  assert.equal(deleted, 'ms-guides');
  assert.throws(
    () => a.__eval(`indexedDB.open('ms-guides', 1)`),
    /deleted/,
    'nothing makes it again before the reload',
  );
});

test('service worker: the page is fetched and kept once (as index.html), and every load of it comes from that copy', async () => {
  const ORIGIN = 'https://ms.test/marker-studio/';
  const stores = new Map(),
    fetched = [],
    handlers = {};
  const key = (u) => new URL(typeof u === 'string' ? u : u.url, ORIGIN).href;
  const res = (b) => ({
    ok: true,
    body: b,
    clone() {
      return this;
    },
  });
  const cache = (n) => {
    if (!stores.has(n)) stores.set(n, new Map());
    const m = stores.get(n);
    return {
      match: async (r, o) => {
        const u = new URL(key(r));
        for (const [k, v] of m) {
          const c = new URL(k);
          if (o && o.ignoreSearch ? c.origin + c.pathname === u.origin + u.pathname : k === u.href) return v;
        }
      },
      put: async (r, x) => void m.set(key(r), x),
      add: async (u) => void (fetched.push(key(u)), m.set(key(u), res('file ' + key(u)))),
      addAll: async (l) =>
        l.forEach(
          (u) => (fetched.push(key(u.url || u)), m.set(key(u.url || u), res('file ' + key(u.url || u)))),
        ),
    };
  };
  const ctx = {
    online: true,
    URL,
    Promise,
    Request: function (u) {
      return { url: key(u), method: 'GET', mode: 'cors' };
    },
    caches: {
      open: async (n) => cache(n),
      keys: async () => [...stores.keys()],
      delete: async (n) => stores.delete(n),
      match: async (r, o) => {
        for (const n of stores.keys()) {
          const hit = await cache(n).match(r, o);
          if (hit) return hit;
        }
      },
    },
    fetch: async (r) => {
      fetched.push(key(r));
      if (!ctx.online) throw new TypeError('offline');
      return res('net ' + key(r));
    },
  };
  ctx.self = {
    location: { href: ORIGIN + 'service-worker.js' },
    addEventListener: (t, f) => (handlers[t] = f),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  vm.createContext(ctx);
  vm.runInContext(read('service-worker.js'), ctx);
  const life = async (t) => {
    let p;
    handlers[t]({ waitUntil: (x) => (p = x) });
    await p;
  };
  const get = async (path, mode = 'navigate') => {
    let p;
    handlers.fetch({ request: { url: ORIGIN + path, method: 'GET', mode }, respondWith: (x) => (p = x) });
    const r = await p;
    await new Promise((s) => setTimeout(s, 0));
    return r && r.body;
  };
  await life('install');
  await life('activate');
  const pages = fetched.filter((u) => /marker-studio\/(index\.html)?$/.test(u));
  assert.deepEqual(pages, [ORIGIN + 'index.html'], 'the page downloaded once');
  const stored = () => [...stores.values()].flatMap((m) => [...m.keys()]);
  assert.ok(!stored().includes(ORIGIN) && stored().includes(ORIGIN + 'index.html'));
  fetched.length = 0;
  for (const p of ['', 'index.html', '?back=1', 'index.html?from=home'])
    assert.equal(await get(p), 'file ' + ORIGIN + 'index.html', p || './');
  assert.deepEqual(fetched, [], 'no network');
  // another page in the folder (a doc) still comes from the network, and offline the app answers
  assert.equal(await get('docs/TESTERS.md'), 'net ' + ORIGIN + 'docs/TESTERS.md');
  ctx.online = false;
  assert.equal(await get('docs/RELEASING.md'), 'file ' + ORIGIN + 'index.html');
  // the cached page gone (storage cleared): fetched, and kept once more as index.html
  ctx.online = true;
  stores.clear();
  assert.equal(await get('?back=1'), 'net ' + ORIGIN + '?back=1');
  assert.deepEqual(stored(), [], 'not a page with a query');
  assert.equal(await get(''), 'net ' + ORIGIN);
  assert.deepEqual(stored(), [ORIGIN + 'index.html']);
});

test('the version in package.json is the app’s (v307.1 → 307.1.0)', () => {
  const m = appVer.match(/^v(\d+)(?:\.(\d+))?$/);
  const want = `${m[1]}.${m[2] || 0}.0`;
  assert.equal(JSON.parse(read('package.json')).version, want);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, want);
  assert.equal(lock.packages[''].version, want);
  assert.ok(!/phone-first/i.test(read('package.json')));
});

test('releasing: Pages from a release branch that only takes a commit whose tests passed; .nojekyll', () => {
  assert.ok(existsSync(new URL('.nojekyll', root)));
  const wf = read('.github/workflows/release.yml');
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /contents: write/);
  assert.match(wf, /actions\/workflows\/test\.yml\/runs\?head_sha=\$SHA/);
  assert.match(wf, /if \[ "\$result" != "success" \]; then[\s\S]*exit 1/);
  assert.match(wf, /node scripts\/build\.mjs --check/);
  assert.match(wf, /merge-base --is-ancestor origin\/release "\$SHA"/);
  assert.match(wf, /git push --force origin "\$SHA:refs\/heads\/release"/);
  assert.match(read('.github/workflows/test.yml'), /push:\n\s+branches-ignore: \[release\]/);
  const doc = read('docs/RELEASING.md');
  for (const s of [
    'Settings › Pages',
    'Deploy from a branch',
    '`release`, folder `/ (root)`',
    'Actions › release › Run workflow',
    'Roll back',
    '.nojekyll',
  ])
    assert.ok(doc.includes(s), s);
});

test('README: for users first, the CI as it runs (8 WebKit parts), nothing out of date; DEVICE-TEST is internal', () => {
  const r = read('README.md');
  const top = r.slice(0, r.indexOf('## Working on it'));
  for (const s of [
    'https://spicychipmunk.github.io/marker-studio/',
    'docs/TESTERS.md',
    'Send feedback',
    "isn't affiliated with or endorsed by Ohuhu or Copic",
  ])
    assert.ok(top.includes(s), s);
  assert.ok(!/phone-first|graduating|3 parts|6 parts|the few\s/i.test(r));
  assert.match(r, /WebKit \(Safari's engine\), in 8 parts/);
  assert.match(r, /Chromium in 2 parts/);
  const wf = read('.github/workflows/test.yml');
  assert.match(wf, /part: \[1, 2, 3, 4, 5, 6, 7, 8\]/, 'the README matches the workflow');
  assert.match(read('docs/DEVICE-TEST.md'), /^# [^\n]*\n\n> \*\*Internal\.\*\*/);
});

test('icon credits: the 32 Lucide icons by name, the notices in index.html, no "four icons" anywhere', () => {
  const syms = [...read('src/html/icons.html').matchAll(/<symbol id="i-([^"]+)"/g)].map((m) => m[1]);
  const lucide = syms.filter((s) => s !== 'codes' && s !== 'values');
  assert.equal(lucide.length, 32);
  const lic = read('src/assets/icons/LICENSE-Lucide-Feather.txt');
  const listed = lic
    .slice(0, lic.indexOf('licences:'))
    .match(/They are: ([^.]+)\./)[1]
    .replace(/\s+/g, ' ')
    .split(/, (?:and )?| and /);
  assert.deepEqual(listed.sort(), lucide.sort());
  assert.match(lic, /^32 of the line icons/);
  for (const f of ['LICENSE', 'README.md', 'index.html', 'src/assets/icons/LICENSE-Lucide-Feather.txt'])
    assert.ok(!/four (line )?icons|the few (lucide|icons)/i.test(read(f)), f);
  const head = html.slice(0, html.indexOf('<meta name="viewport"'));
  assert.match(head, /32 line icons from Lucide/);
  assert.match(
    head,
    /ISC License\. Copyright \(c\) 2026 Lucide Icons and Contributors\. Permission to use, copy/,
  );
  assert.match(head, /The MIT License \(MIT\)\. Copyright \(c\) 2013-present Cole Bemis\. Permission is/);
  assert.match(head, /Not affiliated with or endorsed\nby Ohuhu or Copic/);
});

test('the tester guide (docs and Help): its Ohuhu and Copic ranges are the app’s own, and it says what testers need', () => {
  const a = app();
  const C = a.__match.COLORS;
  const oh = C.filter((c) => c.brand === 'Ohuhu').length,
    co = C.filter((c) => c.brand === 'Copic').length;
  // every Ohuhu colour is in one of the sets named
  const sets = a.__eval('MARKER_SETS').filter((s) => s.b === 'Ohuhu');
  const OS = a.__eval('OHUHU_SETS');
  const all = new Set(sets.flatMap((s) => OS[s.oh].split(' ')));
  assert.ok(all.size > 300 && all.size < oh, 'the sets named hold most of them, not all');
  const names = sets.map((s) => s.n);
  assert.ok(names.includes('Honolulu 24') && names.includes('Honolulu 320 (complete set)'));
  const words = ['48 Mid-tone', '104 Colors', '36 Skin Tones', '36 Gray Tones', '48 Pastel', '24 Portrait'];
  for (const w of words)
    assert.ok(
      names.some((n) => n.startsWith(w)),
      w,
    );
  const testers = read('docs/TESTERS.md');
  const inApp = html.match(/<details class="hlpsec" id="helpBeta">[\s\S]*?<\/details>/)[0];
  for (const t of [testers, inApp]) {
    assert.ok(t.includes(`${oh} markers, among them every colour in the Honolulu sets`), 'Ohuhu');
    assert.ok(t.includes(`all ${co} markers, by the codes Sketch, Ciao and Classic share`), 'Copic');
    assert.match(t, /Honolulu sets \(24 up to the complete 320\)/);
    for (const w of words) assert.ok(t.includes(w), w);
    for (const s of [
      'Add to Home Screen',
      'Back up',
      'once a week',
      'screenshot',
      'approximate',
      'Send feedback',
      'Copy details',
      'Known limits',
      'What to try',
    ])
      assert.ok(t.includes(s), s);
  }
});

test('Scatter: Polished has its line', () => {
  const d = html.match(/const GRAD_SCAT_DESC = \[([\s\S]*?)\];/)[1];
  assert.match(d, /^\s*\/\/[^\n]*\n\s*'Neat bands in flow order',\n\s*'In flow order/);
  assert.ok(!/class="sfc-note sfc-mt6"' \+\s*\(_sv \|\| _sOff/.test(html), 'shown at Polished too');
});
