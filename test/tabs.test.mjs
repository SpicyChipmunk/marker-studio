// (v328) Two tabs saving in the same moment: each tab's save puts what it changed since it last read or wrote onto
// what the other tab wrote meanwhile (state.js crossMerge; tester.js ttMerge), instead of writing its whole copy over
// it. Two copies of the app share one storage here and hear no storage events: the race, every time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function twoTabs(setup) {
  const ls = memoryStorage(),
    a = createApp({ localStorage: ls });
  a.__eval(setup || 'state.owned = new Set(["Ohuhu|R014", "Ohuhu|Y28"]); save(true)');
  const b = createApp({ localStorage: ls }),
    K = a.__eval('KEY'),
    stored = () => JSON.parse(ls.getItem(K));
  return { a, b, ls, K, stored, E: (t, s) => JSON.parse(JSON.stringify(t.__eval(s) ?? null)) };
}

test('markers: each tab’s additions and removals kept, neither written over', () => {
  const { a, b, stored, E } = twoTabs();
  a.__eval('state.owned.add("Ohuhu|B310"); state.owned.delete("Ohuhu|Y28"); save(true)');
  // (b hasn't heard: it still has R014 and Y28)
  b.__eval('state.owned.add("Ohuhu|B015"); save(true)');
  assert.deepEqual(stored().owned.slice().sort(), ['Ohuhu|B015', 'Ohuhu|B310', 'Ohuhu|R014']);
  assert.deepEqual(E(b, '[...state.owned].sort()'), ['Ohuhu|B015', 'Ohuhu|B310', 'Ohuhu|R014']);
  // and a takes b's in its next save the same way
  a.__eval('state.owned.delete("Ohuhu|R014"); save(true)');
  assert.deepEqual(stored().owned.slice().sort(), ['Ohuhu|B015', 'Ohuhu|B310']);
});

test('ink and caps: marker by marker; To buy: entry by entry, in order', () => {
  const { a, b, stored } = twoTabs();
  a.__eval(
    'state.ink["Ohuhu|R014"] = "dry"; state.wish.push({ k: "Ohuhu|B310", why: "", ts: 1 }); save(true)',
  );
  b.__eval(
    'state.ink["Ohuhu|Y28"] = "low"; state.wish.push({ k: "Ohuhu|B015", why: "", ts: 2 }); save(true)',
  );
  const s = stored();
  assert.deepEqual(s.ink, { 'Ohuhu|R014': 'dry', 'Ohuhu|Y28': 'low' });
  assert.deepEqual(
    s.wish.map((w) => w.k),
    ['Ohuhu|B310', 'Ohuhu|B015'],
  );
  // an ink mark taken away in one tab while the other marks another
  a.__eval('delete state.ink["Ohuhu|R014"]; save(true)');
  b.__eval('state.ink["Ohuhu|B015"] = "dry"; save(true)');
  assert.deepEqual(stored().ink, { 'Ohuhu|Y28': 'low', 'Ohuhu|B015': 'dry' });
});

test('Library: a row renamed in one tab, another added in the other; one deleted here stays deleted', () => {
  const { a, b, stored } = twoTabs(
    'state.saved = [{ id: 101, type: "palette", name: "One", keys: ["Ohuhu|R014"], ts: 1000 },' +
      ' { id: 102, type: "palette", name: "Two", keys: ["Ohuhu|Y28"], ts: 1000 }]; save(true)',
  );
  a.__eval('state.saved[0].name = "One renamed"; state.saved[0].ts = 2000; save(true)');
  b.__eval(
    'state.saved.unshift({ id: 103, type: "palette", name: "Three", keys: ["Ohuhu|B015"], ts: 3000 });' +
      ' state.saved = state.saved.filter((s) => s.id !== 102); forgetSaved(102); save(true)',
  );
  const s = stored().saved;
  assert.deepEqual(
    s.map((x) => [x.id, x.name]),
    [
      [103, 'Three'],
      [101, 'One renamed'],
    ],
  );
  // both tabs changed the same row: the newer save's (a takes b's rows in first, with a save of its own)
  a.__eval('save(true)');
  a.__eval(
    'state.saved.find((s) => s.id === 103).name = "Three (a)"; state.saved.find((s) => s.id === 103).ts = 5000; save(true)',
  );
  b.__eval(
    'state.saved.find((s) => s.id === 103).name = "Three (b)"; state.saved.find((s) => s.id === 103).ts = 4000; save(true)',
  );
  assert.equal(stored().saved.find((x) => x.id === 103).name, 'Three (a)');
});

test('one tab alone saves as before; a field a newer version wrote is still kept through the merge', () => {
  const { a, b, ls, K, stored } = twoTabs();
  a.__eval('save(true)');
  const before = ls.getItem(K);
  a.__eval('save(true)');
  assert.equal(ls.getItem(K), before, 'nothing changed, nothing merged');
  const raw = stored();
  raw.zLater = { keep: 1 };
  ls.setItem(K, JSON.stringify(raw));
  b.__eval('state.owned.add("Ohuhu|B015"); save(true)');
  assert.deepEqual(stored().zLater, { keep: 1 });
  assert.ok(stored().owned.includes('Ohuhu|B015'));
});
// (the Tester answers' own merge, tester.js ttMerge, isn't in the script this harness loads: e2e along-3's "Tester
// answers given in two tabs" covers it)

test('the merge goes into this tab’s own list, Set and maps: a row held across a save is still the one in the list', () => {
  const { a, b, stored } = twoTabs(
    'state.owned = new Set(["Ohuhu|R014"]); state.saved = [{ id: 101, type: "palette", name: "One", keys: [], ts: 1000 }]; save(true)',
  );
  a.__eval('state.owned.add("Ohuhu|B310"); save(true)');
  b.__eval('globalThis.__row = state.saved[0]; globalThis.__own = state.owned; globalThis.__ink = state.ink');
  b.__eval('state.ink["Ohuhu|R014"] = "low"; save(true)');
  assert.equal(b.__eval('__row === state.saved[0] && __own === state.owned && __ink === state.ink'), true);
  // and changed after the save, as code holding it does: kept by the next save
  b.__eval('__row.name = "One (b)"; __row.ts = 2000; save(true)');
  assert.equal(stored().saved[0].name, 'One (b)');
  assert.deepEqual(stored().owned.slice().sort(), ['Ohuhu|B310', 'Ohuhu|R014']);
});

// (the browser's own way: a tab reads its own copy of storage, which takes in another tab's save only with that save's
// storage event, after what the tab is doing: so a tab can save over a save it hasn't seen. Each tab's changes are put
// back by it when it hears a save that missed them)
function staleTabs() {
  const back = new Map(),
    cache = [new Map(), new Map()],
    q = [[], []];
  const view = (i) => ({
    getItem: (k) => (cache[i].has(k) ? cache[i].get(k) : null),
    setItem: (k, v) => {
      cache[i].set(k, String(v));
      back.set(k, String(v));
      q[1 - i].push([k, String(v)]);
    },
    removeItem: (k) => {
      cache[i].delete(k);
      back.delete(k);
      q[1 - i].push([k, null]);
    },
    clear: () => {},
  });
  const tabs = [createApp({ localStorage: view(0) }), createApp({ localStorage: view(1) })];
  const hear = (i) => {
    q[i].splice(0).forEach(([k, v]) => (v == null ? cache[i].delete(k) : cache[i].set(k, v)));
    tabs[i].__eval('syncFromStorage()');
  };
  return { tabs, hear, stored: () => JSON.parse(back.get(tabs[0].__eval('KEY'))) };
}
test('each tab saving over a save it hasn’t heard yet: both tabs’ changes end up in both, and stored', () => {
  const { tabs, hear, stored } = staleTabs();
  const [a, b] = tabs;
  a.__eval(
    'state.owned = new Set(["Ohuhu|R014"]); state.ink = {}; state.wish = []; state.saved = []; save(true)',
  );
  hear(1);
  // both change something before hearing the other
  a.__eval('state.owned.add("Ohuhu|B310"); state.ink["Ohuhu|R014"] = "low"; save(true)');
  b.__eval('state.owned.add("Ohuhu|B015"); state.wish.push({ k: "Ohuhu|Y28", why: "", ts: 1 }); save(true)');
  b.__eval('state.saved.unshift({ id: 201, type: "palette", name: "B’s", keys: [], ts: 5 }); save(true)');
  // a hears b's last save (which hadn't a's): a puts its own back and saves; then b hears that
  hear(0);
  hear(1);
  hear(0);
  for (const t of [a, b]) {
    assert.deepEqual(JSON.parse(t.__eval('JSON.stringify([...state.owned].sort())')), [
      'Ohuhu|B015',
      'Ohuhu|B310',
      'Ohuhu|R014',
    ]);
    assert.equal(t.__eval('state.ink["Ohuhu|R014"]'), 'low');
    assert.equal(t.__eval('state.wish.map((w) => w.k).join()'), 'Ohuhu|Y28');
    assert.equal(t.__eval('state.saved.map((s) => s.id).join()'), '201');
  }
  assert.deepEqual(stored().owned.slice().sort(), ['Ohuhu|B015', 'Ohuhu|B310', 'Ohuhu|R014']);
  // a marker taken away in one tab, unheard by the other, which adds another: neither undone
  a.__eval('state.owned.delete("Ohuhu|B310"); save(true)');
  b.__eval('state.owned.add("Ohuhu|Y28"); save(true)');
  hear(0);
  hear(1);
  hear(0);
  assert.deepEqual(stored().owned.slice().sort(), ['Ohuhu|B015', 'Ohuhu|R014', 'Ohuhu|Y28']);
  assert.equal(a.__eval('[...state.owned].sort().join()'), b.__eval('[...state.owned].sort().join()'));
});
