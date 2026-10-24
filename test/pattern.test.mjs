// The guide’s patterns: Random, Balance, Blend, families, Leave white, themes.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpuMs, createApp } from './harness.mjs';
import { readFileSync } from 'node:fs';

// ---- from balance.test.mjs ----
// Random's Balance (v283, js/guide/31-balance.js): colour families by how markers look, the three roles Auto or by
// hand (with borrowing for a thin family, two roles when one can't be filled, none when there's no main colour), the
// areas about 60/30/10 with accents on middling sections spread out, pins counting towards their role, and Mixed's
// No repeats. The browser tests (e2e/balance.test.mjs) cover the bar, the sheet, Undo and saving.
{
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    core.coll = E('sfCollection()');
    const sv = core.styleVars;
    Object.assign(sv, {
      family: 'random',
      balance: 'main',
      balM: 'auto',
      balS: 'auto',
      balA: 'auto',
      balSeed: 0.3,
      noRep: false,
      paletteSource: 'owned',
      palette: 'all',
      emphasis: 'neutral',
      limitN: 16,
    });
    return { app, E, core, sv };
  }
  // cols × rows sections, the sizes varied (every third column twice as wide, every fifth row half as tall)
  function grid(core, cols, rows) {
    const xs = [0];
    for (let x = 0; x < cols; x++) xs.push(xs[x] + (x % 3 === 0 ? 40 : 20));
    const ys = [0];
    for (let y = 0; y < rows; y++) ys.push(ys[y] + (y % 5 === 0 ? 10 : 20));
    const W = xs[cols],
      H = ys[rows],
      labels = new Int32Array(W * H),
      comps = [null];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const l = comps.length;
        comps.push({
          cx: (xs[x] + xs[x + 1]) / 2,
          cy: (ys[y] + ys[y + 1]) / 2,
          area: (xs[x + 1] - xs[x]) * (ys[y + 1] - ys[y]),
          merged: false,
          bg: false,
        });
        for (let py = ys[y]; py < ys[y + 1]; py++) labels.fill(l, py * W + xs[x], py * W + xs[x + 1]);
      }
    core.W = W;
    core.H = H;
    core.labels = labels;
    core.comps = comps;
    core.secState = new Uint8Array(comps.length).fill(1);
    core.assignData = null;
    return core.countedList();
  }
  const COLORS = createApp().__eval('COLORS');
  const byCode = (core, code) => core.coll.find((m) => m.code === code);
  // each role's share of the area, in whole percent
  function shares(core, p) {
    const role = {},
      a = core.assignData,
      r = { m: 0, s: 0, a: 0, x: 0 };
    let tot = 0;
    ['m', 's', 'a'].forEach(
      (k) =>
        p.roles[k] &&
        p.roles[k].markers.forEach((m) => {
          role[m.mkey] = k;
        }),
    );
    a.order.forEach((l) => {
      const k = role[a.assign[l].mkey] || 'x',
        ar = core.comps[l].area;
      r[k] += ar;
      tot += ar;
    });
    for (const k in r) r[k] = Math.round((100 * r[k]) / tot);
    return r;
  }
  // a marker's hue as Oklab has it (as balHue), and how far apart two hues are
  function okH(m) {
    const c = [1, 3, 5]
      .map((i) => parseInt(m.hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]),
      q = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]),
      s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
    return (
      ((Math.atan2(
        0.0259040371 * l + 0.7827717662 * q - 0.808675766 * s,
        1.9779984951 * l - 2.428592205 * q + 0.4505937099 * s,
      ) *
        180) /
        Math.PI +
        360) %
      360
    );
  }
  const hd = (a, b) => {
    const x = Math.abs(a - b) % 360;
    return Math.min(x, 360 - x);
  };
  const circMean = (hs) => {
    let X = 0,
      Y = 0;
    hs.forEach((h) => {
      X += Math.cos((h * Math.PI) / 180);
      Y += Math.sin((h * Math.PI) / 180);
    });
    return ((Math.atan2(Y, X) * 180) / Math.PI + 360) % 360;
  };
  function withPalette(core, E, sv, keys) {
    E(
      `state.saved = state.saved.filter((x) => x.id !== 778); state.saved.push({ type: 'palette', id: 778, name: 'Test', keys: ${JSON.stringify(keys)} })`,
    );
    E(
      `SF.configure({ listPalettes: () => state.saved.filter((x) => x.type === 'palette'), markerInfo: () => null })`,
    );
    Object.assign(sv, { paletteSource: 'saved', savedPalId: 778, expand: false, limitN: 16 });
  }
  test('colour families go by how a marker looks: blues, reds, browns and greys by their colour, not their code', () => {
    const { core } = appWith(['Honolulu 320 (complete set)']);
    const fam = (c) => core.balFamOf(byCode(core, c));
    assert.equal(fam('B112'), 'blue');
    // (a saturated blue is a blue, not a violet: Copic's B29 and V09 by how they look)
    const { core: cc } = appWith(['Ciao 12']);
    assert.equal(cc.balFamOf(byCode(cc, 'B29')), 'blue');
    assert.equal(cc.balFamOf(byCode(cc, 'V09')), 'violet');
    assert.equal(cc.balFamOf(byCode(cc, 'Y06')), 'yellow', 'a lemon yellow is a yellow');
    assert.equal(fam('R16'), 'red');
    // (most of the Green family's markers are greens, the yellowish ones yellow-greens)
    const gr = core.coll.filter((m) => m.fam === 'Green'),
      gn = gr.filter((m) => core.balFamOf(m) === 'green').length;
    assert.ok(
      gn >= gr.length * 0.5 &&
        gr.every((m) => ['green', 'ygreen', 'teal', 'grey', 'brown'].includes(core.balFamOf(m))),
      gn + ' of ' + gr.length,
    );
    assert.equal(fam('CG17'), 'grey');
    assert.equal(fam('120'), 'grey', 'black');
    const browns = core.coll.filter((m) => m.fam && /Earth/.test(m.fam) && core.balFamOf(m) === 'brown');
    assert.ok(browns.length >= 20, 'most browns are browns: ' + browns.length);
    // every marker has a family, one of the eleven
    const all = new Set(core.coll.map((m) => core.balFamOf(m)));
    for (const f of all)
      assert.ok(
        [
          'pink',
          'red',
          'orange',
          'yellow',
          'ygreen',
          'green',
          'teal',
          'blue',
          'violet',
          'brown',
          'grey',
        ].includes(f),
        f,
      );
    assert.ok(all.size >= 10);
  });
  test('Auto: a main colour with 3+ markers, an accent across the wheel from it (bright), a second next to it; the marker count shared about half, a third and 2 accents', () => {
    const { core, sv } = appWith(['Honolulu 120']);
    const hues = {
      pink: 350,
      red: 18,
      orange: 53,
      yellow: 89,
      ygreen: 121,
      green: 150,
      teal: 192,
      blue: 250,
      violet: 305,
      brown: 50,
    };
    const d = (a, b) => {
      const x = Math.abs(hues[a] - hues[b]) % 360;
      return Math.min(x, 360 - x);
    };
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      sv.balSeed = (i + 0.5) / 40;
      const p = core.balPlan();
      assert.ok(p.ok);
      const { m, s, a } = p.roles;
      assert.ok(m && s && a, 'three roles');
      // (9, 5 and 2 of the 16, or all a family has when it has fewer)
      assert.equal(m.markers.length, Math.min(9, m.list.length));
      assert.equal(s.markers.length, Math.min(5, s.list.length));
      assert.equal(a.markers.length, Math.min(2, a.list.length));
      assert.ok(d(m.k, a.k) >= 100, `accent ${a.k} across the wheel from ${m.k}`);
      assert.ok(new Set([m.k, s.k, a.k]).size === 3);
      assert.ok(
        a.k !== 'grey' && a.k !== 'brown' && m.k !== 'grey' && s.k !== 'grey',
        'Auto picks no greys, and no brown accent',
      );
      // no marker in two roles
      const keys = [...m.markers, ...s.markers, ...a.markers].map((x) => x.mkey);
      assert.equal(new Set(keys).size, keys.length);
      seen.add(m.k);
    }
    assert.ok(seen.size >= 5, 'Other pairings reaches many main colours: ' + [...seen].join(' '));
    // Temperature steers Auto's main colour
    sv.palette = 'cool';
    for (let i = 0; i < 20; i++) {
      sv.balSeed = (i + 0.5) / 20;
      assert.ok(['ygreen', 'green', 'teal', 'blue', 'violet'].includes(core.balPlan().roles.m.k));
    }
    // ... but not once a colour is chosen by hand
    sv.balA = 'orange';
    const warm = new Set();
    for (let i = 0; i < 20; i++) {
      sv.balSeed = (i + 0.5) / 20;
      warm.add(core.balPlan().roles.m.k);
    }
    assert.ok([...warm].some((k) => !['ygreen', 'green', 'teal', 'blue', 'violet'].includes(k)));
  });
  test('by hand: each role takes the family chosen; a family chosen twice goes back to Auto for the later role; greys can be the main colour, not the accent', () => {
    const { core, sv } = appWith(['Honolulu 120', '36 Gray Tones']);
    Object.assign(sv, { balM: 'blue', balS: 'teal', balA: 'orange' });
    let p = core.balPlan();
    assert.deepEqual([p.roles.m.k, p.roles.s.k, p.roles.a.k], ['blue', 'teal', 'orange']);
    assert.ok(p.roles.m.markers.every((m) => core.balFamOf(m) === 'blue'));
    Object.assign(sv, { balM: 'blue', balS: 'auto', balA: 'blue' });
    p = core.balPlan();
    assert.equal(p.roles.m.k, 'blue');
    assert.notEqual(p.roles.a.k, 'blue');
    Object.assign(sv, { balM: 'grey', balS: 'auto', balA: 'grey' });
    p = core.balPlan();
    assert.equal(p.roles.m.k, 'grey');
    assert.notEqual(p.roles.a && p.roles.a.k, 'grey');
  });
  test('a thin family borrows the nearest in hue from next to it; with none to borrow, fewer roles; with no main colour at all, not ok', () => {
    const { core, sv } = appWith(['Ciao 12']);
    const fams = {};
    core.coll.forEach((m) => {
      const f = core.balFamOf(m);
      fams[f] = (fams[f] || 0) + 1;
    });
    const thin = Object.keys(fams).find((f) => f !== 'grey' && fams[f] < 3);
    assert.ok(thin, 'Ciao 12 has a family of fewer than 3');
    sv.balM = thin;
    const p = core.balPlan();
    assert.ok(p.ok);
    assert.ok(p.roles.m.markers.length >= 3, 'three markers for the main colour');
    assert.ok(Object.keys(p.roles.m.borrowed).length > 0, 'borrowed from next to it');
    // two markers in all: no main colour to be had
    const { core: c2, E: E2 } = (() => {
      const x = appWith([]);
      return x;
    })();
    c2.coll = c2.coll.filter((m) => m.code === 'R16' || m.code === 'B112');
    assert.equal(c2.balPlan().ok, false);
    void E2;
  });
  test('laying it out: about 60/30/10 of the area, accents on middling sections spread out, pinned sections kept and counted', () => {
    const { core, sv } = appWith(['Honolulu 120']);
    const cl = grid(core, 15, 14);
    const p = core.balPlan();
    core.buildBalance(cl, p);
    const r = shares(core, p);
    assert.ok(
      Math.abs(r.m - 60) <= 3 && Math.abs(r.s - 30) <= 3 && Math.abs(r.a - 10) <= 3,
      JSON.stringify(r),
    );
    assert.equal(r.x, 0);
    // accents: never on the biggest tenth of sections, and not bunched (mean nearest-neighbour distance well above a section)
    const accKeys = new Set(p.roles.a.markers.map((m) => m.mkey)),
      a = core.assignData;
    const acc = a.order.filter((l) => accKeys.has(a.assign[l].mkey));
    const areas = a.order.map((l) => core.comps[l].area).sort((x, y) => x - y),
      top = areas[Math.floor(areas.length * 0.9)];
    assert.ok(acc.every((l) => core.comps[l].area <= top));
    const nn = acc.map((l) =>
      Math.min(
        ...acc
          .filter((q) => q !== l)
          .map((q) => Math.hypot(core.comps[l].cx - core.comps[q].cx, core.comps[l].cy - core.comps[q].cy)),
      ),
    );
    assert.ok(nn.reduce((t, x) => t + x, 0) / nn.length > 45, 'spread out');
    // neighbours never the same marker
    const adj = core.colour.adj();
    for (const l of a.order)
      for (const q of adj[l] || []) assert.notEqual(a.assign[l].mkey, a.assign[q].mkey);
    // a pinned section keeps its marker, and its area counts towards its role
    const accM = p.roles.a.markers[0],
      big = a.order
        .slice()
        .sort((x, y) => core.comps[y].area - core.comps[x].area)
        .slice(0, 8);
    big.forEach((l) => {
      core.locks[l] = accM.mkey;
    });
    core.buildBalance(cl, core.balPlan());
    big.forEach((l) => assert.equal(core.assignData.assign[l].mkey, accM.mkey));
    const r2 = shares(core, core.balPlan());
    assert.ok(r2.a <= 14, 'the pinned accents use up the accent’s share: ' + JSON.stringify(r2));
    big.forEach((l) => {
      delete core.locks[l];
    });
    // a zone of fewer than 10 sections has no accent of its own
    const small = cl.slice(0, 8);
    core.buildBalance(small, core.balPlan());
    const r3 = shares(core, core.balPlan());
    assert.equal(r3.a, 0);
    void sv;
  });
  test('saved palettes: every one of the palette’s markers is used, each in the role nearest it in colour', () => {
    const { core, sv, E } = appWith(['Honolulu 120']);
    const keys = ['B112', 'B111', 'B114', 'BG11', 'R16', 'Y26', 'G410', 'B05', 'B09']
      .map((c) => byCode(core, c))
      .filter(Boolean)
      .map((m) => m.mkey);
    E(`state.saved.push({ type: 'palette', id: 777, name: 'Mine', keys: ${JSON.stringify(keys)} })`);
    E(
      `SF.configure({ listPalettes: () => state.saved.filter((x) => x.type === 'palette'), markerInfo: () => null })`,
    );
    Object.assign(sv, { paletteSource: 'saved', savedPalId: 777, limitN: 16 });
    const p = core.balPlan();
    assert.ok(p.seeded, 'from the saved palette');
    const used = new Set(p.markers.map((m) => m.mkey));
    keys.forEach((k) => assert.ok(used.has(k), k + ' used'));
    assert.equal(p.roles.m.k, 'blue', 'the palette’s biggest colour');
  });
  test('v284: a palette colour far from every role is an accent ("Accents", about 15%); main and second hold only markers within 60° of their own; the painted shares are within 5 of those asked, as the bar measures them', () => {
    const { core, sv, E } = appWith(['Honolulu 320 (complete set)']);
    const by = {};
    core.coll.forEach((m) => {
      const f = core.balFamOf(m);
      (by[f] = by[f] || []).push(m);
    });
    const mid = (f, i) =>
      by[f]
        .slice()
        .sort((a, b) => Math.abs(core.colour.lch(a)[0] - 60) - Math.abs(core.colour.lch(b)[0] - 60))[i];
    // blues the main colour, teals second, an orange accent; a pink far from them all, a yellow near the orange
    const pink = by.pink.slice().sort((a, b) => hd(okH(b), 53) - hd(okH(a), 53))[0];
    const keys = [
      mid('blue', 0),
      mid('blue', 1),
      mid('blue', 2),
      mid('teal', 0),
      mid('teal', 1),
      mid('orange', 0),
      pink,
      mid('yellow', 0),
    ].map((m) => m.mkey);
    withPalette(core, E, sv, keys);
    const cl = grid(core, 15, 14);
    for (const seed of [0.2, 0.6]) {
      sv.balSeed = seed;
      const p = core.balPlan();
      assert.ok(p.ok && p.seeded);
      assert.deepEqual([p.roles.m.k, p.roles.s.k], ['blue', 'teal']);
      assert.ok(
        p.roles.a.fams.length >= 2 && p.roles.a.fams.includes('pink'),
        'the far pink is an accent: ' + p.roles.a.fams,
      );
      assert.equal(core.balName('a', p), 'Accents');
      assert.equal(p.roles.a.share, 0.15);
      // (every palette marker used, none in two roles)
      const all = [...p.roles.m.markers, ...p.roles.s.markers, ...p.roles.a.markers].map((m) => m.mkey);
      assert.deepEqual(all.slice().sort(), keys.slice().sort());
      for (const r of ['m', 's']) {
        const own = p.roles[r].markers.filter((m) => core.balFamOf(m) === p.roles[r].k),
          c = circMean(own.map(okH));
        p.roles[r].markers.forEach((m) =>
          assert.ok(hd(okH(m), c) <= 60, `${m.code} is within 60° of the ${p.roles[r].k}`),
        );
      }
      for (const noAdj of [false, true]) {
        sv.noAdj = noAdj;
        core.buildBalance(cl, p);
        const ms = core.balMeasure(p),
          r = shares(core, p);
        assert.ok(ms.miss <= 0.05, 'within 5 points: ' + JSON.stringify(ms.f));
        assert.ok(
          Math.abs(ms.f.m * 100 - r.m) <= 1 && Math.abs(ms.f.a * 100 - r.a) <= 1,
          'the bar measures what’s painted',
        );
        assert.equal(ms.other, 0);
      }
    }
    sv.noAdj = false;
  });
  test('v284: one marker can be a palette’s main colour (a 2-colour palette is 70/30); a palette of one colour is all it, measured 100%; with ten sections the accent is never the biggest nor over its share', () => {
    const { core, sv, E } = appWith(['Honolulu 120']);
    const by = {};
    core.coll.forEach((m) => {
      const f = core.balFamOf(m);
      (by[f] = by[f] || []).push(m);
    });
    withPalette(core, E, sv, [by.blue[0].mkey, by.orange[0].mkey]);
    let p = core.balPlan();
    assert.ok(p.ok, 'no longer laid Mixed');
    assert.equal(p.roles.m.markers.length, 1);
    assert.ok(p.roles.a && !p.roles.s);
    assert.equal(p.roles.m.share, 0.7);
    withPalette(
      core,
      E,
      sv,
      by.blue.slice(0, 5).map((m) => m.mkey),
    );
    p = core.balPlan();
    assert.ok(p.ok && !p.roles.s && !p.roles.a);
    const cl = grid(core, 15, 14);
    core.buildBalance(cl, p);
    assert.equal(core.balMeasure(p).f.m, 1);
    // ten sections, one of them nearly half the picture
    sv.paletteSource = 'owned';
    const cl10 = grid(core, 5, 2);
    core.comps[cl10[0]].area = 4000;
    for (let i = 0; i < 20; i++) {
      const q = core.balPlan();
      core.buildBalance(cl10, q);
      const acc = new Set(q.roles.a.markers.map((m) => m.mkey)),
        a = core.assignData;
      const tot = cl10.reduce((t, l) => t + core.comps[l].area, 0);
      assert.notEqual(acc.has(a.assign[cl10[0]].mkey) ? 'accent' : '', 'accent', 'never the biggest');
      cl10.forEach((l) => {
        if (acc.has(a.assign[l].mkey))
          assert.ok(core.comps[l].area <= tot * 0.1 + 1, 'no accent section over the accent’s share');
      });
    }
  });
  test('Mixed’s No repeats: one marker per section while there are enough; with fewer, each used once before any twice', () => {
    const { core } = appWith(['Honolulu 120']);
    const cl = grid(core, 10, 8);
    const pool = core.noRepPool(cl);
    assert.equal(pool.length, 80);
    core.buildNoRep(cl, pool);
    const a = core.assignData;
    // (all different, but for 1 in about 250 lays: when the last unused marker looks the same as a neighbour's, CIEDE2000
    // under TWIN_DE (YR111 beside YR112), a used one goes there instead, as designed; flaky in v308.1's pass)
    assert.ok(new Set(a.order.map((l) => a.assign[l].mkey)).size >= 79, 'all different, or all but one');
    // 30 markers for 80 sections: each 2 or 3 times
    core.buildNoRep(cl, pool.slice(0, 30));
    const n = {};
    core.assignData.order.forEach((l) => {
      const k = core.assignData.assign[l].mkey;
      n[k] = (n[k] || 0) + 1;
    });
    const counts = Object.values(n);
    assert.equal(counts.length, 30);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, 'evenly: ' + counts.join(','));
    // neighbours still differ
    const adj = core.colour.adj();
    for (const l of core.assignData.order)
      for (const q of adj[l] || [])
        assert.notEqual(core.assignData.assign[l].mkey, core.assignData.assign[q].mkey);
  });
  test('a guide saved before Balance: Random opens as Mixed (as it looked), any other pattern opens on Main colour', () => {
    const core = createApp().__mstest,
      f = [...core.styleFields].find((x) => x.key === 'balance');
    assert.equal(f.check(undefined, f.def, { family: 'random' }), 'mixed');
    assert.equal(f.check(undefined, f.def, { family: 'gradient' }), 'main');
    assert.equal(f.check(undefined, f.def, {}), 'main');
    assert.equal(f.check('mixed', f.def, { family: 'gradient' }), 'mixed');
    assert.equal(f.check('loud', f.def, { family: 'random' }), 'mixed');
    const m = [...core.styleFields].find((x) => x.key === 'balM');
    assert.equal(m.check('blue', m.def), 'blue');
    assert.equal(m.check('purple', m.def), 'auto');
    void COLORS;
  });
  test('touching sections never share a marker while another would do: No repeats with few markers, and Main colour at its fewest', () => {
    const { core, sv } = appWith(['Honolulu 120']);
    const cl = grid(core, 20, 20);
    const adj = core.colour.adj();
    const clashes = () => {
      const a = core.assignData;
      let n = 0;
      for (const l of a.order) for (const q of adj[l] || []) if (a.assign[l].mkey === a.assign[q].mkey) n++;
      return n;
    };
    sv.noAdj = true;
    for (let i = 0; i < 5; i++) {
      core.buildNoRep(cl, core.noRepPool(cl).slice(0, 13));
      assert.equal(clashes(), 0, 'No repeats, 13 markers');
    }
    sv.limitN = 6;
    for (let i = 0; i < 5; i++) {
      core.buildBalance(cl, core.balPlan());
      assert.equal(clashes(), 0, 'Main colour, 6 markers');
    }
    sv.noAdj = false;
    sv.limitN = 16;
  });
  test('speed: 3,600 sections and the whole catalogue (721 markers) lay out in well under a few seconds, Main colour and No repeats alike', () => {
    const { core, sv, E } = appWith([]);
    E('state.owned = new Set()');
    core.coll = E('sfCollection()');
    const cl = grid(core, 60, 60);
    let t = cpuMs();
    core.buildBalance(cl, core.balPlan());
    assert.ok(cpuMs() - t < 1500, 'Main colour ' + Math.round(cpuMs() - t) + 'ms');
    sv.noAdj = true;
    t = cpuMs();
    core.buildNoRep(cl, core.noRepPool(cl));
    assert.ok(cpuMs() - t < 3000, 'No repeats ' + Math.round(cpuMs() - t) + 'ms');
    sv.noAdj = false;
  });
  test('v318.28: Keep touching sections clearly different with Main colour keeps the shares within 5 points, roll after roll', () => {
    const { core, sv, E } = appWith(['Honolulu 320 (complete set)']);
    const by = {};
    core.coll.forEach((m) => {
      const f = core.balFamOf(m);
      (by[f] = by[f] || []).push(m);
    });
    const mid = (f, i) =>
      by[f]
        .slice()
        .sort((a, b) => Math.abs(core.colour.lch(a)[0] - 60) - Math.abs(core.colour.lch(b)[0] - 60))[i];
    const pink = by.pink.slice().sort((a, b) => hd(okH(b), 53) - hd(okH(a), 53))[0];
    const keys = [
      mid('blue', 0),
      mid('blue', 1),
      mid('blue', 2),
      mid('teal', 0),
      mid('teal', 1),
      mid('orange', 0),
      pink,
      mid('yellow', 0),
    ].map((m) => m.mkey);
    withPalette(core, E, sv, keys);
    const cl = grid(core, 15, 14);
    // (the repair after the laying, v318.27, had moved sections from the second to the main colour past its share:
    // about 1 roll in 75; seeded, so the same rolls every run)
    const r0 = Math.random;
    let s = 7,
      worst = 0;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      sv.noAdj = true;
      for (let k = 0; k < 200; k++) {
        sv.balSeed = k % 2 ? 0.6 : 0.2;
        const p = core.balPlan();
        core.buildBalance(cl, p);
        worst = Math.max(worst, core.balMeasure(p).miss);
      }
    } finally {
      Math.random = r0;
      sv.noAdj = false;
    }
    assert.ok(worst <= 0.05, 'worst miss ' + (worst * 100).toFixed(1) + ' points');
  });
}

// ---- from photo-choice.test.mjs ----
// The Photo pattern's marker choice (js/guide/46-photo.js): the full search (greedy, then swaps) against the quick
// one used while the marker slider is dragged, and the suggested marker count. The browser tests
// (e2e/photo-choice.test.mjs) cover the summary, the tips, "Closer with" and the Use button.
{
  const app = createApp(),
    E = app.__eval,
    core = app.__mstest;
  E('state.owned = new Set()');
  E(
    "presetMkeys(MARKER_SETS.find((s) => s.n === 'Honolulu 320 (complete set)')).forEach((k) => state.owned.add(k))",
  );
  const coll = E('sfCollection()').filter((m) => m.lab);
  const de = (a, b) => E(`de2000(${JSON.stringify([...a])}, ${JSON.stringify([...b])})`);
  // weighted mean difference (by eye) from each target to its nearest chosen marker
  const cost = (t, chosen) => {
    let s = 0,
      w = 0;
    for (const x of t) {
      s += x.w * Math.min(...chosen.map((m) => de(x.lab, m.lab)));
      w += x.w;
    }
    return s / w;
  };
  const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  test('swaps get out of the centre trap: three colours and a marker between them, two markers wanted', () => {
    // the greedy first pick is the in-between marker (it helps all three a little); swaps replace it with a real one
    const A = [60, 10, 0],
      B = [60, -5, 8.66],
      C = [60, -5, -8.66],
      M = [60, 0, 0];
    const pool = [
      { mkey: 'A', lab: A },
      { mkey: 'B', lab: B },
      { mkey: 'C', lab: C },
      { mkey: 'M', lab: M },
    ];
    const t = [A, B, C].flatMap((x) => [0, 1, 2].map(() => ({ lab: x.slice(), w: 1 })));
    const quick = core.photoPick(t, pool, 2, true).chosen,
      full = core.photoPick(t, pool, 2, false).chosen;
    assert.ok(
      quick.some((m) => m.mkey === 'M'),
      'the quick choice keeps the in-between marker',
    );
    assert.ok(!full.some((m) => m.mkey === 'M'), 'the full choice has two of the real colours');
    assert.ok(cost(t, full) < cost(t, quick));
  });
  test('the full choice is never worse than the quick one, and is the same every time', () => {
    const r = rnd(11);
    for (let k = 0; k < 6; k++) {
      // photo colours: jittered copies of 12 random markers, with random weights
      const base = Array.from({ length: 12 }, () => coll[Math.floor(r() * coll.length)]);
      const t = Array.from({ length: 80 }, () => {
        const m = base[Math.floor(r() * 12)];
        return {
          lab: [m.lab[0] + (r() - 0.5) * 8, m.lab[1] + (r() - 0.5) * 10, m.lab[2] + (r() - 0.5) * 10],
          w: 1 + r() * 9,
        };
      });
      for (const N of [4, 8, 12]) {
        const quick = core.photoPick(t, coll, N, true),
          full = core.photoPick(t, coll, N, false);
        assert.ok(full.chosen.length <= N);
        assert.ok(cost(t, full.chosen) <= cost(t, quick.chosen) + 1e-9, `set ${k}, ${N} markers`);
        assert.deepEqual(
          core.photoPick(t, coll, N, false).chosen.map((m) => m.mkey),
          full.chosen.map((m) => m.mkey),
          'deterministic',
        );
      }
    }
  });
  test('suggested count: a photo made of 8 clearly different markers suggests 8; of 5, 5; none when more always help', () => {
    const r = rnd(5);
    // markers at least 10 apart by eye, none near white
    const pick = (n) => {
      const out = [];
      while (out.length < n) {
        const m = coll[Math.floor(r() * coll.length)];
        if (m.lab[0] > 85 || out.some((o) => de(o.lab, m.lab) < 10)) continue;
        out.push(m);
      }
      return out;
    };
    for (const n of [8, 5]) {
      const truth = pick(n);
      const t = Array.from({ length: 60 }, (_, i) => ({ lab: truth[i % n].lab.slice(), w: 1 + (i % 7) }));
      assert.equal(core.photoSuggest(t, coll), n, n + ' markers');
    }
    // a smooth run of colours much finer than the markers: every added marker helps somewhere, so no suggestion
    const ramp = Array.from({ length: 400 }, (_, i) => ({
      lab: [20 + (i % 20) * 3.5, -40 + Math.floor(i / 20) * 4, ((i * 7) % 60) - 30],
      w: 1,
    }));
    assert.equal(core.photoSuggest(ramp, coll), 0);
  });
}

// ---- from v304-assign.test.mjs ----
// v304 (plan patterns: 30-palette-assign, 31-balance, 34-zones): Build guide after sections were added or split lays
// the new sections clear of the old ones' markers (it used to put the old markers back after laying them all afresh);
// with zones, every zone laid in one go is laid over its own extent (all but the first ran over the whole picture);
// markers that look the same (CIEDE2000 under 2.5) count as the same marker for touching sections, and Random's
// Mixed keeps touching sections from sharing a marker even with "clearly different" off; specks in a porous line are
// looked across (kept ones aren't); the Gradient's order is worked out once per set of markers; the last Blend anchor
// removed brings back three in the zone; one marker to use shows "all (1)" on a slider that can't move; and what the
// last laying worked out isn't shown for another picture, guide or after Undo.
{
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, t, A: t.assign };
  }
  // a repeatable Math.random while fn runs
  function seeded(seed, fn) {
    const r = Math.random;
    let s = seed;
    Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    try {
      return fn();
    } finally {
      Math.random = r;
    }
  }
  // cols × rows square sections, cell px across, lines lw px between them; ready to build
  function grid(t, cols, rows, cell = 24, lw = 2) {
    const W = cols * (cell + lw) + lw,
      H = rows * (cell + lw) + lw,
      labels = new Int32Array(W * H).fill(-1),
      comps = [null];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          x0 = lw + c * (cell + lw),
          y0 = lw + r * (cell + lw);
        comps.push({
          area: cell * cell,
          bg: false,
          bpx: 0,
          cx: x0 + cell / 2,
          cy: y0 + cell / 2,
          h: cell - 1,
          x0,
          y0,
          x1: x0 + cell - 1,
          y1: y0 + cell - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + cell; y++) labels.fill(l, y * W + x0, y * W + x0 + cell);
      }
    ready(t, W, H, labels, comps);
    return { W, H, at: (c, r) => 1 + r * cols + c };
  }
  function ready(t, W, H, labels, comps) {
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.secColor = new Array(comps.length).fill([200, 200, 200]);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'random',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        limitN: 16,
        balance: 'mixed',
        noRep: false,
        noAdj: false,
        balM: 'auto',
        balS: 'auto',
        balA: 'auto',
        balSeed: 0.3,
      },
      o,
    );
  // touching pairs (among sections with markers; only those touching one of `only` when given): sharing a marker, and
  // with markers under 2.5 apart
  function touching(app, t, only) {
    const a = t.adj,
      A = t.assignData.assign;
    let same = 0,
      twin = 0,
      pairs = 0;
    for (const k in a)
      a[k].forEach((q) => {
        const l = +k;
        if (q <= l || !A[l] || !A[q] || (only && !only[l] && !only[q])) return;
        pairs++;
        if (A[l].mkey === A[q].mkey) same++;
        else if (app.de2000(A[l].lab, A[q].lab) < 2.5) twin++;
      });
    return { same, twin, pairs };
  }
  test('Build guide after sections are brought in: the new ones are laid clear of the markers the old ones keep', () => {
    for (const [mode, o] of [
      ['Mixed, clearly different', { noAdj: true }],
      ['Main colour', { balance: 'main' }],
      ['No repeats', { noRep: true }],
    ]) {
      const { app, t, A } = appWith(['Honolulu 120']);
      const g = grid(t, 12, 10),
        back = {};
      // every other section, as on a chessboard, left out of the first build
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 12; c++)
          if ((r + c) % 2) {
            t.secState[g.at(c, r)] = 2;
            back[g.at(c, r)] = 1;
          }
      style(t, o);
      const n = seeded(5, () => {
        A.buildGuide();
        A.sfmode = 'review';
        for (const l in back) t.secState[l] = 1;
        A.adj = null;
        A.buildGuide();
        return touching(app, t, back);
      });
      assert.equal(t.sfmode, 'guide');
      assert.ok(n.pairs > 200, mode + ': ' + n.pairs + ' pairs');
      assert.equal(n.same, 0, mode + ': touching sections sharing a marker');
    }
  });
  test('zones laid in one go (sections moved into a zone) are each laid over their own extent, as when laid alone', () => {
    for (const shape of ['radial', 'serpentine']) {
      const { t, A } = appWith(['Honolulu 120']);
      const g = grid(t, 12, 10);
      style(t, { family: 'gradient', gradShape: 'serpentine', limitN: 12 });
      A.buildGuide();
      const z = A.zoneNew();
      A.zoneSelect(z.id);
      Object.assign(t.styleVars, { family: 'gradient', gradShape: shape, look: 'smooth', limitN: 6 });
      const blk = [];
      for (let r = 4; r < 10; r++) for (let c = 6; c < 12; c++) blk.push(g.at(c, r));
      t.reassign(t.zoneMove(blk, z.id));
      const one = blk.map((l) => t.assignData.assign[l].mkey).join();
      t.reassign([z.id]);
      assert.equal(blk.map((l) => t.assignData.assign[l].mkey).join(), one, shape + ': the same layout');
    }
  });
  test('touching sections: specks in a porous line are looked across, as the line is; one kept by a tap is a section', () => {
    const { t } = appWith(['Honolulu 120']);
    // 1 | a 6 px line with a column of 2 × 2 specks in it (each a cell of its own) | 2
    const W = 300,
      H = 300,
      L = new Int32Array(W * H),
      comps = [null, { cx: 70, cy: 150, area: 140 * 300 }, { cx: 223, cy: 150, area: 154 * 300 }];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let l = x < 140 ? 1 : x < 146 ? -1 : 2;
        if (x >= 142 && x < 144) {
          l = 3 + (y >> 1);
          comps[l] = comps[l] || { cx: 143, cy: y + 1, area: 4 };
        }
        L[y * W + x] = l;
      }
    ready(t, W, H, L, comps);
    t.secState = new Uint8Array(comps.length);
    assert.ok(t.colour.adj()[1] && t.colour.adj()[1].has(2), '1 and 2 touch across the line and its specks');
    // a 3 × 3 section kept by a tap, ringed by a line inside a big one, touches it
    const W2 = 60,
      L2 = new Int32Array(W2 * W2).fill(1);
    for (let y = 19; y <= 23; y++)
      for (let x = 19; x <= 23; x++) L2[y * W2 + x] = y === 19 || y === 23 || x === 19 || x === 23 ? -1 : 2;
    ready(t, W2, W2, L2, [null, { cx: 30, cy: 30, area: 3575 }, { cx: 21, cy: 21, area: 9 }]);
    t.secState = Uint8Array.from([0, 0, 1]);
    assert.ok(t.colour.adj()[2] && t.colour.adj()[2].has(1), 'the kept one touches the one round it');
  });
  test('touching sections never share a marker, nor two markers that look the same (under 2.5), while another would do', () => {
    // (36 Skin Tones: many markers within 2.5 of another; Mixed with "clearly different" off included)
    for (const [mode, o, most] of [
      ['Main colour', { balance: 'main', limitN: 12 }, 3],
      ['No repeats', { noRep: true }, 0],
      ['Mixed', { limitN: 12 }, 0],
    ]) {
      let same = 0,
        twin = 0,
        pairs = 0;
      for (let k = 0; k < 8; k++) {
        const { app, t, A } = appWith(['36 Skin Tones']);
        grid(t, 12, 10);
        style(t, Object.assign({ balSeed: 0.2 * k + 0.1 }, o));
        const n = seeded(11 + k, () => {
          A.buildGuide();
          return touching(app, t);
        });
        same += n.same;
        twin += n.twin;
        pairs += n.pairs;
      }
      assert.ok(
        same + twin <= most,
        `${mode}: ${same} sharing a marker and ${twin} look-alikes in ${pairs} touching pairs`,
      );
    }
  });
  test('with hundreds of markers, laying Random compares few pairs of them by eye (CIEDE2000)', () => {
    // (720 markers: "clearly different" tried every one against every neighbour, a second or more on an iPad; the
    // look-alike check of v304 looks at plain L*a*b* distance first, so most pairs need no CIEDE2000)
    const { app, t, A } = appWith([]);
    grid(t, 25, 20, 20);
    const d = app.de2000;
    for (const [mode, o, most] of [
      ['clearly different', { noAdj: true }, 30000],
      ['Mixed', {}, 3000],
      ['No repeats', { noRep: true }, 3000],
      ['Main colour', { balance: 'main' }, 10000],
    ]) {
      style(t, Object.assign({ limitN: 400 }, o));
      let n = 0;
      app.de2000 = (a, b) => (n++, d(a, b));
      try {
        seeded(3, () => (t.sfmode === 'guide' ? t.reassign() : A.buildGuide()));
      } finally {
        app.de2000 = d;
      }
      assert.ok(n < most, `${mode}: ${n} with ${t.coll.length} markers`);
    }
  });
  test("the Gradient's order of markers is worked out once: asked again, it is the same however little time there is", () => {
    const { t } = appWith(['Honolulu 320 (complete set)']);
    const ms = t.coll.filter((m, i) => m.lab && i % 2 === 0).slice(0, 150);
    const first = t.grad
      .sequence(ms, 1, false)
      .map((m) => m.mkey)
      .join();
    const now = Date.now;
    let clock = now();
    // (a clock that runs out at once: the tour gets no time to improve on its start)
    Date.now = () => (clock += 1000);
    try {
      assert.equal(
        t.grad
          .sequence(ms.slice(), 1, false)
          .map((m) => m.mkey)
          .join(),
        first,
      );
    } finally {
      Date.now = now;
    }
  });
  test('the last Blend anchor removed: three again, inside the zone being laid', () => {
    const { t, A } = appWith(['Honolulu 120']);
    const g = grid(t, 10, 8);
    style(t, { family: 'blend', limitN: 12 });
    A.buildGuide();
    const z = A.zoneNew();
    A.zoneSelect(z.id);
    t.styleVars.family = 'blend';
    const blk = [];
    for (let r = 5; r < 8; r++) for (let c = 7; c < 10; c++) blk.push(g.at(c, r));
    t.reassign(t.zoneMove(blk, z.id));
    t.anchors.length = 0;
    A.blendNow();
    const b = t.zoneBoxOf(t.zoneSecs(z.id));
    assert.equal(t.anchors.length, 3);
    for (const a of t.anchors)
      assert.ok(a.x >= b.x0 && a.x <= b.x1 && a.y >= b.y0 && a.y <= b.y1, `(${a.x}, ${a.y}) in the zone`);
    assert.ok(new Set(blk.map((l) => t.assignData.assign[l].mkey)).size > 1, 'not one marker everywhere');
  });
  test('one marker to use: the count says "all · 1" (v308: "all (1)" before) and its slider can\'t move', () => {
    const { app, t, A } = appWith([]);
    const E = app.__eval;
    E('state.owned = new Set([presetMkeys(MARKER_SETS[0])[0]])');
    t.coll = E('sfCollection()');
    grid(t, 4, 4);
    style(t, { family: 'gradient' });
    const h = A.colours();
    assert.match(h, /id="sfMkNlbl">all · 1</);
    assert.match(h, /id="sfMkCount"[^>]* disabled/);
  });
  test("what the last laying worked out (Balance's figures, how many markers) goes with a new picture and with Undo", () => {
    const { t, A } = appWith(['Honolulu 120']);
    grid(t, 12, 9);
    style(t, { balance: 'main' });
    A.buildGuide();
    A.planCommit();
    assert.ok(Object.keys(A.balStat).length && A.lastPoolN > 0);
    t.styleVars.balSeed = 0.8;
    t.reassign();
    A.planUndo();
    // (the count is worked out again from the settings Undo put back; Balance's figures wait for the next laying)
    assert.equal(Object.keys(A.balStat).length, 0, 'after Undo');
    t.reassign();
    assert.ok(A.lastPoolN > 0);
    A.resetForNewPicture();
    assert.deepEqual([Object.keys(A.balStat).length, A.lastPoolN], [0, 0], 'a new picture');
  });
}

// ---- from v305-guide.test.mjs ----
// v305 (guide: 30-palette-assign): a new Blend's three anchors are placed over the drawing's own extent (the sections
// being coloured: a zone's, in a zone), and one that lands off those sections moves to the nearest one's label point,
// a section to itself, so none sits on the paper round the drawing. Their markers are vivid ones nearest red, green
// and blue round the hue wheel (the first used to be the pool's first in hue order: with Ben's 451, the brown E713).
{
  function appWith(owned) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    E(owned);
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, t, A: t.assign };
  }
  // an L of square sections (a column down the left, a row along the bottom) in the middle of a page whose paper round
  // it is a section of its own, not coloured
  function lPage(t, n = 6, off = 200, size = 600, cell = 24, lw = 2) {
    const W = size,
      H = size,
      labels = new Int32Array(W * H).fill(1);
    const comps = [
      null,
      {
        area: W * H,
        bg: true,
        bpx: 0,
        cx: 10,
        cy: 10,
        h: H,
        x0: 0,
        y0: 0,
        x1: W - 1,
        y1: H - 1,
        merged: false,
      },
    ];
    const at = {};
    for (let y = off; y < off + n * (cell + lw) + lw; y++)
      labels.fill(-1, y * W + off, y * W + off + n * (cell + lw) + lw);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (c > 0 && r < n - 1) continue;
        const l = comps.length,
          x0 = off + lw + c * (cell + lw),
          y0 = off + lw + r * (cell + lw);
        comps.push({
          area: cell * cell,
          bg: false,
          bpx: 0,
          cx: x0 + cell / 2,
          cy: y0 + cell / 2,
          h: cell - 1,
          x0,
          y0,
          x1: x0 + cell - 1,
          y1: y0 + cell - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + cell; y++) labels.fill(l, y * W + x0, y * W + x0 + cell);
        at[c + ',' + r] = l;
      }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.secState[1] = 0;
    t.secColor = new Array(comps.length).fill([200, 200, 200]);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    return { at, secs: Object.values(at) };
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      { family: 'blend', paletteSource: 'owned', palette: 'all', emphasis: 'neutral', limitN: 16 },
      o,
    );
  const onSec = (t, a) => t.labels[Math.round(a.y) * t.W + Math.round(a.x)];
  test('a new Blend’s anchors sit on the drawing’s sections, each on its own, not on the paper round it', () => {
    const { t, A } = appWith('state.owned = defaultOwned()');
    const g = lPage(t);
    style(t);
    A.buildGuide();
    assert.equal(t.sfmode, 'guide');
    const own = new Set(g.secs),
      on = t.anchors.map((a) => onSec(t, a));
    assert.equal(t.anchors.length, 3);
    for (const L of on) assert.ok(own.has(L), 'on section ' + L + ', one of the drawing’s');
    assert.equal(new Set(on).size, 3, 'three different sections');
    // laid again from nothing (Reset anchors): the same places
    const k = JSON.stringify(t.anchors);
    t.anchors.length = 0;
    A.blendNow();
    assert.equal(JSON.stringify(t.anchors), k);
  });
  test('in a zone, the anchors brought back sit on the zone’s own sections', () => {
    const { t, A } = appWith('state.owned = defaultOwned()');
    const g = lPage(t, 8);
    style(t);
    A.buildGuide();
    const z = A.zoneNew();
    A.zoneSelect(z.id);
    t.styleVars.family = 'blend';
    // the bottom row's right half
    const blk = [4, 5, 6, 7].map((c) => g.at[c + ',7']);
    t.reassign(t.zoneMove(blk, z.id));
    t.anchors.length = 0;
    A.blendNow();
    const own = new Set(blk);
    assert.equal(t.anchors.length, 3);
    for (const a of t.anchors)
      assert.ok(own.has(onSec(t, a)), `(${a.x}, ${a.y}) on one of the zone’s sections`);
  });
  test('a new Blend’s anchor markers: vivid, far apart round the hue wheel; with Ben’s 451 not the brown E713 first', () => {
    for (const [what, owned] of [
      ['Ben’s 451', 'state.owned = defaultOwned()'],
      ['Honolulu 24', 'state.owned = new Set(presetMkeys(MARKER_SETS[1]))'],
    ]) {
      const { t, A } = appWith(owned);
      lPage(t);
      style(t);
      A.buildGuide();
      const by = {};
      t.coll.forEach((m) => {
        by[m.mkey] = m;
      });
      const cs = t.coll.map((m) => t.colour.lch(m)[1]).sort((a, b) => a - b),
        med = cs[Math.floor(cs.length / 2)];
      const a = t.anchors.map((x) => {
        const l = t.colour.lch(by[x.mkey]);
        return { k: x.mkey, c: l[1], h: ((l[2] % 360) + 360) % 360 };
      });
      assert.equal(new Set(a.map((x) => x.k)).size, 3, what + ': three markers');
      if (what === 'Ben’s 451') assert.notEqual(a[0].k, 'Ohuhu|E713');
      for (const x of a) assert.ok(x.c >= med, `${what}: ${x.k} as colourful as the middle or more`);
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++) {
          const d = Math.abs(a[i].h - a[j].h);
          assert.ok(Math.min(d, 360 - d) >= 60, `${what}: ${a[i].k} and ${a[j].k} far apart in hue`);
        }
    }
  });
  test('a Blend with fewer than three markers still starts with three anchors', () => {
    const { t, A } = appWith('state.owned = new Set(presetMkeys(MARKER_SETS[0]).slice(0, 2))');
    lPage(t);
    style(t);
    A.buildGuide();
    assert.equal(t.anchors.length, 3);
    for (const a of t.anchors) assert.ok(t.coll.some((m) => m.mkey === a.mkey));
  });
}

// ---- from v307-guide.test.mjs ----
// v307 (the guide's Plan): big pages laid "all · 268, some twice" have no two touching sections sharing a marker;
// Undo and Redo keep how the markers were picked (shading-aware), so the Start colour line stays right; Colour it on
// the paper round the drawing smooths its rough spots in the same step, and the rough line shows with the first-time
// tip; Smooth them never brings in a marker whose own highlight or shadow is the other brand of a code the guide
// uses; a photo with no colour says "N sections · left white", with Colour along off.
{
  // an app with Ben's own markers (defaultOwned: 451), or these sets, owned
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    if (sets) {
      E('state.owned = new Set()');
      for (const n of sets)
        E(
          `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
        );
    } else E('state.owned = new Set(defaultOwned())');
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, E, t };
  }
  // cols × rows sections of uneven sizes (from a seed), lines lw px between them; ready to build
  function page(t, cols, rows, cell = 24, lw = 2, seed = 1) {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
      ws = Array.from({ length: cols }, () => Math.round(cell * (0.6 + r() * 0.8))),
      hs = Array.from({ length: rows }, () => Math.round(cell * (0.6 + r() * 0.8))),
      W = ws.reduce((a, b) => a + b + lw, lw),
      H = hs.reduce((a, b) => a + b + lw, lw),
      labels = new Int32Array(W * H).fill(-1),
      comps = [null];
    let y0 = lw;
    for (let rr = 0; rr < rows; rr++) {
      let x0 = lw;
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          w = ws[c],
          h = hs[rr];
        comps.push({
          area: w * h,
          bg: false,
          bpx: 0,
          cx: x0 + w / 2,
          cy: y0 + h / 2,
          h: h - 1,
          x0,
          y0,
          x1: x0 + w - 1,
          y1: y0 + h - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + h; y++) labels.fill(l, y * W + x0, y * W + x0 + w);
        x0 += w + lw;
      }
      y0 += hs[rr] + lw;
    }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    for (const k in t.locks) delete t.locks[k];
    return t.countedList();
  }
  // a drawn-looking page: n cells round random points (half of them packed towards the middle, as a mandala's small
  // sections are), lines 2px wide between them; ready to build. Each touches about six others, of all sizes.
  function vor(t, n, W, H, seed = 7) {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647,
      P = [];
    for (let i = 0; i < n; i++) {
      if (r() < 0.5) {
        const a = r() * 2 * Math.PI,
          d = Math.pow(r(), 1.5) * Math.min(W, H) * 0.45;
        P.push([W / 2 + Math.cos(a) * d, H / 2 + Math.sin(a) * d]);
      } else P.push([r() * W, r() * H]);
    }
    const G = 24,
      gw = Math.ceil(W / G),
      gh = Math.ceil(H / G),
      B = Array.from({ length: gw * gh }, () => []);
    P.forEach((p, i) =>
      B[Math.min(gh - 1, Math.floor(p[1] / G)) * gw + Math.min(gw - 1, Math.floor(p[0] / G))].push(i),
    );
    const lab = new Int32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const bx = Math.floor(x / G),
          by = Math.floor(y / G);
        let best = -1,
          bd = Infinity;
        for (let rad = 0; rad < 60; rad++) {
          for (let yy = by - rad; yy <= by + rad; yy++)
            for (let xx = bx - rad; xx <= bx + rad; xx++) {
              if (yy < 0 || xx < 0 || yy >= gh || xx >= gw) continue;
              if (Math.max(Math.abs(yy - by), Math.abs(xx - bx)) !== rad) continue;
              for (const i of B[yy * gw + xx]) {
                const d = (P[i][0] - x) ** 2 + (P[i][1] - y) ** 2;
                if (d < bd) {
                  bd = d;
                  best = i;
                }
              }
            }
          if (best >= 0 && Math.sqrt(bd) < rad * G) break;
        }
        lab[y * W + x] = best + 1;
      }
    const labels = new Int32Array(W * H),
      comps = [null];
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x,
          l = lab[p],
          edge =
            (x + 1 < W && lab[p + 1] !== l) ||
            (y + 1 < H && lab[p + W] !== l) ||
            (x + 2 < W && lab[p + 2] !== l) ||
            (y + 2 < H && lab[p + 2 * W] !== l);
        labels[p] = edge ? -1 : l;
      }
    for (let i = 1; i <= n; i++)
      comps.push({ area: 0, bg: false, bpx: 0, sx: 0, sy: 0, x0: W, y0: H, x1: -1, y1: -1, merged: false });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const l = labels[y * W + x];
        if (l < 1) continue;
        const c = comps[l];
        c.area++;
        c.sx += x;
        c.sy += y;
        c.x0 = Math.min(c.x0, x);
        c.y0 = Math.min(c.y0, y);
        c.x1 = Math.max(c.x1, x);
        c.y1 = Math.max(c.y1, y);
      }
    for (const c of comps) {
      if (!c) continue;
      if (!c.area) c.merged = true;
      c.cx = c.area ? c.sx / c.area : 0;
      c.cy = c.area ? c.sy / c.area : 0;
      c.h = Math.max(0, c.y1 - c.y0);
    }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    for (const k in t.locks) delete t.locks[k];
    return t.countedList();
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'gradient',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        gradSeed: 0,
        gradScat: 0,
        gradJit: 0,
        gradFix: false,
        dir: 1,
        look: 'auto',
        gradShape: 'serpentine',
        limitN: 999,
        shadeMode: 'off',
      },
      o,
    );
  const keys = (t) => t.assignData.order.map((l) => t.assignData.assign[l].mkey);
  // touching sections sharing a marker
  function same(t) {
    const a = t.colour.adj(),
      A = t.assignData.assign;
    let n = 0;
    for (const k in a)
      a[k].forEach((q) => {
        if (q > +k && A[k] && A[q] && A[k].mkey === A[q].mkey) n++;
      });
    return n;
  }
  // ---- Bug 2: "all · 268, some twice" ----

  test('big pages at “all · 268, some twice”: no two touching sections share a marker, at every Scatter stop and Flow', () => {
    const { t } = appWith();
    let left = 0;
    for (const [n, W, H] of [
      [960, 900, 1100], // about 940 sections (as the 954-section page)
      [1430, 1000, 1300], // about 1,390 (as the 1,423-section page)
    ]) {
      const cl = vor(t, n, W, H);
      assert.ok(cl.length > 900, cl.length + ' sections');
      for (const shape of ['serpentine', 'radial', 'around']) {
        for (const sc of [0, 1, 3]) {
          style(t, { gradShape: shape, gradScat: sc, gradJit: 0.2 });
          // (v308: the count says "all · 268"; it said ", some twice" too)
          assert.equal(t.grad.mkCountLabel(), 'all · 268');
          t.grad.build(cl);
          const k = keys(t),
            tag = `${cl.length} ${shape} ${sc}`;
          left += t.grad.same.before;
          assert.equal(same(t), 0, tag + ': touching sections sharing a marker');
          assert.equal(t.grad.same.after, 0, tag);
          // still the 268 clear markers, each used
          assert.equal(new Set(k).size, 268, tag + ': every clear marker');
          // deterministic: laid again, the same
          t.grad.build(cl);
          assert.deepEqual(keys(t), k, tag + ': laid again, the same');
        }
      }
    }
    // (the smoothing alone left hundreds: v306 laid them)
    assert.ok(left > 100, left + ' pairs left by the smoothing');
  });
  test('big pages: the pass keeps the Start colour, pins and sections with ink, and moves one of each pair only', () => {
    const { t } = appWith();
    const cl = vor(t, 960, 900, 1100);
    style(t, {});
    t.grad.build(cl);
    const first = t.assignData.order[0],
      A = t.assignData.assign;
    // pin a few sections to the marker of a section they touch, so they share one with it
    const a = t.colour.adj(),
      pins = {};
    for (const l of cl.filter((l, i) => i % 150 === 75)) {
      const q = [...a[l]].find((q) => !pins[q] && q !== first);
      pins[l] = A[q].mkey;
      pins[q] = A[q].mkey;
    }
    const np = Object.keys(pins).length / 2;
    Object.assign(t.locks, pins);
    t.grad.build(cl);
    const B = t.assignData.assign;
    for (const l in pins) assert.equal(B[l].mkey, pins[l], 'pinned ' + l + ' keeps its marker');
    // (each pinned pair shares one, as pinned: the only pairs left)
    assert.equal(same(t), np);
    assert.equal(B[first].mkey, A[first].mkey, 'the Start colour kept');
    const s = t.grad.same;
    assert.ok(s.before > np && s.after === np && s.moved <= s.before - np, JSON.stringify(s));
  });
  test('a 216-section page and a lower count are laid as before (no marker used twice: nothing for the pass to do)', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, {});
    t.grad.build(cl);
    assert.equal(t.grad.same, null);
    assert.equal(t.grad.smoothed.mode, '');
    style(t, { limitN: 200 });
    page(t, 24, 20);
    t.grad.build(t.countedList());
    assert.equal(t.grad.same, null);
  });
  test('the Photo pattern before it has a photo (laid as the Gradient) splits up its repeats too', () => {
    const { t } = appWith();
    const cl = vor(t, 960, 900, 1100);
    style(t, { family: 'photo' });
    t.grad.build(cl);
    assert.equal(t.grad.smoothed.mode, 'split');
    assert.equal(same(t), 0);
  });
  // ---- Bug 3: Undo keeps how the markers were picked ----

  test('Undo and Redo keep the shading-aware picks, so the Start colour line names the marker the picture starts with', () => {
    const { t } = appWith(['Honolulu 48']);
    page(t, 24, 20);
    style(t, { limitN: 16, shadeMode: 'full' });
    t.assign.buildGuide();
    assert.equal(t.assignData.shp, 1);
    const start = () => {
      const g = t.gradStartInfo();
      return g.cols[g.r].mkey;
    };
    const s0 = start(),
      first0 = keys(t)[0];
    assert.equal(s0, first0, 'the Start colour is the first section’s marker');
    // a change, then Undo and Redo
    t.styleVars.dir = -1;
    t.reassign();
    const s1 = start(),
      first1 = keys(t)[0];
    assert.equal(t.assignData.shp, 1);
    assert.equal(s1, first1);
    t.assign.planUndo();
    assert.equal(t.assignData.shp, 1, 'kept by Undo');
    assert.equal(keys(t)[0], first0);
    assert.equal(start(), s0, 'Undo: the Start colour line is right');
    t.assign.planRedo();
    assert.equal(t.assignData.shp, 1, 'kept by Redo');
    assert.equal(start(), s1, 'Redo: the Start colour line is right');
    // (a guide laid with shading off: none after Undo either)
    style(t, { limitN: 16, shadeMode: 'off' });
    t.reassign();
    t.styleVars.dir = 1;
    t.reassign();
    t.styleVars.dir = -1;
    t.reassign();
    t.assign.planUndo();
    assert.ok(!t.assignData.shp);
  });
  // ---- Bug 9: Smooth them and the shading's partners ----

  test('Smooth them never brings in a marker whose own highlight or shadow is the other brand of a code the guide uses', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, { shadeMode: 'full' });
    t.grad.build(cl);
    const A0 = { ...t.assignData.assign },
      pairs = t.grad.rough(cl, A0);
    assert.ok(pairs.length > 5);
    // the run as Smooth them makes it, with shading on: which markers it brings in
    const bk = Object.fromEntries(t.coll.map((m) => [m.mkey, m]));
    const run = (A, ext) =>
      t.grad.fixRun(
        cl,
        A,
        t.coll.filter((m) => {
          const x = t.colour.lch(m);
          return x[1] >= 20 && x[0] >= 34 && x[0] <= 90;
        }),
        (l) => l === t.assignData.order[0],
        ext,
      );
    const A1 = { ...A0 },
      free = run(A1, { used: new Set(), codes: new Set(), part: {} });
    assert.ok(free.swaps.length > 0);
    // a marker it brings in whose own highlight or shadow has a code in both brands (Ben's markers have many)
    let s = -1,
      mk = null,
      m = null,
      other = null;
    for (const [l, k] of free.swaps) {
      const q = t.shadeTones(bk[k]);
      for (const x of [q.light, q.dark].filter(Boolean)) {
        const o = t.coll.find((y) => y.code === x.code && y.mkey !== x.mkey);
        if (o && !other) [s, mk, m, other] = [l, k, bk[k], o];
      }
    }
    assert.ok(other, 'a partner whose code is in both brands');
    const tones = (l, x) => {
      const q = t.shadeTones(x);
      return [q.light, q.dark].filter(Boolean);
    };
    const ext = { used: new Set([other.mkey]), codes: new Set([other.code]), part: {}, tones };
    const A2 = { ...A0 },
      r = run(A2, ext);
    assert.ok(!r.swaps.some((x) => x[1] === mk && x[0] === s), m.code + ' not brought in where it was');
    // nothing it brings in has a highlight or shadow of the other brand of a code in the guide
    const by = {};
    const note = (x) => (by[x.code] = by[x.code] || new Set()).add(x.mkey);
    Object.values(A2).forEach(note);
    note(other);
    for (const [l, k] of r.swaps)
      for (const x of tones(l, bk[k]))
        assert.ok(!by[x.code] || by[x.code].has(x.mkey), `${bk[k].code}'s ${x.code}`);
    // and the list follows each swap: two markers brought in never have partners of one code in both brands
    const parts = {};
    for (const [l, k] of r.swaps)
      for (const x of tones(l, bk[k])) (parts[x.code] = parts[x.code] || new Set()).add(x.mkey);
    for (const c in parts) assert.equal(parts[c].size, 1, c + ' in one brand only');
  });
  test('Smooth them with shading on: gradFixExt hands the fix each marker’s highlight and shadow; with shading off, none', () => {
    const { t } = appWith();
    const cl = page(t, 18, 12);
    style(t, { shadeMode: 'full', gradFix: true });
    t.grad.build(cl);
    const f = t.grad.fixed;
    assert.ok(f && f.swaps.length > 0);
    // no code in the guide in both brands, as a marker, a highlight or a shadow, that wasn't before the fix
    const by = (A) => {
      const o = {};
      const add = (x) => (o[x.code] = o[x.code] || new Set()).add(x.mkey);
      for (const l in A) {
        add(A[l]);
        const q = t.shadeTones(A[l]);
        [q.light, q.dark].filter(Boolean).forEach(add);
      }
      return Object.keys(o).filter((c) => o[c].size > 1);
    };
    const after = by(t.assignData.assign);
    style(t, { shadeMode: 'full', gradFix: false });
    t.grad.build(cl);
    const before = by(t.assignData.assign);
    assert.deepEqual(
      after.filter((c) => !before.includes(c)),
      [],
      'no new code in both brands',
    );
  });
  // ---- Bug 12: a photo with no colour ----

  test('every section left white: the status says “N sections · left white” and Colour along is off', () => {
    const { t } = appWith();
    page(t, 18, 12);
    style(t, {});
    t.assign.buildGuide();
    assert.equal(t.assign.guideWhite(), 0);
    assert.doesNotMatch(t.assign.planBar(), /disabled/);
    // (as the Photo pattern leaves it with no colour in the photo: no markers, every section paper)
    const paper = {};
    for (const l of t.assignData.order) paper[l] = 1;
    t.assignData = { assign: {}, order: [], N: 0, base: {}, paper };
    assert.equal(t.assign.guideWhite(), 216);
    assert.match(t.assign.planBar(), /id="sfColor" class="sfcolorcta" disabled/);
    // (a pinned section keeps its marker: a guide with one marker, said as before)
    const l0 = Object.keys(paper)[0];
    delete paper[l0];
    t.assignData = { assign: { [l0]: t.coll[0] }, order: [+l0], N: 1, base: {}, paper };
    assert.equal(t.assign.guideWhite(), 0);
    assert.doesNotMatch(t.assign.planBar(), /disabled/);
  });
}

// ---- from v3081-d3.test.mjs ----
// v308.2 (a review of getting a picture in and the Plan): with a small collection the marker count's end is what
// "all" lays, so every count up to it can be chosen.
{
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    t.coll = E('sfCollection()');
    t.assign.quiet();
    return { app, E, t };
  }
  // cols × rows sections, 20 px square, 2 px lines between them
  function page(t, cols, rows) {
    const cell = 20,
      lw = 2,
      W = cols * (cell + lw) + lw,
      H = rows * (cell + lw) + lw,
      labels = new Int32Array(W * H).fill(-1),
      comps = [null];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const l = comps.length,
          x0 = lw + c * (cell + lw),
          y0 = lw + r * (cell + lw);
        comps.push({
          area: cell * cell,
          bg: false,
          bpx: 0,
          cx: x0 + cell / 2,
          cy: y0 + cell / 2,
          h: cell - 1,
          x0,
          y0,
          x1: x0 + cell - 1,
          y1: y0 + cell - 1,
          merged: false,
        });
        for (let y = y0; y < y0 + cell; y++) labels.fill(l, y * W + x0, y * W + x0 + cell);
      }
    t.W = W;
    t.H = H;
    t.labels = labels;
    t.comps = comps;
    t.secState = new Uint8Array(comps.length).fill(1);
    t.colored = new Uint8Array(comps.length);
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    return t.countedList();
  }
  const style = (t, o) =>
    Object.assign(
      t.styleVars,
      {
        family: 'gradient',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        gradSeed: 0,
        gradScat: 0,
        gradJit: 0,
        gradFix: false,
        dir: 1,
        look: 'auto',
        gradShape: 'serpentine',
        limitN: 999,
        shadeMode: 'off',
        gradIncl: {},
      },
      o,
    );
  const usedN = (t) => new Set(t.assignData.order.map((l) => t.assignData.assign[l].mkey)).size;
  test('a 12-marker set: the count’s end is what “all” lays, and the count one under it lays one fewer', () => {
    const { t } = appWith(['Ciao 12']);
    const cl = page(t, 14, 10);
    for (const palette of ['all', 'cool']) {
      style(t, { palette });
      const all = t.grad.countNow();
      // (fewer than 8 left after the Include row and the vivid test, so "all" takes in the nearest ones)
      assert.ok(all.all && all.M >= 3, palette + ': all lays ' + all.M);
      assert.equal(t.grad.mkCap(), all.M, palette + ': the slider ends at what all lays');
      assert.equal(t.grad.mkCountLabel(), 'all · ' + all.M);
      t.grad.build(cl);
      assert.equal(usedN(t), all.M);
      // one under the end is a count, not all, and lays that many
      style(t, { palette, limitN: all.M - 1 });
      assert.equal(t.grad.mkCountLabel(), String(all.M - 1));
      assert.equal(t.grad.countNow().M, all.M - 1);
      t.grad.build(cl);
      assert.equal(usedN(t), all.M - 1);
    }
  });
}

// ---- from v3083-blend.test.mjs ----
// v308.3 Blend's choice of markers (blendChoose, 30-palette-assign): the count's worth of the sections' ideal markers
// that best cover them, the anchors' own always among them, the same every time. (In the browser, on the sample:
// e2e/v3083-blend.)
{
  const app = createApp(),
    t = app.__mstest,
    E = app.__eval;
  // 60 real markers spread round the colours, each the ideal of some sections (weights 1 to 7)
  const U = E(
    'COLORS.filter((c, i) => i % 7 === 0).slice(0, 60).map((c) => ({ mkey: mkey(COLORS.indexOf(c)), lab: c.lab || hexToLab(c.hex) }))',
  );
  const wt = Float64Array.from(U.map((_, i) => 1 + (i % 7)));
  const de = E('de2000');
  // the weighted distance from each ideal to its nearest chosen
  const cost = (r) => U.reduce((s, m, i) => s + wt[i] * de(m.lab, U[r.near[i]].lab), 0);
  test('never more than N; the anchors’ own kept; each ideal goes to its nearest chosen; the same every time', () => {
    assert.equal(U.length, 60);
    assert.ok(U.every((m) => m.lab && m.lab.length === 3));
    const F = [3, 17, 41];
    let prev = Infinity;
    for (const N of [3, 4, 6, 8, 12, 16, 24, 40]) {
      const r = t.assign.blendChoose(U, wt, F, N),
        pick = [...r.pick];
      assert.equal(new Set(pick).size, N, 'N of them at ' + N);
      for (const f of F) assert.ok(pick.includes(f), 'anchor ' + f + ' kept at ' + N);
      for (let i = 0; i < U.length; i++) {
        const d = de(U[i].lab, U[r.near[i]].lab);
        assert.ok(pick.includes(r.near[i]));
        for (const j of pick) assert.ok(d <= de(U[i].lab, U[j].lab) + 1e-9);
      }
      const c = cost(r);
      assert.ok(c < prev, 'closer with more: ' + N);
      prev = c;
      assert.deepEqual([...t.assign.blendChoose(U, wt, F, N).pick], pick, 'the same again');
    }
    // as many as there are, or more: all of them, each its own
    const all = t.assign.blendChoose(U, wt, F, 60);
    assert.deepEqual([...all.near], [...U.keys()]);
    // more anchors than N: N of the anchors'
    const two = t.assign.blendChoose(U, wt, F, 2);
    assert.equal(two.pick.length, 2);
    assert.ok([...two.pick].every((j) => F.includes(j)));
  });
  test('better than spreading the count round the colour wheel first (as Blend did before v308.3)', () => {
    // the old way's stand-in: every (60/N)th ideal in hue order
    const byHue = U.map((m, i) => [Math.atan2(m.lab[2], m.lab[1]), i])
      .sort((a, b) => a[0] - b[0])
      .map((x) => x[1]);
    for (const N of [8, 16]) {
      const spread = byHue.filter((_, k) => k % (60 / N) < 1).slice(0, N);
      const near = U.map((m) =>
        spread.reduce((b, j) => (de(m.lab, U[j].lab) < de(m.lab, U[b].lab) ? j : b), spread[0]),
      );
      const old = cost({ near }),
        now = cost(t.assign.blendChoose(U, wt, [], N));
      assert.ok(now < old, `${N}: ${now.toFixed(0)} < ${old.toFixed(0)}`);
    }
  });
}

// ---- from v313-family.test.mjs ----
// v313 (D3): a marker's family from its code is its letters and first digit (Ohuhu Y213 with Y26, as Ohuhu numbers
// them; Copic B000 and B0000 before B00), for a guide made since v313 (famRule 1); a guide saved before keeps v312's
// rule (famRule 0) for good. A blend companion from the family is never more than 20 lighter or darker. famRule is
// saved only when 1.
{
  function appWith(owned) {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    E('state.owned = new Set(' + JSON.stringify(owned || []) + ')');
    core.coll = E('sfCollection()');
    return { app, E, core, K: core.colour, sv: core.styleVars, coll: core.coll };
  }
  const fv = (K, c) => JSON.parse(JSON.stringify(K.famVal(c)));
  test('famVal: v312’s rule while famRule is 0 (a guide saved before), letters and first digit once it’s 1', () => {
    const { K, sv } = appWith();
    assert.equal(sv.famRule, 0, 'starts at 0, as a guide saved before opens');
    assert.deepEqual(fv(K, 'Y213'), { fam: 'Y21', val: 3 });
    assert.deepEqual(fv(K, 'Y26'), { fam: 'Y2', val: 6 });
    assert.deepEqual(fv(K, 'B000'), { fam: 'B00', val: 0 });
    sv.famRule = 1;
    assert.deepEqual(fv(K, 'Y213'), { fam: 'Y2', val: 13 });
    assert.deepEqual(fv(K, 'Y26'), { fam: 'Y2', val: 6 });
    assert.deepEqual(fv(K, 'Y210'), { fam: 'Y2', val: 10 });
    // Copic's palest: B0000, B000, B00, then B01, B02
    assert.deepEqual(
      ['B0000', 'B000', 'B00', 'B01', 'B05'].map((c) => fv(K, c)),
      [
        { fam: 'B0', val: -2 },
        { fam: 'B0', val: -1 },
        { fam: 'B0', val: 0 },
        { fam: 'B0', val: 1 },
        { fam: 'B0', val: 5 },
      ],
    );
    // one digit: its letters, as before; no letters: none
    assert.deepEqual(fv(K, 'N3'), { fam: 'N', val: 3 });
    assert.equal(K.famVal('100'), null);
  });
  test('v313’s rule over each brand’s whole catalogue: no two markers of a family share a number', () => {
    const { app, K, sv } = appWith();
    sv.famRule = 1;
    const cat = JSON.parse(app.__eval('JSON.stringify(COLORS.map((c) => [c.brand, c.code]))'));
    const seen = new Map();
    let n = 0;
    for (const [b, code] of cat) {
      const f = K.famVal(code);
      if (!f) continue;
      n++;
      const k = b + '|' + f.fam + '|' + f.val;
      assert.ok(!seen.has(k), `${b} ${code} and ${seen.get(k)}: both ${f.fam} ${f.val}`);
      seen.set(k, code);
    }
    assert.ok(n > 600, n + ' codes');
  });
  test('blend companions in a guide made since v313: a family one is never more than 20 lighter or darker; Ohuhu Y213’s lighter is from Y2x', () => {
    const { app, K, sv, coll } = appWith();
    sv.famRule = 1;
    const same = (a, b) => {
      const x = K.famVal(a.code),
        y = K.famVal(b.code);
      return a.brand === b.brand && x && y && x.fam === y.fam;
    };
    let n = 0,
      fam = 0;
    for (const m of coll)
      for (const side of [-1, 1]) {
        const c = K.companion(m.lab, m, coll, side);
        if (!c) continue;
        n++;
        const dL = (c.lab[0] - m.lab[0]) * -side;
        assert.ok(dL >= 4, `${m.brand} ${m.code} ${side}: ${c.code} lightness`);
        assert.ok(app.de2000(m.lab, c.lab) >= 3, `${m.code} ${side}: ${c.code} too close`);
        if (same(m, c)) {
          fam++;
          assert.ok(dL <= 20, `${m.brand} ${m.code} ${side}: ${c.code} ${dL.toFixed(1)} lighter or darker`);
        }
      }
    assert.ok(n > coll.length && fam > coll.length / 2, n + ' companions, ' + fam + ' from the family');
    const y213 = coll.find((x) => x.brand === 'Ohuhu' && x.code === 'Y213'),
      l = K.companion(y213.lab, y213, coll, -1);
    assert.ok(l && /^Y2\d$|^Y21\d$/.test(l.code), 'Y213 lighter: ' + (l && l.code));
  });
  test('a guide saved before v313 keeps v312’s companions: famRule 0 picks as v312 did', () => {
    // (v312's rule and no step limit: Ohuhu GG12's darker was GG15, 33 darker; since v313 a nearer one)
    const { K, sv, coll } = appWith();
    const gg12 = coll.find((x) => x.brand === 'Ohuhu' && x.code === 'GG12');
    const old = K.companion(gg12.lab, gg12, coll, 1);
    assert.equal(old && old.code, 'GG15');
    sv.famRule = 1;
    const now = K.companion(gg12.lab, gg12, coll, 1);
    assert.ok(
      now && now.code !== 'GG15' && gg12.lab[0] - now.lab[0] <= 20,
      'since v313: ' + (now && now.code),
    );
  });
  test('famRule is saved beside the section settings only when set (1, 2 since v315, 3 since v316, 4 since v318), and opens as saved (anything else as 0)', () => {
    const { app, core, sv } = appWith();
    const W = 4,
      H = 4;
    core.W = W;
    core.H = H;
    core.labels = new Int32Array(W * H).fill(1);
    core.secState = new Uint8Array(2);
    core.colored = new Uint8Array(2);
    core.assignData = { order: [1], assign: { 1: { mkey: 'Ohuhu|R16' } }, N: 1 };
    let d = core.currentDesignObj();
    assert.equal('famRule' in d.payload, false, 'a guide saved before saves as it was');
    sv.famRule = 1;
    d = core.currentDesignObj();
    assert.equal(d.payload.famRule, 1);
    const ks = Object.keys(d.payload);
    assert.equal(ks[ks.indexOf('addAutoClose') + 1], 'famRule', 'after addAutoClose');
    // (opening: STYLE_FIELDS' check, as styleFrom uses it)
    const f = [...core.styleFields].find((x) => x.key === 'famRule');
    assert.equal(f.in, 'payload');
    assert.equal(f.undo, false, 'not part of Undo');
    assert.equal(f.check(1, f.def), 1);
    assert.equal(f.check(undefined, f.def), 0);
    // (v315: 2 is Copic's greys in families too; v316: 3, blend companions outside the family a step a blend can make;
    // v318: 4, a companion a clear step away by eye; anything else as before)
    assert.equal(f.check(2, f.def), 2);
    assert.equal(f.check(3, f.def), 3);
    assert.equal(f.check(4, f.def), 4);
    assert.equal(f.check(5, f.def), 0);
    assert.equal(f.check('1', f.def), 0);
  });
  test('lowX (the running-low lines closed) is saved with the guide as a list, only when there are any, and opens as saved', () => {
    const { core } = appWith();
    const f = [...core.styleFields].find((x) => x.key === 'lowX');
    assert.equal(f.in, 'payload');
    assert.equal(f.undo, false);
    assert.equal(f.check(undefined, f.def), null);
    assert.equal(f.check([], f.def), null);
    assert.deepEqual(JSON.parse(JSON.stringify(f.check(['Ohuhu|R413', 5, 'Copic|B00'], f.def))), {
      'Ohuhu|R413': 1,
      'Copic|B00': 1,
    });
    assert.equal(f.check('Ohuhu|R413', f.def), null);
    core.styleVars.lowX = null;
    assert.equal(f.save(), undefined);
    core.styleVars.lowX = { 'Ohuhu|R413': 1 };
    assert.deepEqual([...f.save()], ['Ohuhu|R413']);
  });
}

// ---- from v315-family.test.mjs ----
// v315 (Q10g): Copic's greys are written with a hyphen (C-00, C-0, C-1 … C-10, and N-, T-, W-), which v313's family
// rule didn't read, so a grey had no family: its blend companions and shading were found by eye, across the grey
// types and into near-grey colours. In a guide made since v315 (famRule 2) each grey type is a family, palest first;
// a guide saved before (famRule 0 or 1) keeps its rule. Fails on v314.1.
{
  function appWith(owned) {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    if (owned === 'copic')
      E(
        'state.owned = new Set(COLORS.filter((c) => c.brand === "Copic").map((c) => c.brand + "|" + c.code))',
      );
    else if (owned === 'ben') E('state.owned = defaultOwned()');
    core.coll = E('sfCollection()');
    return { app, E, core, K: core.colour, sv: core.styleVars, coll: core.coll };
  }
  const fv = (K, c) => JSON.parse(JSON.stringify(K.famVal(c)));
  const code = (m) => (m ? m.brand[0] + ':' + m.code : '-');
  test('famVal: a Copic grey is its type’s family under famRule 2 (C-00 first), none under 0 and 1; other codes as before', () => {
    const { app, K, sv } = appWith();
    for (const r of [0, 1]) {
      sv.famRule = r;
      assert.equal(K.famVal('N-10'), null, 'rule ' + r);
    }
    sv.famRule = 2;
    assert.deepEqual(
      ['C-00', 'C-0', 'C-1', 'C-10', 'W-00', 'N-3', 'T-9'].map((c) => fv(K, c)),
      [
        { fam: 'C-', val: -1 },
        { fam: 'C-', val: 0 },
        { fam: 'C-', val: 1 },
        { fam: 'C-', val: 10 },
        { fam: 'W-', val: -1 },
        { fam: 'N-', val: 3 },
        { fam: 'T-', val: 9 },
      ],
    );
    // every other code reads as under rule 1, and no two Copic greys of a type share a number
    const cat = JSON.parse(app.__eval('JSON.stringify(COLORS.map((c) => [c.brand, c.code]))'));
    const seen = new Set();
    let greys = 0;
    for (const [b, c] of cat) {
      sv.famRule = 1;
      const one = JSON.stringify(K.famVal(c));
      sv.famRule = 2;
      const two = K.famVal(c);
      if (/-/.test(c)) {
        greys++;
        const k = b + '|' + two.fam + two.val;
        assert.ok(!seen.has(k), c);
        seen.add(k);
      } else assert.equal(JSON.stringify(two), one, c);
    }
    assert.equal(greys, 46, 'Copic’s 46 greys');
  });
  test('a full set of Copic: a grey’s companions and shading stay in its own grey type under famRule 2', () => {
    const { K, sv, coll, core } = appWith('copic');
    const by = (c) => coll.find((m) => m.code === c);
    sv.famRule = 1;
    const before = { dark: code(K.companion(by('C-6').lab, by('C-6'), coll, 1)) };
    sv.famRule = 2;
    assert.notEqual(before.dark, 'C:C-7', 'v314: across the types');
    assert.equal(code(K.companion(by('C-6').lab, by('C-6'), coll, 1)), 'C:C-7');
    assert.equal(code(K.companion(by('C-6').lab, by('C-6'), coll, -1)), 'C:C-5');
    assert.equal(code(K.companion(by('W-1').lab, by('W-1'), coll, -1)), 'C:W-00');
    // every grey: its companions and shading picks, where in its type, keep to it
    let inType = 0,
      all = 0;
    for (const m of coll.filter((x) => /-/.test(x.code))) {
      const t = m.code.split('-')[0] + '-';
      for (const side of [-1, 1])
        for (const p of [K.companion(m.lab, m, coll, side), core.shadePick(m, coll, side)]) {
          if (!p) continue;
          all++;
          if (p.code.startsWith(t)) inType++;
        }
    }
    assert.ok(inType / all > 0.9, `${inType} of ${all} in the grey’s own type`);
  });
  test('Ben’s markers: only picks for his Copic greys change, and to the same grey type', () => {
    const { K, sv, coll, core } = appWith('ben');
    const picks = () =>
      coll.map((m) =>
        [
          K.companion(m.lab, m, coll, -1),
          K.companion(m.lab, m, coll, 1),
          core.shadePick(m, coll, -1),
          core.shadePick(m, coll, 1),
        ].map(code),
      );
    sv.famRule = 1;
    const a = picks();
    sv.famRule = 2;
    const b = picks();
    let n = 0;
    coll.forEach((m, i) =>
      a[i].forEach((x, j) => {
        if (x === b[i][j]) return;
        n++;
        assert.match(m.code, /-/, m.code + ' changed');
        assert.ok(b[i][j].startsWith('C:' + m.code.split('-')[0] + '-'), `${m.code}: ${x} → ${b[i][j]}`);
      }),
    );
    assert.ok(n > 0 && n <= 8, n + ' picks changed');
  });
}

// ---- from v316-blend.test.mjs ----
// v316 (famRule 3): a blend companion from outside the marker's family is a step a blend can make — no more than 20
// lighter or darker, as a family member may be, and a darker one keeping 35% of the colour's chroma. Before, the nearest
// by eye could be any distance away (Copic E29's lighter was YR07, 34 lighter) and a red's darker a near grey (Ohuhu
// E515 Black Brown for R514). A guide saved before (famRule 2) keeps its picks. Fails on v315.
{
  function appWith(set) {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    if (set === 'allO' || set === 'allC')
      E(
        'state.owned = new Set(COLORS.filter((c) => c.brand === "' +
          (set === 'allO' ? 'Ohuhu' : 'Copic') +
          '").map((c) => c.brand + "|" + c.code))',
      );
    else
      E('state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === ' + JSON.stringify(set) + ')))');
    core.coll = E('sfCollection()');
    return { E, core, K: core.colour, sv: core.styleVars, coll: core.coll };
  }
  const code = (m) => (m ? m.brand[0] + ':' + m.code : '-');
  const comp = (a, c, side) => {
    const b = a.coll.find((m) => code(m) === c);
    assert.ok(b, c);
    const r = a.K.companions(b);
    return side < 0 ? r.light : r.dark;
  };
  test('famRule 3: Ohuhu R514’s darker no longer Black Brown, Copic E29’s lighter no longer orange, black’s lighter no longer pale grey; famRule 2 keeps them', () => {
    const cases = [
      ['Honolulu 48', 'O:R514', 1, 'O:E515'],
      ['Ciao 12', 'C:E29', -1, 'C:YR07'],
      ['Ciao 36 - Set A', 'C:100', -1, 'C:C-3'],
    ];
    for (const [set, base, side, was] of cases) {
      const a = appWith(set);
      a.sv.famRule = 2;
      assert.equal(code(comp(a, base, side)), was, set + ' ' + base + ' under famRule 2');
      a.sv.famRule = 3;
      const now = comp(a, base, side);
      assert.ok(now && code(now) !== was, set + ' ' + base + ': ' + code(now));
    }
  });
  test('famRule 3, over sets of both brands: every companion from outside the family within 20 in lightness, and a darker one keeping 35% of a colour’s chroma', () => {
    let n = 0;
    for (const set of [
      'Honolulu 24',
      'Honolulu 72',
      'Honolulu 216',
      'Ciao 12',
      'Ciao 72 - Set A',
      'allO',
      'allC',
    ]) {
      const a = appWith(set),
        lch = a.E('lchOf');
      a.sv.famRule = 3;
      for (const b of a.coll) {
        const r = a.K.companions(b),
          fb = a.K.famVal(b.code);
        for (const [m, side] of [
          [r.light, -1],
          [r.dark, 1],
        ]) {
          if (!m) continue;
          const fm = a.K.famVal(m.code);
          if (fb && fm && m.brand === b.brand && fm.fam === fb.fam) continue;
          n++;
          const B = lch(b.lab),
            M = lch(m.lab);
          assert.ok(Math.abs(M[0] - B[0]) <= 20, set + ' ' + code(b) + ' → ' + code(m));
          if (side > 0 && B[1] >= 12)
            assert.ok(M[1] >= 0.35 * B[1] - 1e-9, set + ' ' + code(b) + ' → ' + code(m));
        }
      }
    }
    assert.ok(n > 500, 'companions checked: ' + n);
  });
}

// ---- from v318-comp.test.mjs ----
// v318 (famRule 4): a blend companion under 5 CIEDE2000 from its marker gives way to one a clear step away, found the
// same way (family first; outside it, within 10° of the colour's hue); with none such the old pick stays, so no
// companion is lost and none becomes one to buy. (Ohuhu B111's darker was B112, 3.9 apart.) A guide saved before
// (famRule 3) keeps its picks. Fails on v317.
{
  function appWith(set) {
    const app = createApp(),
      E = app.__eval,
      core = app.__mstest;
    if (set === 'ben') E('state.owned = defaultOwned()');
    else if (set === 'allO' || set === 'allC')
      E(
        'state.owned = new Set(COLORS.filter((c) => c.brand === "' +
          (set === 'allO' ? 'Ohuhu' : 'Copic') +
          '").map((c) => c.brand + "|" + c.code))',
      );
    else
      E('state.owned = new Set(presetMkeys(MARKER_SETS.find((p) => p.n === ' + JSON.stringify(set) + ')))');
    core.coll = E('sfCollection()');
    return { E, core, K: core.colour, sv: core.styleVars, coll: core.coll, de: E('de2000'), lch: E('lchOf') };
  }
  const code = (m) => (m ? m.brand[0] + ':' + m.code : '-');
  const comp = (a, c, side) => {
    const b = a.coll.find((m) => code(m) === c);
    assert.ok(b, c);
    const r = a.K.companions(b);
    return side < 0 ? r.light : r.dark;
  };
  const hd = (x, y) => {
    const d = Math.abs(x - y) % 360;
    return Math.min(d, 360 - d);
  };
  test('famRule 4: B111’s darker is no longer B112 (3.9 apart), B02’s no longer B05 (4.6); famRule 3 keeps them', () => {
    const a = appWith('ben');
    for (const [base, side, was] of [
      ['O:B111', 1, 'O:B112'],
      ['O:B02', 1, 'O:B05'],
      ['O:B112', -1, 'O:B111'],
    ]) {
      a.sv.famRule = 3;
      assert.equal(code(comp(a, base, side)), was, base + ' under famRule 3');
      a.sv.famRule = 4;
      const now = comp(a, base, side);
      assert.ok(now && code(now) !== was, base + ': ' + code(now));
      assert.ok(a.de(now.lab, a.coll.find((m) => code(m) === base).lab) >= 5, base + ' → ' + code(now));
    }
  });
  test('famRule 4 keeps a close pick that has nothing clearer: Copic BG75’s darker is still BG78 (4.8)', () => {
    const a = appWith('allC');
    a.sv.famRule = 4;
    assert.equal(code(comp(a, 'C:BG75', 1)), 'C:BG78');
  });
  test('famRule 4, over sets of both brands: a pick that changes is 5 or more away, keeps the hue outside its family, and none is lost or becomes one to buy', () => {
    let n = 0,
      changed = 0;
    for (const set of ['Honolulu 24', 'Honolulu 216', 'Ciao 12', 'Ciao 72 - Set A', 'ben', 'allO', 'allC']) {
      const a = appWith(set);
      for (const b of a.coll) {
        a.sv.famRule = 3;
        const r3 = a.K.companions(b);
        a.sv.famRule = 4;
        const r4 = a.K.companions(b),
          fb = a.K.famVal(b.code);
        for (const [s, side] of [
          ['light', -1],
          ['dark', 1],
        ]) {
          const m = r4[s],
            o = r3[s];
          n++;
          assert.equal(!!m, !!o, set + ' ' + code(b) + ' ' + s + ': lost or gained');
          if (!m) continue;
          assert.equal(r4[s + 'Owned'], r3[s + 'Owned'], set + ' ' + code(b) + ' ' + s + ': owned as before');
          if (m.mkey === o.mkey) continue;
          changed++;
          assert.ok(a.de(o.lab, b.lab) < 5, set + ' ' + code(b) + ': only a pick under 5 changes');
          assert.ok(a.de(m.lab, b.lab) >= 5, set + ' ' + code(b) + ' → ' + code(m));
          assert.ok(
            (m.lab[0] - b.lab[0]) * -side >= 4,
            set + ' ' + code(b) + ' → ' + code(m) + ' goes the wrong way',
          );
          const fm = a.K.famVal(m.code);
          if (fb && fm && m.brand === b.brand && fm.fam === fb.fam) continue;
          const B = a.lch(b.lab),
            M = a.lch(m.lab);
          assert.ok(Math.abs(M[0] - B[0]) <= 20, set + ' ' + code(b) + ' → ' + code(m));
          if (B[1] >= a.E('GREY_C'))
            assert.ok(hd(B[2], M[2]) <= 10, set + ' ' + code(b) + ' → ' + code(m) + ': hue');
          if (side > 0 && B[1] >= 12)
            assert.ok(M[1] >= 0.35 * B[1] - 1e-9, set + ' ' + code(b) + ' → ' + code(m));
        }
      }
    }
    assert.ok(n > 1500, 'companions checked: ' + n);
    assert.ok(changed > 150, 'picks changed: ' + changed);
  });
  test('a new picture takes famRule 4; From your guides reads a row’s 4 as 4', () => {
    const a = appWith('Honolulu 24');
    a.core.assign.quiet();
    a.core.assign.resetForNewPicture();
    assert.equal(a.sv.famRule, 4);
    const f = [...a.core.styleFields].find((x) => x.key === 'famRule');
    assert.equal(f.check(4, f.def), 4);
  });
}

// ---- from v31810-colouring.test.mjs ----
// v318.10: three colouring fixes the guide benchmark found (scripts/bench colour.mjs, stage B).
//  - Gradient (gradArea 4, new guides only): a run never picks a marker under TWIN_DE of one already picked while one
//    that isn't is among the near ones (Honolulu 120 at 32 markers picked near twins on 33 of 38 pages).
//  - No repeats: the sections touching the most others are laid first, and the last resort is a marker clear of the
//    neighbours before one on them (a hub laid late on Ciao 12 found every marker beside it and took one anyway).
//  - Balance: hubs first, the rest biggest first as before.
{
  function seeded(seed, fn) {
    const r = Math.random;
    let s = seed >>> 0 || 1;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      return fn();
    } finally {
      Math.random = r;
    }
  }
  const SET = (n) => `state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => ${n})))`;
  // an app on a page drawn by draw(W, H, g) (0 = line), segmented
  function appOn(W, H, draw, ownedJs) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    E(ownedJs);
    t.coll = E('sfCollection()');
    const g = new Uint8Array(W * H).fill(255);
    draw(W, H, g);
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.segment();
    return { E, t, de: E('de2000') };
  }
  const cell = 20,
    lw = 2,
    step = cell + lw;
  // a grid of cells
  const grid = (cols, rows) => [
    cols * step + lw,
    rows * step + lw,
    (W, H, g) => {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) if (x % step < lw || y % step < lw) g[y * W + x] = 0;
    },
  ];
  // rows of cells (cw x ch) between full-width bands bh tall: every band touches the 2 x cols cells beside it (a hub,
  // smaller than its neighbours when the cells are big and the bands thin)
  const comb = (cols, rows, cw = cell, ch = cell, bh = cell) => {
    const ys = [lw];
    for (let r = 0; r < rows; r++) ys.push(ys[r] + (r % 2 ? ch : bh) + lw);
    const W = cols * (cw + lw) + lw,
      H = ys[rows];
    return [
      W,
      H,
      (W, H, g) => {
        for (let y = 0; y < H; y++) {
          let r = 0;
          while (r < rows && y >= ys[r + 1]) r++;
          for (let x = 0; x < W; x++)
            if (y < lw || y >= ys[r + 1] - lw || x < lw || x >= W - lw || (r % 2 === 1 && x % (cw + lw) < lw))
              g[y * W + x] = 0;
        }
      },
    ];
  };
  function lay(a, vars, seed) {
    const t = a.t;
    Object.assign(
      t.styleVars,
      {
        look: 'auto',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        limitN: 16,
        gradScat: 0,
        noRep: false,
        noAdj: false,
        balance: 'mixed',
      },
      vars,
    );
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    seeded(seed, () => t.assign.buildGuide());
    return t.assignData;
  }
  // touching sections on the same marker
  function shared(a, ad) {
    const adj = a.t.adj;
    let n = 0;
    for (const l of ad.order)
      for (const q of adj[l] || [])
        if (q > l && ad.assign[q] && ad.assign[l] && ad.assign[q].mkey === ad.assign[l].mkey) n++;
    return n;
  }
  test('a new guide takes gradArea 4 or later (5 since v318.11)', () => {
    const a = appOn(...grid(4, 4), 'state.owned = defaultOwned()');
    assert.ok(a.t.styleVars.gradArea >= 4);
  });
  test('gradArea: 4 is saved and opens as saved; 6 is not a value', () => {
    const core = createApp().__mstest,
      f = [...core.styleFields].find((x) => x.key === 'gradArea');
    assert.equal(f.check(4, f.def), 4);
    assert.equal(f.check(6, f.def), 0);
    core.styleVars.gradArea = 4;
    assert.equal(f.save(), 4);
  });
  test('Gradient at 32 markers on Honolulu 120: no near twins picked at gradArea 4 (gradArea 3 lays as before)', () => {
    const a = appOn(...grid(16, 14), SET("s.n === 'Honolulu 120'"));
    const ms = (ad) => [...new Map(Object.values(ad.assign).map((m) => [m.mkey, m])).values()];
    const twins = (list) => {
      let n = 0;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) if (a.de(list[i].lab, list[j].lab) < 2.5) n++;
      return n;
    };
    const v = { family: 'gradient', gradShape: 'serpentine', limitN: 32 };
    const was = twins(ms(lay(a, { ...v, gradArea: 3 }, 7))),
      now = twins(ms(lay(a, { ...v, gradArea: 4 }, 7)));
    assert.ok(was > 0, 'gradArea 3 picks a near twin here');
    assert.equal(now, 0);
  });
  test('No repeats on Ciao 12: the bands touching 2 x 24 cells never share a marker with one', () => {
    const a = appOn(...comb(24, 9), SET("s.n === 'Ciao 12'"));
    for (const seed of [1, 2, 3, 4, 5, 6])
      assert.equal(shared(a, lay(a, { family: 'random', noRep: true }, seed)), 0, `seed ${seed}`);
  });
  test('No repeats on Ciao 12, a plain grid: still no touching pair on one marker, every marker used', () => {
    const a = appOn(...grid(10, 8), SET("s.n === 'Ciao 12'"));
    for (const seed of [1, 2, 3]) {
      const ad = lay(a, { family: 'random', noRep: true }, seed);
      assert.equal(shared(a, ad), 0, `seed ${seed}`);
      assert.equal(new Set(Object.values(ad.assign).map((m) => m.mkey)).size, 12);
    }
  });
  test('Balance on Ciao 12: thin bands between big cells never share a marker with a cell beside them', () => {
    const a = appOn(...comb(12, 9, 40, 80, 6), SET("s.n === 'Ciao 12'"));
    for (const seed of [1, 2, 3, 4])
      assert.equal(shared(a, lay(a, { family: 'random', balance: 'main' }, seed)), 0, `seed ${seed}`);
  });
}

// ---- from v31818.test.mjs ----
// v318.18: the themes are their own setting (theme), under Lean towards (Any, Cool, Warm): twelve, in the grid's order,
// tuned on the Ohuhu and Copic sets; with Cool or Warm the theme is taken from that temperature's markers (its strip
// too, greyed where next to none are). A v318.17 guide's theme (in palette) opens as the theme. Fails on v318.17.
{
  function appWith(sets) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    E('state.owned = new Set()');
    for (const n of sets)
      E(
        `presetMkeys(MARKER_SETS.find((s) => s.n === ${JSON.stringify(n)})).forEach((k) => state.owned.add(k))`,
      );
    t.coll = E('sfCollection()');
    t.setCollection(t.coll);
    return { t, E };
  }
  const codes = (list) => new Set(list.map((m) => m.code));
  test('twelve themes, in the grid’s order (Twilight never beside Winter or Blossom, 3 or 4 across)', () => {
    const t = createApp().__mstest,
      K = [...t.THEME_KEYS];
    assert.deepEqual(K, [
      'blossom',
      'tropical',
      'autumn',
      'winter',
      'sunset',
      'desert',
      'forest',
      'ocean',
      'coral',
      'berry',
      'galaxy',
      'twilight',
    ]);
    for (const cols of [3, 4]) {
      const at = (k) => K.indexOf(k),
        near = (a, b) => {
          const i = at(a),
            j = at(b),
            ri = Math.floor(i / cols),
            rj = Math.floor(j / cols),
            ci = i % cols,
            cj = j % cols;
          return Math.abs(ri - rj) + Math.abs(ci - cj) === 1;
        };
      for (const k of ['winter', 'blossom']) assert.equal(near('twilight', k), false, `${cols} across: ${k}`);
    }
  });
  test('the theme saved: only when there is one; a v318.17 guide’s palette theme opens as the theme (Candy as Blossom)', () => {
    const t = createApp().__mstest,
      f = [...t.styleFields].find((x) => x.key === 'theme'),
      p = [...t.styleFields].find((x) => x.key === 'palette');
    assert.equal(f.def, '');
    for (const k of t.THEME_KEYS) assert.equal(f.check(k, f.def, {}), k);
    assert.equal(f.check('candy', f.def, {}), '', 'a theme that never was');
    assert.equal(f.check(undefined, f.def), '', 'no file to read from');
    assert.equal(f.check(undefined, f.def, { palette: 'forest' }), 'forest');
    assert.equal(f.check(undefined, f.def, { palette: 'sunset' }), 'sunset');
    assert.equal(f.check(undefined, f.def, { palette: 'candy' }), 'blossom');
    assert.equal(f.check(undefined, f.def, { palette: 'warm' }), '');
    assert.equal(p.check('forest', p.def, { palette: 'forest' }), 'all', 'the temperature: Any');
    // (a saved theme wins over a palette an odd file has too)
    assert.equal(f.check('ocean', f.def, { palette: 'sunset' }), 'ocean');
    // written only when chosen, so a guide without one is saved as before
    t.styleVars.theme = '';
    assert.equal(f.save(), undefined);
    t.styleVars.theme = 'coral';
    assert.equal(f.save(), 'coral');
    // a zone's own, read the same way
    const z = t.zoneStOpen({ family: 'random', palette: 'candy' });
    assert.deepEqual([z.palette, z.theme], ['all', 'blossom']);
    assert.equal(t.zoneStOpen({ palette: 'cool', theme: 'winter' }).theme, 'winter');
  });
  test('each theme finds its own colours in the big sets, and is widened to 8 in a small one', () => {
    const MIN_IN = { 'Honolulu 120': 10, 'Honolulu 320 (complete set)': 27, 'All Copic markers': 17 };
    for (const set of Object.keys(MIN_IN)) {
      const { t } = appWith([set]);
      for (const k of t.THEME_KEYS) {
        const e = t.themeEntry('all', k);
        assert.ok(e.wide.inside >= MIN_IN[set], `${set} ${k}: ${e.wide.inside} inside`);
        assert.equal(e.wide.added, 0, `${set} ${k}: none added`);
      }
    }
    const { t } = appWith(['Honolulu 48']);
    for (const k of t.THEME_KEYS) {
      const e = t.themeEntry('all', k);
      assert.ok(e.items.length >= 8, `Honolulu 48 ${k}: ${e.items.length}`);
      assert.ok(e.wide.inside >= 4, `Honolulu 48 ${k}: ${e.wide.inside} inside`);
    }
  });
  test('the tuning holds: no lemons in Forest, no royal blues in Sunset (its violets by fit), Ocean has them', () => {
    const { t } = appWith(['All Copic markers']),
      forest = codes(t.colour.poolFor('all', 'forest')),
      sunset = codes(t.colour.poolFor('all', 'sunset')),
      ocean = codes(t.colour.poolFor('all', 'ocean'));
    for (const c of ['Y06', 'Y02', 'Y13']) assert.ok(!forest.has(c), 'Forest ' + c);
    for (const c of ['B18', 'B28', 'B29']) {
      assert.ok(!sunset.has(c), 'Sunset ' + c);
      assert.ok(ocean.has(c), 'Ocean ' + c);
    }
    // (Winter's silver is its extra: at most a third as many as its blues and lilacs)
    const w = t.themeSplit(t.poolBase('all'), 'winter');
    const pool = t.colour.poolFor('all', 'winter'),
      grey = pool.filter((m) => w.extra.some((p) => p[1] === m)).length;
    assert.ok(grey > 0 && grey <= Math.max(2, Math.floor(w.inside.length / 3)), `silver ${grey}`);
  });
  test('with Cool or Warm: the theme from that temperature, widened within it; a one-sided theme greyed', () => {
    const { t } = appWith(['Honolulu 120']);
    const warm = new Set(t.poolBase('warm'));
    for (const k of t.THEME_KEYS) {
      const pool = t.colour.poolFor('warm', k);
      assert.ok(pool.length >= 8, k);
      assert.ok(
        pool.every((m) => warm.has(m)),
        k + ': warm markers only',
      );
    }
    t.styleVars.palette = 'warm';
    assert.equal(t.themeStrip('ocean').off, true, 'Ocean has next to no warm colours');
    assert.equal(t.themeStrip('sunset').off, false);
    t.styleVars.palette = 'all';
    assert.ok(
      t.THEME_KEYS.every((k) => !t.themeStrip(k).off),
      'under Any nothing is greyed',
    );
    // the note names the temperature when it narrows the theme
    const k = t.THEME_KEYS.find((x) => t.themeEntry('warm', x).wide.added > 0);
    assert.ok(k, 'a theme widened under Warm');
    Object.assign(t.styleVars, { palette: 'warm', theme: k });
    assert.match(
      t.themeNote(),
      new RegExp(`^(Few|No) warm ${k} colours in your markers: the nearest \\d+ (added|used)\\.$`),
    );
  });
  test('a theme’s strip: hard stops of its own colours, at most 24, none from the widened ones', () => {
    const { t } = appWith(['All Copic markers']);
    for (const k of t.THEME_KEYS) {
      const s = t.themeStrip(k),
        stops = s.css.match(/#[0-9a-f]{6}/gi) || [];
      assert.match(s.css, /^linear-gradient\(90deg,/, k);
      assert.ok(stops.length >= 2 && stops.length <= 24, `${k}: ${stops.length}`);
    }
    const small = appWith(['Honolulu 48']).t,
      e = small.themeEntry('all', 'desert'),
      s = small.themeStrip('desert');
    assert.ok(e.wide.added > 0, 'Desert is widened on the 48');
    assert.ok(
      (s.css.match(/#[0-9a-f]{6}/gi) || []).length < e.items.length,
      'the strip shows its own colours only',
    );
  });
  test('Random’s Main colour Auto names the theme and temperature, with the right article', () => {
    const { t } = appWith(['Honolulu 120']);
    Object.assign(t.styleVars, { palette: 'all', theme: 'ocean' });
    assert.equal(t.balAutoSub(false), 'an ocean colour, from the theme');
    Object.assign(t.styleVars, { palette: 'warm', theme: 'sunset' });
    assert.equal(t.balAutoSub(false), 'a warm sunset colour, as Lean towards and Theme say');
    assert.equal(
      t.balAutoSub(true),
      'a sunset colour, from the theme',
      'a colour chosen by hand: the theme still holds',
    );
    Object.assign(t.styleVars, { palette: 'cool', theme: '' });
    assert.equal(t.balAutoSub(false), 'a cool colour, as Lean towards says');
    t.styleVars.palette = 'all';
    assert.equal(t.balAutoSub(false), 'chosen for you');
  });
}

// ---- from v31826-w3.test.mjs ----
// v318.26 (W3): Leave white. A section left white by hand (whitePins, saved as payload `white`) has no marker, base,
// pin or place in the order, and is in assignData.paper, after every laying of the plan (zoneRun's whiteApply);
// Undo and Redo, Colour it, the save and the open (a pin counts only where the guide has the section white). Fails on
// v318.25 (no whitePins).
{
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
    Object.assign(
      t.styleVars,
      { family: 'gradient', gradShape: 'serpentine', palette: 'all', limitN: 12, gradSeed: 0 },
      vars,
    );
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
    assert.deepEqual(
      { ...W({ 1: 'Ohuhu|R16', 2: 'Ohuhu|Y26' }, map, { 1: 1, 2: 1 }) },
      { 1: 'Ohuhu|R16', 2: 'Ohuhu|Y26' },
    );
    // renumbered sections (an older file's numbers)
    assert.deepEqual(
      { ...W({ 3: 'Ohuhu|R16', 4: 'Ohuhu|Y26' }, map, { 7: 1, 8: 1 }) },
      { 7: 'Ohuhu|R16', 8: 'Ohuhu|Y26' },
    );
    // stale: an older tab laid the plan again and gave the section a marker (not in paper): not white
    assert.deepEqual({ ...W({ 1: 'Ohuhu|R16', 2: 'Ohuhu|Y26' }, map, { 2: 1 }) }, { 2: 'Ohuhu|Y26' });
    // `white` without `paper`: ignored
    assert.deepEqual({ ...W({ 1: 'Ohuhu|R16' }, map, undefined) }, {});
    // odd values
    for (const w of [null, 'x', 5, ['Ohuhu|R16'], { 1: 5 }, { 9: 'Ohuhu|R16' }, { __proto__: 'x' }])
      assert.deepEqual({ ...W(w, map, { 1: 1, 9: 1 }) }, {}, JSON.stringify(w));
  });
  test("opening reads `white` after `paper` and the markers (97-open), and the guide's other resets clear it", () => {
    const src = (f) => readFileSync(new URL('../src/js/guide/' + f, import.meta.url), 'utf8');
    const o = src('97-open.js');
    assert.ok(
      o.indexOf('whitePins = whiteOpen(d.white, map, assignData.paper)') >
        o.indexOf('assignData.paper = _pp'),
    );
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
}

// ---- from v31827-v2.test.mjs ----
// v318.27: Random's "Keep touching sections clearly different" holds roll after roll. Laid one section at a time, a
// section could find every marker alike to one of its neighbours' and take one anyway (the order painted itself into a
// corner): on the sample, 3 rolls in 4 with Main colour; with No repeats on a small set nearly every roll. A repair
// after the laying (adjRepair, js/guide/30-palette-assign.js) puts each such section right where any marker will do,
// and the box says so when one can't be (too few different markers): #sfNoAdjNote.
{
  function seeded(seed, fn) {
    const r = Math.random;
    let s = seed >>> 0 || 1;
    Math.random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try {
      return fn();
    } finally {
      Math.random = r;
    }
  }
  const SET = (n) => `state.owned = new Set(presetMkeys(MARKER_SETS.find((s) => s.n === '${n}')))`;
  // an app on a page drawn by draw(W, H, g) (0 = line), segmented
  function appOn([W, H, draw], set) {
    const app = createApp(),
      E = app.__eval,
      t = app.__mstest;
    t.assign.quiet();
    t.assign.resetForNewPicture();
    E(SET(set));
    t.coll = E('sfCollection()');
    const g = new Uint8Array(W * H).fill(255);
    draw(W, H, g);
    t.srcK = 1;
    t.W = W;
    t.H = H;
    t.gray = g;
    t.segment();
    return { E, t, de: E('de2000') };
  }
  const lw = 2;
  // rows of cells (cw wide) between full-width bands: every band touches the cells of the rows on both sides of it, and
  // two cells side by side touch each other and the band, so three touching sections at every cell's edge (many more
  // round a band); cells of different sizes so the order sections are laid in varies
  const comb = (cols, rows, cw = 20, ch = 20, bh = 12) => {
    const ys = [lw];
    for (let r = 0; r < rows; r++) ys.push(ys[r] + (r % 2 ? ch : bh) + lw);
    const W = cols * (cw + lw) + lw,
      H = ys[rows];
    return [
      W,
      H,
      (W, H, g) => {
        for (let y = 0; y < H; y++) {
          let r = 0;
          while (r < rows && y >= ys[r + 1]) r++;
          for (let x = 0; x < W; x++)
            if (y < lw || y >= ys[r + 1] - lw || x < lw || x >= W - lw || (r % 2 === 1 && x % (cw + lw) < lw))
              g[y * W + x] = 0;
        }
      },
    ];
  };
  // a grid of cells with every other line knocked through in places: sections of many shapes and neighbour counts
  const blocks = (cols, rows, cell = 18) => {
    const step = cell + lw,
      W = cols * step + lw,
      H = rows * step + lw;
    return [
      W,
      H,
      (W, H, g) => {
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const cx = Math.floor(x / step),
              cy = Math.floor(y / step),
              vl = x % step < lw,
              hl = y % step < lw;
            // (a vertical line left out where (cx + 2 cy) % 5 is 0, a horizontal one where (3 cx + cy) % 7 is 0)
            const keepV = vl && !(x > lw && x < W - lw && !hl && (cx + 2 * cy) % 5 === 0),
              keepH = hl && !(y > lw && y < H - lw && !vl && (3 * cx + cy) % 7 === 0);
            if (keepV || keepH || x < lw || y < lw || x >= W - lw || y >= H - lw) g[y * W + x] = 0;
          }
      },
    ];
  };
  function lay(a, vars, seed) {
    const t = a.t;
    Object.assign(
      t.styleVars,
      {
        family: 'random',
        look: 'auto',
        paletteSource: 'owned',
        palette: 'all',
        emphasis: 'neutral',
        limitN: 16,
        noRep: false,
        noAdj: true,
        balance: 'mixed',
      },
      vars,
    );
    t.assign.adj = null;
    t.assign.segFresh = true;
    t.assign.sfmode = 'review';
    t.assignData = null;
    seeded(seed, () => t.assign.buildGuide());
    return t.assignData;
  }
  // touching sections (the app's own adjacency) on one marker or on markers alike by eye (CIEDE2000 under 10): the pairs,
  // and the sections in them
  function clashes(a, ad) {
    const adj = a.t.adj,
      secs = new Set();
    let n = 0;
    for (const l of ad.order)
      for (const q of adj[l] || []) {
        const x = ad.assign[l],
          y = ad.assign[q];
        if (q > l && x && y && (x.mkey === y.mkey || a.de(x.lab, y.lab) < 10)) {
          n++;
          secs.add(l).add(q);
        }
      }
    return { n, secs: secs.size };
  }
  const MODES = {
    Mixed: {},
    'Main colour': { balance: 'main' },
    'No repeats': { noRep: true },
  };
  // (before v318.27, on these pages: No repeats left touching sections alike on 4 to 7 rolls in 12, Main colour on
  // Honolulu 24's blocks 11 in 12; Mixed held)
  test('Keep touching sections clearly different holds on every roll: Mixed, Main colour and No repeats, 8 and 16 markers', () => {
    for (const [page, set] of [
      [comb(14, 9), 'Honolulu 120'],
      [blocks(16, 12), 'Honolulu 24'],
    ]) {
      const a = appOn(page, set);
      for (const [mode, v] of Object.entries(MODES))
        for (const limitN of [8, 16]) {
          const bad = [];
          for (let seed = 1; seed <= 12; seed++) {
            const ad = lay(a, { ...v, limitN }, seed),
              c = clashes(a, ad),
              // (and the count the note goes by agrees: nothing left)
              left = (a.t.assign.adjLeft || {})['0'];
            assert.ok(ad.order.length > 60, ad.order.length + ' sections');
            if (c.n || left) bad.push('seed ' + seed + ': ' + c.n + ' pairs, ' + left + ' left');
          }
          assert.deepEqual(bad, [], set + ' · ' + mode + ' · ' + limitN + ' markers');
        }
    }
  });
  test("where it can't hold, the count is honest: Main colour on Ciao 12, each role a few markers, every roll", () => {
    const a = appOn(blocks(16, 12), 'Ciao 12');
    let some = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const ad = lay(a, { balance: 'main', limitN: 8 }, seed),
        c = clashes(a, ad);
      // (every section still alike to one it touches is counted, and only those)
      assert.equal(a.t.assign.adjLeft['0'], c.secs, 'seed ' + seed);
      if (c.n) some++;
      assert.ok(a.t.assign.balStat['0'].total > 0, 'Balance laid');
    }
    // (and it's the odd roll, not most: 12 in 12 before)
    assert.ok(some < 9, some + ' rolls in 12');
  });
  test('the rule off: no repair, nothing counted', () => {
    const a = appOn(comb(14, 9), 'Honolulu 120');
    for (const v of Object.values(MODES)) {
      lay(a, { ...v, noAdj: false, limitN: 8 }, 3);
      assert.equal(a.t.assign.adjLeft['0'], 0);
    }
  });
  test('too few markers to keep them apart: the note under the box says how many sections, and goes with a new picture', () => {
    // (2 markers: a band and the two cells either side of a line between them touch each other, three at once)
    const a = appOn(comb(6, 5), 'Honolulu 120');
    const ad = lay(a, { limitN: 2 }, 1),
      n = a.t.assign.adjLeft['0'];
    assert.ok(n > 0 && clashes(a, ad).secs === n, n + ' left');
    const h = a.t.assign.pattern();
    assert.match(h, /id="sfNoAdjNote"/);
    assert.ok(
      h.includes(n + ' touching sections couldn’t be kept clearly different: too few different markers.'),
      h.match(/sfNoAdjNote[^<]*/)[0],
    );
    // (with the rule off, no note: it isn't claimed)
    a.t.styleVars.noAdj = false;
    assert.doesNotMatch(a.t.assign.pattern(), /sfNoAdjNote/);
    a.t.styleVars.noAdj = true;
    // (enough markers: none)
    lay(a, { limitN: 16 }, 1);
    assert.equal(a.t.assign.adjLeft['0'], 0);
    assert.doesNotMatch(a.t.assign.pattern(), /sfNoAdjNote/);
    // (what the last laying worked out goes with a new picture, as Balance's figures do)
    lay(a, { limitN: 2 }, 1);
    a.t.assign.resetForNewPicture();
    assert.deepEqual({ ...a.t.assign.adjLeft }, {});
  });
  test('one section left: the note in the singular', () => {
    const a = appOn(comb(6, 5), 'Honolulu 120');
    lay(a, { limitN: 2 }, 1);
    a.t.assign.adjLeft['0'] = 1;
    assert.match(
      a.t.assign.pattern(),
      /<div id="sfNoAdjNote" class="sfc-note sfc-mt6">1 section couldn’t be kept clearly different from every section it touches: too few different markers\.<\/div>/,
    );
  });
}
