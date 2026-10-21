// v318.29 (fixer Z1) Scan: a question about a code asked while the brand set for you read it ("Which R27?" typed with
// Ohuhu set for you) offers the other brand's markers of that code too once the reading switches to both brands, so a
// Copic brand tapped after answers it; Keep Ohuhu takes them off again. Fails on v318.29's HEAD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, memoryStorage } from './harness.mjs';

function studio() {
  const a = createApp({ localStorage: memoryStorage() });
  a.__eval(`
    var T = {};
    T.reset = function (brand) {
      scanList = []; scanBrand = brand; scanBrandChosen = false; scanAutoB = brand;
      scanSw = scanSwNew(); scanLastBrand = ''; scanHandleId = 0; scanUnread = 0;
      scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLast = { i: -1, at: 0 };
      scanLastMany = { key: '', at: 0 };
      state.owned = new Set();
      scanSay = function () {};
    };
    T.read = function (t) { scanHandle(t, true); scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear(); scanLastCard = { key: '', at: 0 }; scanLastMany = { key: '', at: 0 }; };
    T.ask = (k) => { const e = scanList.find((e) => e.ask === k); return e ? e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code + '/' + o.how) : null; };
  `);
  return {
    reset: (b) => a.__eval('T.reset(' + JSON.stringify(b) + ')'),
    read: (t) => a.__eval('T.read(' + JSON.stringify(t) + ')'),
    ask: (k) => JSON.parse(a.__eval('JSON.stringify(T.ask(' + JSON.stringify(k) + '))')),
    ev: (s) => a.__eval(s),
  };
}

test('"Which R27?" asked with Ohuhu set for you offers Copic R27 too once both brands are read; Keep Ohuhu takes it off', () => {
  const s = studio();
  // as Either brand asks it: Ohuhu R27, Copic R27, then Ohuhu E711 by its old code
  const either = ['Ohuhu R27/chosen', 'Copic R27/chosen', 'Ohuhu E711/old'];
  s.reset('Ohuhu');
  s.read('R27');
  assert.deepEqual(
    s.ask('old R27'),
    ['Ohuhu R27/chosen', 'Ohuhu E711/old'],
    'set for you: Ohuhu’s only, as before',
  );
  // the tester's order: B000, R27, YG17 (the switch comes at YG17, after the question)
  s.reset('Ohuhu');
  ['B000', 'R27', 'YG17'].forEach(s.read);
  assert.equal(s.ev('scanSw.on'), true, 'switched to both brands');
  assert.deepEqual(s.ask('old R27'), either, 'the question offers Copic R27 too');
  // asked after the switch: the same, as before
  s.reset('Ohuhu');
  ['B000', 'YG17', 'R27'].forEach(s.read);
  assert.deepEqual(s.ask('old R27'), either);
  // Keep Ohuhu: the Copic marker the switch added goes again
  s.reset('Ohuhu');
  ['B000', 'R27', 'YG17'].forEach(s.read);
  s.ev('scanSwitchOff()');
  assert.deepEqual(s.ask('old R27'), ['Ohuhu R27/chosen', 'Ohuhu E711/old']);
  // a misread put right ("R2T"): its codes' Copic markers too
  s.reset('Ohuhu');
  ['R2T', 'B000', 'YG17'].forEach(s.read);
  assert.ok(s.ask('fix R2T').indexOf('Copic R27/chosen') >= 0, JSON.stringify(s.ask('fix R2T')));
});
