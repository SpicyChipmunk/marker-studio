// v318.34 — Markers › Random outside the browser: counts() counts every drawn marker (d) and the ones out of play
// (out); usedKeys() takes the keys of guides worked with (wk, done, tn or fn), not of built-only guides or palettes;
// guideMeta keeps the worked flag and sets it for ticks and tones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function appWith() {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval('state.owned = new Set(); state.pool = null; state.drawn = []; state.mode = "random"');
  return a;
}

test('counts(): d is every drawn marker, out the ones a filter leaves out, u and left the ones in play', () => {
  const E = appWith().__eval;
  E(`{ const own = []; for (let i = 0; i < COLORS.length && own.length < 6; i++) if (inPool(i)) own.push(i);
       state.owned = new Set(own.map(mkey)); state.drawn = [own[0], own[1], own[2]]; globalThis.__own = own; }`);
  assert.deepEqual(JSON.parse(E('JSON.stringify((() => { const c = counts(); return [c.t, c.u, c.left, c.d, c.out]; })())')), [6, 3, 3, 3, 0]);
  // the first drawn marker's family filtered out
  E('state.excluded.add(COLORS[__own[0]].fam)');
  const c = E('counts()');
  assert.equal(c.d, 3, 'still 3 drawn');
  assert.equal(c.out, c.d - c.u);
  assert.ok(c.out >= 1, 'at least the one filtered out: ' + c.out);
  assert.equal(c.left, c.t - c.u);
});

test('usedKeys(): keys of guides with wk, done, tn or fn; a built-only guide and a palette are not used', () => {
  const E = appWith().__eval;
  E(`state.saved = [
    { id: 1, type: 'guide', name: 'A', keys: ['Ohuhu|R16'], wk: 1 },
    { id: 2, type: 'guide', name: 'B', keys: ['Ohuhu|R28'], done: 1 },
    { id: 3, type: 'guide', name: 'C', keys: ['Ohuhu|R38'], tn: 2 },
    { id: 4, type: 'guide', name: 'D', keys: ['Ohuhu|R46'], fn: 1700000000000 },
    { id: 5, type: 'guide', name: 'E', keys: ['Ohuhu|R210'] },
    { id: 6, type: 'guide', name: 'F', keys: ['Ohuhu|R013'], done: 0, tn: 0 },
    { id: 7, type: 'palette', name: 'G', keys: ['Ohuhu|R05'] },
    { id: 8, type: 'draw', name: 'H', keys: ['Ohuhu|R412'] },
  ]`);
  assert.deepEqual(JSON.parse(E('JSON.stringify([...usedKeys()].sort())')), ['Ohuhu|R16', 'Ohuhu|R28', 'Ohuhu|R38', 'Ohuhu|R46']);
  assert.equal(E('state.saved = []; usedKeys().size'), 0);
});

test('guideMeta: the worked flag is kept from the row it replaces, and set by a ticked or toned section', () => {
  const E = appWith().__eval;
  const meta = (d, id) => E(`guideMeta(${JSON.stringify(d)}, ${id}).wk`);
  assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] } }, 1), undefined);
  assert.equal(meta({ name: 'x', n: 3, payload: { prog: [0] } }, 1), 1, 'a tick');
  assert.equal(meta({ name: 'x', n: 3, payload: { tones: { 0: 1 } } }, 1), 1, 'a tone');
  assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] }, wk: 1 }, 1), 1, 'given');
  // kept: the row has it, the save that follows has nothing ticked any more
  E("state.saved = [{ id: 9, type: 'guide', name: 'x', keys: [], wk: 1 }]");
  assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] } }, 9), 1, 'kept');
  assert.equal(meta({ name: 'x', n: 3, payload: { prog: [] } }, 10), undefined, 'another guide');
});

test('state: rndFresh is saved and read back, off by default', () => {
  const a = appWith();
  assert.equal(a.__eval('state.rndFresh'), 0);
  a.__eval('state.rndFresh = 1; save()');
  const raw = a.__eval('localStorage.getItem(KEY)');
  assert.equal(JSON.parse(raw).rndFresh, 1);
  const b = createApp({ localStorage: memoryStorage({ [a.__eval('KEY')]: raw }) });
  assert.equal(b.__eval('state.rndFresh'), 1);
});
