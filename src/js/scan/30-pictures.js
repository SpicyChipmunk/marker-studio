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
// (v318.21) And each photo with a question waiting, as it was shown (its copy up to 900 px, a JPEG of about 100–150
// KB), for "Where in the photo?" (15-answer.js): kept by its id, 'photo:' + e.pid, as long as a question of it waits,
// at most 30, the newest; each question's row keeps where its cap is (e.where) and the caps read beside it (e.near)
const SCAN_PICS_DB = 'ms-scan-pics',
  SCAN_PICS_MAX = 60,
  SCAN_PHOTOS_MAX = 30;
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
  // (v318.21) the photos kept, by id: a data URL each
  const photos = new Map();
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
    entries.forEach(function (e) {
      if (!e.ask || !e.crop) return;
      want.set(
        e.ask,
        e.where ? { crop: e.crop, pid: e.pid, where: e.where, near: e.near || [] } : { crop: e.crop },
      );
      if (e.pid && photos.has(e.pid)) want.set('photo:' + e.pid, { photo: photos.get(e.pid) });
    });
    // (a photo no question of which waits: let go of here too)
    [...photos.keys()].forEach((pid) => !want.has('photo:' + pid) && photos.delete(pid));
    const add = [...want.keys()].filter((k) => !written.has(k) && !pending.has(k)),
      del = [...written].filter((k) => !want.has(k) && !pending.has(k));
    if (!add.length && !del.length) return;
    add.forEach((k) => pending.add(k));
    del.forEach((k) => pending.add(k));
    const now = Date.now();
    tx('readwrite', function (st) {
      add.forEach(function (k) {
        st.put(Object.assign({ at: now }, want.get(k)), k);
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
        drop = [],
        shots = [];
      let hit = 0;
      got.keys.forEach(function (k, n) {
        const row = got.rows[n];
        if (asks.has(k) && row && typeof row.crop === 'string')
          keep.push({ k: k, at: +row.at || 0, crop: row.crop, row: row });
        // (v318.21: a photo, kept below while a question of it is)
        else if (typeof k === 'string' && k.indexOf('photo:') === 0 && row && typeof row.photo === 'string')
          shots.push({ k: k, at: +row.at || 0, photo: row.photo });
        else drop.push(k);
      });
      keep.sort((x, y) => y.at - x.at);
      keep.splice(SCAN_PICS_MAX).forEach((x) => drop.push(x.k));
      // (the photos of the questions kept, at most SCAN_PHOTOS_MAX, the newest; the rest go)
      const pids = new Set(
        keep
          .map((x) => (Array.isArray(x.row.where) && typeof x.row.pid === 'string' ? x.row.pid : null))
          .filter(Boolean),
      );
      shots.sort((x, y) => y.at - x.at);
      const shotKeep = shots.filter((x) => pids.has(x.k.slice(6))).slice(0, SCAN_PHOTOS_MAX);
      shots.forEach((x) => shotKeep.indexOf(x) < 0 && drop.push(x.k));
      // (v318.21 debug: oldest first, as keepPhoto lets go of the first: newest-first had let a reload's newest go)
      shotKeep
        .slice()
        .reverse()
        .forEach((x) => photos.set(x.k.slice(6), x.photo));
      written = new Set(keep.map((x) => x.k).concat(shotKeep.map((x) => x.k)));
      keep.forEach(function (x) {
        scanList.forEach(function (e) {
          if (e.ask === x.k && !e.crop) {
            e.crop = x.crop;
            // (v318.21: where its cap is, when its photo's kept too)
            if (Array.isArray(x.row.where) && x.row.where.length === 3 && typeof x.row.pid === 'string') {
              e.where = x.row.where.map(Number);
              e.pid = x.row.pid;
              e.near = Array.isArray(x.row.near)
                ? x.row.near.filter((t) => typeof t === 'string').slice(0, 2)
                : [];
            }
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
    photos.clear();
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
  // (v318.21) a photo kept for its questions, and one asked for (null: none kept, or no longer); the rest of this page's
  // photos are let go of once no question of theirs waits (at the next save)
  function keepPhoto(pid, url) {
    if (wiped) return;
    photos.set(pid, url);
    while (photos.size > SCAN_PHOTOS_MAX) photos.delete(photos.keys().next().value);
  }
  function photo(pid) {
    return (pid && photos.get(pid)) || null;
  }
  S.keepPhoto = keepPhoto;
  S.photo = photo;
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
