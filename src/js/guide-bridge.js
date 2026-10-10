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
// (v307) the browser's answer is kept (PERSIST_KEY: '1' kept, '0' may be cleared) for Help › Your data
const PERSIST_KEY = 'ms-persisted';
function notePersist(p) {
  try {
    localStorage.setItem(PERSIST_KEY, p ? '1' : '0');
  } catch (e) {}
  return p;
}
function askPersist() {
  try {
    if (askPersist.done || !(navigator.storage && navigator.storage.persist)) return;
    askPersist.done = 1;
    navigator.storage
      .persisted()
      .then(function (p) {
        return p || navigator.storage.persist();
      })
      .then(notePersist)
      .catch(function () {});
  } catch (e) {}
}
// (v307) Help › Your data's line on whether this device keeps your data: the answer the browser gave askPersist (or
// gives now, if it was asked); with no answer, or none to be had (Safari's engine without navigator.storage), the
// cautious line. `put(text)` gets the words, at once and again if the browser's answer changes them.
function keepWords(put) {
  const ua = navigator.userAgent || '',
    who =
      (/Safari/.test(ua) || /iPhone|iPad/.test(ua)) &&
      !/Chrome|Chromium|Android|CriOS|FxiOS|EdgiOS|Firefox/.test(ua)
        ? 'Safari'
        : 'Your browser',
    say = function (p) {
      put(
        p
          ? who + ' has agreed to keep your data on this device.'
          : who +
              ' may clear your data if space runs low or you don’t open the app for a while, so keep a backup.',
      );
    };
  let kept = false;
  try {
    kept = localStorage.getItem(PERSIST_KEY) === '1';
  } catch (e) {}
  say(kept);
  try {
    if (navigator.storage && navigator.storage.persisted)
      navigator.storage
        .persisted()
        .then(function (p) {
          // (only a request answers it the first time: don't note a "no" the app hasn't asked about)
          if (p || localStorage.getItem(PERSIST_KEY) != null) notePersist(p);
          if (!!p !== kept) say(p);
        })
        .catch(function () {});
  } catch (e) {}
}
const BK_KEY = 'ms-guides-backup-ts',
  BK_SNOOZE = 'ms-backup-snooze',
  BK_SIG = 'ms-backup-sig',
  FIRST_USE = 'ms-first-use',
  // (v304) the Library guides the last backup couldn't read; the once-only reminder after a first coloured section has
  // been put away; when this device last opened the app
  BK_MISS = 'ms-backup-missed',
  BK_FIRST = 'ms-backup-first',
  LAST_VISIT = 'ms-last-visit';
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
// (v304) Safari, in a tab (not the Home Screen app), deletes a website's saved work after about seven days of using
// Safari without opening it: a visit resets that, so the app's own age is the wrong clock there. In such a tab, with
// guides coloured or palettes to lose (not markers only), it's also due the first time Home shows after a guide's first
// coloured section (once, until backed up or put away), and on a visit after five days or more away (the next gap may
// pass a week). And a guide the last backup couldn't read makes it due at once, anywhere. why: 'missed', 'age',
// 'first' or 'gap'.
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
    first = firstUse(),
    d = { bk: bk, risk: risk, gs: gs, pals: pals, mk: mk };
  const miss = backupMissed();
  if (miss) return Object.assign(d, { why: 'missed', miss: miss });
  let sig = null;
  try {
    sig = localStorage.getItem(BK_SIG);
  } catch (e) {}
  const palsNew = !!pals && (!bk || sig !== dataSig()),
    other = !!(mk || pals) && (!bk || sig !== dataSig());
  if (!risk && !other) return null;
  // (v289: 14 days from the first day too, however many guides: not a large card beside Continue on day one)
  if (now - (bk || first) > 14 * 864e5) return Object.assign(d, { why: 'age' });
  if (!webkitTab() || !(risk || palsNew)) return null;
  let once = false;
  try {
    once = !!localStorage.getItem(BK_FIRST);
  } catch (e) {}
  if (
    !bk &&
    !once &&
    state.saved.some(function (s) {
      return s.type === 'guide' && (+s.done > 0 || +s.tn > 0);
    })
  )
    return Object.assign(d, { why: 'first' });
  if (_visitGap >= 5 * 864e5) return Object.assign(d, { why: 'gap' });
  return null;
}
// (v304) how many Library guides the last backup couldn't read (still here)
function backupMissed() {
  let ids = [];
  try {
    ids = JSON.parse(localStorage.getItem(BK_MISS) || '[]');
  } catch (e) {}
  if (!Array.isArray(ids) || !ids.length) return 0;
  return state.saved.filter(function (s) {
    return s.type === 'guide' && ids.indexOf(s.id) >= 0;
  }).length;
}
// (v304) a browser tab where Safari's seven-day rule applies: any browser on an iPhone or iPad, or Safari on a Mac, and
// not opened from the Home Screen (or the Dock)
function webkitTab() {
  if (isStandalone()) return false;
  const ua = navigator.userAgent || '';
  return (
    isIOSDevice() ||
    (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua))
  );
}
// (v304) the time since the last visit before this one (the longest seen this session): a visit is the app opened or
// brought back into view
let _visitGap = 0;
function noteVisit(away) {
  try {
    const now = Date.now(),
      t = +localStorage.getItem(LAST_VISIT) || 0;
    if (!away && t && now - t > _visitGap) _visitGap = now - t;
    localStorage.setItem(LAST_VISIT, String(now));
  } catch (e) {}
}
noteVisit();
document.addEventListener('visibilitychange', function () {
  noteVisit(document.visibilityState !== 'visible');
});
// Later on the reminder (or Not now on the card it shares with Add to Home Screen): a week's rest, and the once-only
// reminder after a first coloured section is done with (v304)
function backupLater() {
  try {
    localStorage.setItem(BK_SNOOZE, String(Date.now() + 7 * 864e5));
    localStorage.setItem(BK_FIRST, '1');
  } catch (e) {}
}
// (v304) Safari's seven-day rule, in words
function safariWords() {
  const ua = navigator.userAgent || '';
  return /CriOS|FxiOS|EdgiOS/.test(ua)
    ? 'This browser deletes a website’s saved work after about seven days without opening it.'
    : 'Safari deletes a website’s saved work after about seven days of using Safari without opening it.';
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
  // (a guide the last backup couldn’t read: due whatever an earlier Later said, v304)
  const d = el && (Date.now() > snooze || backupMissed()) ? backupDue() : null,
    // (on an iPhone or iPad in a tab, Safari's reminders are one card with Add to Home Screen, v304)
    merge = !!d && (d.why === 'first' || d.why === 'gap') && isIOSDevice(),
    inst = renderInstallCard(!!d && !merge, merge ? d : null);
  if (el) el.style.display = d && !merge ? '' : 'none';
  if (typeof window.renderWhatsNew === 'function') window.renderWhatsNew(!inst && !d);
  if (!d || merge) return;
  const what = [
      d.mk ? nWord(d.mk, 'marker') : '',
      d.pals ? nWord(d.pals, 'palette') : '',
      d.gs ? nWord(d.gs, 'guide') : '',
    ].filter(Boolean),
    list = what.length > 1 ? what.slice(0, -1).join(', ') + ' and ' + what[what.length - 1] : what[0];
  el.innerHTML =
    '<div class="ntxt"><b>Back up your work.</b> <span>' +
    (d.why === 'missed'
      ? nWord(d.miss, 'guide') +
        ' couldn’t be read by your last backup. Reload Marker Studio, then back up again.'
      : (d.why === 'first' || d.why === 'gap' ? safariWords() + ' ' : '') +
        (d.bk
          ? d.risk
            ? d.risk + ' guide' + (d.risk === 1 ? ' has' : 's have') + ' changed since your last backup.'
            : 'Your markers or palettes have changed since your last backup.'
          : 'Your ' +
            list +
            (what.length === 1 && /^1 /.test(list) ? ' is' : ' are') +
            ' only stored on this device.')) +
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
  // (v307: the markers its shading takes beyond its own colours, for Home's latest piece; as it was when not given)
  const _sk = d.sk !== undefined ? +d.sk : _ex && _ex.sk;
  if (_sk > 0 && _sk < 10000) meta.sk = Math.round(_sk);
  // (v306: a copy with section edits still to be built, which Home's latest piece leaves out; 0 once a guide named
  // "… (section edits)" is saved built)
  if (_pl && _pl.edits === 1) meta.eds = 1;
  else if (/ \(section edits\)$/.test(meta.name || '')) meta.eds = 0;
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
  storeErr.last = '';
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
          // (the app's own storage is full: said as such, v304)
          storeErr.last = 'QuotaExceededError';
          return null;
        }
        askPersist();
        leaveDrop(id, leaveAt);
        return id;
      });
    })
    .catch(function (e) {
      storeErr.last = (e && e.name) || 'Error';
      return null;
    });
}
// why the last save of a guide failed (v304): '' (it worked, or hasn't failed), 'QuotaExceededError' (storage full),
// else the name of the database's error: it stopped answering (iOS can drop it in the background), which a reload fixes
// and deleting guides doesn't (saveFailWords says which). Cleared as each save begins, so it never goes stale
function storeErr() {
  return storeErr.last || '';
}
storeErr.last = '';
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
      // (the Library guides that couldn't be read, left out of the backup: said, not "Backed up ✓", v304)
      var b = a.filter(Boolean);
      b.missedIds = gs
        .filter(function (s, i) {
          return !a[i];
        })
        .map(function (s) {
          return s.id;
        });
      b.missed = b.missedIds.length;
      return b;
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
          // (guides it couldn't read make the reminder due at once, v304)
          if (guides.missed) localStorage.setItem(BK_MISS, JSON.stringify(guides.missedIds));
          else localStorage.removeItem(BK_MISS);
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
        const miss = guides.missed || 0;
        if (miss)
          toast(
            'Backed up, but ' +
              nWord(miss, 'guide') +
              ' couldn\u2019t be read and ' +
              (miss === 1 ? 'isn\u2019t' : 'aren\u2019t') +
              ' in it. Reload Marker Studio and back up again before deleting anything.',
            10000,
          );
        if (bb && bb.isConnected && bb.getClientRects().length)
          _btnFlash(bid, how === 'share' ? 'Saved ✓' : 'Downloaded ✓', label);
        else {
          _btnFlash(bid, label, label, 10);
          if (!miss) toast('Backed up ✓');
          // (focus follows the card away with guides left out too, v304)
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
            (guides.missed ? ' \u2014 ' + nWord(guides.missed, 'guide') + ' couldn\u2019t be read' : ' ✓');
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
              // (v308: the version that made it, so an older one can say it's from a newer version)
              app: appVersion(),
              ts: now,
              owned: [...state.owned],
              wish: state.wish,
              ink: state.ink,
              buyBrands: state.buyBrands,
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
    .catch(function (e) {
      _btnFlash(bid, label, label, 10);
      var _b = document.getElementById(bid);
      errCard(
        _b && _b.parentNode,
        errNote('The backup couldn\u2019t be saved on this device. Try again.', 'Backing up', e),
      );
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
// whether a backup's markers would replace yours, asked first in the app's own dialog (v288): resolves true (use the
// backup's), false (keep yours), 'add' (yours and the backup's together, v308) or null for Cancel (v289: Escape and the
// backdrop too), when nothing is restored. Nothing to ask when they're the same, when the backup has none (yours are
// kept) or you have none (theirs come in).
// (v308) Keep my markers is the highlighted answer: one tap on an old backup used to replace them. "Add the backup's"
// shows only when it has markers you don't, and each answer says how many markers it leaves you with.
function askReplaceMarkers(o) {
  const arr = Array.isArray(o) ? o : o && Array.isArray(o.owned) ? o.owned : null;
  if (!arr) return Promise.resolve(false);
  const own = new Set(arr.map(knownMkey).filter(Boolean));
  const same = own.size === state.owned.size && [...own].every((k) => state.owned.has(k));
  if (same || !own.size) return Promise.resolve(!own.size ? false : true);
  if (!state.owned.size) return Promise.resolve(true);
  let extra = 0,
    shared = 0;
  own.forEach(function (k) {
    if (state.owned.has(k)) shared++;
    else extra++;
  });
  const mine = state.owned.size,
    lose = mine - shared,
    what = o && Array.isArray(o.guides) && o.guides.length ? 'palettes and guides are' : 'palettes are';
  const ask =
    window.SF && SF.askBox
      ? SF.askBox(
          'Your markers differ from the backup’s',
          'You have ' +
            nWord(mine, 'marker') +
            '; the backup has ' +
            own.size +
            (shared ? ' (' + (shared === own.size ? 'all' : shared) + ' of them yours too)' : '') +
            '. Either way, the backup’s ' +
            what +
            ' added.',
          '<button type="button" class="btn-primary" data-a="keep">Keep my ' +
            mine +
            '</button>' +
            (extra
              ? '<button type="button" data-a="add">Add the backup’s ' +
                extra +
                ' to mine (' +
                (mine + extra) +
                ')</button>'
              : '') +
            '<button type="button" data-a="replace">Use the backup’s ' +
            own.size +
            (lose ? ' (' + lose + ' of yours go)' : '') +
            '</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
          true,
        )
      : Promise.resolve(
          confirm(
            'Keep your ' +
              nWord(mine, 'marker') +
              '?\n\nOK keeps yours; Cancel uses the backup’s ' +
              nWord(own.size, 'marker') +
              '. Either way, the backup’s ' +
              what +
              ' added.',
          )
            ? 'keep'
            : 'replace',
        );
  // (Cancel, Escape or the backdrop: nothing restored)
  return ask.then(function (a) {
    return a === 'replace' ? true : a === 'keep' ? false : a === 'add' ? 'add' : null;
  });
}
// (v308) Undo for what a restore did to your markers: the markers, To buy, ink marks and Brands I'd buy as they were
// before it. The toast's "Undo marker change" (12 s), and for 7 days, while the markers are as the restore left them,
// "Put back the 451 markers you had before Sunday's restore" in the Library and Back up & restore (PRE_RESTORE).
// Palettes and guides a restore added stay.
// (var: the Library, drawn before this file has run, asks for it)
var PRE_RESTORE = 'ms-pre-restore',
  PRE_RESTORE_DAYS = 7;
function mkSnap() {
  return {
    owned: [...state.owned],
    wish: state.wish.map(function (w) {
      return Object.assign({}, w);
    }),
    ink: Object.assign({}, state.ink),
    buy: state.buyBrands == null ? null : state.buyBrands.slice(),
  };
}
// the markers, To buy, ink and Brands I'd buy now, as a short fingerprint
function mkSig(s) {
  s = s || mkSnap();
  return leaveHash(
    JSON.stringify([
      s.owned.slice().sort(),
      s.wish.map(function (w) {
        return w.k;
      }),
      Object.keys(s.ink)
        .sort()
        .map(function (k) {
          return k + s.ink[k];
        }),
      s.buy,
    ]),
  );
}
function preRestoreGet() {
  let j = null;
  try {
    j = JSON.parse(localStorage.getItem(PRE_RESTORE) || 'null');
  } catch (_) {}
  if (!j || !j.snap || !Array.isArray(j.snap.owned) || !(+j.t > 0)) return null;
  if (Date.now() - j.t > PRE_RESTORE_DAYS * 864e5 || j.sig !== mkSig()) return null;
  return j;
}
function preRestoreDrop() {
  try {
    localStorage.removeItem(PRE_RESTORE);
  } catch (_) {}
}
// kept after a restore changed your markers (not when you had none: nothing to put back)
function preRestoreKeep(snap) {
  try {
    localStorage.setItem(PRE_RESTORE, JSON.stringify({ t: Date.now(), sig: mkSig(), snap: snap }));
  } catch (_) {}
  preRestoreRender();
}
// "Sunday's restore", "today's restore", "yesterday's restore"
function preRestoreWhen(t) {
  const d = new Date(t),
    now = new Date(),
    day = function (x) {
      return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    },
    ago = Math.round((day(now) - day(d)) / 864e5);
  if (ago <= 0) return 'today’s';
  if (ago === 1) return 'yesterday’s';
  try {
    return d.toLocaleDateString('en-GB', { weekday: 'long' }) + '’s';
  } catch (_) {
    return 'the last';
  }
}
function preRestoreRender() {
  const j = preRestoreGet();
  ['libPreRestore', 'bkPreRestore'].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !j;
    if (j)
      el.textContent =
        'Put back the ' +
        nWord(j.snap.owned.length, 'marker') +
        ' you had before ' +
        preRestoreWhen(j.t) +
        ' restore';
  });
}
// the markers as they were (snap); a toast says so
function restoreUndo(snap) {
  if (!snap) return false;
  const was = mkSnap();
  state.owned = new Set(snap.owned);
  state.wish = cleanWish(snap.wish);
  state.ink = cleanInk(snap.ink);
  state.buyBrands = cleanBuy(snap.buy);
  if (!save(true)) {
    state.owned = new Set(was.owned);
    state.wish = was.wish;
    state.ink = was.ink;
    state.buyBrands = was.buy;
    toast('Couldn’t put your markers back — this browser’s storage is full.', 6000);
    return false;
  }
  preRestoreDrop();
  wishChanged();
  if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
  if (typeof buySumSync === 'function') buySumSync();
  fullRender();
  preRestoreRender();
  toast('Put back your ' + nWord(snap.owned.length, 'marker') + ' as they were before the restore.', 4000);
  // (v308.2) the toast's Undo took the keyboard with it: back to the Library's Restore while the Library is open
  const lib = document.getElementById('savedOverlay'),
    rb = document.getElementById('guidesRestore');
  if (
    lib &&
    lib.classList.contains('on') &&
    !lib.contains(document.activeElement) &&
    rb &&
    rb.offsetParent !== null
  )
    rb.focus({ preventScroll: true });
  return true;
}
// a restore's toast, with "Undo marker change" when it changed your markers (r.undo: as they were)
function restoreToast(msg, ms, r) {
  if (!msg) return;
  if (r && r.undo) {
    const snap = r.undo;
    toastActions(
      msg,
      [{ label: 'Undo marker change', fn: () => restoreUndo(snap) }],
      Math.max(ms || 0, 12000),
    );
  } else toast(msg, ms);
}
// replace: the answer from askReplaceMarkers. (v308) 'add': the backup's markers join yours; its To buy comes in for
// markers you still don't own, and yours comes off for the markers it brought (unless marked running low or dry); your
// ink marks win and Brands I'd buy is taken only when yours is automatic (as Keep mine, v305).
// Returns {mk: the backup's markers are now yours, add: markers added, same: they already matched, undo: your markers
// as they were (when the restore changed them)} with what else came in.
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
      buy: state.buyBrands,
    },
    snap = mkSnap(),
    sig0 = mkSig(snap),
    back = function () {
      state.owned = was.owned;
      state.saved = was.saved;
      state.wish = was.wish;
      state.ink = was.ink;
      state.buyBrands = was.buy;
      if (typeof buySumSync === 'function') buySumSync();
      if (savedOverlay.classList.contains('on')) renderSaved();
      return { failed: true };
    },
    // (what the restore did to your markers can be undone; not when you had none. A handle for the toast, not part of
    // what the restore says: not enumerable)
    undoable = function (r) {
      if (snap.owned.length && mkSig() !== sig0) {
        Object.defineProperty(r, 'undo', { value: snap, enumerable: false });
        preRestoreKeep(snap);
      }
      return r;
    };
  let added = 0;
  const got = new Set();
  if (replace === 'add') {
    own.forEach(function (k) {
      if (!state.owned.has(k)) {
        state.owned.add(k);
        got.add(k);
      }
    });
    added = got.size;
    replace = false;
  }
  const same = own.size === state.owned.size && [...own].every((k) => state.owned.has(k));
  if (added || (!same && (!own.size || (state.owned.size && !replace)))) {
    // (v305: your markers stay, and the backup's To buy and ink marks merge in for them; its Brands I'd buy is taken
    // only when yours is automatic. Before, all three were dropped.)
    const wr = wishRestore(o, false, state.owned);
    // (Add: your To buy entries for the markers it brought come off, unless marked running low or dry, its marks
    // having come in first)
    if (got.size)
      state.wish = state.wish.filter(function (w) {
        return !got.has(w.k) || !!state.ink[w.k];
      });
    let bb = false;
    if (state.buyBrands == null && o && 'buyBrands' in o && cleanBuy(o.buyBrands)) {
      state.buyBrands = cleanBuy(o.buyBrands);
      bb = true;
    }
    const n = mergeBackupPals(pals),
      ink = wr.low + wr.dry;
    if (n || wr.wish || ink || bb || added) {
      if (!save(true)) return back();
      if (wr.wish || ink || added) wishChanged();
      if (bb || added) {
        if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
        if (typeof buySumSync === 'function') buySumSync();
      }
      fullRender();
    }
    const r = { mk: false, pals: n, wish: wr.wish, low: wr.low, dry: wr.dry, buy: bb };
    if (added) r.add = added;
    return undoable(r);
  }
  if (!same) state.owned = own;
  // (the same markers: the lists merge as for Keep mine, v305)
  const wr = wishRestore(o, !same, same ? state.owned : null);
  // (Brands I'd buy goes with the collection it was chosen for, when the file has it, v304)
  let bb = false;
  if (o && 'buyBrands' in o) {
    const b = cleanBuy(o.buyBrands);
    if (JSON.stringify(b) !== JSON.stringify(state.buyBrands)) {
      state.buyBrands = b;
      bb = true;
      if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
      if (typeof buySumSync === 'function') buySumSync();
    }
  }
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
  // (v308: the same markers aren't "restored"; what merged into the lists is said as for Keep mine)
  return undoable(
    same
      ? {
          mk: false,
          same: own.size > 0,
          pals: n,
          wish: wr.wish,
          low: wr.low,
          dry: wr.dry,
          buy: bb && !!state.buyBrands,
        }
      : { mk: true, pals: n },
  );
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
// "a, b and c" ('' for none)
function andList(w) {
  w = w.filter(Boolean);
  return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0] || '';
}
// what came in beside your markers (Keep mine, v305): "2 to buy, 1 Running low note and 1 palette"
function keptList(r) {
  return andList([
    r.wish ? r.wish + ' to buy' : '',
    r.low ? nWord(r.low, 'Running low note') : '',
    r.dry ? nWord(r.dry, 'dry note') : '',
    r.pals ? nWord(r.pals, 'palette') : '',
  ]);
}
const BUY_FROM_BACKUP = 'Brands I’d buy set from the backup.';
// (v308) the backup's markers added to yours: "Added 22 markers from the backup (142 now)"
function addedWords(r) {
  return 'Added ' + nWord(r.add, 'marker') + ' from the backup (' + state.owned.size + ' now)';
}
// what a restore of markers and palettes did, for the toast: "Restored — 8 markers. 1 palette added.", or with your
// markers kept "Kept your markers; added 2 to buy and 1 Running low note." ('' when nothing came in)
// (v308: Keep mine is said even when nothing else came in; the same markers aren't "restored")
function restoredWords(r) {
  if (!r || r.failed) return '';
  if (r.mk)
    return (
      'Restored — ' +
      nWord(state.owned.size, 'marker') +
      '.' +
      (r.pals ? ' ' + nWord(r.pals, 'palette') + ' added.' : '')
    );
  const l = keptList(r);
  let s = '';
  if (r.add) s = addedWords(r) + (l ? '; also ' + l : '') + '.';
  else if (r.same) s = 'Your markers already match the backup' + (l ? '; added ' + l : '') + '.';
  else if (state.owned.size) s = 'Kept your markers' + (l ? '; added ' + l : '') + '.';
  else if (l) s = 'Added ' + l + '.';
  return s + (r.buy ? (s ? ' ' : '') + BUY_FROM_BACKUP : '');
}
// why a restore brought nothing back (restoreAny's done), in words
// (v308: an empty file, a picture, and a backup cut short each have their own words)
const RESTORE_DAMAGED =
  'This backup is incomplete or damaged — it may not have finished downloading. Download it again from Files or iCloud Drive, or choose an earlier backup.';
// (a file the browser couldn't read is an error kept for Copy details, as other caught failures are)
function restoreWhy(why) {
  return why === 'read'
    ? 'Couldn’t read that file.' + errBtns()
    : why === 'full'
      ? RESTORE_FULL
      : why === 'damaged'
        ? RESTORE_DAMAGED
        : why === 'empty'
          ? 'That file is empty. Choose the <b>.json</b> file saved by <b>Back up</b>.'
          : why === 'picture'
            ? 'That’s a picture, not a backup. Choose the <b>.json</b> file saved by <b>Back up</b>.'
            : 'That file isn’t a Marker Studio backup. Choose the <b>.json</b> file saved by <b>Back up</b>.';
}
// (v308) what a file that didn't read as JSON is: 'empty', 'picture', 'damaged' (a backup or guide file cut short)
// or 'bad'
function fileTrouble(file, text) {
  const t = typeof text === 'string' ? text : '';
  if (!t.trim()) return 'empty';
  if (
    (file && /^image\//.test(file.type || '')) ||
    /\.(jpe?g|png|heic|heif|webp|gif)$/i.test((file && file.name) || '') ||
    /^(\x89PNG|\xff\xd8\xff|\ufffd\ufffd\ufffd|\ufffdPNG|GIF8|RIFF)/.test(t)
  )
    return 'picture';
  // (a backup says what it is at its start; a guide file has its stored guide, "payload", after its name and markers)
  return /^\s*\{/.test(t) &&
    /"type"\s*:\s*"ms-(backup|guides)"|"payload"\s*:\s*\{|"lmap"\s*:\s*"data:/.test(t.slice(0, 6000))
    ? 'damaged'
    : 'bad';
}
// (v308) the app's version as Home shows it ("v308"), written into backups and guide files; a file from a newer
// version is asked about before it's used (files from before v308 have none)
function appVersion() {
  const e = document.getElementById('appVer'),
    m = /v?(\d+(?:\.\d+)?)/.exec((e && e.textContent) || '');
  return m ? 'v' + m[1] : '';
}
function verNum(v) {
  const m = /(\d+)(?:\.(\d+))?/.exec(String(v || ''));
  return m ? +m[1] + (m[2] ? Math.min(+m[2], 999) / 1000 : 0) : 0;
}
function fileNewer(d) {
  const a = verNum(d && typeof d === 'object' ? d.app : ''),
    b = verNum(appVersion());
  return a > 0 && b > 0 && a > b;
}
// resolves true to go on (not newer, or "anyway"), false for Cancel
function askNewer(d, what, go) {
  if (!fileNewer(d)) return Promise.resolve(true);
  const v = String(d.app).slice(0, 12);
  return (
    window.SF && SF.askBox
      ? SF.askBox(
          'Made by a newer Marker Studio',
          'This ' +
            what +
            ' was made by Marker Studio ' +
            v +
            '; this is ' +
            appVersion() +
            '. Update first: close and reopen the app, then try again.',
          '<button type="button" data-a="go">' +
            esc(go) +
            '</button><button type="button" class="btn-primary" data-a="stay">Cancel</button>',
          true,
        )
      : Promise.resolve(confirm('Made by a newer Marker Studio (' + v + '). ' + go + '?') ? 'go' : 'stay')
  ).then(function (a) {
    return a === 'go';
  });
}
// guides a restore didn't add ({dup, ahead, bad, full} from restoreGuideList), in words: "1 guide was already here; 1
// guide couldn't be read." ('' when there are none)
function guidesLeft(x) {
  if (!x) return '';
  const p = [];
  if (x.dup) p.push(x.dup === 1 ? '1 guide was already here' : x.dup + ' guides were already here');
  // (v308: here, the same guide with more coloured; no "(from backup)" copy of it is added)
  if (x.ahead)
    p.push(
      x.ahead === 1
        ? '1 guide is further along here, so it was left as it is'
        : x.ahead + ' guides are further along here, so they were left as they are',
    );
  if (x.bad) p.push(nWord(x.bad, 'guide') + ' couldn’t be read');
  if (x.full) p.push(nWord(x.full, 'guide') + ' couldn’t be saved — this browser’s storage is full');
  if (!p.length) return '';
  const s = p.join('; ') + '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// what a restore with guides did, for the Back up & restore dialog: "Markers restored, 1 palette added; 2 guides
// restored.", then what wasn't added (guidesLeft). ok: the guides restored as they were in the file (not the ones
// added beside a guide here, said by restoreKeptWords: each guide in the file is said once, v308)
// (v308: with your markers kept and guides restored, it says so: it had said only "1 guide restored.")
const MARKERS_KEPT = 'Your markers are as they were.';
function guideRestoreWords(col, ok, x) {
  const l = col && !col.mk ? keptList(col) : '',
    a =
      col && col.mk
        ? 'Markers restored' + (col.pals ? ', ' + nWord(col.pals, 'palette') + ' added' : '')
        : col && col.add
          ? addedWords(col) + (l ? ', ' + l : '')
          : l
            ? 'Added ' + l
            : '',
    h = [a, ok ? nWord(ok, 'guide') + ' restored' : ''].filter(Boolean).join('; '),
    k = ok && col && !col.mk && !col.add && (col.same || state.owned.size) ? MARKERS_KEPT : '',
    b = col && !col.mk && col.buy ? BUY_FROM_BACKUP : '',
    t = guidesLeft(x);
  return [h ? h + '.' : '', k, b, t].filter(Boolean).join(' ');
}
// what came back from a restore ({markers,palettes,guides}), for Welcome's and Home's toast: "2 palettes and 1 guide"
// (guides it didn't add: guidesLeft(r))
function restoredList(r) {
  // (and, with your markers kept, what came in beside them, v305)
  return andList([
    r.markers ? nWord(r.markers, 'marker') : '',
    r.added ? nWord(r.added, 'marker') + ' added to yours' : '',
    r.palettes ? nWord(r.palettes, 'palette') : '',
    r.wish ? nWord(r.wish, 'marker') + ' to buy' : '',
    r.low ? nWord(r.low, 'Running low note') : '',
    r.dry ? nWord(r.dry, 'dry note') : '',
    r.buy ? 'Brands I’d buy' : '',
    r.guides ? nWord(r.guides, 'guide') : '',
  ]);
}
// (v308) Welcome's and Home's toast after a restore ({text, long}), or {err} when nothing came back: what came back,
// what wasn't added, and what was kept beside the backup's guides. Each guide in the file is said once.
function restoreSummary(r) {
  const what = restoredList(r),
    left = guidesLeft(r),
    kw = restoreKeptWords(r).trim();
  if (!what && !kw)
    return {
      err:
        left ||
        (r.same
          ? 'Your markers already match the backup \u2014 there\u2019s nothing new in it to restore.'
          : r.keptMine
            ? 'Kept your markers \u2014 there\u2019s nothing new in the backup to restore.'
            : 'That backup is empty \u2014 there\u2019s nothing in it to restore.'),
    };
  let s = what ? 'Restored ' + what : '';
  // (v308: guides came in beside the markers you kept)
  if (r.guides && (r.keptMine || r.same)) s += '. ' + MARKERS_KEPT.slice(0, -1);
  const tail = [left, kw].filter(Boolean).join(' ');
  if (tail) s = s ? s + '. ' + tail : tail;
  return { text: s, long: !!tail };
}
// (v308) a restore in progress: one at a time, and what could start another (or change the markers under it) waits
let _restoring = false;
const RESTORE_LOCKS = [
  'wcAdd',
  'wcSkip',
  'wcRestore',
  // (v309: the welcome's three ways in)
  'wcHaveSet',
  'wcOneByOne',
  'wcNotSure',
  'wcSample',
  'wcPhoto',
  'wcLook',
  'guidesBackup',
  'guidesRestore',
  'homeImport',
  'libBkText',
  'backupDownload',
  'backupImport',
  'backupRestore',
  'lnRestore',
];
function restoreBusy(on) {
  const els = RESTORE_LOCKS.map(function (id) {
    return document.getElementById(id);
  }).concat([].slice.call(document.querySelectorAll('#wcSets input, .wcbrands button')));
  els.forEach(function (b) {
    if (!b) return;
    if (on) {
      if (b.dataset.rsWas == null) b.dataset.rsWas = b.disabled ? '1' : '';
      b.disabled = true;
    } else if (b.dataset.rsWas != null) {
      if (!b.dataset.rsWas) b.disabled = false;
      delete b.dataset.rsWas;
    }
  });
  document.documentElement.classList.toggle('msrestoring', !!on);
}
// a polite word for screen readers (the restore's progress)
function liveSay(m) {
  let el = document.getElementById('msLive');
  if (!el) {
    el = document.createElement('div');
    el.id = 'msLive';
    el.className = 'sfsr';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = m;
}
// done (optional): called with what came back ({markers,palettes,guides}, and guides not added: {dup,bad,full}), or null
// and why ('bad': not a backup, 'read': unreadable, 'full': storage full, nothing changed; nothing when nothing came
// back). The caller then says it, instead of the toast and card here.
function restoreAny(file, btnId, done) {
  var bid = btnId || 'guidesRestore',
    b0 = document.getElementById(bid),
    label = b0 ? b0.textContent : 'Restore a backup',
    cap = $('backupCap');
  if (_restoring) {
    toast('A restore is already under way — wait for it to finish.', 3200);
    if (done) done(null);
    return;
  }
  _restoring = true;
  var fin = function () {
    _restoring = false;
    restoreBusy(false);
  };
  var fr = new FileReader();
  fr.onload = function () {
    var d = null;
    try {
      d = JSON.parse(fr.result);
    } catch (e) {}
    var bad = function (why) {
      fin();
      _btnFlash(bid, label, label, 10);
      if (done) {
        done(null, why || 'bad');
        return;
      }
      var b = document.getElementById(bid);
      errCard(b && b.parentNode, restoreWhy(why || 'bad'));
    };
    if (!d || typeof d !== 'object') {
      bad(d ? 'bad' : fileTrouble(file, fr.result));
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
    var stop = function () {
      fin();
      _btnFlash(bid, label, label, 10);
      if (cap) cap.textContent = 'Nothing restored.';
      if (done) done(null);
      else toast('Nothing restored.');
    };
    askNewer(d, guides && !collection && d.payload ? 'guide file' : 'backup', 'Restore anyway')
      .then(function (go) {
        if (!go) return null;
        return collection ? askReplaceMarkers(d) : false;
      })
      .then(function (rep) {
        if (rep === null) {
          stop();
          return;
        }
        restoreGo(d, fts, guides, collection, rep, bid, label, cap, done, fin);
      });
  };
  fr.onerror = function () {
    fin();
    errLog('Restoring a backup', fr.error || 'the file couldn’t be read');
    if (cap) cap.textContent = 'Couldn’t read that file.';
    if (done) {
      done(null, 'read');
      return;
    }
    // (v308: the card other restore errors show; it had only changed the caption under the button)
    _btnFlash(bid, label, label, 10);
    var b = document.getElementById(bid);
    errCard(b && b.parentNode, restoreWhy('read'));
  };
  fr.readAsText(file);
}
// what a restore kept beside the backup's guides ({copies, kept, lost}), in words, each sentence after a space ('' when
// nothing was): a newer guide here (v289), one changed here since its last backup and one not in the Library (v304)
function restoreKeptWords(x) {
  let s = '';
  if (x.copies)
    s +=
      ' ' +
      x.copies +
      ' guide' +
      (x.copies > 1 ? 's were' : ' was') +
      ' newer here, so ' +
      (x.copies > 1 ? 'they were' : 'it was') +
      ' kept and the backup’s version added as “(from backup)”.';
  if (x.kept)
    s +=
      ' ' +
      nWord(x.kept, 'guide') +
      ' changed here since your last backup ' +
      (x.kept > 1 ? 'were' : 'was') +
      ' kept as “… (before restore)”.';
  if (x.lost)
    s +=
      ' ' +
      nWord(x.lost, 'guide') +
      ' stored on this device but not in your Library ' +
      (x.lost > 1 ? 'were left as they are' : 'was left as it is') +
      ' — add ' +
      (x.lost > 1 ? 'them' : 'it') +
      ' back from Home.';
  return s;
}
// restoreAny once the question about markers (if any) is answered; fin: the restore is over (called once)
function restoreGo(d, fts, guides, collection, rep, bid, label, cap, done, fin) {
  fin = fin || function () {};
  {
    var col = collection ? applyCollectionBackup(d, fts, rep) : null;
    if (col && col.failed) {
      fin();
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
    var got = function (g, x, copies) {
      x = x || {};
      return {
        markers: col && col.mk ? state.owned.size : 0,
        added: col ? col.add || 0 : 0,
        palettes: col ? col.pals || 0 : 0,
        wish: col ? col.wish || 0 : 0,
        low: col ? col.low || 0 : 0,
        dry: col ? col.dry || 0 : 0,
        buy: !!(col && col.buy),
        // (v308: the guides restored as they were in the file; ones added beside a guide here are said apart)
        guides: Math.max(0, g - (copies || 0) - (x.lost || 0)),
        dup: x.dup || 0,
        ahead: x.ahead || 0,
        bad: x.bad || 0,
        full: x.full || 0,
        // (what was kept beside the backup's guides: the Welcome and Home's note say it too, v304)
        copies: copies || 0,
        kept: x.kept || 0,
        lost: x.lost || 0,
        undo: col && col.undo ? col.undo : null,
        // (nothing came back: your markers matched the backup's, or were kept)
        same: !!(col && col.same),
        keptMine: !!(col && !col.mk && !col.add && !col.same && state.owned.size),
      };
    };
    if (!guides || !guides.length) {
      fin();
      if (collection) {
        var said = restoredWords(col);
        _btnFlash(
          bid,
          col && (col.mk || col.add) ? 'Restored ✓' : col && col.same ? 'Already here' : 'Kept yours',
          label,
        );
        if (cap) cap.textContent = said || 'Nothing changed.';
        if (said && !done) restoreToast(said, 4000, col);
      }
      // (v308: whatever a backup brought, the Welcome and Home say: the same markers, or yours kept with nothing new,
      // aren't "That backup is empty")
      if (done) done(collection ? got(0) : null);
      return;
    }
    restoreBusy(true);
    // (v308) "Restoring 12 of 65…" on the button, and said to a screen reader about once a second
    var said0 = 0;
    var prog = function (i, n) {
      if (n < 2) return;
      var t = 'Restoring ' + i + ' of ' + n + '…',
        b = document.getElementById(bid);
      if (b) b.textContent = t;
      if (Date.now() - said0 > 1000) {
        said0 = Date.now();
        liveSay(t);
      }
    };
    // (v310.1) guides from a backup made before v310 into a Library with none: someone who used the app before (a new
    // iPad, or after starting again) keeps the full Check the sections step, as the first start of v310 gave anyone
    // with a guide. (Not a v310 backup: a new tester moving from a Safari tab to the Home Screen app keeps the quick one.)
    var hadGuide = state.saved.some(function (s) {
      return s.type === 'guide';
    });
    // guides already here aren't counted as restored; ones storage had no room for are said as a failure, by the button
    restoreGuideList(
      guides,
      fts,
      function (ok, copies, x) {
        x = x || {};
        fin();
        if (ok && !hadGuide && verNum(d && d.app) < 310)
          try {
            localStorage.setItem('ms-sec-tools', '1');
          } catch (_) {}
        liveSay('');
        _btnFlash(
          bid,
          ok ? 'Restored ' + ok + ' ✓' : (x.dup || x.ahead) && !x.bad && !x.full ? 'Already here' : label,
          label,
          1800,
        );
        var msg = guideRestoreWords(col, Math.max(0, ok - (copies || 0) - (x.lost || 0)), x),
          kw = restoreKeptWords({ copies: copies, kept: x.kept, lost: x.lost });
        if (cap) cap.textContent = (msg + kw).trim();
        if (done) {
          done(collection || ok || x.dup || x.ahead || x.bad || x.full ? got(ok, x, copies) : null);
          return;
        }
        if (x.openRep) msg += ' “' + x.openRep + '” was replaced by the backup’s newer copy.';
        msg = (msg + kw).trim();
        if (x.full) {
          var fb = document.getElementById(bid);
          errCard(
            fb && fb.parentNode,
            esc(msg) + ' Delete a few guides from the Library, then restore again.',
          );
          return;
        }
        restoreToast(msg, copies || x.bad || x.kept || x.lost || x.ahead ? 7000 : 3500, col);
      },
      prog,
    );
  }
}
// (v304) a "(before restore)" copy taken out again (its stored guide only once its row is gone from what's saved)
function dropKept(id) {
  state.saved = state.saved.filter(function (s) {
    return s.id !== id;
  });
  if (save(true))
    IDB.del('guide-' + id).catch(function () {
      return null;
    });
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
// (v308) A guide here that is the backup's with more coloured since (guideAhead) is "further along here" (ahead): no
// "(from backup)" copy of it is added. prog(i, n), optional: called as the i-th of n guides is begun.
// the guide here (h) is the backup's (b) with more coloured: the same stored sections and plan, and every tick, tone
// and kept shading of the backup's still here (pt8-pc §2). A section edit, a zone or a pattern change makes it differ.
function guideAhead(h, b) {
  if (!h || !b || typeof h !== 'object' || typeof b !== 'object' || h.lmap !== b.lmap) return false;
  const strip = function (p) {
    const o = {};
    Object.keys(p)
      .sort()
      .forEach(function (k) {
        if (k === 'prog' || k === 'tones' || k === 'held' || k === 'dates' || p[k] === undefined) return;
        if (k === 'out' && p.out && typeof p.out === 'object') {
          const q = {};
          Object.keys(p.out)
            .sort()
            .forEach(function (l) {
              const x = p.out[l] || {};
              q[l] = { k: x.k, lock: x.lock };
            });
          o.out = q;
          return;
        }
        o[k] = p[k];
      });
    return JSON.stringify(o);
  };
  if (strip(h) !== strip(b)) return false;
  const hp = new Set(Array.isArray(h.prog) ? h.prog : []),
    ht = h.tones && typeof h.tones === 'object' ? h.tones : {},
    hh = h.held && typeof h.held === 'object' ? h.held : {},
    ho = h.out && typeof h.out === 'object' ? h.out : {};
  if (
    !(Array.isArray(b.prog) ? b.prog : []).every(function (l) {
      return hp.has(l);
    })
  )
    return false;
  const bt = b.tones && typeof b.tones === 'object' ? b.tones : {};
  for (const l in bt) if (!hp.has(+l) && !hp.has(l) && !((+ht[l] || 0) >= (+bt[l] || 0))) return false;
  const bh = b.held && typeof b.held === 'object' ? b.held : {};
  for (const l in bh) if (JSON.stringify(hh[l]) !== JSON.stringify(bh[l])) return false;
  const bo = b.out && typeof b.out === 'object' ? b.out : {};
  for (const l in bo) {
    const x = ho[l] || {},
      y = bo[l] || {};
    if ((+x.done || 0) < (+y.done || 0) || (+x.t || 0) < (+y.t || 0)) return false;
  }
  return true;
}
// (v308) Library guides found damaged as they opened (97-open damagedGuide): a backup's copy of one replaces it, even
// when it's older (no "(from backup)" copy beside a guide that can't be opened)
const _damaged = new Set();
function guideDamaged(id) {
  _damaged.add(id);
}
function restoreGuideList(guides, _fts, done, prog) {
  var open = window.SF && SF.guideBrief ? SF.guideBrief() : null,
    openRep = '',
    i = 0,
    ok = 0,
    copies = 0,
    dup = 0,
    bad = 0,
    full = 0,
    kept = 0,
    lost = 0,
    ahead = 0;
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
      ? Promise.resolve(SF.checkGuide(pl)).catch(function (e) {
          errLog('Restoring a backup', e);
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
      if (done)
        done(ok, copies, {
          dup: dup,
          ahead: ahead,
          bad: bad,
          full: full,
          openRep: openRep,
          kept: kept,
          lost: lost,
        });
      // (a lost guide left beside the backup's copy is offered on Home, v304)
      if (lost && typeof lostRefresh === 'function') lostRefresh();
      return;
    }
    var g = guides[i++];
    if (prog) prog(i, guides.length);
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
      same(js, g.payload.lmap, cand)
        .then(function (isDup) {
          // (v308: newer here only because more was coloured here since: left as it is, no copy)
          if (isDup || !_ex || !((+_ex.ts || 0) > (+g.ts || 0))) return isDup;
          return IDB.get('guide-' + _ex.id).then(
            function (here) {
              return guideAhead(here, g.payload) ? 'ahead' : false;
            },
            function () {
              return false;
            },
          );
        })
        .then(function (isDup) {
          if (isDup) {
            if (isDup === 'ahead') ahead++;
            else dup++;
            next();
            return;
          }
          var copy = false,
            isLost = false,
            kid = null;
          // (v304) a guide stored under this id that no Library row points to (a lost guide: its row couldn't be read) may
          // be newer than the backup's: it is left as it is, to be added back from Home, and the backup's copy comes in
          // beside it. Not one whose delete is still finishing (Undo showing, or to finish at the next start): the
          // backup's copy takes its place, as before
          // (v304) a Library guide changed here since its last backup, about to be replaced by the backup's newer copy, is
          // kept first as "… (before restore)"
          var pend =
              !_ex &&
              !!_gid &&
              libPendList().some(function (x) {
                return x.id === _gid;
              }),
            bust = !!_ex && _damaged.has(_ex.id),
            atRisk =
              !bust &&
              _ex &&
              (+_ex.ts || 0) <= (+g.ts || 0) &&
              (+_ex.ts || 0) > (+_ex.bk || lastGuideBackup());
          ((!_ex && _gid && !pend) || atRisk
            ? IDB.get('guide-' + (_ex ? _ex.id : _gid)).catch(function () {
                return null;
              })
            : Promise.resolve(null)
          )
            .then(function (here) {
              var differs = !!here && !(here.lmap === g.payload.lmap && JSON.stringify(here) === js);
              if (!_ex && differs) {
                _gid = _newGuideId();
                _nm = _cn;
                isLost = true;
                return;
              }
              if (_ex && !bust && (+_ex.ts || 0) > (+g.ts || 0)) {
                _gid = _newGuideId();
                _nm = _cn;
                copy = true;
                return;
              }
              if (!_gid) _gid = _newGuideId();
              if (!(atRisk && differs)) return;
              return Promise.resolve(
                sfSaveDesign({
                  id: _newGuideId(),
                  name: (_ex.name || 'Guide').slice(0, 104) + ' (before restore)',
                  W: _ex.W,
                  H: _ex.H,
                  keys: _ex.keys || [],
                  n: _ex.n,
                  thumb: safeThumb(_ex.thumb),
                  payload: here,
                  ts: _ex.ts,
                  keepTs: true,
                  quiet: true,
                }),
              )
                .catch(function () {
                  return null;
                })
                .then(function (k) {
                  kid = k;
                });
            })
            .then(function () {
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
                    // (the guide here wasn't replaced, so the copy kept of it goes again: none piles up, v304)
                    if (kid) dropKept(kid);
                    full++;
                    next();
                    return;
                  }
                  ok++;
                  if (bust) _damaged.delete(_ex.id);
                  if (kid) kept++;
                  if (isLost) lost++;
                  else if (copy) copies++;
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
    '<div class="fhint">Tap to show only those markers; tap more to add. Nothing\u00a0chosen\u00a0=\u00a0all.</div><div class="fam-head"><span class="lbl">Brand</span><span class="quick">' +
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
