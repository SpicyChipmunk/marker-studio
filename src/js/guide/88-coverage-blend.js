function updateProgress() {
  if (!assignData) return;
  // (the dates follow the ticks however they changed: a section brought in, tones asked for again)
  progStamp();
  exCodesSync();
  let done = 0;
  assignData.order.forEach(function (l) {
    if (colored[l]) done++;
  });
  const N = assignData.N,
    pct = N ? Math.round((done / N) * 100) : 0;
  const bar = document.getElementById('sfProgBar');
  if (bar) bar.style.width = pct + '%';
  renderTools();
  const dn = document.getElementById('sfDone'),
    fin = N > 0 && done >= N;
  if (dn) dn.style.display = fin ? '' : 'none';
  // (the bar: Focus mode while there's colouring to do, Reveal & share once the page is finished)
  const fb = document.getElementById('sfFocus'),
    rb = document.getElementById('sfAlongRev');
  if (fb && rb) {
    fb.style.display = fin ? 'none' : '';
    rb.style.display = fin ? '' : 'none';
  }
  const ds = document.getElementById('sfDoneSum');
  if (ds && N > 0 && done >= N) ds.textContent = finishLine();
  // (v306: Did any run low?, once the page is finished)
  const lh = document.getElementById('sfLowA');
  if (lh && fin !== !!lh.firstElementChild) lh.innerHTML = lowRowHTML('A');
  renderAlong();
}
function famVal(code) {
  var m = /^([A-Za-z]+)(\d+)$/.exec(code);
  if (!m) return null;
  var L = m[1],
    dd = m[2];
  return dd.length >= 2
    ? { fam: L + dd.slice(0, -1), val: parseInt(dd.slice(-1), 10) }
    : { fam: L, val: parseInt(dd, 10) };
}
function _chroma(l) {
  return Math.hypot(l[1], l[2]);
}
function _hueA(l) {
  var h = (Math.atan2(l[2], l[1]) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}
// (shadePick's test that a marker outside the family is near enough in colour, 45-shading)
function _hueOK(bl, ml) {
  var bc = _chroma(bl),
    mc = _chroma(ml);
  if (bc < 8) return mc < 10;
  if (mc < 6) return false;
  var dh = Math.abs(_hueA(ml) - _hueA(bl));
  if (dh > 180) dh = 360 - dh;
  if (dh > 22) return false;
  return Math.hypot(ml[1] - bl[1], ml[2] - bl[2]) < 20;
}
/* A marker's blend companion: a lighter one (side -1) or a darker one (+1), from pool, for Colour along's strip and
   the printed key. It must really be lighter (or darker) by a step you can see (COMP_DL or more in lightness, and
   COMP_DE or more by eye, CIEDE2000) and keep the colour's hue (within COMP_DH on the colour wheel; a grey's
   companion is a grey). Its own family comes first (the same brand and code letters, e.g. R2x for Ohuhu R25):
   nearest in number first, and a member that fails the tests is passed over for the next, as a family's numbers
   don't always run light to dark (Ohuhu BV32 is lighter than BV31, Copic Y18 than Y17). Failing that, the marker
   that passes them closest by eye. (It used to take the nearest family member whatever it looked like: on Ben's
   markers 34 of 902 went the wrong way and 44 were a step too small to see; now none.) */
var COMP_DL = 4,
  COMP_DE = 3,
  COMP_DH = 25,
  COMP_HUE_C = 6;
// (fam: the same family, which is one colour from its palest to its darkest, so a pale tint too faint to count as
// coloured may go with its family's coloured ones; the hue is compared where both have one to see, chroma COMP_HUE_C
// or more. Outside the family a grey goes with a grey, and a colour with a colour of much the same hue.)
function _compOK(bl, bc, ml, side, fam) {
  if (!ml || (ml[0] - bl[0]) * -side < COMP_DL) return false;
  var mc = lchOf(ml);
  if (fam) {
    if (Math.min(bc[1], mc[1]) >= COMP_HUE_C && hueDiff(bc[2], mc[2]) > COMP_DH) return false;
  } else if (bc[1] < GREY_C) {
    if (mc[1] >= GREY_C) return false;
  } else if (mc[1] < COMP_HUE_C || hueDiff(bc[2], mc[2]) > COMP_DH) return false;
  return de2000(bl, ml) >= COMP_DE;
}
function _findComp(bl, base, pool, side) {
  var fv = famVal(base.code),
    bc = lchOf(bl),
    fam = [],
    i,
    m,
    f;
  if (fv)
    for (i = 0; i < pool.length; i++) {
      m = pool[i];
      if (m.mkey === base.mkey || m.brand !== base.brand) continue;
      f = famVal(m.code);
      if (f && f.fam === fv.fam && (f.val - fv.val) * side > 0) fam.push([Math.abs(f.val - fv.val), i]);
    }
  fam.sort(function (a, b) {
    return a[0] - b[0] || a[1] - b[1];
  });
  for (i = 0; i < fam.length; i++)
    if (_compOK(bl, bc, pool[fam[i][1]].lab, side, true)) return pool[fam[i][1]];
  var cand = null,
    best = Infinity,
    d;
  for (i = 0; i < pool.length; i++) {
    m = pool[i];
    if (m.mkey === base.mkey || !_compOK(bl, bc, m.lab, side, false)) continue;
    d = de2000(bl, m.lab);
    if (d < best) {
      best = d;
      cand = m;
    }
  }
  return cand;
}
var _catPool = null;
function catPool() {
  if (!_catPool) {
    _catPool = [];
    for (var i = 0; i < COLORS.length; i++) {
      // (not the Colorless Blenders: they lay down no colour, so they're never a marker to buy for a colour, v298;
      // they had come up as the highlight to buy for pale greys, even for someone who owns one, v304)
      if (NOINK.has(i)) continue;
      _catPool.push({
        code: COLORS[i].code,
        brand: COLORS[i].brand,
        hex: COLORS[i].hex,
        lab: LAB[i],
        mkey: COLORS[i].brand + '|' + COLORS[i].code,
        fam: COLORS[i].fam,
      });
    }
  }
  return _catPool;
}
// Brands I'd buy (Markers, v304): null for automatic, else the brands ticked; a marker to buy is suggested only from
// those (shadeBuyPool, blendCompanions, the Photo pattern's markers to buy)
function buyBrands() {
  const b = api.buyBrands ? api.buyBrands() : null;
  return b && b.length ? b : null;
}
// the markers to buy for a colour of base's: automatic, base's own brand (one brand's markers blend over each other
// best); with brands ticked, base's brand if it's one of them, else the ones ticked
function shadeBuyPool(base) {
  const b = buyBrands(),
    only = !b || b.indexOf(base.brand) >= 0 ? [base.brand] : b;
  return catPool().filter(function (m) {
    return only.indexOf(m.brand) >= 0;
  });
}
function blendCompanions(base) {
  var bl = base.lab && base.lab.length ? base.lab : hexToLab(base.hex);
  var light = _findComp(bl, base, coll, -1),
    dark = _findComp(bl, base, coll, 1);
  var lo = !!light,
    dOwn = !!dark;
  // (to buy: from Brands I'd buy when brands are ticked; else your brands first, then any (it had been any brand,
  // v304)
  var bb = buyBrands(),
    mine = {};
  coll.forEach(function (m) {
    mine[m.brand] = 1;
  });
  var pools = bb
    ? [
        catPool().filter(function (m) {
          return bb.indexOf(m.brand) >= 0;
        }),
      ]
    : [
        catPool().filter(function (m) {
          return mine[m.brand];
        }),
        catPool(),
      ];
  for (var p = 0; p < pools.length && (!light || !dark); p++) {
    if (!light) {
      var s = _findComp(bl, base, pools[p], -1);
      if (s) {
        light = s;
        lo = false;
      }
    }
    if (!dark) {
      var s2 = _findComp(bl, base, pools[p], 1);
      if (s2) {
        dark = s2;
        dOwn = false;
      }
    }
  }
  return { light: light, lightOwned: lo, dark: dark, darkOwned: dOwn };
}
// a marker's lighter and darker companions (from blendCompanions), shown under its open row in Colour along
function blendStrip(base) {
  var c = blendCompanions(base);
  function slot(m, owned, role) {
    if (!m)
      return (
        '<div class="bslot empty"><span class="bsw"></span><span class="bcd">no ' + role + '</span></div>'
      );
    return (
      '<div class="bslot' +
      (owned ? '' : ' sugg') +
      '"><span class="bsw" style="background:' +
      m.hex +
      '"></span><span class="bcd">' +
      mcodeHTML(m) +
      '</span><span class="brole">' +
      role +
      '</span>' +
      (owned ? '' : '<span class="bnote">not owned</span>') +
      '</div>'
    );
  }
  return (
    '<div class="blendstrip">' +
    slot(c.light, c.lightOwned, 'lighter') +
    '<div class="bslot base"><span class="bsw" style="background:' +
    base.hex +
    '"></span><span class="bcd">' +
    mcodeHTML(base) +
    '</span><span class="brole">base</span></div>' +
    slot(c.dark, c.darkOwned, 'darker') +
    '</div>'
  );
}
// tg: the plan or your collection mixes brands, so codes carry their brand letter
function planRow(m, n, c, tg) {
  function slot(mm, owned) {
    if (!mm) return '<div class="bslot empty"><span class="bsw"></span><span class="bcd">\u2014</span></div>';
    if (owned)
      return (
        '<div class="bslot"><span class="bsw" style="background:' +
        mm.hex +
        '"></span><span class="bcd">' +
        mm.code +
        '</span></div>'
      );
    return (
      '<div class="bslot sugg"><span class="bsw" style="background:' +
      mm.hex +
      '"></span><span class="bcd">' +
      mm.code +
      '</span><span class="bnote">buy</span></div>'
    );
  }
  return (
    '<div class="planrow"><div class="blendstrip pstrip">' +
    slot(c.light, c.lightOwned) +
    '<div class="bslot base"><span class="bsw" style="background:' +
    m.hex +
    '"></span><span class="bcd">' +
    m.code +
    '</span></div>' +
    slot(c.dark, c.darkOwned) +
    '</div><div class="planmeta"><span class="pmc">' +
    (tg
      ? '<span aria-hidden="true">' +
        bTag(m.brand) +
        ' </span><span class="sfsr">' +
        esc(m.brand) +
        ' </span>'
      : '') +
    m.code +
    '</span>' +
    (m.name ? '<span class="pmn">' + m.name + '</span>' : '') +
    '<span class="pmn">' +
    n +
    ' section' +
    (n === 1 ? '' : 's') +
    '</span></div></div>'
  );
}
var planOpen = {};
function renderBlendPlan() {
  var host = document.getElementById('sfPlanList'),
    buy = document.getElementById('sfPlanBuy');
  if (!host || !assignData) return;
  var map = {},
    order = assignData.order,
    assign = assignData.assign,
    i,
    k;
  for (i = 0; i < order.length; i++) {
    var mm = assign[order[i]];
    k = mm.mkey;
    if (!map[k]) map[k] = { m: mm, n: 0 };
    map[k].n++;
  }
  var arr = [];
  for (k in map) {
    var e = map[k];
    e.hue = _hueA(e.m.lab && e.m.lab.length ? e.m.lab : hexToLab(e.m.hex));
    arr.push(e);
  }
  arr.sort(function (a, b) {
    return a.hue - b.hue;
  });
  var bs = {};
  arr.forEach(function (e) {
    e.c = blendCompanions(e.m);
    bs[e.m.brand] = 1;
    if (e.c.light) bs[e.c.light.brand] = 1;
    if (e.c.dark) bs[e.c.dark.brand] = 1;
  });
  var tg = brandsMixed() || Object.keys(bs).length > 1;
  var groups = {},
    gh = {},
    want = {},
    wantFor = {};
  arr.forEach(function (e) {
    var c = e.c;
    if (c.light && !c.lightOwned) {
      want[c.light.mkey] = c.light;
      wantFor[c.light.mkey] = wantFor[c.light.mkey] || e.m.code;
    }
    if (c.dark && !c.darkOwned) {
      want[c.dark.mkey] = c.dark;
      wantFor[c.dark.mkey] = wantFor[c.dark.mkey] || e.m.code;
    }
    var ix = keyIdx(e.m.mkey),
      fam = ix != null && COLORS[ix] ? COLORS[ix].fam : 'Other';
    if (!groups[fam]) {
      groups[fam] = [];
      gh[fam] = e.m.hex;
    }
    groups[fam].push(planRow(e.m, e.n, c, tg));
  });
  var names = Object.keys(groups).sort(function (a, b) {
    var ia = FAM_ORDER.indexOf(a),
      ib = FAM_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  var rows = names
    .map(function (nm) {
      var closed = !planOpen[nm],
        ct = groups[nm].length;
      return (
        // (a button that says whether it's open, for the keyboard and screen readers, v287)
        '<button type="button" class="plangrp' +
        (closed ? ' closed' : '') +
        '" data-g="' +
        esc(nm) +
        '" aria-expanded="' +
        !closed +
        '"><span class="pgcaret" aria-hidden="true">' +
        ic(closed ? 'chevron-right' : 'chevron-down') +
        '</span><span class="pgdot" style="background:' +
        gh[nm] +
        '"></span><span class="pgname">' +
        esc(nm) +
        '</span><span class="pgn">' +
        ct +
        '<span class="sfsr"> ' +
        (ct === 1 ? 'colour' : 'colours') +
        '</span></span></button>' +
        (closed ? '' : groups[nm].join(''))
      );
    })
    .join('');
  host.innerHTML = rows || '<div class="empty">No colours yet.</div>';
  if (!host._pb) {
    host._pb = 1;
    host.addEventListener('click', function (ev) {
      var g = ev.target.closest('.plangrp');
      if (!g) return;
      var nm = g.getAttribute('data-g');
      planOpen[nm] = !planOpen[nm];
      renderBlendPlan();
      [].some.call(host.querySelectorAll('.plangrp'), function (b) {
        if (b.getAttribute('data-g') !== nm) return false;
        try {
          b.focus({ preventScroll: true });
        } catch (_) {}
        return true;
      });
    });
  }
  var wk = Object.keys(want);
  if (buy) {
    buy.innerHTML = wk.length
      ? '<div class="planbuy"><b>To complete every blend</b>, add ' +
        wk.length +
        ' marker' +
        (wk.length === 1 ? '' : 's') +
        ': ' +
        wk
          .map(function (k2) {
            var mm2 = want[k2],
              inner =
                '<span class="bsw" style="background:' +
                mm2.hex +
                '"></span>' +
                (tg ? bTag(mm2.brand) + ' ' : '') +
                mm2.code;
            return api.wishChip
              ? api.wishChip(k2, 'blend for ' + wantFor[k2], inner, 'buychip')
              : '<span class="buychip">' + inner + '</span>';
          })
          .join(' ') +
        (api.wishAll
          ? api.wishAll(
              wk.map(function (k2) {
                return [k2, 'blend for ' + wantFor[k2]];
              }),
            )
          : '') +
        '</div>'
      : '<div class="planbuy ok">\u2713 You own a shade for every colour in this guide.</div>';
  }
}
/* ---- (v306) "Did any run low?" ----
    Once the page is finished: one quiet row in Colour along's "Page finished" panel and in Share › Show it off (Reveal
    from Home lands in the Plan). Compact chips, swatch and code (the brand too for a code both brands have), for the
    five markers that covered most of the page, a highlight or shadow counted for its share of each section it shades;
    yours only, not one marked dry, never the Colorless Blender. One tap marks it Running low and puts it on To buy
    (api.lowMark, one save), "R310 running low · on To buy · Undo"; a chip already on can be tapped back. "Another…"
    opens a code box (Colour along's kind) for any marker of yours: one found is marked at once ("Copic Y26 is already
    marked low", or "… is dry", when it is), two brands ask which; Escape clears the box, then closes it.
    (The brand shows on a chip when you own its code in both brands.) The chips follow a change to your markers made
    while they show (setCollection, 97-open).
    Hidden while you own no markers. Nothing new is saved with the guide: ink and To buy are the collection's. */
const LOW_N = 5;
let _lowX = { g: -1, extra: [], added: {}, form: {}, line: {} };
function lowState() {
  if (_lowX.g !== loadGen) _lowX = { g: loadGen, extra: [], added: {}, form: {}, line: {} };
  return _lowX;
}
// the guide's markers by how much of the page they cover (sections' areas; with shading, a highlight takes about
// the lit part of each section it shades, up to T2, and a shadow the part past T3), most first: [{ k, a }]
function lowCover() {
  if (!assignData || !comps) return [];
  const area = {},
    add = function (m, a) {
      if (m && a > 0) area[m.mkey] = (area[m.mkey] || 0) + a;
    },
    sh = shadeOn();
  for (const l in assignData.assign) {
    const m = assignData.assign[l],
      a = comps[l] ? comps[l].area || 0 : 0,
      t = sh ? shadeSec(+l) : null;
    if (t) {
      const h = t.light ? t.T2 : 0,
        s = t.dark ? 1 - t.T3 : 0;
      add(t.light, a * h);
      add(t.dark, a * s);
      add(m, a * Math.max(0, 1 - h - s));
    } else add(m, a);
  }
  return Object.keys(area)
    .map(function (k) {
      return { k: k, a: area[k] };
    })
    .sort(function (x, y) {
      return y.a - x.a;
    });
}
// the five to offer: yours, not dry
function lowTop() {
  if (!api.lowInk) return [];
  return lowCover()
    .filter(function (x) {
      const v = api.lowInk(x.k);
      return v != null && v !== 'dry';
    })
    .slice(0, LOW_N)
    .map(function (x) {
      return x.k;
    });
}
function lowShown() {
  return !!(api.lowInk && api.ownsAny && api.ownsAny() && assignData && pageDone());
}
// (a code you own in both brands: its chip says which)
function lowCodeBoth(code) {
  const q = codeNorm(code),
    b = {};
  COLORS.forEach(function (c, i) {
    if (codeNorm(c.code) === q && api.lowInk(mkey(i)) != null) b[c.brand] = 1;
  });
  return Object.keys(b).length > 1;
}
function lowChip(k) {
  const i = keyIdx(k),
    c = i != null ? COLORS[i] : null,
    v = api.lowInk(k);
  if (!c || v == null) return '';
  const nm = (lowCodeBoth(c.code) ? c.brand + ' ' : '') + c.code,
    sw = '<i style="background:' + esc(c.hex) + '"></i>';
  if (v === 'dry')
    return (
      '<span class="sflowb dry" role="img" aria-label="' +
      esc(c.brand + ' ' + c.code + ' is marked dry') +
      '">' +
      sw +
      esc(nm) +
      ' <small aria-hidden="true">dry</small></span>'
    );
  const on = v === 'low';
  return (
    '<button type="button" class="sflowb' +
    (on ? ' on' : '') +
    '" data-lk="' +
    esc(k) +
    '" aria-pressed="' +
    on +
    '" aria-label="' +
    esc(c.brand + ' ' + c.code + ' ' + (c.name || '') + ', running low') +
    '">' +
    sw +
    esc(nm) +
    '</button>'
  );
}
// w: where, 'A' (Colour along's Page finished panel) or 'S' (Share)
function lowRowHTML(w) {
  if (!lowShown()) return '';
  const st = lowState(),
    keys = lowTop();
  st.extra.forEach(function (k) {
    if (keys.indexOf(k) < 0) keys.push(k);
  });
  const fid = 'sfLowIn' + w,
    lid = 'sfLowL' + w;
  return (
    '<div class="sflow" data-w="' +
    w +
    '"><div class="sflowh" id="sfLowH' +
    w +
    '">Did any run low?</div><div class="sflowc" role="group" aria-labelledby="sfLowH' +
    w +
    '">' +
    keys.map(lowChip).join('') +
    '<button type="button" class="sflowb sflowmore" data-lmore="1" aria-expanded="' +
    !!st.form[w] +
    '">Another…</button></div>' +
    (st.form[w]
      ? '<div class="sflowf"><div id="' +
        lid +
        '" class="sffindl" aria-live="polite">' +
        esc(st.line[w] || '') +
        '</div><form class="sffindf" data-lform="' +
        w +
        '" action="#" novalidate>' +
        codeBoxHTML(fid, 'Type its code', 'Code of the marker running low', lid) +
        '</form></div>'
      : '') +
    '</div>'
  );
}
// every run-low row on screen drawn again (focus kept on the same chip, and a code being typed in Another…'s box kept)
function lowRefresh() {
  document.querySelectorAll('#sfRoot .sflow-host').forEach(function (h) {
    const ae = document.activeElement,
      inp0 = h.querySelector('input'),
      typed = inp0 ? inp0.value : '',
      fk =
        ae && h.contains(ae) && ae.dataset
          ? ae === inp0
            ? 'box'
            : ae.dataset.lk || (ae.dataset.lmore ? 'more' : '')
          : '';
    h.innerHTML = lowRowHTML(h.dataset.w);
    const inp = h.querySelector('input');
    if (inp && typed) inp.value = typed;
    if (!fk) return;
    const b =
      fk === 'box'
        ? inp
        : fk === 'more'
          ? h.querySelector('[data-lmore]')
          : [].find.call(h.querySelectorAll('[data-lk]'), function (x) {
              return x.dataset.lk === fk;
            });
    if (b)
      try {
        b.focus({ preventScroll: true });
      } catch (_) {}
  });
}
function lowHost(w) {
  return '<div class="sflow-host" id="sfLow' + w + '" data-w="' + w + '">' + lowRowHTML(w) + '</div>';
}
// one tap: mark it (or, on, take it back)
function lowTap(k) {
  const i = keyIdx(k),
    c = i != null ? COLORS[i] : null,
    st = lowState();
  if (!c) return;
  // (named as its chip is: the brand too for a code you own in both)
  const v = api.lowInk(k),
    nm = (lowCodeBoth(c.code) ? c.brand + ' ' : '') + c.code;
  if (v === 'low') {
    if (api.lowUnmark(k, !!st.added[k])) {
      delete st.added[k];
      sayLive(nm + ' ink back to OK');
    }
    lowRefresh();
    return;
  }
  if (v !== '') return;
  const r = api.lowMark(k);
  lowRefresh();
  if (!r) return;
  st.added[k] = r.added;
  const g = loadGen;
  toastAction(nm + ' running low · on To buy ·', 'Undo', function () {
    if (api.lowUnmark(k, r.added) && g === loadGen) delete lowState().added[k];
    lowRefresh();
  });
}
// Another…: any marker of yours by its code (exact, as the caps show it now)
function lowFind(w, raw) {
  const st = lowState(),
    q = codeNorm(raw),
    up = String(raw || '')
      .trim()
      .toUpperCase();
  if (!q) return;
  const found = [];
  let known = false,
    blender = false;
  COLORS.forEach(function (c, i) {
    if (codeNorm(c.code) !== q) return;
    known = true;
    const k = mkey(i);
    if (api.lowInk(k) != null) found.push(k);
    // (v309.1: a Colorless Blender of yours isn't asked about here, as it lays down no colour; it had been said as
    // not one of your markers)
    else if (NOINK.has(i) && isOwned(i)) blender = true;
  });
  found.forEach(function (k) {
    if (st.extra.indexOf(k) < 0) st.extra.push(k);
  });
  st.line[w] = !found.length
    ? blender
      ? up + ' is your Colorless Blender: mark it in Markers'
      : known
        ? up + ' isn’t one of your markers'
        : 'No marker ' + up
    : found.length > 1
      ? 'Two ' + up + 's: which is in your hand?'
      : '';
  const v1 = found.length === 1 ? api.lowInk(found[0]) : null;
  if (v1 === '') {
    st.form[w] = false;
    lowTap(found[0]);
    const b = document.querySelector('#sfLow' + w + ' [data-lk="' + found[0] + '"]');
    if (b)
      try {
        b.focus({ preventScroll: true });
      } catch (_) {}
    return;
  }
  // (one already marked: said so, with its brand, and the box stays for another)
  if (v1) {
    const i = keyIdx(found[0]),
      c = COLORS[i];
    st.line[w] = c.brand + ' ' + c.code + (v1 === 'dry' ? ' is dry' : ' is already marked low');
  }
  lowRefresh();
  sayLive(st.line[w]);
  const inp = document.getElementById('sfLowIn' + w);
  if (inp && found.length) inp.value = '';
  if (inp && v1)
    try {
      inp.focus({ preventScroll: true });
    } catch (_) {}
  if (inp && !found.length) {
    inp.value = raw;
    try {
      inp.focus({ preventScroll: true });
    } catch (_) {}
  }
}
// Escape (a layer, 95-mount.js): Another…'s box, open on screen (the one with focus first): a code in it is cleared,
// then the box closes, focus back on Another…
function lowBoxOpen() {
  const ae = document.activeElement,
    fs = [].filter.call(document.querySelectorAll('#sfRoot form[data-lform]'), function (f) {
      return f.offsetParent !== null;
    });
  return (
    fs.find(function (f) {
      return f.contains(ae);
    }) ||
    fs[0] ||
    null
  );
}
function lowBoxEsc() {
  const f = lowBoxOpen();
  if (!f) return;
  const w = f.dataset.lform,
    st = lowState(),
    inp = f.querySelector('input');
  if (inp && inp.value) {
    inp.value = '';
    st.line[w] = '';
    const l = document.getElementById('sfLowL' + w);
    if (l) l.textContent = '';
    return;
  }
  st.form[w] = false;
  st.line[w] = '';
  lowRefresh();
  const b = document.querySelector('#sfLow' + w + ' [data-lmore]');
  if (b)
    try {
      b.focus({ preventScroll: true });
    } catch (_) {}
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', function (e) {
    const b = e.target && e.target.closest ? e.target.closest('#sfRoot .sflow button') : null;
    if (!b) return;
    const h = b.closest('.sflow-host'),
      w = h ? h.dataset.w : '';
    if (b.dataset.lk) lowTap(b.dataset.lk);
    else if (b.dataset.lmore) {
      const st = lowState();
      st.form[w] = !st.form[w];
      st.line[w] = '';
      lowRefresh();
      const inp = document.getElementById('sfLowIn' + w);
      if (inp)
        try {
          inp.focus();
        } catch (_) {}
    }
  });
  document.addEventListener('submit', function (e) {
    const f = e.target && e.target.closest ? e.target.closest('#sfRoot form[data-lform]') : null;
    if (!f) return;
    e.preventDefault();
    const inp = f.querySelector('input');
    lowFind(f.dataset.lform, inp ? inp.value : '');
  });
}
