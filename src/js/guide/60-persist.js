// the section map is saved as a PNG; encoding it is slow, so the last one is kept until the sections change
// (checked with two cheap hashes of the label array)
let _lmC = null,
  _lastAuto = null;
function labelsSig() {
  let a = 2166136261 | 0,
    b = 5381 | 0;
  const n = W * H;
  for (let i = 0; i < n; i++) {
    const v = labels[i];
    a = Math.imul(a ^ v, 16777619);
    b = (Math.imul(b, 33) + v + i) | 0;
  }
  return W + 'x' + H + ':' + a + ':' + b;
}
function lmapURL() {
  const sig = labelsSig();
  if (_lmC && _lmC.sig === sig) return _lmC.url;
  const url = _lmapURL();
  _lmC = { sig: sig, url: url };
  return url;
}
function _lmapURL() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const im = x.createImageData(W, H),
    d = im.data;
  for (let p = 0, j = 0; p < W * H; p++, j += 4) {
    const v = labels[p] < 0 ? 0 : labels[p] + 1;
    d[j] = v & 255;
    d[j + 1] = (v >> 8) & 255;
    d[j + 2] = (v >> 16) & 255;
    d[j + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  const u = c.toDataURL('image/png');
  freeCanvas(c);
  return u;
}
function guideStale() {
  return !!(assignData && guideSig && labels && labelsSig() !== guideSig);
}
// share: for a guide file to share, which leaves out a photo the pattern doesn't use (to keep it small). edits: the
// guide with section edits not built yet (kept when the page is hidden): only sections still there keep their
// marker, and it reopens in Edit sections to be built. Otherwise a guide with edits not built isn't saved.
function currentDesignObj(share, edits) {
  if (!assignData || !labels || _openEmpty) return null;
  if (!edits && (guideStale() || secEdPending())) return null;
  const abl = {},
    bas = {},
    seen = {},
    keys = [],
    prog = [],
    tones = {},
    out = {},
    P = tonePart && tonePart._c === colored ? tonePart : null,
    here = function (l) {
      return !edits || (!_segFresh && !!comps[l] && !comps[l].merged);
    };
  assignData.order.forEach(function (l) {
    if (!here(l)) return;
    const m = assignData.assign[l],
      o = _origKeys[l],
      b = assignData.base && assignData.base[l];
    // a section showing a stand-in for a dry marker keeps the saved one until it is changed (or pinned)
    abl[l] = o && locks[l] === undefined && o.s.indexOf(m.mkey) >= 0 ? o.k : m.mkey;
    // a pinned section's pattern colour, so Unpin can go back to it after reopening
    if (locks[l] !== undefined && b && b.mkey !== m.mkey) bas[l] = b.mkey;
    if (colored[l]) prog.push(l);
    if (P && P[l]) tones[l] = P[l];
  });
  for (const l in _lostKeys)
    if (abl[l] === undefined && here(+l) && !(assignData.paper && assignData.paper[l])) abl[l] = _lostKeys[l];
  // sections left out of the guide (Edit sections) keep what they had, for when they come back
  for (const l in _gone) {
    if (abl[l] !== undefined || !comps[l] || comps[l].merged || (edits && _segFresh)) continue;
    const g = _gone[l];
    out[l] = { k: g.m.mkey, lock: g.lock, done: colored && colored[l] ? 1 : 0, t: (P && P[l]) || 0 };
  }
  assignData.order.concat(Object.keys(_lostKeys)).forEach(function (l) {
    const k = abl[l];
    if (k && !seen[k]) {
      seen[k] = 1;
      keys.push(k);
    }
  });
  const ssMap = {};
  if (secState) {
    for (let l = 1; l < secState.length; l++)
      if (secState[l]) ssMap[l] = secState[l];
      else if (comps && comps[l] && comps[l].page) ssMap[l] = 2;
  }
  return {
    v: 1,
    type: 'guide',
    name:
      curName ||
      evoName(
        keys.map(function (k) {
          var _i = keyIdx(k);
          return _i != null ? COLORS[_i].hex : null;
        }),
      ),
    W: W,
    H: H,
    keys: keys,
    n: assignData.N,
    payload: Object.assign(
      {
        lmap: lmapURL(),
        ref: !(share && !zoneUsesPhoto())
          ? photoRef && photoXf
            ? photoRef.url
            : _phPend
              ? _phPend.url
              : undefined
          : undefined,
        paper: assignData.paper ? Object.keys(assignData.paper).map(Number) : undefined,
        assign: abl,
        // the style settings, as STYLE_FIELDS lists them (05-style-fields): with zones, Main's (older copies of the app
        // read these and the markers above, so they show a zoned guide's colours as they are)
        style: zones.length
          ? zoneWith(0, function () {
              return styleSave('style');
            })
          : styleSave('style'),
        anchors: zones.length ? zoneRec(0).an : anchors,
        prog: prog,
        tones: tones,
        out: Object.keys(out).length ? out : undefined,
        edits: edits ? 1 : undefined,
        base: Object.keys(bas).length ? bas : undefined,
        locks: locks,
      },
      // the zones besides Main (34-zones), only when there are any
      zones.length ? { zones: zoneSave() } : {},
      // the Sections screen's settings (minPos, bgTrim, addAutoClose), here among the rest
      styleSave('payload'),
      { secStates: ssMap },
    ),
  };
}
// Share › Guide file: handed over as the backup is (handOver: the share sheet on a phone, a download on a computer)
function shareGuideFile() {
  const d = currentDesignObj(true);
  if (!d) return;
  let blob = null;
  try {
    blob = new Blob([JSON.stringify(d)], { type: 'application/json' });
  } catch (e) {
    note('Could not export the guide file.');
    return;
  }
  handOver(
    blob,
    ((d.name || 'guide')
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .slice(0, 40) || 'guide') + '.msguide.json',
    {
      title: d.name || 'Colouring guide',
      text: 'A Marker Studio colouring guide \u2014 open it in Marker Studio (Import a guide) to colour along.',
      what: 'guide file',
    },
  ).then(function (r) {
    if (r === 'download')
      note('Guide file downloaded \u2014 keep it as a backup or move it to another device.');
    else if (r === false) note('Could not export the guide file.');
  });
}
function sampleFromAnywhere() {
  if (!document.getElementById('sfPick')) mount();
  loadSample();
}
function pickPhoto() {
  if (!document.getElementById('sfPick')) mount();
  if (fileEl) fileEl.click();
}
// Before something else opens: a guide in the Library saves its last changes into its entry; a new guide with
// changes is added to the Library. If that fails the switch is stopped, so nothing is lost.
function stashDirty() {
  if (_firstP) return _firstP.then(stashDirty);
  if (!assignData || !api.saveDesign) return Promise.resolve(true);
  if (secEdPending()) return edDecide();
  clearTimeout(autoT);
  autoT = null;
  let d, nm;
  if (!libEntry()) slotAdopt();
  if (libEntry()) {
    nm = libName(libEntry());
    return libAutosave(true).then(function (ok) {
      if (ok || !libEntry()) return true;
      toast(
        saveFailWords(
          'Couldn’t save “' +
            esc(nm) +
            '”, so it’s still open. Free up space (delete or back up guides in the Library), then try again.',
        ),
        8000,
      );
      return false;
    });
  }
  if (!guideDirty) return Promise.resolve(true);
  try {
    d = currentDesignObj();
    if (!d) return Promise.resolve(true);
    nm = d.name || 'Colour guide';
  } catch (e) {
    return Promise.resolve(true);
  }
  const gen = _gTok;
  guideDirty = false;
  const fail = function () {
    guideDirty = true;
    toast(
      saveFailWords(
        'Couldn’t save “' +
          esc(nm) +
          '”, so it’s still open. Free up space (delete or back up guides in the Library), then try again.',
      ),
      8000,
    );
    return false;
  };
  return Promise.resolve(
    api.saveDesign({
      name: nm,
      W: d.W,
      H: d.H,
      keys: d.keys,
      n: d.n,
      payload: d.payload,
      thumb: makeThumb(),
    }),
  ).then(function (id) {
    if (!id) return fail();
    if (gen === _gTok) {
      curId = id;
      _libBase = { id: id, sig: libSig(d) };
      libNote();
    }
    slotClear(gen);
    if (api.refreshSaved) api.refreshSaved();
    toast('Saved “' + esc(nm) + '” to your Library so you don’t lose it.', 4200);
    return true;
  }, fail);
}
// Section edits not built yet (Edit sections): the sections, which are in the guide, or its size and background
// settings differ from when the guide was last built or opened. Until it is built again the guide as built is what
// is kept; the header says so, and opening something else asks first. _edResumed: edits kept when the page was hidden,
// resumed; _edDisc: the person chose to discard them before opening something else.
let _built = null,
  _edResumed = false,
  _edDisc = false,
  _edAsk = null;
function markBuilt() {
  _edResumed = false;
  _edDisc = false;
  _built = assignData && labels && secState ? { ss: secState.slice(), min: minPos, bg: bgTrim } : null;
}
function secEdPending() {
  if (sfmode !== 'review' || !assignData || !labels || _edDisc) return false;
  if (_edResumed) return true;
  const b = _built;
  if (!b) return false;
  if (b.bg !== bgTrim || b.ss.length !== secState.length || minChanges(b.min)) return true;
  for (let l = 1; l < secState.length; l++) if (b.ss[l] !== secState[l]) return true;
  return (hasEdits || _segFresh) && guideStale();
}
// does the smallest section's slider now keep a different set of sections than at `was`? (a nudge that keeps the
// same sections is no edit: the header doesn't ask for a rebuild over it)
function minChanges(was) {
  if (was === minPos) return false;
  const a = minPx(was),
    b = minPx();
  if (a === b) return false;
  const lo = Math.min(a, b),
    hi = Math.max(a, b);
  for (let l = 1; l < comps.length; l++) {
    const c = comps[l];
    if (!c || c.merged || c.bg || secState[l]) continue;
    if (c.area >= lo && c.area < hi) return true;
  }
  return false;
}
// Build guide, Discard edits, or Cancel (stay): a dialog over whatever screen asked
function askEdits() {
  return new Promise(function (res) {
    const o = document.createElement('div'),
      op = document.activeElement;
    o.className = 'overlay on';
    o.id = 'sfEdAsk';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-labelledby', 'sfEdAskT');
    o.innerHTML =
      '<div class="ocard dcard"><div class="mhead"><div class="mtitle" id="sfEdAskT">Section edits not saved</div></div><div class="dsub">Build the guide with your section edits, or discard them?</div><div class="sfedaskbtns"><button type="button" class="btn-primary" data-a="build">Build guide</button><button type="button" data-a="discard">Discard edits</button><button type="button" class="sfghost" data-a="stay">Cancel</button></div></div>';
    const end = function (a) {
      o.remove();
      try {
        if (op && op.isConnected && op !== document.body) op.focus({ preventScroll: true });
      } catch (_) {}
      res(a);
    };
    // a tap on the backdrop is Cancel, and so is Escape (layers.js closes the top dialog as a tap on its backdrop)
    o.addEventListener('click', function (e) {
      const b = e.target.closest('[data-a]');
      if (b) end(b.dataset.a);
      else if (e.target === o) end('stay');
    });
    document.body.appendChild(o);
    try {
      o.querySelector('[data-a="build"]').focus();
    } catch (_) {}
  });
}
// the answer: built (then saved like any change), discarded (the guide as built stays what is kept, and a copy of the
// edits kept for Resume goes), or nothing opens
function edDecide() {
  if (!_edAsk)
    _edAsk = askEdits().then(function (a) {
      _edAsk = null;
      return a;
    });
  return _edAsk.then(function (a) {
    if (a === 'build') {
      if (secEdPending()) buildGuide();
      return secEdPending() || !assignData || sfmode === 'review' ? false : stashDirty();
    }
    if (a === 'discard') {
      _edDisc = true;
      const id = curId;
      if (id != null && libEntry())
        slotOp(function () {
          const m = slotNote();
          if (m && m.edits && m.savedId === id) clearAutosave();
        });
      return stashDirty();
    }
    return false;
  });
}
// the page is hidden with section edits not built: they go to the autosave slot, and Resume brings them back to build
function keepEdits() {
  if (!secEdPending() || !api.saveDesign) return;
  try {
    const d = currentDesignObj(false, true);
    if (d) slotSave(d, true);
  } catch (_) {}
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') keepEdits();
});
window.addEventListener('pagehide', keepEdits);
function importFromHome(file) {
  try {
    localStorage.setItem('ms-onboarded', '1');
  } catch (_) {}
  if (!document.getElementById('sfPick')) mount();
  setMode('sections');
  importGuideFile(file);
}
// A section map's pixels (null when it can't be read), and how many different sections it has (counting stops past cap)
const MAXSECS = 100000,
  TOO_COMPLEX = 'Could not open that guide — it has too many sections (the file is too complex).';
function lmapRead(img) {
  try {
    const w = img.naturalWidth || img.width,
      h = img.naturalHeight || img.height,
      c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    freeCanvas(c);
    return d;
  } catch (e) {
    return null;
  }
}
function lmapCount(d, cap) {
  const seen = new Uint8Array(1 << 21);
  let n = 0;
  for (let j = 0; j < d.length; j += 4) {
    const v = d[j] | (d[j + 1] << 8) | (d[j + 2] << 16);
    if (!v) continue;
    const i = v >> 3,
      b = 1 << (v & 7);
    if (seen[i] & b) continue;
    seen[i] |= b;
    if (++n > cap) return n;
  }
  return n;
}
// A guide from outside (a file, a backup) is checked before it goes into the Library: its section map must be a PNG
// that decodes, at a size a guide can have, with at most MAXSECS sections (the picture's size is taken from it); what's
// in it is kept in range when it opens. One that still fails to open is taken out of the Library again.
// Resolves {ok, w, h} or {ok:false, why: 'bad' | 'size' | 'decode' | 'complex'}.
function guideCheck(pl) {
  return new Promise(function (res) {
    if (
      !pl ||
      typeof pl !== 'object' ||
      typeof pl.lmap !== 'string' ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]{16,}$/.test(pl.lmap)
    ) {
      res({ ok: false, why: 'bad' });
      return;
    }
    const im = new Image();
    im.onload = function () {
      const w = im.naturalWidth || im.width,
        h = im.naturalHeight || im.height;
      if (!(w > 0 && h > 0 && w <= MAXSIDE * 2 && h <= MAXSIDE * 2)) {
        res({ ok: false, why: 'size' });
        return;
      }
      const d = lmapRead(im);
      if (!d) {
        res({ ok: false, why: 'decode' });
        return;
      }
      res(lmapCount(d, MAXSECS) > MAXSECS ? { ok: false, why: 'complex' } : { ok: true, w: w, h: h });
    };
    im.onerror = function () {
      res({ ok: false, why: 'decode' });
    };
    im.src = pl.lmap;
  });
}
function importGuideFile(file) {
  const fr = new FileReader();
  fr.onload = function () {
    let d = null;
    try {
      d = JSON.parse(fr.result);
    } catch (e) {
      note('Could not read that guide file.');
      return;
    }
    if (
      !d ||
      !d.payload ||
      typeof d.payload !== 'object' ||
      typeof d.payload.lmap !== 'string' ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]{16,}$/.test(d.payload.lmap)
    ) {
      note('That is not a valid guide file.');
      return;
    }
    note('Importing\u2026');
    guideCheck(d.payload).then(function (c) {
      if (!c.ok) {
        note(
          c.why === 'size'
            ? 'Could not import that guide \u2014 its picture is the wrong size.'
            : c.why === 'complex'
              ? 'Could not import that guide \u2014 it has too many sections (the file is too complex).'
              : 'Could not import that guide \u2014 its picture didn\u2019t decode.',
        );
        return;
      }
      const w = c.w,
        h = c.h;
      const pl = d.payload,
        sa = pl.assign && typeof pl.assign === 'object' ? pl.assign : {},
        keys = Array.isArray(d.keys)
          ? d.keys
              .filter(function (k) {
                return typeof k === 'string' && keyIdx(k) != null;
              })
              .slice(0, 400)
          : [];
      Promise.resolve(
        api.saveDesign({
          name: typeof d.name === 'string' && d.name.trim() ? d.name.slice(0, 120) : 'Imported guide',
          W: w,
          H: h,
          keys: keys,
          n: Object.keys(sa).length,
          payload: pl,
        }),
      )
        .then(function (id) {
          if (id) {
            _justImported = id;
            if (api.refreshSaved) api.refreshSaved();
            openDesign(id);
          } else note(saveFailWords('Could not import (storage may be full).'));
        })
        .catch(function () {
          note('Could not import that guide.');
        });
    });
  };
  fr.onerror = function () {
    note('Could not read that file.');
  };
  fr.readAsText(file);
}
// Saving has two homes. A guide in the Library saves itself into its entry a moment after each change (and when the
// page is hidden or something else opens). A new guide, not yet saved once, is kept in the autosave slot (IDB
// 'guide-autosave' + a small note in localStorage) so the Sections screen can offer to resume it.
let _libBase = null,
  _libBusy = null,
  _saveErr = false,
  _firstBusy = false,
  _firstP = null,
  _delDirty = false,
  _gTok = 0,
  _slotTok = -1,
  _slotQ = null,
  _slotWarn = -1,
  _justImported = null;
// how a reopened guide's saved markers are shown (97-open): sections showing a stand-in keep the saved key
// ({k, s: marker keys that mean "unchanged"}); keys the catalogue doesn't know are kept as they were; a guide that
// opened with nothing to show is never saved
let _origKeys = {},
  _lostKeys = {},
  _openEmpty = false;
// a different guide or picture is being put in place (from resetForNewPicture): what is known about saving the old one ends
function saveReset() {
  _gTok++;
  _libBase = null;
  _libTs = null;
  _mergeSaid = false;
  _saveErr = false;
  _delDirty = false;
}
function clearAutosave() {
  _lastAuto = null;
  try {
    localStorage.removeItem('ms-guide-auto');
  } catch (_) {}
  IDB.del('guide-autosave').catch(function () {});
}
// The slot holds one new guide at a time, and all that touches it runs in turn (_slotQ). Its note names the guide that
// owns it: this tab or window (TAB_ID) and the save token of its time (other tabs share the slot). Before a guide writes
// a slot it doesn't own, one with changes left there that isn't in the Library is added to the Library, so nothing is
// ever dropped silently; the tab it came from finds that in ms-slot-kept and saves on into that Library entry.
const TAB_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
function slotOp(fn) {
  _slotQ = (_slotQ || Promise.resolve()).then(fn).catch(function () {});
  return _slotQ;
}
function slotNote() {
  try {
    return JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
  } catch (_) {
    return null;
  }
}
function slotMine(tok, m) {
  return !!(m && m.tab === TAB_ID && m.tok === tok);
}
// a resumed guide takes the slot over
function slotClaim() {
  _slotTok = _gTok;
  const m = slotNote();
  if (!m) return;
  m.tab = TAB_ID;
  m.tok = _gTok;
  try {
    localStorage.setItem('ms-guide-auto', JSON.stringify(m));
  } catch (_) {}
}
// the guide of save token tok is in the Library now: its copy in the slot goes (a slot another guide took is left alone)
function slotClear(tok) {
  slotOp(function () {
    if (slotMine(tok, slotNote())) clearAutosave();
  });
}
function slotKept() {
  try {
    const a = JSON.parse(localStorage.getItem('ms-slot-kept') || '[]');
    return Array.isArray(a)
      ? a.filter(function (x) {
          return x && typeof x === 'object';
        })
      : [];
  } catch (_) {
    return [];
  }
}
// A Library guide's copy in the slot is kept too when it holds section edits not built yet (keepEdits): the Library
// entry is the guide as built, so the edits go in as a copy of their own, "… (section edits)", which opens in Edit
// sections to be built.
function keepSlot(m) {
  if (m === undefined) m = slotNote();
  if (!m || !m.dirty || !api.saveDesign) return Promise.resolve(true);
  const inLib =
      m.savedId != null &&
      !!api.listDesigns &&
      api.listDesigns().some(function (e) {
        return e.id === m.savedId;
      }),
    eds = inLib && m.edits === 1;
  if (inLib && !eds) return Promise.resolve(true);
  return IDB.get('guide-autosave').then(
    function (d) {
      if (!d || !d.payload) return true;
      const nm0 = typeof d.name === 'string' && d.name ? d.name : 'Colour guide',
        nm = eds ? nm0.slice(0, 104) + ' (section edits)' : nm0;
      return Promise.resolve(
        api.saveDesign({
          name: nm,
          W: d.W,
          H: d.H,
          keys: d.keys || [],
          n: d.n,
          payload: d.payload,
          quiet: true,
        }),
      )
        .catch(function () {
          return null;
        })
        .then(function (id) {
          if (!id) return false;
          if (api.refreshSaved) api.refreshSaved();
          if (!eds && m.tab && m.tab !== TAB_ID) {
            const a = slotKept();
            a.push({ tab: m.tab, tok: m.tok, id: id });
            try {
              localStorage.setItem('ms-slot-kept', JSON.stringify(a.slice(-8)));
            } catch (_) {}
          }
          toast('Kept \u201c' + esc(nm) + '\u201d in your Library', 4200);
          return true;
        });
    },
    function () {
      return true;
    },
  );
}
// another tab put this tab's new guide into the Library (above): from now on it saves into that entry
function slotAdopt() {
  if (curId != null && libEntry()) return false;
  const a = slotKept(),
    i = a.findIndex(function (x) {
      return x.tab === TAB_ID && x.tok === _gTok;
    });
  if (i < 0) return false;
  const id = a[i].id;
  if (
    !api.listDesigns ||
    !api.listDesigns().some(function (e) {
      return e.id === id;
    })
  )
    return false;
  a.splice(i, 1);
  try {
    localStorage.setItem('ms-slot-kept', JSON.stringify(a));
  } catch (_) {}
  curId = id;
  _libBase = null;
  libNote();
  guideDirty = true;
  _lastAuto = null;
  saveStatus();
  return true;
}
function scheduleAutosave() {
  if (!assignData) return;
  clearTimeout(autoT);
  autoT = setTimeout(doAutosave, 1500);
  if (guideDirty) saveStatus();
}
function flushAutosave() {
  if (!autoT) return;
  clearTimeout(autoT);
  doAutosave();
}
// save now whatever is waiting (a Back up is about to read the Library): the promise ends once it is stored
function flushNow() {
  return (_firstP || Promise.resolve())
    .then(function () {
      if (!assignData) return true;
      clearTimeout(autoT);
      autoT = null;
      return doAutosave(true);
    })
    .then(function () {
      return slotOp(function () {});
    })
    .then(
      function () {
        return true;
      },
      function () {
        return true;
      },
    );
}
// q: called before opening something else (the caller reports a failure). Returns a promise of "saved (or nothing to save)".
function doAutosave(q) {
  clearTimeout(autoT);
  autoT = null;
  if (!assignData) return Promise.resolve(true);
  if (!libEntry()) slotAdopt();
  if (libEntry()) return libAutosave(q);
  try {
    const d = currentDesignObj();
    if (d) slotSave(d);
  } catch (_) {}
  saveStatus();
  return Promise.resolve(true);
}
// edits: the copy is section edits still to be built (keepEdits), which Resume opens in Edit sections
function slotSave(d, edits) {
  d.savedId = curId || null;
  const js = JSON.stringify(d) + '|' + guideDirty;
  if (js === _lastAuto) return;
  const dirty = guideDirty || !!edits,
    tok = _gTok;
  slotOp(function () {
    const m = slotNote();
    return (!m || slotMine(tok, m) ? Promise.resolve(true) : keepSlot(m)).then(function (ok) {
      if (!ok) {
        if (_slotWarn !== tok) {
          _slotWarn = tok;
          toast(
            'Your last unsaved guide couldn\u2019t be moved into the Library (storage is full), so this one isn\u2019t kept for Resume yet. Save it, or free up space.',
            8000,
          );
        }
        return;
      }
      _slotTok = tok;
      return IDB.put('guide-autosave', d).then(function () {
        _lastAuto = js;
        try {
          localStorage.setItem(
            'ms-guide-auto',
            JSON.stringify({
              name: d.name,
              n: d.n,
              ts: Date.now(),
              savedId: d.savedId,
              keys: d.keys || [],
              dirty: dirty,
              tab: TAB_ID,
              tok: tok,
              edits: edits ? 1 : undefined,
            }),
          );
        } catch (_) {}
      });
    });
  });
}
// the open guide's Library entry, or null: not saved yet, or deleted in the Library while open (then it counts as new)
function libEntry() {
  if (curId == null || !api.listDesigns) return null;
  const a = api.listDesigns();
  for (let i = 0; i < a.length; i++) if (a[i].id === curId) return a[i];
  return null;
}
function libName(e) {
  return curName && curName.trim() ? curName.trim().slice(0, 120) : (e && e.name) || 'Colour guide';
}
// what a save would store, minus the name (compared on its own, so a rename in the Library doesn't count as a change)
function libSig(d) {
  const n = d.name;
  d.name = '';
  const s = JSON.stringify(d);
  d.name = n;
  return s;
}
// Save into the Library entry when something changed since the last save or since it was opened: guideDirty, or
// anything stored that differs (the first check after opening only notes what was opened). A stale guide
// (sections rebuilt under it) is never saved; a save that lands after another guide opened leaves that one alone.
function libAutosave(q) {
  const e = libEntry();
  if (!assignData || !e)
    return _libBusy
      ? _libBusy.then(function () {
          return true;
        })
      : Promise.resolve(true);
  let d = null;
  try {
    d = currentDesignObj();
  } catch (_) {}
  if (!d) {
    saveStatus();
    return Promise.resolve(true);
  }
  const nm = libName(e),
    sig = libSig(d),
    gen = _gTok,
    id = curId,
    b = _libBase,
    fresh = !!(b && b.id === id),
    need = guideDirty || nm !== e.name || (fresh && b.sig !== sig);
  // another tab saved this guide meanwhile: what it did joins this tab's changes first
  if (need && !_libBusy && libOther()) {
    const mp = libMerge();
    _libBusy = mp;
    return mp.then(function () {
      if (_libBusy === mp) _libBusy = null;
      return gen === _gTok && id === curId ? libAutosave(q) : true;
    });
  }
  // a save still going: this one follows it. If another guide opens meanwhile, what was captured here is saved anyway
  if (_libBusy) {
    const th = need ? makeThumb() : '';
    return _libBusy.then(function (ok) {
      if (gen === _gTok && id === curId) return need || !ok ? libAutosave(q) : true;
      if (!need) return ok;
      return Promise.resolve(
        api.saveDesign({
          id: id,
          name: nm,
          W: d.W,
          H: d.H,
          keys: d.keys,
          n: d.n,
          payload: d.payload,
          thumb: th,
          mustExist: true,
          quiet: true,
        }),
      )
        .catch(function () {
          return null;
        })
        .then(function (rid) {
          if (rid) {
            if (api.savedChanged) api.savedChanged(id);
            return true;
          }
          libLost(id, nm);
          return false;
        });
    });
  }
  if (!need) {
    if (!fresh) _libBase = { id: id, sig: sig };
    saveStatus();
    return Promise.resolve(true);
  }
  guideDirty = false;
  const wasErr = _saveErr;
  const p = Promise.resolve(
    api.saveDesign({
      id: id,
      name: nm,
      W: d.W,
      H: d.H,
      keys: d.keys,
      n: d.n,
      payload: d.payload,
      thumb: makeThumb(),
      mustExist: true,
      quiet: true,
    }),
  )
    .catch(function () {
      return null;
    })
    .then(function (rid) {
      _libBusy = null;
      const mine = gen === _gTok && id === curId;
      if (rid) {
        if (mine) {
          _libBase = { id: id, sig: sig };
          libNote();
          _saveErr = false;
          if (wasErr) sayLive('Saved in your Library');
        }
        slotOp(function () {
          const m = JSON.parse(localStorage.getItem('ms-guide-auto') || 'null');
          if (m && m.savedId === id) clearAutosave();
        });
        if (api.savedChanged) api.savedChanged(id);
        saveStatus();
        return true;
      }
      if (!mine) {
        libLost(id, nm);
        return false;
      }
      guideDirty = true;
      if (!libEntry()) {
        saveStatus();
        return false;
      }
      // storage full: one message per run of failures (the line by the Save button stays until a save works); the
      // guide stays open with its changes, which also go to the autosave slot, and the next change tries again
      if (!_saveErr && !q)
        toast(
          saveFailWords(
            'Couldn’t save “' +
              esc(nm) +
              '” — this browser’s storage is full. It stays open here: free up space (back up, then delete a few guides in the Library) and it saves with your next change.',
          ),
          8000,
        );
      _saveErr = true;
      try {
        slotSave(d);
      } catch (_) {}
      saveStatus();
      return false;
    });
  _libBusy = p;
  saveStatus();
  return p;
}
// changes to a guide no longer open that couldn't be saved (storage full): said once they are lost, not dropped silently
function libLost(id, nm) {
  if (
    api.listDesigns &&
    api.listDesigns().some(function (x) {
      return x.id === id;
    })
  )
    toast(
      'Couldn\u2019t save the last changes to \u201c' +
        esc(nm) +
        '\u201d \u2014 this browser\u2019s storage is full. Free up space (back up, then delete a few guides in the Library).',
      8000,
    );
}
// Two tabs with the same Library guide: each remembers the entry's time (ts) from when it opened or last saved it
// (_libTs). The stored time is read afresh (the other tab's save may not have reached this tab's copy of the Library).
let _libTs = null,
  _mergeSaid = false;
function storedTs(id) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null'),
      a = v && Array.isArray(v.saved) ? v.saved : [];
    for (let i = 0; i < a.length; i++) if (a[i] && a[i].id === id) return +a[i].ts || 0;
  } catch (_) {}
  return null;
}
function libNote() {
  const e = libEntry();
  _libTs = e ? { id: curId, ts: +e.ts || 0 } : null;
}
function libOther() {
  if (!_libTs || _libTs.id !== curId) return false;
  const t = storedTs(curId);
  return t != null && t !== _libTs.ts;
}
// how this tab's sections find theirs in a saved copy of the guide: the same section map is the same numbering; one
// edited elsewhere (same size) is read under each section's label point. null: they can't be matched.
function secMap(o) {
  if (o.lmap === lmapURL())
    return Promise.resolve(function (l) {
      return l;
    });
  if (o.W !== W || o.H !== H || typeof o.lmap !== 'string') return Promise.resolve(null);
  return new Promise(function (res) {
    const im = new Image();
    im.onload = function () {
      const w = im.naturalWidth || im.width,
        h = im.naturalHeight || im.height,
        dt = w === W && h === H ? lmapRead(im) : null;
      if (!dt) {
        res(null);
        return;
      }
      res(function (l) {
        const p = labelPos(l),
          x = Math.max(0, Math.min(W - 1, Math.round(p.x))),
          y = Math.max(0, Math.min(H - 1, Math.round(p.y))),
          j = (y * W + x) * 4,
          v = dt[j] | (dt[j + 1] << 8) | (dt[j + 2] << 16);
        return v && labels[y * W + x] === l ? v - 1 : null;
      });
    };
    im.onerror = function () {
      res(null);
    };
    im.src = o.lmap;
  });
}
// Another tab saved this guide since this tab opened or last saved it, and this tab has changes of its own: the
// other tab's ticks and part-done tones join this tab's (for the same sections), this tab's plan stays, and the
// person is told (once per guide opened)
function libMerge() {
  const id = curId,
    gen = _gTok,
    ts = storedTs(id);
  return Promise.resolve(api.loadDesign ? api.loadDesign(id) : null)
    .catch(function () {
      return null;
    })
    .then(function (o) {
      if (gen !== _gTok || id !== curId || !assignData) return;
      _libTs = { id: id, ts: ts };
      if (!o) return;
      return secMap(o).then(function (f) {
        if (gen !== _gTok || id !== curId || !assignData || !colored) return;
        guideDirty = true;
        if (!f) {
          if (!_mergeSaid) {
            _mergeSaid = true;
            toast(
              'This guide was also changed in another tab \u2014 its sections differ, so this tab\u2019s version is kept.',
              6500,
            );
          }
          return;
        }
        const P = tp(),
          done = {},
          tn = o.tones && typeof o.tones === 'object' ? o.tones : {};
        if (Array.isArray(o.prog))
          o.prog.forEach(function (x) {
            done[x] = 1;
          });
        let any = false;
        assignData.order.forEach(function (l) {
          if (colored[l]) return;
          const k = f(l);
          if (k == null) return;
          if (done[k]) {
            colored[l] = 1;
            P[l] = 0;
            any = true;
          } else if (typeof tn[k] === 'number' && (P[l] | (tn[k] & 7)) !== P[l]) {
            P[l] |= tn[k] & 7;
            any = true;
          }
        });
        if (any) {
          normalizeTones();
          renderGuide();
          if (sfmode === 'color') updateProgress();
        }
        if (!_mergeSaid) {
          _mergeSaid = true;
          toast('This guide was also changed in another tab \u2014 merged', 5000);
        }
      });
    });
}
// the status line under the guide's name (#5): where the open guide is kept; a guide not in the Library has Save
// next to it once it's built (screen readers hear the moments that matter via sayLive). In Edit sections, edits not
// built yet are not kept, and it says so (pe: secEdPending(), worked out once by the caller).
function saveStText(pe) {
  if (pe === undefined) pe = secEdPending();
  if (pe) return 'Section edits not saved \u2014 Build guide to keep them';
  if (!assignData) return labels && sfmode === 'review' ? 'Not saved yet' : '';
  const e = libEntry();
  if (!e) return 'Not saved yet';
  if (_saveErr) return 'Not saved \u2014 storage is full';
  return guideDirty || _libBusy ? 'Saving\u2026' : 'Saved in your Library \u2713';
}
function saveStatus() {
  const pe = secEdPending(),
    t = saveStText(pe),
    el = document.getElementById('sfSaveSt'),
    e = libEntry();
  if (el) {
    if (el.textContent !== t) el.textContent = t;
    el.style.display = t ? '' : 'none';
    el.classList.toggle('warn', pe || _saveErr || (curId != null && !e && !!assignData));
    el.classList.toggle('ok', !pe && !!e && !_saveErr && !guideDirty && !_libBusy);
  }
  const b = document.getElementById('sfSave');
  if (b) b.style.display = assignData && !e && sfmode !== 'review' && !pgMode && !cropMode ? '' : 'none';
}
// the Library deleted (back: or, with Undo, put back) a guide, or a backup replaced it (back: 'replaced'): if it is the
// open one, stop or go on saving into it, or open what was restored in its place. back 'changed': another tab saved
// it (the shell's syncFromStorage). With nothing unsaved here it is shown as saved there (reloaded in place, in the
// same view); otherwise the next save merges the two (libAutosave).
function libChanged(id, back) {
  if (id !== curId || !assignData) return;
  if (back === 'changed') {
    if (!libOther()) return;
    if (
      guideDirty ||
      autoT ||
      _libBusy ||
      popCtx ||
      sheetO ||
      renaming ||
      paintS ||
      focus ||
      sfmode === 'review' ||
      pgMode ||
      cropMode ||
      root.classList.contains('sfrev')
    ) {
      if (guideDirty && !autoT && !_libBusy && !popCtx) scheduleAutosave();
      return;
    }
    const col = sfmode === 'color';
    clearTimeout(autoT);
    autoT = null;
    _libBase = null;
    reloadOpen(id, col);
    return;
  }
  if (back === 'replaced') {
    clearTimeout(autoT);
    autoT = null;
    guideDirty = false;
    _libBase = null;
    reloadOpen(id);
    return;
  }
  if (!back) {
    clearTimeout(autoT);
    autoT = null;
    _delDirty = guideDirty;
    guideDirty = false;
  } else {
    if (_delDirty) guideDirty = true;
    _delDirty = false;
    if (guideDirty) scheduleAutosave();
  }
  saveStatus();
}
function saveAsPalette() {
  if (!assignData || !api.savePalette) return;
  const seen = {},
    keys = [];
  assignData.order.forEach(function (l) {
    const k = assignData.assign[l].mkey;
    if (!seen[k]) {
      seen[k] = 1;
      keys.push(k);
    }
  });
  if (!keys.length) return;
  var _pid = api.savePalette(keys, curName ? curName + ' palette' : null);
  if (!_pid) {
    note('Could not save palette \u2014 storage may be full.');
    return;
  }
  if (api.refreshSaved) api.refreshSaved();
  note('Saved ' + keys.length + ' markers as a palette in your Library.');
}
// renamed in the Library while open here: the next save must keep the new name
function renamed(id, name) {
  if (id !== curId || typeof name !== 'string' || !name) return;
  curName = name;
  if (!renaming) renderHead();
}
// the Library card's picture, from the guide as drawn in Plan; anywhere else (the sections editor, cropping or
// straightening, Colour along's highlight, focus mode, Reveal) the canvas shows something else, so none is made and
// the Library keeps the one it has (or draws one itself)
function makeThumb() {
  try {
    if (
      !W ||
      !H ||
      !cv ||
      sfmode !== 'guide' ||
      hlKey ||
      zoneEditOn() ||
      focus ||
      pgMode ||
      cropMode ||
      root.classList.contains('sfrev')
    )
      return '';
    var tw = 140,
      th = Math.max(1, Math.round((tw * H) / W)),
      tc = document.createElement('canvas');
    tc.width = tw;
    tc.height = th;
    tc.getContext('2d').drawImage(cv, 0, 0, tw, th);
    const u = tc.toDataURL('image/jpeg', 0.62);
    freeCanvas(tc);
    return u;
  } catch (e) {
    return '';
  }
}
function btnBusy(t) {
  const b = document.getElementById('sfSave');
  if (!b) return;
  if (t) {
    b.textContent = t;
    b.disabled = true;
  } else {
    b.disabled = false;
    b.textContent = 'Save';
  }
}
// a save that failed: when the browser blocks storage altogether (the shell's STORE_BLOCKED) that is what's said instead
function saveFailWords(m) {
  return typeof STORE_BLOCKED !== 'undefined' && STORE_BLOCKED
    ? 'This browser isn’t letting Marker Studio save — use Share › Guide file to keep this guide.'
    : m;
}
// Save (next to the name): a new guide goes into the Library, and from then on it saves itself. For one already
// there (⋯ → Save a copy) a copy is made instead
function saveGuide() {
  if (!assignData || !api.saveDesign || _firstBusy) return;
  const _gn = document.getElementById('sfGName');
  if (_gn && _gn.value.trim()) curName = _gn.value.trim();
  if (libEntry()) {
    saveCopy();
    return;
  }
  const d = currentDesignObj();
  if (!d) return;
  const gen = _gTok,
    nm = d.name || 'Colour guide';
  // nothing would be kept (a save might even seem to work, into storage the browser throws away)
  if (typeof STORE_BLOCKED !== 'undefined' && STORE_BLOCKED) {
    note(saveFailWords(''));
    btnBusy('Save failed');
    setTimeout(function () {
      if (!_firstBusy) btnBusy(null);
    }, 1600);
    return;
  }
  _firstBusy = true;
  btnBusy('Saving…');
  note('Saving…');
  // stashDirty waits for this first save; the guide counts as saved (not dirty) only once it is stored
  _firstP = Promise.resolve(
    api.saveDesign({
      name: d.name,
      W: d.W,
      H: d.H,
      keys: d.keys,
      n: d.n,
      payload: d.payload,
      thumb: makeThumb(),
    }),
  )
    .catch(function () {
      return null;
    })
    .then(function (id) {
      _firstBusy = false;
      _firstP = null;
      if (gen !== _gTok) {
        btnBusy(null);
        if (id) {
          if (api.refreshSaved) api.refreshSaved();
          slotClear(gen);
        } else
          toast(
            'Couldn\u2019t save \u201c' +
              esc(nm) +
              '\u201d \u2014 this browser\u2019s storage may be full. Free up space (back up, then delete a few guides in the Library), then save it again.',
            8000,
          );
        return;
      }
      if (id) {
        curId = id;
        _libBase = { id: id, sig: libSig(d) };
        libNote();
        _saveErr = false;
        guideDirty = false;
        slotClear(gen);
        if (api.refreshSaved) api.refreshSaved();
        note('Saved to your Library. From now on, changes save by themselves.');
        sayLive('Saved in your Library. Changes now save automatically.');
        btnBusy(null);
        saveStatus();
        scheduleAutosave();
      } else {
        note(saveFailWords('Could not save (storage may be full).'));
        btnBusy('Save failed');
        setTimeout(function () {
          if (!_firstBusy) btnBusy(null);
        }, 1600);
      }
    });
}
// Save a copy: the open guide (its changes so far already in its entry) as a new Library entry named "<name> (copy)";
// the copy is what stays open, the original keeps everything up to now
function saveCopy() {
  const gen = _gTok;
  _firstBusy = true;
  btnBusy('Saving…');
  libAutosave()
    .then(function () {
      if (gen !== _gTok || !assignData) return null;
      const d = currentDesignObj();
      if (!d) return null;
      const nm = copyName(libName(libEntry()));
      return Promise.resolve(
        api.saveDesign({
          name: nm,
          W: d.W,
          H: d.H,
          keys: d.keys,
          n: d.n,
          payload: d.payload,
          thumb: makeThumb(),
          quiet: true,
        }),
      )
        .catch(function () {
          return null;
        })
        .then(function (id) {
          if (!id) {
            toast(
              saveFailWords(
                'Couldn’t save a copy — this browser’s storage is full. Free up space (back up, then delete a few guides in the Library) and try again.',
              ),
              8000,
            );
            return;
          }
          if (api.refreshSaved) api.refreshSaved();
          if (gen !== _gTok) return;
          curId = id;
          curName = nm;
          _libBase = { id: id, sig: libSig(d) };
          libNote();
          renaming = false;
          renderHead();
          toast(
            'Saved a copy, “' +
              esc(nm) +
              '”. You’re now working on the copy; the original stays in your Library as it was.',
            5000,
          );
        });
    })
    .then(
      function () {
        _firstBusy = false;
        btnBusy(null);
        saveStatus();
      },
      function () {
        _firstBusy = false;
        btnBusy(null);
        saveStatus();
      },
    );
}
