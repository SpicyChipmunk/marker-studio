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
    alongHint() +
    (zones.length
      ? '<div id="sfAlOrder" class="sfc-segs sfalorder" role="group" aria-label="Colour along goes through">' +
        ctlSeg('whole', 'Whole picture', !alongZones()) +
        ctlSeg('zones', 'Zone by zone', alongZones()) +
        '</div>'
      : '') +
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
// its sections ticked, or tones coloured), else the first not finished; opened, with its row in view
function alongResume() {
  if (sfmode !== 'color' || !assignData || !colored) return;
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
  if (!nx) return;
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
}
// is section l one of the open row's? (its marker, and zone by zone its zone)
function hlMatch(l) {
  const m = assignData && assignData.assign[l];
  return !!m && m.mkey === hlKey && (hlZone == null || zoneOf(l) === hlZone);
}
// each marker in the guide (zone by zone: in each zone) with how many of its sections there are and how many are
// ticked, lightest first (as focus mode goes: lighter inks down before darker ones next to them, which could bleed
// into them), then most sections first
function alongList() {
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
    return (byZ ? zi[a.z] - zi[b.z] : 0) || _lum(b.m.hex) - _lum(a.m.hex) || b.n - a.n;
  });
}
// inDone: in the Done group, where zone by zone a row says which zone it's from (there's no zone heading over it)
function alongRow(e, inDone) {
  const m = e.m,
    k = e.key,
    full = e.d >= e.n,
    open = hlKey === m.mkey && (e.z == null ? hlZone == null : hlZone === e.z),
    bo = open && !!blendOpen[k],
    tr = shadeOn() ? toneRows(e.secs) : [];
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
    esc(m.name || '') +
    (inDone && e.z != null ? ' <span class="sfazt">· ' + esc(zoneName(e.z)) + '</span>' : '') +
    '</span><span class="cnt">' +
    (full ? 'All ' + e.n + ' coloured <span aria-hidden="true">✓</span>' : e.d + ' of ' + e.n + ' coloured') +
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
  const list = alongList(),
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
  return m.code + (m.name ? ' ' + m.name : '');
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
          ? 'The ' + en.m.code + ' section coloured'
          : 'All ' + en.n + ' ' + en.m.code + ' sections coloured'
        : 'Cleared ' + en.m.code,
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
