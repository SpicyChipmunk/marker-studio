/* ---- focus mode: one section at a time. Colours go light -> dark (usual alcohol-marker order);
   within a colour, start at its top-most section and hop to the nearest remaining one. ---- */
function _lum(hex) {
  var b = hexRgb(hex);
  return 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
}
function focusBoxes() {
  var b = secBoxes();
  focusBox = { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 };
}
// the way through one marker's sections: its topmost first, then each time the nearest one left (short hops for the
// hand). Focus mode and Colour along's Find next both go this way. B: the sections' boxes (secBoxes).
function markerPath(secs, B) {
  var cxy = function (l) {
    return [(B.x0[l] + B.x1[l]) / 2, (B.y0[l] + B.y1[l]) / 2];
  };
  var rest = secs.slice(),
    top = 0,
    i,
    path = [];
  if (!rest.length) return path;
  for (i = 1; i < rest.length; i++) if (B.y0[rest[i]] < B.y0[rest[top]]) top = i;
  var l = rest.splice(top, 1)[0],
    pt = cxy(l);
  path.push(l);
  while (rest.length) {
    var bi = 0,
      bd = Infinity;
    for (i = 0; i < rest.length; i++) {
      var q = cxy(rest[i]),
        dx = q[0] - pt[0],
        dy = q[1] - pt[1],
        d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    l = rest.splice(bi, 1)[0];
    pt = cxy(l);
    path.push(l);
  }
  return path;
}
function buildFocusOrder() {
  focusOrd = [];
  if (!assignData || !comps || !labels) return;
  normalizeTones();
  focusBoxes();
  var by = {},
    keys = [];
  // (keys: markers, or with zones zone by zone "marker@zone")
  assignData.order.forEach(function (l) {
    var a = assignData.assign[l];
    if (!a || focusBox.x1[l] < 0) return;
    if (!by[a.mkey]) {
      by[a.mkey] = { hex: a.hex, secs: [] };
      keys.push(a.mkey);
    }
    by[a.mkey].secs.push(l);
  });
  keys.sort(function (a, b) {
    return _lum(by[b].hex) - _lum(by[a].hex) || by[b].secs.length - by[a].secs.length;
  });
  // zone by zone (Colour along's choice, with zones): each zone's markers in turn, lightest first, Main first
  if (alongZones()) {
    const zk = [];
    zoneIds().forEach(function (z) {
      keys.forEach(function (k) {
        const secs = by[k].secs.filter(function (l) {
          return zoneOf(l) === z;
        });
        if (secs.length) {
          const nk = k + '@' + z;
          by[nk] = { hex: by[k].hex, secs: secs };
          zk.push(nk);
        }
      });
    });
    keys = zk;
  }
  focusStep = [];
  keys.forEach(function (k) {
    var path = markerPath(by[k].secs, focusBox);
    // each section is finished before the next; a 2nd-coat shadow needs the first coat dry, so those come as a second pass
    var later = [];
    path.forEach(function (l) {
      var t = shadeSec(l),
        req = shadeReq(l);
      var add = function (b) {
        focusOrd.push(l);
        focusStep.push(b);
      };
      if (!t) {
        add(req);
        return;
      }
      // (a glaze, a cooler or grey shadow laid over the base, waits for the base to dry as a 2nd coat does)
      if (toneSteps) {
        if (t.light) add(1);
        add(2);
        if (t.coat || t.glaze) later.push(l);
        else add(4);
      } else if (t.coat || t.glaze) {
        add(req & 3);
        later.push(l);
      } else add(req);
    });
    later.forEach(function (l) {
      focusOrd.push(l);
      focusStep.push(4);
    });
  });
}
function stepBits(i) {
  return focusStep[i] || 2;
}
function focusCur() {
  return focus && !focusFin && focusPos >= 0 && focusPos < focusOrd.length ? focusOrd[focusPos] : -1;
}
function nextUndone(from) {
  var n = focusOrd.length;
  for (var i = 1; i <= n; i++) {
    var j = (((from + i) % n) + n) % n;
    if (!stepDone(focusOrd[j], stepBits(j))) return j;
  }
  return -1;
}
// (sheet: with the Colours sheet's room taken off, for framing the section above it: not for the picture's size, which
// stays the same whether the sheet is open or not, v303)
function focusGeo(sheet) {
  var bar = document.querySelector('.sffocbar'),
    bot = document.querySelector('.sffocbot'),
    t = bar ? bar.offsetHeight : 0,
    zs = (window.innerWidth || 0) < 700 ? document.getElementById('sfZoomCtl') : null,
    // (a phone: the tool strip above the bottom bar is the picture's too, v289)
    b = (bot ? bot.offsetHeight : 0) + (zs ? zs.offsetHeight : 0),
    vw = sfView.clientWidth,
    vh = sfView.clientHeight,
    sh = sheet && focusSheet ? document.getElementById('sfFocSheet') : null;
  // (the Colours sheet, open, lies over the foot of the picture: the section is framed above it, v303)
  if (sh && sh.offsetHeight)
    b = Math.max(b, sfView.getBoundingClientRect().bottom - sh.getBoundingClientRect().top);
  var ah = Math.max(40, vh - t - b);
  return { t: t, b: b, cx: vw / 2, cy: t + ah / 2, aw: vw, ah: ah };
}
function focusZoomFor(l) {
  var g = focusGeo(true);
  return fitZoom(focusBox, l, g.aw, g.ah);
}
var _ftT = 0;
function animXform(anim) {
  if (anim && !reduce) {
    cv.style.transition = 'transform .32s cubic-bezier(.2,.8,.2,1)';
    clearTimeout(_ftT);
    _ftT = setTimeout(function () {
      cv.style.transition = '';
    }, 380);
  } else cv.style.transition = '';
  applyXform();
}
function frameFocus(anim) {
  var l = focusCur();
  if (l < 0 || !cv || !sfView) return;
  var g = focusGeo(true),
    DW = cv.offsetWidth,
    DH = cv.offsetHeight,
    z = focusZ,
    px = ((focusBox.x0[l] + focusBox.x1[l] + 1) / 2 / W) * DW,
    py = ((focusBox.y0[l] + focusBox.y1[l] + 1) / 2 / H) * DH;
  zoom = z;
  panX = g.cx - cv.offsetLeft - px * z;
  panY = g.cy - cv.offsetTop - py * z;
  clampPan();
  animXform(anim);
}
function goFocus(pos, anim, noHist) {
  if (!focusOrd.length) return;
  if (!noHist && focusPos >= 0 && !focusFin && pos !== focusPos) {
    focusHist.push(focusPos);
    if (focusHist.length > 200) focusHist.shift();
  }
  focusFin = false;
  focusPos = Math.max(0, Math.min(focusOrd.length - 1, pos));
  var l = focusOrd[focusPos];
  hlKey = assignData.assign[l].mkey;
  hlZone = alongZones() ? zoneOf(l) : null;
  renderFocusUI();
  focusZ = focusZoomFor(l);
  renderGuide();
  frameFocus(anim);
  focusSay();
} // bar text first: its height sizes the picture
// (where Focus is up to, for a screen reader: the marker and which of its sections, or that the page is finished; the
// bar's text changes in place, which a screen reader doesn't say by itself, v298)
function focusSay() {
  var nm = document.getElementById('sfFocName'),
    sub = document.getElementById('sfFocSub');
  if (nm && nm.textContent) sayLive(nm.textContent + (sub && sub.textContent ? '. ' + sub.textContent : ''));
}
// the Colours sheet opened or closed, however (its button, a tap on the picture, Back): the section framed again in the
// room it leaves (v303)
function focusSheetSet(open) {
  focusSheet = open;
  renderFocusUI();
  const l = focusCur();
  if (!focusFin && l >= 0) {
    focusZ = focusZoomFor(l);
    frameFocus(true);
  }
}
function finishFocus() {
  focusFin = true;
  hlKey = null;
  hlZone = null;
  focusSheet = false;
  zoom = 1;
  panX = 0;
  panY = 0;
  animXform(true);
  renderGuide();
  renderFocusUI();
  var was = celebrated;
  checkComplete();
  // (just finished: the toast says so instead)
  if (celebrated === was) focusSay();
}
function focusDone() {
  var l = focusCur();
  if (l < 0) return;
  guideDirty = true;
  var bits = stepBits(focusPos);
  if (stepDone(l, bits)) {
    stepSet(l, bits, false);
    renderGuide();
    renderFocusUI();
    return;
  }
  stepSet(l, bits, true);
  // (the page's start date, and its finish, as a tick anywhere else sets them, v287)
  progStamp();
  popAt(l);
  if (navigator.vibrate)
    try {
      navigator.vibrate(12);
    } catch (_) {}
  var nx = nextUndone(focusPos);
  if (nx < 0) finishFocus();
  else goFocus(nx, true);
}
function focusBack() {
  var to = focusFin ? focusPos : focusHist.length ? focusHist.pop() : focusPos - 1;
  goFocus(to, true, true);
}
function focusSkip() {
  var nx = nextUndone(focusPos);
  if (nx < 0) {
    finishFocus();
    return;
  }
  goFocus(nx, true);
}
// k: a marker, or zone by zone "marker@zone" (a chip of the Colours sheet)
function focusColour(k) {
  var first = -1,
    at = String(k).lastIndexOf('@'),
    mk = at > 0 ? k.slice(0, at) : k,
    z = at > 0 ? +k.slice(at + 1) : null,
    i;
  for (i = 0; i < focusOrd.length; i++) {
    var l = focusOrd[i];
    if (assignData.assign[l].mkey !== mk || (z != null && zoneOf(l) !== z)) continue;
    if (first < 0) first = i;
    if (!stepDone(l, stepBits(i))) {
      first = i;
      break;
    }
  }
  focusSheet = false;
  if (first >= 0) goFocus(first, true);
  else renderFocusUI();
}
// Colour along zone by zone: a section's zone, as focus mode goes (one zone's sections of a marker, then the next's);
// else null (the marker's sections in the whole picture)
function focusZoneOf(l) {
  return alongZones() ? zoneOf(l) : null;
}
function focusAllOfColour() {
  var l = focusCur();
  if (l < 0) return;
  var k = assignData.assign[l].mkey,
    z = focusZoneOf(l),
    was = {},
    g = loadGen,
    at = focusPos,
    code = assignData.assign[l].code;
  guideDirty = true;
  focusOrd.forEach(function (q) {
    if (assignData.assign[q].mkey === k && focusZoneOf(q) === z) {
      if (!colored[q] && !was[q]) was[q] = [colored[q], tp()[q]];
      colored[q] = 1;
      tp()[q] = 0;
    }
  });
  progStamp();
  focusSheet = false;
  var nx = nextUndone(focusPos);
  if (nx < 0) finishFocus();
  else goFocus(nx, true);
  // (an Undo, as Mark all coloured in the list has: a mis-tap lost which were really done, v299; not when that
  // finished the page, which says so instead)
  if (Object.keys(was).length && nx >= 0)
    toastAction('Marked all ' + esc(code) + ' done', 'Undo', function () {
      if (g !== loadGen || !assignData || !focus) return;
      const P = tp();
      for (const q in was) {
        if (!colored[q]) continue;
        colored[q] = was[q][0];
        P[q] = was[q][1];
      }
      guideDirty = true;
      // (no longer finished: finishing it again celebrates again)
      celebrated = false;
      normalizeTones();
      renderGuide();
      updateProgress();
      goFocus(Math.min(at, focusOrd.length - 1), true, true);
    });
}
function revealFromColour() {
  if (focus) exitFocus();
  gTab = 'share';
  exitColor();
  startReveal();
}
// Focus mode is a modal view for the keyboard: focus goes into it, Tab stays in it (its bar, the colours sheet, the
// zoom buttons and the bottom buttons) and the page behind is inert; leaving puts focus back on ⛶ Focus mode.
var _fInert = [];
function focusParts() {
  return [
    document.querySelector('.sffocbar'),
    document.getElementById('sfFocSheet'),
    cv && cv.getAttribute('tabindex') != null ? cv : null,
    document.getElementById('sfZoomCtl'),
    document.getElementById('sfFocBot'),
  ].filter(function (x) {
    return !!x;
  });
}
function focusModal(on) {
  _fInert.forEach(function (el) {
    el.inert = false;
  });
  _fInert = [];
  if (!on || !sfView || !ctlEl) return;
  // (the tool row too: its Greyscale, zoom and Fit are Focus mode's, v288)
  var keep = [sfView, ctlEl, document.getElementById('sfZoomCtl')].filter(Boolean);
  keep.forEach(function (k) {
    // (one inside another kept part, as the tool row is inside the picture's view: nothing within that part is made
    // inert, so the picture still takes taps)
    if (
      keep.some(function (x) {
        return x !== k && x.contains(k);
      })
    )
      return;
    for (var n = k; n && n !== document.body && n.parentElement; n = n.parentElement) {
      [].forEach.call(n.parentElement.children, function (c) {
        if (
          c.inert ||
          keep.some(function (x) {
            return c === x || c.contains(x);
          }) ||
          /^(SCRIPT|STYLE|LINK)$/.test(c.tagName) ||
          c.classList.contains('overlay') ||
          c.id === 'msToast' ||
          c.id === 'sfLive'
        )
          return;
        c.inert = true;
        _fInert.push(c);
      });
    }
  });
}
function focusTab(e) {
  var f = [];
  const SEL = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  focusParts().forEach(function (p) {
    if (p.matches(SEL) && p.getClientRects().length) f.push(p);
    [].forEach.call(p.querySelectorAll(SEL), function (x) {
      // (not an icon's <use href>: an SVG part, never focused)
      if (!x.disabled && !(x instanceof SVGElement) && x.getClientRects().length) f.push(x);
    });
  });
  if (!f.length) return;
  // (every Tab is taken here, in this order: the top bar, an open sheet, the picture, the tool row's Greyscale, −, +
  // and Fit, then the bottom bar; the page's own order puts the tool row first, v288)
  var i = f.indexOf(document.activeElement);
  e.preventDefault();
  if (i < 0) (e.shiftKey ? f[f.length - 1] : f[0]).focus();
  else f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
}
function focusIn() {
  var b =
    document.getElementById('sfFDone') ||
    document.getElementById('sfFReveal') ||
    document.getElementById('sfExitFoc');
  if (b)
    try {
      b.focus({ preventScroll: true });
    } catch (_) {}
}
// a section's tones as chips (H, B, S: its highlight, base and shadow markers, each with its colour); in step mode
// (Shading's one tone at a time) the step being coloured is lit (v284: they were a line of text, cut short with the
// tip on a phone)
function toneChips(m, t, bits, step) {
  var c = function (bit, hex, tx) {
      return (
        '<span class="sffocchip' +
        (step && bits & bit ? ' on' : '') +
        '"><i style="background:' +
        esc(hex) +
        '"></i>' +
        esc(tx) +
        '</span>'
      );
    },
    h = '';
  if (t.light) h += c(1, t.light.hex, 'H ' + mcode(t.light));
  else if (t.paper) h += c(1, 'rgb(' + t.L.join(',') + ')', 'H paper');
  h += c(2, m.hex, 'B ' + mcode(m));
  if (!t.noShadow)
    h += t.dark ? c(4, t.dark.hex, 'S ' + mcode(t.dark)) : c(4, 'rgb(' + t.S.join(',') + ')', 'S 2nd coat');
  return h;
}
function renderFocusUI() {
  var nm = document.getElementById('sfFocName'),
    tipEl = document.getElementById('sfFocTip'),
    chipEl = document.getElementById('sfFocChips'),
    sub = document.getElementById('sfFocSub'),
    sw = document.getElementById('sfFocSw'),
    bot = document.getElementById('sfFocBot'),
    bar = document.getElementById('sfProgBar');
  if (!nm || !assignData) return;
  var _ae = document.activeElement,
    _fbFoc = bot && _ae && bot.contains(_ae) ? _ae.id || 'sfFDone' : null;
  var N = 0,
    dn = 0;
  assignData.order.forEach(function (l) {
    N++;
    if (colored[l]) dn++;
  });
  var pct = N ? Math.round((dn / N) * 100) : 0;
  if (bar) bar.style.width = pct + '%';
  // (the page's progress for a screen reader too, v289)
  const fp = document.getElementById('sfFocProg');
  if (fp) {
    fp.setAttribute('aria-valuenow', String(pct));
    fp.setAttribute('aria-valuetext', progressText(dn, N));
  }
  // (the tip line keeps its room all the way through a shaded guide, so the picture below it never jumps)
  const shOn = !focusFin && shadeUse().on;
  if (tipEl) {
    tipEl.textContent = '';
    tipEl.classList.toggle('on', shOn);
  }
  if (chipEl) {
    chipEl.innerHTML = '';
    chipEl.classList.toggle('on', shOn);
  }
  var l = focusCur();
  if (focusFin || l < 0) {
    sw.style.background = 'var(--ok)';
    nm.textContent = N && dn >= N ? 'Page finished' : 'Only skipped sections left';
    sub.textContent = N && dn >= N ? finishLine() : dn + ' of ' + N + ' sections coloured';
    bot.innerHTML =
      '<button id="sfFBack" aria-label="Back">← Back</button><button id="sfFReveal" class="fdone">' +
      ic('sparkles') +
      ' Reveal &amp; share</button>';
  } else {
    var a = assignData.assign[l],
      bk = {};
    coll.forEach(function (m) {
      bk[m.mkey] = m;
    });
    var m = bk[a.mkey],
      k = a.mkey;
    var bits = stepBits(focusPos),
      st = stepText(l, bits),
      tt = shadeSec(l),
      secs = {},
      sAt = 0,
      sTot = 0;
    var zq = focusZoneOf(l);
    // (the second pass, for 2nd coats and glazes once the first is dry, counts its own sections: 1 of 4, not 5 of 5)
    var later = function (i) {
        var t = focusStep[i] === 4 && shadeSec(focusOrd[i]);
        return !!(t && (t.coat || t.glaze));
      },
      pass = later(focusPos);
    focusOrd.forEach(function (q, i) {
      if (assignData.assign[q].mkey === k && focusZoneOf(q) === zq && !secs[q] && later(i) === pass) {
        secs[q] = 1;
        sTot++;
        if (i <= focusPos) sAt++;
      }
    });
    sw.style.background = st ? st.hex : a.hex;
    nm.textContent = st ? st.name : m ? mcode(m) + (m.name ? ' · ' + m.name : '') : k;
    var tip = '';
    if (tt) {
      var gg = shadeGeom();
      tip =
        gg && gg.ar[l] > W * H * 0.04
          ? 'big area: work in patches'
          : bits & 4 && (sAt <= 1 || toneSteps)
            ? 'soften the shadow\u2019s edge while wet'
            : '';
      if (bits === 4 && tt.coat) tip = 'first coat dry? then go over the shadow again';
    }
    // a shaded section: its tones as chips (the step lit, in step mode), and on the line under the bar where it's
    // up to and what to do (the chips are for the eye; screen readers hear "base R16, shadow R28")
    // a shaded section: its tones as chips on a line of their own (the step lit, in step mode), and what to do on the
    // line under them (the chips are for the eye; screen readers hear "base R16, shadow R28")
    // (v306) the marker in hand has its code in the guide in the other brand too: "Not the Ohuhu Y26" after it,
    // on this line (the name line above stays as it was; the two together fit a phone)
    const hand = !tt
        ? [a]
        : [bits & 1 ? tt.light : null, bits & 2 ? a : null, bits & 4 ? tt.dark || a : null],
      not = hand
        .map(function (x) {
          return x ? sameName(x) : '';
        })
        .filter(Boolean)[0];
    sub.innerHTML =
      esc('Section ' + sAt + ' of ' + sTot) +
      (not ? ' \u00b7 <span class="sffocnot">Not the ' + esc(not) + '</span>' : '') +
      (tt ? '<span class="sfsr">. ' + esc((st ? st.name + ', ' : '') + toneSay(a, tt)) + '.</span>' : '');
    if (chipEl) chipEl.innerHTML = tt ? toneChips(a, tt, bits, !!st) : '';
    if (tipEl && tt)
      tipEl.textContent = [st ? st.sub : '', tip]
        .filter(function (x) {
          return !!x;
        })
        .join(' \u00b7 ')
        .replace(/^./, function (c) {
          return c.toUpperCase();
        });
    var isDone = stepDone(l, bits);
    bot.innerHTML =
      '<button id="sfFBack" aria-label="Back"' +
      (focusPos <= 0 && !focusHist.length ? ' disabled' : '') +
      '>←</button><button id="sfFDone" class="fdone' +
      (isDone ? ' undo' : '') +
      '">' +
      (isDone ? ic('undo-2') + ' Undo' : '<span aria-hidden="true">✓</span> Done') +
      '</button><button id="sfFSkip">Skip <span aria-hidden="true">→</span></button>';
  }
  var q = function (id, fn) {
    var e = document.getElementById(id);
    if (e) e.addEventListener('click', fn);
  };
  // the bottom buttons were redrawn: keyboard focus stays on the same one (Done becomes Reveal at the end)
  if (_fbFoc) {
    var nb = document.getElementById(_fbFoc);
    if (nb && !nb.disabled)
      try {
        nb.focus({ preventScroll: true });
      } catch (_) {}
    else focusIn();
  }
  q('sfFBack', focusBack);
  q('sfFDone', focusDone);
  q('sfFSkip', focusSkip);
  q('sfFReveal', revealFromColour);
  var sh = document.getElementById('sfFocSheet'),
    cb = document.getElementById('sfFocCols');
  if (cb) {
    cb.setAttribute('aria-expanded', focusSheet ? 'true' : 'false');
    cb.style.display = focusFin ? 'none' : '';
  }
  if (sh) {
    sh.style.display = focusSheet ? '' : 'none';
    if (focusSheet) {
      var cur = focusCur(),
        ck = cur >= 0 ? assignData.assign[cur].mkey : null,
        cm = null;
      coll.forEach(function (m) {
        if (m.mkey === ck) cm = m;
      });
      var all = document.getElementById('sfFocAll');
      if (all) {
        all.style.display = ck ? '' : 'none';
        all.innerHTML =
          '<span aria-hidden="true">✓</span> Mark all ' + esc(cm ? cm.code : 'of this colour') + ' done';
      }
      renderFocusMarkers();
    }
  }
  var zb = document.querySelector('.sffocbot');
  if (zb) document.documentElement.style.setProperty('--focBot', zb.offsetHeight + 'px');
}
