/* ===== Section Finder (integrated mode) ===== */
// (v318.17) the Colorless Blenders you own (any, in demo mode), as the guide's markers are: Blender highlights
function sfBlenders() {
  const demo = state.owned.size === 0,
    out = [];
  NOINK.forEach(function (i) {
    if ((!demo && (!isOwned(i) || isDry(i))) || (demo && !buyOk(i))) return;
    const c = COLORS[i];
    out.push({
      mkey: mkey(i),
      code: c.code,
      brand: c.brand,
      hex: c.hex,
      name: c.name,
      lab: hexToLab(c.hex),
      fam: c.fam,
    });
  });
  return out;
}
function sfCollection() {
  const demo = state.owned.size === 0,
    out = [];
  for (let i = 0; i < COLORS.length; i++) {
    // (v328 review: with none owned, the brands you'd buy, as Palette, Random and Match take them)
    if (NOINK.has(i) || (!demo && (!isOwned(i) || isDry(i))) || (demo && !buyOk(i))) continue;
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
  const OPEN_MS = 8000;
  let dbp = null;
  // a failed or dropped connection is forgotten, so the next save opens a fresh one (iOS can drop it in the background)
  function db() {
    if (dbp) return dbp;
    const p = new Promise(function (res, rej) {
      var r,
        done = false;
      // (v318 review) an open that never answers (Safari's engine has had such hangs) is given up after OPEN_MS, so a
      // save says the storage isn't answering instead of "Saving…" for good, with nothing else able to open
      const t = setTimeout(function () {
        if (done) return;
        done = true;
        const e = new Error('storage isn’t answering');
        e.name = 'TimeoutError';
        rej(e);
      }, OPEN_MS);
      const end = function () {
        if (done) return false;
        done = true;
        clearTimeout(t);
        return true;
      };
      try {
        r = indexedDB.open('ms-guides', 1);
      } catch (e) {
        end();
        rej(e);
        return;
      }
      r.onupgradeneeded = function () {
        r.result.createObjectStore('g');
      };
      r.onsuccess = function () {
        const d = r.result;
        // (one that answers after it was given up is let go)
        if (!end()) {
          try {
            d.close();
          } catch (_) {}
          return;
        }
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
        if (end()) rej(r.error);
      };
      r.onblocked = function () {
        if (end()) rej(new Error('storage is busy'));
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
      .catch(function (e) {
        // (not an open that never answered: that would only wait as long again)
        if (e && e.name === 'TimeoutError') throw e;
        dbp = null;
        return db().then(fn);
      });
  }
  function put(k, v) {
    return run(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('g', 'readwrite');
        t.objectStore('g').put(v, k);
        // (v318 polish: committed at once, not when the page next idles: a write begun as the page goes, a new guide's
        // first save, then reaches the database before Chromium drops it with the page)
        if (t.commit) t.commit();
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
  // (v314: or its photo of the finished page added, changed or removed since: fn)
  return gs.filter((g) => !g.fresh && Math.max(g.ts || 0, +g.fn || 0) > (+g.bk || bk)).length;
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
  // (v318.1: in a Safari tab a collection changed since the last backup counts too, for a visit after days away: a
  // collection read from photos of the caps, or typed, is work to lose, and Safari's seven days don't spare it. Not
  // for the first-time card, which waits for a guide coloured: Add to Home Screen says to back up already)
  if (!webkitTab() || !(risk || palsNew || (!!mk && other))) return null;
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
  // (a Later is a week's rest: one longer was given while the device's clock was ahead, v318 review)
  if (snooze > Date.now() + 8 * 864e5) snooze = 0;
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
  // (v316: its family rule, famRule, so To buy's "From your guides" finds its blend companions as its plan does
  // without opening it; a row saved before v316 has none, and is read with v315's rule, 2, until the guide is saved again)
  if (_pl) meta.fr = [1, 2, 3, 4].indexOf(+_pl.famRule) >= 0 ? +_pl.famRule : 0;
  // (v313: the sample tried, not printed or renamed: Home's Continue card leaves it be)
  if (_pl && _pl.smp === 1) meta.smp = 1;
  // (v313: when it was last coloured, for Home's Continue card)
  if (_pl && _pl.dates && +_pl.dates.l > 0 && +_pl.dates.l < 8.64e15) meta.lc = +_pl.dates.l;
  // (v307: the markers its shading takes beyond its own colours, for Home's latest piece; as it was when not given)
  const _sk = d.sk !== undefined ? +d.sk : _ex && _ex.sk;
  if (_sk > 0 && _sk < 10000) meta.sk = Math.round(_sk);
  // (v306: a copy with section edits still to be built, which Home's latest piece leaves out; 0 once a guide named
  // "… (section edits)" is saved built)
  if (_pl && _pl.edits === 1) meta.eds = 1;
  else if (/ \(section edits\)$/.test(meta.name || '')) meta.eds = 0;
  // (v314: when its photo of the finished page last changed, for the backup reminder: kept from save to save)
  if (_ex && +_ex.fn > 0) meta.fn = +_ex.fn;
  // (v318.34: a guide you've worked with, for Random's Prefer markers you haven't used yet: kept once set
  // (guideWorked, library.js), and set here by a section ticked or toned)
  if ((_ex && _ex.wk) || d.wk || meta.done > 0 || meta.tn > 0) meta.wk = 1;
  // (v314.1: and its straightened photo's shape)
  if (_ex && +_ex.fa > 0) meta.fa = +_ex.fa;
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
  // (v328 review 2: one waiting in Recently deleted (Put back, a restore of the same guide) goes back there if this
  // save fails, its stored copy kept: it had been deleted with nothing left but the open copy)
  const binWas = d.id && !had ? libPendList().find((x) => x.id === id) : null,
    binBack = function () {
      if (binWas && !state.saved.some((s) => s.id === id) && !libPendList().some((x) => x.id === id))
        libPendSet(libPendList().concat([binWas]));
    };
  if (d.id && !had) libUnpend(id);
  storeErr.last = '';
  // (v323) a guide's first save, in flight until its row is written: firstKeep keeps the row aside if the page goes
  if (!had) _firstFly = { id: id, d: d };
  return (
    had
      ? IDB.get('guide-' + id).catch(function () {
          return null;
        })
      : Promise.resolve(null)
  )
    .then(function (prevPl) {
      // (v318.23: the guide's own autosave keeps a newer version's settings it doesn't know: plCarry, 60-persist)
      if (prevPl && d.carry) d = Object.assign({}, d, { payload: d.carry(prevPl, d.payload) });
      return IDB.put('guide-' + id, d.payload || {}).then(function () {
        const meta = guideMeta(d, id);
        const ix = state.saved.findIndex((s) => s.id === id),
          prev = ix >= 0 ? state.saved[ix] : null;
        if (ix < 0 && d.mustExist) return null;
        if (ix >= 0) state.saved[ix] = meta;
        else state.saved.unshift(meta);
        // (v318.23: storage full, save() itself leaves out the oldest thumbnails, this one's too if need be)
        if (!save(!!d.quiet)) {
          const j = state.saved.indexOf(meta);
          if (prev) {
            state.saved[j] = prev;
            if (prevPl) IDB.put('guide-' + id, prevPl).catch(function () {});
          } else {
            state.saved.splice(j, 1);
            if (binWas) binBack();
            else IDB.del('guide-' + id).catch(function () {});
          }
          // (the app's own storage is full: said as such, v304)
          storeErr.last = 'QuotaExceededError';
          firstDone(id);
          return null;
        }
        askPersist();
        leaveDrop(id, leaveAt);
        // (v318.25: a copy this page kept aside while this save ran stays, and now starts from the row this save
        // wrote: else, the page stopped before its next save, the next start took that row for another tab's save and
        // threw the copy away. Another tab's copy, or a later save from another tab, still fails the check)
        leaveRebase(id, leaveAt, +meta.ts);
        firstDone(id);
        return id;
      });
    })
    .catch(function (e) {
      firstDone(id);
      binBack();
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
// (v318.25: which page kept a copy aside, so only its own saves move the copy's base on)
// (v318.26: not from Math.random: drawing one as the page loads moved every seeded test's rolls on — e2e
// random-and-blend's Random check landed on a roll with two alike pairs on GitHub)
const _leaveTab =
  Date.now().toString(36) +
  '.' +
  Math.round((typeof performance !== 'undefined' && performance.now ? performance.now() : 0) * 1000).toString(
    36,
  );
function leaveRebase(id, upTo, ts) {
  try {
    const j = JSON.parse(localStorage.getItem(LEAVE_KEY) || 'null');
    if (j && j.id === id && j.tab === _leaveTab && j.seq > upTo && ts > 0 && +j.base !== ts) {
      j.base = ts;
      localStorage.setItem(LEAVE_KEY, JSON.stringify(j));
    }
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
        tab: _leaveTab,
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
// (v323) A new guide's first save writes the guide to the database, then its row to localStorage. A reload or a tab
// closed in between (a Build's first save, or the one begun as the page went) lost the row, though the database write
// landed: the guide was only offered later on Home as lost. As the page goes, the row of a first save still in flight
// is kept aside at once (localStorage is written there and then); at the next start it goes into the Library, and out
// again if the database turns out not to have the guide.
const FIRST_KEY = 'ms-guide-first';
let _firstFly = null;
function firstKeep() {
  if (!_firstFly) return;
  try {
    localStorage.setItem(
      FIRST_KEY,
      JSON.stringify({ id: _firstFly.id, meta: guideMeta(_firstFly.d, _firstFly.id) }),
    );
  } catch (_) {}
}
function firstDone(id) {
  if (_firstFly && _firstFly.id === id) _firstFly = null;
  try {
    const j = JSON.parse(localStorage.getItem(FIRST_KEY) || 'null');
    if (j && j.id === id) localStorage.removeItem(FIRST_KEY);
  } catch (_) {}
}
window.addEventListener('beforeunload', firstKeep);
window.addEventListener('pagehide', firstKeep);
function sfFirstApply() {
  let j = null;
  try {
    j = JSON.parse(localStorage.getItem(FIRST_KEY) || 'null');
    localStorage.removeItem(FIRST_KEY);
  } catch (_) {}
  if (
    !j ||
    !j.meta ||
    typeof j.meta !== 'object' ||
    j.meta.type !== 'guide' ||
    !(+j.id > 0) ||
    j.meta.id !== j.id
  )
    return;
  if (state.saved.some((s) => s.id === j.id)) return;
  state.saved.unshift(j.meta);
  save(true);
  IDB.hold(
    IDB.getNow('guide-' + j.id)
      .then(
        function (pl) {
          return !!pl;
        },
        function () {
          // (the database didn't answer: the row stays, as a guide that won't open says why)
          return true;
        },
      )
      .then(function (ok) {
        if (ok) return;
        const ix = state.saved.findIndex((s) => s.id === j.id && s.type === 'guide');
        if (ix < 0) return;
        state.saved.splice(ix, 1);
        save(true);
        if (typeof renderRecent === 'function') renderRecent();
        if (typeof renderSaved === 'function') renderSaved();
      }),
  );
}
sfFirstApply();
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
        // (v318.28) the stored guide is already what was kept aside (put away: the save begun then landed, and the
        // copy, made from the same state, stayed with its base moved to that save's row, leaveRebase): nothing to
        // put in. Writing it again gave the row a new time, so a guide backed up since read "not in a backup", was
        // taken as newer by a restore, and reloaded in another tab
        if (old && typeof old === 'object' && JSON.stringify(leaveSlim(old)) === JSON.stringify(j.pl)) {
          // (v323.1) unless the save's database write landed and the page went before its row was written: the
          // stored guide is the copy, the row as it was (how much is coloured, 0 of 5 ticks on GitHub's run #71). The
          // row then follows the stored guide; one the save did write already says the same, and is left be
          const ix = state.saved.findIndex((s) => s.id === j.id && s.type === 'guide');
          if (ix < 0) return;
          const was = state.saved[ix],
            m = guideMeta(
              {
                name: was.name || j.name,
                W: j.W,
                H: j.H,
                keys: j.keys,
                n: j.n,
                payload: old,
                thumb: was.thumb,
              },
              j.id,
            );
          if (
            (+m.done || 0) === (+was.done || 0) &&
            (+m.tn || 0) === (+was.tn || 0) &&
            (+m.lc || 0) === (+was.lc || 0)
          )
            return;
          state.saved[ix] = m;
          save(true);
          if (typeof renderRecent === 'function') renderRecent();
          if (typeof renderSaved === 'function') renderSaved();
          return;
        }
        // (v318.23: a newer version's settings in the stored guide kept, as its autosave keeps them. SF is there by
        // now: this runs once the database has answered, after the guide's code has loaded)
        let pl = old && leaveFill(j.pl, old);
        if (pl && window.SF && SF.plCarry) pl = SF.plCarry(old, pl);
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
      // (v328 review 2: the database not answering, or full: the copy kept for the next start, not thrown away with
      // the last ticks in it; it goes once put in, or once it can't be, its row changed)
      .then(done, function () {}),
  );
}
sfLeaveApply();
// (v318 review: sfLoadDesign.errOf(id), why the last read of guide id gave nothing: '' when the guide isn't stored,
// else the database's error, which a reload may fix: 97-open says which. v318 polish: kept for each guide, as
// sfLoadDesign.err, one for all, was cleared by a read of another guide begun meanwhile, a thumbnail's or a backup's,
// and the guide was then called missing)
function sfLoadDesign(id) {
  const meta = state.saved.find((s) => s.id === id && s.type === 'guide');
  sfLoadDesign.errs.delete(id);
  if (!meta) return Promise.resolve(null);
  return IDB.get('guide-' + id)
    .then(function (payload) {
      if (!payload) return null;
      return Object.assign({ id: id, name: meta.name, W: meta.W, H: meta.H }, payload);
    })
    .catch(function (e) {
      sfLoadDesign.errs.set(id, (e && e.name) || 'Error');
      return null;
    });
}
sfLoadDesign.errs = new Map();
sfLoadDesign.errOf = function (id) {
  return sfLoadDesign.errs.get(id) || '';
};
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
  // (v314: and its photo of the finished page)
  IDB.del('fin-' + id).catch(function () {});
  // (v318.34: and its source picture, guide/25-source-photo.js)
  IDB.del('src-' + id).catch(function () {});
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
// (v314) a guide's photo of its finished page ('fin-<id>' beside 'guide-<id>': guide/24-page-photo.js), as stored and
// as a backup carries it; a record bigger than FIN_MAX is left out (one photo is about 0.4 MB)
const FIN_MAX = 8e6;
function finRecOk(r) {
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.u === 'string' &&
    // (the whole of it: base64 only, as safeThumb checks a thumbnail; it goes into the page as an <img>'s src)
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.u) &&
    r.u.length < FIN_MAX &&
    +r.w > 0 &&
    +r.h > 0
  );
}
// (v314.1) a Library row's note of its straightened photo's shape (fa, width ÷ height), for Home's latest piece to be laid
// out in it from the start; none for a photo kept as taken, or none at all
// (v318.34) a guide's source picture ('src-<id>' beside 'guide-<id>': guide/25-source-photo.js), as stored and as a
// backup carries it when "Include guide photos" is ticked; a record bigger than SRC_MAX is left out (a photo at 2400 px
// is about 1–3 MB)
const SRC_MAX = 8e6;
function srcRecOk(r) {
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.u === 'string' &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.u) &&
    r.u.length < SRC_MAX &&
    +r.w > 0 &&
    +r.h > 0
  );
}
// (v318.34) a guide's source picture put in from a backup, as finFill does its photo of the finished page
function srcFill(id, rec, over) {
  if (!id || !srcRecOk(rec)) return Promise.resolve();
  return (over ? Promise.resolve(null) : IDB.get('src-' + id))
    .then(function (here) {
      if (!srcRecOk(here) || (+rec.ts || 0) > (+here.ts || 0)) return IDB.put('src-' + id, rec);
    })
    .catch(function () {});
}
// (v318.34) whether a backup takes the guides' source pictures: the tick box in the Library and in Back up & restore
// (off by default, the backup being far bigger with them; the two show the same choice)
function bkPhotos() {
  const a = $('bkPhotos'),
    b = $('bkPhotos2');
  return !!((a && a.checked) || (b && b.checked));
}
function finRowShape(row, rec) {
  if (!row) return;
  if (finRecOk(rec) && rec.flat) row.fa = Math.round((rec.w / rec.h) * 10000) / 10000;
  else delete row.fa;
}
// (v318.34) withPhotos: the guides' source pictures too (src-<id>), when "Include guide photos" is ticked
function gatherGuides(withPhotos) {
  var gs = state.saved.filter(function (s) {
      return s.type === 'guide';
    }),
    marks = {};
  return Promise.all(
    gs.map(function (s) {
      // (how far along it is as it's read, for its "backed up" mark, v328 review 2: taken now, a photo of the finished
      // page added meanwhile changing the row in place)
      const mk = Math.max(+s.ts || 0, +s.fn || 0);
      return Promise.all([
        IDB.get('guide-' + s.id),
        // (v314: its photo of the finished page, when it has one; one that can't be read is left out, the guide kept)
        IDB.get('fin-' + s.id).catch(function () {
          return null;
        }),
        withPhotos === true
          ? IDB.get('src-' + s.id).catch(function () {
              return null;
            })
          : null,
      ])
        .then(function (r) {
          // (v318 review: a guide not stored at all is said apart from one that couldn't be read: backing up again
          // won't bring it back)
          if (r[0] == null) return { gone: s.id };
          const pl = r[0],
            o = pl
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
          if (o && finRecOk(r[1])) o.fin = r[1];
          if (o && srcRecOk(r[2])) o.src = r[2];
          if (o) marks[s.id] = mk;
          return o;
        })
        .catch(function () {
          return null;
        });
    }),
  )
    .then(function (a) {
      // (the Library guides that couldn't be read, left out of the backup: said, not "Backed up ✓", v304)
      var b = a.filter(function (x) {
        return x && x.gone == null;
      });
      b.goneNames = gs
        .filter(function (s, i) {
          return a[i] && a[i].gone != null;
        })
        .map(function (s) {
          return s.name || 'Guide';
        });
      b.goneIds = a
        .filter(function (x) {
          return x && x.gone != null;
        })
        .map(function (x) {
          return x.gone;
        });
      b.missedIds = gs
        .filter(function (s, i) {
          return !a[i];
        })
        .map(function (s) {
          return s.id;
        });
      b.missed = b.missedIds.length;
      b.marks = marks;
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
      // (v318.25: a button the keyboard was on, which the browser left as it was disabled: focus back on it, not the
      // page's start)
      if (x._kf && (!document.activeElement || document.activeElement === document.body))
        x.focus({ preventScroll: true });
      x._kf = false;
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
    b0._kf = document.activeElement === b0;
    b0.textContent = 'Preparing…';
    b0.disabled = true;
  }
  // (v318.34: the tick box read before the wait, as the person left it)
  const withPhotos = bkPhotos();
  return Promise.resolve(window.SF && SF.flushSave ? SF.flushSave() : null)
    .catch(function () {})
    .then(function () {
      return gatherGuides(withPhotos);
    })
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
          // (v328 review 2: marked as far as it was when read: one saved while the backup was being made, another
          // tab's or Continue's, is still to back up; it had been marked by the time the file was made)
          if (ids[s.id] != null)
            s.bk = Math.max(1, guides.marks && guides.marks[s.id] != null ? guides.marks[s.id] : ids[s.id]);
          // (not stored here at all: said below, and not counted as still to back up, which no backup can do)
          else if (guides.goneIds.indexOf(s.id) >= 0) s.bk = now;
          else if (!+s.bk) s.bk = 1; /* not in this backup (it couldn't be read): still to back up */
        });
        save();
        const bb = document.getElementById(bid),
          card = bb && bb.closest('.nudge'),
          fa = document.activeElement,
          foc = !!card && (!fa || fa === document.body || card.contains(fa));
        renderBackupNudge();
        renderLibStat();
        const miss = guides.missed || 0,
          gone = guides.goneNames.length,
          goneW = !gone
            ? ''
            : (gone === 1
                ? '\u201c' + guides.goneNames[0] + '\u201d isn\u2019t'
                : gone + ' guides aren\u2019t') +
              ' stored on this device any more, so ' +
              (gone === 1 ? 'it isn\u2019t' : 'they aren\u2019t') +
              ' in it. If ' +
              (gone === 1 ? 'it won\u2019t' : 'they won\u2019t') +
              ' open from the Library, delete ' +
              (gone === 1 ? 'it' : 'them') +
              ' there.';
        if (miss)
          toast(
            'Backed up, but ' +
              nWord(miss, 'guide') +
              ' couldn\u2019t be read and ' +
              (miss === 1 ? 'isn\u2019t' : 'aren\u2019t') +
              ' in it. Reload Marker Studio and back up again before deleting anything.' +
              (goneW ? ' ' + goneW : ''),
            10000,
          );
        else if (gone) toast('Backed up, but ' + goneW, 10000);
        if (bb && bb.isConnected && bb.getClientRects().length)
          _btnFlash(bid, how === 'share' ? 'Saved ✓' : 'Downloaded ✓', label);
        else {
          _btnFlash(bid, label, label, 10);
          if (!miss && !gone) toast('Backed up ✓');
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
            (guides.missed ? ' \u2014 ' + nWord(guides.missed, 'guide') + ' couldn\u2019t be read' : '') +
            (gone ? ' \u2014 ' + nWord(gone, 'guide') + ' not stored on this device' : '') +
            (guides.missed || gone ? '' : ' ✓');
        return true;
      }
      function failed(big) {
        _btnFlash(bid, label, label, 10);
        var _b = document.getElementById(bid);
        errCard(
          _b && _b.parentNode,
          // (v328 review 2: too big to make, with the guides' photos: said so, as trying again fails the same way)
          (big && withPhotos
            ? 'The backup is too big to make on this device with the guides\u2019 photos. Untick <b>Include guide photos</b>' +
              (bid === 'bkGo' ? ' (in <b>Library \u203a Back up</b>)' : '') +
              ' and back up again, or copy your markers and palettes as text '
            : 'The backup couldn\u2019t be saved on this device. Try again, or copy your markers and palettes as text ') +
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
        // (v328 review 2: each guide written apart, the file made from the parts: one string of the whole Library,
        // with its photos, could pass the most a string can hold; the same file as before)
        const GH = '@@ms-guides-here-' + Date.now().toString(36) + Math.random().toString(36).slice(2) + '@@',
          head = JSON.stringify({
            v: 3,
            type: 'ms-backup',
            // (v308: the version that made it, so an older one can say it's from a newer version)
            app: appVersion(),
            ts: now,
            owned: [...state.owned],
            wish: state.wish,
            ink: state.ink,
            // (v318.21: what each marker's cap says, and the setting for the rest: caps.js)
            cap: state.cap,
            capDef: state.capDef,
            capQ: state.capQ,
            capOffer: state.capOffer,
            buyBrands: state.buyBrands,
            saved: state.saved.filter(function (s) {
              return s.type !== 'guide';
            }),
            guides: GH,
            // (v318 review: the beta's Tester tasks answers, until they're sent; tester.js)
            tester:
              typeof window.testerBackup === 'function' ? window.testerBackup() || undefined : undefined,
          }),
          at = head.indexOf('"' + GH + '"'),
          parts = [head.slice(0, at), '['];
        guides.forEach(function (g, i) {
          if (i) parts.push(',');
          parts.push(JSON.stringify(g));
        });
        parts.push(']', head.slice(at + GH.length + 2));
        blob = new Blob(parts, { type: 'application/json' });
      } catch (e) {
        return failed(true);
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
  'Couldn\u2019t restore \u2014 this browser\u2019s storage is full, so nothing was changed. Delete a few guides in the Library and in Recently deleted, then try again.';
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
    // (v329: a big backup's head has guides: [] and the count beside it, _guidesN: backupScan)
    what =
      o && ((Array.isArray(o.guides) && o.guides.length) || o._guidesN)
        ? 'palettes and guides are'
        : 'palettes are';
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
    cap: Object.assign({}, state.cap),
    capDef: state.capDef,
    capQ: state.capQ,
    // (v318.22 debug: and the offer's flag: a restore's Undo had left it as the restore set it)
    capOffer: state.capOffer,
  };
}
// the markers, To buy, ink and Brands I'd buy now, as a short fingerprint
function mkSig(s) {
  s = s || mkSnap();
  return leaveHash(
    JSON.stringify(
      [
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
      ].concat(
        // (v318.21: what caps say, only when there's any: a fingerprint kept by v318.20 still matches)
        (s.cap && Object.keys(s.cap).length) || s.capDef
          ? [
              Object.keys(s.cap || {})
                .sort()
                .map(function (k) {
                  return k + s.cap[k];
                }),
              s.capDef || '',
            ]
          : [],
      ),
    ),
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
  if (snap.cap) {
    state.cap = cleanCap(snap.cap);
    state.capDef = snap.capDef === 'old' ? 'old' : '';
    state.capQ = snap.capQ ? 1 : 0;
    state.capOffer = snap.capOffer ? 1 : 0;
  }
  if (!save(true)) {
    state.owned = new Set(was.owned);
    state.wish = was.wish;
    state.ink = was.ink;
    state.buyBrands = was.buy;
    state.cap = was.cap;
    state.capDef = was.capDef;
    // (v318.22 debug: and the question's and the offer's flags, as the rest)
    state.capQ = was.capQ;
    state.capOffer = was.capOffer;
    toast('Couldn’t put your markers back — this browser’s storage is full.', 6000);
    return false;
  }
  preRestoreDrop();
  wishChanged();
  if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
  // (v318.21 debug: the caps put back: the open guide's labels drawn again)
  if (snap.cap) capChanged();
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
      cap: Object.assign({}, state.cap),
      capDef: state.capDef,
      capQ: state.capQ,
      capOffer: state.capOffer,
    },
    snap = mkSnap(),
    sig0 = mkSig(snap),
    back = function () {
      state.owned = was.owned;
      state.saved = was.saved;
      state.wish = was.wish;
      state.ink = was.ink;
      state.buyBrands = was.buy;
      state.cap = was.cap;
      state.capDef = was.capDef;
      // (v318.22 debug: the question's and the offer's flags too: a restore that failed for room left them changed)
      state.capQ = was.capQ;
      state.capOffer = was.capOffer;
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
    const wr = wishRestore(o, false, state.owned),
      capN = capRestore(o, false);
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
    if (n || wr.wish || ink || bb || added || capN) {
      if (!save(true)) return back();
      if (wr.wish || ink || added) wishChanged();
      if (bb || added) {
        if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
        if (typeof buySumSync === 'function') buySumSync();
      }
      if (capN) capChanged();
      fullRender();
    }
    const r = { mk: false, pals: n, wish: wr.wish, low: wr.low, dry: wr.dry, buy: bb };
    if (added) r.add = added;
    return undoable(r);
  }
  if (!same) state.owned = own;
  // (the same markers: the lists merge as for Keep mine, v305)
  const wr = wishRestore(o, !same, same ? state.owned : null);
  if (capRestore(o, !same)) capChanged();
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
        : why === 'none'
          ? 'That backup is empty \u2014 there\u2019s nothing in it to restore.'
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
  // (v318 audit: one that couldn't be checked for want of memory is said as that: restoring again may bring it)
  const mem = Math.min(x.bad || 0, x.mem || 0);
  if (x.bad > mem) p.push(nWord(x.bad - mem, 'guide') + ' couldn’t be read');
  if (mem)
    p.push(
      nWord(mem, 'guide') +
        ' couldn’t be checked — this device is short of memory: close other apps or tabs, then restore again',
    );
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
    // (v318 polish)
    r.tester ? 'your Tester tasks answers' : '',
  ]);
}
const TESTER_BACK = 'Your Tester tasks answers came back.';
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
// (v329) A big backup read a slice at a time. Read whole, a backup with its guides' photos needed about five times its
// size in memory (the text, then everything made from it: 990 MB for a 192 MB file, measured), more than an iPad lets
// a page have. backupScan goes through the file's bytes in slices (JSON's structure is ASCII, and the other bytes of
// UTF-8 never look like it, so a character split between two slices doesn't matter) and finds the top-level "guides"
// list and where each of its guides begins and ends. The rest of the file (the markers, palettes and settings) is read
// as the head, with guides: []; each guide is read by itself when restoreGuideList reaches it. Resolves
// { head, n, guide(i) }, or null for a file that isn't a backup laid out that way (the whole-file path then says why).
const RESTORE_BIG = 10e6,
  RESTORE_SLICE = 4 << 20;
function backupScan(file, slice) {
  const SL = slice || RESTORE_SLICE,
    size = file.size;
  let depth = 0,
    inStr = false,
    esc = false,
    pos = 0,
    keyBuf = null,
    lastKey = '',
    afterColon = false,
    arrStart = -1,
    arrEnd = -1,
    elStart = -1,
    inGuides = false,
    topIsObj = null;
  const els = [];
  const bytes = function (b) {
    for (let i = 0; i < b.length; i++, pos++) {
      const c = b[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === 92) esc = true;
        else if (c === 34) {
          inStr = false;
          if (keyBuf) {
            lastKey = keyBuf.length <= 16 ? String.fromCharCode.apply(null, keyBuf) : '';
            keyBuf = null;
          }
        } else if (keyBuf && keyBuf.length <= 16) keyBuf.push(c);
        continue;
      }
      if (c === 34) {
        inStr = true;
        if (depth === 1 && topIsObj && !afterColon) keyBuf = [];
        if (inGuides && depth === 2 && elStart < 0) elStart = pos;
        continue;
      }
      if (c === 58) {
        if (depth === 1) afterColon = true;
        continue;
      }
      if (c === 44) {
        if (depth === 1) afterColon = false;
        if (inGuides && depth === 2 && elStart >= 0) {
          els.push([elStart, pos]);
          elStart = -1;
        }
        continue;
      }
      if (c === 123 || c === 91) {
        if (topIsObj === null) topIsObj = c === 123;
        if (depth === 1 && topIsObj && afterColon && c === 91 && lastKey === 'guides' && arrStart < 0) {
          arrStart = pos;
          inGuides = true;
          depth++;
          continue;
        }
        if (inGuides && depth === 2 && elStart < 0) elStart = pos;
        depth++;
        continue;
      }
      if (c === 125 || c === 93) {
        depth--;
        if (inGuides && depth === 1) {
          if (elStart >= 0) els.push([elStart, pos]);
          elStart = -1;
          inGuides = false;
          arrEnd = pos;
        }
        continue;
      }
      // (a number, true, false or null as an element)
      if (inGuides && depth === 2 && elStart < 0 && c > 32) elStart = pos;
    }
  };
  let off = 0;
  const step = function () {
    if (off >= size) return Promise.resolve();
    const end = Math.min(size, off + SL);
    return file
      .slice(off, end)
      .arrayBuffer()
      .then(function (buf) {
        bytes(new Uint8Array(buf));
        off = end;
        return step();
      });
  };
  return step().then(function () {
    if (inStr || depth !== 0 || !topIsObj || arrStart < 0 || arrEnd < 0) return null;
    return Promise.all([file.slice(0, arrStart + 1).text(), file.slice(arrEnd).text()]).then(function (t) {
      let head = null;
      try {
        head = JSON.parse(t[0] + t[1]);
      } catch (_) {
        return null;
      }
      if (!head || typeof head !== 'object' || !Array.isArray(head.guides)) return null;
      return {
        head: head,
        n: els.length,
        guide: function (i) {
          return file
            .slice(els[i][0], els[i][1])
            .text()
            .then(function (x) {
              return JSON.parse(x);
            });
        },
      };
    });
  });
}
// (v329) a big file: the button says what's happening while it's gone through, before "Restoring 1 of 60…"
function restoreReading(bid) {
  const b = document.getElementById(bid);
  if (b) b.textContent = 'Reading the backup…';
  liveSay('Reading the backup…');
}
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
  // (v329: d the file's contents, text its words (or its first 64 KB: why it isn't a backup); lazy, for a big backup,
  // its guides as backupScan found them, read one at a time)
  var parsed = function (d, text, lazy) {
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
      bad(d ? 'bad' : fileTrouble(file, text));
      return;
    }
    var guides = null,
      collection = false,
      fts = +d.ts || 0;
    if (d.type === 'ms-backup') {
      collection = true;
      guides = lazy || (Array.isArray(d.guides) ? d.guides : []);
    } else if (d.type === 'ms-guides' && Array.isArray(d.guides)) guides = lazy || d.guides;
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
  fr.onload = function () {
    var d = null;
    try {
      d = JSON.parse(fr.result);
    } catch (e) {}
    parsed(d, fr.result);
  };
  fr.onerror = function (e) {
    fin();
    errLog('Restoring a backup', (e && e.message) || fr.error || 'the file couldn’t be read');
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
  // (v329) a big file a slice at a time (backupScan); one that isn't a backup laid out as the app writes them is said
  // from its start, not read whole
  if (
    file &&
    file.size > RESTORE_BIG &&
    file.slice &&
    typeof Blob !== 'undefined' &&
    Blob.prototype.arrayBuffer
  ) {
    restoreReading(bid);
    backupScan(file)
      .then(function (sc) {
        if (sc) {
          sc.head._guidesN = sc.n;
          return parsed(sc.head, '', { length: sc.n, get: sc.guide });
        }
        return file
          .slice(0, 65536)
          .text()
          .then(function (t) {
            parsed(null, t);
          });
      })
      .catch(fr.onerror);
    return;
  }
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
  // (v318.25: a guide waiting in Recently deleted that differs from the backup's: left there, the backup's beside it)
  if (x.bin)
    s +=
      ' ' +
      nWord(x.bin, 'guide') +
      ' in Recently deleted ' +
      (x.bin > 1
        ? 'were left there (Put back brings them back as they were)'
        : 'was left there (Put back brings it back as it was)') +
      ', and the backup’s version added as “(from backup)”.';
  return s;
}
// restoreAny once the question about markers (if any) is answered; fin: the restore is over (called once)
function restoreGo(d, fts, guides, collection, rep, bid, label, cap, done, fin) {
  fin = fin || function () {};
  // (v318 review) the Tester tasks answers a backup carries: yours stay, the ones you haven't given come in
  // (v318 polish: and the summary says they came back, tw)
  var tn = 0,
    tw = '';
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
    // (v318.22 debug: the Tester tasks' answers only once the collection came in: a restore that failed for room, which
    // says nothing was changed, had changed them)
    if (d && typeof d === 'object' && d.tester && typeof window.testerRestore === 'function')
      try {
        tn = +window.testerRestore(d.tester) || 0;
      } catch (_) {}
    tw = tn ? TESTER_BACK : '';
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
        guides: Math.max(0, g - (copies || 0) - (x.lost || 0) - (x.bin || 0)),
        dup: x.dup || 0,
        ahead: x.ahead || 0,
        bad: x.bad || 0,
        mem: x.mem || 0,
        full: x.full || 0,
        // (what was kept beside the backup's guides: the Welcome and Home's note say it too, v304)
        copies: copies || 0,
        kept: x.kept || 0,
        lost: x.lost || 0,
        bin: x.bin || 0,
        undo: col && col.undo ? col.undo : null,
        // (nothing came back: your markers matched the backup's, or were kept)
        same: !!(col && col.same),
        tester: tn,
        keptMine: !!(col && !col.mk && !col.add && !col.same && state.owned.size),
      };
    };
    if (!guides || !guides.length) {
      fin();
      if (collection) {
        var said = [restoredWords(col), tw].filter(Boolean).join(' ');
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
      if (collection) {
        if (done) done(got(0));
        return;
      }
      // (v328: a guides backup with no guides in it said nothing at all)
      _btnFlash(bid, label, label, 10);
      if (cap) cap.textContent = '';
      if (done) {
        done(null, 'none');
        return;
      }
      var eb = document.getElementById(bid);
      errCard(eb && eb.parentNode, restoreWhy('none'));
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
        var msg = guideRestoreWords(col, Math.max(0, ok - (copies || 0) - (x.lost || 0) - (x.bin || 0)), x),
          kw =
            restoreKeptWords({ copies: copies, kept: x.kept, lost: x.lost, bin: x.bin }) +
            (tw ? ' ' + tw : '');
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
            esc(msg) + ' Delete a few guides in the Library and in Recently deleted, then restore again.',
          );
          return;
        }
        restoreToast(msg, copies || x.bad || x.kept || x.lost || x.bin || x.ahead ? 7000 : 3500, col);
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
  // (v318.25: and not brought back by the merge with another tab's save, as an empty row once its guide is deleted)
  forgetSaved(id);
  if (save(true)) {
    IDB.del('guide-' + id).catch(function () {
      return null;
    });
    // (v328: and its photos, as a guide deleted from the Library: they were left behind, unseen, taking room)
    IDB.del('fin-' + id).catch(function () {});
    IDB.del('src-' + id).catch(function () {});
  }
}
// (v314) a guide's photo of its finished page put in from a backup (over one here only when over is set; v315: or
// when the backup's is newer, as when moving to another device after changing the photo)
function finFill(id, rec, over) {
  if (!id || !finRecOk(rec)) return Promise.resolve();
  return (over ? Promise.resolve(null) : IDB.get('fin-' + id))
    .then(function (here) {
      if (!finRecOk(here) || (+rec.ts || 0) > (+here.ts || 0))
        return IDB.put('fin-' + id, rec).then(function () {
          // (the row's note of its shape, for Home: v314.1)
          finRowShape(
            state.saved.find(function (s) {
              return s.id === id;
            }),
            rec,
          );
          save(true);
        });
    })
    .catch(function () {});
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
        // (v328: and Tick off from a photo's printout-or-page answer: not the plan)
        if (
          k === 'prog' ||
          k === 'tones' ||
          k === 'held' ||
          k === 'dates' ||
          k === 'tickRef' ||
          // (v328 review: and what colouring itself changes: the coloured-in offer taken, Focus mode's section, the
          // running-low lines closed)
          k === 'colOffer' ||
          k === 'focusAt' ||
          k === 'lowX' ||
          k === 'visT' ||
          p[k] === undefined
        )
          return;
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
        // (v328 review 2: a photo-made page's photo tones of the sections coloured, pp.th, grow as it's coloured:
        // compared below, as the ticks are)
        if (k === 'pp' && p.pp && typeof p.pp === 'object') {
          const q = Object.assign({}, p.pp);
          delete q.th;
          o.pp = q;
          return;
        }
        o[k] = p[k];
      });
    return JSON.stringify(o);
  };
  if (strip(h) !== strip(b)) return false;
  const bth = b.pp && b.pp.th && typeof b.pp.th === 'object' ? b.pp.th : {},
    hth = h.pp && h.pp.th && typeof h.pp.th === 'object' ? h.pp.th : {};
  for (const l in bth) if (JSON.stringify(hth[l]) !== JSON.stringify(bth[l])) return false;
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
// (v318 review) a section map stored whole: a PNG data: URL that ends with the file's last chunk (IEND), as one cut
// short or overwritten doesn't
function pngWhole(u) {
  if (typeof u !== 'string' || u.indexOf('data:image/png;base64,') !== 0) return false;
  const b = u.slice(22);
  if (b.length < 24 || b.length % 4) return false;
  try {
    return /IEND\xae\x42\x60\x82$/.test(atob(b.slice(-16)));
  } catch (_) {
    return false;
  }
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
    // (of those, the ones that couldn't be checked for want of memory, v318 audit)
    mem = 0,
    full = 0,
    kept = 0,
    lost = 0,
    bin = 0,
    ahead = 0;
  function same(js, lm, ids) {
    var k = 0;
    function step() {
      if (k >= ids.length) return Promise.resolve(false);
      var id = ids[k++];
      // (the id of the guide here that's the same: v314, for its photo)
      return IDB.get('guide-' + id).then(function (p) {
        return p && p.lmap === lm && JSON.stringify(p) === js ? id : step();
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
      // (v314.1: Home's latest piece drawn afresh: a photo put in for a guide whose row is unchanged)
      var _hh = document.getElementById('homeHero');
      if (_hh) _hh.removeAttribute('data-hid');
      renderRecent();
      // (v315: and the open guide's, if a newer one came in)
      if (window.SF && SF.finRefresh) SF.finRefresh();
      if (done)
        done(ok, copies, {
          dup: dup,
          ahead: ahead,
          bad: bad,
          mem: mem,
          full: full,
          openRep: openRep,
          kept: kept,
          lost: lost,
          bin: bin,
        });
      // (a lost guide left beside the backup's copy is offered on Home, v304)
      if (lost && typeof lostRefresh === 'function') lostRefresh();
      return;
    }
    var gi = i++;
    if (prog) prog(i, guides.length);
    // (v329: a big backup's guides are read from the file one at a time, as each is reached: guides.get, backupScan)
    if (guides.get) {
      guides.get(gi).then(one, function (e) {
        errLog('Restoring a backup', e);
        bad++;
        next();
      });
      return;
    }
    one(guides[gi]);
  }
  function one(g) {
    if (g && !+g.ts && _fts) g.ts = _fts;
    if (!(g && g.payload && typeof g.payload === 'object')) {
      bad++;
      next();
      return;
    }
    check(g.payload).then(function (c) {
      if (!c || !c.ok) {
        bad++;
        if (c && c.why === 'memory') mem++;
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
            // (v314: the backup's photo of the finished page, for the same guide here without one)
            // (v318.34: and its source picture, when the backup has it)
            Promise.all([
              finFill(isDup === 'ahead' ? _ex.id : isDup, g.fin, false),
              srcFill(isDup === 'ahead' ? _ex.id : isDup, g.src, false),
            ]).then(next);
            return;
          }
          var copy = false,
            isLost = false,
            isBin = false,
            kid = null;
          // (v304) a guide stored under this id that no Library row points to (a lost guide: its row couldn't be read) may
          // be newer than the backup's: it is left as it is, to be added back from Home, and the backup's copy comes in
          // beside it. Not one whose delete is still finishing (Undo showing, or to finish at the next start): the
          // backup's copy takes its place, as before
          // (v304) a Library guide changed here since its last backup, about to be replaced by the backup's newer copy, is
          // kept first as "… (before restore)"
          var pe =
              !_ex && _gid
                ? libPendList().find(function (x) {
                    return x.id === _gid;
                  })
                : null,
            pend = !!pe,
            // (v318.25: past its Undo, waiting in Recently deleted for a week since v318.1: its stored copy may hold
            // more than the backup's, so it is read as a lost guide's is, and left there when it differs)
            // (v318.28: only one with its row kept (e), as Recently deleted lists them: a delete with none, still
            // finishing (an import that never opened, one from before v318.1), isn't there and is finished at the next
            // start; the backup's copy takes its place, as before, rather than come in as "(from backup)" beside a
            // guide said to be "left there")
            binned = pend && !!pe.e && !(libPend && libPend.entry && libPend.entry.id === _gid),
            bust = !!_ex && _damaged.has(_ex.id),
            atRisk =
              !bust &&
              _ex &&
              (+_ex.ts || 0) <= (+g.ts || 0) &&
              (+_ex.ts || 0) > (+_ex.bk || lastGuideBackup());
          // (v318 review) a guide called damaged as it opened whose stored section map is a whole PNG may only have
          // failed to open for want of memory: it is kept as "… (before restore)" too, when it differs from the
          // backup's, rather than replaced unseen by an older copy
          ((!_ex && _gid && (!pend || binned)) || atRisk || bust
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
                if (binned) isBin = true;
                else isLost = true;
                return;
              }
              if (_ex && !bust && (+_ex.ts || 0) > (+g.ts || 0)) {
                _gid = _newGuideId();
                _nm = _cn;
                copy = true;
                return;
              }
              if (!_gid) _gid = _newGuideId();
              if (!(differs && (atRisk || (bust && pngWhole(here.lmap))))) return;
              // (v318 polish) and only when it opens here, or couldn't be checked for want of memory: a whole PNG may
              // still not decode, or be the wrong size, and a copy kept aside that can't open is no use
              return (
                bust
                  ? check(here).then(function (c) {
                      return !!c && (c.ok || c.why === 'memory');
                    })
                  : Promise.resolve(true)
              ).then(function (keep) {
                if (!keep) return;
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
                    // (v314: the guide kept aside keeps its photo of the finished page too; v318.34: and its source
                    // picture)
                    if (k)
                      return Promise.all([
                        IDB.get('fin-' + _ex.id)
                          .then(function (r) {
                            return finFill(k, r, true);
                          })
                          .catch(function () {}),
                        IDB.get('src-' + _ex.id)
                          .then(function (r) {
                            return srcFill(k, r, true);
                          })
                          .catch(function () {}),
                      ]);
                  });
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
                  // (v314: its photo of the finished page, from the backup, when the backup has one; a photo here is
                  // left as it is when the backup's guide has none)
                  const finIn = finRecOk(g.fin);
                  if (bust) _damaged.delete(_ex.id);
                  if (kid) kept++;
                  if (isLost) lost++;
                  else if (isBin) bin++;
                  else if (copy) copies++;
                  // (the guide open on the Guide screen, replaced by the backup's newer copy: said in the summary, v289)
                  else if (_ex && open && open.id === id) openRep = _ex.name || open.name;
                  const m = state.saved.find(function (x) {
                    return x.id === id;
                  });
                  // (a photo that came with it is backed up too)
                  if (m) m.bk = finIn ? Math.max(m.ts || 1, +m.fn || 0) : m.ts || 1;
                  // (put in before the guide is opened again, below)
                  // (v318.34: and its source picture, when the backup has one; one here is left when it hasn't)
                  Promise.all([
                    finIn ? finFill(id, g.fin, true) : Promise.resolve(),
                    srcRecOk(g.src) ? srcFill(id, g.src, true) : Promise.resolve(),
                  ]).then(function () {
                    // (also a guide deleted while open, restored with the same id: the open copy becomes the restored one,
                    // v289; libChanged leaves any other guide alone)
                    if (window.SF && SF.libChanged) SF.libChanged(id, 'replaced');
                    next();
                  });
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
  // (v328 review 2: counted from what the guide plans with: your markers not dry, or with none added the brands you'd
  // buy, as sfCollection; "Copic 358" had been offered with Only Ohuhu chosen)
  const po = function (i) {
    return !NOINK.has(i) && (state.owned.size ? isOwned(i) && !isDry(i) : buyOk(i));
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
