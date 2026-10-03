mHome.addEventListener('click', () => setMode('home'));
var _rbk = document.getElementById('rndBack');
if (_rbk)
  _rbk.addEventListener('click', function () {
    setMode('collection');
  });
var _hn = document.getElementById('homeNew');
if (_hn)
  _hn.addEventListener('click', function () {
    // (v288) with guides already made (or one open), straight to the photo picker; Home stays until a photo is chosen. The first
    // time, the Guide screen's card (choose a photo or try the sample, what a guide is).
    // (v289) section edits not built: the Guide screen first, with its question (Build again, Discard edits, Cancel),
    // rather than after a photo is chosen, when Cancel would throw the photo away. Discard edits then opens the photo
    // picker within its tap (iOS opens it only from a tap); Build again builds, and New colouring guide is there after.
    if (window.SF && SF.secEdPending && SF.secEdPending() && SF.edToPlan) {
      setMode('sections');
      SF.edToPlan(true);
      return;
    }
    var some = state.saved.some(function (s) {
      return s.type === 'guide';
    });
    if ((some || (window.SF && SF.hasGuide && SF.hasGuide())) && window.SF && SF.pickPhotoHome) {
      SF.pickPhotoHome(function () {
        setMode('sections');
      });
      return;
    }
    setMode('sections');
    if (window.SF && SF.showHome && !SF.hasGuide()) SF.showHome();
  });
var _hv = document.getElementById('homeView');
if (_hv)
  _hv.addEventListener('click', function (e) {
    if (e.target.closest('#homePalNote [data-clearpal]')) {
      if (window.SF && SF.clearPal) SF.clearPal();
      return;
    }
    var c = e.target.closest('.homecard');
    if (!c) return;
    if (c.id === 'homeLibCard') {
      openLibrary();
    } else if (c.id === 'homeSetup') {
      state.collView = 'unowned';
      setMode('collection');
    } else if (c.dataset.go) {
      setMode(c.dataset.go);
    }
  });
{
  const _bn = $('backupNudge');
  if (_bn)
    _bn.addEventListener('click', function (e) {
      const b = e.target.closest('[data-bk]');
      if (!b) return;
      if (b.dataset.bk === 'go') backupAll('bkGo');
      else {
        // (with the once-only reminder after a first coloured section, v304)
        backupLater();
        homeCardGone(_bn);
      }
    });
}
var _hi = document.getElementById('homeImport'),
  _hif = document.getElementById('homeImpFile');
if (_hi && _hif) {
  _hi.addEventListener('click', function () {
    _hif.click();
  });
  _hif.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) importPicked(f, _hi);
  });
}
mSections.addEventListener('click', () => setMode('sections'));
SF.setCollection(sfCollection());
SF.configure({
  renderFilters: sfRenderFilters,
  saveDesign: sfSaveDesign,
  saveDesignNow: sfSaveDesignNow,
  loadDesign: sfLoadDesign,
  listDesigns: sfListDesigns,
  deleteDesign: sfDeleteDesign,
  refreshSaved: function () {
    renderSaved();
    renderRecent();
  },
  savedChanged: libRowChanged,
  openLibrary: openLibrary,
  listPalettes: function () {
    return state.saved.filter(function (s) {
      return s.type === 'palette';
    });
  },
  // opts goes to the Palette screen's generator as it is ({ mood }: the guide's Mood, a MOOD_KEYS key)
  // (from the guide's own markers: yours that aren't dry, or any with none, in the filters; never the Palette
  // screen's selection, which can hold markers you don't own and outlives the Finder hand-off it came from, v304)
  genPalette: function (n, harm, opts) {
    const sel = state.pool;
    state.pool = null;
    try {
      return (genPalette(n, harm, opts) || []).map(mkey);
    } finally {
      state.pool = sel;
    }
  },
  isDemo: function () {
    return state.owned.size === 0;
  },
  // Brands I'd buy (v304): null for automatic, else the brands ticked
  buyBrands: function () {
    return state.buyBrands ? state.buyBrands.slice() : null;
  },
  goMarkers: function () {
    goMarkers();
  },
  markerInfo: function (k) {
    const i = keyIdx(k);
    return i != null ? { lab: hexToLab(COLORS[i].hex), code: COLORS[i].code, hex: COLORS[i].hex } : null;
  },
  savePalette: function (keys, name) {
    const entry = {
      id: Date.now(),
      type: 'palette',
      name:
        name ||
        paletteName(
          keys.map(keyIdx).filter(function (i) {
            return i != null;
          }),
        ),
      keys: keys,
      ts: Date.now(),
    };
    state.saved.unshift(entry);
    if (!save()) {
      state.saved.shift();
      return null;
    }
    return entry.id;
  },
});

// a screen that can't be drawn mustn't stop the rest of the app starting: the error still reaches the error net
try {
  fullRender();
} catch (e) {
  setTimeout(function () {
    throw e;
  }, 0);
}
document.addEventListener('keydown', function (e) {
  if (
    (e.key === 'Enter' || e.key === ' ') &&
    e.target &&
    e.target.getAttribute &&
    e.target.getAttribute('role') === 'button' &&
    !/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(e.target.tagName)
  ) {
    e.preventDefault();
    e.target.click();
  }
});
(function () {
  var ov = $('welcome');
  if (!ov) return;
  var done = false;
  try {
    done = !!(localStorage.getItem('ms-setup-tip') || localStorage.getItem('ms-onboarded'));
  } catch (e) {
    done = false;
  }
  function markDone() {
    try {
      localStorage.setItem('ms-setup-tip', '1');
      localStorage.setItem('ms-onboarded', '1');
    } catch (e) {}
  }
  if (!done && (state.owned.size || state.saved.length)) {
    done = true;
    markDone();
  }
  var sets = $('wcSets'),
    add = $('wcAdd');
  sets.innerHTML = presetListHTML();
  function upd() {
    var ch = sets.querySelectorAll('input:checked'),
      ks = new Set();
    ch.forEach(function (x) {
      presetMkeys(MARKER_SETS[+x.dataset.i]).forEach(function (k) {
        ks.add(k);
      });
    });
    add.disabled = !ch.length;
    add.textContent = ch.length
      ? 'Add ' + ks.size + ' marker' + (ks.size === 1 ? '' : 's')
      : 'Tick a set above';
  }
  sets.addEventListener('change', upd);
  // Ohuhu / Copic: jump the list to that brand's sets (Copic's are below the fold otherwise), and show which is in view
  var wb = document.querySelector('.wcbrands');
  if (wb) {
    wb.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var h = [].find.call(sets.querySelectorAll('.presetbrand'), function (x) {
        return x.textContent === b.dataset.b;
      });
      if (h) sets.scrollTop = h.offsetTop - sets.offsetTop;
    });
    sets.addEventListener('scroll', function () {
      var cur = 'Ohuhu';
      sets.querySelectorAll('.presetbrand').forEach(function (x) {
        if (x.offsetTop - sets.offsetTop <= sets.scrollTop + 8) cur = x.textContent;
      });
      wb.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.b === cur);
      });
    });
  }
  function step2(msg, title) {
    $('wcT2').textContent = title || 'You\u2019re all set';
    $('wcStep1').style.display = 'none';
    $('wcStep2').style.display = '';
    $('wcDone').textContent = msg;
    var b = $('wcSample');
    if (b) b.focus();
  }
  function close() {
    closeDialog(ov);
    markDone();
  }
  add.addEventListener('click', function () {
    const before = new Set(state.owned);
    sets.querySelectorAll('input:checked').forEach(function (x) {
      presetMkeys(MARKER_SETS[+x.dataset.i]).forEach(function (k) {
        state.owned.add(k);
      });
    });
    if (
      !keep(function () {
        state.owned = before;
      })
    )
      return;
    fullRender();
    step2(
      state.owned.size + ' markers are in your collection. Fine-tune single markers any time in Markers.',
    );
  });
  $('wcSkip').addEventListener('click', function () {
    step2(
      'No problem — add your markers any time from Markers. Until then, guides use the full Ohuhu + Copic range so you can try things out.',
      'Explore with the full range',
    );
  });
  // Restore a backup: the file picker opens in the same tap (an iPhone allows it only then). The welcome stays until a
  // restore worked; a problem is said just above the buttons (pinned to the card's bottom edge) until the next file is
  // chosen (not gone at the next touch, which would move things under the finger). Then Home says what came back. The
  // restore is Back up & restore's.
  const wr = $('wcRestore'),
    wf = $('wcFile'),
    we = $('wcErr');
  const wcErr = function (m) {
    we.innerHTML = m ? '<span>' + ic('triangle-alert', 'icw') + ' ' + m + '</span>' : '';
    we.className = m ? 'mserr' : '';
    we.style.display = m ? '' : 'none';
  };
  wr.addEventListener('click', function () {
    wf.click();
  });
  wf.addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    wcErr('');
    restoreAny(f, 'wcRestore', function (r, why) {
      if (!r) {
        if (why) wcErr(restoreWhy(why));
        return;
      }
      const what = restoredList(r),
        left = guidesLeft(r);
      if (!what) {
        wcErr(left || 'That backup is empty \u2014 there\u2019s nothing in it to restore.');
        return;
      }
      close();
      if (state.mode !== 'home') setMode('home');
      else fullRender();
      // (and what was kept beside the backup's guides, v304)
      const kw = restoreKeptWords(r);
      toast('Restored ' + what + (left ? '. ' + left : kw ? '.' : '') + kw, left || kw ? 7000 : 4000);
    });
  });
  $('wcSample').addEventListener('click', function () {
    close();
    setMode('sections');
    if (SF.loadSample) SF.loadSample();
    if (SF.focusOnOpen) SF.focusOnOpen();
  });
  $('wcPhoto').addEventListener('click', function () {
    close();
    setMode('sections');
    if (SF.pickPhoto) SF.pickPhoto();
  });
  $('wcLook').addEventListener('click', close);
  // (v296) markers bought one at a time: Markers, with Scan or type codes open
  $('wcScan').addEventListener('click', function () {
    close();
    if (state.mode !== 'collection') setMode('collection');
    if (typeof openScan === 'function') openScan();
  });
  if (!done) openDialog(ov);
})();
// The phone's text size can change while the app is in the background (iOS Dynamic Type, Android font size). The
// text follows by itself (src/css/01-base.css); this re-runs the layout code that measures it, as a resize would.
(function () {
  var root = document.documentElement,
    last = getComputedStyle(root).fontSize;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var now = getComputedStyle(root).fontSize;
    if (now !== last) {
      last = now;
      dispatchEvent(new Event('resize'));
    }
  });
})();

// Storage the browser blocks (see STORE_BLOCKED): one banner under the title on every screen, instead of a
// "storage is full" toast at every step
if (STORE_BLOCKED) {
  const h = document.querySelector('.head');
  if (h)
    h.insertAdjacentHTML(
      'beforeend',
      '<div class="msblocked" role="alert"><b>This browser isn\u2019t letting Marker Studio save \u2014 nothing will be kept.</b> <span>Allow this site to store data (or leave private browsing), then reload.</span></div>',
    );
}
// Library › Import a guide: a guide file opens; a backup is offered as a restore; anything else is said once, by the button
function importPicked(f, btn) {
  const fr = new FileReader();
  fr.onload = function () {
    let d = null;
    try {
      d = JSON.parse(fr.result);
    } catch (_) {}
    if (
      d &&
      typeof d === 'object' &&
      (d.type === 'ms-backup' || d.type === 'ms-guides' || Array.isArray(d) || Array.isArray(d.owned))
    ) {
      // (asked in the app's own dialog, v288)
      (window.SF && SF.askBox
        ? SF.askBox(
            'This is a backup',
            'This file is a Marker Studio backup, not a single guide. Restore it?',
            '<button type="button" class="btn-primary" data-a="go">Restore it</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
            true,
          )
        : Promise.resolve(
            confirm('This is a Marker Studio backup, not a single guide. Restore it?') ? 'go' : 'stay',
          )
      ).then(function (a) {
        if (a === 'go') restoreAny(f, btn.id);
      });
      return;
    }
    if (
      d &&
      d.payload &&
      typeof d.payload.lmap === 'string' &&
      /^data:image\/png;base64,[A-Za-z0-9+/=]{16,}$/.test(d.payload.lmap) &&
      window.SF &&
      SF.importFile
    ) {
      closeDialog(savedOverlay);
      SF.importFile(f);
      return;
    }
    errCard(
      btn,
      'That file isn\u2019t a Marker Studio guide. Choose a guide\u2019s <b>.json</b> file, or use <b>Restore</b> for a backup.',
    );
  };
  fr.onerror = function () {
    errCard(btn, 'Couldn\u2019t read that file.');
  };
  fr.readAsText(f);
}

// what LOAD_NOTE held at start (null: nothing to say); cleared when the note is dealt with
let _loadN = null;
try {
  _loadN = JSON.parse(localStorage.getItem(LOAD_NOTE) || 'null');
} catch (e) {}
if (!_loadN || typeof _loadN !== 'object') {
  _loadN = null;
  try {
    localStorage.removeItem(STATE_BK);
  } catch (e) {}
}
// Lost guides: a guide stored on this device ('guide-<id>' in IndexedDB) that no Library entry points to, as when the
// Library's list couldn't be read. Looked for at start (only the store's keys are listed; no guide is read) and from
// Help › Your data › Find lost guides. Home offers them back in a card of its own above the tiles, or inside the note
// about unreadable data when that note is about guides. Never offered: the Resume slot (guide-autosave), a guide whose
// delete is still finishing (LIBDEL_KEY), anything in the Library here or in what another tab last saved, a guide
// made in the last few seconds, one seen in only one of two looks a moment apart (another tab saving or deleting it
// right then), and one that turned out unreadable (LOST_SKIP). Not now hides the card until the next start.
const LOST_WAIT = 1500,
  LOST_SKIP = 'ms-lost-skip';
let _lostIds = [],
  _lostHid = false;
function lostSkip() {
  try {
    const a = JSON.parse(localStorage.getItem(LOST_SKIP) || '[]');
    return Array.isArray(a) ? a.map(Number) : [];
  } catch (e) {
    return [];
  }
}
function lostKnown() {
  const ids = new Set(
    state.saved.map(function (s) {
      return +s.id;
    }),
  );
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && Array.isArray(v.saved))
      v.saved.forEach(function (e) {
        if (e && typeof e === 'object') ids.add(Number(e.id));
      });
  } catch (e) {}
  libPendList().forEach(function (x) {
    ids.add(x.id);
  });
  lostSkip().forEach(function (x) {
    ids.add(x);
  });
  return ids;
}
function lostFilter(ids) {
  const known = lostKnown(),
    now = Date.now();
  return ids.filter(function (id) {
    return !known.has(id) && Math.abs(now - id) > 10000;
  });
}
function lostScan() {
  if (STORE_BLOCKED) return Promise.resolve([]);
  return IDB.keys()
    .then(function (ks) {
      const ids = [];
      ks.forEach(function (k) {
        const m = /^guide-(\d+)$/.exec(String(k));
        if (m) ids.push(+m[1]);
      });
      return lostFilter(ids);
    })
    .catch(function () {
      return [];
    });
}
function findLost() {
  return lostScan().then(function (a) {
    if (!a.length) return a;
    return new Promise(function (r) {
      setTimeout(r, LOST_WAIT);
    })
      .then(lostScan)
      .then(function (b) {
        return a.filter(function (id) {
          return b.indexOf(id) >= 0;
        });
      });
  });
}
function lostNow() {
  return _lostHid ? [] : lostFilter(_lostIds);
}
function lostWord(k) {
  return nWord(k, 'guide') + ' that ' + (k === 1 ? 'isn’t' : 'aren’t') + ' in your Library';
}
// Add them back: a Library entry for each (the name kept in the stored guide, if any, else "Recovered guide",
// "Recovered guide 2"…; size, markers and sections from the guide itself; its picture drawn from it as for restored
// guides), not backed up yet, so the backup reminder counts it. A guide that can't be read is left where it is and not
// offered again. Resolves to what the toast says ('' when storage was full: that has its own message).
function addLost(ids) {
  const added = [],
    bad = [];
  function recName() {
    const used = new Set(
      state.saved.map(function (s) {
        return s.name;
      }),
    );
    for (let k = 1; ; k++) {
      const n = 'Recovered guide' + (k > 1 ? ' ' + k : '');
      if (!used.has(n)) return n;
    }
  }
  function one(id) {
    return IDB.get('guide-' + id)
      .then(function (pl) {
        if (!pl || typeof pl !== 'object' || lostKnown().has(id)) return;
        return Promise.resolve(
          window.SF && SF.checkGuide ? SF.checkGuide(pl) : { ok: typeof pl.lmap === 'string' },
        ).then(function (c) {
          if (!c || !c.ok) {
            bad.push(id);
            return;
          }
          if (lostKnown().has(id)) return;
          const as = pl.assign && typeof pl.assign === 'object' ? pl.assign : {},
            ks = (Array.isArray(pl.keys) ? pl.keys : Object.values(as)).filter(function (k) {
              return typeof k === 'string';
            }),
            n = +pl.n || Object.keys(as).length,
            m = {
              id: id,
              type: 'guide',
              name: typeof pl.name === 'string' && pl.name.trim() ? pl.name.trim().slice(0, 120) : recName(),
              ts: Date.now(),
              keys: [...new Set(ks)].slice(0, COLORS.length),
              W: +c.w || +pl.W || 0,
              H: +c.h || +pl.H || 0,
              n: n,
              thumb: '',
            };
          if (Array.isArray(pl.prog)) m.done = Math.min(pl.prog.length, n || pl.prog.length);
          state.saved.unshift(m);
          added.push(m);
        });
      })
      .catch(function () {});
  }
  return ids
    .reduce(function (p, id) {
      return p.then(function () {
        return one(id);
      });
    }, Promise.resolve())
    .then(function () {
      if (bad.length)
        try {
          localStorage.setItem(LOST_SKIP, JSON.stringify(lostSkip().concat(bad).slice(-200)));
        } catch (e) {}
      if (
        added.length &&
        !keep(function () {
          state.saved = state.saved.filter(function (s) {
            return added.indexOf(s) < 0;
          });
        })
      ) {
        renderHomeNotes();
        return '';
      }
      renderSaved();
      renderRecent();
      renderLibStat();
      renderBackupNudge();
      renderHomeNotes();
      // each one's picture, drawn from the guide (renderRecent starts the first few; this is for the rest)
      added.forEach(function (m) {
        if (window.SF && SF.thumbFor)
          SF.thumbFor(m.id).then(function (t) {
            const s = state.saved.find(function (x) {
              return x.id === m.id;
            });
            if (!t || !s || safeThumb(s.thumb)) return;
            s.thumb = t;
            if (!save(true)) s.thumb = '';
            libRowChanged(m.id);
          });
      });
      const nb = bad.length
        ? nWord(bad.length, 'guide') +
          ' couldn’t be read and ' +
          (bad.length === 1 ? 'was' : 'were') +
          ' left out.'
        : '';
      return added.length
        ? 'Added ' + nWord(added.length, 'guide') + ' back to your Library' + (nb ? '. ' + nb : '')
        : nb ||
            'Nothing to add — ' +
              (ids.length === 1 ? 'that guide is' : 'those guides are') +
              ' back already.';
    });
}
// (v304) look for lost guides again (a restore left one beside the backup's copy) and offer them on Home
function lostRefresh() {
  findLost().then(function (ids) {
    _lostIds = ids;
    _lostHid = false;
    renderHomeNotes();
  });
}
function lostAddTap(b, ids, after) {
  const was = b.textContent;
  b.disabled = true;
  b.textContent = 'Adding…';
  addLost(ids).then(function (msg) {
    b.disabled = false;
    b.textContent = was;
    if (msg) toast(msg, /couldn/.test(msg) ? 7000 : 4000);
    if (after) after(msg);
  });
}

// Saved data that couldn't be read (see noteLoss in state.js): said on Home, above the tiles, with what was lost (the
// counts noteLoss stored), until OK is tapped, the original (kept in STATE_BK) is saved as a file, or a backup is
// restored (offered when the markers, or everything, went). Then the copy is deleted and what could be read is saved,
// so the next start has nothing to say. With no note waiting, a copy left from an older version is deleted.
function lossWords(n) {
  if (n.all || (n.markers === -1 && n.palettes === -1))
    return 'Your saved markers and Library couldn’t be read and were left out.';
  const lib = n.palettes === -1 || n.guides === -1,
    p = [
      n.markers === -1 ? 'your saved markers' : n.markers > 0 ? nWord(n.markers, 'marker') : '',
      lib ? 'your Library' : n.palettes > 0 ? nWord(n.palettes, 'palette') : '',
      !lib && n.guides > 0 ? nWord(n.guides, 'guide') : '',
    ].filter(Boolean);
  if (!p.length) return 'Some saved data couldn’t be read and was left out.';
  const t = p.length > 1 ? p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1] : p[0],
    one = p.length === 1 && (/^1 /.test(t) || t === 'your Library');
  return (
    t.charAt(0).toUpperCase() + t.slice(1) + ' couldn’t be read and ' + (one ? 'was' : 'were') + ' left out.'
  );
}
// k: lost guides found on this device, offered in the same note (Add them back) when what was lost included guides
function loadNoteHTML(n, k) {
  // (no copy, and the original no longer here either (the app was opened again): nothing to download)
  const dl = !n.nocopy || typeof _lossRaw === 'string',
    rs = !!n.all || n.markers === -1,
    only = !n.all && n.guides > 0 && !n.markers && !n.palettes,
    it = k === 1 ? 'it' : 'them',
    head = !k
      ? lossWords(n)
      : only
        ? nWord(n.guides, 'guide') + ' couldn’t be read — found ' + k + ' on this device.'
        : lossWords(n) + ' Found ' + nWord(k, 'guide') + ' stored on this device.';
  return (
    '<div class="ntxt">' +
    head +
    ' <span>' +
    (k ? 'Add ' + it + ' back to your Library. ' : '') +
    (!n.nocopy
      ? 'A copy of the original was kept.'
      : typeof _lossRaw === 'string'
        ? 'There wasn’t room to keep a copy of the original: download it now, before you close the app.'
        : 'There wasn’t room to keep a copy of the original.') +
    (rs ? ' If you have a backup file, restore it.' : '') +
    '</span></div><div class="nrow">' +
    (k
      ? '<button class="nb1" id="lnAdd" data-ln="add">Add ' +
        it +
        ' back</button>' +
        (rs ? '<button id="lnRestore" data-ln="restore">Restore a backup</button>' : '') +
        (dl ? '<button id="lnSave" data-ln="save">Download the original</button>' : '')
      : rs
        ? '<button class="nb1" id="lnRestore" data-ln="restore">Restore a backup</button>' +
          (dl ? '<button id="lnSave" data-ln="save">Download the original</button>' : '')
        : dl
          ? '<button class="nb1" id="lnSave" data-ln="save">Download the original</button>'
          : '') +
    '<button ' +
    (!k && !rs && !dl ? 'class="nb1" ' : '') +
    'id="lnOk" data-ln="ok">OK</button></div>' +
    (rs
      ? '<input type="file" id="lnFile" class="fileinput" accept=".json,.txt,application/json,text/plain">'
      : '')
  );
}
function lostNoteHTML(k) {
  return (
    '<div class="ntxt">Found ' +
    lostWord(k) +
    '. <span>' +
    (k === 1 ? 'It’s' : 'They’re') +
    ' still stored on this device.</span></div><div class="nrow"><button class="nb1" id="lostAdd" data-lost="add">Add ' +
    (k === 1 ? 'it' : 'them') +
    ' back</button><button id="lostLater" data-lost="later">Not now</button></div>'
  );
}
// Draws both notes above the tiles; a note that is unchanged is left alone (with any message shown in it). Focus that
// was on a note that went moves to the other note's first button, or to New colouring guide.
function renderHomeNotes() {
  const el = $('loadNote'),
    ll = $('lostNote');
  if (!el || !ll) return;
  const k = lostNow().length,
    combo = !!_loadN && k > 0 && (!!_loadN.all || !!_loadN.guides),
    fa = document.activeElement,
    had = !!fa && (el.contains(fa) || ll.contains(fa)),
    fid = had ? fa.id : '',
    paint = function (x, h) {
      if (x._h === h) return;
      x._h = h;
      x.innerHTML = h;
      x.style.display = h ? '' : 'none';
    },
    vis = function (b) {
      return b && b.isConnected && b.getClientRects().length ? b : null;
    };
  paint(el, _loadN ? loadNoteHTML(_loadN, combo ? k : 0) : '');
  paint(ll, k && !combo ? lostNoteHTML(k) : '');
  if (had && !vis(fa)) {
    const t =
      vis(fid && $(fid)) ||
      vis(el.querySelector('button')) ||
      vis(ll.querySelector('button')) ||
      homeStartBtn();
    if (t) t.focus({ preventScroll: true });
  }
}
(function () {
  const el = $('loadNote'),
    ll = $('lostNote');
  if (!el || !ll) return;
  // the note is dealt with (OK, Download the original, a restore): the copy goes and what could be read is saved
  function gone() {
    try {
      localStorage.removeItem(LOAD_NOTE);
      localStorage.removeItem(STATE_BK);
    } catch (e) {}
    save(true);
    _loadN = null;
    renderHomeNotes();
  }
  // Restore a backup: like the Welcome's (the file picker opens in the same tap); once something came back the note goes
  el.addEventListener('change', function (e) {
    if (e.target.id !== 'lnFile') return;
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const b = $('lnRestore');
    restoreAny(f, 'lnRestore', function (r, why) {
      if (!r) {
        if (why) errCard(b && b.parentNode, restoreWhy(why));
        return;
      }
      const what = restoredList(r),
        left = guidesLeft(r);
      if (!what) {
        errCard(b && b.parentNode, left || 'That backup is empty — there’s nothing in it to restore.');
        return;
      }
      gone();
      fullRender();
      const kw = restoreKeptWords(r);
      toast('Restored ' + what + (left ? '. ' + left : kw ? '.' : '') + kw, left || kw ? 7000 : 4000);
    });
  });
  el.addEventListener('click', function (e) {
    const b = e.target.closest('[data-ln]');
    if (!b) return;
    if (b.dataset.ln === 'ok') {
      // the lost guides it offered are put away too, until the next start
      if ($('lnAdd')) _lostHid = true;
      gone();
      return;
    }
    if (b.dataset.ln === 'add') {
      lostAddTap(b, lostNow());
      return;
    }
    if (b.dataset.ln === 'restore') {
      const lf = $('lnFile');
      if (lf) lf.click();
      return;
    }
    let raw = null;
    try {
      raw = localStorage.getItem(STATE_BK);
    } catch (_) {}
    // (this time's original first: one from an earlier note can still be in the copy)
    if (typeof _lossRaw === 'string') raw = _lossRaw;
    if (typeof raw !== 'string' || !raw) {
      errCard(b.parentNode, 'The copy couldn’t be read on this device.');
      return;
    }
    // the text exactly as it was: a .json file when it still reads as JSON, otherwise plain text
    let json = true;
    try {
      JSON.parse(raw);
    } catch (_) {
      json = false;
    }
    const d = new Date(),
      day =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0');
    handOver(
      new Blob([raw], { type: json ? 'application/json' : 'text/plain' }),
      'marker-studio-original-' + day + (json ? '.json' : '.txt'),
      { title: 'Marker Studio saved data', retry: false },
    ).then(function (r) {
      if (r === 'share' || r === 'download') {
        gone();
        toast(r === 'share' ? 'Copy saved.' : 'Copy downloaded.');
      } else if (r === false) errCard(b.parentNode, 'The copy couldn’t be saved on this device.');
    });
  });
  ll.addEventListener('click', function (e) {
    const b = e.target.closest('[data-lost]');
    if (!b) return;
    if (b.dataset.lost === 'add') lostAddTap(b, lostNow());
    else {
      _lostHid = true;
      renderHomeNotes();
    }
  });
  renderHomeNotes();
  findLost().then(function (ids) {
    _lostIds = ids;
    renderHomeNotes();
  });
})();
// Help › Your data › Find lost guides: the same look, any time; what it finds is offered on Home too
(function () {
  const hb = $('helpLost'),
    out = $('helpLostRes');
  if (!hb || !out) return;
  hb.addEventListener('click', function () {
    hb.disabled = true;
    out.textContent = 'Looking…';
    findLost().then(function (ids) {
      hb.disabled = false;
      _lostIds = ids;
      _lostHid = false;
      renderHomeNotes();
      const k = lostNow().length;
      out.innerHTML = k
        ? '<p>Found ' +
          lostWord(k) +
          '.</p><button type="button" class="btn-soft" id="helpLostAdd">Add ' +
          (k === 1 ? 'it' : 'them') +
          ' back</button>'
        : '<p>No lost guides found.</p>';
    });
  });
  out.addEventListener('click', function (e) {
    const b = e.target.closest('#helpLostAdd');
    if (!b) return;
    lostAddTap(b, lostNow(), function (msg) {
      if (!msg) return;
      out.innerHTML = '<p>' + esc(msg) + (/[.]$/.test(msg) ? '' : '.') + '</p>';
      hb.focus({ preventScroll: true });
    });
  });
})();
