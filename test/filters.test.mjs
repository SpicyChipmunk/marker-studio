// Marker filters: nothing chosen means every marker; tapping a chip shows only that one,
// tapping more adds them, and removing the last choice goes back to everything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

const fresh = () => createApp({ localStorage: memoryStorage() });
const tones = (a) => [...a.__eval('state.tones')].sort();
const ALL_T = ['dark', 'light', 'mid', 'pale'];

test('tapping a tone shows only that tone, then adds, then back to all', () => {
  const a = fresh();
  assert.deepEqual(tones(a), ALL_T);
  assert.equal(a.__eval("fgIsAll('tone')"), true);
  assert.equal(a.__eval("fgSel('tone','pale')"), false, 'nothing looks chosen when everything shows');
  a.__eval("fgTap('tone','pale')");
  assert.deepEqual(tones(a), ['pale'], 'first tap = only this');
  assert.equal(a.__eval("fgSel('tone','pale')"), true);
  a.__eval("fgTap('tone','light')");
  assert.deepEqual(tones(a), ['light', 'pale'], 'second tap adds');
  a.__eval("fgTap('tone','pale')");
  assert.deepEqual(tones(a), ['light'], 'tapping a chosen one removes it');
  a.__eval("fgTap('tone','light')");
  assert.deepEqual(tones(a), ALL_T, 'removing the last goes back to all');
  a.__eval("fgTap('tone','pale');fgTap('tone','light');fgTap('tone','mid');fgTap('tone','dark')");
  assert.equal(a.__eval("fgIsAll('tone')"), true, 'choosing all of them is the same as none');
  assert.equal(a.__eval("fgSel('tone','mid')"), false);
});

test('families use the same rule (stored as the excluded list)', () => {
  const a = fresh();
  const fams = a.__eval('families.map(f=>f.name)');
  const f0 = fams[0], f1 = fams[1];
  a.__eval(`fgTap('fam',${JSON.stringify(f0)})`);
  assert.equal(a.__eval('state.excluded.size'), fams.length - 1, 'only the tapped family shows');
  assert.equal(a.__eval(`state.excluded.has(${JSON.stringify(f0)})`), false);
  a.__eval(`fgTap('fam',${JSON.stringify(f1)})`);
  assert.equal(a.__eval('state.excluded.size'), fams.length - 2);
  a.__eval("fgClear('fam')");
  assert.equal(a.__eval('state.excluded.size'), 0);
});

test('an empty group from an old saved state means everything', () => {
  const a = fresh();
  a.__eval("state.brands=new Set();state.excluded=new Set(families.map(f=>f.name));fgNormalize()");
  assert.equal(a.__eval("fgIsAll('brand')"), true);
  assert.equal(a.__eval('state.excluded.size'), 0);
});
