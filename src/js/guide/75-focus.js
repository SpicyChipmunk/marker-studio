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
// hand). Focus mode and Colour along's Find next both go this way. B: the sections' boxes (secBoxes). big: its
// largest section first instead (Focus mode, v313: the marker's main area while the ink flows best, and the one that
// shows the hand-off card where the marker goes)
function markerPath(secs, B, big) {
  var cxy = function (l) {
    return [(B.x0[l] + B.x1[l]) / 2, (B.y0[l] + B.y1[l]) / 2];
  };
  var rest = secs.slice(),
    top = 0,
    i,
    path = [];
  if (!rest.length) return path;
  for (i = 1; i < rest.length; i++)
    if (
      big
        ? comps[rest[i]].area > comps[rest[top]].area ||
          (comps[rest[i]].area === comps[rest[top]].area && B.y0[rest[i]] < B.y0[rest[top]])
        : B.y0[rest[i]] < B.y0[rest[top]]
    )
      top = i;
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
    var path = markerPath(by[k].secs, focusBox, true);
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
// (v320) Focus mode's side rail: on an iPad held sideways (RAIL_MQ) the bar, the marker, Done, Back and Skip and the
// zoom buttons stand in a column at the side (the right, or the left: Swap sides, remembered on this device), and the
// picture has the screen's whole height beside it (CSS: html.sfrailon, sfrailL; the rail's width --railW). The DOM
// order, and so the keyboard's, is as before. The Colours sheet, the hand-off card and the toasts keep to the
// picture's column.
var RAIL_MQ = '(orientation: landscape) and (min-height: 600px) and (min-width: 900px)';
function focusRail() {
  return !!(
    focus &&
    root &&
    root.classList.contains('sffoc') &&
    window.matchMedia &&
    window.matchMedia(RAIL_MQ).matches
  );
}
function railLeft() {
  try {
    return localStorage.getItem('ms-foc-rail') === 'left';
  } catch (_) {
    return false;
  }
}
function railSync() {
  var on = focusRail(),
    de = document.documentElement;
  de.classList.toggle('sfrailon', on);
  de.classList.toggle('sfrailL', on && railLeft());
}
function railSwap() {
  try {
    localStorage.setItem('ms-foc-rail', railLeft() ? 'right' : 'left');
  } catch (_) {}
  railSync();
  _focFit = null;
  focusRefit();
}
function focusGeo(sheet) {
  if (focusRail()) {
    var rb = document.querySelector('.sffocbar'),
      rw = rb ? rb.offsetWidth : 340,
      L = document.documentElement.classList.contains('sfrailL'),
      vw0 = sfView.clientWidth,
      vh0 = sfView.clientHeight,
      sh0 = sheet && focusSheet ? document.getElementById('sfFocSheet') : null,
      b0 =
        sh0 && sh0.offsetHeight
          ? Math.max(0, sfView.getBoundingClientRect().bottom - sh0.getBoundingClientRect().top)
          : 0,
      aw0 = Math.max(40, vw0 - rw),
      ah0 = Math.max(40, vh0 - b0),
      x0 = L ? rw : 0;
    return { t: 0, b: b0, x0: x0, cx: x0 + aw0 / 2, cy: ah0 / 2, aw: aw0, ah: ah0 };
  }
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
  return { t: t, b: b, x0: 0, cx: vw / 2, cy: t + ah / 2, aw: vw, ah: ah };
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
  // (the name line's words for a screen reader: the brand's name, not the badge's letter, v307)
  var t = nm ? nm.getAttribute('data-say') || nm.textContent : '';
  if (t) sayLive(t + (sub && sub.textContent ? '. ' + sub.textContent : ''));
}
// the Colours sheet opened or closed, however (its button, a tap on the picture, Back): the section framed again in the
// room it leaves (v303)
function focusSheetSet(open) {
  // (v315: the hand-off card goes as the sheet opens: the room it was placed in is the sheet's now)
  if (open) handClose(false);
  focusSheet = open;
  renderFocusUI();
  const l = focusCur();
  if (!focusFin && l >= 0) {
    focusZ = focusZoomFor(l);
    frameFocus(true);
  }
}
function finishFocus() {
  handClose(false);
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
  // (v318.25: finished before but not now, a tick taken back since: checkComplete no longer counts that as finished)
  var was = celebrated && pageDone();
  checkComplete();
  // (just finished: the toast says so instead)
  if (celebrated === was) focusSay();
}
// (the second pass, for 2nd coats and glazes once the first is dry)
function focusLater(i) {
  var t = focusStep[i] === 4 && shadeSec(focusOrd[i]);
  return !!(t && (t.coat || t.glaze));
}
// (v313) which marker Focus mode is on at step i: the marker (in its zone, zone by zone), and its pass. The hand-off
// card shows when this changes, never between one section's tones.
function focusGroup(i) {
  var l = focusOrd[i];
  return assignData.assign[l].mkey + '@' + focusZoneOf(l) + (focusLater(i) ? '|2' : '|1');
}
// the steps of i's marker (and pass), and how many of its sections are coloured
function focusGroupInfo(i) {
  var g = focusGroup(i),
    secs = {},
    n = 0,
    d = 0;
  focusOrd.forEach(function (q, j) {
    if (secs[q] || focusGroup(j) !== g) return;
    secs[q] = 1;
    n++;
    if (stepDone(q, stepBits(j))) d++;
  });
  return { secs: Object.keys(secs).map(Number), n: n, d: d, later: focusLater(i) };
}
// (v313) The hand-off card: moving on to the next marker (Done, Skip or Mark all on the last of one), a card over the
// picture says how the last went and which marker to pick up, with the picture zoomed out to all its sections. Done
// or a tap anywhere closes it (the tap ticks nothing) and goes in to its first section.
var _hand = -1;
function focusNext(nx, from) {
  if (from >= 0 && nx >= 0 && from < focusOrd.length && focusGroup(from) !== focusGroup(nx))
    handOpen(from, nx);
  else goFocus(nx, true);
}
function handOpen(from, nx) {
  var was = focusGroupInfo(from),
    nxt = focusGroupInfo(nx),
    lf = focusOrd[from],
    pm = assignData.assign[lf],
    l = focusOrd[nx],
    m = assignData.assign[l];
  goFocus(nx, true);
  _hand = nx;
  renderGuide();
  var el = document.getElementById('sfHand');
  if (!el) return;
  var nm = document.getElementById('sfFocName'),
    sw = document.getElementById('sfFocSw'),
    k = m.mkey,
    low = inkLowNow(k),
    head =
      mcodeHTML(pm) +
      (was.later ? '’s shadows' : '') +
      (was.d >= was.n
        ? // (one section: "coloured ✓", as Colour along's row says, v314.1)
          (was.n === 1 ? ' · coloured' : ' · all ' + was.n + ' coloured') +
          ' <span aria-hidden="true">✓</span>'
        : ': ' + was.d + ' of ' + was.n + ' coloured');
  el.querySelector('.sfhhead').innerHTML = head;
  el.querySelector('.sfhsw').style.background = sw ? sw.style.background : m.hex;
  el.querySelector('.sfhlbl').textContent = nxt.later ? 'Back to' : 'Pick up';
  el.querySelector('.sfhname').innerHTML = nxt.later
    ? mcodeHTML(m) + '’s shadows, now the first coat is dry'
    : nm
      ? nm.innerHTML
      : mcodeHTML(m);
  el.querySelector('.sfhsub').innerHTML =
    (nxt.n - nxt.d === 1 ? '1 section' : nxt.n - nxt.d + ' sections') +
    // (v318.25: not said by the short card, which can leave some of them under it all the same: handFrame)
    '<span class="sfhshown">, shown on the picture</span>. Tap <b>Done</b> when it’s in your hand.' +
    (low ? '<span class="sfhlow">' + mcodeHTML(m) + ' is running low.</span>' : '');
  el.hidden = false;
  el.classList.remove('in');
  void el.offsetWidth;
  el.classList.add('in');
  // the picture: out to all the new marker's sections still to colour
  var B = focusBox,
    u = { x0: [Infinity], y0: [Infinity], x1: [-Infinity], y1: [-Infinity] };
  nxt.secs.forEach(function (q) {
    if (colored[q] && nxt.secs.length > 1) return;
    u.x0[0] = Math.min(u.x0[0], B.x0[q]);
    u.y0[0] = Math.min(u.y0[0], B.y0[q]);
    u.x1[0] = Math.max(u.x1[0], B.x1[q]);
    u.y1[0] = Math.max(u.y1[0], B.y1[q]);
  });
  if (isFinite(u.x0[0])) handFrame(u, el);
  if (navigator.vibrate)
    try {
      navigator.vibrate([12, 70, 12]);
    } catch (_) {}
  sayLive(
    el.querySelector('.sfhhead').textContent +
      '. ' +
      el.querySelector('.sfhlbl').textContent +
      ' ' +
      (nm && nm.getAttribute('data-say') && !nxt.later
        ? nm.getAttribute('data-say')
        : el.querySelector('.sfhname').textContent) +
      '.',
  );
}
// the view zoomed out to box u (no further in than the section's own zoom), and the card above, below, left or right of
// it (v315), wherever it covers least of the sections and, then, lets them be biggest: their middle in the room the
// card leaves. The card never lies over the zoom buttons: its room ends above them.
var _handRoom = null;
function handFrame(u, el) {
  if (!cv || !sfView) return;
  var g = focusGeo(true),
    DW = cv.offsetWidth,
    DH = cv.offsetHeight,
    card = el.querySelector('.sfhcard'),
    vr = sfView.getBoundingClientRect(),
    zc = document.getElementById('sfZoomCtl'),
    best = null;
  if (!card) return;
  handFrame.u = u;
  var zr = zc && zc.offsetHeight ? zc.getBoundingClientRect() : null;
  // (the side it was on last time first, and kept unless another is clearly better: no hopping about between hand-offs)
  var sides = ['top', 'bot', 'left', 'right'],
    last = handFrame.last;
  if (last && sides.indexOf(last) > 0) (sides.splice(sides.indexOf(last), 1), sides.unshift(last));
  el.classList.remove('sfhtight');
  var tryAt = function (side) {
    el.classList.remove('sfhbot', 'sfhleft', 'sfhright');
    if (side !== 'top') el.classList.add('sfh' + side);
    // (the room ends above the zoom buttons only where the card would meet them: beside them it needn't)
    el.style.setProperty('--hcut', '0px');
    // (the card measured by its layout, not its box on screen: its entrance animation moves and shrinks it a little)
    var cbox = function () {
        const h = el.getBoundingClientRect();
        return {
          left: h.left + card.offsetLeft,
          top: h.top + card.offsetTop,
          right: h.left + card.offsetLeft + card.offsetWidth,
          bottom: h.top + card.offsetTop + card.offsetHeight,
        };
      },
      hr = el.getBoundingClientRect(),
      cr = cbox(),
      cut =
        zr && zr.width && cr.right > zr.left - 8 && cr.left < zr.right + 8
          ? Math.max(0, hr.bottom - zr.top + 8)
          : 0;
    el.style.setProperty('--hcut', cut + 'px');
    if (cut) cr = cbox();
    var c = {
        x0: cr.left - vr.left - 8,
        y0: cr.top - vr.top - 8,
        x1: cr.right - vr.left + 8,
        y1: cr.bottom - vr.top + 8,
      },
      // the room the card leaves, in the view (v320: beside the rail, held sideways)
      R = { x0: g.x0, y0: g.t, x1: g.x0 + g.aw, y1: g.t + g.ah };
    if (side === 'top') R.y0 = c.y1;
    else if (side === 'bot') R.y1 = c.y0;
    else if (side === 'left') {
      R.x0 = c.x1;
      // (and ends before the zoom buttons, where they float over the picture's corner)
      if (zr && zr.width && zr.left - vr.left > c.x1 + 40) R.x1 = Math.min(R.x1, zr.left - vr.left - 8);
    } else R.x1 = c.x0;
    _handRoom = R;
    var rw = Math.max(40, R.x1 - R.x0),
      rh = Math.max(40, R.y1 - R.y0),
      z = Math.min(focusZ, fitZoom(u, 0, rw, rh));
    zoom = z;
    panX = (R.x0 + R.x1) / 2 - cv.offsetLeft - ((u.x0[0] + u.x1[0] + 1) / 2 / W) * DW * z;
    panY = (R.y0 + R.y1) / 2 - cv.offsetTop - ((u.y0[0] + u.y1[0] + 1) / 2 / H) * DH * z;
    clampPan();
    // (where the sections are on the screen, against where the card is)
    var sx0 = cv.offsetLeft + panX + (u.x0[0] / W) * DW * z,
      sx1 = cv.offsetLeft + panX + ((u.x1[0] + 1) / W) * DW * z,
      sy0 = cv.offsetTop + panY + (u.y0[0] / H) * DH * z,
      sy1 = cv.offsetTop + panY + ((u.y1[0] + 1) / H) * DH * z,
      ov =
        (Math.max(0, Math.min(sx1, c.x1) - Math.max(sx0, c.x0)) *
          Math.max(0, Math.min(sy1, c.y1) - Math.max(sy0, c.y0))) /
        Math.max(1, (sx1 - sx0) * (sy1 - sy0)),
      // (a sliver under the card counts as none)
      // (v318.32 D3-1: a side where the card is taller than its room, its last line cut, counts as if it covered the
      // sections whole: a small phone at the largest text put the card beside the picture, narrow and cut, when
      // above it the whole card showed)
      o = (ov < 0.02 ? 0 : ov) + (card.scrollHeight > card.clientHeight + 1 ? 1 : 0),
      // (and of the rest of the picture: at the same size, the side that hides least of it)
      px0 = cv.offsetLeft + panX,
      py0 = cv.offsetTop + panY,
      pv =
        Math.max(0, Math.min(px0 + DW * z, c.x1) - Math.max(px0, c.x0)) *
        Math.max(0, Math.min(py0 + DH * z, c.y1) - Math.max(py0, c.y0));
    var keep = best && best.side === last;
    if (
      !best ||
      o < best.o - (keep ? 0.05 : 0.01) ||
      (Math.abs(o - best.o) <= 0.01 &&
        (z > best.z * (keep ? 1.15 : 1.02) || (z >= best.z / 1.02 && pv < best.pv * (keep ? 0.5 : 0.9) - 1)))
    )
      best = { side: side, o: o, z: z, pv: pv, x: panX, y: panY, cut: cut, R: R };
  };
  sides.forEach(tryAt);
  // (v318.25) every side still leaves some of the sections under the card (a small phone with large text: on an
  // iPhone SE at 1.6x text it covered 9 of the 20 it said were "shown on the picture"): the short card, the marker on
  // one line under how the last went (the bar above names it too, with its swatch), placed again
  // (v318.32 D3-1: or leaves the card cut, counted in o as covering: the short card then, which fits)
  if (best.o > 0) {
    el.classList.add('sfhtight');
    best = null;
    sides.forEach(tryAt);
  }
  zoom = best.z;
  panX = best.x;
  panY = best.y;
  _handRoom = best.R;
  el.classList.remove('sfhbot', 'sfhleft', 'sfhright');
  if (best.side !== 'top') el.classList.add('sfh' + best.side);
  el.style.setProperty('--hcut', best.cut + 'px');
  handFrame.last = best.side;
  animXform(true);
}
// (the screen turned with the card up: placed again, the picture out to the sections again)
function handReframe() {
  var el = document.getElementById('sfHand');
  if (!handOn() || !el || !handFrame.u) return;
  // (v318.32) the bars' heights first: turned, the name line wraps differently, and the card's room (--focTop,
  // --focBot: the bars are measured by renderFocusUI, which a turn doesn't run) was the old shape's
  var tb = document.querySelector('.sffocbar'),
    bb = document.querySelector('.sffocbot');
  if (tb) document.documentElement.style.setProperty('--focTop', tb.offsetHeight + 'px');
  if (bb) document.documentElement.style.setProperty('--focBot', bb.offsetHeight + 'px');
  handFrame(handFrame.u, el);
}
function handOn() {
  return _hand >= 0;
}
// close the card; in: go in to the section (Done, a tap), else leave the view to what comes next (Skip, Back, Exit)
function handClose(go) {
  if (_hand < 0) return;
  _hand = -1;
  _handRoom = null;
  var el = document.getElementById('sfHand');
  if (el) {
    el.hidden = true;
    el.classList.remove('in');
  }
  renderGuide();
  if (go && focusCur() >= 0) {
    focusZ = focusZoomFor(focusCur());
    frameFocus(true);
    focusSay();
  }
}
function focusDone() {
  var l = focusCur();
  if (l < 0) return;
  if (handOn()) {
    handClose(true);
    return;
  }
  guideDirty = true;
  var bits = stepBits(focusPos);
  if (stepDone(l, bits)) {
    stepSet(l, bits, false);
    renderGuide();
    renderFocusUI();
    return;
  }
  // (v320: its colour spreads from the tap, or from its label for Done)
  var sp = spreadBegin(l);
  // (v321: the next Done draws its tick, renderFocusUI)
  focusDone.at = performance.now();
  stepSet(l, bits, true);
  // (the page's start date, and its finish, as a tick anywhere else sets them, v287)
  progStamp();
  popAt(l);
  if (navigator.vibrate)
    try {
      navigator.vibrate(12);
    } catch (_) {}
  var from = focusPos,
    nx = nextUndone(focusPos);
  if (nx < 0) finishFocus();
  else focusNext(nx, from);
  spreadRun(sp);
}
function focusBack() {
  handClose(false);
  var to = focusFin ? focusPos : focusHist.length ? focusHist.pop() : focusPos - 1;
  goFocus(to, true, true);
}
function focusSkip() {
  handClose(false);
  var from = focusPos,
    nx = nextUndone(focusPos);
  if (nx < 0) {
    finishFocus();
    return;
  }
  focusNext(nx, from);
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
  handClose(false);
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
    mm = assignData.assign[l],
    K = comps.length;
  guideDirty = true;
  focusOrd.forEach(function (q) {
    if (assignData.assign[q].mkey === k && focusZoneOf(q) === z) {
      if (!colored[q] && !was[q]) was[q] = [colored[q], tp()[q], heldSh[q] || null];
      colored[q] = 1;
      tp()[q] = 0;
    }
  });
  progStamp();
  focusSheet = false;
  var nx = nextUndone(focusPos);
  if (nx < 0) finishFocus();
  else focusNext(nx, at);
  // (an Undo, as Mark all coloured in the list has: a mis-tap lost which were really done, v299; not when that
  // finished the page, which says so instead)
  if (Object.keys(was).length && nx >= 0)
    toastActionHTML('Marked all ' + mcodeHTML(mm) + ' done', 'Undo', function () {
      // (v308.2: Focus mode closed since, the toast still up, it undoes too: it had done nothing)
      if (g !== loadGen || !assignData || comps.length !== K) return;
      // (v314.1: the hand-off card about the marker just finished goes: it's no longer finished)
      handClose(false);
      // (as the list's Undo does, kept shading too: 82-colour-mode)
      markBack(was, true);
      renderGuide();
      updateProgress();
      renderFocusMarkers();
      if (focus) goFocus(Math.min(at, focusOrd.length - 1), true, true);
      else sayLive('Ticks as they were for ' + msay(mm));
    });
}
// (v308: closing it goes back to Colour along, revClose; before, it left you on the Plan's Share tab)
// (v320, P2) the finished list's bar: Share & print, the Plan's tab for the PDF, the saved image and the guide file
function shareFromColour() {
  exitColor();
  planTab('share');
}
function revealFromColour() {
  if (focus) exitFocus();
  const back = { tab: gTab };
  gTab = 'share';
  exitColor();
  startReveal();
  _revCol = back;
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
          c.id === 'sfLive' ||
          // (v318.28) the live regions in the page from the start
          c.id === 'msSay' ||
          c.id === 'msLive'
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
  focusKbd(
    i < 0 ? (e.shiftKey ? f[f.length - 1] : f[0]) : f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length],
  );
}
// (v308) focus moved by the keyboard, with its ring: focused from script, Safari's engine doesn't count it as
// :focus-visible, so Skip, Exit, Colours and Done showed none. The class goes when it loses focus.
function focusKbd(el) {
  try {
    el.focus({ focusVisible: true });
  } catch (_) {
    el.focus();
  }
  if (document.activeElement !== el) return;
  el.classList.add('sfkbd');
  el.addEventListener(
    'blur',
    function () {
      el.classList.remove('sfkbd');
    },
    { once: true },
  );
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
    nm.removeAttribute('data-say');
    sub.textContent = N && dn >= N ? finishLine() : dn + ' of ' + N + ' sections coloured';
    bot.innerHTML =
      '<button id="sfFBack" aria-label="Back">' +
      icNav(-1) +
      ' Back</button><button id="sfFReveal" class="fdone">' +
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
    var later = focusLater,
      pass = later(focusPos);
    focusOrd.forEach(function (q, i) {
      if (assignData.assign[q].mkey === k && focusZoneOf(q) === zq && !secs[q] && later(i) === pass) {
        secs[q] = 1;
        sTot++;
        if (i <= focusPos) sAt++;
      }
    });
    sw.style.background = st ? st.hex : a.hex;
    // (v307: the brand as a badge, as the list shows it; a screen reader hears its name, focusSay)
    nm.innerHTML = st ? st.nameH : m ? mcodeEye(m) + (capName(m) ? ' · ' + esc(capName(m)) : '') : esc(k);
    nm.setAttribute('data-say', st ? st.say : m ? msay(m) + (capName(m) ? ' · ' + capName(m) : '') : k);
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
    // (v318.26) Back in words beside its arrow, as the hand-off card's "← Back": an arrow alone was easy to miss
    bot.innerHTML =
      '<button id="sfFBack" aria-label="Back"' +
      (focusPos <= 0 && !focusHist.length ? ' disabled' : '') +
      '>' +
      icNav(-1) +
      ' Back</button><button id="sfFDone" class="fdone' +
      (isDone ? ' undo' : '') +
      // (v321: a tick that draws itself just after a Done, as the next section's Done comes up; not with Reduce motion,
      // 05-focus.css)
      (!isDone && focusDone.at && performance.now() - focusDone.at < 600 ? ' fdtick' : '') +
      '">' +
      (isDone
        ? ic('undo-2') + ' Undo'
        : '<svg class="fdck" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12.5l5 5L19.5 7"/></svg> Done') +
      '</button><button id="sfFSkip">Skip ' +
      icNav(1) +
      '</button>';
    // (drawn once: a redraw of the bar while the next section settles doesn't start it again)
    if (!isDone) focusDone.at = 0;
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
        // (v307: the code with its brand, as a code in both brands needs)
        all.innerHTML =
          '<span aria-hidden="true">✓</span> Mark all ' + (cm ? mcodeHTML(cm) : 'of this colour') + ' done';
      }
      renderFocusMarkers();
    }
  }
  var zb = document.querySelector('.sffocbot');
  if (zb) document.documentElement.style.setProperty('--focBot', zb.offsetHeight + 'px');
  // (v313: the hand-off card sits between the two bars)
  var tbar = document.querySelector('.sffocbar');
  if (tbar) document.documentElement.style.setProperty('--focTop', tbar.offsetHeight + 'px');
}
