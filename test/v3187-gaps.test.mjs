// v318.7 Scan, section 10: which markers of a set weren't read. Of the sets with a marker in this session's list, leaving
// out those complete and any set nine-tenths in a complete set, the largest with nine-tenths of it here (listed or
// yours) is named with what's missing when that's 12 or fewer; a brand's blender is never missing; a question waiting's
// answers are neither here nor missing. "I don't have them" is remembered per set; one card per set per visit. Each test
// fails on v318.6 (scanSetGaps and scanGapChoices don't exist there).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function studio(init) {
  const a = createApp({ localStorage: memoryStorage(init || {}) });
  a.__eval(`
    var T = {};
    T.set = (n) => presetMkeys(MARKER_SETS.find((p) => p.n === n));
    T.drop = (keys, every) => keys.filter((k, i) => i % every !== 0);
    T.reset = function () { scanFind = null; scanList = []; state.owned = new Set(); scanGapsSaid.clear(); T.cards = []; };
    T.list = (keys) => { scanList = keys.map((k) => ({ i: keyIdx(k), how: '' })).concat(scanList.filter((e) => e.ask)); };
    T.ask = (keys) => { scanList.unshift({ ask: 'brands ' + keys[0].split('|')[1], title: '?', at: 1, opts: keys.map((k) => ({ i: keyIdx(k), how: 'chosen' })) }); };
    T.own = (keys) => keys.forEach((k) => state.owned.add(k));
    T.gaps = function () { const g = scanSetGaps(); return g ? g.p.n + ': all but ' + g.miss.length + ' [' + g.miss.map((m) => m.code).join(' ') + ']' + (g.waiting ? ' · ' + g.waiting + ' waiting' : '') : null; };
    scanSay = function (k, a, b, i, ch) { T.cards.push({ k: k, big: String(a), small: String(b || ''), choices: ch || null }); };
    scanBeep = function () {};
    scanRender = function () {};
  `);
  return a;
}

test('an owner of a complete Ohuhu set photographs a Copic tray missing a few: that set, not the Ohuhu one; an Ohuhu tray of a smaller set the same', () => {
  const a = studio();
  for (const own of ['Honolulu 120', 'Honolulu 320 (complete set)']) {
    a.__eval(`T.reset(); T.own(T.set('${own}')); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));`);
    assert.equal(a.__eval('T.gaps()'), 'Ciao 36 - Set A: all but 3 [100 E21 V04]', own);
    a.__eval(`T.reset(); T.own(T.set('${own}')); T.list(T.drop(T.set('Sketch 36'), 12));`);
    assert.equal(a.__eval('T.gaps()'), 'Sketch 36: all but 3 [100 C-9 V09]', own);
  }
  // an owner of Honolulu 120 reads a Skin Tones tray missing 4: its blender among them (never missing), and E511 is
  // in the 120 (yours): all but 2
  a.__eval("T.reset(); T.own(T.set('Honolulu 120')); T.list(T.drop(T.set('36 Skin Tones'), 12));");
  assert.equal(a.__eval('T.gaps()'), '36 Skin Tones: all but 2 [YR47 E75]');
});

test('the largest set with nine-tenths here; missing more than 12, nothing (no smaller set instead); complete, nothing; a set nine-tenths in a complete set, nothing', () => {
  const a = studio();
  // a fresh user, Honolulu 216 read missing 20: nothing (not "48 Mid-tone Set: all but 2" for 46 of its 49 in 216)
  a.__eval("T.reset(); T.list(T.drop(T.set('Honolulu 216'), 11));");
  assert.equal(a.__eval('T.gaps()'), null);
  // missing 12 or 8: the 216
  a.__eval("T.reset(); T.list(T.drop(T.set('Honolulu 216'), 18));");
  assert.match(a.__eval('T.gaps()'), /^Honolulu 216: all but 12 \[/);
  a.__eval("T.reset(); T.list(T.drop(T.set('Honolulu 216'), 27));");
  assert.match(a.__eval('T.gaps()'), /^Honolulu 216: all but 8 \[/);
  // complete: nothing, and nothing for the sets inside it (an owner of the 216 reads 30 of it again, or all of it)
  a.__eval("T.reset(); T.own(T.set('Honolulu 216')); T.list(T.set('Honolulu 216').slice(0, 30));");
  assert.equal(a.__eval('T.gaps()'), null);
  a.__eval("T.reset(); T.list(T.set('Honolulu 216'));");
  assert.equal(a.__eval('T.gaps()'), null);
  // an owner of the 320 reads 30 of it: nothing (not "48 Pastel Blossoming: all but 1" nor "36 Gray Tones: all but 2")
  a.__eval(
    "T.reset(); T.own(T.set('Honolulu 320 (complete set)')); T.list(T.set('Honolulu 320 (complete set)').slice(0, 30));",
  );
  assert.equal(a.__eval('T.gaps()'), null);
  // an owner of the 216 reads 44 of the Mid-tone set (the 3 outside the 216 not read): nothing, it's in a complete set
  a.__eval(
    "T.reset(); T.own(T.set('Honolulu 216')); T.list(T.set('48 Mid-tone Set').filter((k) => T.set('Honolulu 216').indexOf(k) >= 0));",
  );
  assert.equal(a.__eval('T.gaps()'), null);
  // nothing of the set in this session's list: not named, whatever the collection holds
  a.__eval(
    "T.reset(); T.own(T.drop(T.set('Honolulu 120'), 60)); T.list(T.set('Ciao 36 - Set A').slice(0, 3));",
  );
  assert.equal(a.__eval('T.gaps()'), null);
  // an empty list: nothing
  a.__eval('T.reset();');
  assert.equal(a.__eval('T.gaps()'), null);
  // All Copic markers never (nearly every Copic marker listed: a real set nearly complete is named, not that one)
  a.__eval("T.reset(); T.list(T.drop(T.set('All Copic markers'), 100));");
  assert.doesNotMatch(a.__eval('T.gaps()'), /All Copic/);
});

test('a brand’s blender is never missing; a question waiting’s answers are neither here nor missing', () => {
  const a = studio();
  // Ciao 72 Set A read missing 6, its blender (Copic 0) among them: "all but 5"
  a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 72 - Set A'), 12));");
  assert.ok(
    a.__eval("T.set('Ciao 72 - Set A').indexOf('Copic|0') % 12 === 0"),
    'the blender among the dropped',
  );
  assert.equal(a.__eval('scanSetGaps().miss.length'), 5);
  assert.ok(!a.__eval("scanSetGaps().miss.some((m) => m.code === '0')"));
  // Honolulu 120 all but its blender: complete
  a.__eval("T.reset(); T.list(T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0'));");
  assert.equal(a.__eval('T.gaps()'), null);
  // Honolulu 120 all but 4, 3 of them waiting as questions: all but 1, and the 3 waiting
  a.__eval(
    "T.reset(); var H = T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0'); T.list(H.slice(4)); H.slice(0, 3).forEach((k) => T.ask([k, 'Copic|B04']));",
  );
  assert.equal(
    a.__eval('T.gaps()'),
    'Honolulu 120: all but 1 [' +
      a.__eval("COLORS[keyIdx(T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0')[3])].code") +
      '] · 3 waiting',
  );
  // all of it listed or waiting: complete, nothing
  a.__eval(
    "T.reset(); var H = T.set('Honolulu 120').filter((k) => k !== 'Ohuhu|0'); T.list(H.slice(3)); H.slice(0, 3).forEach((k) => T.ask([k, 'Copic|B04']));",
  );
  assert.equal(a.__eval('T.gaps()'), null);
});

test('the card’s choices: Add these N puts them in the list; I don’t have them is remembered for the set; one card per set per visit', () => {
  const a = studio();
  a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));");
  const ch = JSON.parse(a.__eval('JSON.stringify(scanGapChoices().map((c) => c.head || c.label))'));
  assert.deepEqual(ch, [
    'Ciao 36 - Set A: all but 3 are here — 100, E21 and V04. Not read, or not yours?',
    'Add these 3',
    'I don’t have them',
  ]);
  // said once this visit
  assert.equal(a.__eval('scanGapChoices()'), null);
  a.__eval('scanGapsSaid.clear()');
  // Add these 3: in the list, to check before Add; the card says so
  a.__eval('scanGapChoices()[1].go()');
  assert.equal(a.__eval('scanList.filter((e) => !e.ask).length'), 36);
  assert.equal(a.__eval('T.cards[T.cards.length - 1].big'), '3 added to the list');
  assert.equal(a.__eval('T.cards[T.cards.length - 1].small'), 'Ciao 36 - Set A · Check them below, then Add');
  assert.equal(a.__eval('state.owned.size'), 0, 'nothing in the collection by itself');
  // I don't have them: remembered under an ms- key; not named again, the next set (if any) is
  a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));");
  a.__eval('scanGapChoices()[2].go()');
  assert.equal(a.__eval("localStorage.getItem('ms-scan-nothave')"), '["Copic|Ciao 36 - Set A"]');
  assert.equal(a.__eval('T.cards[T.cards.length - 1].big'), 'Not yours, then');
  a.__eval('scanGapsSaid.clear()');
  assert.equal(a.__eval('T.gaps()'), null);
  // one missing: "all but 1 is here — B24", "Add it", "I don't have it"; waiting questions said
  a.__eval(
    "T.reset(); localStorage.removeItem('ms-scan-nothave'); var C = T.set('Ciao 36 - Set A'); T.list(C.slice(2)); T.ask([C[0], 'Ohuhu|B04']);",
  );
  const one = JSON.parse(a.__eval('JSON.stringify(scanGapChoices().map((c) => c.head || c.label))'));
  assert.deepEqual(one, [
    'Ciao 36 - Set A: all but 1 is here — ' +
      a.__eval('COLORS[keyIdx(C[1])].code') +
      ', and 1 waiting as a question below. Not read, or not yours?',
    'Add it',
    'I don’t have it',
  ]);
  // the words for Add's toast
  a.__eval("T.reset(); T.list(T.drop(T.set('Ciao 36 - Set A'), 12));");
  assert.equal(a.__eval('scanGapCodes(scanSetGaps())'), '100, E21 and V04');
});
