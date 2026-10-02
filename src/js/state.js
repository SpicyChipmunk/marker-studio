var _saveHold = false,
  _lastRaw = null,
  // (v296) the unreadable original, when there wasn't room to keep a copy of it: for Download the original, this time
  _lossRaw = null;
const _savedGone = new Set(),
  STATE_BK = 'ms-state-backup',
  LOAD_NOTE = 'ms-load-note';
let state = load();
if (!state.palSize) state.palSize = 4;
if (!state.harmony) state.harmony = 'complementary';
// (v296) each palette's scheme, in step with the palettes (an older save has none: not known)
if (!Array.isArray(state.palH)) state.palH = [];
while (state.palH.length < state.palettes.length) state.palH.unshift(null);
if (state.palH.length > state.palettes.length)
  state.palH = state.palH.slice(state.palH.length - state.palettes.length);
{
  const R = HARM_RANGE[state.harmony] || [2, 6];
  state.palSize = Math.max(R[0], Math.min(R[1], state.palSize));
  if (state.harmony === 'photo') state.palSize = photoSnap(state.palSize);
}
if (!state.tones) state.tones = new Set(['pale', 'light', 'mid', 'dark']);
if (!state.sats) state.sats = new Set(['neutral', 'muted', 'medium', 'vivid']);
if (!state.satsUpgraded) {
  state.sats = new Set(['neutral', 'muted', 'medium', 'vivid']);
  state.satsUpgraded = true;
}
if (state.mode === 'finder') state.mode = 'collection';
if (!['random', 'palette', 'collection', 'sections', 'home'].includes(state.mode)) state.mode = 'random';
if (state.mode === 'sections') state.mode = 'home';
if (!Array.isArray(state.pool)) state.pool = null;
else {
  // (known markers only, and never the Colorless Blender: no colour to draw, v299)
  state.pool = state.pool.filter((i) => Number.isInteger(i) && i >= 0 && i < COLORS.length && !NOINK.has(i));
  if (!state.pool.length) state.pool = null;
}
state.brands = Array.isArray(state.brands)
  ? new Set(state.brands.filter((b) => b === 'Ohuhu' || b === 'Copic'))
  : new Set(['Ohuhu', 'Copic']);
if (!state.brands.size) state.brands = new Set(['Ohuhu', 'Copic']);
const EXTRA_OHUHU = new Set([
  'B04',
  'BV18',
  'BV39',
  'BV45',
  'BV515',
  'E47',
  'E513',
  'E514',
  'E59',
  'E612',
  'E615',
  'E66',
  'G48',
  'R12',
  'R14',
  'RV02',
  'RV07',
  'RV32',
  'V016',
  'Y110',
  'Y212',
  'Y56',
  'YG35',
  'YR01',
  'YR02',
  'YR05',
  'YR214',
  'YR37',
  'YR54',
]);
const DEFAULT_COPIC = new Set([
  'V20',
  'R89',
  'YG67',
  'V15',
  'BG75',
  'BV13',
  'YR31',
  'Y15',
  'R29',
  'YR09',
  'G14',
  'YG99',
  'YR04',
  '100',
  'B04',
  'BV17',
  'RV14',
  'C-6',
  'C-8',
  'V28',
  'YG63',
  'Y21',
  'RV66',
  'BG11',
  'R85',
  'B37',
  'Y13',
  'B21',
  'E50',
  'E59',
  'BG18',
  'BG49',
  'BG13',
  'B05',
  'B39',
  'Y17',
  'B32',
  'B00',
  'Y35',
  'G17',
  'V17',
  'B29',
  'YG11',
  'RV11',
  'R39',
  'YG13',
  'RV23',
  'BV11',
  'RV10',
  'G29',
  'E37',
  'V12',
  'G28',
  'Y19',
  'Y38',
  'YG93',
  'R20',
  'N-5',
  'R14',
  'R83',
  'BV02',
  'BV04',
  'E33',
  'RV25',
  'RV21',
  'RV63',
  'YG03',
  'YG17',
  'E35',
  'B02',
  'V09',
  'N-3',
  'BG10',
  'Y18',
  'B99',
  'RV13',
  'YG95',
  'BV01',
  'E31',
  'R24',
  'G00',
  'YR07',
  'RV69',
  'RV29',
  'R22',
  'G21',
  'YG23',
  'B34',
  'G05',
  'B60',
  'BG15',
  'G24',
  'Y11',
  'BG78',
  'R08',
  'BG72',
  'BG32',
  'B26',
  'V06',
  'G85',
  'Y26',
  'R46',
  'RV09',
  'YR20',
  'B66',
  'RV19',
  'RV99',
  'YR27',
  'G02',
  'YG97',
  'B79',
  'B18',
  'Y06',
  'V04',
  'R05',
  'YG05',
  'RV06',
]);
const defaultOwned = () =>
  new Set(
    COLORS.filter(
      (c) =>
        (c.brand === 'Ohuhu' && !EXTRA_OHUHU.has(c.code)) ||
        (c.brand === 'Copic' && DEFAULT_COPIC.has(c.code)),
    ).map((c) => c.brand + '|' + c.code),
  );
state.owned = Array.isArray(state.owned) ? new Set(state.owned) : defaultOwned();
if (state.ownedSeedV !== 2) {
  if (state.owned.size) state.owned = defaultOwned();
  state.ownedSeedV = 2;
}
if (state.copicAdd1 !== 1) {
  if (state.owned.size)
    [
      'B26',
      'V06',
      'G85',
      'Y26',
      'R46',
      'RV09',
      'YR20',
      'B66',
      'RV19',
      'RV99',
      'YR27',
      'G02',
      'YG97',
      'B79',
      'B18',
      'Y06',
      'V04',
      'R05',
      'YG05',
      'RV06',
    ].forEach(function (c) {
      state.owned.add('Copic|' + c);
    });
  state.copicAdd1 = 1;
}
if (state.libAdj1 !== 1) {
  if (state.owned.size) {
    ['E49', 'E81', 'E75', 'E814', 'E711', 'YR29', 'YR09', 'YR25', 'YR38', 'Y43', 'Y48', 'Y210'].forEach(
      function (c) {
        state.owned.add('Ohuhu|' + c);
      },
    );
    ['E09', 'E21'].forEach(function (c) {
      state.owned.delete('Copic|' + c);
    });
  }
  state.libAdj1 = 1;
}
if (!['owned', 'unowned', 'all', 'wish'].includes(state.collView)) state.collView = 'owned';
state.wish = cleanWish(state.wish);
state.ink = cleanInk(state.ink);
if (typeof state.filtersOpen !== 'boolean') state.filtersOpen = false;
if (!['code', 'gap', 'complete', 'ramps'].includes(state.gapSort)) state.gapSort = 'code';
if (!Array.isArray(state.customPal)) state.customPal = [];
if (!Array.isArray(state.saved)) state.saved = [];
state.saved = state.saved.map(cleanSaved).filter(Boolean);
if (!state.scopeFlipped) {
  state.finderScope = 'owned';
  state.scopeFlipped = true;
}
if (!['all', 'owned'].includes(state.finderScope)) state.finderScope = 'owned';
if (state.seed === undefined) state.seed = null;
if (!Array.isArray(state.locked)) state.locked = [];
let poolSet = state.pool ? new Set(state.pool) : null;
let searchStr = '';
// Storage the browser won't let the app use at all (site data blocked, some private modes) is found once, here: boot
// says so in one banner, the app still works for this visit, and it is never mistaken for a full storage
const STORE_BLOCKED = (function () {
  try {
    const ls = window.localStorage;
    ls.getItem(KEY);
    try {
      ls.setItem('ms-probe', '1');
      ls.removeItem('ms-probe');
    } catch (e) {
      if (!ls.length) return true;
    }
  } catch (e) {
    return true;
  }
  try {
    if (!window.indexedDB) return true;
  } catch (e) {
    return true;
  }
  return false;
})();
// A saved marker key the app knows: as it is, or a renamed marker's old code (c.old) moved to its new code; null for
// anything else (a code no longer in the data), which is dropped rather than counted but never shown
var _mkKnown = null;
function knownMkey(k) {
  if (typeof k !== 'string') return null;
  if (!_mkKnown) {
    const cur = new Set(COLORS.map((c) => c.brand + '|' + c.code)),
      old = new Map(),
      dup = new Set();
    COLORS.forEach((c) => {
      if (!c.old || c.old === c.code) return;
      const o = c.brand + '|' + c.old;
      if (cur.has(o)) return;
      if (old.has(o)) dup.add(o);
      old.set(o, c.brand + '|' + c.code);
    });
    dup.forEach((o) => old.delete(o));
    _mkKnown = { cur: cur, old: old };
  }
  return _mkKnown.cur.has(k) ? k : _mkKnown.old.get(k) || null;
}
// Reading the saved state: every field is checked on its own, so one bad value costs only that value, never the
// collection or the Library; marker numbers out of range and marker keys the app doesn't know are dropped. When
// something the person would miss was lost (lossOf), or the text couldn't be read at all, it is first copied as it was
// to ms-state-backup (kept until Home's note about it is dismissed); unreadable text is also left in place until the
// person taps or types (holdSaves), so just opening the app can't write over it.
// lost counts what the person would miss: markers, and palettes and guides (Library entries) that had to be left out
// (-1: that whole list was unreadable). Settings put back to their defaults are repairs, not losses.
function parseState(raw) {
  let v;
  try {
    v = JSON.parse(raw);
  } catch (e) {
    return { v: null, bad: [], broken: true };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { v: null, bad: [], broken: true };
  const TK = ['pale', 'light', 'mid', 'dark'],
    SK = ['neutral', 'muted', 'medium', 'vivid'],
    bad = [],
    N = COLORS.length,
    arr = Array.isArray,
    ix = (i) => Number.isInteger(i) && i >= 0 && i < N,
    lost = { markers: 0, palettes: 0, guides: 0 };
  if (v.owned != null && !arr(v.owned)) lost.markers = -1;
  else if (arr(v.owned)) lost.markers = v.owned.filter((x) => typeof x !== 'string').length;
  if (v.saved != null && !arr(v.saved)) lost.palettes = lost.guides = -1;
  else if (arr(v.saved))
    v.saved.forEach((e) => {
      if (!cleanSaved(e)) lost[e && e.type === 'guide' ? 'guides' : 'palettes']++;
    });
  const mk = (k, d) => {
    const a = v[k],
      f = arr(a) ? a.filter((x) => d.includes(x)) : null;
    if (a != null && !(f && f.length === a.length)) bad.push(k);
    return new Set(f && f.length === a.length && f.length ? f : d);
  };
  // v[k] if it passes ok (then fix), the default if it is missing; a value that is there but unusable is noted
  const f = (k, ok, def, fix) => {
    const x = v[k];
    if (x === undefined || x === null) return def;
    if (ok(x)) return fix ? fix(x) : x;
    bad.push(k);
    return def;
  };
  const idxs = (k, a) => {
    const o = a.filter(ix);
    if (o.length !== a.length) bad.push(k);
    return o;
  };
  // a state written by any recent version carries one of these; without them it is from before v2 (see defaultOwned)
  const modern = v.ownedSeedV === 2 || v.copicAdd1 === 1 || v.libAdj1 === 1 || v.setFix1 === 1;
  return {
    broken: false,
    bad: bad,
    lost: lost,
    v: {
      mode: f('mode', (x) => typeof x === 'string', 'home'),
      palSize: f('palSize', (x) => Number.isInteger(x) && x >= 2 && x <= 16, 4),
      harmony: f('harmony', (x) => typeof x === 'string' && !!HARM[x], 'complementary'),
      tones: mk('tones', TK),
      sats: mk('sats', SK),
      drawn: f('drawn', arr, [], (a) => [...new Set(idxs('drawn', a))]),
      excluded: new Set(f('excluded', arr, [], (a) => a.filter((x) => typeof x === 'string'))),
      palettes: f('palettes', arr, [], (a) =>
        a.filter((p, j) => {
          const ok = arr(p) && p.length > 0 && p.every(ix);
          if (!ok) {
            bad.push('palettes');
            // (its scheme goes with it)
            if (arr(v.palH) && v.palH.length === a.length) v.palH[j] = undefined;
          }
          return ok;
        }),
      ),
      // (v296) each palette's scheme, in step with palettes: Undo goes back to it
      palH: arr(v.palH)
        ? v.palH.filter((x) => x !== undefined).map((x) => (typeof x === 'string' && HARM[x] ? x : null))
        : [],
      pool: f('pool', arr, null, (a) => {
        const o = idxs('pool', a);
        return o.length ? o : null;
      }),
      brands: f('brands', arr, null),
      owned: f('owned', arr, modern ? [] : null, (a) => a.map(knownMkey).filter(Boolean)),
      collView:
        typeof v.collView === 'string' ? v.collView : typeof v.finderView === 'string' ? v.finderView : null,
      finderScope: typeof v.finderScope === 'string' ? v.finderScope : null,
      scopeFlipped: !!v.scopeFlipped,
      satsUpgraded: !!v.satsUpgraded,
      seed: f('seed', (x) => typeof x === 'string', null),
      locked: f('locked', arr, null, (a) => idxs('locked', a)),
      filtersOpen: !!v.filtersOpen,
      gapSort: ['code', 'gap', 'complete', 'ramps'].includes(v.gapSort) ? v.gapSort : 'code',
      customPal: f('customPal', arr, null, (a) =>
        a.map((x) => (x == null ? null : ix(x) ? x : (bad.push('customPal'), null))),
      ),
      saved: f('saved', arr, null),
      ownedSeedV: modern ? 2 : v.ownedSeedV || null,
      copicAdd1: v.copicAdd1 || null,
      libAdj1: v.libAdj1,
      setFix1: v.setFix1 || null,
      wish: v.wish,
      ink: v.ink,
    },
  };
}
// → whether the copy is there
function keepStateCopy(raw) {
  try {
    if (localStorage.getItem(STATE_BK) !== raw) localStorage.setItem(STATE_BK, raw);
    return localStorage.getItem(STATE_BK) === raw;
  } catch (e) {
    return false;
  }
}
function holdSaves() {
  _saveHold = true;
  const go = function (e) {
    if (e && e.isTrusted === false) return;
    _saveHold = false;
    removeEventListener('pointerdown', go, true);
    removeEventListener('keydown', go, true);
  };
  addEventListener('pointerdown', go, true);
  addEventListener('keydown', go, true);
}
// Something the person would miss (see parseState's lost, or the whole text unreadable) leaves a note for Home
// (LOAD_NOTE), kept until it is dealt with there (OK, Download the original or a restore). What it holds is what boot.js's
// lossWords reads: {all:true} when nothing could be read, else {markers, palettes, guides} as counted by parseState
// (-1: that whole list was unreadable; palettes and guides are -1 together, as they share the Library's list)
function lossOf(p) {
  const l = p.lost || {};
  return p.broken || !!(l.markers || l.palettes || l.guides);
}
function noteLoss(p) {
  if (!lossOf(p)) return;
  const l = p.lost || {};
  try {
    localStorage.setItem(
      LOAD_NOTE,
      JSON.stringify(
        Object.assign(
          p.broken ? { all: true } : { markers: l.markers, palettes: l.palettes, guides: l.guides },
          p.nocopy ? { nocopy: true } : {},
        ),
      ),
    );
  } catch (e) {}
}
function load() {
  const TK = ['pale', 'light', 'mid', 'dark'],
    SK = ['neutral', 'muted', 'medium', 'vivid'];
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {}
  if (typeof raw !== 'string') raw = null;
  if (raw != null) {
    const p = parseState(raw);
    // (no room for the copy, storage being full: the note says so, and the original is kept here for this time, so
    // Download the original still works; it used to say a copy was kept, v296)
    // (the note first, small, as having no copy: a copy that took the last of the room would leave none for the note,
    // and the loss would go unsaid; once the copy is kept the note says so, v298)
    if (lossOf(p)) {
      p.nocopy = true;
      noteLoss(p);
      if (keepStateCopy(raw)) {
        delete p.nocopy;
        noteLoss(p);
      } else _lossRaw = raw;
    }
    if (p.broken) holdSaves();
    else {
      _lastRaw = raw;
      return p.v;
    }
  }
  try {
    const o = JSON.parse(localStorage.getItem(OLD));
    if (o && Array.isArray(o.drawn))
      return {
        mode: 'home',
        palSize: 4,
        harmony: 'complementary',
        tones: new Set(TK),
        sats: new Set(SK),
        drawn: o.drawn.filter((i) => Number.isInteger(i) && i >= 0 && i < COLORS.length),
        excluded: new Set(Array.isArray(o.excluded) ? o.excluded : []),
        palettes: [],
        pool: null,
      };
  } catch (e) {}
  return {
    mode: 'home',
    palSize: 4,
    harmony: 'complementary',
    tones: new Set(TK),
    sats: new Set(SK),
    drawn: [],
    excluded: new Set(),
    palettes: [],
    pool: null,
    owned: [],
    ownedSeedV: 2,
    copicAdd1: 1,
    libAdj1: 1,
    setFix1: 1,
  };
}
// Another tab may have added to the Library since this one last read it: its entries are kept (merged by id) unless
// this tab removed them itself (forgetSaved), so one open window can't wipe what another saved
function forgetSaved(id) {
  _savedGone.add(id);
}
function savedMerge() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return;
  }
  if (typeof raw !== 'string' || raw === _lastRaw) return;
  let v = null;
  try {
    v = JSON.parse(raw);
  } catch (e) {
    return;
  }
  if (!v || !Array.isArray(v.saved)) return;
  const have = new Set(state.saved.map((s) => s.id));
  v.saved.forEach((e) => {
    const c = cleanSaved(e);
    if (c && !have.has(c.id) && !_savedGone.has(c.id)) {
      state.saved.push(c);
      have.add(c.id);
    }
  });
}
// With storage blocked nothing can be kept (the banner says so): changes still count for this visit
function save(quiet) {
  if (STORE_BLOCKED || _saveHold) return true;
  try {
    savedMerge();
    const s = JSON.stringify({
      mode: state.mode,
      palSize: state.palSize,
      harmony: state.harmony,
      tones: [...state.tones],
      sats: [...state.sats],
      drawn: state.drawn,
      excluded: [...state.excluded],
      palettes: state.palettes,
      palH: state.palH,
      pool: state.pool,
      brands: [...state.brands],
      owned: [...state.owned],
      collView: state.collView,
      finderScope: state.finderScope,
      scopeFlipped: state.scopeFlipped,
      satsUpgraded: state.satsUpgraded,
      seed: state.seed,
      locked: state.locked,
      filtersOpen: state.filtersOpen,
      gapSort: state.gapSort,
      customPal: state.customPal,
      saved: state.saved,
      ownedSeedV: state.ownedSeedV,
      copicAdd1: state.copicAdd1,
      libAdj1: state.libAdj1,
      setFix1: state.setFix1,
      wish: state.wish,
      ink: state.ink,
    });
    localStorage.setItem(KEY, s);
    _lastRaw = s;
    return true;
  } catch (e) {
    if (!quiet) saveFailNotice();
    return false;
  }
}
// a change the person just made: kept, or (storage full) put back with `undo` and said so, returning false so no
// "Saved" or Undo toast follows it
function keep(undo) {
  if (save(true)) return true;
  try {
    undo();
  } catch (e) {}
  saveFailNotice(true);
  return false;
}
// Another tab or window saved (the storage event): take its markers, Library, shopping list and ink, keeping this
// tab's own screen and settings, and redraw what is showing. A guide open here hears if its Library entry went, came
// back or was renamed.
function syncFromStorage() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return;
  }
  if (typeof raw !== 'string' || raw === _lastRaw) return;
  const p = parseState(raw);
  if (!p.v) return;
  _lastRaw = raw;
  const v = p.v,
    G = (a) => new Map(a.filter((s) => s.type === 'guide').map((s) => [s.id, s])),
    g0 = G(state.saved),
    sig = () => JSON.stringify([[...state.owned].sort(), state.saved, state.wish, state.ink]),
    was = sig();
  if (Array.isArray(v.owned)) state.owned = new Set(v.owned);
  if (Array.isArray(v.saved)) state.saved = v.saved.map(cleanSaved).filter(Boolean);
  state.wish = cleanWish(v.wish);
  state.ink = cleanInk(v.ink);
  if (sig() === was) return; // only another tab's screen or settings changed
  const g1 = G(state.saved),
    S = window.SF;
  if (S) {
    g0.forEach((s, id) => {
      if (!g1.has(id) && S.libChanged) S.libChanged(id, false);
    });
    g1.forEach((s, id) => {
      const o = g0.get(id);
      if (!o) {
        if (S.libChanged) S.libChanged(id, true);
      } else {
        if (s.name && s.name !== o.name && S.renamed) S.renamed(id, s.name);
        if ((+s.ts || 0) !== (+o.ts || 0) && S.libChanged) S.libChanged(id, 'changed');
      }
    });
  }
  try {
    if (state.mode === 'sections') {
      if (S && S.setCollection) S.setCollection(sfCollection());
    } else fullRender();
    if (savedOverlay.classList.contains('on') && !_libEd) renderSaved();
    else renderLibStat();
    if (mkOpenIdx != null) mkFill(mkOpenIdx);
    // a lost guide another tab added back (or saved) is no longer offered here
    if (typeof renderHomeNotes === 'function') renderHomeNotes();
  } catch (e) {
    setTimeout(function () {
      throw e;
    }, 0);
  }
}
// (v296) a page brought back from the browser's back/forward cache, or a tab coming back into view, hears no storage
// events from while it was away: it reads what's saved before its next save can write its old markers back
addEventListener('pageshow', function (e) {
  if (e.persisted) syncFromStorage();
});
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') syncFromStorage();
});
addEventListener('storage', function (e) {
  if (e.key === KEY || e.key === null) syncFromStorage();
  else if (e.key === BK_KEY || e.key === BK_SIG || e.key === BK_SNOOZE) {
    try {
      renderBackupNudge();
      renderLibStat();
    } catch (_) {}
  }
});
function inTone(i) {
  return state.tones.has(TONE[i]);
}
function inSat(i) {
  return state.sats.has(SAT[i]);
}
const mkey = (i) => COLORS[i].brand + '|' + COLORS[i].code;
function isOwned(i) {
  return state.owned.has(mkey(i));
}
function inBrand(i) {
  return state.brands.has(COLORS[i].brand);
}
// Filter groups (brand, tone, sat, fam): nothing chosen means every marker. Tapping a chip shows only that one;
// tapping more adds them; tapping a chosen one removes it, and removing the last goes back to everything.
const FG = {
  brand: {
    all: () => BRAND_DEFS.map((b) => b.k),
    get: () => state.brands,
    set: (s) => {
      state.brands = s;
    },
  },
  tone: {
    all: () => TONE_DEFS.map((t) => t.k),
    get: () => state.tones,
    set: (s) => {
      state.tones = s;
    },
  },
  sat: {
    all: () => SAT_DEFS.map((s) => s.k),
    get: () => state.sats,
    set: (s) => {
      state.sats = s;
    },
  },
  fam: {
    all: () => families.map((f) => f.name),
    get: () => new Set(families.map((f) => f.name).filter((n) => !state.excluded.has(n))),
    set: (s) => {
      state.excluded = new Set(families.map((f) => f.name).filter((n) => !s.has(n)));
    },
  },
};
function fgIsAll(g) {
  const s = FG[g].get();
  return FG[g].all().every((k) => s.has(k));
}
function fgSel(g, k) {
  return !fgIsAll(g) && FG[g].get().has(k);
}
function fgTap(g, k) {
  const G = FG[g],
    a = G.all();
  let s = new Set(G.get());
  if (fgIsAll(g)) s = new Set([k]);
  else if (s.has(k)) s.delete(k);
  else s.add(k);
  if (!s.size || a.every((x) => s.has(x))) s = new Set(a);
  G.set(s);
}
function fgClear(g) {
  FG[g].set(new Set(FG[g].all()));
}
function fgNormalize() {
  ['brand', 'tone', 'sat', 'fam'].forEach((g) => {
    if (!FG[g].get().size) fgClear(g);
  });
}
function passes(i) {
  return !state.excluded.has(COLORS[i].fam) && inTone(i) && inSat(i) && inBrand(i);
}
function matchesSearch(i) {
  if (!searchStr) return true;
  const c = COLORS[i];
  return (c.code + ' ' + c.name + ' ' + (c.old || '')).toLowerCase().includes(searchStr);
}
function avail(i) {
  return passes(i) && matchesSearch(i);
}
function setPool(a) {
  // (never the Colorless Blender: no colour to draw, though "N colours" counted it, v299)
  if (a) a = a.filter((i) => !NOINK.has(i));
  state.pool = a && a.length ? a.slice() : null;
  poolSet = state.pool ? new Set(state.pool) : null;
}
var _poolAll = false;
function inPool(i) {
  if (NOINK.has(i)) return false;
  if (_poolAll) return passes(i);
  // (a selection leaves out markers marked dry too, as everything else does: "Palette from these" let them in, v299)
  return state.pool
    ? poolSet.has(i) && !(isOwned(i) && isDry(i))
    : (state.owned.size ? isOwned(i) && !isDry(i) : true) && passes(i);
}
function counts() {
  const dn = new Set(state.drawn);
  let t = 0,
    u = 0;
  COLORS.forEach((c, i) => {
    if (inPool(i)) {
      t++;
      if (dn.has(i)) u++;
    }
  });
  return { t, u, left: t - u };
}
const anyFam = () => families.some((f) => !state.excluded.has(f.name));
const anyTone = () => state.tones.size > 0;
const anySat = () => state.sats.size > 0;
const anyBrand = () => state.brands.size > 0;
