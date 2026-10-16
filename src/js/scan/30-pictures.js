/* ===== Scan: the pictures of the questions waiting (scan.js 997–1258 until v318.8) ===== */
// A photo's question shows its cap, a small JPEG as a data URL (e.crop, about 30 KB). The pictures of the questions
// waiting are kept in a small database of the app's own, 'ms-scan-pics' (not the guides': a record there could be
// taken for a guide, and a new store there would need a version step, which can block with two tabs open), each by its
// question (ask) with when it was written. Written as the list is saved (scanSaveList), only what's changed: the
// questions not yet written are put, those gone from the list deleted, and nothing at all when nothing's changed (the
// list is saved at every draw). On load, the pictures of the questions restored come a moment later ("?" until then, as
// when there's none, or when the storage fails); the rest are pruned, and at most 60, the newest by the row's time,
// are kept. The database is deleted with Delete all my data (safety.js wipeAllData), and nothing's written after.
// Opened as the guides' is (guide-bridge.js IDB): an open given up after 8 s, the connection let go when it closes or
// a delete asks, every failure quiet
const SCAN_PICS_DB = 'ms-scan-pics',
  SCAN_PICS_MAX = 60;
const scanPics = (function () {
  const OPEN_MS = 8000;
  let dbp = null,
    wiped = false,
    loaded = false,
    // (the asks whose pictures the database holds, as far as this page knows; and those being written now)
    written = new Set(),
    pending = new Set(),
    // (a save asked for before the load answered: done after it; and the last save asked for, done over after a write
    // it came during)
    dirty = null,
    last = null;
  const S = { writes: 0, deletes: 0, loads: 0 };
  function db() {
    if (dbp) return dbp;
    const p = new Promise(function (res, rej) {
      var r,
        done = false;
      const t = setTimeout(function () {
        if (done) return;
        done = true;
        rej(new Error('storage isn’t answering'));
      }, OPEN_MS);
      const end = function () {
        if (done) return false;
        done = true;
        clearTimeout(t);
        return true;
      };
      try {
        if (wiped || typeof indexedDB === 'undefined' || !indexedDB) throw new Error('no storage');
        r = indexedDB.open(SCAN_PICS_DB, 1);
      } catch (e) {
        end();
        rej(e);
        return;
      }
      r.onupgradeneeded = function () {
        r.result.createObjectStore('p');
      };
      r.onsuccess = function () {
        const d = r.result;
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
  // a readwrite transaction's work, done quietly
  function tx(mode, fn) {
    return db()
      .then(function (d) {
        return new Promise(function (res, rej) {
          var t = d.transaction('p', mode);
          const out = fn(t.objectStore('p'));
          if (mode === 'readwrite' && t.commit) t.commit();
          t.oncomplete = function () {
            res(out);
          };
          t.onerror = function () {
            rej(t.error);
          };
          t.onabort = function () {
            rej(t.error || new Error('aborted'));
          };
        });
      })
      .catch(function () {
        return null;
      });
  }
  // the list as saved: its questions' pictures put or deleted as needed, nothing when nothing's changed
  function sync(entries) {
    if (wiped) return;
    if (!loaded) {
      dirty = entries;
      return;
    }
    last = entries;
    const want = new Map();
    entries.forEach((e) => e.ask && e.crop && want.set(e.ask, e.crop));
    const add = [...want.keys()].filter((k) => !written.has(k) && !pending.has(k)),
      del = [...written].filter((k) => !want.has(k) && !pending.has(k));
    if (!add.length && !del.length) return;
    add.forEach((k) => pending.add(k));
    del.forEach((k) => pending.add(k));
    const now = Date.now();
    tx('readwrite', function (st) {
      add.forEach(function (k) {
        st.put({ crop: want.get(k), at: now }, k);
        S.writes++;
      });
      del.forEach(function (k) {
        st.delete(k);
        S.deletes++;
      });
    }).then(function (ok) {
      add.forEach((k) => pending.delete(k));
      del.forEach((k) => pending.delete(k));
      if (ok !== null) {
        add.forEach((k) => written.add(k));
        del.forEach((k) => written.delete(k));
      }
      // (v318.7 debug: a save that came while these were being written, and left what they cover alone, is done over
      // now: a question dropped at Add and given back by its Undo within the moment had kept no picture until the
      // next draw)
      if (last !== entries && !wiped) sync(last);
    });
  }
  // the pictures of the questions in the list now, from the database, a moment later; the rest pruned, and at most
  // SCAN_PICS_MAX kept, the newest. then(): the list drawn again where it's showing
  function load(then) {
    if (wiped) return Promise.resolve(false);
    S.loads++;
    // (no question waiting: nothing to find, and every picture kept is of a question gone, so the database goes as a
    // whole. Not opened: opening makes one where there's none, and after Delete all my data there must be none)
    if (!scanList.some((e) => e.ask)) {
      try {
        if (typeof indexedDB !== 'undefined' && indexedDB) {
          const r = indexedDB.deleteDatabase(SCAN_PICS_DB);
          r.onerror = r.onblocked = function () {};
        }
      } catch (_) {}
      loaded = true;
      written = new Set();
      if (dirty) {
        const d = dirty;
        dirty = null;
        sync(d);
      }
      return Promise.resolve(false);
    }
    return tx('readonly', function (st) {
      const out = { keys: null, rows: null };
      const a = st.getAllKeys(),
        b = st.getAll();
      a.onsuccess = function () {
        out.keys = a.result || [];
      };
      b.onsuccess = function () {
        out.rows = b.result || [];
      };
      return out;
    }).then(function (got) {
      if (!got || !got.keys || !got.rows || got.keys.length !== got.rows.length) {
        if (!loaded) loaded = true;
        if (dirty) {
          const d = dirty;
          dirty = null;
          sync(d);
        }
        return false;
      }
      const asks = new Set(scanList.filter((e) => e.ask).map((e) => e.ask)),
        keep = [],
        drop = [];
      let hit = 0;
      got.keys.forEach(function (k, n) {
        const row = got.rows[n];
        if (asks.has(k) && row && typeof row.crop === 'string')
          keep.push({ k: k, at: +row.at || 0, crop: row.crop });
        else drop.push(k);
      });
      keep.sort((x, y) => y.at - x.at);
      keep.splice(SCAN_PICS_MAX).forEach((x) => drop.push(x.k));
      written = new Set(keep.map((x) => x.k));
      keep.forEach(function (x) {
        scanList.forEach(function (e) {
          if (e.ask === x.k && !e.crop) {
            e.crop = x.crop;
            hit++;
          }
        });
      });
      loaded = true;
      if (drop.length)
        tx('readwrite', function (st) {
          drop.forEach(function (k) {
            st.delete(k);
            S.deletes++;
          });
        });
      if (dirty) {
        const d = dirty;
        dirty = null;
        sync(d);
      }
      if (hit && then) then();
      return hit > 0;
    });
  }
  // Delete all my data: nothing written from now on, the connection let go (the delete isn't blocked by it)
  function wipe() {
    wiped = true;
    const p = dbp;
    dbp = null;
    if (p)
      p.then(function (d) {
        try {
          d.close();
        } catch (_) {}
      });
  }
  // (v318.7 debug: another tab saved the list while Scan's open here: what the database holds is no longer known, so
  // the next save puts every picture this list wants again. A question answered there, its picture deleted, and still
  // here had been left with none after a reload)
  function forget() {
    written = new Set();
  }
  S.sync = sync;
  S.load = load;
  S.forget = forget;
  S.wipe = wipe;
  S.written = () => [...written];
  return S;
})();
function scanPicsWipe() {
  scanPics.wipe();
}
// (the list drawn again with its pictures, where Scan is open)
function scanPicsShow() {
  const ov = $('scanOverlay');
  if (ov && ov.classList.contains('on')) scanRender();
}
scanPics.load(scanPicsShow);
