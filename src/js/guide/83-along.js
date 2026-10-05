/* ---- #10 Colour along: the marker list (docs/GUIDE-LAYOUT.md) ----
    One 48px row per marker: swatch, code and name, "3 of 9 done" (with shading on, its highlight › base › shadow line
    under it). Tapping a row opens it in place, one at a time: the open row is the marker highlighted on the picture
    (hlKey), and holds ✓ Mark all coloured (Clear once every section is coloured, with Undo), Find next (while any is
    left) and ◐ Blends. Tapping it again closes it and shows all colours. The open row is always scrolled fully into
    view between the pinned picture and the bar, also when a press and hold on the picture found it. Markers finished while colouring stay where they
    are, dimmed; entering Colour along again gathers them in a collapsed "Done (n)" group at the bottom. */
let alDone = [],
  alDoneOpen = false,
  _maT = -1e9,
  _revT = 0;
// a second tap on ✓ Mark all coloured within this many ms (by when the taps happened, not when they were handled: a slow
// redraw after the first tap must not stretch the window) is the second half of a double tap, not Clear ticks
const MA_DOUBLE = 600;
// How colour along works. The first time (until a marker's row is first opened): its first line, and More for the
// rest; opening a row folds it into the usual one-line ⓘ (hintSeen/markHint/infoLineHTML in core.js, via infoLine)
// and counts as seen. After that, the ⓘ line.
const AL_1 = 'Tap a marker to see its sections, then tap each section on the picture as you colour it.',
  AL_2 =
    'Use <b><span aria-hidden="true">✓</span> Mark all coloured</b> for a whole marker. Press and hold a section to find its marker here.';
let _alMore = false;
function alongTips() {
  const u = shadeUse();
  return u.on
    ? ' Shading is on: in each section use the highlight (H), then the base (B), then the shadow (S) while the ink is still wet, then soften the edges.' +
        (u.gl ? ' A cooler or grey shadow goes over the base once it’s dry.' : '')
    : '';
}
function alongHint() {
  if (hintSeen('along')) return infoLine('along', 'How colour along works', AL_1 + ' ' + AL_2 + alongTips());
  return (
    '<div id="sfAlHint" class="sfinfo sfonce open"><span class="sfi" aria-hidden="true">i</span><span class="sfit">' +
    AL_1 +
    (_alMore
      ? ' ' + AL_2 + alongTips()
      : '<br><button type="button" id="sfAlMore" class="sflink">More</button>') +
    '</span></div>'
  );
}
// a marker's row was opened: the first-time instructions fold into the ⓘ line
function alongHintSeen() {
  const el = document.getElementById('sfAlHint');
  if (hintSeen('along') && !el) return;
  markHint('along');
  if (!el) return;
  const d = document.createElement('div');
  d.innerHTML = alongHint();
  el.replaceWith(d.firstChild);
}
// Colour along's controls (focus mode has its own, in renderControls): the ⓘ line, the list and the bar
function alongControls() {
  ctlEl.innerHTML =
    '<div class="sfpane sfalongp"><div id="sfDone" class="sfpgdone" style="display:none">Page finished!<div id="sfDoneSum" class="sfpgsum"></div></div>' +
    lowHost('A') +
    alongHint() +
    (zones.length
      ? '<div id="sfAlOrder" class="sfc-segs sfalorder" role="group" aria-label="Colour along goes through">' +
        ctlSeg('whole', 'Whole picture', !alongZones()) +
        ctlSeg('zones', 'Zone by zone', alongZones()) +
        '</div>'
      : '') +
    '<div id="sfAlSort" class="sfc-segs sfalorder" role="group" aria-label="Order of the list">' +
    ctlSeg('light', 'Lightest first', alongSort() === 'light') +
    ctlSeg('rainbow', 'Rainbow', alongSort() === 'rainbow') +
    ctlSeg('brand', 'By brand', alongSort() === 'brand') +
    // (on a phone the code box folds away behind this, so the first rows stay above the bar)
    '<button type="button" id="sfFindOpen" class="sffindopen" aria-label="Find a marker by its code" aria-controls="sfFind" aria-expanded="' +
    (alFindQ ? 'true' : 'false') +
    '">' +
    ic('search') +
    '</button></div>' +
    findBoxHTML() +
    '<div id="sfAlist" class="sfalist"></div></div><div class="sfbar"><button id="sfDoneBtn" class="sfghost" aria-label="Back to the plan" data-long="← Plan" data-short="← Plan">← Plan</button><button id="sfFocus" class="sfprimary" aria-label="Focus mode" data-ic="focus" data-long="Focus mode" data-short="Focus">' +
    ic('focus') +
    // (v288: a finished page's bar offers Reveal & share instead, updateProgress)
    ' Focus mode</button><button id="sfAlongRev" class="sfprimary" style="display:none" data-ic="sparkles" data-long="Reveal &amp; share" data-short="Reveal">' +
    ic('sparkles') +
    ' Reveal &amp; share</button></div>';
  const q = function (id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  };
  q('sfDoneBtn', exitColor);
  q('sfFocus', enterFocus);
  q('sfAlongRev', revealFromColour);
  q('sfAlist', alongClick);
  q('sfAlOrder', function (e) {
    const b = e.target.closest('button');
    if (!b || b.getAttribute('aria-pressed') === 'true') return;
    try {
      localStorage.setItem(ALONG_ZONES, b.dataset.v === 'zones' ? '1' : '0');
    } catch (_) {}
    this.querySelectorAll('button').forEach(function (x) {
      const on = x === b;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    alongSet(null);
    // (the markers finished, as the rows are now keyed: gathered under Done again, as on entering Colour along)
    alDone = alongList()
      .filter(function (x) {
        return x.d >= x.n;
      })
      .map(function (x) {
        return x.key;
      });
    blendOpen = {};
    renderGuide();
    renderAlong();
    sayLive(
      b.dataset.v === 'zones'
        ? 'Colour along goes zone by zone'
        : 'Colour along goes through the whole picture',
    );
  });
  q('sfAlSort', function (e) {
    const b = e.target.closest('button[data-v]');
    if (!b || b.getAttribute('aria-pressed') === 'true') return;
    try {
      localStorage.setItem(ALONG_SORT, b.dataset.v);
    } catch (_) {}
    this.querySelectorAll('button[data-v]').forEach(function (x) {
      const on = x === b;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderAlong();
    sayLive(
      'The list goes ' +
        (b.dataset.v === 'rainbow'
          ? 'in rainbow order'
          : b.dataset.v === 'brand'
            ? 'by brand'
            : 'lightest first'),
    );
  });
  findWire();
  q('sfAlMore', function () {
    _alMore = true;
    const h = document.getElementById('sfAlHint'),
      d = document.createElement('div');
    if (!h) return;
    d.innerHTML = alongHint();
    h.replaceWith(d.firstChild);
    const t = document.querySelector('#sfAlHint .sfit');
    if (t) t.setAttribute('tabindex', '-1');
    try {
      if (t) t.focus({ preventScroll: true });
    } catch (_) {}
  });
  updateProgress();
}
// With zones, Colour along goes through the whole picture (each marker once) or zone by zone (each zone's markers
// in turn, a marker in two zones once in each): ALONG_ZONES keeps the choice on this device.
const ALONG_ZONES = 'ms-along-zones';
function alongZones() {
  if (!zones.length) return false;
  try {
    return localStorage.getItem(ALONG_ZONES) === '1';
  } catch (_) {
    return false;
  }
}
// (v305) the order of Colour along's list: Lightest first (as focus mode goes: lighter inks down before darker ones next
// to them), Rainbow (the colour families round the wheel, lightest first in each, as the keys) or By brand (each brand's
// markers by code, as they sit in their case). Kept on this device. The list only: focus mode and Home's Continue keep
// lightest first, the order that keeps inks from bleeding.
const ALONG_SORT = 'ms-along-sort';
function alongSort() {
  try {
    const v = localStorage.getItem(ALONG_SORT);
    return v === 'rainbow' || v === 'brand' ? v : 'light';
  } catch (_) {
    return 'light';
  }
}
// a row's key: its marker, or zone by zone "marker@zone"
function alongKey(k, z) {
  return k == null ? null : alongZones() && z != null ? k + '@' + z : k;
}
// open the row with this key (null: none): the marker it highlights, and zone by zone its zone
function alongSet(key) {
  if (!key) {
    hlKey = null;
    hlZone = null;
    return;
  }
  const i = key.lastIndexOf('@');
  if (i > 0 && alongZones()) {
    hlKey = key.slice(0, i);
    hlZone = +key.slice(i + 1);
  } else {
    hlKey = key;
    hlZone = null;
  }
}
// Home's Continue (v285): the row to pick up, as Colour along goes (lightest first): a marker part-way done (some of
// its sections ticked, or tones coloured), else the first not finished; opened, with its row in view. True once it has
// painted the picture (v307)
function alongResume() {
  if (sfmode !== 'color' || !assignData || !colored) return false;
  const P = tonePart && tonePart._c === colored ? tonePart : null,
    L = alongList(),
    nx =
      L.find(function (e) {
        return (
          e.d < e.n &&
          (e.d > 0 ||
            (!!P &&
              e.secs.some(function (l) {
                return !colored[l] && P[l];
              })))
        );
      }) ||
      L.find(function (e) {
        return e.d < e.n;
      });
  if (!nx) return false;
  alongSet(nx.key);
  renderControls();
  renderGuide();
  // (once the change of stage has put the page at its top, the next frame: then the row is brought on screen, clear
  // of the pinned picture and the bar)
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      alongReveal(true);
    });
  });
  return true;
}
// is section l one of the open row's? (its marker, and zone by zone its zone)
function hlMatch(l) {
  const m = assignData && assignData.assign[l];
  return !!m && m.mkey === hlKey && (hlZone == null || zoneOf(l) === hlZone);
}
// each marker in the guide (zone by zone: in each zone) with how many of its sections there are and how many are
// ticked, lightest first (as focus mode goes: lighter inks down before darker ones next to them, which could bleed
// into them), then most sections first; or, for the list, as sort says (alongSort)
function alongList(sort) {
  const map = {},
    arr = [],
    byZ = alongZones();
  assignData.order.forEach(function (l) {
    const m = assignData.assign[l],
      z = byZ ? zoneOf(l) : null,
      k = byZ ? m.mkey + '@' + z : m.mkey;
    if (!map[k]) {
      map[k] = { m: m, n: 0, d: 0, key: k, z: z, secs: [] };
      arr.push(map[k]);
    }
    map[k].n++;
    map[k].secs.push(l);
    if (colored[l]) map[k].d++;
  });
  const zi = {};
  if (byZ)
    zoneIds().forEach(function (id, i) {
      zi[id] = i;
    });
  return arr.sort(function (a, b) {
    return (
      (byZ ? zi[a.z] - zi[b.z] : 0) ||
      (sort === 'rainbow'
        ? famCmp(a.m, b.m)
        : sort === 'brand'
          ? a.m.brand.localeCompare(b.m.brand) ||
            a.m.code.localeCompare(b.m.code, 'en', { numeric: true, sensitivity: 'base' })
          : 0) ||
      _lum(b.m.hex) - _lum(a.m.hex) ||
      b.n - a.n
    );
  });
}
// inDone: in the Done group, where zone by zone a row says which zone it's from (there's no zone heading over it)
function alongRow(e, inDone) {
  const m = e.m,
    k = e.key,
    full = e.d >= e.n,
    open = hlKey === m.mkey && (e.z == null ? hlZone == null : hlZone === e.z),
    bo = open && !!blendOpen[k],
    tr = shadeOn() ? toneRows(e.secs) : [],
    // (v306: its code is in the guide in the other brand too)
    sn = sameName(m);
  let r =
    '<div class="sfarow' +
    (full ? ' full' : '') +
    (open ? ' open' : '') +
    '" data-k="' +
    esc(k) +
    '"><button type="button" class="sfah" aria-expanded="' +
    open +
    '"><span class="sw" style="background:' +
    esc(m.hex) +
    '"></span><span class="nm">' +
    (brandsMixed()
      ? '<b class="btag" aria-hidden="true">' +
        esc(bTag(m.brand)) +
        '</b> <span class="sfsr">' +
        esc(m.brand) +
        ' </span>'
      : '') +
    '<b>' +
    esc(m.code) +
    '</b> ' +
    (sn
      ? '<span class="sf2b" aria-hidden="true">2 brands</span><span class="sfsr">(' +
        esc(sn) +
        ' is in this guide too) </span>'
      : '') +
    esc(m.name || '') +
    (inDone && e.z != null ? ' <span class="sfazt">· ' + esc(zoneName(e.z)) + '</span>' : '') +
    '</span><span class="cnt">' +
    (full
      ? (e.n === 1 ? 'Coloured' : 'All ' + e.n + ' coloured') + ' <span aria-hidden="true">✓</span>'
      : e.d + ' of ' + e.n + ' coloured') +
    '</span>' +
    // (its tones: none when none of its sections is shaded; each zone's where they differ)
    // (several options: on as many lines as they take, rather than cut off at the row's edge)
    (tr.length
      ? '<span class="sfatones' +
        (tr.length > 1 ? ' sfatm' : '') +
        '">' +
        toneTrioMulti(m, tr, true) +
        '</span>'
      : '') +
    '</button>';
  // open, with tones that differ by zone: which zone has which
  if (open && tr.length > 1)
    r +=
      '<div class="sfazones">' +
      tr
        .map(function (x) {
          const ids = zoneIds().filter(function (id) {
            return x.z[id];
          });
          return (
            '<div><b>' +
            esc(
              ids
                .map(function (id) {
                  return zoneName(id);
                })
                .join(', '),
            ) +
            '</b> <span class="sfatones">' +
            toneTrio(m, true, x.t) +
            '</span></div>'
          );
        })
        .join('') +
      '</div>';
  if (open)
    r +=
      '<div class="sfacts" role="group" aria-label="' +
      esc(m.code) +
      '"><button type="button" id="sfMarkAll" class="sfedit">' +
      (full ? 'Clear' : '<span aria-hidden="true">✓</span> Mark all coloured') +
      '</button>' +
      (full ? '' : '<button type="button" id="sfFindNext" class="sfedit">Find next</button>') +
      '<button type="button" id="sfBlends" class="sfedit' +
      (bo ? ' on' : '') +
      '" aria-expanded="' +
      bo +
      '">' +
      ic('blend') +
      ' Blends</button></div>' +
      (bo ? blendStrip(m) : '');
  return r + '</div>';
}
// the list itself, redrawn on every tick (keyboard focus stays on the same button)
function renderAlong() {
  const el = document.getElementById('sfAlist');
  if (!el || !assignData) return;
  const ae = document.activeElement,
    row = el.contains(ae) ? ae.closest('.sfarow') : null,
    fid = el.contains(ae) ? ae.id || '' : '',
    fk = row && !fid ? row.dataset.k : null;
  const list = alongList(alongSort()),
    full = {};
  list.forEach(function (e) {
    if (e.d >= e.n) full[e.key] = 1;
  });
  alDone = alDone.filter(function (k) {
    return full[k];
  }); // a marker un-ticked since goes back to its place
  const grp = list.filter(function (e) {
    return alDone.indexOf(e.key) >= 0;
  });
  // zone by zone: each zone's rows under its name, with how much of it is done
  const zt = {};
  if (alongZones())
    list.forEach(function (e) {
      const t = zt[e.z] || (zt[e.z] = { n: 0, d: 0 });
      t.n += e.n;
      t.d += e.d;
    });
  let lastZ = null;
  // (v306) a search by code: only its rows, the exact code's first, each saying its zone, the Done ones among them
  // (by marker, so Whole picture or Zone by zone chosen with a search shown keeps its rows)
  if (alFind && alFind.g !== loadGen) findForget();
  if (alFind) {
    const rk = alFind.rank;
    el.innerHTML = list
      .filter(function (e) {
        return rk[e.m.mkey] != null;
      })
      .sort(function (a, b) {
        return rk[a.m.mkey] - rk[b.m.mkey];
      })
      .map(function (e) {
        return alongRow(e, true);
      })
      .join('');
    alongRefocus(el, fid, fk);
    return;
  }
  let h = list
    .filter(function (e) {
      return alDone.indexOf(e.key) < 0;
    })
    .map(function (e) {
      let hd = '';
      if (e.z != null && e.z !== lastZ) {
        lastZ = e.z;
        const t = zt[e.z];
        hd =
          '<div class="sfazh"><b>' +
          esc(zoneName(e.z)) +
          '</b><span>' +
          (t.d >= t.n ? 'all ' + t.n + ' coloured' : t.d + ' of ' + t.n + ' coloured') +
          '</span></div>';
      }
      return hd + alongRow(e);
    })
    .join('');
  if (grp.length)
    h +=
      '<button type="button" id="sfDoneGrp" class="sfdonegrp" aria-expanded="' +
      alDoneOpen +
      '">' +
      ic(alDoneOpen ? 'chevron-down' : 'chevron-right') +
      ' Done (' +
      grp.length +
      ')</button>' +
      (alDoneOpen
        ? grp
            .map(function (e) {
              return alongRow(e, true);
            })
            .join('')
        : '');
  el.innerHTML = h;
  alongRefocus(el, fid, fk);
}
// (keyboard focus back on the same button after a redraw of the list)
function alongRefocus(el, fid, fk) {
  let f = fid ? document.getElementById(fid) : null;
  if (fk)
    el.querySelectorAll('.sfarow').forEach(function (x) {
      if (x.dataset.k === fk) f = x.querySelector('.sfah');
    });
  if ((fid || fk) && !f) f = el.querySelector('.sfarow.open .sfah') || document.getElementById('sfDoneGrp');
  if (f && el.contains(f))
    try {
      f.focus({ preventScroll: true });
    } catch (_) {}
}
function alongEntry(k) {
  let r = null;
  if (assignData)
    alongList().forEach(function (e) {
      if (e.key === k) r = e;
    });
  return r;
}
function alongName(m) {
  return msay(m) + (m.name ? ' ' + m.name : '');
}
function alongClick(e) {
  const b = e.target.closest('button');
  if (!b || !this.contains(b)) return;
  const row = b.closest('.sfarow'),
    k = row ? row.dataset.k : null;
  if (b.id === 'sfDoneGrp') {
    alDoneOpen = !alDoneOpen;
    renderAlong();
  } else if (b.classList.contains('sfah')) alongOpen(alongKey(hlKey, hlZone) === k ? null : k);
  else if (b.id === 'sfMarkAll') {
    const en = alongEntry(k),
      t = e.timeStamp > 0 ? e.timeStamp : performance.now();
    if (!en) return;
    const all = en.d < en.n;
    // the button turns into Clear ticks where it is: the second tap of a double tap is not a Clear
    if (!all && (e.detail > 1 || t - _maT < MA_DOUBLE)) return;
    _maT = t;
    markActive(all);
    sayLive(
      all
        ? en.n === 1
          ? 'The ' + msay(en.m) + ' section coloured'
          : 'All ' + en.n + ' ' + msay(en.m) + ' sections coloured'
        : 'Cleared ' + msay(en.m),
    );
    alongReveal();
  } else if (b.id === 'sfFindNext') findNext();
  else if (b.id === 'sfBlends') {
    blendOpen[k] = !blendOpen[k];
    renderAlong();
    alongReveal();
  }
}
// open a marker's row (k) or close the open one (null); found: a press and hold on the picture chose it
function alongOpen(k, found) {
  alongSet(k);
  // (a row tapped after a two-brand search: that marker is the one in your hand, v307)
  if (k && alFind) alFind.two = null;
  blendOpen = {};
  if (k) alongHintSeen();
  if (k && alDone.indexOf(k) >= 0) alDoneOpen = true;
  renderGuide();
  renderAlong();
  if (!k) {
    sayLive('Showing all colours');
    return;
  }
  jumpToNext();
  alongReveal();
  const en = alongEntry(k);
  if (en) sayLive((found ? 'Found ' : '') + alongName(en.m) + ', ' + en.d + ' of ' + en.n + ' coloured');
}
// scroll so the open row is fully in view between the pinned picture (and its tool row) and the bar. The scroll is
// smooth, and the pinned picture changes size as the page scrolls (and Safari stops a smooth scroll when anything else
// scrolls the page), so once it has had time to finish the row is checked again and put right at once, unless you
// have touched or scrolled the page since (`again`: that second check)
function alongReveal(again) {
  _revStop();
  const row = document.querySelector('#sfAlist .sfarow.open'),
    bar = barEl();
  if (!row || row.offsetParent === null || focus) return;
  const r = row.getBoundingClientRect(),
    top =
      safeTop() +
      (geo.side ? 0 : parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0) +
      6,
    bot = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 6;
  let dy = 0;
  if (r.bottom > bot) dy = r.bottom - bot;
  if (r.top - dy < top) dy = r.top - top;
  if (Math.abs(dy) < 1) return;
  if (again || reduce) window.scrollTo(0, Math.round(window.scrollY + dy));
  else
    try {
      window.scrollTo({ top: Math.round(window.scrollY + dy), behavior: 'smooth' });
    } catch (_) {
      window.scrollTo(0, Math.round(window.scrollY + dy));
    }
  if (again) return;
  REV_STOP.forEach(function (ev) {
    window.addEventListener(ev, _revStop, { capture: true, passive: true });
  });
  _revT = setTimeout(function () {
    _revStop();
    alongReveal(true);
  }, 500);
}
// touching, scrolling with a wheel or pressing a key cancels the second check
const REV_STOP = ['touchstart', 'wheel', 'keydown'];
function _revStop() {
  clearTimeout(_revT);
  _revT = 0;
  REV_STOP.forEach(function (ev) {
    window.removeEventListener(ev, _revStop, true);
  });
}
// press and hold a section while colouring along: open its marker's row and bring it into view
function findInList(l) {
  const m = assignData && assignData.assign[l];
  if (!m) return;
  if (navigator.vibrate)
    try {
      navigator.vibrate(18);
    } catch (_) {}
  // (a search by code that hasn't its marker's row: the whole list again, so the row is there to open)
  if (alFind && alFind.rank[m.mkey] == null) findClear(true);
  alongOpen(alongKey(m.mkey, zoneOf(l)), true);
  const row = document.querySelector('#sfAlist .sfarow.open');
  if (row) {
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    setTimeout(function () {
      row.classList.remove('flash');
    }, 1600);
  }
}

/* ---- (v306) Find a marker by its code ----
    "Marker in your hand? Type its code": a box above the list. While you type, nothing opens: one line above the box
    says what the code matches ("Ohuhu Y26 Light Gold · Copic Y26 Mustard"), as the box is what the iPad's keyboard
    leaves in view. Return (the keyboard's Go) runs the search: the keyboard closes, the list shows only that marker's
    rows (zone by zone, each zone's; the exact code's first, then markers it's the highlight or shadow of) and its row
    opens, the first not finished, with its sections shown on the picture. Two brands of the code ask "Two Y26s: which
    is in your hand?" and open neither; a code that's only a highlight or shadow here says what it goes with instead
    ("Y06 is a highlight for Y07, Y09": findPartLine). Codes are read as the caps show them now: an old code finds
    nothing (Ben's caps carry the current ones, and 19 old Ohuhu codes are another marker's current one). The list's
    order setting stays as it was; clearing the box (its ✕, emptying it, or Escape) brings the whole list back. "/"
    goes to the box from the keyboard. Not in Focus mode, which has its own order and Colours sheet. */
let alFind = null, // the search run: { q, rank: { marker key: 0 the code's own, 1 its highlight or shadow's, 2 starts so } }
  alFindQ = '', // the box's text, kept through a redraw of the controls
  alFindL = '', // the line above the box
  _kbdSim = null; // (tests: an on-screen keyboard this tall)
// a code box (Colour along's, and Another… under "Did any run low?"): capitals, no corrections, the 16px text that
// keeps iPad Safari from zooming in, and Go on the keyboard's Return
function codeBoxHTML(id, ph, label, lineId) {
  return (
    '<input id="' +
    id +
    '" class="sfcodein" type="text" enterkeyhint="go" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" aria-label="' +
    esc(label) +
    '"' +
    (lineId ? ' aria-describedby="' + lineId + '"' : '') +
    ' placeholder="' +
    esc(ph) +
    '">'
  );
}
function findBoxHTML() {
  return (
    '<div id="sfFind" class="sffind' +
    (alFindQ ? ' sffindon' : '') +
    '"><div id="sfFindL" class="sffindl" aria-live="polite">' +
    esc(alFindL) +
    '</div><form id="sfFindF" class="sffindf" role="search" action="#" novalidate>' +
    codeBoxHTML('sfFindIn', 'Marker in your hand? Type its code', 'Find a marker by its code', 'sfFindL') +
    '<button type="button" id="sfFindX" class="sffindx" aria-label="Clear the code"' +
    (alFindQ ? '' : ' hidden') +
    '>' +
    ic('x') +
    '</button></form></div>'
  );
}
// what a code finds in the guide: base, markers that are a section's own; part, highlights and shadows of some
// ({ m, highlight: { marker key: base }, shadow: {…} }); pre, the guide's codes that start with it; known, whether any
// marker has it at all
function codeFind(raw) {
  const q = codeNorm(raw),
    r = {
      q: q,
      raw: String(raw == null ? '' : raw)
        .trim()
        .toUpperCase(),
      base: [],
      part: [],
      pre: [],
      known: false,
    };
  if (!q || !assignData) return r;
  const B = {},
    P = {},
    pre = {},
    sh = shadeOn();
  for (const l in assignData.assign) {
    const m = assignData.assign[l],
      c = codeNorm(m.code);
    if (c === q) B[m.mkey] = m;
    else if (c.indexOf(q) === 0) pre[m.code] = 1;
    const t = sh ? shadeSec(+l) : null;
    if (t)
      [
        ['light', 'highlight'],
        ['dark', 'shadow'],
      ].forEach(function (p) {
        const x = t[p[0]];
        if (!x || codeNorm(x.code) !== q) return;
        const e =
          P[x.mkey] || (P[x.mkey] = { m: x, highlight: {}, shadow: {}, zn: { highlight: {}, shadow: {} } });
        e[p[1]][m.mkey] = m;
        // (v307: the zones it's that in, so a highlight in one zone and a shadow in another can say where)
        e.zn[p[1]][zones.length ? zoneOf(+l) : 0] = 1;
      });
  }
  const vals = function (o) {
    return Object.keys(o).map(function (k) {
      return o[k];
    });
  };
  r.base = vals(B).sort(function (a, b) {
    return a.brand.localeCompare(b.brand);
  });
  r.part = vals(P);
  r.pre = Object.keys(pre).sort(function (a, b) {
    return a.localeCompare(b, 'en', { numeric: true });
  });
  r.known = COLORS.some(function (c) {
    return codeNorm(c.code) === q;
  });
  return r;
}
// the brands a search found (the code's own markers and its highlights and shadows)
function findBrands(r) {
  const b = {};
  r.base.forEach(function (m) {
    b[m.brand] = 1;
  });
  r.part.forEach(function (p) {
    b[p.m.brand] = 1;
  });
  return Object.keys(b);
}
// (v307) where a highlight or shadow is used, when it's a highlight in some zones and a shadow in others: " in Main"
// (zn: { highlight: { zone id: 1 }, shadow: {…} }); '' when they're the same, or without zones
function roleZones(zn, k) {
  if (!zones.length || !zn) return '';
  const ids = function (o) {
      return zoneIds().filter(function (id) {
        return o && o[id];
      });
    },
    h = ids(zn.highlight),
    s = ids(zn.shadow);
  if (!h.length || !s.length || h.join() === s.join()) return '';
  return (
    ' in ' +
    ids(zn[k])
      .map(function (id) {
        return zoneName(id);
      })
      .join(', ')
  );
}
// the line above the box for what a code finds: "Y26 Light Gold", "Ohuhu Y26 Light Gold · Copic Y26 Mustard",
// "Y11: highlight for Y26, Y35", "Codes starting Y2: Y21, Y210, Y26", "Y26 isn't in this guide", "No marker R99"
function findLine(r) {
  if (!r.q) return '';
  const two = findBrands(r).length > 1,
    nm = function (m) {
      return (two ? m.brand + ' ' : '') + m.code;
    },
    few = function (a) {
      return a.slice(0, 4).join(', ') + (a.length > 4 ? ' +' + (a.length - 4) + ' more' : '');
    },
    out = [];
  r.base.forEach(function (m) {
    out.push(nm(m) + (m.name ? ' ' + m.name : ''));
  });
  r.part.forEach(function (p) {
    const own = r.base.some(function (m) {
        return m.mkey === p.m.mkey;
      }),
      roles = ['highlight', 'shadow']
        .filter(function (k) {
          return Object.keys(p[k]).length;
        })
        .map(function (k) {
          return (
            k +
            roleZones(p.zn, k) +
            ' for ' +
            few(
              Object.keys(p[k]).map(function (x) {
                return p[k][x].code;
              }),
            )
          );
        });
    if (own) out.push((two ? nm(p.m) + ' also ' : 'also ') + roles.join(' and '));
    else out.push(nm(p.m) + ': ' + roles.join(' and '));
  });
  if (out.length) return out.join(' · ');
  if (r.pre.length) return 'Codes starting ' + r.raw + ': ' + few(r.pre);
  return r.known ? r.raw + ' isn’t in this guide' : 'No marker ' + r.raw;
}
// (v306) Return on a code that's only a highlight or shadow in this guide: "Y06 is a highlight for Y07, Y09", or with
// both brands of it in use "Y06 is a highlight here: Copic for FY00 · Ohuhu for Y07, Y09" (both kinds: "Y06 is a
// highlight and a shadow here: Copic shadow for FY00 · Ohuhu highlight for Y07")
function findPartLine(r) {
  const kinds = ['highlight', 'shadow'],
    by = {},
    has = {};
  r.part.forEach(function (p) {
    const e =
      by[p.m.brand] || (by[p.m.brand] = { highlight: [], shadow: [], zn: { highlight: {}, shadow: {} } });
    kinds.forEach(function (k) {
      for (const x in p[k]) {
        const c = p[k][x].code;
        if (e[k].indexOf(c) < 0) e[k].push(c);
        has[k] = 1;
      }
      if (p.zn) Object.assign(e.zn[k], p.zn[k]);
    });
  });
  const few = function (a) {
      return a.slice(0, 4).join(', ') + (a.length > 4 ? ' +' + (a.length - 4) + ' more' : '');
    },
    ks = kinds.filter(function (k) {
      return has[k];
    }),
    both = ks.length > 1,
    brands = Object.keys(by).sort(),
    // one brand's part: "highlight for Y07 and shadow for R20", or (one kind) "for Y07"
    roles = function (e, named) {
      return ks
        .filter(function (k) {
          return e[k].length;
        })
        .map(function (k) {
          return (named ? k + roleZones(e.zn, k) + ' ' : '') + 'for ' + few(e[k]);
        })
        .join(' and ');
    },
    what = ks
      .map(function (k) {
        return 'a ' + k;
      })
      .join(' and ');
  if (brands.length < 2) {
    const e = by[brands[0]];
    return (
      r.raw +
      ' is ' +
      ks
        .map(function (k) {
          return 'a ' + k + roleZones(e.zn, k) + ' for ' + few(e[k]);
        })
        .join(' and ')
    );
  }
  return (
    r.raw +
    ' is ' +
    what +
    ' here: ' +
    brands
      .map(function (b) {
        return b + ' ' + roles(by[b], both);
      })
      .join(' \u00b7 ')
  );
}
function findSetLine(t) {
  alFindL = t || '';
  const el = document.getElementById('sfFindL');
  if (el) el.textContent = alFindL;
}
// Return: run the search (see above)
function findGo() {
  const inp = document.getElementById('sfFindIn');
  if (!inp || !assignData) return;
  alFindQ = inp.value;
  const r = codeFind(inp.value);
  if (!r.q) {
    findClear();
    return;
  }
  // (the keyboard closes, so the rows and the picture are in view)
  try {
    inp.blur();
  } catch (_) {}
  const list = alongList(),
    rank = {},
    bases = {},
    partB = {};
  r.base.forEach(function (m) {
    bases[m.mkey] = 1;
  });
  r.part.forEach(function (p) {
    ['highlight', 'shadow'].forEach(function (k) {
      for (const x in p[k]) partB[x] = 1;
    });
  });
  list.forEach(function (e) {
    const k = e.m.mkey;
    if (bases[k]) rank[k] = 0;
    else if (partB[k]) rank[k] = 1;
  });
  if (!Object.keys(rank).length)
    list.forEach(function (e) {
      if (codeNorm(e.m.code).indexOf(r.q) === 0) rank[e.m.mkey] = 2;
    });
  if (!Object.keys(rank).length) {
    alFind = null;
    const t = findLine(r);
    findSetLine(t);
    renderAlong();
    sayLive(t);
    return;
  }
  alFind = { q: r.q, rank: rank, g: loadGen, two: findTwoOf(r) };
  let open = null,
    line = findLine(r);
  // (only a highlight or shadow here: what it goes with, the rows of those markers shown)
  if (!r.base.length && r.part.length) line = findPartLine(r);
  else if (findBrands(r).length > 1) line = 'Two ' + r.raw + 's: which is in your hand?';
  if (findBrands(r).length < 2) {
    // the one marker it is (the code's own, or the one marker it's the highlight or shadow of): its first row not
    // finished, else its first
    const mk = r.base.length ? [r.base[0].mkey] : r.part.length ? Object.keys(partB) : [];
    if (mk.length === 1) {
      const rows = list.filter(function (e) {
        return e.m.mkey === mk[0];
      });
      const e =
        rows.find(function (x) {
          return x.d < x.n;
        }) || rows[0];
      if (e) open = e.key;
    }
  }
  findSetLine(line);
  if (open) {
    alongOpen(open);
    return;
  }
  alongSet(null);
  blendOpen = {};
  renderGuide();
  renderAlong();
  sayLive(line);
  findReveal();
}
// (v307) a code in both brands: each marker it is (or is the highlight or shadow of) with its colour and the markers
// whose sections it goes on ({ k, hex, b: { marker key: 1 } }), so the picture shows them all, each outlined in its
// own colour, until a row is tapped (null for one marker)
function findTwoOf(r) {
  if (findBrands(r).length < 2) return null;
  const out = [];
  r.base.forEach(function (m) {
    const b = {};
    b[m.mkey] = 1;
    out.push({ k: m.mkey, hex: m.hex, b: b });
  });
  r.part.forEach(function (p) {
    if (
      r.base.some(function (m) {
        return m.mkey === p.m.mkey;
      })
    )
      return;
    const b = {};
    ['highlight', 'shadow'].forEach(function (k) {
      for (const x in p[k]) b[x] = 1;
    });
    out.push({ k: p.m.mkey, hex: p.m.hex, b: b });
  });
  return out.length > 1 ? out : null;
}
// the markers a two-brand search shows on the picture now (none once a row is open, or out of Colour along)
function findTwo() {
  return sfmode === 'color' && !focus && !hlKey && alFind && alFind.g === loadGen && alFind.two
    ? alFind.two
    : null;
}
// (a new start: Colour along entered again, another guide)
function findForget() {
  alFind = null;
  alFindQ = '';
  alFindL = '';
}
// the box emptied: the whole list again, the open row (if any) kept in view (quiet: only the box and the search, for
// a caller that draws the list itself)
function findClear(quiet) {
  const inp = document.getElementById('sfFindIn'),
    was = !!alFind;
  alFind = null;
  alFindQ = '';
  if (inp && inp.value) inp.value = '';
  const x = document.getElementById('sfFindX');
  if (x) x.hidden = true;
  findSetLine('');
  if (!was || quiet === true) return;
  renderAlong();
  sayLive('Showing all colours');
  alongReveal();
}
// with no row opened, the box and the rows under it brought into view just under the pinned picture
function findReveal() {
  const el = document.getElementById('sfFind');
  if (!el || el.offsetParent === null) return;
  const top =
      safeTop() +
      (geo.side ? 0 : parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0) +
      6,
    r = el.getBoundingClientRect();
  if (Math.abs(r.top - top) < 1) return;
  window.scrollTo(0, Math.max(0, Math.round(window.scrollY + r.top - top)));
}
function findWire() {
  const f = document.getElementById('sfFindF'),
    inp = document.getElementById('sfFindIn'),
    x = document.getElementById('sfFindX');
  if (!f || !inp) return;
  inp.value = alFindQ;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    findGo();
  });
  inp.addEventListener('input', function () {
    // (v307: kept as you type, so a redraw of the controls, another tab's save among them, keeps it)
    alFindQ = inp.value;
    if (x) x.hidden = !inp.value;
    if (!inp.value.trim()) {
      findClear();
      return;
    }
    findSetLine(findLine(codeFind(inp.value)));
  });
  if (x)
    x.addEventListener('click', function () {
      findClear();
      // (on a phone ✕ folds the box away again)
      if (findPhone()) {
        findFold(false);
        const ob = document.getElementById('sfFindOpen');
        try {
          if (ob) ob.focus({ preventScroll: true });
        } catch (_) {}
        return;
      }
      try {
        inp.focus({ preventScroll: true });
      } catch (_) {}
    });
  const ob = document.getElementById('sfFindOpen');
  if (ob)
    ob.addEventListener('click', function () {
      const on = !document.getElementById('sfFind').classList.contains('sffindon');
      findFold(on);
      if (on)
        try {
          inp.focus({ preventScroll: true });
        } catch (_) {}
    });
  // (a phone's box with nothing in it folds away once you leave it)
  inp.addEventListener('blur', function () {
    if (findPhone() && !inp.value.trim() && !alFind)
      setTimeout(function () {
        if (document.activeElement !== inp && document.activeElement !== ob) findFold(false);
      }, 0);
  });
  inp.addEventListener('focus', findKbd);
  inp.addEventListener('blur', function () {
    setTimeout(findKbd, 0);
  });
}
// (v307) Another tab saved the open guide, which is reloaded in place (reloadOpen): Colour along as it was kept first,
// and put back once the guide has opened again: the code box's text, its cursor and the line above it, a search run,
// the open row and its Blends, the Done group, which control had the keyboard, and where the page was scrolled.
let _alKeep = null;
function alongKeep() {
  if (sfmode !== 'color' || focus || !assignData) return null;
  const inp = document.getElementById('sfFindIn'),
    ae = document.activeElement,
    inCtl = !!(ae && ctlEl && ctlEl.contains(ae)),
    row = inCtl && ae.closest ? ae.closest('.sfarow') : null,
    f = document.getElementById('sfFind');
  return {
    id: curId,
    q: inp ? inp.value : alFindQ,
    line: alFindL,
    find: alFind ? { q: alFind.q, rank: alFind.rank, two: alFind.two || null } : null,
    key: alongKey(hlKey, hlZone),
    blend: Object.assign({}, blendOpen),
    done: alDone.slice(),
    doneOpen: alDoneOpen,
    foc: inCtl && ae.id ? ae.id : '',
    fk: row && !ae.id ? row.dataset.k : null,
    sel: inp && ae === inp ? [inp.selectionStart, inp.selectionEnd, inp.selectionDirection] : null,
    fold: !!(f && f.classList.contains('sffindon')),
    y: window.scrollY,
  };
}
function alongRestore(k) {
  if (!k || sfmode !== 'color' || focus || !assignData || k.id !== curId) return;
  alFindQ = k.q || '';
  if (k.find && alFindQ.trim()) {
    alFind = { q: k.find.q, rank: k.find.rank, g: loadGen, two: k.find.two };
    alFindL = k.line;
  } else alFindL = alFindQ.trim() ? findLine(codeFind(alFindQ)) : '';
  alDone = k.done.filter(function (x) {
    return !!alongEntry(x);
  });
  alDoneOpen = k.doneOpen;
  if (k.key && alongEntry(k.key)) {
    alongSet(k.key);
    blendOpen = k.blend;
    if (alDone.indexOf(k.key) >= 0) alDoneOpen = true;
  }
  renderControls();
  renderGuide();
  if (k.fold) findFold(true);
  window.scrollTo(0, k.y);
  let el = k.foc ? document.getElementById(k.foc) : null;
  if (!el && k.fk)
    document.querySelectorAll('#sfAlist .sfarow').forEach(function (r) {
      if (r.dataset.k === k.fk) el = r.querySelector('.sfah');
    });
  if (el && el.offsetParent !== null)
    try {
      el.focus({ preventScroll: true });
      if (k.sel && el.id === 'sfFindIn' && el.setSelectionRange)
        el.setSelectionRange(k.sel[0], k.sel[1], k.sel[2]);
    } catch (_) {}
}
// Escape (a layer, 95-mount.js): with a code in the box or a search run, it clears that first
function findOpen() {
  const inp = document.getElementById('sfFindIn');
  return sfmode === 'color' && !focus && !!inp && inp.offsetParent !== null && (!!inp.value || !!alFind);
}
// a phone (the box folds away behind a button in the order row there, 04-along.css)
function findPhone() {
  try {
    return matchMedia('(max-width: 599px)').matches;
  } catch (_) {
    return false;
  }
}
// a phone's folded code box: open (and into the box) or fold again
function findFold(open) {
  const f = document.getElementById('sfFind'),
    b = document.getElementById('sfFindOpen');
  if (f) f.classList.toggle('sffindon', !!open);
  if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
}
// "/" from the keyboard goes to the box (not plain letters, which VoiceOver uses to move about)
function findKey(e) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  const t = e.target,
    tn = t && t.tagName;
  if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT' || (t && t.isContentEditable)) return;
  if (sfmode !== 'color' || focus || dialogOpen() || sheetOpen()) return;
  findFold(true);
  const inp = document.getElementById('sfFindIn');
  if (!inp || inp.offsetParent === null) return;
  e.preventDefault();
  try {
    inp.focus({ preventScroll: true });
  } catch (_) {}
  findReveal();
}
// The iPad's keyboard in portrait leaves the space between the pinned picture and itself, too little for the line
// and the box: while it's up over the box, the picture stops being pinned and the line goes to the top of the screen.
// It's pinned again when the keyboard goes (Return closes it).
function findKbd() {
  if (!workEl) return;
  const inp = document.getElementById('sfFindIn'),
    vv = window.visualViewport,
    ih = window.innerHeight || 0,
    kb = _kbdSim != null ? _kbdSim : vv ? Math.max(0, ih - vv.height) : 0,
    on =
      !!inp && document.activeElement === inp && sfmode === 'color' && !focus && !geo.side && kb > ih * 0.2,
    was = workEl.classList.contains('sfkbd');
  if (on !== was) {
    workEl.classList.toggle('sfkbd', on);
    if (on) document.documentElement.style.setProperty('--pinH', '0px');
    else frameSize();
  }
  if (!on) return;
  const el = document.getElementById('sfFind'),
    top = (vv && _kbdSim == null ? vv.offsetTop : 0) + safeTop() + 8;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (Math.abs(r.top - top) > 2) window.scrollTo(0, Math.max(0, Math.round(window.scrollY + r.top - top)));
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('keydown', findKey);
  try {
    if (window.visualViewport) window.visualViewport.addEventListener('resize', findKbd);
  } catch (_) {}
}
