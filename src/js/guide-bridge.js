/* ===== Section Finder (integrated mode) ===== */
function sfCollection() {
  const demo = state.owned.size === 0,
    out = [];
  for (let i = 0; i < COLORS.length; i++) {
    if (NOINK.has(i) || (!demo && (!isOwned(i) || isDry(i)))) continue;
    const c = COLORS[i];
    out.push({
      mkey: mkey(i),
      code: c.code,
      brand: c.brand,
      hex: c.hex,
      name: c.name,
      hue: HS[i].h,
      lab: hexToLab(c.hex),
      sat: HS[i].s,
      pass: passes(i),
      fam: c.fam,
    });
  }
  return out;
}
/* ---- hybrid storage: metadata in state.saved, heavy label-map in ms-guide-<id> ---- */
const IDB = (function () {
  let dbp = null;
  // a failed or dropped connection is forgotten, so the next save opens a fresh one (iOS can drop it in the background)
  function db() {
    if (dbp) return dbp;
    const p = new Promise(function (res, rej) {
      var r;
      try {
        r = indexedDB.open('ms-guides', 1);
      } catch (e) {
        rej(e);
        return;
      }
      r.onupgradeneeded = function () {
        r.result.createObjectStore('g');
      };
      r.onsuccess = function () {
        const d = r.result;
        d.onclose = function () {
          if (dbp === p) dbp = null;
        };
        d.onversionchange = function () {
          try {
            d.close();
          } catch (_) {}
          if (dbp === p) dbp = null;
        };
        res(d);
      };
      r.onerror = function () {
        rej(r.error);
      };
      r.onblocked = function () {
        rej(new Error('storage is busy'));
      };
    });
    dbp = p;
    p.catch(function () {
      if (dbp === p) dbp = null;
    });
    return p;
  }
  function run(fn) {
    return db()
      .then(fn)
      .catch(function () {
        dbp = null;
        return db().then(fn);
      });
  }
  function put(k, v) {
    return run(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('g', 'readwrite');
        t.objectStore('g').put(v, k);
        t.oncomplete = function () {
          res(true);
        };
        t.onerror = function () {
          rej(t.error);
        };
        t.onabort = function () {
          rej(t.error || new Error('write aborted'));
        };
      });
    });
  }
  // (reads wait while changes kept as the page went away are put into their guide at start: sfLeaveApply)
  let gate = null;
  function get(k) {
    return gate
      ? gate.then(function () {
          return getNow(k);
        })
      : getNow(k);
  }
  function hold(p) {
    const g = Promise.resolve(p).then(
      function () {
        if (gate === g) gate = null;
      },
      function () {
        if (gate === g) gate = null;
      },
    );
    gate = g;
  }
  function getNow(k) {
    return run(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('g', 'readonly'),
          rq = t.objectStore('g').get(k);
        rq.onsuccess = function () {
          res(rq.result);
        };
        rq.onerror = function () {
          rej(rq.error);
        };
      });
    });
  }
  function del(k) {
    return run(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('g', 'readwrite');
        t.objectStore('g').delete(k);
        t.oncomplete = function () {
          res(true);
        };
        t.onerror = function () {
          rej(t.error);
        };
      });
    });
  }
  // every key in the store (cheap: no values are read); [] where the browser can't list them
  function keys() {
    return run(function (d) {
      return new Promise(function (res, rej) {
        var s = d.transaction('g', 'readonly').objectStore('g');
        if (!s.getAllKeys) {
          res([]);
          return;
        }
        var rq = s.getAllKeys();
        rq.onsuccess = function () {
          res(rq.result || []);
        };
        rq.onerror = function () {
          rej(rq.error);
        };
      });
    });
  }
  return { put: put, get: get, getNow: getNow, hold: hold, del: del, keys: keys };
})();
function askPersist() {
  try {
    if (askPersist.done || !(navigator.storage && navigator.storage.persist)) return;
    askPersist.done = 1;
    navigator.storage
      .persisted()
      .then(function (p) {
        if (!p) return navigator.storage.persist();
      })
      .catch(function () {});
  } catch (e) {}
}
const BK_KEY = 'ms-guides-backup-ts',
  BK_SNOOZE = 'ms-backup-snooze',
  BK_SIG = 'ms-backup-sig',
  FIRST_USE = 'ms-first-use';
function lastGuideBackup() {
  try {
    return +localStorage.getItem(BK_KEY) || 0;
  } catch (e) {
    return 0;
  }
}
// a guide is safe when a backup holds its latest version: its own mark (bk) from a backup or a restore, or for
// guides from before that mark existed, the time of the last backup made on this device
function guidesAtRisk() {
  const gs = state.saved.filter((s) => s.type === 'guide'),
    bk = lastGuideBackup();
  return gs.filter((g) => !g.fresh && (g.ts || 0) > (+g.bk || bk)).length;
}
// markers and palettes have no change times of their own, so a backup keeps a fingerprint of them: a different one now means they changed since
function dataSig() {
  const s =
    [...state.owned].sort().join(',') +
    '|' +
    state.saved
      .filter(function (x) {
        return x.type !== 'guide';
      })
      .map(function (x) {
        return x.id + ':' + (x.ts || 0) + ':' + (x.name || '') + ':' + (x.keys || []).join('.');
      })
      .join(',');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return s.length + '-' + (h >>> 0).toString(36);
}
// when there was first something here to lose; saved work from before this was kept counts from when it was made
function firstUse() {
  let t = 0;
  try {
    t = +localStorage.getItem(FIRST_USE) || 0;
  } catch (e) {}
  if (!t && (state.owned.size || state.saved.length)) {
    t = Date.now();
    state.saved.forEach(function (s) {
      const x = +s.ts || +s.id || 0;
      if (x > 0 && x < t) t = x;
    });
    try {
      localStorage.setItem(FIRST_USE, String(t));
    } catch (e) {}
  }
  return t;
}
// The reminder is for anyone with something to lose (markers, palettes or guides) that changed since the last backup,
// when that backup is over two weeks old, or there's never been one and the work is over two weeks old (v289).
function backupDue() {
  const all = state.saved.filter((s) => s.type === 'guide').length,
    // (guides saved as built with nothing coloured don't count: trying a photo isn't work to lose, v285)
    gs = state.saved.filter((s) => s.type === 'guide' && !s.fresh).length,
    pals = state.saved.length - all,
    mk = state.owned.size;
  if (!mk && !state.saved.length) return null;
  const bk = lastGuideBackup(),
    risk = guidesAtRisk(),
    now = Date.now(),
    first = firstUse();
  let sig = null;
  try {
    sig = localStorage.getItem(BK_SIG);
  } catch (e) {}
  const other = !!(mk || pals) && (!bk || sig !== dataSig());
  if (!risk && !other) return null;
  // (v289: 14 days from the first day too, however many guides: not a large card beside Continue on day one)
  if (now - (bk || first) <= 14 * 864e5) return null;
  return { bk: bk, risk: risk, gs: gs, pals: pals, mk: mk };
}
// Home shows at most one card under its tiles, the first that is due of: this reminder, Add to Home Screen (it also
// says to back up first), What's new. Backing up comes first so what's here is safe before anything else is asked;
// once it's done (or put off with Later) the install card takes its turn. This draws all three, so it runs whenever
// Home is drawn or one is put away.
function renderBackupNudge() {
  const el = $('backupNudge');
  let snooze = 0;
  try {
    snooze = +localStorage.getItem(BK_SNOOZE) || 0;
  } catch (e) {}
  const d = el && Date.now() > snooze ? backupDue() : null,
    inst = renderInstallCard(!!d);
  if (el) el.style.display = d ? '' : 'none';
  if (typeof window.renderWhatsNew === 'function') window.renderWhatsNew(!inst && !d);
  if (!d) return;
  const what = [
      d.mk ? nWord(d.mk, 'marker') : '',
      d.pals ? nWord(d.pals, 'palette') : '',
      d.gs ? nWord(d.gs, 'guide') : '',
    ].filter(Boolean),
    list = what.length > 1 ? what.slice(0, -1).join(', ') + ' and ' + what[what.length - 1] : what[0];
  el.innerHTML =
    '<div class="ntxt"><b>Back up your work.</b> <span>' +
    (d.bk
      ? d.risk
        ? d.risk + ' guide' + (d.risk === 1 ? ' has' : 's have') + ' changed since your last backup.'
        : 'Your markers or palettes have changed since your last backup.'
      : 'Your ' +
        list +
        (what.length === 1 && /^1 /.test(list) ? ' is' : ' are') +
        ' only stored on this device.') +
    '</span></div><div class="nrow"><button class="nb1" id="bkGo" data-bk="go">Back up now</button><button data-bk="later">Later</button></div>';
}
// a guide's row in the Library from what is saved (d: as for sfSaveDesign)
function guideMeta(d, id) {
  const _ex = state.saved.find((s) => s.id === id),
    _pl = d.payload || null,
    _secs =
      +d.n ||
      (_pl && _pl.assign && typeof _pl.assign === 'object' ? Object.keys(_pl.assign).length : 0) ||
      (d.keys ? d.keys.length : 0);
  const meta = {
    id: id,
    type: 'guide',
    name:
      d.name ||
      evoName(
        (d.keys || []).map(function (k) {
          var _i = keyIdx(k);
          return _i != null ? COLORS[_i].hex : null;
        }),
        Date.now(),
      ),
    ts: d.keepTs && +d.ts ? +d.ts : Date.now(),
    keys: (d.keys || []).slice(0, COLORS.length),
    W: d.W,
    H: d.H,
    n: _secs,
    thumb: d.thumb || (_ex && _ex.thumb) || '',
  };
  if (_pl && Array.isArray(_pl.prog)) meta.done = Math.min(_pl.prog.length, _secs || _pl.prog.length);
  // (sections part-way coloured, for Home's Continue card; and a guide saved as built with nothing coloured, which
  // the backup reminder leaves out until it changes: v285)
  if (_pl && _pl.tones && typeof _pl.tones === 'object') {
    const _tn = Object.keys(_pl.tones).length;
    if (_tn) meta.tn = _tn;
  }
  if (d.fresh) meta.fresh = 1;
  return meta;
}
// d.mustExist: only update an entry still in the Library (an auto-save never brings back a guide deleted meanwhile);
// d.quiet: the caller tells the user about a failure (no storage-full toast from here)
function sfSaveDesign(d) {
  const id = d.id || Date.now(),
    had = state.saved.some((s) => s.id === id),
    // (the copies kept aside so far: this save, made from the guide as it is now, makes those unneeded, not one
    // kept aside while it was being written, v298)
    leaveAt = _leaveN;
  if (d.mustExist && !had) return Promise.resolve(null);
  if (d.id && !had) libUnpend(id);
  return (
    had
      ? IDB.get('guide-' + id).catch(function () {
          return null;
        })
      : Promise.resolve(null)
  )
    .then(function (prevPl) {
      return IDB.put('guide-' + id, d.payload || {}).then(function () {
        const meta = guideMeta(d, id);
        const ix = state.saved.findIndex((s) => s.id === id),
          prev = ix >= 0 ? state.saved[ix] : null;
        if (ix < 0 && d.mustExist) return null;
        if (ix >= 0) state.saved[ix] = meta;
        else state.saved.unshift(meta);
        if (!save(true)) {
          meta.thumb = '';
          if (save(!!d.quiet)) {
            askPersist();
            return id;
          }
          const j = state.saved.indexOf(meta);
          if (prev) {
            state.saved[j] = prev;
            if (prevPl) IDB.put('guide-' + id, prevPl).catch(function () {});
          } else {
            state.saved.splice(j, 1);
            IDB.del('guide-' + id).catch(function () {});
          }
          return null;
        }
        askPersist();
        leaveDrop(id, leaveAt);
        return id;
      });
    })
    .catch(function () {
      return null;
    });
}
// The page is going away (a reload, the tab closed) or hidden (a phone may stop it) with changes to a Library guide not
// yet stored: the browser drops a database write begun then, so they're kept in localStorage at once (v286), without
// the guide's big pictures (the section map, a photo: each kept as a fingerprint of the stored one). Its Library row
// is left as it is (v287): at the next start sfLeaveApply puts them into the stored guide and only then updates the
// row, if nothing saved the guide since (the row as it was then: base) and the pictures are still the ones stored.
// A save of the guide that lands meanwhile makes them unneeded. Only for a guide already in the Library.
const LEAVE_KEY = 'ms-guide-leave';
// (each copy kept aside is numbered: a save that began before it was made doesn't make it unneeded, v298)
let _leaveN = 0;
function leaveDrop(id, upTo) {
  try {
    const j = JSON.parse(localStorage.getItem(LEAVE_KEY) || 'null');
    if (j && (id == null || j.id === id) && (upTo == null || !(j.seq > upTo)))
      localStorage.removeItem(LEAVE_KEY);
  } catch (_) {}
}
function leaveHash(s) {
  let h = 0,
    g = 7;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = (h * 31 + c) | 0;
    g = (g * 131 + c) | 0;
  }
  return s.length + ':' + h + ':' + g;
}
// strings over 4,000 characters become { __big: fingerprint }
function leaveSlim(v) {
  if (typeof v === 'string') return v.length > 4000 ? { __big: leaveHash(v) } : v;
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(leaveSlim);
  const o = {};
  for (const k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = leaveSlim(v[k]);
  return o;
}
// the slim copy filled back from the stored guide; null when a big picture there isn't the one it was made on
function leaveFill(v, old) {
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.__big === 'string')
    return typeof old === 'string' && leaveHash(old) === v.__big ? old : undefined;
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const a = [];
    for (let i = 0; i < v.length; i++) {
      const x = leaveFill(v[i], old && old[i]);
      if (x === undefined && v[i] !== undefined) return undefined;
      a.push(x);
    }
    return a;
  }
  const o = {};
  for (const k in v) {
    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
    const x = leaveFill(v[k], old && typeof old === 'object' ? old[k] : undefined);
    if (x === undefined && v[k] !== undefined) return undefined;
    o[k] = x;
  }
  return o;
}
function sfSaveDesignNow(d) {
  const e = state.saved.find((s) => s.id === d.id && s.type === 'guide');
  if (!e) return false;
  try {
    localStorage.setItem(
      LEAVE_KEY,
      JSON.stringify({
        id: d.id,
        seq: ++_leaveN,
        base: +e.ts || 0,
        name: d.name,
        W: d.W,
        H: d.H,
        keys: d.keys,
        n: d.n,
        pl: leaveSlim(d.payload || {}),
      }),
    );
    return true;
  } catch (_) {
    leaveDrop(d.id);
    return false;
  }
}
// at start: changes kept as the page went away go into their guide (reads of the store wait meanwhile). Not when the
// row has changed since (another tab saved it), or the stored guide's pictures aren't the ones they were made on.
function sfLeaveApply() {
  let j = null;
  try {
    j = JSON.parse(localStorage.getItem(LEAVE_KEY) || 'null');
  } catch (_) {}
  if (!j) return;
  const done = function () {
    try {
      localStorage.removeItem(LEAVE_KEY);
    } catch (_) {}
  };
  const e = state.saved.find((s) => s.id === j.id && s.type === 'guide');
  if (!e || +e.ts !== +j.base || !j.pl || typeof j.pl !== 'object') {
    done();
    return;
  }
  IDB.hold(
    IDB.getNow('guide-' + j.id)
      .then(function (old) {
        const pl = old && leaveFill(j.pl, old);
        if (!pl || typeof pl.lmap !== 'string') return;
        return IDB.put('guide-' + j.id, pl).then(function () {
          // the row follows (new time: another tab open on it reloads it)
          const ix = state.saved.findIndex((s) => s.id === j.id && s.type === 'guide');
          if (ix < 0) return;
          const was = state.saved[ix];
          state.saved[ix] = guideMeta(
            { name: was.name || j.name, W: j.W, H: j.H, keys: j.keys, n: j.n, payload: pl, thumb: was.thumb },
            j.id,
          );
          save(true);
          if (typeof renderRecent === 'function') renderRecent();
          if (typeof renderSaved === 'function') renderSaved();
        });
      })
      .catch(function () {})
      .then(done),
  );
}
sfLeaveApply();
function sfLoadDesign(id) {
  const meta = state.saved.find((s) => s.id === id && s.type === 'guide');
  if (!meta) return Promise.resolve(null);
  return IDB.get('guide-' + id)
    .then(function (payload) {
      if (!payload) return null;
      return Object.assign({ id: id, name: meta.name, W: meta.W, H: meta.H }, payload);
    })
    .catch(function () {
      return null;
    });
}
function sfListDesigns() {
  return state.saved.filter(function (s) {
    return s.type === 'guide';
  });
}
// the id waits in the Library's list of deletes still to finish (library.js) until the stored guide is gone, so a
// delete that didn't go through is finished at the next start and never offered back as a lost guide
function sfDeleteDesign(id) {
  state.saved = state.saved.filter((s) => s.id !== id);
  forgetSaved(id);
  libPendSet(
    libPendList()
      .filter((x) => x.id !== id)
      .concat([{ id: id, t: 0 }]),
  );
  IDB.del('guide-' + id)
    .then(function () {
      libPendDrop(id);
    })
    .catch(function () {});
  save();
}
function loadGuide(entry) {
  closeDialog(savedOverlay);
  setMode('sections');
  if (window.SF && SF.openDesign) SF.openDesign(entry.id);
}
/* One backup file for everything: markers you own, saved palettes and guides.
   {v:3,type:'ms-backup',ts,owned,saved,guides}. Restoring also accepts the older files: a collection backup
   ({v:2,owned,saved} or a plain list), a guides backup ({type:'ms-guides',guides}) or a single shared guide. */
// the Library's guides, and a new guide not in the Library yet (the one Resume offers), with no id of its own
function gatherGuides() {
  var gs = state.saved.filter(function (s) {
    return s.type === 'guide';
  });
  return Promise.all(
    gs.map(function (s) {
      return IDB.get('guide-' + s.id)
        .then(function (pl) {
          return pl
            ? {
                id: s.id,
                name: s.name,
                W: s.W,
                H: s.H,
                keys: s.keys,
                n: s.n,
                ts: s.ts || 0,
                thumb: s.thumb || '',
                payload: pl,
              }
            : null;
        })
        .catch(function () {
          return null;
        });
    }),
  )
    .then(function (a) {
      return a.filter(Boolean);
    })
    .then(function (a) {
      var m = null;
      try {
        m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
      } catch (e) {}
      if (
        !m ||
        !m.dirty ||
        (m.savedId != null &&
          gs.some(function (s) {
            return s.id === m.savedId;
          }))
      )
        return a;
      return IDB.get('guide-autosave').then(
        function (d) {
          if (d && d.payload && typeof d.payload.lmap === 'string')
            a.push({
              name: typeof d.name === 'string' && d.name ? d.name : 'Colouring guide',
              W: d.W,
              H: d.H,
              keys: Array.isArray(d.keys) ? d.keys : [],
              n: d.n,
              ts: +m.ts || Date.now(),
              thumb: '',
              payload: d.payload,
            });
          return a;
        },
        function () {
          return a;
        },
      );
    });
}
function _btnFlash(id, txt, back, ms) {
  var b = document.getElementById(id);
  if (!b) return;
  b.textContent = txt;
  setTimeout(function () {
    var x = document.getElementById(id);
    if (x) {
      x.textContent = back;
      x.disabled = false;
    }
  }, ms || 1600);
}
// The backup is handed over as any file is (handOver in core.js: the share sheet on a phone, a download on a computer,
// a toast with a Share button when the tap has expired). Cancelling the share sheet is left alone. The backup only
// counts as made once it was shared or downloaded.
// the open guide's last changes are saved first, so the backup has them (and only then counts them as backed up)
function backupAll(btnId) {
  var bid = btnId || 'guidesBackup',
    b0 = document.getElementById(bid),
    label = b0 ? b0.textContent : '';
  if (b0) {
    b0.textContent = 'Preparing…';
    b0.disabled = true;
  }
  return Promise.resolve(window.SF && SF.flushSave ? SF.flushSave() : null)
    .catch(function () {})
    .then(gatherGuides)
    .then(function (guides) {
      var now = Date.now(),
        sig = dataSig(),
        d = new Date(now),
        day =
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0'),
        fname = 'marker-studio-backup-' + day + '.json',
        blob;
      // Home's backup card goes away once its backup is made: then a toast says so, and focus (on the card, or dropped
      // while it was busy) moves to what takes its place
      function made(how) {
        try {
          localStorage.setItem(BK_KEY, String(now));
          localStorage.setItem(BK_SIG, sig);
        } catch (e) {}
        const ids = {};
        guides.forEach(function (g) {
          if (g.id != null) ids[g.id] = g.ts || now;
        });
        state.saved.forEach(function (s) {
          if (s.type !== 'guide') return;
          if (ids[s.id] != null) s.bk = Math.max(ids[s.id], now);
          else if (!+s.bk) s.bk = 1; /* not in this backup (it couldn't be read): still to back up */
        });
        save();
        const bb = document.getElementById(bid),
          card = bb && bb.closest('.nudge'),
          fa = document.activeElement,
          foc = !!card && (!fa || fa === document.body || card.contains(fa));
        renderBackupNudge();
        renderLibStat();
        if (bb && bb.isConnected && bb.getClientRects().length)
          _btnFlash(bid, how === 'share' ? 'Saved ✓' : 'Downloaded ✓', label);
        else {
          _btnFlash(bid, label, label, 10);
          toast('Backed up ✓');
          if (foc) homeCardNext(card);
        }
        var cap = $('backupCap');
        if (cap)
          cap.textContent =
            'Saved your markers, ' +
            nWord(
              state.saved.filter(function (s) {
                return s.type !== 'guide';
              }).length,
              'palette',
            ) +
            ' and ' +
            nWord(guides.length, 'guide') +
            ' ✓';
        return true;
      }
      function failed() {
        _btnFlash(bid, label, label, 10);
        var _b = document.getElementById(bid);
        errCard(
          _b && _b.parentNode,
          'The backup couldn\u2019t be saved on this device. Try again, or copy your markers and palettes as text ' +
            (bid === 'backupDownload'
              ? 'below.'
              : bid === 'guidesBackup'
                ? 'below (<b>Markers &amp; palettes as text</b>).'
                : 'in <b>Library \u203a Markers &amp; palettes as text</b>.'),
        );
        var cap = $('backupCap');
        if (cap) cap.textContent = 'Download was blocked here — try from the installed app.';
        return false;
      }
      try {
        blob = new Blob(
          [
            JSON.stringify({
              v: 3,
              type: 'ms-backup',
              ts: now,
              owned: [...state.owned],
              wish: state.wish,
              ink: state.ink,
              saved: state.saved.filter(function (s) {
                return s.type !== 'guide';
              }),
              guides: guides,
            }),
          ],
          { type: 'application/json' },
        );
      } catch (e) {
        return failed();
      }
      return handOver(blob, fname, {
        title: 'Marker Studio backup',
        what: 'backup',
        onWait: function () {
          _btnFlash(bid, label, label, 10);
        },
      }).then(function (how) {
        if (how === 'cancel') {
          _btnFlash(bid, label, label, 10);
          return false;
        }
        return how ? made(how) : failed();
      });
    })
    .catch(function () {
      _btnFlash(bid, label, label, 10);
      var _b = document.getElementById(bid);
      errCard(_b && _b.parentNode, 'The backup couldn\u2019t be saved on this device. Try again.');
      return false;
    });
}
// markers and palettes from a backup. Markers are replaced, asking first when they differ and there are markers here
// (the To buy list and ink go with them; with the same markers the lists merge); a backup with no markers (made before
// any were added) leaves them alone and asks nothing. Palettes are always merged, like guides: the backup's are added,
// and one here with the same id is kept as it is. Returns null for a file with no markers list, {failed:true} when
// storage is full (everything is put back as it was, and nothing counts as backed up), else {mk: the backup's markers
// are now the ones here, pals: palettes added}. Once everything here (markers and palettes) is in the file, the markers
// and palettes count as backed up, and the device as of the file's time (fts) unless it has guides of its own no backup
// holds, so the reminder doesn't ask to back up what was just restored.
function nWord(n, w) {
  return n + ' ' + w + (n === 1 ? '' : 's');
}
function markRestored(fts) {
  try {
    localStorage.setItem(BK_SIG, dataSig());
    if (
      +fts > lastGuideBackup() &&
      !state.saved.some(function (s) {
        return s.type === 'guide' && !s.bk;
      })
    )
      localStorage.setItem(BK_KEY, String(+fts));
  } catch (e) {}
  renderBackupNudge();
  renderLibStat();
}
const RESTORE_FULL =
  'Couldn\u2019t restore \u2014 this browser\u2019s storage is full, so nothing was changed. Delete a few guides from the Library, then try again.';
// whether a backup's markers would replace yours, asked first in the app's own dialog (v288): resolves true (replace)
// or false (keep yours), or null for Cancel (v289: Escape and the backdrop too), when nothing is restored. Nothing to
// ask when they're the same, when the backup has none (yours are kept) or you have none (theirs come in).
function askReplaceMarkers(o) {
  const arr = Array.isArray(o) ? o : o && Array.isArray(o.owned) ? o.owned : null;
  if (!arr) return Promise.resolve(false);
  const own = new Set(arr.map(knownMkey).filter(Boolean));
  const same = own.size === state.owned.size && [...own].every((k) => state.owned.has(k));
  if (same || !own.size) return Promise.resolve(!own.size ? false : true);
  if (!state.owned.size) return Promise.resolve(true);
  const ask =
    window.SF && SF.askBox
      ? SF.askBox(
          'Replace your markers?',
          'The backup has ' +
            nWord(own.size, 'marker') +
            '; you have ' +
            nWord(state.owned.size, 'marker') +
            '. Either way, the backup\u2019s palettes and guides are added.',
          '<button type="button" class="btn-primary" data-a="replace">Replace my markers</button><button type="button" data-a="keep">Keep mine</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
          true,
        )
      : Promise.resolve(
          confirm(
            'Replace your ' +
              nWord(state.owned.size, 'marker') +
              ' with the backup\u2019s ' +
              nWord(own.size, 'marker') +
              '?\n\nOK replaces them; Cancel keeps yours. Either way, the backup\u2019s palettes and guides are added.',
          )
            ? 'replace'
            : 'keep',
        );
  // (Cancel, Escape or the backdrop: nothing restored)
  return ask.then(function (a) {
    return a === 'replace' ? true : a === 'keep' ? false : null;
  });
}
// replace: the answer from askReplaceMarkers
function applyCollectionBackup(o, fts, replace) {
  const arr = Array.isArray(o) ? o : o && Array.isArray(o.owned) ? o.owned : null;
  if (!arr) return null;
  const own = new Set(arr.map(knownMkey).filter(Boolean));
  const pals =
    o && Array.isArray(o.saved)
      ? o.saved
          .filter(function (s) {
            return s && s.type !== 'guide';
          })
          .map(cleanSaved)
          .filter(Boolean)
      : [];
  const was = {
      owned: new Set(state.owned),
      saved: state.saved.slice(),
      wish: state.wish.slice(),
      ink: Object.assign({}, state.ink),
    },
    back = function () {
      state.owned = was.owned;
      state.saved = was.saved;
      state.wish = was.wish;
      state.ink = was.ink;
      if (savedOverlay.classList.contains('on')) renderSaved();
      return { failed: true };
    };
  const same = own.size === state.owned.size && [...own].every((k) => state.owned.has(k));
  if (!same && (!own.size || (state.owned.size && !replace))) {
    const n = mergeBackupPals(pals);
    if (n) {
      if (!save(true)) return back();
      fullRender();
    }
    return { mk: false, pals: n };
  }
  if (!same) state.owned = own;
  wishRestore(o, !same);
  const n = mergeBackupPals(pals);
  if (!save(true)) return back();
  wishChanged();
  // what's here is all in the file when every palette here has its twin there
  const pk = function (x) {
      return x.id + ':' + (x.ts || 0) + ':' + (x.name || '') + ':' + (x.keys || []).join('.');
    },
    inFile = new Set(pals.map(pk));
  if (
    state.saved.every(function (s) {
      return s.type === 'guide' || inFile.has(pk(s));
    })
  )
    markRestored(fts);
  if (!same || n) fullRender();
  return { mk: true, pals: n };
}
// a backup's palettes that aren't here (by id) are added; returns how many
function mergeBackupPals(pals) {
  const have = new Set(
    state.saved.map(function (s) {
      return s.id;
    }),
  );
  let n = 0;
  pals.forEach(function (p) {
    if (have.has(p.id)) return;
    have.add(p.id);
    state.saved.push(p);
    n++;
  });
  if (n && typeof savedOverlay !== 'undefined' && savedOverlay.classList.contains('on')) renderSaved();
  return n;
}
// what a restore of markers and palettes did, for the toast
function restoredWords(r) {
  if (!r || r.failed) return '';
  const p = r.pals ? nWord(r.pals, 'palette') + ' added.' : '';
  return r.mk
    ? 'Restored \u2014 ' + nWord(state.owned.size, 'marker') + '.' + (p ? ' ' + p : '')
    : p
      ? (state.owned.size ? 'Kept your markers; ' : '') + p
      : '';
}
// why a restore brought nothing back (restoreAny's done), in words
function restoreWhy(why) {
  return why === 'read'
    ? 'Couldn\u2019t read that file.'
    : why === 'full'
      ? RESTORE_FULL
      : 'That file isn\u2019t a Marker Studio backup. Choose the <b>.json</b> file saved by <b>Back up</b>.';
}
// guides a restore didn't add ({dup, bad, full} from restoreGuideList), in words: "1 guide was already here; 1 guide
// couldn't be read." ('' when there are none)
function guidesLeft(x) {
  if (!x) return '';
  const p = [];
  if (x.dup) p.push(x.dup === 1 ? '1 guide was already here' : x.dup + ' guides were already here');
  if (x.bad) p.push(nWord(x.bad, 'guide') + ' couldn\u2019t be read');
  if (x.full)
    p.push(nWord(x.full, 'guide') + ' couldn\u2019t be saved \u2014 this browser\u2019s storage is full');
  if (!p.length) return '';
  const s = p.join('; ') + '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// what a restore with guides did, for the Back up & restore dialog: "Markers restored, 1 palette added; 2 guides
// restored.", then what wasn't added (guidesLeft)
function guideRestoreWords(col, ok, x) {
  const a =
      col && col.mk
        ? 'Markers restored' + (col.pals ? ', ' + nWord(col.pals, 'palette') + ' added' : '')
        : col && col.pals
          ? nWord(col.pals, 'palette') + ' added'
          : '',
    h = [a, ok ? nWord(ok, 'guide') + ' restored' : ''].filter(Boolean).join('; '),
    t = guidesLeft(x);
  return (h ? h + '.' : '') + (h && t ? ' ' : '') + t;
}
// what came back from a restore ({markers,palettes,guides}), for Welcome's and Home's toast: "2 palettes and 1 guide"
// (guides it didn't add: guidesLeft(r))
function restoredList(r) {
  const w = [
    r.markers ? nWord(r.markers, 'marker') : '',
    r.palettes ? nWord(r.palettes, 'palette') : '',
    r.guides ? nWord(r.guides, 'guide') : '',
  ].filter(Boolean);
  return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0] || '';
}
// done (optional): called with what came back ({markers,palettes,guides}, and guides not added: {dup,bad,full}), or null
// and why ('bad': not a backup, 'read': unreadable, 'full': storage full, nothing changed; nothing when nothing came
// back). The caller then says it, instead of the toast and card here.
function restoreAny(file, btnId, done) {
  var bid = btnId || 'guidesRestore',
    b0 = document.getElementById(bid),
    label = b0 ? b0.textContent : 'Restore a backup',
    cap = $('backupCap');
  var fr = new FileReader();
  fr.onload = function () {
    var d = null;
    try {
      d = JSON.parse(fr.result);
    } catch (e) {}
    var bad = function () {
      _btnFlash(bid, label, label, 10);
      if (done) {
        done(null, 'bad');
        return;
      }
      var b = document.getElementById(bid);
      errCard(
        b && b.parentNode,
        'That file isn\u2019t a Marker Studio backup. Choose the <b>.json</b> file saved by <b>Back up</b>.',
      );
    };
    if (!d) {
      bad();
      return;
    }
    var guides = null,
      collection = false,
      fts = +d.ts || 0;
    if (d.type === 'ms-backup') {
      collection = true;
      guides = Array.isArray(d.guides) ? d.guides : [];
    } else if (d.type === 'ms-guides' && Array.isArray(d.guides)) guides = d.guides;
    else if (d.payload && d.payload.lmap) guides = [d];
    else if (Array.isArray(d) || Array.isArray(d.owned)) collection = true;
    else {
      bad();
      return;
    }
    (collection ? askReplaceMarkers(d) : Promise.resolve(false)).then(function (rep) {
      if (rep === null) {
        _btnFlash(bid, label, label, 10);
        if (cap) cap.textContent = 'Nothing restored.';
        if (done) done(null);
        else toast('Nothing restored.');
        return;
      }
      restoreGo(d, fts, guides, collection, rep, bid, label, cap, done);
    });
  };
  fr.onerror = function () {
    if (cap) cap.textContent = 'Couldn’t read that file.';
    if (done) done(null, 'read');
  };
  fr.readAsText(file);
}
// restoreAny once the question about markers (if any) is answered
function restoreGo(d, fts, guides, collection, rep, bid, label, cap, done) {
  {
    var col = collection ? applyCollectionBackup(d, fts, rep) : null,
      any = !!(col && (col.mk || col.pals));
    if (col && col.failed) {
      _btnFlash(bid, label, label, 10);
      if (cap) cap.textContent = '';
      if (done) {
        done(null, 'full');
        return;
      }
      var fb = document.getElementById(bid);
      errCard(fb && fb.parentNode, RESTORE_FULL);
      return;
    }
    var got = function (g, x) {
      x = x || {};
      return {
        markers: col && col.mk ? state.owned.size : 0,
        palettes: col ? col.pals || 0 : 0,
        guides: g,
        dup: x.dup || 0,
        bad: x.bad || 0,
        full: x.full || 0,
      };
    };
    if (!guides || !guides.length) {
      if (collection) {
        var said = restoredWords(col);
        _btnFlash(bid, col && col.mk ? 'Restored ✓' : 'Kept yours', label);
        if (cap) cap.textContent = said || 'Nothing changed.';
        if (said && !done) toast(said);
      }
      if (done) done(any ? got(0) : null);
      return;
    }
    // guides already here aren't counted as restored; ones storage had no room for are said as a failure, by the button
    restoreGuideList(guides, fts, function (ok, copies, x) {
      x = x || {};
      _btnFlash(
        bid,
        ok ? 'Restored ' + ok + ' ✓' : x.dup && !x.bad && !x.full ? 'Already here' : label,
        label,
        1800,
      );
      var msg = guideRestoreWords(col, ok, x);
      if (cap) cap.textContent = msg;
      if (done) {
        done(any || ok || x.dup || x.bad || x.full ? got(ok, x) : null);
        return;
      }
      if (x.openRep)
        msg += ' \u201c' + esc(x.openRep) + '\u201d was replaced by the backup\u2019s newer copy.';
      msg += copies
        ? ' ' +
          copies +
          ' guide' +
          (copies > 1 ? 's were' : ' was') +
          ' newer here, so ' +
          (copies > 1 ? 'they were' : 'it was') +
          ' kept and the backup’s version added as “(from backup)”.'
        : '';
      if (x.full) {
        var fb = document.getElementById(bid);
        errCard(fb && fb.parentNode, msg + ' Delete a few guides from the Library, then restore again.');
        return;
      }
      toast(msg, copies || x.bad ? 7000 : 3500);
    });
  }
}
function _newGuideId() {
  let id = Date.now();
  while (
    state.saved.some(function (s) {
      return s.id === id;
    })
  )
    id++;
  return id;
}
// add guides from a backup; a guide that is newer here is kept and the backup's copy added as "(from backup)". A guide
// already here just as it is in the backup isn't added again: the same entry, a copy from restoring it before, or (a
// guide with no id: a single guide file, or the new guide a backup took along) any guide of the same size. Each guide is
// first checked as an imported guide file is (SF.checkGuide), and one that fails is skipped. The open guide's changes
// are saved first; if the backup replaces it, it reopens as restored. done(ok, copies, {dup, bad, full}): the guides
// added or replaced, how many of those were added as "(from backup)" copies, and those already here, those unreadable
// and those that couldn't be saved (storage full).
function restoreGuideList(guides, _fts, done) {
  var open = window.SF && SF.guideBrief ? SF.guideBrief() : null,
    openRep = '',
    i = 0,
    ok = 0,
    copies = 0,
    dup = 0,
    bad = 0,
    full = 0;
  function same(js, lm, ids) {
    var k = 0;
    function step() {
      if (k >= ids.length) return Promise.resolve(false);
      var id = ids[k++];
      return IDB.get('guide-' + id).then(function (p) {
        return p && p.lmap === lm && JSON.stringify(p) === js ? true : step();
      }, step);
    }
    return step();
  }
  function check(pl) {
    return window.SF && SF.checkGuide
      ? Promise.resolve(SF.checkGuide(pl)).catch(function () {
          return { ok: false };
        })
      : Promise.resolve({ ok: !!(pl && typeof pl.lmap === 'string') });
  }
  function next() {
    if (i >= guides.length) {
      if (ok) {
        save();
        renderBackupNudge();
      }
      renderSaved();
      renderRecent();
      if (done) done(ok, copies, { dup: dup, bad: bad, full: full, openRep: openRep });
      return;
    }
    var g = guides[i++];
    if (g && !+g.ts && _fts) g.ts = _fts;
    if (!(g && g.payload && typeof g.payload === 'object')) {
      bad++;
      next();
      return;
    }
    check(g.payload).then(function (c) {
      if (!c || !c.ok) {
        bad++;
        next();
        return;
      }
      var W0 = +c.w || +g.W || 0,
        H0 = +c.h || +g.H || 0;
      var _gid = Number(g.id);
      _gid = Number.isFinite(_gid) && _gid > 0 ? _gid : 0;
      if (
        _gid &&
        state.saved.some(function (s) {
          return s.id === _gid && s.type !== 'guide';
        })
      )
        _gid = _newGuideId();
      var _nm = typeof g.name === 'string' ? g.name.slice(0, 120) : '',
        _ex = _gid
          ? state.saved.find(function (s) {
              return s.id === _gid && s.type === 'guide';
            })
          : null,
        _cn = (_nm || 'Guide') + ' (from backup)',
        js = '';
      try {
        js = JSON.stringify(g.payload);
      } catch (e) {}
      var cand = (_ex ? [_ex.id] : []).concat(
        state.saved
          .filter(function (s) {
            return (
              s.type === 'guide' &&
              (!_ex || s.id !== _ex.id) &&
              (s.name === _cn || (!_gid && +s.W === W0 && +s.H === H0))
            );
          })
          .map(function (s) {
            return s.id;
          }),
      );
      same(js, g.payload.lmap, cand).then(function (isDup) {
        if (isDup) {
          dup++;
          next();
          return;
        }
        var copy = false;
        if (_ex && (+_ex.ts || 0) > (+g.ts || 0)) {
          _gid = _newGuideId();
          _nm = _cn;
          copy = true;
        } else if (!_gid) _gid = _newGuideId();
        Promise.resolve(
          sfSaveDesign({
            id: _gid,
            name: _nm,
            W: W0,
            H: H0,
            keys: Array.isArray(g.keys)
              ? g.keys.filter(function (k) {
                  return typeof k === 'string';
                })
              : [],
            n: +g.n || 0,
            thumb: safeThumb(g.thumb),
            payload: g.payload,
            ts: +g.ts || 0,
            keepTs: true,
            quiet: true,
          }),
        )
          .catch(function () {
            return null;
          })
          .then(function (id) {
            if (!id) {
              full++;
              next();
              return;
            }
            ok++;
            if (copy) copies++;
            // (the guide open on the Guide screen, replaced by the backup's newer copy: said in the summary, v289)
            else if (_ex && open && open.id === id) openRep = _ex.name || open.name;
            const m = state.saved.find(function (x) {
              return x.id === id;
            });
            if (m) m.bk = m.ts || 1;
            // (also a guide deleted while open, restored with the same id: the open copy becomes the restored one, v289;
            // libChanged leaves any other guide alone)
            if (window.SF && SF.libChanged) SF.libChanged(id, 'replaced');
            next();
          });
      });
    });
  }
  Promise.resolve(window.SF && SF.flushSave ? SF.flushSave() : null)
    .catch(function () {})
    .then(next);
}
function chipBrands(el, po) {
  if (!el) return;
  el.innerHTML = BRAND_DEFS.map((bd) => {
    let cnt = 0;
    for (let i = 0; i < COLORS.length; i++) {
      if (COLORS[i].brand !== bd.k || state.excluded.has(COLORS[i].fam) || !inTone(i) || !inSat(i) || !po(i))
        continue;
      cnt++;
    }
    return (
      '<button class="chip" data-brand="' +
      bd.k +
      '" data-sel="' +
      (fgSel('brand', bd.k) ? 1 : 0) +
      '" data-empty="' +
      (cnt ? 0 : 1) +
      '" aria-pressed="' +
      (fgSel('brand', bd.k) ? 1 : 0) +
      '">' +
      bd.t +
      ' <span class="rem">' +
      cnt +
      '</span></button>'
    );
  }).join('');
}
function chipFams(el, po) {
  if (!el) return;
  el.innerHTML = families
    .map((f) => {
      let cnt = 0;
      for (const i of f.idxs) if (inTone(i) && inSat(i) && inBrand(i) && po(i)) cnt++;
      const glow = ';box-shadow:0 0 9px ' + rgba(f.repHex, 0.6);
      return (
        '<button class="chip" data-fam="' +
        f.name +
        '" data-sel="' +
        (fgSel('fam', f.name) ? 1 : 0) +
        '" data-empty="' +
        (cnt ? 0 : 1) +
        '" aria-pressed="' +
        (fgSel('fam', f.name) ? 1 : 0) +
        '"><span class="dot" style="background:' +
        f.repHex +
        glow +
        '"></span>' +
        f.name +
        ' <span class="rem">' +
        cnt +
        '</span></button>'
      );
    })
    .join('');
}
function chipTones(el, po) {
  if (!el) return;
  el.innerHTML = TONE_DEFS.map((td) => {
    let cnt = 0;
    for (let i = 0; i < COLORS.length; i++) {
      if (TONE[i] !== td.k || state.excluded.has(COLORS[i].fam) || !inSat(i) || !inBrand(i) || !po(i))
        continue;
      cnt++;
    }
    return (
      '<button class="chip" data-tone="' +
      td.k +
      '" data-sel="' +
      (fgSel('tone', td.k) ? 1 : 0) +
      '" data-empty="' +
      (cnt ? 0 : 1) +
      '" aria-pressed="' +
      (fgSel('tone', td.k) ? 1 : 0) +
      '"><span class="dot" style="background:' +
      td.d +
      ';box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)"></span>' +
      td.t +
      ' <span class="rem">' +
      cnt +
      '</span></button>'
    );
  }).join('');
}
function chipSats(el, po) {
  if (!el) return;
  el.innerHTML = SAT_DEFS.map((sd) => {
    let cnt = 0;
    for (let i = 0; i < COLORS.length; i++) {
      if (SAT[i] !== sd.k || state.excluded.has(COLORS[i].fam) || !inTone(i) || !inBrand(i) || !po(i))
        continue;
      cnt++;
    }
    return (
      '<button class="chip" data-sat="' +
      sd.k +
      '" data-sel="' +
      (fgSel('sat', sd.k) ? 1 : 0) +
      '" data-empty="' +
      (cnt ? 0 : 1) +
      '" aria-pressed="' +
      (fgSel('sat', sd.k) ? 1 : 0) +
      '"><span class="dot" style="background:' +
      sd.d +
      '"></span>' +
      sd.t +
      ' <span class="rem">' +
      cnt +
      '</span></button>'
    );
  }).join('');
}
function sfAfterFilter() {
  save();
  SF.setCollection(sfCollection());
  SF.reassign();
}
function sfRenderFilters(el) {
  if (!el) return;
  const po = state.owned.size
    ? isOwned
    : function () {
        return true;
      };
  fgNormalize();
  const clr = (g, q) =>
    '<button data-q="' + q + '"' + (fgIsAll(g) ? ' style="visibility:hidden"' : '') + '>Clear</button>';
  el.innerHTML =
    '<div class="fhint">Tap to show only those markers; tap more to add. Nothing chosen = all.</div><div class="fam-head"><span class="lbl">Brand</span><span class="quick">' +
    clr('brand', 'brandAll') +
    '</span></div><div class="fams" id="sf_brands"></div><div class="fam-head"><span class="lbl">Tone</span><span class="quick">' +
    clr('tone', 'toneAll') +
    '</span></div><div class="fams" id="sf_tones"></div><div class="fam-head"><span class="lbl">Saturation</span><span class="quick">' +
    clr('sat', 'satAll') +
    '</span></div><div class="fams" id="sf_sats"></div><div class="fam-head"><span class="lbl">Families</span><span class="quick"><button data-q="famWarm">Warm only</button><button data-q="famCool">Cool only</button>' +
    clr('fam', 'all') +
    '</span></div><div class="fams" id="sf_fams"></div>';
  chipBrands(el.querySelector('#sf_brands'), po);
  chipTones(el.querySelector('#sf_tones'), po);
  chipSats(el.querySelector('#sf_sats'), po);
  chipFams(el.querySelector('#sf_fams'), po);
  const tap = (id, g, attr) =>
    el.querySelector(id).addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      fgTap(g, b.dataset[attr]);
      sfAfterFilter();
    });
  tap('#sf_brands', 'brand', 'brand');
  tap('#sf_tones', 'tone', 'tone');
  tap('#sf_sats', 'sat', 'sat');
  tap('#sf_fams', 'fam', 'fam');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    const q = b.dataset.q;
    if (q === 'brandAll') fgClear('brand');
    else if (q === 'toneAll') fgClear('tone');
    else if (q === 'satAll') fgClear('sat');
    else if (q === 'famWarm')
      state.excluded = new Set(families.filter((f) => !WARM_FAMS.has(f.name)).map((f) => f.name));
    else if (q === 'famCool')
      state.excluded = new Set(families.filter((f) => !COOL_FAMS.has(f.name)).map((f) => f.name));
    else if (q === 'all') fgClear('fam');
    else return;
    sfAfterFilter();
  });
}
