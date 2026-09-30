function updateProgress() {
  if (!assignData) return;
  let done = 0;
  assignData.order.forEach(function (l) {
    if (colored[l]) done++;
  });
  const N = assignData.N,
    pct = N ? Math.round((done / N) * 100) : 0;
  const bar = document.getElementById('sfProgBar');
  if (bar) bar.style.width = pct + '%';
  renderTools();
  const dn = document.getElementById('sfDone');
  if (dn) dn.style.display = N > 0 && done >= N ? '' : 'none';
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
function blendCompanions(base) {
  var bl = base.lab && base.lab.length ? base.lab : hexToLab(base.hex);
  var light = _findComp(bl, base, coll, -1),
    dark = _findComp(bl, base, coll, 1);
  var lo = !!light,
    dOwn = !!dark;
  if (!light) {
    var s = _findComp(bl, base, catPool(), -1);
    if (s) {
      light = s;
      lo = false;
    }
  }
  if (!dark) {
    var s2 = _findComp(bl, base, catPool(), 1);
    if (s2) {
      dark = s2;
      dOwn = false;
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
        '<div class="plangrp' +
        (closed ? ' closed' : '') +
        '" data-g="' +
        nm.replace(/"/g, '&quot;') +
        '"><span class="pgcaret">' +
        (closed ? '\u25b8' : '\u25be') +
        '</span><span class="pgdot" style="background:' +
        gh[nm] +
        '"></span><span class="pgname">' +
        nm +
        '</span><span class="pgn">' +
        ct +
        '</span></div>' +
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
