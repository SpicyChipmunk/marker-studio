var _saveHold = false,
  _roomFull = false,
  _lastRaw = null,
  // (v318.22) the stored state as it was read, for the fields FUT_GONE describes below (futureKeep/futurePut)
  _future = {},
  // (v296) the unreadable original, when there wasn't room to keep a copy of it: for Download the original, this time
  _lossRaw = null;
const _savedGone = new Set(),
  STATE_BK = 'ms-state-backup',
  LOAD_NOTE = 'ms-load-note',
  // (v318.22 review J) fields this version doesn't write but a stored state may hold: kept as they are so an older
  // tab's save doesn't wipe what a newer one wrote (a second device on a stale cache, or this app before it
  // reloads). It can't tell a newer version's field from one an older version gave up, so a field retired from
  // save() goes in FUT_GONE, or it would be put back for ever. No limit of size or count: a field is put back exactly
  // as it was read, so the stored state can't grow by it (a limit of 4 KB had dropped a field with an entry per marker
  // for a collection of 216 or more, as `cap` and `owned` already are; one of 20 fields, the 21st a newer version
  // added, about five weeks of releases at the pace of autumn 2026)
  FUT_GONE = ['finderView'];
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
  if (state.harmony === 'rainbow') state.palSize = rainbowSnap(state.palSize);
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
// Brands I'd buy (v304): which brands a marker to buy is suggested from, in Match, Shading and the Photo pattern.
// null: automatic (your brands first, another brand only when it's clearly closer); else the brands ticked
state.buyBrands = cleanBuy(state.buyBrands);
// (v303: and the colourless blender, 0, added to the data)
const EXTRA_OHUHU = new Set([
  '0',
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
state.cap = cleanCap(state.cap);
state.capDef = state.capDef === 'old' ? 'old' : '';
if (typeof state.filtersOpen !== 'boolean') state.filtersOpen = false;
// (v318.34) Random's Prefer markers you haven't used yet, off until chosen
state.rndFresh = state.rndFresh ? 1 : 0;
// (v316: 'light', lightest first in each family, is the order for every view; the three rankings are Unowned's)
if (!['light', 'code', 'gap', 'complete', 'ramps'].includes(state.gapSort)) state.gapSort = 'light';
// (v316) Code order was the only order a grid had before, so a saved 'code' is moved to Lightest first once; Code order
// chosen again after that stays
if (state.ordLight1 !== 1) {
  if (state.gapSort === 'code') state.gapSort = 'light';
  state.ordLight1 = 1;
}
if (!Array.isArray(state.customPal)) state.customPal = [];
if (!Array.isArray(state.saved)) state.saved = [];
state.saved = state.saved.map(cleanSaved).filter(Boolean);
// (v310) the quick section check (53-controls-stages) is for people new to the app: at the first start of v310, anyone
// with a guide in their Library keeps the full Check the sections step
try {
  // (not while saves are held for unreadable data, v310.1: decided at the first start the Library can be read)
  if (!_saveHold && localStorage.getItem('ms-sec-tools') == null)
    localStorage.setItem(
      'ms-sec-tools',
      state.saved.some(function (s) {
        return s && s.type === 'guide';
      })
        ? '1'
        : '0',
    );
} catch (_) {}
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
// (v318.22) the stored state, as read: held so save() can put back the fields it doesn't know (FUT_GONE above).
// `saved` is left out: the Library is rebuilt from state.saved, and holding the read copy would keep it in memory
function futureKeep(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return;
  const o = {};
  Object.keys(v).forEach(function (k) {
    if (k !== 'saved' && k !== '__proto__') o[k] = v[k];
  });
  _future = o;
}
// those fields into the object save() has just built: only ones it doesn't write itself, never a retired one
function futurePut(o) {
  Object.keys(_future).forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(o, k) || FUT_GONE.indexOf(k) >= 0) return;
    o[k] = _future[k];
  });
  return o;
}
function parseState(raw) {
  let v;
  try {
    v = JSON.parse(raw);
  } catch (e) {
    return { v: null, bad: [], broken: true };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { v: null, bad: [], broken: true };
  futureKeep(v);
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
      // (v328 review: its own names only, not an object's, "toString")
      harmony: f('harmony', (x) => typeof x === 'string' && harmOk(x), 'complementary'),
      tones: mk('tones', TK),
      sats: mk('sats', SK),
      drawn: f('drawn', arr, [], (a) => [...new Set(idxs('drawn', a))]),
      // (v308: Ohuhu's BGY and YGY families as now named, famNow)
      excluded: new Set(f('excluded', arr, [], (a) => a.filter((x) => typeof x === 'string').map(famNow))),
      palettes: f('palettes', arr, [], (a) =>
        a.filter((p, j) => {
          const ok = arr(p) && p.length > 0 && p.every(ix);
          if (!ok) {
            bad.push('palettes');
            // (its scheme goes with it)
            if (arr(v.palH) && v.palH.length === a.length) v.palH[j] = undefined;
            // (v318.30: and its base)
            if (arr(v.palB) && v.palB.length === a.length) v.palB[j] = undefined;
          }
          return ok;
        }),
      ),
      // (v296) each palette's scheme, in step with palettes: Undo goes back to it
      palH: arr(v.palH)
        ? v.palH
            .filter((x) => x !== undefined)
            .map((x) => (typeof x === 'string' && harmOk(palHarm(x)) ? x : null))
        : [],
      // (v318.30) the marker each Rainbow was built from, in step with palettes (null: not from one, or not a Rainbow);
      // an older save has none. Read as it is: picker.js (rbSeedLoad) puts it back only where it still fits
      palB: arr(v.palB) ? v.palB.filter((x) => x !== undefined) : null,
      pool: f('pool', arr, null, (a) => {
        const o = idxs('pool', a);
        return o.length ? o : null;
      }),
      brands: f('brands', arr, null),
      buyBrands: f('buyBrands', arr, null),
      owned: f('owned', arr, modern ? [] : null, (a) => a.map(knownMkey).filter(Boolean)),
      collView:
        typeof v.collView === 'string' ? v.collView : typeof v.finderView === 'string' ? v.finderView : null,
      finderScope: typeof v.finderScope === 'string' ? v.finderScope : null,
      scopeFlipped: !!v.scopeFlipped,
      satsUpgraded: !!v.satsUpgraded,
      seed: f('seed', (x) => typeof x === 'string', null),
      locked: f('locked', arr, null, (a) => idxs('locked', a)),
      filtersOpen: !!v.filtersOpen,
      gapSort: ['light', 'code', 'gap', 'complete', 'ramps'].includes(v.gapSort) ? v.gapSort : 'light',
      customPal: f('customPal', arr, null, (a) =>
        a.map((x) => (x == null ? null : ix(x) ? x : (bad.push('customPal'), null))),
      ),
      saved: f('saved', arr, null),
      ownedSeedV: modern ? 2 : v.ownedSeedV || null,
      copicAdd1: v.copicAdd1 || null,
      libAdj1: v.libAdj1,
      setFix1: v.setFix1 || null,
      ordLight1: v.ordLight1 || null,
      wish: v.wish,
      ink: v.ink,
      // (v318.21) what each marker's cap says, and the setting for the rest (caps.js)
      cap: v.cap,
      capDef: v.capDef === 'old' ? 'old' : '',
      capQ: v.capQ ? 1 : 0,
      capOffer: v.capOffer ? 1 : 0,
      // (v318.34) Random's Prefer markers you haven't used yet
      rndFresh: v.rndFresh ? 1 : 0,
      // (v328) each tab's changes this state holds (crossMerge)
      tabsSeen:
        v.tabsSeen && typeof v.tabsSeen === 'object' && !Array.isArray(v.tabsSeen) ? v.tabsSeen : null,
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
        excluded: new Set(Array.isArray(o.excluded) ? o.excluded.map(famNow) : []),
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
    ordLight1: 1,
  };
}
// Another tab may have added to the Library since this one last read it: its entries are kept (merged by id) unless
// this tab removed them itself (forgetSaved), so one open window can't wipe what another saved
function forgetSaved(id) {
  _savedGone.add(id);
}
// (v328) Two tabs, or the Home Screen app and a Safari tab: a tab sees another's save only once it has finished what
// it's doing (the browser hands it the new state with the storage event), so a tab saving meanwhile writes its copy
// over a save it hasn't seen. Each tab therefore keeps its own changes, as small steps (a marker added, an ink mark, a
// To buy entry, a Library row, Brands I'd buy, the caps' settings), until a save from another tab shows it has them:
// every save says which of each tab's steps it holds (tabsSeen). A save taken in that misses some of this tab's has
// them put back and saved again, so every tab ends with every tab's changes. A Library row both changed goes to the
// newer save. One tab alone saves as before, with its steps acknowledged by its own saves.
// (this tab's name: not from Math.random where the browser has crypto, as drawing one as the page loads would move
// every seeded test's rolls on, v318.26)
const TAB =
  (function () {
    try {
      const a = new Uint32Array(2);
      crypto.getRandomValues(a);
      return a[0] || a[1] ? a[0].toString(36) + a[1].toString(36) : '';
    } catch (e) {
      return '';
    }
  })() || 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
let _seq = 0,
  // [{ n, at, o: [steps] }] not yet known to be in the stored state
  _ops = [],
  // what each tab's steps the state this tab holds has ({ tab: n })
  _vv = {},
  // the shared fields as last written or taken in, to find this tab's steps since (fingerprints, snapNow)
  _known = null;
const _J = (x) => JSON.stringify(x === undefined ? null : x);
// a row's or an entry's fingerprint: its picture by its size and end only (thumbnails are most of the text)
function fpOf(x) {
  return JSON.stringify(x, function (k, v) {
    return k === 'thumb' && typeof v === 'string' && v.length > 96 ? v.length + ':' + v.slice(-64) : v;
  });
}
function snapOf(v) {
  const o = v && typeof v === 'object' ? v : {},
    saved = new Map(),
    wish = new Map();
  (Array.isArray(o.saved) ? o.saved : []).forEach(function (e) {
    const c = cleanSaved(e);
    if (c) saved.set(c.id, fpOf(c));
  });
  cleanWish(o.wish).forEach(function (w) {
    wish.set(w.k, fpOf(w));
  });
  return {
    owned: new Set(o.owned instanceof Set ? o.owned : Array.isArray(o.owned) ? o.owned : []),
    saved: saved,
    wish: wish,
    ink: cleanInk(o.ink),
    cap: o.cap !== undefined ? cleanCap(o.cap) : null,
    buy: _J(cleanBuy(o.buyBrands)),
    capDef: o.capDef === 'old' ? 'old' : '',
    capQ: o.capQ ? 1 : 0,
    capOffer: o.capOffer ? 1 : 0,
  };
}
function snapNow() {
  return snapOf(state);
}
// this tab's steps since _known (the state as it was last written or taken in)
function stepsNow() {
  if (!_known) {
    // (first: the state as this tab read it)
    const v0 = _lastRaw ? parseState(_lastRaw).v || {} : {};
    _known = snapOf(v0);
    _vv = Object.assign({}, v0.tabsSeen || {});
  }
  const k = _known,
    o = [];
  state.owned.forEach(function (m) {
    if (!k.owned.has(m)) o.push({ t: 'o', k: m, on: 1 });
  });
  k.owned.forEach(function (m) {
    if (!state.owned.has(m)) o.push({ t: 'o', k: m, on: 0 });
  });
  const maps = function (t, cur, was) {
    new Set(Object.keys(cur).concat(Object.keys(was || {}))).forEach(function (m) {
      if ((cur[m] || null) !== ((was || {})[m] || null)) o.push({ t: t, k: m, v: cur[m] || null });
    });
  };
  maps('i', cleanInk(state.ink), k.ink);
  if (k.cap) maps('c', cleanCap(state.cap), k.cap);
  const seenW = new Set();
  state.wish.forEach(function (w) {
    const c = cleanWish([w])[0];
    if (!c) return;
    seenW.add(c.k);
    if (k.wish.get(c.k) !== fpOf(c)) o.push({ t: 'w', k: c.k, e: w });
  });
  k.wish.forEach(function (f, m) {
    if (!seenW.has(m)) o.push({ t: 'w', k: m, e: null });
  });
  const seenS = new Set();
  state.saved.forEach(function (r) {
    const c = cleanSaved(r);
    if (!c) return;
    seenS.add(c.id);
    if (k.saved.get(c.id) !== fpOf(c)) o.push({ t: 's', k: c.id, e: r });
  });
  k.saved.forEach(function (f, id) {
    if (!seenS.has(id)) o.push({ t: 's', k: id, e: null });
  });
  if (_J(cleanBuy(state.buyBrands)) !== k.buy) o.push({ t: 'b', v: cleanBuy(state.buyBrands) });
  ['capDef', 'capQ', 'capOffer'].forEach(function (f) {
    const v = f === 'capDef' ? (state.capDef === 'old' ? 'old' : '') : state[f] ? 1 : 0;
    if (v !== k[f]) o.push({ t: 'x', k: f, v: v });
  });
  return o;
}
// this tab's steps since the last save or what it took in, noted (one batch), → the batch, or null for none
function stepsLog() {
  const o = stepsNow();
  if (!o.length) return null;
  const b = { n: ++_seq, at: Date.now(), o: o };
  _ops.push(b);
  // (kept for 10 minutes and 300 batches at most: a tab that's gone, or a version that doesn't say what it holds)
  const old = Date.now() - 6e5;
  while (_ops.length > 300 || (_ops.length && _ops[0].at < old)) _ops.shift();
  return b;
}
// this tab's steps not in a state another tab saved (tabsSeen: what it holds), put back on the state as taken in
function stepsAgain() {
  _ops.forEach(function (b) {
    b.o.forEach(function (s) {
      if (s.t === 'o') {
        if (s.on) state.owned.add(s.k);
        else state.owned.delete(s.k);
      } else if (s.t === 'i' || s.t === 'c') {
        const m = s.t === 'i' ? state.ink : state.cap;
        if (s.v) m[s.k] = s.v;
        else delete m[s.k];
      } else if (s.t === 'w') {
        const j = state.wish.findIndex((w) => w.k === s.k);
        if (!s.e) {
          if (j >= 0) state.wish.splice(j, 1);
        } else if (j >= 0) state.wish[j] = s.e;
        else state.wish.push(s.e);
      } else if (s.t === 's') {
        const j = state.saved.findIndex((r) => r.id === s.k);
        if (!s.e) {
          if (j >= 0) state.saved.splice(j, 1);
        } else if (j < 0) state.saved.unshift(s.e);
        // (both changed it: the newer save's)
        else if (!((+state.saved[j].ts || 0) > (+s.e.ts || 0))) state.saved[j] = s.e;
      } else if (s.t === 'b') state.buyBrands = s.v ? s.v.slice() : null;
      else if (s.t === 'x') state[s.k] = s.v;
    });
  });
}
// another tab's save (v, as parseState read it; raw, its text) taken in: its markers, Library, To buy, ink and caps,
// this tab's own steps it doesn't hold put back. inPlace: into this tab's own Set, list and maps (in a save, which can
// come in the middle of code holding them). → true when steps were put back (the merge is then saved)
function takeIn(v, inPlace) {
  const seen = v.tabsSeen && typeof v.tabsSeen === 'object' ? v.tabsSeen : {},
    mine = +seen[TAB] || 0;
  _ops = _ops.filter((b) => b.n > mine);
  const owned = Array.isArray(v.owned) ? new Set(v.owned) : null,
    saved = Array.isArray(v.saved) ? v.saved.map(cleanSaved).filter(Boolean) : null,
    wish = cleanWish(v.wish),
    ink = cleanInk(v.ink);
  if (inPlace) {
    // (this tab's own row objects kept where the stored row is the same)
    const by = new Map(state.saved.map((r) => [r.id, r]));
    if (owned) inPlaceSet(state.owned, owned);
    if (saved)
      inPlaceList(
        state.saved,
        saved.map(function (r) {
          const m = by.get(r.id);
          return m && fpOf(cleanSaved(m)) === fpOf(r) ? m : r;
        }),
      );
    const byW = new Map(state.wish.map((w) => [w.k, w]));
    inPlaceList(
      state.wish,
      wish.map(function (w) {
        const m = byW.get(w.k);
        return m && fpOf(cleanWish([m])[0]) === fpOf(w) ? m : w;
      }),
    );
    inPlaceMap(state.ink, ink);
  } else {
    if (owned) state.owned = owned;
    if (saved) state.saved = saved;
    state.wish = wish;
    state.ink = ink;
  }
  state.buyBrands = cleanBuy(v.buyBrands);
  // (v318.22 debug: a save by a version before v318.21, in another tab, has no caps: this tab's stay, and its next save
  // writes them back. They had all been forgotten)
  if (v.cap !== undefined) {
    if (inPlace) inPlaceMap(state.cap, cleanCap(v.cap));
    else state.cap = cleanCap(v.cap);
    state.capDef = v.capDef === 'old' ? 'old' : '';
    state.capQ = v.capQ ? 1 : 0;
    state.capOffer = v.capOffer ? 1 : 0;
  }
  if (_savedGone.size) {
    const keepIt = state.saved.filter((r) => !_savedGone.has(r.id));
    if (keepIt.length !== state.saved.length) inPlaceList(state.saved, keepIt);
  }
  _vv = Object.assign({}, seen);
  if (_ops.length) stepsAgain();
  // (this tab's steps put back are still noted, _ops, till a save of another tab's shows it has them)
  _known = snapNow();
  return _ops.length > 0;
}
// what this tab's save says it holds: every tab's steps it took in, and all of its own
function seenOut() {
  const o = {};
  // (the 15 latest tabs at most besides this one: a tab long closed needn't be carried)
  Object.keys(_vv)
    .filter((t) => t !== TAB)
    .slice(-15)
    .forEach(function (t) {
      o[t] = _vv[t];
    });
  o[TAB] = _seq;
  return o;
}
// (the merge put into this tab's own Set, list and maps, not new ones: a save can come in the middle of code that
// holds them, as the storage event's syncFromStorage never does)
function inPlaceSet(t, src) {
  if (t.size === src.size && [...src].every((k) => t.has(k))) return;
  t.clear();
  src.forEach((k) => t.add(k));
}
function inPlaceList(t, src) {
  if (t.length === src.length && src.every((x, i) => x === t[i])) return;
  t.length = 0;
  src.forEach((x) => t.push(x));
}
function inPlaceMap(t, src) {
  if (_J(t) === _J(src)) return;
  Object.keys(t).forEach((k) => delete t[k]);
  Object.assign(t, src);
}
// in a save: another tab's save already here (seen at once, as a tab beside it can), taken in first
function crossMerge() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (e) {
    return;
  }
  if (typeof raw !== 'string' || raw === _lastRaw) return;
  const p = parseState(raw);
  if (!p.v) return;
  const pre = syncPre();
  takeIn(p.v, true);
  // (drawn once the save is done: the other tab's changes, as hearing its storage event draws them; what changed
  // worked out now, so this tab's own changes after it aren't taken for the other's)
  const post = syncPre();
  setTimeout(function () {
    syncPost(pre, post);
  }, 0);
}
// (v318.23) Safari counts a stored string at 2 bytes a character once any character in it is past U+00FF (a ’ in one
// name doubled the whole Library's share): what's written is plain ASCII, wider characters as \uXXXX, which JSON.parse
// reads as before (older versions too). The round trip makes WebKit hold it 1 byte a character again: a string made
// from a wide one by replace stays wide inside, however plain it reads
function narrow(s) {
  const t = s.replace(/[\u007f-\uffff]/g, function (c) {
    return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
  if (typeof TextEncoder !== 'function' || typeof TextDecoder !== 'function') return t;
  try {
    return new TextDecoder().decode(new TextEncoder().encode(t));
  } catch (e) {
    return t;
  }
}
// With storage blocked nothing can be kept (the banner says so): changes still count for this visit
function save(quiet, noDrop) {
  if (STORE_BLOCKED || _saveHold) return true;
  let e = saveTry();
  // (once leaving out every thumbnail hasn't made room, not tried again until a save works: it would cost ~1 s a save)
  if (e && !noDrop && !_roomFull && quotaErr(e)) {
    e = saveRoom();
    _roomFull = !!e;
  }
  if (!e) {
    _roomFull = false;
    return true;
  }
  if (!quiet) saveFailNotice();
  return false;
}
function quotaErr(e) {
  return (
    !!e &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014)
  );
}
// (v318.23) storage full: the oldest stored thumbnails (by when each was saved) are left out, a growing batch at a time,
// until it fits; they're drawn again from the guides. Nothing else goes. None left and still full: they're put back
// (as stored) and it fails as before
function saveRoom() {
  const th = state.saved
      .filter(function (x) {
        return x && x.thumb;
      })
      .sort(function (a, b) {
        return (+a.ts || 0) - (+b.ts || 0);
      }),
    gone = [];
  let n = 1,
    e = null;
  while (th.length) {
    th.splice(0, n).forEach(function (x) {
      gone.push([x, x.thumb]);
      x.thumb = '';
    });
    e = saveTry();
    if (!e) return null;
    if (!quotaErr(e)) break;
    n *= 2;
  }
  gone.forEach(function (g) {
    g[0].thumb = g[1];
  });
  return e || new Error('full');
}
function saveTry() {
  let batch = null;
  try {
    batch = stepsLog();
    crossMerge();
    const s = narrow(
      JSON.stringify(
        futurePut({
          mode: state.mode,
          palSize: state.palSize,
          harmony: state.harmony,
          tones: [...state.tones],
          sats: [...state.sats],
          drawn: state.drawn,
          excluded: [...state.excluded],
          palettes: state.palettes,
          palH: state.palH,
          // (v318.30: each Rainbow's base, "Rainbow · Ohuhu G310 base" kept across a reload; a version before this
          // one reads past it, or carries it as it was: futurePut)
          palB: typeof rbSeedList === 'function' ? rbSeedList() : null,
          pool: state.pool,
          brands: [...state.brands],
          buyBrands: state.buyBrands,
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
          ordLight1: state.ordLight1,
          wish: state.wish,
          ink: state.ink,
          cap: state.cap,
          capDef: state.capDef,
          capQ: state.capQ,
          capOffer: state.capOffer,
          rndFresh: state.rndFresh ? 1 : 0,
          // (v328: each tab's steps this state holds: crossMerge, takeIn)
          tabsSeen: seenOut(),
        }),
      ),
    );
    localStorage.setItem(KEY, s);
    _lastRaw = s;
    _vv[TAB] = _seq;
    _known = snapNow();
    return null;
  } catch (e) {
    // (not saved: the steps it noted aren't kept, as the change may be put back, keep's undo; the next save notes
    // what's still changed)
    if (batch) _ops = _ops.filter((b) => b !== batch);
    return e;
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
  // (v328: a change here not saved yet noted first, so taking the other tab's in doesn't lose it)
  if (!_saveHold && !STORE_BLOCKED) stepsLog();
  _lastRaw = raw;
  const pre = syncPre();
  // (this tab's own changes the other tab's save didn't have: put back, and saved, so it hears them)
  if (takeIn(p.v, false)) save(true);
  syncPost(pre);
}
// (v328: before and after what another tab saved is taken in: syncFromStorage, crossMerge) what was shown, then what
// changed drawn again
const _syncG = (a) => new Map(a.filter((s) => s.type === 'guide').map((s) => [s.id, s]));
function syncSig() {
  return JSON.stringify([
    [...state.owned].sort(),
    state.saved,
    state.wish,
    state.ink,
    state.buyBrands,
    state.cap,
    state.capDef,
  ]);
}
function syncPre() {
  return { g0: _syncG(state.saved), was: syncSig(), capWas: JSON.stringify([state.cap, state.capDef]) };
}
function syncPost(pre, post) {
  const g0 = pre.g0,
    now = post || syncPre();
  if (now.was === pre.was) return; // only another tab's screen or settings changed
  // (v318.21 debug: what caps say changed there: an open guide's labels and keys drawn again whole)
  if (now.capWas !== pre.capWas && typeof capChanged === 'function') capChanged();
  const g1 = now.g0,
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
      // (and what the open guide suggests follows: its notes had stayed as they were until drawn again, v304)
      if (S && S.collRefresh) S.collRefresh();
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
// Markers' search (v304; it had looked for the text as typed in code, name and old code, so "C3", "cool grey 3" and
// "colourless" found nothing, and "grey" none of Copic's Gray). Text is folded once per marker (sFold): compatibility
// forms (NFKC: Ⅱ, full-width letters), case, curly quotes and dashes, and the two spellings ("grey" finds Gray,
// "colour" Colorless). Each word typed must be found: in the name, at the start of the brand (from four letters: "copi",
// not "cop" on the way to "copper"), or at the start of the code or an old code with hyphens, dots and spaces left out
// ("c3" and "c 3" find C-3; "CGll00", the Ⅱ read as two l's, finds CGII00). A number alone looks after a code's letters
// ("22" finds R22 and E22, "000" the 000s); with other words it is the whole number ("copic 0" finds the 0s, not
// every Copic code with a 0 after its letters). A search that is a whole code (sExact) puts that marker first, then any
// whose old code it was.
function sFold(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc`\u00b4]/g, "'")
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/grey/g, 'gray')
    .replace(/colour/g, 'color');
}
const sCompact = (s) => sFold(s).replace(/[-.\s]/g, '');
let _sHay = null;
function sHay(i) {
  if (!_sHay)
    _sHay = COLORS.map((c, i) => {
      const codes = [sCompact(c.code)];
      if (c.old && c.old !== c.code) {
        const o = sCompact(oldCode(c));
        codes.push(o);
        if (/\u2161/.test(c.old)) codes.push(o.replace(/ii/g, 'll'));
      }
      return {
        codes: codes,
        nums: codes.map((x) => x.replace(/^[a-z]+/, '')),
        // (the name as written too: "gre" still finds Grey on the way to "grey")
        text: sFold(c.name) + '\n' + String(c.name).normalize('NFKC').toLowerCase(),
        // (v318.22 debug: the names printed on its older caps, found where its cap is shown older: Markers showed
        // "R22 Dark Blush" for an older-cap RV17, and searching "Dark Blush" found nothing)
        capText: capHasOld(c)
          ? []
              .concat(c.cap || [], c.capN || [])
              .map((n) => sFold(n))
              .join('\n')
          : '',
        i: i,
        brand: sFold(c.brand),
      };
    });
  return _sHay[i];
}
// the query, folded and split (the last two kept: Markers' and the slot picker's)
let _sQs = [];
function sQueryOf(str) {
  let q = _sQs.find((x) => x.s === str);
  if (!q) {
    const f = sFold(str).trim(),
      words = f.split(/\s+/).filter(Boolean);
    // (a code typed with a space, "c 3" or "r 22", is one code when there is such a code ("gray no 3" stays three
    // words): not a "c" anywhere in a name and a 3 at the end of any code, v304)
    for (let k = words.length - 2; k >= 0; k--) {
      const w = words[k] + words[k + 1];
      if (
        /^[a-z]{1,3}$/.test(words[k]) &&
        /^\d+$/.test(words[k + 1]) &&
        COLORS.some((_, i) => sHay(i).codes.some((x) => x.startsWith(w)))
      )
        words.splice(k, 2, w);
    }
    // (v318.26) cap: the whole query, 4 letters or more, for the start of an older cap's name (sCapStart)
    q = {
      s: str,
      words: words,
      whole: f.replace(/[-.\s]/g, ''),
      cap: f.replace(/[^a-z]/g, '').length >= 4 ? f.replace(/\s+/g, ' ') : '',
    };
    _sQs = [q].concat(_sQs.slice(0, 1));
  }
  return q;
}
function sWord(h, w, multi) {
  // (v318.28) a number with other words is found in a name only as the whole number: "copic 0" had found Cool Gray
  // No.10 and No.00 by their names, eleven markers, not the 0s the rule below finds
  const inName =
    multi && /^\d+$/.test(w) ? new RegExp('(^|\\D)' + w + '(?!\\d)').test(h.text) : h.text.includes(w);
  if (inName || (w.length >= 4 && h.brand.startsWith(w))) return true;
  if (h.capText && h.capText.includes(w) && capIsOldAny(h.i)) return true;
  const k = w.replace(/[-.]/g, '');
  if (!k) return false;
  if (h.codes.some((x) => x.startsWith(k))) return true;
  if (!/^\d+$/.test(k)) return false;
  return multi ? h.nums.includes(k) : h.nums.some((x) => x.startsWith(k));
}
// whether marker i matches a search (Markers' and the custom slot picker's)
function sMatch(i, str) {
  if (!str) return true;
  const q = sQueryOf(str),
    h = sHay(i);
  if (q.whole && h.codes.some((x) => x.startsWith(q.whole))) return true;
  if (q.words.length > 0 && q.words.every((w) => sWord(h, w, q.words.length > 1))) return true;
  return sCapStart(h, q);
}
// (v318.26) an older Ohuhu cap's printed name, found with the setting as it is (codes of now): "Rose Red" finds R213
// Pomegranate, whose older cap says R6 Rose Red. The whole query from 4 letters, as the start of the name and reaching
// its last word ("rose r" on the way): as a word anywhere, "blue" had found 17 more markers and "gray" 28 that their
// names didn't explain, and as any start, "light" 11, "cool grey" 7 and "yellow grey" 3 (Yellow Grey 04…)
function sCapStart(h, q) {
  return (
    !!q.cap &&
    !!h.capText &&
    h.capText.split('\n').some(function (n) {
      return n.startsWith(q.cap) && q.cap.length > n.lastIndexOf(' ');
    })
  );
}
// whether marker i is found by its older cap's name alone: Markers names that cap on its cell (finder.js)
function sByCap(i, str) {
  if (!str) return false;
  const q = sQueryOf(str),
    h = sHay(i);
  if (!sCapStart(h, q)) return false;
  if (q.whole && h.codes.some((x) => x.startsWith(q.whole))) return false;
  return !(q.words.length > 0 && q.words.every((w) => sWord(h, w, q.words.length > 1)));
}
function matchesSearch(i) {
  return sMatch(i, searchStr);
}
// 2: Markers' search names this marker's code (or one word of it does: "copic b04"); 1: one of its old codes; 0: neither
function sExact(i) {
  if (!searchStr) return 0;
  const q = sQueryOf(searchStr),
    h = sHay(i),
    ws = [q.whole].concat(q.words.map((w) => w.replace(/[-.]/g, '')));
  if (ws.includes(h.codes[0])) return 2;
  return h.codes.slice(1).some((x) => ws.includes(x)) ? 1 : 0;
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
function inPool(i) {
  if (NOINK.has(i)) return false;
  // (a selection leaves out markers marked dry too, as everything else does: "Palette from these" let them in, v299)
  return state.pool
    ? poolSet.has(i) && !(isOwned(i) && isDry(i))
    : (state.owned.size ? isOwned(i) && !isDry(i) : buyOk(i)) && passes(i);
}
// (v308) with no markers added yet, the brands you'd buy (Brands I'd buy) stand in for a collection: "Only Copic" had
// still given Ohuhu markers in palettes
function buyOk(i) {
  return !state.buyBrands || state.buyBrands.indexOf(COLORS[i].brand) >= 0;
}
// t: in play; u: drawn and in play; left: in play, not drawn; (v318.34) d: every drawn marker, out: drawn but not in
// play (a filter or selection leaves them out: "5 drawn · 2 not in the filter"; u alone had said "0 drawn" over a pile
// of five, G6)
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
  const d = state.drawn.length;
  return { t, u, left: t - u, d, out: d - u };
}
// (v318.34) the keys of every guide you've worked with, for Random's Prefer markers you haven't used yet: a guide
// with the worked flag (wk: guideWorked, library.js), or, from before the flag, sections ticked (done) or toned (tn)
// or a photo of its finished page (fn)
function usedKeys() {
  const u = new Set();
  state.saved.forEach((s) => {
    if (s.type !== 'guide' || !(s.wk || s.done > 0 || s.tn > 0 || s.fn)) return;
    (s.keys || []).forEach((k) => u.add(k));
  });
  return u;
}
const anyFam = () => families.some((f) => !state.excluded.has(f.name));
const anyTone = () => state.tones.size > 0;
const anySat = () => state.sats.size > 0;
const anyBrand = () => state.brands.size > 0;

// Brands I'd buy (v304): the brands in the data, as they come; a saved choice kept to those (null: automatic)
// (a function, not a constant: the saved choice is read near the top of this file, before a constant here exists)
function allBrands() {
  return [...new Set(COLORS.map((c) => c.brand))];
}
function cleanBuy(a) {
  if (!Array.isArray(a)) return null;
  const o = allBrands().filter((b) => a.indexOf(b) >= 0);
  return o.length ? o : null;
}
