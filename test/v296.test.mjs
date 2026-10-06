// v296 fixes outside the browser: the palette's Undo goes back to that palette's scheme and size; a colour locked past
// a smaller size is kept; a chosen base marker sits in the middle of an Analogous fan; the scheme check allows the half
// degree its own steps can miss; "… base" only for a chosen marker; unreadable saved data with no room for a copy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const fresh = () => {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval('showPalette=function(){};chrome=function(){};fullRender=function(){};clearPalette=function(){};showCustom=function(){}');
  return a.__eval;
};

test('palette Undo: back to the palette before with its own scheme and size', () => {
  const E = fresh();
  E(`state.mode='palette';state.harmony='complementary';state.palSize=4;state.palettes=[];state.palH=[];state.locked=[];state.seed=null`);
  E(`palPush(genPalette(4,'complementary',{}),24)`);
  E(`palPush(genPalette(4,'complementary',{}),24)`);
  E(`setHarmony('analogous')`);
  E(`setSize(8)`);
  // (v308: the scheme change is a step of its own, which the size change then replaces)
  assert.equal(E('state.palettes.length'), 3);
  E('undo()');
  assert.equal(E('state.harmony'), 'complementary');
  assert.equal(E('state.palSize'), 4);
  assert.equal(E('state.palettes[state.palettes.length-1].length'), 4);
  assert.equal(E('state.palH.length'), E('state.palettes.length'), 'the schemes stay in step');
});

test('a colour locked past a smaller size moves into a free place instead of going', () => {
  const E = fresh();
  for (let r = 0; r < 10; r++) {
    E(`state.mode='palette';state.harmony='complementary';state.palSize=8;state.palettes=[];state.palH=[];state.locked=[];state.seed=null`);
    E(`palPush(genPalette(8,'complementary',{}),24)`);
    const last = E('state.palettes[0][7]');
    E(`state.locked=[${last}]`);
    E('setSize(4)');
    assert.ok(E(`state.palettes[state.palettes.length-1].includes(${last})`), 'still there');
    assert.ok(E(`state.locked.includes(${last})`), 'still locked');
  }
});

test('Analogous built from a chosen marker: as many colours on either side of it', () => {
  const E = fresh();
  const seeds = E(`COLORS.map((c,i)=>i).filter(i=>LCH[i][1]>=35&&LCH[i][0]>40&&LCH[i][0]<75)`).filter((_, k) => k % 9 === 0);
  let above = 0, below = 0;
  for (const s of seeds) for (let r = 0; r < 4; r++) {
    const p = [...E(`genPalette(5,'analogous',{baseHue:LCH[${s}][2],locked:{0:${s}},seedIdx:${s}})`)];
    assert.equal(p[0], s, 'the chosen marker first');
    for (const i of p.slice(1)) { const o = E(`hueOff(LCH[${i}][2],LCH[${s}][2])`); if (o > 2) above++; else if (o < -2) below++; }
  }
  assert.ok(Math.abs(above - below) < (above + below) * 0.2, `${above} above, ${below} below`);
});

test('the scheme check allows the half degree between the hues it tries', () => {
  const E = fresh();
  // two clear colours spread across 119.5°–120° of hue: within Analogous's 120°, but between the whole degrees tried
  const pair = E(`(() => { const C = LCH.map((l, i) => [l, i]).filter(([l]) => l[1] >= 25 && Math.abs(l[2] - Math.round(l[2])) > 0.2); for (const [a, i] of C) for (const [b, j] of C) { const s = (b[2] - a[2] + 360) % 360; if (s > 119.5 && s < 120) return [i, j]; } return null; })()`);
  assert.ok(pair, 'a pair to try');
  assert.equal(E(`palOnScheme([${[...pair]}], 'analogous', new Set())`), true);
});

test('the scheme line names a base only for a marker chosen to build from', () => {
  const E = fresh();
  E(`state.harmony='complementary';state.seed=null`);
  const pal = E(`genPalette(4,'complementary',{})`);
  assert.equal(E(`palSub([${[...pal]}])`), 'Complementary');
  const s = pal[0];
  E(`state.seed=mkey(${s})`);
  assert.match(E(`palSub([${[...pal]}])`), /^Complementary · .+ base$/);
});

test('unreadable saved data with no room to keep a copy: the note says so, and the original is kept for this time', () => {
  const raw = JSON.stringify({ ownedSeedV: 2, copicAdd1: 1, libAdj1: 1, setFix1: 1, owned: ['Ohuhu|R14'], saved: [{ id: 111, type: 'palette', name: 'Good', keys: ['Ohuhu|R14'] }, { id: 'oops', type: 'guide', name: 'newer', keys: [] }] });
  const ls = memoryStorage({ 'ohuhu-hb320-picker-v3': raw });
  const set = ls.setItem;
  ls.setItem = (k, v) => { if (k === 'ms-state-backup') throw new Error('QuotaExceededError'); return set(k, v); };
  const a = createApp({ localStorage: ls });
  assert.equal(JSON.parse(ls.getItem('ms-load-note')).nocopy, true);
  assert.equal(a.__eval('_lossRaw'), raw);
  // with room, as before: a copy, and no such word
  const ls2 = memoryStorage({ 'ohuhu-hb320-picker-v3': raw });
  const b = createApp({ localStorage: ls2 });
  assert.equal(ls2.getItem('ms-state-backup'), raw);
  assert.equal(JSON.parse(ls2.getItem('ms-load-note')).nocopy, undefined);
  assert.equal(b.__eval('_lossRaw'), null);
});

test('keyIdx finds every marker by its key', () => {
  const E = fresh();
  assert.equal(E('COLORS.every((c, i) => keyIdx(mkey(i)) === i)'), true);
  assert.equal(E(`keyIdx('Nope|X1')`), null);
});
