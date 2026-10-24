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
    esc((capCode(m) || '').toUpperCase()) +
    // (v318.21 debug: an older cap's marker found by its code now too, R213 as well as R6, as codeFind finds it)
    '" data-code2="' +
    esc((m.code || '').toUpperCase()) +
    '" aria-pressed="' +
    on +
    '" title="' +
    esc(capLabel(m) + ' ' + (capName(m) || '')) +
    '" aria-label="' +
    // (v318.22 debug: the * said in words, as msay says it, not read out as "star")
    esc(m.brand + ' ' + capCode(m) + ' ' + (capName(m) || '') + (capStar(m) ? ', your older cap' : '')) +
    '"><span class="sfswc" style="background:' +
    esc(m.hex) +
    '">' +
    (mixed ? '<span class="sfswb">' + esc(bTag(m.brand)) + '</span>' : '') +
    '</span><span class="sfswt">' +
    esc(capLabel(m)) +
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
    // (v288) shortcuts above the families: Closest (the nearest you own, 3 lighter and 3 darker around the current
    // one), In this guide (the markers already on the page, lightest first), then Recently used (only ones not
    // already shown above)
    near = (function () {
      var c = cur && bk[cur];
      if (!c || !c.lab) return [];
      var d = function (m) {
          var a = m.lab,
            b = c.lab;
          return (
            (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) + (a[2] - b[2]) * (a[2] - b[2])
          );
        },
        others = pool
          .filter(function (m) {
            return m.mkey !== cur && m.lab;
          })
          .sort(function (a, b) {
            return d(a) - d(b);
          }),
        hi = others.filter(function (m) {
          return m.lab[0] >= c.lab[0];
        }),
        lo = others.filter(function (m) {
          return m.lab[0] < c.lab[0];
        }),
        h = hi.slice(0, 3),
        l = lo.slice(0, 3);
      if (h.length < 3) l = lo.slice(0, 6 - h.length);
      if (l.length < 3) h = hi.slice(0, 6 - l.length);
      return h.concat(l).sort(light);
    })(),
    inGuide = (assignData && o.guideRow !== false ? pageMarkerKeys() : [])
      .filter(function (k) {
        return bk[k];
      })
      .map(function (k) {
        return bk[k];
      })
      .sort(light),
    shown = near.concat(inGuide).reduce(function (o, m) {
      o[m.mkey] = 1;
      return o;
    }, {}),
    rec = recentMk()
      .filter(function (k) {
        return bk[k] && !shown[k];
      })
      .map(function (k) {
        return bk[k];
      }),
    // (v318.26) Skin tones, after Recently used: the markers here from Ohuhu's 36 Skin Tones set and Copic's skin picks
    // (skinIdx, events.js), lightest first; only with 3 or more of them (all of them, even those shown above: a row
    // to choose a face's or a hand's from in one place)
    skin = (typeof skinIdx === 'function' ? skinIdx() : [])
      .map(function (i) {
        return bk[mkey(i)];
      })
      .filter(Boolean),
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
      (o.sub || o.extraLabel || o.whiteLabel
        ? '<div class="sfpops' +
          (o.extraLabel && o.whiteLabel ? ' sfpops2' : '') +
          '">' +
          (o.sub || '') +
          (o.extraLabel && o.whiteLabel ? '<div class="sfpopxw">' : '') +
          (o.extraLabel
            ? '<button type="button" id="sfPopExtra" class="sfghost sfpopx">' +
              esc(o.extraLabel) +
              '</button>'
            : '') +
          (o.whiteLabel
            ? '<button type="button" id="sfPopWhite" class="sfghost sfpopx">' +
              esc(o.whiteLabel) +
              '</button>'
            : '') +
          (o.extraLabel && o.whiteLabel ? '</div>' : '') +
          '</div>'
        : '') +
      (o.opts || '') +
      '<div id="sfPopSw">' +
      (near.length ? grp('Closest', near, 'sfswrec sfswrow') : '') +
      (inGuide.length > 1 ? grp('In this guide', inGuide, 'sfswrec sfswrow') : '') +
      (rec.length ? grp('Recently used', rec, 'sfswrec sfswrow') : '') +
      (skin.length >= 3 ? grp('Skin tones', skin, 'sfswrec sfswrow sfswskin') : '') +
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
    el.querySelector('.sfshhd').innerHTML = '<h2 id="sfSheetT">' + esc(o.title) + '</h2>' + field;
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
  // (v289) a sideways row with more past its edge fades there, until it's scrolled to its end (and again as the
  // sheet changes width: swFadeAll on resize)
  if (sw)
    sw.querySelectorAll('.sfswrow .sfswl').forEach(function (r) {
      swFade(r);
      r.addEventListener(
        'scroll',
        function () {
          swFade(r);
        },
        { passive: true },
      );
      requestAnimationFrame(function () {
        swFade(r);
      });
    });
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
  // (v289) by keyboard: one Tab stop per row or group (the chosen marker, else its first), the arrow keys within it
  if (sw) {
    swRove(sw, first);
    sw.addEventListener('keydown', function (e) {
      swArrow(e, sw);
    });
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
          var ok =
            !q ||
            (b.getAttribute('data-code') || '').indexOf(q) === 0 ||
            (b.getAttribute('data-code2') || '').indexOf(q) === 0;
          b.hidden = !ok;
          if (ok) n++;
        });
        g.hidden = !n;
        if (n) any = true;
      });
      var none = sw.querySelector('.sfswnone');
      if (none) none.hidden = any;
      swRove(sw);
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
  var wb = el.querySelector('#sfPopWhite');
  if (wb)
    wb.addEventListener('click', function () {
      if (popCtx === o && o.onWhite) o.onWhite();
    });
}
function swFade(r) {
  r.classList.toggle('sffade', r.scrollWidth - r.clientWidth - r.scrollLeft > 2);
}
function swFadeAll() {
  document.querySelectorAll('#sfPopSw .sfswrow .sfswl').forEach(swFade);
}
window.addEventListener('resize', function () {
  requestAnimationFrame(swFadeAll);
});
// Change colour by keyboard (v289): each row or group of markers is one Tab stop (roving tabindex): the one focused
// last, else the chosen marker, else the first shown; keep: a tile that keeps it
function swRove(sw, keep) {
  sw.querySelectorAll('.sfswl').forEach(function (l) {
    const items = [].filter.call(l.querySelectorAll('.sfsw'), function (b) {
      return !b.hidden;
    });
    const cur =
      items.find(function (b) {
        return b === keep || b === document.activeElement;
      }) ||
      items.find(function (b) {
        return b.getAttribute('tabindex') === '0';
      }) ||
      items.find(function (b) {
        return b.classList.contains('on');
      }) ||
      items[0];
    l.querySelectorAll('.sfsw').forEach(function (b) {
      b.tabIndex = b === cur ? 0 : -1;
    });
  });
}
// the arrow keys within a row or group: ← → along it, ↑ ↓ to the tile above or below in a group of several lines
// (along a single row as ← →), Home and End to its ends
function swArrow(e, sw) {
  const t = e.target;
  if (!t || !t.classList || !t.classList.contains('sfsw') || e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(k) < 0) return;
  const l = t.closest('.sfswl'),
    items = [].filter.call(l.querySelectorAll('.sfsw'), function (b) {
      return !b.hidden;
    }),
    i = items.indexOf(t);
  if (i < 0) return;
  let j = i;
  if (k === 'Home') j = 0;
  else if (k === 'End') j = items.length - 1;
  else if (k === 'ArrowLeft') j = Math.max(0, i - 1);
  else if (k === 'ArrowRight') j = Math.min(items.length - 1, i + 1);
  else {
    const down = k === 'ArrowDown',
      y = t.offsetTop,
      x = t.offsetLeft;
    // the line above or below: the nearest tile on it; a single row (no such line): the next one along
    let line = null;
    items.forEach(function (b) {
      const by = b.offsetTop;
      if (down ? by > y + 1 && (line == null || by < line) : by < y - 1 && (line == null || by > line))
        line = by;
    });
    if (line == null) {
      if (items.every((b) => Math.abs(b.offsetTop - y) <= 1))
        j = down ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
    } else {
      let bd = 1e9;
      items.forEach(function (b, n) {
        if (Math.abs(b.offsetTop - line) > 1) return;
        const d = Math.abs(b.offsetLeft - x);
        if (d < bd) {
          bd = d;
          j = n;
        }
      });
    }
  }
  e.preventDefault();
  if (j === i) return;
  t.tabIndex = -1;
  items[j].tabIndex = 0;
  items[j].focus({ preventScroll: true });
  try {
    items[j].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch (_) {}
  void sw;
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
  sayLive((had ? 'Done. ' : '') + 'Now changing the section with ' + msay(m) + ' ' + (capName(m) || ''));
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
        // (the last one: Blend starts again from three (blendNow), and its Undo step says so, v304)
        if (!anchors.length) planWhy = 'Last anchor removed: Blend starts again from 3';
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
  olKey = '',
  // (what the outline's canvas holds, for drawing again only what a tick changed: positionOutline)
  _olDrawn = null;
// once: one pulse as it arrives, then steady (Find next, v288); otherwise it pulses while the picker is open
let olOnce = false,
  olMerge = -1;
// (v323) the outline is a partly coloured page's offer's (colOfferShow, 82-colour-mode)
let _olOffer = false;
function outlineSecs(ls, once, offer) {
  _olOffer = !!offer && !!(ls && ls.length);
  olRow = false;
  olGroups = null;
  olSet = ls && ls.length ? ls.slice() : null;
  olKey = '';
  _olDrawn = null;
  olOnce = !!once;
  olMerge = -1;
  positionOutline();
  if (olEl && olSet) {
    olEl.classList.remove('sfolonce');
    if (olOnce) {
      void olEl.offsetWidth;
      olEl.classList.add('sfolonce');
    }
  }
}
// Colour along (v288): with a row open, its sections still to do are outlined too, lighter and steady (a light marker's
// full colour barely shows against the pale rest). Find next's own outline comes first while its section is still to
// do. Set at each drawing of the picture.
let olRow = false,
  // (v307: a two-brand search's outline, one group of sections per marker with its colour: [{ hex, s }])
  olGroups = null;
function rowOutline() {
  const fn =
    _fnOl &&
    hlKey === _fnKey &&
    olSet &&
    !olRow &&
    olSet.every(function (l) {
      return !colored[l];
    });
  if (sfmode === 'color' && !focus && hlKey && assignData && !fn && !root.classList.contains('sfrev')) {
    const rest = assignData.order.filter(function (l) {
      return hlMatch(l) && !colored[l];
    });
    _fnOl = false;
    olSet = rest.length ? rest : null;
    olRow = !!olSet;
    olGroups = null;
    olOnce = false;
    olMerge = -1;
  } else if (sfmode === 'color' && !focus && findTwo() && assignData && !root.classList.contains('sfrev')) {
    // (v307) a code in both brands, found by its code: each marker's sections still to do, in its own colour
    const A = assignData.assign,
      gs = findTwo()
        .map(function (g) {
          return {
            hex: g.hex,
            s: assignData.order.filter(function (l) {
              return g.b[A[l].mkey] && !colored[l];
            }),
          };
        })
        .filter(function (g) {
          return g.s.length;
        }),
      all = [];
    gs.forEach(function (g) {
      g.s.forEach(function (l) {
        if (all.indexOf(l) < 0) all.push(l);
      });
    });
    _fnOl = false;
    olSet = all.length ? all : null;
    olRow = !!olSet;
    olGroups = olSet ? gs : null;
    olOnce = false;
    olMerge = -1;
  } else if (olRow) {
    olSet = null;
    olRow = false;
    olGroups = null;
    positionOutline();
  }
}
// (Colour along's Find next outlines the section it found too, until it's ticked or another colour is opened: _fnOl,
// for the colour it was found in, _fnKey)
let _fnOl = false,
  _fnKey = null;
// Edit sections' Merge (v288): the first section picked is outlined too, as on pale tints a yellow fill alone is faint.
// (v312.1) Once merged, the section they became, for a moment (_mergeFl): the line between them stays on the paper,
// so nothing else showed the merge
let _mergeFl = -1,
  _mergeFlT = 0;
function mergeFlash(l) {
  clearTimeout(_mergeFlT);
  _mergeFl = l;
  _mergeFlT = setTimeout(function () {
    _mergeFl = -1;
    outlineMerge();
  }, 1400);
}
function outlineMerge() {
  const fl = _mergeFl > 0 && comps && comps[_mergeFl] && !comps[_mergeFl].merged ? _mergeFl : -1;
  const want = sfmode === 'review' ? (mergeSel > 0 ? mergeSel : fl) : -1;
  if (want === olMerge && (want < 0 || olSet)) return;
  if (want < 0 && olMerge < 0) return;
  outlineSecs(want > 0 ? [want] : null);
  olMerge = want;
  positionOutline();
}
function positionOutline() {
  if (olMerge > 0 && sfmode !== 'review') {
    olSet = null;
    olMerge = -1;
  }
  const on = !!(
    olSet &&
    cv &&
    sfView &&
    labels &&
    (sfmode === 'guide' ||
      (sfmode === 'review' && olMerge > 0) ||
      (sfmode === 'color' && olRow && !focus) ||
      // (v323: a partly coloured page's offer in Colour along, colOfferShow)
      (sfmode === 'color' && _olOffer && !focus && !olRow && !hlKey) ||
      (sfmode === 'color' &&
        _fnOl &&
        !focus &&
        hlKey === _fnKey &&
        olSet.every(function (l) {
          return hlMatch(l) && !colored[l];
        }))) &&
    !root.classList.contains('sfrev')
  );
  if (!on) {
    if (olEl) {
      olEl.style.display = 'none';
      olEl.dataset.secs = '';
    }
    // (shown again, it's drawn whole: only a change made while it shows is drawn in part)
    _olDrawn = null;
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
    _olDrawn = null;
    return;
  }
  // line widths in screen pixels (v288): 3.5 white inside 2.5 dark, so it shows on any colour, light or dark; the canvas
  // holds s of its pixels per picture pixel
  const dpr = Math.min(3, window.devicePixelRatio || 1),
    s = Math.min(1, Math.round(k * dpr * 8) / 8 || 0.125),
    pad = Math.ceil(7 / k) + 2;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  const key =
    olSet.join(',') +
    '|' +
    s +
    '|' +
    W +
    'x' +
    H +
    (olGroups
      ? '|' +
        olGroups
          .map(function (g) {
            return g.hex + ':' + g.s.length;
          })
          .join()
      : '');
  if (key !== olKey) {
    olKey = key;
    // (v318 review) a row's outline after a tick (or an untick): the same sections but one or a few, at the same scale
    // over the same picture, so only round those few is it drawn again. Drawn whole, at each tick, it was most of the
    // tick's time on a big page (about 75 ms of 100 in Chrome on a desktop, 839 sections), as the ring is 32 copies of
    // the mask over the box round every section still to do.
    const prev = _olDrawn,
      cur = olSet.slice();
    let part = null;
    if (
      prev &&
      !olGroups &&
      !prev.groups &&
      prev.labels === labels &&
      prev.comps === comps &&
      prev.s === s &&
      prev.px === s / k &&
      prev.W === W &&
      prev.H === H &&
      olEl.width === prev.ow &&
      olEl.height === prev.oh
    ) {
      const was = prev.set,
        now = new Set(cur),
        diff = [];
      was.forEach(function (l) {
        if (!now.has(l)) diff.push(l);
      });
      now.forEach(function (l) {
        if (!was.has(l)) diff.push(l);
      });
      let area = 0;
      const inBox = diff.every(function (l) {
        if (!(l < B.K && B.x1[l] >= 0)) return false;
        area += (B.x1[l] - B.x0[l] + 1) * (B.y1[l] - B.y0[l] + 1);
        return B.x0[l] >= prev.x0 && B.y0[l] >= prev.y0 && B.x1[l] <= prev.x1 && B.y1[l] <= prev.y1;
      });
      if (
        inBox &&
        diff.length &&
        diff.length <= 12 &&
        area * 4 <= (prev.x1 - prev.x0 + 1) * (prev.y1 - prev.y0 + 1)
      )
        part = diff;
    }
    if (part) {
      // (the box stays as it was: it may now be roomier than the sections need, which shows nothing)
      x0 = prev.x0;
      y0 = prev.y0;
      x1 = prev.x1;
      y1 = prev.y1;
    }
    const ow = Math.max(1, Math.ceil((x1 - x0 + 1) * s)),
      oh = Math.max(1, Math.ceil((y1 - y0 + 1) * s));
    const px = s / k,
      rad1 = Math.max(2, 6 * px),
      rad2 = Math.max(1.2, 3.5 * px),
      // (how far round a part drawn again the mask is needed: the wider ring's reach, and a pixel for smoothing)
      reach = Math.ceil(rad1) + 2;
    // the white-inside-dark ring round sections `set`, for the outline's pixels [ci, ci + cw) × [cj, cj + ch), into g:
    // a mask of the sections over that part and `reach` round it, each ring 16 copies of it moved about, less the mask
    const paint = function (g, set, hex, ci, cj, cw, ch) {
      const ai = Math.max(0, ci - reach),
        aj = Math.max(0, cj - reach),
        lw = Math.min(ow, ci + cw + reach) - ai,
        lh = Math.min(oh, cj + ch + reach) - aj;
      if (lw < 1 || lh < 1) return;
      const f = new Uint8Array(comps.length);
      set.forEach(function (l) {
        if (l < f.length) f[l] = 1;
      });
      const m = document.createElement('canvas');
      m.width = lw;
      m.height = lh;
      const mc = m.getContext('2d'),
        im = mc.createImageData(lw, lh),
        d = im.data;
      for (let j = 0; j < lh; j++) {
        const y = Math.min(H - 1, y0 + Math.floor((aj + j + 0.5) / s)),
          row = y * W;
        for (let i = 0; i < lw; i++) {
          const L = labels[row + Math.min(W - 1, x0 + Math.floor((ai + i + 0.5) / s))];
          if (L > 0 && f[L]) d[(j * lw + i) * 4 + 3] = 255;
        }
      }
      mc.putImageData(im, 0, 0);
      const ring = function (rad, col) {
        const o = document.createElement('canvas');
        o.width = lw;
        o.height = lh;
        const oc = o.getContext('2d');
        for (let a = 0; a < 16; a++) {
          const t = (a / 16) * 6.2832;
          oc.drawImage(m, Math.cos(t) * rad, Math.sin(t) * rad);
        }
        oc.globalCompositeOperation = 'source-in';
        oc.fillStyle = col;
        oc.fillRect(0, 0, lw, lh);
        oc.globalCompositeOperation = 'destination-out';
        oc.drawImage(m, 0, 0);
        return o;
      };
      const r1 = ring(rad1, 'rgba(0,0,0,.8)'),
        r2 = ring(rad2, hex);
      g.save();
      g.beginPath();
      g.rect(ci, cj, cw, ch);
      g.clip();
      g.drawImage(r1, ai, aj);
      g.drawImage(r2, ai, aj);
      g.restore();
      // (the working canvases let go at once: Safari limits the memory all canvases hold, v289)
      freeCanvas(r1);
      freeCanvas(r2);
      freeCanvas(m);
    };
    const g = olEl.getContext('2d');
    if (part) {
      part.forEach(function (l) {
        const ci = Math.max(0, Math.floor((B.x0[l] - x0) * s) - reach),
          cj = Math.max(0, Math.floor((B.y0[l] - y0) * s) - reach),
          cw = Math.min(ow, Math.ceil((B.x1[l] - x0 + 1) * s) + reach) - ci,
          ch = Math.min(oh, Math.ceil((B.y1[l] - y0 + 1) * s) + reach) - cj;
        g.clearRect(ci, cj, cw, ch);
        paint(g, cur, '#fff', ci, cj, cw, ch);
      });
    } else {
      olEl.width = ow;
      olEl.height = oh;
      g.clearRect(0, 0, ow, oh);
      // (v307: a two-brand search's, each marker's sections in its own colour inside the dark ring)
      (olGroups || [{ s: olSet, hex: '#fff' }]).forEach(function (q) {
        paint(g, q.s, q.hex, 0, 0, ow, oh);
      });
    }
    _olDrawn = {
      set: new Set(cur),
      groups: !!olGroups,
      labels: labels,
      comps: comps,
      s: s,
      px: px,
      W: W,
      H: H,
      x0: x0,
      y0: y0,
      x1: x1,
      y1: y1,
      ow: ow,
      oh: oh,
    };
    // (many at once, Everywhere or a row's: lighter and steady)
    olEl.classList.toggle('sfolmany', olRow || olSet.length > 1);
  }
  // (set at each showing: hiding clears it, and the same sections shown again reuse the drawing, v305)
  olEl.dataset.secs = olSet.join(' ');
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
    // (any ink on the paper keeps its marker, a tone part-way done too: v284's rule, inkOn)
    _kept = _same.filter(function (x) {
      return inkOn(x);
    }),
    _to = [l].concat(
      _same.filter(function (x) {
        return !inkOn(x);
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
            esc(capLabel(_om)) +
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
      esc(capLabel(_om)) +
      '</b> ' +
      esc(capName(_om) || '') +
      (brandsMixed() ? ' · ' + esc(_om.brand) : '') +
      '</span>',
    // (v306: a line that says when the marker's code is in the guide in the other brand too)
    opts: scope + '<div id="sfPopSame" class="sfpopsame" role="status"></div>',
    pool: coll,
    curKey: _om.mkey,
    onPick: function (k) {
      cur = k;
      put();
      popSame(mkByKey(k));
    },
    extraLabel: opt.manual && _sv[l].p ? 'Unpin (allow fill)' : null,
    // (v318.26) in Manual a tap opens this, not the tip: Leave white is here too
    whiteLabel: opt.manual ? 'Leave white' : null,
    onWhite: function () {
      o._cancel = true;
      for (var x in _sv) back(+x);
      closeSwatchPop(false);
      if (leaveWhite(l)) whiteTip(l);
    },
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
        const pl = capPair(_om, m);
        if (all && ch > 1)
          o.why =
            'Replaced ' +
            pl[0] +
            ' with ' +
            pl[1] +
            ' in ' +
            ch +
            ' sections' +
            (_kept.length ? ' (' + _kept.length + ' coloured kept ' + capLabel(_om) + ')' : '');
        sayLive(
          pl[0] +
            ' \u2192 ' +
            (pl[2] ? pl[1] : pl[1] + ' ' + (capName(m) || '')) +
            ', ' +
            ch +
            ' section' +
            (ch === 1 ? '' : 's') +
            (ch === 1 && locks[l] !== undefined ? ', pinned' : ''),
        );
      }
      normalizeTones();
      // (the first time ever: a line under the tabs says the section is pinned now, v288)
      if (ch) {
        var pinned = [];
        for (var y in _sv) {
          var ay = assignData.assign[y];
          if (ay && ay.mkey !== _sv[y].m.mkey && locks[y] !== undefined) pinned.push(+y);
        }
        pinNoteFirst(pinned);
      }
      renderGuide();
      renderControls();
      // (the controls drawn again: the keyboard's focus, if it was there, goes to the pinned line's Unpin or the tab,
      // on screen under the picture, v289)
      const ae = document.activeElement;
      if (!ae || ae === document.body || !ae.isConnected)
        ctlRefocus(document.getElementById('sfPinUn') ? '#sfPinUn' : '#sfTab-' + gTab);
    },
  };
  openSwatchPop(o);
  popSame(_om);
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
      popSame(mkByKey(cur) || _om);
      holdSave();
      outlineSecs(o.targets());
    });
}
// (v306) Change colour's line under its choices: "Ohuhu Y26 is in this guide too" when the marker chosen (as the
// guide now has it, with the pick in place) shares its code with another brand's marker in the guide
function popSame(m) {
  const el = document.getElementById('sfPopSame');
  if (!el) return;
  const t = m ? sameName(m) : '';
  el.textContent = t ? t + ' is in this guide too' : '';
  el.hidden = !t;
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
  sayLive((locks[l] !== undefined ? 'Pinned ' : 'Unpinned ') + msay(m) + ' ' + (capName(m) || ''));
  planCommit();
}
// (v318.26) Leave white: the section stays white (the paper) through Shuffle, Surprise, Mood and pattern changes, out
// of the key, Colour along and the counts, until Colour it. Its marker is kept for that (whitePins, 00-state). A
// section with ink on it is unticked (its tick, tones and kept shading back on Undo, as Recolour them too's are). The
// last section with a marker stays: a guide with none is the Photo pattern's "every section left white".
function leaveWhite(l) {
  if (sfmode !== 'guide' || !assignData || !assignData.assign[l]) return false;
  if (assignData.N <= 1) {
    toast('This is the last section with a colour: it can’t be left white too.', 2600);
    return false;
  }
  const m = assignData.assign[l];
  if (colored && inkOn(l)) {
    const P = tp();
    _tickLost[l] = { c: colored[l], t: P[l], h: heldSh[l] || null };
    colored[l] = 0;
    P[l] = 0;
    heldSet(l, null);
  }
  // (the marker it had; for a stand-in, the marker the guide keeps for it, 97-open)
  whitePins[l] = _origKeys[l] ? _origKeys[l].k : m.mkey;
  whiteApply();
  guideDirty = true;
  normalizeTones();
  renderGuide();
  renderControls();
  updateProgress();
  planCommit();
  sayLive('Section left white. Colour it brings ' + msay(m) + ' back.');
  return true;
}
// Colour it: a section left white has a marker again, the one it had if you can use it (else the closest you own),
// unpinned, so the pattern lays it from the next change on
function colourWhite(l) {
  if (sfmode !== 'guide' || !assignData || whitePins[l] === undefined) return false;
  const k = whitePins[l];
  let m = mkByKey(k);
  if (!m && k) {
    const info = api.markerInfo ? api.markerInfo(k) : null;
    if (info && info.lab && coll.length) m = nearestInPool(info.lab, coll);
  }
  if (!m) m = activePool()[0] || coll[0];
  if (!m) return false;
  delete whitePins[l];
  const A = assignData.assign,
    c = comps[l];
  A[l] = m;
  (assignData.base || (assignData.base = {}))[l] = m;
  // (a stand-in for a marker marked dry or no longer yours: the guide keeps that marker for it, as on opening)
  const cm = m.mkey !== k ? catMarker(k) : null;
  if (cm) _origKeys[l] = { k: k, s: [cm.mkey, m.mkey] };
  if (assignData.paper) {
    delete assignData.paper[l];
    if (!Object.keys(assignData.paper).length) delete assignData.paper;
  }
  // (into the order where it sits on the page, top to bottom, as Manual and an opened guide have it)
  const o = assignData.order;
  let at = o.length;
  for (let i = 0; i < o.length; i++) {
    const q = comps[o[i]];
    if (q && (q.cy > c.cy || (q.cy === c.cy && q.cx > c.cx))) {
      at = i;
      break;
    }
  }
  o.splice(at, 0, l);
  assignData.N = o.length;
  guideDirty = true;
  normalizeTones();
  renderGuide();
  renderControls();
  updateProgress();
  planCommit();
  sayLive('Coloured again: ' + msay(m) + ' ' + (capName(m) || ''));
  return true;
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
          if (locks[l] === undefined && !inkOn(l) && _inZ(l)) assignData.assign[l] = bk[k];
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

// The markers on this page (v288, from the Colours tab): one row per marker the guide uses, in every zone, lightest
// first as Colour along goes, with how many sections; a stand-in for a dry marker says so; one not in your collection
// is marked To buy. With shading, the lighter and darker markers it needs are listed too. A tap on a row shows its
// sections on the picture (the rest faded), as the sheet belongs to the picture; closing puts the picture back.
function pageMarkerKeys() {
  if (!assignData) return [];
  const seen = {};
  for (const l in assignData.assign) seen[assignData.assign[l].mkey] = 1;
  return Object.keys(seen);
}
function markerListRows() {
  const by = {},
    tone = {},
    A = assignData.assign;
  for (const l in A) {
    const m = A[l],
      e = by[m.mkey] || (by[m.mkey] = { m: m, n: 0, for: {} });
    e.n++;
    const o = _origKeys[l];
    if (o && o.k && o.k !== m.mkey) e.for[o.k] = 1;
    const t = shadeOn() ? shadeSec(+l) : null;
    if (t) {
      [
        ['light', 'highlight'],
        ['dark', 'shadow'],
      ].forEach(function (p) {
        const x = t[p[0]];
        if (!x || !x.mkey) return;
        const te = tone[x.mkey] || (tone[x.mkey] = { m: x, n: 0, as: {} });
        te.n++;
        te.as[p[1]] = 1;
      });
    }
  }
  const lum = function (e) {
      return _lum(e.m.hex);
    },
    base = Object.keys(by)
      .map(function (k) {
        return by[k];
      })
      .sort(function (a, b) {
        return lum(b) - lum(a) || b.n - a.n;
      }),
    tones = Object.keys(tone)
      .filter(function (k) {
        return !by[k];
      })
      .map(function (k) {
        return tone[k];
      })
      .sort(function (a, b) {
        return lum(b) - lum(a) || b.n - a.n;
      });
  return { base: base, tones: tones };
}
function markerListSheet() {
  if (!assignData) return;
  const r = markerListRows(),
    owned = function (m) {
      try {
        const i = keyIdx(m.mkey);
        return i == null || !state.owned.size || isOwned(i);
      } catch (_) {
        return true;
      }
    },
    row = function (e, sub) {
      const m = e.m,
        notes = [];
      Object.keys(e.for || {}).forEach(function (k) {
        const i = keyIdx(k);
        notes.push('for ' + (i != null && COLORS[i] ? capLabel(i) : k) + ' (dry)');
      });
      if (!owned(m)) notes.push('To buy');
      // (v313)
      else if (inkLowNow(m.mkey)) notes.push('Running low');
      if (sub) notes.push(sub);
      // (a shading marker isn't any section's own: listed, not a button that would light nothing up)
      return (
        (sub
          ? '<div class="sfmlrow sfmlplain"'
          : '<button type="button" class="sfmlrow" data-k="' + esc(m.mkey) + '" aria-pressed="false"') +
        '><span class="sw" style="background:' +
        esc(m.hex) +
        '"></span><span class="nm">' +
        (brandsMixed() ? '<b class="btag" aria-hidden="true">' + esc(bTag(m.brand)) + '</b> ' : '') +
        '<b>' +
        esc(capLabel(m)) +
        '</b> ' +
        esc(capName(m) || '') +
        (notes.length ? '<small>' + esc(notes.join(' \u00b7 ')) + '</small>' : '') +
        '</span><span class="cnt">' +
        nWord(e.n, 'section') +
        '</span>' +
        (sub ? '</div>' : '</button>')
      );
    };
  const body =
    '<div class="sfmllist">' +
    r.base
      .map(function (e) {
        return row(e);
      })
      .join('') +
    (r.tones.length
      ? '<div class="sfmlgrp">For shading</div>' +
        r.tones
          .map(function (e) {
            return row(e, Object.keys(e.as).join(' and '));
          })
          .join('')
      : '') +
    '</div>';
  const was = { k: hlKey, z: hlZone };
  const el = openSheet({
    // (v289: the markers For shading counted too, as more)
    title:
      nWord(r.base.length, 'marker') +
      ' on this page' +
      (r.tones.length ? ', ' + r.tones.length + ' more for shading' : ''),
    body: body,
    // (a way out by touch, as every sheet has)
    foot: '<button type="button" class="sfprimary" data-ml="done">Done</button>',
    fit: true,
    cleanup: function () {
      hlKey = was.k;
      hlZone = was.z;
      renderGuide();
    },
  });
  el.addEventListener('click', function (e) {
    if (e.target.closest('[data-ml="done"]')) {
      closeSheet();
      return;
    }
    const b = e.target.closest('button.sfmlrow');
    if (!b) return;
    const k = b.dataset.k,
      on = b.getAttribute('aria-pressed') !== 'true';
    el.querySelectorAll('button.sfmlrow').forEach(function (x) {
      x.setAttribute('aria-pressed', x === b && on ? 'true' : 'false');
    });
    hlKey = on && pageMarkerKeys().indexOf(k) >= 0 ? k : null;
    hlZone = null;
    renderGuide();
  });
}
