// v318.23: the app's storage written as 1-byte text, the oldest thumbnails left out when it's full, smaller stored
// thumbnails, the longest waits kept for Copy diagnostics, and a guide's newer-version settings carried by its autosave.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp, memoryStorage } from './harness.mjs';

const KEY = 'ohuhu-hb320-picker-v3';
const quota = () => {
  const e = new Error('The quota has been exceeded.');
  e.name = 'QuotaExceededError';
  e.code = 22;
  return e;
};
// storage that holds at most `max` characters for the app's key, as a full browser would
function fullAt(max) {
  const ls = memoryStorage(),
    set = ls.setItem;
  ls.calls = 0;
  ls.setItem = (k, v) => {
    if (k === KEY) {
      ls.calls++;
      if (String(v).length > ls.max) throw quota();
    }
    set(k, v);
  };
  ls.max = max;
  return ls;
}
const thumb = (n) => 'data:image/jpeg;base64,' + 'A'.repeat(n);

test('narrow(): stored text is plain ASCII and reads back the same (curly quotes, Ⅱ, emoji, line separators)', () => {
  const a = createApp({ TextEncoder, TextDecoder });
  const v = { n: 'Ben’s “page” Ⅱ 🌼 café   \\ \u007f', k: ['R23*'] };
  const s = a.__eval(`narrow(${JSON.stringify(JSON.stringify(v))})`);
  assert.ok(
    [...s].every((c) => c.charCodeAt(0) < 0x7f),
    'nothing past U+007E: ' + s,
  );
  assert.deepEqual(JSON.parse(s), v);
  // without TextEncoder (an old browser): escaped all the same
  const b = createApp();
  assert.equal(b.__eval(`narrow(${JSON.stringify(JSON.stringify(v))})`), s);
});

test('save() writes the narrowed text, and remembers that as what it wrote', () => {
  const ls = memoryStorage();
  const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
  a.__eval(
    `state.saved.push({ id: 7, type: 'guide', name: 'Ziqi’s page', ts: 1, keys: [], W: 10, H: 10, n: 1, thumb: '' }); save(true)`,
  );
  const raw = ls.getItem(KEY);
  assert.ok(raw.includes('Ziqi\\u2019s page'));
  assert.ok(![...raw].some((c) => c.charCodeAt(0) > 0x7e));
  assert.equal(a.__eval('_lastRaw'), raw);
  // and it opens as it was
  const b = createApp({ localStorage: ls, TextEncoder, TextDecoder });
  assert.equal(b.__eval('state.saved.find((s) => s.id === 7).name'), 'Ziqi’s page');
});

test('storage full: the oldest thumbnails go first, as few as fit, and nothing else changes', () => {
  const ls = memoryStorage();
  const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
  a.__eval(
    `for (let i = 1; i <= 6; i++) state.saved.push({ id: i, type: 'guide', name: 'g' + i, ts: 1000 * (7 - i), keys: [], W: 10, H: 10, n: 1, thumb: ${JSON.stringify(thumb(3000))} }); save(true)`,
  );
  const full = ls.getItem(KEY).length;
  // room for everything but ~one thumbnail
  const f = fullAt(full - 1000);
  for (const [k, v] of ls._map) f._map.set(k, v);
  const b = createApp({ localStorage: f, TextEncoder, TextDecoder });
  const before = JSON.parse(b.__eval('JSON.stringify(state.saved)'));
  assert.equal(b.__eval('save(true)'), true);
  const after = JSON.parse(b.__eval('JSON.stringify(state.saved)'));
  const gone = after.filter((s) => !s.thumb).map((s) => s.id);
  // the oldest saved (id 6: ts 1000) only
  assert.deepEqual(gone, [6]);
  assert.deepEqual(
    after.map((s) => ({ ...s, thumb: '' })),
    before.map((s) => ({ ...s, thumb: '' })),
    'every other field as it was',
  );
  assert.equal(JSON.parse(f.getItem(KEY)).saved.find((s) => s.id === 6).thumb, '');
});

test('storage full whatever is left out: the thumbnails are put back, it fails as before, and isn’t tried again until a save works', () => {
  const ls = memoryStorage();
  const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
  a.__eval(
    `for (let i = 1; i <= 5; i++) state.saved.push({ id: i, type: 'guide', name: 'g' + i, ts: i, keys: [], W: 10, H: 10, n: 1, thumb: ${JSON.stringify(thumb(2000))} }); save(true)`,
  );
  const f = fullAt(100);
  for (const [k, v] of ls._map) f._map.set(k, v);
  const stored = f.getItem(KEY);
  const b = createApp({ localStorage: f, TextEncoder, TextDecoder });
  f.calls = 0;
  assert.equal(b.__eval('save(true)'), false);
  const first = f.calls;
  assert.ok(first > 1 && first <= 5, 'one try, then growing batches: ' + first);
  assert.equal(b.__eval('state.saved.filter((s) => s.thumb).length'), 5, 'all put back');
  assert.equal(f.getItem(KEY), stored, 'the stored copy untouched');
  f.calls = 0;
  assert.equal(b.__eval('save(true)'), false);
  assert.equal(f.calls, 1, 'no batches the second time');
  // room again: saves, and the next full store tries the thumbnails again
  f.max = 1e9;
  assert.equal(b.__eval('save(true)'), true);
  f.max = 100;
  f.calls = 0;
  b.__eval('save(true)');
  assert.ok(f.calls > 1);
});

test('storage full: a redrawn thumbnail being stored never pushes another out (noDrop); another error isn’t taken for full', () => {
  const ls = memoryStorage();
  const a = createApp({ localStorage: ls, TextEncoder, TextDecoder });
  a.__eval(
    `for (let i = 1; i <= 3; i++) state.saved.push({ id: i, type: 'guide', name: 'g' + i, ts: i, keys: [], W: 10, H: 10, n: 1, thumb: ${JSON.stringify(thumb(2000))} }); save(true)`,
  );
  const f = fullAt(1e9);
  for (const [k, v] of ls._map) f._map.set(k, v);
  const b = createApp({ localStorage: f, TextEncoder, TextDecoder });
  b.__eval('save(true)');
  f.max = f.getItem(KEY).length - 10;
  f.calls = 0;
  assert.equal(b.__eval('save(true, true)'), false);
  assert.equal(f.calls, 1);
  assert.equal(b.__eval('state.saved.filter((s) => s.thumb).length'), 3);
  // an error that isn't a full store (the old fakes throw a plain Error): one try, nothing left out
  const g = memoryStorage(),
    gset = g.setItem;
  g.setItem = (k, v) => {
    if (k === KEY) throw new Error('QuotaExceededError');
    gset(k, v);
  };
  const c = createApp({ localStorage: g, TextEncoder, TextDecoder });
  c.__eval(
    `state.saved.push({ id: 1, type: 'guide', name: 'g', ts: 1, keys: [], W: 10, H: 10, n: 1, thumb: 'x' })`,
  );
  assert.equal(c.__eval('save(true)'), false);
  assert.equal(c.__eval('state.saved[state.saved.length - 1].thumb'), 'x');
});

test('a stored thumbnail’s size: the long side 144 px whatever the page’s shape', () => {
  const a = createApp();
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(thumbSize(1600, 1600))')), [144, 144]);
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(thumbSize(568, 1500))')), [55, 144]);
  assert.deepEqual(JSON.parse(a.__eval('JSON.stringify(thumbSize(1600, 1236))')), [144, 111]);
});

test('the longest waits: the 8 longest of this visit, at least 50 ms, in Copy diagnostics; nothing said when there are none', () => {
  const a = createApp();
  const plainD = a.__eval('errDetails()');
  assert.ok(!plainD.includes('Longest waits'));
  a.__eval(
    `[30, 120, 400, 90, 51, 700, 60, 300, 250, 80, 49].forEach((ms, i) => holdAdd('step ' + i, ms, i === 5 ? '3000×4000' : ''))`,
  );
  const d = a.__eval('errDetails()');
  assert.match(
    d,
    /\nLongest waits, this visit:\nstep 5 700 ms \(3000×4000\)\nstep 2 400 ms\nstep 7 300 ms\nstep 8 250 ms\nstep 1 120 ms\nstep 3 90 ms\nstep 9 80 ms\nstep 6 60 ms$/,
  );
  // holdTime times a piece of work and hands back what it returns
  assert.equal(a.__eval(`holdTime('x', () => 42)`), 42);
});

// ---- a guide's newer-version settings ----
const core = () => createApp().__mstest;

test('plCarry: a newer version’s keys at the top, in style and in style.shade are kept; this version’s own are its own', () => {
  const t = core();
  const prev = {
    lmap: 'L',
    assign: { 1: 'a' },
    prog: [1],
    zzTop: { a: 1 },
    style: { family: 'x', zzStyle: 2, shade: { mode: 'on', zzShade: 3 } },
  };
  const pl = { lmap: 'L', assign: { 1: 'b' }, prog: [1, 2], style: { family: 'y', shade: { mode: 'off' } } };
  const out = t.plCarry(prev, pl);
  assert.deepEqual(JSON.parse(JSON.stringify(out)), {
    lmap: 'L',
    assign: { 1: 'b' },
    prog: [1, 2],
    zzTop: { a: 1 },
    style: { family: 'y', zzStyle: 2, shade: { mode: 'off', zzShade: 3 } },
  });
  assert.deepEqual(
    pl,
    { lmap: 'L', assign: { 1: 'b' }, prog: [1, 2], style: { family: 'y', shade: { mode: 'off' } } },
    'the payload given isn’t changed',
  );
});

test('plCarry: a setting cleared here isn’t brought back; other sections, or nothing to carry, change nothing', () => {
  const t = core();
  // keys this version writes only when they're used: cleared here, so not in this save
  const prev = {
    lmap: 'L',
    held: { 3: 1 },
    dates: { s: 1 },
    out: { 2: 1 },
    edits: 1,
    base: { 1: 'x' },
    upk: 2,
    frame: [1],
    ref: 'r',
    paper: [1],
    zones: [{}],
    famRule: 1,
    lowX: 1,
    smp: 1,
    gradArea: 1,
    bgRule: 1,
    minPos: 3,
    style: {
      matchAlike: true,
      theme: 't',
      incl: [1],
      gradScat: 1,
      gradJit: 1,
      gradFix: 1,
      fromPal: 'p',
      photo: {},
      shade: { flat: { 1: 1 }, hilite: 'h' },
    },
  };
  const pl = { lmap: 'L', style: { shade: {} } };
  assert.equal(t.plCarry(prev, pl), pl, 'nothing to carry: the same payload');
  // other sections (Edit sections, a rebuild): nothing carried
  const pl2 = { lmap: 'M', style: {} };
  assert.equal(t.plCarry({ lmap: 'L', zz: 1, style: { zz: 1 } }, pl2), pl2);
  assert.equal(t.plCarry({ zz: 1 }, pl2), pl2, 'no section map stored: nothing');
});

test('plCarry knows every key this version writes in a payload (the literal in currentDesignObj, STYLE_FIELDS)', () => {
  const src = readFileSync(new URL('../src/js/guide/60-persist.js', import.meta.url), 'utf8');
  const at = src.indexOf('    payload: Object.assign(\n'),
    body = src.slice(at, src.indexOf('\n  };', at));
  // (the literal's own keys, 8 spaces in; the objects added to it, 6 spaces in: zones, secStates)
  const written = new Set(
    [...body.matchAll(/^ {8}(\w+):/gm)]
      .map((m) => m[1])
      .concat([...body.matchAll(/^ {6}(?! )[^\n]*?\{ (\w+): /gm)].map((m) => m[1])),
  );
  const K = core().plKnown();
  for (const k of written) assert.ok(K.top.has(k), 'payload.' + k + ' is known');
  assert.ok(
    written.has('zones') && written.has('secStates') && written.has('frame'),
    'the parse found the whole literal: ' + [...written],
  );
  // and the lists themselves: every STYLE_FIELDS key where it's written
  for (const f of core().styleFields)
    assert.ok(K[f.in === 'payload' ? 'top' : f.in].has(f.key), f.in + '.' + f.key);
  assert.ok(K.style.has('shade'));
});
