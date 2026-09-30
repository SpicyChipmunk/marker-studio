function popAt(l) {
  if (!comps || !comps[l] || !cv || !sfView) return;
  var r = cv.getBoundingClientRect(),
    hs = picHost(),
    vr = hs.getBoundingClientRect(),
    k = picK(),
    _lp = labelPos(l),
    sx = (r.left - vr.left + (_lp.x / W) * r.width) / k,
    sy = (r.top - vr.top + (_lp.y / H) * r.height) / k,
    hex = assignData && assignData.assign[l] ? assignData.assign[l].hex : '#fff',
    d = document.createElement('div');
  d.className = 'sfpop';
  d.style.left = sx + 'px';
  d.style.top = sy + 'px';
  d.style.borderColor = hex;
  (picEl || sfView).appendChild(d);
  setTimeout(function () {
    if (d.parentNode) d.parentNode.removeChild(d);
  }, 460);
}
// The marker picker (section colour, Blend's anchors, the Paint brush, fill), in the shared sheet under the pinned
// picture: the title and a code filter (never focused by itself: on a phone its keyboard would cover the picker),
// then "Recently used" and one group per colour family, light to dark; Cancel and Done at the foot. o.pool limits
// the choice (default: the guide's palette). A pick previews at once; Cancel/Escape undoes it (o.onCancel), Done or
// closing the sheet another way keeps it and remembers the marker as recently used. Opening another picker while
// one is open keeps the first one's pick and refills the same sheet.
function recentMk() {
  try {
    const a = JSON.parse(localStorage.getItem('ms-recent-mk') || '[]');
    return Array.isArray(a)
      ? a
          .filter(function (k) {
            return typeof k === 'string';
          })
          .slice(0, 12)
      : [];
  } catch (_) {
    return [];
  }
}
function pushRecent(k) {
  if (typeof k !== 'string' || !k) return;
  try {
    const a = recentMk().filter(function (x) {
      return x !== k;
    });
    a.unshift(k);
    localStorage.setItem('ms-recent-mk', JSON.stringify(a.slice(0, 12)));
  } catch (_) {}
}
function popOpen() {
  return !!(popCtx && sheetO && sheetO.o.pick === popCtx);
}
function swTile(m, cur, mixed) {
  const on = m.mkey === cur;
  return (
    '<button type="button" class="sfsw' +
    (on ? ' on' : '') +
    '" data-k="' +
    esc(m.mkey) +
    '" data-code="' +
    esc((m.code || '').toUpperCase()) +
    '" aria-pressed="' +
    on +
    '" title="' +
    esc(m.code + ' ' + (m.name || '')) +
    '" aria-label="' +
    esc(m.brand + ' ' + m.code + ' ' + (m.name || '')) +
    '"><span class="sfswc" style="background:' +
    esc(m.hex) +
    '">' +
    (mixed ? '<span class="sfswb">' + esc(bTag(m.brand)) + '</span>' : '') +
    '</span><span class="sfswt">' +
    esc(m.code) +
    '</span></button>'
  );
}
// (what opened it is noted before the tip it may sit in goes, so focus can go back there when it closes)
function openSwatchPop(o) {
  if (!cv || !sfView) return;
  const op = o.opener || document.activeElement,
    tsec = o.opener ? o.tipSec || -1 : op && op.closest && op.closest('.sftip') && tipL > 0 ? tipL : -1;
  if (root.classList.contains('sffull')) exitFull();
  if (popOpen()) closeSwatchPop(true, true);
  hideTip();
  var pool = (o.pool || poolFor(palette)).filter(function (m) {
      return m && m.mkey;
    }),
    cur = o.curKey,
    bk = {},
    br = {};
  pool.forEach(function (m) {
    bk[m.mkey] = m;
    br[m.brand] = 1;
  });
  var mixed = collMixed() || Object.keys(br).length > 1,
    light = function (a, b) {
      return (b.lab ? b.lab[0] : 0) - (a.lab ? a.lab[0] : 0) || String(a.code).localeCompare(String(b.code));
    },
    groups = {};
  pool.forEach(function (m) {
    var f = m.fam || 'Other';
    (groups[f] || (groups[f] = [])).push(m);
  });
  var fo = function (f) {
      var i = FAM_ORDER.indexOf(f);
      return i < 0 ? 99 : i;
    },
    fams = Object.keys(groups).sort(function (a, b) {
      return fo(a) - fo(b) || (a < b ? -1 : a > b ? 1 : 0);
    }),
    rec = recentMk()
      .filter(function (k) {
        return bk[k];
      })
      .map(function (k) {
        return bk[k];
      }),
    gi = 0;
  var grp = function (name, list, cls) {
    var id = 'sfPopG' + gi++;
    return (
      '<div class="sfswg' +
      (cls ? ' ' + cls : '') +
      '" role="group" aria-labelledby="' +
      id +
      '"><div class="sfswh" id="' +
      id +
      '">' +
      esc(name) +
      '</div><div class="sfswl">' +
      list
        .map(function (m) {
          return swTile(m, cur, mixed);
        })
        .join('') +
      '</div></div>'
    );
  };
  var field =
      '<input id="sfPopFilter" type="text" aria-label="Filter by marker code" placeholder="Code (B, RV, YR\u2026)" autocomplete="off" autocapitalize="characters" spellcheck="false">',
    body =
      (o.sub || o.extraLabel
        ? '<div class="sfpops">' +
          (o.sub || '') +
          (o.extraLabel
            ? '<button type="button" id="sfPopExtra" class="sfghost sfpopx">' +
              esc(o.extraLabel) +
              '</button>'
            : '') +
          '</div>'
        : '') +
      (o.opts || '') +
      '<div id="sfPopSw">' +
      (rec.length ? grp('Recently used', rec, 'sfswrec') : '') +
      fams
        .map(function (f) {
          return grp(f, groups[f].slice().sort(light));
        })
        .join('') +
      '<div class="sfswnone" hidden>No marker codes start with that.</div></div>',
    foot =
      '<button type="button" id="sfPopCancel" class="sfghost">Cancel</button><button type="button" id="sfPopConfirm">Done</button>';
  // the sheet a picker left open for the next one, else a new one (the page stays where the sheet put it)
  var so = sheetO && sheetO.o.picker && !sheetO.o.pick ? sheetO.o : null,
    el;
  if (so) {
    el = sheetO.el;
    el.querySelector('.sfshhd').innerHTML = '<h3 id="sfSheetT">' + esc(o.title) + '</h3>' + field;
    el.querySelector('.sfshbody').innerHTML = body;
    el.querySelector('.sfshft').innerHTML = foot;
  } else {
    so = {
      title: o.title,
      field: field,
      body: body,
      foot: foot,
      restore: false,
      picker: true,
      opener: op && op !== document.body ? op : null,
      tipSec: tsec,
      onClose: function () {
        if (popCtx && so.pick === popCtx) closeSwatchPop();
      },
    };
    el = openSheet(so);
    el.classList.add('sfpicksh');
  }
  so.pick = o;
  popCtx = o;
  outlineSecs(o.targets ? o.targets() : null);
  planBtn();
  var sw = el.querySelector('#sfPopSw'),
    first = sw && (sw.querySelector('.sfsw.on') || sw.querySelector('.sfsw'));
  // without recent picks to show first, start at the chosen marker's family
  if (sw && first && first.classList.contains('on') && !sw.querySelector('.sfswrec')) {
    var g = first.closest('.sfswg'),
      gt = g ? g.offsetTop : 0,
      tb = first.offsetTop + first.offsetHeight;
    var hd = g && g.querySelector('.sfswh');
    sw.scrollTop = Math.max(
      0,
      tb - gt > sw.clientHeight ? first.offsetTop - (hd ? hd.offsetHeight : 0) - 6 : gt,
    );
  }
  var ae = document.activeElement;
  if (first && (!ae || ae === document.body || el.contains(ae) || !ae.isConnected))
    try {
      first.focus({ preventScroll: true });
    } catch (_) {}
  if (sw)
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('.sfsw');
      if (!b || !sw.contains(b)) return;
      var k = b.dataset.k;
      guideDirty = true;
      sw.querySelectorAll('.sfsw').forEach(function (x) {
        var on = x.dataset.k === k;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (popCtx === o) {
        o._picked = k;
        if (o.onPick) o.onPick(k);
        holdSave();
      }
    });
  var ff = el.querySelector('#sfPopFilter');
  if (ff && sw)
    ff.addEventListener('input', function () {
      var q = this.value.trim().toUpperCase(),
        any = false;
      sw.querySelectorAll('.sfswg').forEach(function (g) {
        if (g.classList.contains('sfswrec')) {
          g.hidden = !!q;
          return;
        }
        var n = 0;
        g.querySelectorAll('.sfsw').forEach(function (b) {
          var ok = !q || (b.getAttribute('data-code') || '').indexOf(q) === 0;
          b.hidden = !ok;
          if (ok) n++;
        });
        g.hidden = !n;
        if (n) any = true;
      });
      var none = sw.querySelector('.sfswnone');
      if (none) none.hidden = any;
    });
  var cf = el.querySelector('#sfPopConfirm');
  if (cf)
    cf.addEventListener('click', function () {
      closeSwatchPop();
    });
  var cn = el.querySelector('#sfPopCancel');
  if (cn)
    cn.addEventListener('click', function () {
      if (popCtx === o) {
        o._cancel = true;
        if (o.onCancel) o.onCancel();
      }
      closeSwatchPop();
    });
  var ex = el.querySelector('#sfPopExtra');
  if (ex)
    ex.addEventListener('click', function () {
      guideDirty = true;
      if (popCtx === o && o.onExtra) o.onExtra();
    });
}
// End the picker: keep or undo its pick (whichever its buttons decided), then record the plan step. keep: leave the
// sheet open for the picker that follows straight away (and record the step without a toast over the sheet: ↶ Undo
// is in the tool row above it).
function closeSwatchPop(runClose, keep) {
  var c = popCtx;
  popCtx = null;
  outlineSecs(null);
  if (sheetO && sheetO.o.picker) {
    if (keep) sheetO.o.pick = null;
    else closeSheet(true);
  }
  if (!c) return;
  if (!c._cancel && c._picked) pushRecent(c._picked);
  if (c.onEnd) c.onEnd(!!c._cancel);
  if (runClose !== false && c.onClose) c.onClose();
  planCommit(c.why, !!keep);
  renderTools();
  if (guideDirty && !popCtx) scheduleAutosave();
}
// A picker's preview isn't a choice yet: auto-save waits (else the Library entry would get a colour that Cancel then
// takes back) until the picker closes
function pickPending() {
  return !!(popCtx && popCtx._picked);
}
function holdSave() {
  if (pickPending() && autoT) {
    clearTimeout(autoT);
    autoT = null;
  }
}
// A tap on the picture while a section's or an anchor's picker is open: the picker moves to the tapped section,
// keeping what was picked for the last one (its own Undo step; nothing when nothing new was picked). A section the
// picker already covers (Everywhere) changes nothing. Other pickers (brush, fill) just close.
function pickTap(l) {
  const c = popCtx;
  if (!c) return;
  if (!c.moves) {
    closeSwatchPop();
    return;
  }
  if (!(l > 0 && assignData && assignData.assign[l])) return;
  if (c.targets && c.targets().indexOf(l) >= 0) return;
  const had = !!(c._picked && c._picked !== c.curKey);
  openSectionPop(l, { manual: family === 'manual' });
  if (!popOpen()) {
    closeSheet(true);
    return;
  }
  const m = assignData.assign[l];
  sayLive((had ? 'Kept. ' : '') + 'Now changing the section with ' + m.code + ' ' + (m.name || ''));
}
// press and hold (or right-click) a section in Blend: its tip, or the open picker moves to it
function holdSec(l) {
  if (popOpen() && popCtx.moves) {
    pickTap(l);
    return;
  }
  if (popOpen()) closeSwatchPop();
  showTip(l, true);
}
function openAnchorPop(idx) {
  if (idx < 0 || !anchors[idx]) return;
  if (popOpen()) {
    if (popCtx.anchor === idx) return;
    closeSwatchPop(true, true);
  }
  selAnchor = idx;
  var a = anchors[idx],
    _o = a.mkey;
  openSwatchPop({
    anchor: idx,
    moves: true,
    title: 'Anchor ' + (idx + 1),
    curKey: a.mkey,
    onCancel: function () {
      if (selAnchor >= 0 && anchors[selAnchor]) {
        anchors[selAnchor].mkey = _o;
        blendNow();
        renderGuide();
      }
    },
    onPick: function (k) {
      if (selAnchor >= 0 && anchors[selAnchor]) {
        anchors[selAnchor].mkey = k;
        blendNow();
        renderGuide();
      }
    },
    extraLabel: 'Remove anchor',
    onExtra: function () {
      if (selAnchor >= 0) {
        anchors.splice(selAnchor, 1);
        selAnchor = -1;
        blendNow();
        renderGuide();
        renderControls();
      }
      closeSwatchPop(false);
    },
    onClose: function () {
      selAnchor = -1;
      renderGuide();
    },
  });
  sayLive('Anchor ' + (idx + 1));
}
/* The outline on the section (or, with Everywhere, sections) a picker is changing: a canvas over just those
    sections, in the picture's scaled wrapper so it follows zoom, pan and the shrink. It pulses (steady when motion is
    reduced) on top of the live preview. It is redrawn when the sections change or the picture's size on the screen
    changes enough to blur or thicken the line; otherwise only moved. */
let olEl = null,
  olSet = null,
  olKey = '';
function outlineSecs(ls) {
  olSet = ls && ls.length ? ls.slice() : null;
  olKey = '';
  positionOutline();
}
function positionOutline() {
  const on = !!(olSet && cv && sfView && labels && sfmode === 'guide' && !root.classList.contains('sfrev'));
  if (!on) {
    if (olEl) {
      olEl.style.display = 'none';
      olEl.dataset.secs = '';
    }
    return;
  }
  if (!olEl) {
    olEl = document.createElement('canvas');
    olEl.className = 'sfoutline';
    olEl.setAttribute('aria-hidden', 'true');
  }
  if (olEl.parentNode !== (picEl || sfView)) (picEl || sfView).appendChild(olEl);
  const B = secBoxes(),
    r0 = cv.getBoundingClientRect(),
    vr = picHost().getBoundingClientRect(),
    q = picK(),
    k = r0.width / q / W;
  if (!(k > 0)) return;
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1,
    y1 = -1;
  olSet.forEach(function (l) {
    if (l < B.K && B.x1[l] >= 0) {
      x0 = Math.min(x0, B.x0[l]);
      y0 = Math.min(y0, B.y0[l]);
      x1 = Math.max(x1, B.x1[l]);
      y1 = Math.max(y1, B.y1[l]);
    }
  });
  if (x1 < 0) {
    olEl.style.display = 'none';
    return;
  }
  // line widths in screen pixels: 3 yellow inside 1.5 dark; the canvas holds s of its pixels per picture pixel
  const dpr = Math.min(3, window.devicePixelRatio || 1),
    s = Math.min(1, Math.round(k * dpr * 8) / 8 || 0.125),
    pad = Math.ceil(5 / k) + 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  const key = olSet.join(',') + '|' + s + '|' + W + 'x' + H;
  if (key !== olKey) {
    olKey = key;
    const ow = Math.max(1, Math.ceil((x1 - x0 + 1) * s)),
      oh = Math.max(1, Math.ceil((y1 - y0 + 1) * s)),
      f = new Uint8Array(comps.length);
    olSet.forEach(function (l) {
      if (l < f.length) f[l] = 1;
    });
    const m = document.createElement('canvas');
    m.width = ow;
    m.height = oh;
    const mc = m.getContext('2d'),
      im = mc.createImageData(ow, oh),
      d = im.data;
    for (let j = 0; j < oh; j++) {
      const y = Math.min(H - 1, y0 + Math.floor((j + 0.5) / s)),
        row = y * W;
      for (let i = 0; i < ow; i++) {
        const L = labels[row + Math.min(W - 1, x0 + Math.floor((i + 0.5) / s))];
        if (L > 0 && f[L]) d[(j * ow + i) * 4 + 3] = 255;
      }
    }
    mc.putImageData(im, 0, 0);
    const px = s / k,
      ring = function (rad, col) {
        const o = document.createElement('canvas');
        o.width = ow;
        o.height = oh;
        const oc = o.getContext('2d');
        for (let a = 0; a < 16; a++) {
          const t = (a / 16) * 6.2832;
          oc.drawImage(m, Math.cos(t) * rad, Math.sin(t) * rad);
        }
        oc.globalCompositeOperation = 'source-in';
        oc.fillStyle = col;
        oc.fillRect(0, 0, ow, oh);
        oc.globalCompositeOperation = 'destination-out';
        oc.drawImage(m, 0, 0);
        return o;
      };
    olEl.width = ow;
    olEl.height = oh;
    const g = olEl.getContext('2d');
    g.clearRect(0, 0, ow, oh);
    g.drawImage(ring(Math.max(1.5, 4.5 * px), 'rgba(0,0,0,.7)'), 0, 0);
    g.drawImage(ring(Math.max(1, 3 * px), '#ffd84a'), 0, 0);
    olEl.dataset.secs = olSet.join(' ');
  }
  const st = olEl.style;
  st.display = '';
  st.left = (r0.left - vr.left) / q + x0 * k + 'px';
  st.top = (r0.top - vr.top) / q + y0 * k + 'px';
  st.width = (x1 - x0 + 1) * k + 'px';
  st.height = (y1 - y0 + 1) * k + 'px';
}
function mkByKey(k) {
  for (var i = 0; i < coll.length; i++) if (coll[i].mkey === k) return coll[i];
  return null;
}
// "Change colour" for one section: any marker in the collection; the choice is a pin, so Shuffle, Surprise and
// other patterns keep it. In Manual (opt.manual) a tap opens this straight away and can unpin to allow Fill.
// When other sections use the same marker, "Everywhere" swaps it in all of them at once (each one pinned, one Undo
// step). Sections already ticked done in colour along keep the old marker and their tick: that ink is on the paper.
function openSectionPop(l, opt) {
  opt = opt || {};
  if (!comps[l] || !assignData || !assignData.assign[l]) return;
  const op = document.activeElement,
    inTip = !!(op && op.closest && op.closest('.sftip'));
  if (popOpen()) closeSwatchPop(true, true);
  hideTip();
  var A = assignData.assign,
    _om = A[l],
    _same = assignData.order.filter(function (x) {
      return x !== l && A[x] && A[x].mkey === _om.mkey;
    }),
    _kept = _same.filter(function (x) {
      return !!(colored && colored[x]);
    }),
    _to = [l].concat(
      _same.filter(function (x) {
        return !(colored && colored[x]);
      }),
    ),
    _sv = {},
    all = false,
    cur = null,
    N = _to.length;
  [l].concat(_same).forEach(function (x) {
    _sv[x] = { m: A[x], p: locks[x] !== undefined, k: locks[x] };
  });
  var back = function (x) {
    var s = _sv[x];
    if (!assignData || !s || assignData.assign[x] === undefined) return;
    assignData.assign[x] = s.m;
    if (s.p) locks[x] = s.k;
    else delete locks[x];
  };
  var put = function () {
    if (!cur || !assignData) return;
    var m = mkByKey(cur);
    if (!m) return;
    for (var x in _sv) back(+x);
    if (cur !== _om.mkey)
      (all ? _to : [l]).forEach(function (x) {
        if (assignData.assign[x] === undefined) return;
        assignData.assign[x] = m;
        locks[x] = cur;
      });
    renderGuide();
    renderControls();
  };
  var scope =
    N > 1
      ? '<div class="sfpopscope" role="group" aria-label="Where to change it"><button type="button" class="sfedit on" data-sc="one" aria-pressed="true">Only this section</button><button type="button" class="sfedit" data-sc="all" aria-pressed="false">Everywhere (' +
        N +
        ' sections)</button></div>' +
        (_kept.length
          ? '<div class="sfpopnote" hidden>' +
            _kept.length +
            ' coloured section' +
            (_kept.length === 1 ? ' keeps ' : 's keep ') +
            esc(_om.code) +
            '</div>'
          : '')
      : '';
  var o = {
    sec: l,
    moves: true,
    opener: op && op !== document.body ? op : null,
    tipSec: inTip ? l : -1,
    targets: function () {
      return all ? _to : [l];
    },
    title: 'Change colour',
    sub:
      '<i style="background:' +
      esc(_om.hex) +
      '"></i><span>Now <b>' +
      esc(_om.code) +
      '</b> ' +
      esc(_om.name || '') +
      (brandsMixed() ? ' · ' + esc(_om.brand) : '') +
      '</span>',
    opts: scope,
    pool: coll,
    curKey: _om.mkey,
    onPick: function (k) {
      cur = k;
      put();
    },
    extraLabel: opt.manual && _sv[l].p ? 'Unpin (allow fill)' : null,
    onExtra: function () {
      for (var x in _sv) if (+x !== l) back(+x);
      delete locks[l];
      renderGuide();
      renderControls();
      closeSwatchPop(false);
    },
    onCancel: function () {
      for (var x in _sv) back(+x);
      renderGuide();
      renderControls();
    },
    onEnd: function (cancelled) {
      if (cancelled || !assignData || !colored || assignData.assign[l] === undefined) return;
      var m = assignData.assign[l],
        ch = 0;
      for (var x in _sv) {
        var a = assignData.assign[x];
        if (a && a.mkey !== _sv[x].m.mkey) {
          toneDrop(+x);
          ch++;
        }
      }
      // what changed is said on Done, e.g. "R16 → R28, 9 sections"
      if (ch) {
        guideDirty = true;
        if (all && ch > 1)
          o.why =
            'Replaced ' +
            _om.code +
            ' with ' +
            m.code +
            ' in ' +
            ch +
            ' sections' +
            (_kept.length ? ' (' + _kept.length + ' coloured kept ' + _om.code + ')' : '');
        sayLive(
          _om.code +
            ' \u2192 ' +
            m.code +
            ' ' +
            (m.name || '') +
            ', ' +
            ch +
            ' section' +
            (ch === 1 ? '' : 's') +
            (ch === 1 && locks[l] !== undefined ? ', pinned' : ''),
        );
      }
      normalizeTones();
      renderGuide();
      renderControls();
    },
  };
  openSwatchPop(o);
  // Only this section / Everywhere: the preview and the outlines follow
  var sc = document.querySelector('#sfSheet .sfpopscope');
  if (sc)
    sc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sc]');
      if (!b || popCtx !== o) return;
      all = b.dataset.sc === 'all';
      sc.querySelectorAll('[data-sc]').forEach(function (x) {
        var on = x === b;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var nt = document.querySelector('#sfSheet .sfpopnote');
      if (nt) nt.hidden = !all;
      put();
      holdSave();
      outlineSecs(o.targets());
    });
}
// Pin: keep this section's marker through Shuffle, Surprise and pattern changes. Unpin gives it back to the pattern.
function togglePin(l) {
  if (!assignData || !assignData.assign[l]) return;
  var was = assignData.assign[l];
  if (locks[l] !== undefined) {
    delete locks[l];
    if (family !== 'manual' && assignData.base && assignData.base[l])
      assignData.assign[l] = assignData.base[l];
  } else locks[l] = was.mkey;
  if (assignData.assign[l] !== was && colored) toneDrop(l);
  guideDirty = true;
  normalizeTones();
  renderGuide();
  renderControls();
  var m = assignData.assign[l];
  sayLive((locks[l] !== undefined ? 'Pinned ' : 'Unpinned ') + m.code + ' ' + (m.name || ''));
  planCommit();
}
// Fill: every unpinned section still to colour takes the marker (one ticked done keeps its own, as with Everywhere:
// that ink is on the paper); a section that changes marker starts its tones afresh, and Undo brings them back. With
// zones, the zone being edited only (it's that zone's Manual pattern's Fill).
function openFillPop() {
  if (!assignData) return;
  var _snap = {},
    _inZ = function (l) {
      return !zones.length || zoneOf(l) === zoneCur;
    };
  assignData.order.forEach(function (l) {
    _snap[l] = assignData.assign[l];
  });
  openSwatchPop({
    title: 'Fill unpinned sections' + (zones.length ? ' in ' + zoneName(zoneCur) : ''),
    why: 'Unpinned sections filled',
    curKey: null,
    onPick: function (k) {
      var bk = {};
      coll.forEach(function (m) {
        bk[m.mkey] = m;
      });
      if (bk[k]) {
        assignData.order.forEach(function (l) {
          if (locks[l] === undefined && !(colored && colored[l]) && _inZ(l)) assignData.assign[l] = bk[k];
        });
        renderGuide();
      }
    },
    onCancel: function () {
      assignData.order.forEach(function (l) {
        if (_snap[l]) assignData.assign[l] = _snap[l];
      });
      renderGuide();
    },
    onEnd: function (cancelled) {
      if (cancelled || !assignData || !colored) return;
      assignData.order.forEach(function (l) {
        const a = assignData.assign[l];
        if (a && _snap[l] && a.mkey !== _snap[l].mkey) toneDrop(l);
      });
      normalizeTones();
    },
    onClose: function () {
      renderGuide();
    },
  });
}
