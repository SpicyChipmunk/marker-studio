// v318.26 (W3): Leave white. A section left white by hand (whitePins, saved as payload `white`) has no marker, base,
// pin or place in the order, and is in assignData.paper, after every laying of the plan (zoneRun's whiteApply);
// Undo and Redo, Colour it, the save and the open (a pin counts only where the guide has the section white). Fails on
// v318.25 (no whitePins).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from './harness.mjs';

const SET = (n) => `state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => ${n})))`;
// a grid of cells, each a section, built as a guide (Gradient)
function gridGuide(cols = 6, rows = 5, vars = {}) {
  const app = createApp(),
    E = app.__eval,
    t = app.__mstest;
  t.assign.quiet();
  t.assign.resetForNewPicture();
  E(SET("s.n === 'Honolulu 120'"));
  t.coll = E('sfCollection()');
  const cell = 20,
    lw = 2,
    W = cols * (cell + lw) + lw,
    H = rows * (cell + lw) + lw,
    g = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (x % (cell + lw) < lw || y % (cell + lw) < lw) g[y * W + x] = 0;
  t.srcK = 1;
  t.W = W;
  t.H = H;
  t.gray = g;
  t.segment();
  Object.assign(t.styleVars, { family: 'gradient', gradShape: 'serpentine', palette: 'all', limitN: 12, gradSeed: 0 }, vars);
  t.assign.adj = null;
  t.assign.segFresh = true;
  t.assign.sfmode = 'review';
  t.assignData = null;
  t.assign.buildGuide();
  return { app, E, t };
}
// the invariant: pinned white => in paper, no assign, base, lock or place in the order, N counts the order
function invariant(t) {
  const d = t.assignData;
  for (const l in t.whitePins) {
    assert.equal(d.assign[l], undefined, 'no marker on white ' + l);
    assert.ok(!d.base || d.base[l] === undefined, 'no base on white ' + l);
    assert.equal(t.locks[l], undefined, 'no pin on white ' + l);
    assert.ok(d.paper && d.paper[l], 'white ' + l + ' is paper');
    assert.ok(!d.order.includes(+l), 'white ' + l + ' not in the order');
  }
  assert.equal(d.N, d.order.length);
}

test('Leave white: the section goes white, out of the order and the count; it stays white through Shuffle, Random, Manual, Blend and Mood', () => {
  const { t } = gridGuide();
  const d0 = t.assignData,
    n0 = d0.N,
    l = d0.order[3],
    had = d0.assign[l].mkey;
  assert.equal(t.leaveWhite(l), true);
  assert.deepEqual({ ...t.whitePins }, { [l]: had }, 'the marker it had is kept for Colour it');
  invariant(t);
  assert.equal(t.assignData.N, n0 - 1);
  // the plan laid again, every way it can be
  const lays = [
    { gradSeed: 0.37 },
    { family: 'random' },
    { family: 'manual' },
    { family: 'blend' },
    { family: 'gradient', emphasis: 'deep' },
    { family: 'gradient', gradShape: 'radial' },
  ];
  for (const v of lays) {
    Object.assign(t.styleVars, v);
    assert.notEqual(t.layPlan(null), false, JSON.stringify(v));
    invariant(t);
    assert.ok(t.whitePins[l] !== undefined, 'still white after ' + JSON.stringify(v));
    t.assign.planCommit();
  }
  assert.equal(t.assignData.N, n0 - 1);
});

test('a pin on the section goes with Leave white; Undo brings back the marker, the pin and the tick, Redo takes them again', () => {
  const { t } = gridGuide();
  t.assign.planCommit();
  const d = t.assignData,
    l = d.order[2],
    m = d.assign[l].mkey;
  t.locks[l] = m;
  t.assign.planCommit();
  // ticked: Leave white unticks it (a white section is no section to colour)
  t.colored[l] = 1;
  t.leaveWhite(l);
  assert.equal(t.colored[l], 0, 'unticked');
  assert.equal(t.locks[l], undefined);
  const st = t.assign.planStack;
  assert.equal(st[st.length - 1].label, 'Section left white');
  t.assign.planUndo();
  assert.equal(t.assignData.assign[l].mkey, m, 'Undo: its marker');
  assert.equal(t.locks[l], m, 'Undo: its pin');
  assert.equal(t.colored[l], 1, 'Undo: its tick');
  assert.deepEqual({ ...t.whitePins }, {});
  assert.ok(!(t.assignData.paper && t.assignData.paper[l]));
  t.assign.planRedo();
  assert.ok(t.whitePins[l] !== undefined, 'Redo: white again');
  assert.equal(t.colored[l], 0, 'Redo: unticked again');
  invariant(t);
});

test('Colour it: the marker it had, unpinned, back in the order where it sits on the page; one Undo step', () => {
  const { t } = gridGuide(6, 5, { family: 'manual' });
  t.assign.planCommit();
  const d = t.assignData,
    l = d.order[4],
    m = d.assign[l].mkey,
    o0 = d.order.slice();
  t.leaveWhite(l);
  t.colourWhite(l);
  assert.equal(t.assignData.assign[l].mkey, m);
  assert.equal(t.locks[l], undefined, 'not pinned');
  assert.deepEqual(t.assignData.order, o0, 'back in its place (Manual runs top to bottom)');
  assert.ok(!t.assignData.paper, 'no paper left');
  const st = t.assign.planStack;
  assert.equal(st[st.length - 1].label, 'Section coloured again');
  t.assign.planUndo();
  assert.ok(t.whitePins[l] !== undefined, 'Undo: white again');
  invariant(t);
});

test('the last section with a colour is not left white', () => {
  const { t } = gridGuide(2, 1);
  const [a, b] = t.assignData.order;
  assert.equal(t.leaveWhite(a), true);
  assert.equal(t.leaveWhite(b), false);
  assert.ok(t.assignData.assign[b]);
  assert.equal(t.assignData.N, 1);
});

test('Build guide again (Edit sections): white stays white, and a section no longer in the guide loses its pin', () => {
  const { t } = gridGuide();
  const l = t.assignData.order[1];
  t.leaveWhite(l);
  t.assign.sfmode = 'review';
  t.assign.buildGuide();
  assert.ok(t.whitePins[l] !== undefined);
  invariant(t);
  // a pin on a section past the sections (or merged) goes at the next laying
  t.whitePins[999] = 'Ohuhu|R16';
  t.layPlan(null);
  assert.equal(t.whitePins[999], undefined);
});

test('the test-mode tripwire: a white section with a marker again throws in planCommit', () => {
  const { t } = gridGuide();
  const l = t.assignData.order[0],
    m = t.assignData.assign[l];
  t.leaveWhite(l);
  t.assignData.assign[l] = m;
  assert.throws(() => t.assign.planCommit(), /Leave white: section/);
  delete t.assignData.assign[l];
});

test('saved as payload `white` (only with sections left white), and plCarry knows the key', () => {
  const { t } = gridGuide();
  assert.ok(!('white' in t.currentDesignObj().payload) || t.currentDesignObj().payload.white === undefined);
  const l = t.assignData.order[5],
    m = t.assignData.assign[l].mkey;
  t.leaveWhite(l);
  const pl = t.currentDesignObj().payload;
  assert.deepEqual({ ...pl.white }, { [l]: m });
  assert.ok(pl.paper.includes(l), 'and in paper, which older versions open white');
  assert.ok(!(String(l) in pl.assign), 'with no marker in assign');
  assert.ok(t.plKnown().top.has('white'));
});

test('opening: `white` through the section map, only where the guide opens the section white (paper); odd values none', () => {
  const t = createApp().__mstest,
    W = t.whiteOpen,
    map = Object.assign(Object.create(null), { 1: 1, 2: 2, 3: 7, 4: 8 });
  // the same sections
  assert.deepEqual({ ...W({ 1: 'Ohuhu|R16', 2: 'Ohuhu|Y26' }, map, { 1: 1, 2: 1 }) }, { 1: 'Ohuhu|R16', 2: 'Ohuhu|Y26' });
  // renumbered sections (an older file's numbers)
  assert.deepEqual({ ...W({ 3: 'Ohuhu|R16', 4: 'Ohuhu|Y26' }, map, { 7: 1, 8: 1 }) }, { 7: 'Ohuhu|R16', 8: 'Ohuhu|Y26' });
  // stale: an older tab laid the plan again and gave the section a marker (not in paper): not white
  assert.deepEqual({ ...W({ 1: 'Ohuhu|R16', 2: 'Ohuhu|Y26' }, map, { 2: 1 }) }, { 2: 'Ohuhu|Y26' });
  // `white` without `paper`: ignored
  assert.deepEqual({ ...W({ 1: 'Ohuhu|R16' }, map, undefined) }, {});
  // odd values
  for (const w of [null, 'x', 5, ['Ohuhu|R16'], { 1: 5 }, { 9: 'Ohuhu|R16' }, { __proto__: 'x' }])
    assert.deepEqual({ ...W(w, map, { 1: 1, 9: 1 }) }, {}, JSON.stringify(w));
});

test('opening reads `white` after `paper` and the markers (97-open), and the guide\'s other resets clear it', () => {
  const src = (f) => readFileSync(new URL('../src/js/guide/' + f, import.meta.url), 'utf8');
  const o = src('97-open.js');
  assert.ok(o.indexOf('whitePins = whiteOpen(d.white, map, assignData.paper)') > o.indexOf('assignData.paper = _pp'));
  assert.match(src('10-segment.js'), /locks = \{\};\n  whitePins = \{\};/);
  assert.match(src('20-image-input.js'), /locks = \{\};\n  whitePins = \{\};/);
});

test('with zones: a white section in a zone, and one in Main, stay white as a zone is laid again, and as all are', () => {
  const { t } = gridGuide(6, 5);
  const A = t.assign,
    o = t.assignData.order.slice(),
    z = A.zoneNew();
  A.zoneSelect(z.id);
  const zs = o.slice(0, 10),
    inZ = zs[3],
    inMain = o[20];
  t.reassign(t.zoneMove(zs, z.id));
  t.styleVars.family = 'random';
  t.leaveWhite(inZ);
  t.leaveWhite(inMain);
  invariant(t);
  // the zone being edited laid again (Random), then Main's pattern, then all of them (the markers you can use changed)
  t.reassign([z.id]);
  invariant(t);
  A.zoneSelect(0);
  t.styleVars.family = 'gradient';
  t.styleVars.gradSeed = 0.6;
  t.reassign([0]);
  invariant(t);
  assert.ok(t.whitePins[inZ] !== undefined && t.whitePins[inMain] !== undefined);
  assert.equal(t.assignData.N, o.length - 2);
});
