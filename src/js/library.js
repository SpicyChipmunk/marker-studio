function shortDate() {
  try {
    return new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}
function doSave() {
  const idxs = currentPaletteIdxs();
  if (!idxs.length) return;
  const entry = {
    id: Date.now(),
    type: 'palette',
    name: paletteName(idxs),
    keys: idxs.map(mkey),
    ts: Date.now(),
  };
  state.saved.unshift(entry);
  saveNew(entry);
}
// keep a new Library entry, or take it back out and say storage is full (no "Saved" for something that wasn't)
function saveNew(entry) {
  if (!save(true)) {
    const j = state.saved.indexOf(entry);
    if (j >= 0) state.saved.splice(j, 1);
    chrome();
    saveFailNotice(true);
    return false;
  }
  chrome();
  flashSaved();
  renderRecent();
  return true;
}
// the Save button says Saved for a moment, then goes back to Save (a second save meanwhile just restarts the moment)
function flashSaved() {
  clearTimeout(flashSaved.t);
  saveBtn.textContent = 'Saved \u2713';
  saveBtn.disabled = true;
  saveBtn.classList.add('flash');
  flashSaved.t = setTimeout(() => {
    saveBtn.textContent = 'Save';
    saveBtn.classList.remove('flash');
    chrome();
  }, 1100);
}
var libQuery = '',
  libSort = 'recent';
function relDate(ts) {
  if (!ts) return '';
  var d = Date.now() - ts,
    day = 86400000;
  if (d < 0) return '';
  if (d < day) return 'today';
  if (d < 2 * day) return 'yesterday';
  if (d < 7 * day) return Math.floor(d / day) + ' days ago';
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}
var _thumbTried = {};
function renderRecent() {
  var _ls = document.getElementById('homeLibSub');
  if (_ls) {
    var _n = state.saved.length;
    _ls.textContent = _n ? _n + ' saved' : 'Nothing yet';
  }
  var el = document.getElementById('sfRecent');
  if (!el) return;
  var gs = state.saved
    .filter(function (s) {
      return s.type === 'guide';
    })
    .sort(function (a, b) {
      return (b.ts || 0) - (a.ts || 0);
    })
    .slice(0, 4);
  if (!gs.length) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  var html =
    '<div class="sfRecentHead"><span>Pick up where you left off</span><button class="homelink sfSeeAll" data-lib="1">See all <span aria-hidden="true">\u2192</span></button></div>';
  gs.forEach(function (g) {
    var nm =
      g.name && !/^(Guide|Colour guide)$/.test(g.name)
        ? g.name
        : evoName(
            (g.keys || []).map(function (k) {
              var _i = keyIdx(k);
              return _i != null && COLORS[_i] ? COLORS[_i].hex : null;
            }),
          ) || 'Colour guide';
    nm = esc(nm || 'Guide');
    var vis;
    if (safeThumb(g.thumb)) {
      vis = '<img class="sfRecThumb" src="' + esc(safeThumb(g.thumb)) + '" alt="">';
    } else {
      var sw = '';
      (g.keys || []).slice(0, 8).forEach(function (k) {
        var i = keyIdx(k);
        sw += '<span style="background:' + (i != null && COLORS[i] ? COLORS[i].hex : '#555') + '"></span>';
      });
      vis = '<div class="sfRecThumb sfRecStrip">' + sw + '</div>';
    }
    html +=
      '<button class="sfRecCard" data-gid="' +
      esc(g.id) +
      '">' +
      vis +
      '<div class="sfRecMeta"><span class="sfRecName">' +
      nm +
      '</span><span class="sfRecDate">' +
      relDate(g.ts) +
      '</span></div></button>';
  });
  el.innerHTML = html;
  el.style.display = '';
  el.onclick = function (e) {
    if (e.target.closest('[data-lib]')) {
      openLibrary();
      return;
    }
    var c = e.target.closest('[data-gid]');
    if (!c) return;
    var id = +c.getAttribute('data-gid');
    setMode('sections');
    if (window.SF && SF.openDesign) SF.openDesign(id);
  };
  gs.forEach(function (g) {
    if (safeThumb(g.thumb)) return;
    if (_thumbTried[g.id]) return;
    _thumbTried[g.id] = 1;
    if (window.SF && SF.thumbFor)
      SF.thumbFor(g.id).then(function (t) {
        if (!t) return;
        g.thumb = t;
        if (!save(true)) g.thumb = '';
        var card = el.querySelector('[data-gid="' + g.id + '"]');
        if (card) {
          var oldv = card.querySelector('.sfRecThumb');
          if (oldv) {
            var img = document.createElement('img');
            img.className = 'sfRecThumb';
            img.src = t;
            img.alt = '';
            oldv.replaceWith(img);
          }
        }
      });
  });
}
function renderLibStat() {
  const el = $('libStat');
  if (!el) return;
  const n = state.saved.filter((s) => s.type === 'guide').length,
    bk = lastGuideBackup(),
    risk = guidesAtRisk();
  if (!n) {
    el.textContent = '';
    return;
  }
  el.textContent = bk
    ? 'Last backup: ' +
      relDate(bk) +
      (risk ? ' \u00b7 ' + risk + ' not in a backup' : ' \u00b7 all backed up')
    : risk
      ? 'Not backed up yet (' + nWord(risk, 'guide') + ')'
      : 'All guides are in a backup';
  el.classList.toggle('warn', !!risk);
}
// the Library overlay: from Home's Library card, the Recent strip's Library link, the Library button and the guide's ⋯ menu
function openLibrary() {
  renderSaved();
  hideToast();
  openDialog(savedOverlay);
}
function renderSaved() {
  if (_libEd) libEndRename(true, false);
  renderLibStat();
  var list = state.saved.slice();
  var q = (libQuery || '').trim().toLowerCase();
  if (q)
    list = list.filter(function (s) {
      if (((s.name || '') + ' ' + (s.type || '')).toLowerCase().indexOf(q) >= 0) return true;
      var ks = s.keys || [];
      for (var _i = 0; _i < ks.length; _i++) {
        var _ix = keyIdx(ks[_i]);
        if (_ix == null) continue;
        var _c = COLORS[_ix];
        if (!_c) continue;
        if ((_c.code + ' ' + _c.brand + ' ' + bTag(_c.brand)).toLowerCase().indexOf(q) >= 0) return true;
      }
      return false;
    });
  if (libSort === 'name')
    list.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });
  else if (libSort === 'markers')
    list.sort(function (a, b) {
      return (b.keys ? b.keys.length : 0) - (a.keys ? a.keys.length : 0);
    });
  else
    list.sort(function (a, b) {
      return (b.ts || 0) - (a.ts || 0);
    });
  savedList.innerHTML = list.length
    ? list
        .map(function (s) {
          return libRowHTML(s, false);
        })
        .join('')
    : q
      ? '<div class="empty">No matches.</div>'
      : '<div class="empty">No saved palettes or guides yet.</div>';
  libBackfill();
}
var LIB_PEN =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
// how much of a guide is coloured: nothing shown until something is, 100 only when every section is, otherwise 1-99
function libPct(s) {
  var n = +s.n,
    d = s.done;
  if (!n || !(d > 0)) return 0;
  if (d === n) return 100;
  return Math.max(1, Math.min(99, Math.floor((d * 100) / n)));
}
// the line under a name, e.g. Guide · 16 markers · 40% coloured · Sep 27 (each part kept on one line)
function libMeta(s) {
  var t = s.type === 'draw' ? 'Draw' : s.type === 'guide' ? 'Guide' : 'Palette',
    cnt = s.keys ? s.keys.length : 0,
    p = s.type === 'guide' ? libPct(s) : 0;
  return [t, cnt ? cnt + ' marker' + (cnt === 1 ? '' : 's') : '', p ? p + '% coloured' : '', evoWhen(s.ts)]
    .filter(Boolean)
    .map(function (x) {
      return '<span>' + esc(x) + '</span>';
    })
    .join(' \u00b7 ');
}
// a Library row: the whole row opens the item; the pencil renames it in place (ed: the name is an input), the ✕ deletes it (with Undo)
function libRowHTML(s, ed) {
  var nm = esc(s.name || ''),
    shown = nm || (s.type === 'draw' ? 'Draw' : s.type === 'guide' ? 'Guide' : 'Palette');
  var strip = (s.keys || [])
    .slice(0, 12)
    .map(function (k) {
      var i = keyIdx(k);
      return i != null && COLORS[i] ? '<span style="background:' + COLORS[i].hex + '"></span>' : '';
    })
    .join('');
  var vis =
    s.type === 'guide' && safeThumb(s.thumb)
      ? '<img class="sthumb" alt="" src="' + esc(safeThumb(s.thumb)) + '">'
      : '<span class="sstrip">' + strip + '</span>';
  var inner =
    vis +
    '<span class="scol">' +
    (ed
      ? '<input class="sname-in" type="text" maxlength="120" autocomplete="off" aria-label="Name" value="' +
        nm +
        '">'
      : '<span class="sname">' + shown + '</span>') +
    '<span class="smeta">' +
    libMeta(s) +
    '</span></span>';
  return (
    '<div class="srow' +
    (ed ? ' editing' : '') +
    '" data-id="' +
    esc(s.id) +
    '">' +
    (ed
      ? '<div class="sopen">' + inner + '</div>'
      : '<button type="button" class="sopen">' +
        inner +
        '</button><button type="button" class="sren" title="Rename" aria-label="Rename ' +
        shown +
        '">' +
        LIB_PEN +
        '</button>') +
    '<button type="button" class="sdel" title="Delete" aria-label="Delete ' +
    (nm || 'item') +
    '">\u2715</button></div>'
  );
}
// Deleting: the row goes at once and a toast offers Undo for 6 seconds. A guide's stored picture and progress (its
// 'guide-<id>' record) are only removed when that time is up or the next delete comes; the ids still waiting are kept
// in localStorage, so after a reload in between the next start tidies them away (unless the guide is back in the list).
var libPend = null;
const LIBDEL_KEY = 'ms-lib-deleting';
// each waiting id carries when and in which tab it was deleted ({id,t,tab}; a plain number is from before and counts
// as long ago): a start in another tab leaves one alone while that tab's Undo can still bring it back; a reload of the
// same tab (its Undo is gone) tidies it straight away
const LIB_TAB = (function () {
  try {
    let v = sessionStorage.getItem('ms-tab');
    if (!v) {
      v = Math.random().toString(36).slice(2);
      sessionStorage.setItem('ms-tab', v);
    }
    return v;
  } catch (_) {
    return '';
  }
})();
function libPendList() {
  try {
    const a = JSON.parse(localStorage.getItem(LIBDEL_KEY) || '[]');
    return Array.isArray(a)
      ? a
          .map((x) =>
            typeof x === 'number'
              ? { id: x, t: 0 }
              : { id: x && +x.id, t: (x && +x.t) || 0, tab: x && x.tab },
          )
          .filter((x) => Number.isFinite(x.id))
      : [];
  } catch (_) {
    return [];
  }
}
function libPendSet(l) {
  try {
    if (l.length) localStorage.setItem(LIBDEL_KEY, JSON.stringify(l));
    else localStorage.removeItem(LIBDEL_KEY);
  } catch (_) {}
}
function libPendDrop(id) {
  libPendSet(libPendList().filter((x) => x.id !== id));
}
// the id stays in the list until the stored guide is really gone (a delete that fails is tried again at the next
// start), so a deleted guide is never offered back as a lost one (see Lost guides in boot.js)
function libPurge(id) {
  if (state.saved.some((s) => s.id === id)) {
    libPendDrop(id);
    return;
  }
  IDB.del('guide-' + id)
    .then(function () {
      libPendDrop(id);
    })
    .catch(function () {});
}
function libFinish() {
  const p = libPend;
  if (!p) return;
  libPend = null;
  clearTimeout(p.t);
  if (p.entry.type === 'guide') libPurge(p.entry.id);
}
// Focus moves to the next row's ✕ (the one before when it was the last; the list when it's empty), and back to the
// row on Undo, so the keyboard never drops to the top of the page.
function libDelete(id) {
  const i = state.saved.findIndex((s) => s.id === id);
  if (i < 0) return;
  libFinish();
  const entry = state.saved[i];
  state.saved.splice(i, 1);
  forgetSaved(id);
  if (
    !keep(function () {
      state.saved.splice(i, 0, entry);
      _savedGone.delete(id);
    })
  )
    return;
  if (entry.type === 'guide') {
    libPendSet(
      libPendList()
        .filter((x) => x.id !== id)
        .concat([{ id: id, t: Date.now(), tab: LIB_TAB }]),
    );
    if (window.SF && SF.libChanged) SF.libChanged(id, false);
  }
  const p = { entry: entry, i: i };
  p.t = setTimeout(libFinish, 6000);
  libPend = p;
  const rows = [...savedList.querySelectorAll('.srow')],
    at = rows.findIndex((r) => +r.dataset.id === id);
  renderSaved();
  chrome();
  libFocus(at);
  toastAction(
    'Deleted \u201c' +
      esc(entry.name || (entry.type === 'guide' ? 'Guide' : entry.type === 'draw' ? 'Draw' : 'Palette')) +
      '\u201d',
    'Undo',
    function () {
      if (libPend !== p) return;
      clearTimeout(p.t);
      libPend = null;
      if (!state.saved.some((s) => s.id === entry.id))
        state.saved.splice(Math.min(p.i, state.saved.length), 0, entry);
      _savedGone.delete(entry.id);
      libPendDrop(entry.id);
      save();
      renderSaved();
      chrome();
      if (entry.type === 'guide' && window.SF && SF.libChanged) SF.libChanged(entry.id, true);
      if (savedOverlay.classList.contains('on')) {
        const b = savedList.querySelector('.srow[data-id="' + entry.id + '"] .sdel');
        if (b) b.focus({ preventScroll: true });
      }
    },
    6000,
  );
}
function libFocus(at) {
  if (!savedOverlay.classList.contains('on')) return;
  const rows = savedList.querySelectorAll('.srow'),
    r = rows[Math.min(Math.max(at, 0), rows.length - 1)],
    b = r && r.querySelector('.sdel');
  (b || savedList).focus({ preventScroll: true });
}
setTimeout(function tidy() {
  const mine = (x) => !!LIB_TAB && x.tab === LIB_TAB;
  libPendList().forEach(function (x) {
    if ((!libPend || libPend.entry.id !== x.id) && (mine(x) || Date.now() - x.t > 7000)) libPurge(x.id);
  });
  if (
    libPendList().some(function (x) {
      return !mine(x) && Date.now() - x.t <= 7000;
    })
  )
    setTimeout(tidy, 7500);
}, 1500);
// renaming in place: one edit at a time; _libEd is cleared before the row is redrawn, so the blur that redraw causes is ignored
var _libEd = null;
function libStartRename(id) {
  if (_libEd) libEndRename(true, false);
  var s = state.saved.find(function (x) {
      return x.id === id;
    }),
    row = savedList.querySelector('.srow[data-id="' + id + '"]');
  if (!s || !row) return;
  _libEd = { id: id };
  row.outerHTML = libRowHTML(s, true);
  var inp = savedList.querySelector('.srow[data-id="' + id + '"] .sname-in');
  if (inp) {
    inp.focus();
    try {
      inp.select();
    } catch (e) {}
  }
}
// with storage full the old name comes back (and the storage-full message says why)
function libEndRename(take, refocus) {
  var ed = _libEd;
  if (!ed) return;
  _libEd = null;
  var s = state.saved.find(function (x) {
      return x.id === ed.id;
    }),
    row = savedList.querySelector('.srow[data-id="' + ed.id + '"]'),
    inp = row && row.querySelector('.sname-in'),
    changed = false;
  if (take && s && inp) {
    var v = (inp.value || '').trim().slice(0, 120),
      was = s.name;
    if (v && v !== s.name) {
      s.name = v;
      changed = keep(function () {
        s.name = was;
      });
    }
  }
  if (changed) {
    if (s.type === 'guide' && window.SF && SF.renamed) SF.renamed(s.id, s.name);
    renderRecent();
  }
  if (row && s) {
    if (changed && (libSort === 'name' || (libQuery || '').trim())) renderSaved();
    else row.outerHTML = libRowHTML(s, false);
  }
  if (refocus) {
    var b = savedList.querySelector('.srow[data-id="' + ed.id + '"] .sren');
    if (b) b.focus();
  }
}
// an open guide saved itself: redraw its row (progress, picture) if the Library is showing, and Home's recent guides;
// only the row's name, line and picture change (the list isn't re-sorted under the user, focus stays put), and a row being renamed is left alone
function libRowChanged(id) {
  renderRecent();
  renderLibStat();
  if (!savedOverlay.classList.contains('on') || (_libEd && _libEd.id === id)) return;
  var s = state.saved.find(function (x) {
      return x.id === id;
    }),
    row = savedList.querySelector('.srow[data-id="' + id + '"]');
  if (!s || !row) return;
  var m = row.querySelector('.smeta'),
    nm = row.querySelector('.sname'),
    im = row.querySelector('img.sthumb'),
    t = safeThumb(s.thumb);
  if (m) m.innerHTML = libMeta(s);
  if (nm && s.name) nm.textContent = s.name;
  if (im && t) im.src = t;
}
// guides saved before the Library showed progress get their coloured count from the stored guide, one at a time
var _doneTried = {},
  _doneBusy = false;
function libBackfill() {
  if (_doneBusy) return;
  var g = state.saved.find(function (s) {
    return s.type === 'guide' && typeof s.done !== 'number' && !_doneTried[s.id];
  });
  if (!g) return;
  _doneTried[g.id] = 1;
  _doneBusy = true;
  var id = g.id;
  IDB.get('guide-' + id)
    .then(function (pl) {
      var s = state.saved.find(function (x) {
        return x.id === id;
      });
      if (!pl || !s || typeof s.done === 'number') return;
      var n = +s.n || (pl.assign && typeof pl.assign === 'object' ? Object.keys(pl.assign).length : 0),
        d = Array.isArray(pl.prog) ? pl.prog.length : 0;
      if (!s.n && n) s.n = n;
      s.done = n ? Math.min(d, n) : d;
      save(true);
      var m = savedList.querySelector('.srow[data-id="' + id + '"] .smeta');
      if (m) m.innerHTML = libMeta(s);
    })
    .catch(function () {})
    .then(function () {
      _doneBusy = false;
      libBackfill();
    });
}
function loadSaved(entry) {
  const idxs = entry.keys.map(keyIdx).filter((i) => i != null);
  if (!idxs.length) return;
  closeDialog(savedOverlay);
  disarm();
  unownDisarm();
  state.harmony = 'custom';
  state.mode = 'palette';
  const n = Math.max(2, Math.min(16, idxs.length));
  state.palSize = n;
  state.customPal = idxs.slice(0, n);
  save();
  fullRender();
}
function doSaveDraw() {
  if (!state.drawn.length) return;
  const st = {
    brands: [...state.brands],
    tones: [...state.tones],
    sats: [...state.sats],
    excluded: [...state.excluded],
    pool: state.pool ? state.pool.map(mkey) : null,
  };
  const entry = {
    id: Date.now(),
    type: 'draw',
    name: ('Draw \u00b7 ' + shortDate()).trim(),
    keys: state.drawn.map(mkey),
    ts: Date.now(),
    st: st,
  };
  state.saved.unshift(entry);
  saveNew(entry);
}
function loadDraw(entry) {
  closeDialog(savedOverlay);
  disarm();
  unownDisarm();
  state.mode = 'random';
  const st = entry.st || {};
  if (Array.isArray(st.brands)) state.brands = new Set(st.brands);
  if (Array.isArray(st.tones)) state.tones = new Set(st.tones);
  if (Array.isArray(st.sats)) state.sats = new Set(st.sats);
  if (Array.isArray(st.excluded)) state.excluded = new Set(st.excluded);
  setPool(st.pool ? st.pool.map(keyIdx).filter((i) => i != null) : null);
  state.drawn = entry.keys.map(keyIdx).filter((i) => i != null);
  save();
  fullRender();
}
