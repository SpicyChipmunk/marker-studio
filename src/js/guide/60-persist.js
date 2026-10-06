// the section map is saved as a PNG; encoding it is slow, so the last one is kept until the sections change
// (checked with two cheap hashes of the label array)
let _lmC = null,
  _lastAuto = null;
function labelsSig() {
  return labelsSigOf(labels, W, H);
}
function labelsSigOf(labels, W, H) {
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
  // (with the specks folded into the lines, which ones: v304)
  const f = foldSet(),
    sig = labelsSig() + (f ? ':f' + f.sig : '');
  if (_lmC && _lmC.sig === sig) return _lmC.url;
  const url = _lmapURL(f);
  _lmC = { sig: sig, url: url };
  return url;
}
// A very dense page (fine hatching, say) can have far more sections than a guide can open again (MAXSECS). When it has
// more than FOLDAT, the specks smaller than Min section size are saved as part of the lines, the highest numbers
// first (the rest keep theirs), until FOLDAT are left. Only in the saved copy: the sections on screen, and Undo, stay
// as they are. Never one with a marker or left white, kept in the guide by a tap, ticked or part done, pinned, keeping
// its shading, or left out keeping its marker. null when nothing is folded. (v304)
const FOLDAT = 90000;
function foldSet() {
  if (!labels || !comps || comps.length - 1 <= FOLDAT) return null;
  let live = 0;
  for (let l = 1; l < comps.length; l++) if (comps[l] && !comps[l].merged) live++;
  if (live <= FOLDAT) return null;
  const mp = minPx(),
    P = tonePart && tonePart._c === colored ? tonePart : null,
    out = new Uint8Array(comps.length);
  let n = 0,
    h = 0;
  for (let l = comps.length - 1; l >= 1 && live - n > FOLDAT; l--) {
    if (!foldable(l, mp, P)) continue;
    out[l] = 1;
    n++;
    h = (Math.imul(h, 31) + l) | 0;
  }
  return n ? { out: out, n: n, live: live, sig: n + '.' + h } : null;
}
// a speck that may be saved as part of the lines (foldSet), below Min section size mp
function foldable(l, mp, P) {
  const c = comps[l],
    ad = assignData;
  if (!c || c.merged || c.area >= mp || (secState && secState[l] === 1)) return false;
  if (ad && (ad.assign[l] !== undefined || (ad.paper && ad.paper[l]))) return false;
  return !(
    (colored && colored[l]) ||
    (P && P[l]) ||
    locks[l] !== undefined ||
    heldSh[l] ||
    _gone[l] ||
    _lostKeys[l]
  );
}
function _lmapURL(f) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const im = x.createImageData(W, H);
  lmapPixels(im.data, f);
  x.putImageData(im, 0, 0);
  const u = c.toDataURL('image/png');
  freeCanvas(c);
  return u;
}
// the section map's pixels: each section's number + 1 in red, green and blue (0 for the lines and folded specks)
function lmapPixels(d, f) {
  const fo = f ? f.out : null;
  for (let p = 0, j = 0; p < W * H; p++, j += 4) {
    const v = labels[p] < 0 || (fo && fo[labels[p]]) ? 0 : labels[p] + 1;
    d[j] = v & 255;
    d[j + 1] = (v >> 8) & 255;
    d[j + 2] = (v >> 16) & 255;
    d[j + 3] = 255;
  }
}
// (v307) Encoding the section map holds Safari's engine up for about 0.4 s, and a new guide's first save comes just as
// the guide appears after Build: it's encoded in the worker (03-jobs) first, and lmapURL finds it ready. The same
// pixels, checked there; the same file as the page makes (checked in the tests). Resolves once it's ready, or at once
// where there's no worker (the save then encodes it here, as before).
// (v307.1) The save waits for it only while the Build bloom shows, and LMAP_WAIT at most after that (30-palette-assign);
// with no bloom it doesn't wait at all. In Safari's engine the worker can take a third of a second, and a page
// reloaded or closed meanwhile lost the new guide (a database write begun as a page goes is dropped). The save then
// encodes it here, as before v307; the worker's file, the same, is only kept for a later save if none was made meanwhile.
const LMAP_WAIT = 100;
function lmapWarm() {
  if (!JOBS.on || typeof OffscreenCanvas === 'undefined' || !labels) return Promise.resolve();
  const f = foldSet(),
    sig = labelsSig() + (f ? ':f' + f.sig : '');
  if (_lmC && _lmC.sig === sig) return Promise.resolve();
  const d = new Uint8ClampedArray(W * H * 4),
    lab = labels;
  lmapPixels(d, f);
  return JOBS.run('lmap', { buf: d.buffer, w: W, h: H }, [d.buffer]).then(
    function (url) {
      // (only if the sections are still the ones sent, and the page hasn't encoded them itself meanwhile)
      if (labels === lab && /^data:image\/png;base64,/.test(url) && !(_lmC && _lmC.sig === sig)) {
        const f2 = foldSet();
        if (labelsSig() + (f2 ? ':f' + f2.sig : '') === sig) _lmC = { sig: sig, url: url };
      }
    },
    function () {},
  );
}
// background by the edge rule alone (applyBg), as a guide opened again works it out
function bgByEdge(c) {
  return bgMaxB > 0 && c.bpx >= (0.6 - (bgTrim / 100) * 0.5) * bgMaxB;
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
    held = {},
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
    // (the shading a coloured section keeps, where it's not its zone's: 34-zones)
    const h = heldSh[l];
    // ([shadow, hilite], and from v285 a third: 1 when the shadow still follows the setting, 0 when it's kept. Older
    // copies read the first two, so they keep the shadow of the moment: a v284 section saved as two keeps both)
    if (h && (colored[l] || (P && P[l]))) {
      const z = zones.length ? zsh(zoneOf(l)) : zshMain(),
        sh = h.free ? z.shadow : h.shadow;
      if (sh !== z.shadow || h.hilite !== z.hilite)
        held[l] = h.legacy ? [h.shadow, h.hilite] : [sh, h.hilite, h.free ? 1 : 0];
    }
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
  const ssMap = {},
    fo = foldSet();
  if (secState) {
    for (let l = 1; l < secState.length; l++) {
      if (fo && fo.out[l]) continue;
      if (secState[l]) ssMap[l] = secState[l];
      // (background because of the page found in the photo, which a guide opened again doesn't find: worked out here,
      // so an Undo can't lose it, v304; only the edge rule is done again on opening)
      else if (
        comps &&
        comps[l] &&
        !comps[l].merged &&
        (comps[l].page || (comps[l].bg && !bgByEdge(comps[l])))
      )
        ssMap[l] = 2;
    }
  }
  const o = {
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
        held: Object.keys(held).length ? held : undefined,
        dates: progAt.s ? { s: progAt.s, e: progAt.e || undefined } : undefined,
        out: Object.keys(out).length ? out : undefined,
        edits: edits ? 1 : undefined,
        base: Object.keys(bas).length ? bas : undefined,
        locks: locks,
        // (v303: how much its picture was enlarged, a small download, so Min section size means what it did)
        upk: srcK > 1 ? Math.round(srcK * 1000) / 1000 : undefined,
        // (v306: the paper inside a frame, so a guide opened again knows it: its line to Colour it is back. Not found
        // again on opening, so a guide saved before has none)
        frame: frameSaved(),
      },
      // the zones besides Main (34-zones), only when there are any
      zones.length ? { zones: zoneSave() } : {},
      // the Sections screen's settings (minPos, bgTrim, addAutoClose), here among the rest
      styleSave('payload'),
      { secStates: ssMap },
    ),
  };
  // (v307: sk, for the Library's row, Home's latest piece says "16 markers + 29 for shading"; the saves hand it on.
  // v307.1: not enumerable, so it's never written into the guide, the autosave copy or a guide file (JSON and the
  // database leave it out), as v307 meant: it was in the guide, 7 bytes more. Not part of the change check: libSig)
  if (!share)
    Object.defineProperty(o, 'sk', {
      value: shadeExtra(),
      enumerable: false,
      writable: true,
      configurable: true,
    });
  return o;
}
// Share › Guide file: handed over as the backup is (handOver: the share sheet on a phone, a download on a computer)
function shareGuideFile() {
  const d = currentDesignObj(true);
  if (!d) return;
  // (v308: the version that made it, so an older one can say it's from a newer version)
  if (typeof appVersion === 'function') d.app = appVersion();
  let blob = null;
  try {
    blob = new Blob([JSON.stringify(d)], { type: 'application/json' });
  } catch (e) {
    note('Couldn’t export the guide file.');
    return;
  }
  handOver(blob, fileSlug(d.name, 'guide', 40, true) + '.msguide.json', {
    title: d.name || 'Colouring guide',
    text: 'A Marker Studio colouring guide \u2014 open it in Marker Studio (Import a guide) to colour along.',
    what: 'guide file',
  }).then(function (r) {
    if (r === 'download')
      note('Guide file downloaded \u2014 keep it as a backup or move it to another device.');
    else if (r === false) note('Couldn’t export the guide file.');
  });
}
function sampleFromAnywhere() {
  if (!document.getElementById('sfPick')) mount();
  loadSample();
}
function pickPhoto() {
  if (!document.getElementById('sfPick')) mount();
  _pickCb = null;
  if (fileEl) fileEl.click();
}
// Home's New colouring guide (v288): the picker opens straight from Home, which stays as it is until a photo is
// chosen (cancel: nothing happens); then onPick (the switch to the Guide screen) and the photo is read. The picker is
// opened in the tap itself, nothing asked or awaited first (iOS opens it only from the tap).
let _pickCb = null;
function pickPhotoHome(onPick) {
  if (!document.getElementById('sfPick')) mount();
  _pickCb = onPick || null;
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
            nm +
            '”, so it’s still open. Free up space (delete or back up guides in the Library), then try again.',
          nm,
          true,
        ),
        8000,
      );
      return false;
    });
  }
  if (!guideDirty || _removed || _openEmpty || (curSample && !sampleTouched(true)))
    return Promise.resolve(true);
  if (storeBlocked()) return askLeaveBlocked();
  if (curSample && curName === _sampleNm) curName = sampleSaveName();
  try {
    d = currentDesignObj();
    if (!d) return Promise.resolve(true);
    nm = d.name || 'Colouring guide';
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
          nm +
          '”, so it’s still open. Free up space (delete or back up guides in the Library), then try again.',
        nm,
        true,
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
      sk: d.sk,
      payload: d.payload,
      thumb: makeThumb(),
    }),
  ).then(function (id) {
    if (!id) return fail();
    if (gen === _gTok) {
      curId = id;
      curSample = false;
      _libBase = { id: id, sig: libSig(d) };
      libNote();
    }
    slotClear(gen);
    if (api.refreshSaved) api.refreshSaved();
    // (guides keep themselves in the Library from v285: no toast for it)
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
// (now: as askBox's, for an answer that opens the photo picker within the tap)
function askEdits(now) {
  return askBox(
    'Section edits not saved',
    'Build the guide with your section edits, or discard them?',
    '<button type="button" class="btn-primary" data-a="build">Build again</button><button type="button" data-a="discard">Discard edits</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
    false,
    now,
  );
}
// storage blocked: a guide not kept anywhere goes when something else opens, so that's asked first (v285)
function askLeaveBlocked() {
  return askBox(
    'This guide isn’t saved',
    'This browser isn’t letting Marker Studio save, so the guide goes when you open something else. To keep it, Cancel and use Share › Guide file.',
    '<button type="button" class="sfghost" data-a="stay">Cancel</button><button type="button" data-a="go">Open anyway</button>',
  ).then(function (a) {
    if (a !== 'go') return false;
    guideDirty = false;
    return true;
  });
}
// a dialog over whatever screen asked: resolves to the data-a of the button pressed ('stay' for the backdrop, Escape).
// yesNo: a question that was the browser's OK/Cancel before v288 (marked for the tests' answerAsks)
// now(answer), when given, runs inside the tap itself, before the promise resolves: for an answer that must open the
// photo picker (iOS opens it only from the tap)
function askBox(title, text, btns, yesNo, now) {
  return new Promise(function (res) {
    const o = document.createElement('div'),
      op = document.activeElement;
    o.className = 'overlay on';
    o.id = 'sfEdAsk';
    if (yesNo) o.setAttribute('data-confirm', '1');
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-labelledby', 'sfEdAskT');
    // (the question is read with the title, not only the button that has the keyboard, v287)
    o.setAttribute('aria-describedby', 'sfEdAskD');
    o.innerHTML =
      '<div class="ocard dcard"><div class="mhead"><h2 class="mtitle" id="sfEdAskT">' +
      esc(title) +
      '</h2></div><div class="dsub" id="sfEdAskD">' +
      esc(text) +
      '</div><div class="sfedaskbtns">' +
      btns +
      '</div></div>';
    const end = function (a) {
      o.remove();
      try {
        if (op && op.isConnected && op !== document.body) op.focus({ preventScroll: true });
      } catch (_) {}
      if (now) now(a);
      res(a);
    };
    // a tap on the backdrop is Cancel, and so is Escape (layers.js closes the top dialog as a tap on its backdrop)
    // (not a backdrop tap within 400 ms of opening: the rest of the double tap that opened it)
    const t0 = Date.now();
    o.addEventListener('click', function (e) {
      const b = e.target.closest('[data-a]');
      if (b) end(b.dataset.a);
      else if (e.target === o && (Date.now() - t0 > 400 || e.detail === 0)) end('stay');
    });
    document.body.appendChild(o);
    // the highlighted answer has the keyboard, else the first (v308: a selector list takes whichever comes first, so
    // Restore anyway, or Open it, had it where Cancel, or Add a copy, was the highlighted answer)
    try {
      (o.querySelector('.btn-primary') || o.querySelector('[data-a]')).focus();
    } catch (_) {}
  });
}
// section edits brought back by Resume, let go: nothing of the open (edited) guide is saved, and the copy in the slot
// goes; the Library keeps the guide as it was built (_edDisc: no longer pending)
function edDropResumed() {
  _edDisc = true;
  clearTimeout(autoT);
  autoT = null;
  guideDirty = false;
  slotOp(function () {
    const m = slotNote();
    if (m && m.edits) clearAutosave();
  });
}
// Section edits kept for Resume (keepEdits, when the page was hidden) that are no longer wanted: this visit's own copy
// in the slot goes, so Home doesn't offer it back and the next guide doesn't keep it in the Library (v298). Edits an
// earlier visit left there are not this visit's to drop: the next save keeps them as "… (section edits)" (v299: they
// went too, without a word)
function edSlotDrop() {
  const tok = _gTok;
  slotOp(function () {
    const m = slotNote();
    if (m && m.edits && slotMine(tok, m)) clearAutosave();
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
      // (not a page with more sections than a guide can keep: Build in Edit sections says what to do, v304)
      if (secEdPending() && !denseStop()) buildGuide();
      return secEdPending() || !assignData || sfmode === 'review' ? false : stashDirty();
    }
    if (a === 'discard') {
      _edDisc = true;
      // (edits brought back by Resume: what's open is the edited guide, so nothing of it is saved; the Library keeps
      // the guide as it was built, and the copy in the slot goes)
      if (_edResumed) {
        edDropResumed();
        return true;
      }
      // (the edits this visit kept for Resume go too)
      edSlotDrop();
      return stashDirty();
    }
    return false;
  });
}
// The page is going away (a reload, the tab closed) or hidden (a phone may stop it): changes to a Library guide that
// would save in a moment, or are saving now, are kept aside at once (v286: the usual save reads the old copy first,
// and a database write begun as a page goes is dropped), sfSaveDesignNow. A guide another tab saved meanwhile is left
// to the usual save, which merges the two.
function saveOnLeave() {
  if (!assignData || !api.saveDesignNow || !(guideDirty || autoT || _libBusy)) return;
  // (not a colour only being tried in the picker: it isn't kept until Done, holdSave)
  if (pickPending()) return;
  const e = libEntry();
  if (!e || libOther()) return;
  let d = null;
  try {
    d = currentDesignObj();
  } catch (_) {}
  if (!d) return;
  // (the usual save carries on as well, if the page lives on: this copy is then unneeded)
  api.saveDesignNow({
    id: curId,
    name: libName(e),
    W: d.W,
    H: d.H,
    keys: d.keys,
    n: d.n,
    sk: d.sk,
    payload: d.payload,
  });
}
// the page is hidden with section edits not built: they go to the autosave slot, and Resume brings them back to build
function keepEdits() {
  // (not for a guide deleted from the Library while open: it stays out)
  if (!secEdPending() || !api.saveDesign || _removed) return;
  try {
    const d = currentDesignObj(false, true);
    if (d) slotSave(d, true);
  } catch (_) {}
}
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'hidden') return;
  keepEdits();
  // (an app switch on a phone: the save waiting to happen goes now, while the page still runs; and as a phone may
  // stop the page before it's done, what it saves is kept aside too, saveOnLeave)
  flushAutosave();
  saveOnLeave();
});
window.addEventListener('pagehide', keepEdits);
// (v308) a photo picked in Import a guide, made into a new guide as a photo picked to make one is
function photoFromHome(file) {
  try {
    localStorage.setItem('ms-onboarded', '1');
  } catch (_) {}
  if (!document.getElementById('sfPick')) mount();
  setMode('sections');
  loadImage(file);
}
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
  TOO_COMPLEX = 'Couldn’t open that guide — it has too many sections (the file is too complex).';
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
      // (v308: a photo is offered as a new guide; an empty or cut-short file is said as such)
      const why = typeof fileTrouble === 'function' ? fileTrouble(file, fr.result) : 'bad';
      if (why === 'picture') {
        note('');
        askBox(
          'Make a guide from this photo?',
          'That\u2019s a photo, not a guide file. Its sections can be found for a new guide.',
          '<button type="button" class="btn-primary" data-a="go">Make a guide</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
          true,
        ).then(function (a) {
          if (a === 'go') loadImage(file);
        });
        return;
      }
      note(
        why === 'empty'
          ? 'Couldn’t read that guide file \u2014 it\u2019s empty.'
          : why === 'damaged'
            ? 'Couldn’t read that guide file \u2014 it\u2019s incomplete or damaged (it may not have finished downloading).'
            : 'Couldn’t read that guide file.',
      );
      return;
    }
    if (
      !d ||
      !d.payload ||
      typeof d.payload !== 'object' ||
      typeof d.payload.lmap !== 'string' ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]{16,}$/.test(d.payload.lmap) ||
      // (a guide with no markers for its sections would open as nothing at all, v287)
      !d.payload.assign ||
      typeof d.payload.assign !== 'object' ||
      !Object.keys(d.payload.assign).length
    ) {
      note('That file isn\u2019t a Marker Studio guide.');
      return;
    }
    // (v308: one from a newer version is asked about first)
    (typeof askNewer === 'function' ? askNewer(d, 'guide file', 'Open anyway') : Promise.resolve(true)).then(
      function (go) {
        if (go) importChecked(d);
        else note('');
      },
    );
  };
  fr.onerror = function () {
    note('Couldn’t read that file.');
  };
  fr.readAsText(file);
}
// (v308) a guide file that is already in the Library (the same picture and stored sections): its guide there, with how
// far along each is, or null. Only guides of the same size are read.
function importTwin(d, w, h) {
  const list = (api.listDesigns ? api.listDesigns() : []).filter(function (s) {
    return +s.W === w && +s.H === h;
  });
  let k = 0;
  const step = function () {
    if (k >= list.length || !api.loadDesign) return Promise.resolve(null);
    const s = list[k++];
    return Promise.resolve(api.loadDesign(s.id)).then(
      function (x) {
        return x && x.lmap === d.payload.lmap ? { e: s, pl: x } : step();
      },
      function () {
        return step();
      },
    );
  };
  return step();
}
function importChecked(d) {
  note('Importing\u2026');
  guideCheck(d.payload).then(function (c) {
    if (!c.ok) {
      note(
        c.why === 'size'
          ? 'Couldn’t import that guide \u2014 its picture is the wrong size.'
          : c.why === 'complex'
            ? 'Couldn’t import that guide \u2014 it has too many sections (the file is too complex).'
            : 'Couldn’t import that guide \u2014 its picture couldn\u2019t be read.',
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
    const nm0 = typeof d.name === 'string' && d.name.trim() ? d.name.slice(0, 120) : 'Imported guide';
    const add = function (copy) {
      // (v308: a name already in the Library gets the next "(n)", as Duplicate does)
      Promise.resolve(
        api.saveDesign({
          name: copy ? copyName(nm0) : freeName(nm0),
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
          } else note(saveFailWords('Couldn’t import (storage may be full).'));
        })
        .catch(function () {
          note('Couldn’t import that guide.');
        });
    };
    // (v308) the same guide already here: Open it rather than a twin that can't be told apart, unless the file has
    // ticks this device doesn't (then Add a copy is the highlighted answer, and says why)
    importTwin(d, w, h).then(function (tw) {
      if (!tw) {
        add(false);
        return;
      }
      note('');
      const here = Array.isArray(tw.pl.prog) ? tw.pl.prog : [],
        hs = new Set(here.map(String)),
        fp = Array.isArray(pl.prog) ? pl.prog : [],
        more = fp.some(function (l) {
          return !hs.has(String(l));
        }),
        n = +tw.e.n || Object.keys(sa).length;
      askBox(
        'Already in your Library',
        '\u201c' +
          (tw.e.name || 'Guide') +
          '\u201d is here, ' +
          (here.length ? Math.min(here.length, n) + ' of ' + n + ' coloured' : 'not started') +
          ' (the file: ' +
          (fp.length ? Math.min(fp.length, n) : 'none') +
          ').' +
          (more ? ' The file has ticks this one doesn\u2019t.' : ''),
        '<button type="button"' +
          (more ? '' : ' class="btn-primary"') +
          ' data-a="open">Open it</button><button type="button"' +
          (more ? ' class="btn-primary"' : '') +
          ' data-a="copy">Add a copy</button><button type="button" class="sfghost" data-a="stay">Cancel</button>',
      ).then(function (a) {
        if (a === 'open') openDesign(tw.e.id);
        else if (a === 'copy') add(true);
      });
    });
  });
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
// v285: a guide goes into the Library by itself once it's built (doAutosave → firstSave). The sample (curSample) only
// once it's changed: _sampleBase is what it was as built, _sampleNm its name then. _removed: deleted in the Library
// while open; it stays out (nothing saved, not even to the autosave slot) unless Put back. _sampleNoteX: the line
// under the tabs about the sample was closed.
let curSample = false,
  _sampleBase = null,
  _sampleNm = '',
  _removed = false,
  _sampleNoteX = false,
  // (a sample being loaded and built: not yet curSample, but its line under the tabs is coming, so no tip before it)
  _smpLoad = false;
// the sample as built is noted (after build): changing anything from here keeps it
function sampleBuilt(nm) {
  _smpLoad = false;
  curSample = true;
  _sampleNm = nm;
  curName = nm;
  _sampleNoteX = false;
  _sampleT = null;
  try {
    _sampleBase = libSig(currentDesignObj());
  } catch (_) {
    _sampleBase = null;
  }
}
// (the comparison builds the whole guide, and the status line asks on every redraw: an answer is kept for 400ms, and
// the save itself, 1.5s after the last change, always asks afresh)
let _sampleT = null;
function sampleTouched(fresh) {
  if (!curSample) return true;
  if (curName && curName !== _sampleNm) return true;
  if (!_sampleBase || !assignData) return false;
  const now = Date.now();
  if (!fresh && _sampleT && now - _sampleT.t < 400) return _sampleT.v;
  let v = false;
  try {
    const d = currentDesignObj();
    v = !!d && libSig(d) !== _sampleBase;
  } catch (_) {}
  _sampleT = { t: now, v: v };
  return v;
}
// "Sample jellyfish", or "Sample jellyfish 2", 3 … when the Library has one already
function sampleSaveName() {
  const used = usedGuideNames();
  if (!used.has(_sampleNm.toLowerCase())) return _sampleNm;
  for (let i = 2; i < 999; i++)
    if (!used.has((_sampleNm + ' ' + i).toLowerCase())) return _sampleNm + ' ' + i;
  return _sampleNm;
}
function storeBlocked() {
  return typeof STORE_BLOCKED !== 'undefined' && !!STORE_BLOCKED;
}
// the open guide should go into the Library by itself now: built, not there yet, not deleted from it while open, not a
// sample left as it was, nothing to build first, not one that opened with nothing to show
function canAuto() {
  return (
    !!assignData &&
    !libEntry() &&
    !_removed &&
    sfmode !== 'review' &&
    !_openEmpty &&
    !secEdPending() &&
    !storeBlocked() &&
    sampleTouched(true)
  );
}
// a different guide or picture is being put in place (from resetForNewPicture): what is known about saving the old one ends
function saveReset() {
  _gTok++;
  _libBase = null;
  curSample = false;
  _sampleBase = null;
  _removed = false;
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
      const nm0 = typeof d.name === 'string' && d.name ? d.name : 'Colouring guide',
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
          toast('Kept \u201c' + nm + '\u201d in your Library', 4200);
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
  if (canAuto()) return firstSave(true);
  // (deleted while open, or the sample as it was: nothing is kept)
  if (_removed || (curSample && !sampleTouched())) {
    saveStatus();
    return Promise.resolve(true);
  }
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
  return curName && curName.trim() ? curName.trim().slice(0, 120) : (e && e.name) || 'Colouring guide';
}
// what a save would store, minus the name (compared on its own, so a rename in the Library doesn't count as a change)
function libSig(d) {
  const n = d.name,
    sk = d.sk;
  d.name = '';
  d.sk = undefined;
  const s = JSON.stringify(d);
  d.name = n;
  d.sk = sk;
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
          sk: d.sk,
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
    // (another tab saved it while this one waited to save nothing: show theirs, libChanged)
    if (libOther()) libChanged(id, 'changed');
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
      sk: d.sk,
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
        // its copy in the slot goes; section edits left there by an earlier visit (not this one's: built or
        // discarded by now) are kept first, as "… (section edits)"
        slotOp(function () {
          const m = slotNote();
          if (!m || m.savedId !== id) return;
          if (m.edits === 1 && !slotMine(gen, m))
            return keepSlot(m).then(function (ok) {
              if (ok) clearAutosave();
            });
          clearAutosave();
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
              nm +
              '” — this browser’s storage is full. It stays open here: free up space (back up, then delete a few guides in the Library) and it saves with your next change.',
            nm,
            true,
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
      saveFailWords(
        'Couldn\u2019t save the last changes to \u201c' +
          nm +
          '\u201d \u2014 this browser\u2019s storage is full. Free up space (back up, then delete a few guides in the Library).',
        nm,
        false,
      ),
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
          // (what is merged, said plainly: only ticks and done tones come across; v299, it said "merged")
          toast(
            'This guide was also changed in another tab \u2014 its ticks are added here; this tab\u2019s colours and pins are kept.',
            6500,
          );
        }
      });
    });
}
// the status line under the guide's name (#5): where the open guide is kept; a guide not in the Library has Save
// next to it once it's built (screen readers hear the moments that matter via sayLive). In Edit sections, edits not
// built yet are not kept, and it says so (pe: secEdPending(), worked out once by the caller).
// (_savedNew: when Save first put this guide in the Library; for a few seconds the line says it saves itself now)
let _savedNew = 0;
function saveStText(pe) {
  if (pe === undefined) pe = secEdPending();
  // (deleted from the Library while open: that first, edits or not, v289)
  if (assignData && !libEntry() && _removed) return 'Removed from your Library';
  if (pe) return 'Section edits not saved \u2014 Build again to keep them';
  if (!assignData) return labels && sfmode === 'review' ? 'Not saved yet' : '';
  const e = libEntry();
  if (!e && storeBlocked()) return 'Not saved \u2014 use Share \u203a Guide file';
  // (v304: or the browser's database stopped answering)
  if (_saveErr)
    return storeNotAnswering() ? 'Not saved \u2014 reload to try again' : 'Not saved \u2014 storage is full';
  if (!e && curSample && !sampleTouched()) return 'Sample';
  if (!e) return sfmode === 'review' || _openEmpty ? 'Not saved yet' : 'Saving\u2026';
  // (v307: only while it's being written; a change waiting its moment to be saved said "Saving…" for 1.5 s after
  // every tick, so Colour along read as always saving)
  if (_libBusy) return 'Saving\u2026';
  return Date.now() - _savedNew < 6000 ? 'Saves itself from now on \u2713' : 'Saved in your Library \u2713';
}
function saveStatus() {
  const pe = secEdPending(),
    t = saveStText(pe),
    el = document.getElementById('sfSaveSt'),
    e = libEntry();
  if (el) {
    if (el.textContent !== t) el.textContent = t;
    el.style.display = t ? '' : 'none';
    el.classList.toggle('warn', pe || _saveErr || _removed || (!e && storeBlocked() && !!assignData));
    el.classList.toggle('ok', !pe && !!e && !_saveErr && !_libBusy);
  }
  // the button: Put back (deleted while open), or Save to try again after a save that failed
  const b = document.getElementById('sfSave'),
    want = assignData && !e && sfmode !== 'review' && !pgMode && !cropMode && (_removed || _saveErr);
  if (b) {
    // (not while it says something for a moment: Saving…, or Couldn’t save)
    if (!_firstBusy && !b.disabled) b.textContent = _removed ? 'Put back' : 'Save';
    b.style.display = want ? '' : 'none';
  }
  // the sample's line under the tabs goes once it's kept
  if (!curSample || e) {
    const sn = document.getElementById('sfSampleNote');
    if (sn) sn.remove();
  }
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
    _removed = false;
    _delDirty = false;
    _libBase = null;
    reloadOpen(id);
    return;
  }
  if (!back) {
    clearTimeout(autoT);
    autoT = null;
    _delDirty = guideDirty;
    guideDirty = false;
    _removed = true;
  } else {
    _removed = false;
    if (_delDirty) guideDirty = true;
    _delDirty = false;
    if (guideDirty) scheduleAutosave();
  }
  if (typeof renderHead === 'function') renderHead();
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
    note('Couldn’t save palette \u2014 storage may be full.');
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
    b.textContent = _removed ? 'Put back' : 'Save';
  }
}
// a save that failed: when the browser blocks storage altogether (the shell's STORE_BLOCKED) that is what's said instead.
// (v304) When the browser's database stopped answering (iOS can drop it in the background) rather than filling up, that
// is said instead of "storage is full": a reload fixes it, deleting guides doesn't. nm: the guide's name; open: whether
// its changes are still open on screen
// (plain text, v308: said in a toast, or by note with no name in it)
function saveFailWords(m, nm, open) {
  if (typeof STORE_BLOCKED !== 'undefined' && STORE_BLOCKED)
    return 'This browser isn’t letting Marker Studio save — use Share › Guide file to keep this guide.';
  if (m && storeNotAnswering())
    return (
      'Couldn’t save' +
      (nm ? ' “' + nm + '”' : '') +
      ' — this browser’s storage isn’t answering. Reload Marker Studio and try again' +
      (open ? '; your changes are still open here.' : '.')
    );
  return m;
}
// (v304) the last guide save failed because the database didn't answer, not because storage was full (storeErr in
// guide-bridge.js)
function storeNotAnswering() {
  const e = typeof storeErr === 'function' ? storeErr() : '';
  return !!e && e !== 'QuotaExceededError';
}
// A new guide goes into the Library (v285: by itself once built, auto; or by the header's button: Put back after it was
// deleted while open, or Save to try again after a save that failed), and from then on it saves itself. The button
// on a guide already there (⋯ → Save a copy) makes a copy instead. Returns a promise of "stored".
function saveGuide() {
  return firstSave(false);
}
function firstSave(auto) {
  if (!assignData || !api.saveDesign) return Promise.resolve(false);
  if (_firstBusy) return _firstP || Promise.resolve(false);
  // (the button's save takes a name being typed; an automatic one leaves it to Enter or Escape)
  const _gn = !auto && document.getElementById('sfGName');
  if (_gn && _gn.value.trim()) curName = _gn.value.trim();
  if (libEntry()) {
    if (auto) return libAutosave();
    saveCopy();
    return Promise.resolve(true);
  }
  // (the sample keeps its name, numbered when the Library has one: "Sample jellyfish 2")
  if (curSample && curName === _sampleNm) curName = sampleSaveName();
  const d = currentDesignObj();
  if (!d) return Promise.resolve(false);
  const gen = _gTok,
    nm = d.name || 'Colouring guide',
    back = _removed && curId != null ? curId : null,
    wasErr = _saveErr,
    pl = d.payload || {},
    started = (Array.isArray(pl.prog) && pl.prog.length) || (pl.tones && Object.keys(pl.tones).length);
  // nothing would be kept (a save might even seem to work, into storage the browser throws away)
  if (storeBlocked()) {
    if (!auto) note(saveFailWords(''));
    saveStatus();
    return Promise.resolve(false);
  }
  _firstBusy = true;
  if (!auto) btnBusy(back != null ? 'Putting back…' : 'Saving…');
  // stashDirty waits for this first save; the guide counts as saved (not dirty) only once it is stored
  _firstP = Promise.resolve(
    api.saveDesign({
      id: back != null ? back : undefined,
      name: d.name,
      W: d.W,
      H: d.H,
      keys: d.keys,
      n: d.n,
      sk: d.sk,
      payload: d.payload,
      thumb: makeThumb(),
      quiet: auto,
      // (saved as built, nothing coloured: the backup reminder leaves it out until it changes)
      fresh: auto && !curSample && !started,
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
            saveFailWords(
              'Couldn\u2019t save \u201c' +
                nm +
                '\u201d \u2014 this browser\u2019s storage may be full. Free up space (back up, then delete a few guides in the Library), then open it again.',
              nm,
              false,
            ),
            8000,
          );
        return !!id;
      }
      if (id) {
        curId = id;
        curSample = false;
        _removed = false;
        _libBase = { id: id, sig: libSig(d) };
        libNote();
        _saveErr = false;
        guideDirty = false;
        slotClear(gen);
        if (api.refreshSaved) api.refreshSaved();
        // (said once, in the header's status line rather than a toast over the tabs: v284)
        _savedNew = Date.now();
        setTimeout(saveStatus, 6100);
        sayLive(
          back != null
            ? 'Put back in your Library.'
            : 'Saved in your Library. Changes now save automatically.',
        );
        btnBusy(null);
        renderHead();
        saveStatus();
        scheduleAutosave();
        return true;
      }
      // storage full: said once per run of failures; the guide stays open, goes to the autosave slot, and the next
      // change (or Save) tries again
      _saveErr = true;
      if (!wasErr) renderHead();
      if (auto) btnBusy(null);
      else {
        // (the button says so for a moment, then is Save again)
        btnBusy('Couldn\u2019t save');
        setTimeout(function () {
          if (!_firstBusy) btnBusy(null);
        }, 1600);
      }
      if (!wasErr || !auto)
        toast(
          saveFailWords(
            'Couldn\u2019t save \u201c' +
              nm +
              '\u201d \u2014 this browser\u2019s storage is full. It stays open here: free up space (back up, then delete a few guides in the Library), or keep it with Share \u203a Guide file.',
            nm,
            true,
          ),
          8000,
        );
      try {
        slotSave(d);
      } catch (_) {}
      saveStatus();
      return false;
    });
  saveStatus();
  return _firstP;
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
          sk: d.sk,
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
                '',
                true,
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
              nm +
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
