// v318.25: fixes from the fifth deep debugging pass. Fail on v318.24.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// ---- X1: Markers (Find my set) and Scan's box ----
{
  const a = createApp();
  const E = a.__eval;

  test('X1 Find my set: a scanned Ohuhu blender cap doesn’t count, so a Honolulu 24’s caps show the 24 first', () => {
    const first = (keys) =>
      JSON.parse(
        E(
          `JSON.stringify(findList(findSets('Ohuhu', 0, ${JSON.stringify(keys)})).map((x) => MARKER_SETS[x.i].n))`,
        ),
      );
    assert.equal(first(['Ohuhu|Y111', 'Ohuhu|R014', 'Ohuhu|0'])[0], 'Honolulu 24');
    assert.deepEqual(
      first(['Ohuhu|Y111', 'Ohuhu|R014', 'Ohuhu|0']),
      first(['Ohuhu|Y111', 'Ohuhu|R014']),
      'the same as without the blender',
    );
    // (a 24 Portrait's two caps and the blender: the 24 Portrait among the sets with every cap)
    assert.ok(first(['Ohuhu|YR02', 'Ohuhu|E47', 'Ohuhu|0']).includes('24 Portrait'));
    // (the blender alone still finds the sets with it)
    const lone = JSON.parse(E(`JSON.stringify(findSets('Ohuhu', 0, ['Ohuhu|0']).map((x) => x.hits))`));
    assert.ok(lone.length > 0 && lone.every((h) => h === 1));
    // (Copic's 0 is a real member of its sets: still counted)
    assert.equal(+E(`findSets('Copic', -1, ['Copic|0', 'Copic|E00'])[0].of`), 2);
  });

  // what scanHandle puts in the list, typed with a brand chosen above the box
  const typed = (brand, t) =>
    JSON.parse(
      E(`(function () {
        scanList = []; scanBrand = ${JSON.stringify(brand)}; scanBrandChosen = true;
        scanLast = { i: -1, at: 0 }; scanTookAt.clear(); scanAnsweredAt.clear();
        scanHandle(${JSON.stringify(t)}, true);
        return JSON.stringify(scanList.map((e) => e.ask ? '?' + e.opts.map((o) => COLORS[o.i].brand + ' ' + COLORS[o.i].code).join('|') : COLORS[e.i].brand + ' ' + COLORS[e.i].code));
      })()`),
    );

  test('X1 Scan’s box: a Copic grey upside down with Ohuhu chosen is asked about as another brand’s, as upright', () => {
    assert.deepEqual(typed('Ohuhu', '8-N'), ['?Copic N-8']);
    assert.deepEqual(typed('Ohuhu', '8-N'), typed('Ohuhu', 'N-8'));
    // (with Copic chosen, as before: added, read upside down)
    assert.deepEqual(typed('Copic', '8-N'), ['Copic N-8']);
    // (digits only, or a grey's shape with no digit, still aren't taken as another brand's)
    assert.deepEqual(typed('Ohuhu', 'S-M'), []);
    assert.deepEqual(typed('Ohuhu', '6-13'), []);
  });

  test('X1 a list over 20,000 characters keeps its brand (a shop’s list of every Copic marker, Ohuhu chosen)', () => {
    const out = JSON.parse(
      E(`(function () {
        state.owned = new Set(COLORS.filter((c) => c.brand === 'Ohuhu').slice(0, 50).map((c) => c.brand + '|' + c.code));
        scanBrandChosen = true; scanBrand = 'Ohuhu'; scanList = [];
        const cop = COLORS.filter((c) => c.brand === 'Copic');
        const t = cop.map((c) => c.code + ' ' + c.name + ' - alcohol marker, in stock, add to cart').join('\\n');
        scanHandle(t, true);
        const ins = scanList.filter((e) => !e.ask);
        return JSON.stringify({ chars: t.length, n: cop.length, listed: ins.length, copic: ins.filter((e) => COLORS[e.i].brand === 'Copic').length, asks: scanList.filter((e) => e.ask).length });
      })()`),
    );
    assert.ok(out.chars > 20000, 'over the limit: ' + out.chars);
    assert.equal(out.listed, out.n);
    assert.equal(out.copic, out.n, 'every one as Copic’s, the code both brands have too');
    assert.equal(out.asks, 0);
    // (a list of both brands past the limit: read as either, the reading of its first part not reused for the whole)
    const mixed = JSON.parse(
      E(`(function () {
        scanBrandChosen = true; scanBrand = 'Ohuhu'; scanList = [];
        const pad = ' - alcohol marker, in stock, add to cart';
        const t = COLORS.filter((c) => c.brand === 'Copic').slice(0, 200).map((c) => c.code + ' ' + c.name + pad)
          .concat(COLORS.filter((c) => c.brand === 'Ohuhu').slice(-200).map((c) => c.code + ' ' + c.name + pad)).join('\\n');
        const lb = scanListBrand(t);
        scanHandle(t, true);
        return JSON.stringify({ chars: t.length, mixed: !!(lb && lb.mixed), r: lb && lb.r, last: COLORS[scanList.filter((e) => !e.ask).slice(-1)[0].i].brand + ' ' + COLORS[scanList.filter((e) => !e.ask).slice(-1)[0].i].code, want: 'Ohuhu ' + COLORS.filter((c) => c.brand === 'Ohuhu').slice(-1)[0].code, listed: scanList.filter((e) => !e.ask).length });
      })()`),
    );
    assert.ok(mixed.chars > 20000);
    assert.equal(mixed.mixed, true);
    assert.equal(mixed.r, null);
    assert.ok(mixed.listed > 300, 'the lines past the limit read too: ' + mixed.listed);
  });
}
