/* ---- zones: parts of the picture with their own pattern and colours ----
    A zone is a set of sections with its own Pattern and Colours settings (ZONE_KEYS: the pattern, its flow and look,
    the start colour, Blend's spread, mix and anchors, the marker count, Mood, Temperature and where the colours come
    from). Shading, texture and the photo are the whole guide's. Every section is in exactly one zone: "Main" holds
    all those not in another, so a guide without zones is simply Main, as guides always were.

    The settings of the zone being edited (zoneCur) are the live variables every control and pattern already uses
    (family, gradShape, limitN...); the other zones keep theirs in their records (zoneMain for Main, zones[i].st and
    .an for the rest) and are swapped in to build (zoneWith). A zone's pattern is built over its own sections and its
    own extent (zBox: a gradient runs across the zone, a radial one from its middle), then put together with the other
    zones' sections as they were (zoneRun), so changing one zone never rolls another again (a Random zone keeps its
    colours). Pins win over any zone, as they win over any pattern.

    Membership is kept by section number (secs), also for sections left out for now (Edit sections), so they come back
    in their zone. It's saved with the guide (payload.zones) and follows section edits as pins do (zoneAfterEdit).

    Each zone also has its own shading (z.sh: whether it's shaded, how round, its Highlights and Shadows), which is
    NOT swapped into the live variables: drawing reads each section's zone's own (zsh, zshOf; 45-shading), whichever
    zone the tabs edit. Main's are the shading variables themselves. */
const ZONE_KEYS = [
  'family',
  'palette',
  'gradShape',
  'dir',
  'look',
  'emphasis',
  'limitN',
  'noAdj',
  'balance',
  'balM',
  'balS',
  'balA',
  'balSeed',
  'noRep',
  'gradSeed',
  'gradScat',
  'gradJit',
  'gradFix',
  'radC',
  'blendFall',
  'blendMix',
  'expand',
  'expandChar',
  'paletteSource',
  'savedPalId',
  'genHarmony',
  'genPal',
];
// (at most this many zones besides Main: enough for a picture's parts, few enough for the row of chips)
const ZONE_MAX = 8;
let zones = [], // [{ id, name, secs: { l: 1 }, st, an }] (the zone being edited: its live settings are the ones in use)
  zoneCur = 0, // the zone the Pattern and Colours tabs edit (0: Main)
  zoneMain = null, // Main's settings and anchors ({ st, an }) while another zone is being edited
  zoneNext = 1, // the next zone's id
  zoneBuilding = null, // the zone a pattern is being built for (zoneRun), else the one being edited
  zBox = null, // the extent the pattern being built lays its flow over ({ x0, y0, x1, y1 }; null: the picture)
  _zmap = null, // zone of each section (Int32Array, rebuilt when membership changes: zoneDirty)
  _zshVer = 0, // goes up whenever which zone a section is in, or a zone's shading, may have changed (45-shading's caches)
  _zshGeoVer = 0; // the same, but only for what the shade field depends on: membership, Shade (on) and Roundness

function zoneById(id) {
  for (let i = 0; i < zones.length; i++) if (zones[i].id === id) return zones[i];
  return null;
}
function zoneName(id) {
  if (!id) return 'Main';
  const z = zoneById(id);
  return z ? z.name : 'Main';
}
function zoneDirty() {
  _zmap = null;
  _zshVer++;
  _zshGeoVer++;
}
// the zone a section is in (0: Main)
function zoneOf(l) {
  if (!zones.length) return 0;
  const K = comps ? comps.length : 0;
  if (!_zmap || _zmap.length !== K) {
    _zmap = new Int32Array(K);
    zones.forEach(function (z) {
      for (const k in z.secs) if (+k < K) _zmap[+k] = z.id;
    });
  }
  return l > 0 && l < _zmap.length ? _zmap[l] : 0;
}
// the zones in their order: Main, then the others as they were made
function zoneIds() {
  return [0].concat(
    zones.map(function (z) {
      return z.id;
    }),
  );
}
// the counted sections of one zone (all of them without zones)
function zoneSecs(id, cl) {
  const all = cl || countedList();
  if (!zones.length) return all;
  return all.filter(function (l) {
    return zoneOf(l) === id;
  });
}
// the sections of the zone being built, or else the one being edited: what the pattern, the pool and the notes under
// the controls work on
function zoneList() {
  return zoneSecs(zoneBuilding != null ? zoneBuilding : zoneCur);
}
// the box around a zone's sections (null without zones: the whole picture)
function zoneBoxOf(secs) {
  if (!zones.length || !secs.length) return null;
  const B = secBoxes();
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1,
    y1 = -1;
  secs.forEach(function (l) {
    if (!(l < B.K) || B.x1[l] < 0) return;
    if (B.x0[l] < x0) x0 = B.x0[l];
    if (B.y0[l] < y0) y0 = B.y0[l];
    if (B.x1[l] > x1) x1 = B.x1[l];
    if (B.y1[l] > y1) y1 = B.y1[l];
  });
  return x1 < 0 ? null : { x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1 };
}
// the extent a pattern lays its flow over: the zone being built, else the whole picture
function zbX0() {
  return zBox ? zBox.x0 : 0;
}
function zbY0() {
  return zBox ? zBox.y0 : 0;
}
function zbW() {
  return zBox ? zBox.x1 - zBox.x0 : W;
}
function zbH() {
  return zBox ? zBox.y1 - zBox.y0 : H;
}

// ---- each zone's shading (45-shading reads it per section) ----
// on: shaded at all; round: Roundness; hi, lo: the Highlight and Shadow amounts; shadow, hilite: their kinds
const ZSH_KEYS = ['on', 'round', 'hi', 'lo', 'shadow', 'hilite'];
let _zshM = null;
// Main's, from the shading variables (one object while they stay the same). Without zones every section is Main's
// and shaded whenever shading is on: "Shade Main" is a choice only beside other zones.
function zshMain() {
  const on = shadeMain || !zones.length,
    m = _zshM;
  if (
    !m ||
    m.on !== on ||
    m.round !== shadeRound ||
    m.hi !== shadeHi ||
    m.lo !== shadeLo ||
    m.shadow !== shadeShadow ||
    m.hilite !== shadeHilite
  )
    _zshM = { on: on, round: shadeRound, hi: shadeHi, lo: shadeLo, shadow: shadeShadow, hilite: shadeHilite };
  return _zshM;
}
function zsh(id) {
  if (!id) return zshMain();
  const z = zoneById(id);
  return z && z.sh ? z.sh : zshMain();
}
// A section with ink on the paper (ticked, or some of its tones coloured: inkOn) keeps the Highlights it was coloured
// with, so a change to them leaves its tones' markers as they are; its Shadows are kept once its shadow is on the paper
// too (that tone ticked, or the section ticked: the shadow always comes last), and until then follow the setting
// (v285; v284 kept both from the first tone). heldSh[l] = { hilite, shadow, free }: free, the shadow follows the setting
// (shadow is then only what it was when noted); legacy, a section saved by v284 keeps both as saved. Noted the first time
// its shading is looked up while it's coloured (heldSweep notes them all on the way back to the plan), dropped once it
// isn't. A record is replaced, never changed in place (Undo keeps references to them). Recolour them too (87-undo)
// lets them go. Saved with the guide where they differ.
let heldSh = {},
  // goes up with every change to it: heldSet and heldReset, v304
  _heldVer = 0;
const _zshHeld = new WeakMap();
// every change to heldSh goes through these two, so the caches that go by it (shadeUse, mixCache) see it: one made
// by Undo or on opening a guide too, v304
function heldSet(l, h) {
  if (h) heldSh[l] = h;
  else delete heldSh[l];
  _heldVer++;
}
function heldReset(o) {
  heldSh = o ? Object.assign({}, o) : {};
  _heldVer++;
}
function inkOn(l) {
  return !!colored && (!!colored[l] || !!(tonePart && tonePart._c === colored && tonePart[l]));
}
// the shadow is on the paper: the section ticked, or its shadow tone (bit 4) done
function shadowOn(l) {
  return !!colored && (!!colored[l] || !!(tonePart && tonePart._c === colored && tonePart[l] & 4));
}
function zshOf(l) {
  const z = zones.length ? zsh(zoneOf(l)) : zshMain();
  if (!colored) return z;
  let h = heldSh[l];
  if (!inkOn(l)) {
    if (h) heldSet(l, null);
    return z;
  }
  const so = shadowOn(l);
  if (!h) {
    heldSet(l, { shadow: z.shadow, hilite: z.hilite, free: !so });
    return z;
  }
  if (!h.legacy && !!h.free === so) {
    h = { shadow: so ? z.shadow : h.shadow, hilite: h.hilite, free: !so };
    heldSet(l, h);
  }
  const sh = h.free ? z.shadow : h.shadow;
  if (sh === z.shadow && h.hilite === z.hilite) return z;
  // (one object per zone's shading and what's held, as the tones' caches go by its identity)
  let m = _zshHeld.get(z);
  if (!m) _zshHeld.set(z, (m = {}));
  const k = sh + '|' + h.hilite;
  return m[k] || (m[k] = Object.assign({}, z, { shadow: sh, hilite: h.hilite }));
}
function heldSweep() {
  if (assignData && colored)
    assignData.order.forEach(function (l) {
      zshOf(l);
    });
}
// a zone's shading as a plain copy (for a new zone, Undo and saving)
function zshCopy(o) {
  const c = {};
  ZSH_KEYS.forEach(function (k) {
    c[k] = o[k];
  });
  return c;
}
// set one of zone id's shading settings (Main's: the variable). A zone's record is replaced, never changed in place.
function zshSet(id, k, v) {
  if (!id) {
    if (k === 'on') shadeMain = v;
    else if (k === 'round') shadeRound = v;
    else if (k === 'hi') shadeHi = v;
    else if (k === 'lo') shadeLo = v;
    else if (k === 'shadow') shadeShadow = v;
    else if (k === 'hilite') shadeHilite = v;
  } else {
    const z = zoneById(id);
    if (!z) return;
    const o = zshCopy(z.sh || zshMain());
    o[k] = v;
    z.sh = o;
  }
  _zshVer++;
  // (Highlights and Shadows change the tones only, not where the light falls, v304)
  if (k === 'on' || k === 'round') _zshGeoVer++;
}
// a zone's shading from a saved guide: each setting checked as the guide's own are (STYLE_FIELDS' shade group), and
// one it doesn't have (a zone saved before v281) is Main's, which it had then
function zshOpen(src) {
  const m = zshMain(),
    o = {},
    fld = {};
  STYLE_FIELDS.forEach(function (f) {
    if (f.in === 'shade') fld[f.key] = f;
  });
  src = src && typeof src === 'object' ? src : {};
  ZSH_KEYS.forEach(function (k) {
    const f = fld[k === 'on' ? 'main' : k];
    o[k] = k in src && f && f.check ? f.check(src[k], m[k], src) : k === 'on' ? true : m[k];
  });
  return o;
}

// ---- swapping a zone's settings in and out of the live variables ----
function zCopy(v) {
  return Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
}
function zAnchors(a) {
  return (a || []).map(function (x) {
    return { x: x.x, y: x.y, mkey: x.mkey };
  });
}
function zLiveSt() {
  const o = {};
  ZONE_KEYS.forEach(function (k) {
    o[k] = zCopy(STYLE_VAR[k]);
  });
  return o;
}
function zSetSt(o) {
  ZONE_KEYS.forEach(function (k) {
    if (k in o) STYLE_VAR[k] = zCopy(o[k]);
  });
}
// the live settings go into the record of the zone they belong to (live: zoneBuilding while building, else zoneCur)
function zStash(id) {
  const rec = { st: zLiveSt(), an: zAnchors(anchors) };
  if (!id) zoneMain = rec;
  else {
    const z = zoneById(id);
    if (z) {
      z.st = rec.st;
      z.an = rec.an;
    }
  }
}
// a zone's record into the live settings
function zLoad(id) {
  const rec = id ? zoneById(id) : zoneMain;
  if (!rec || !rec.st) return;
  zSetSt(rec.st);
  anchors = zAnchors(rec.an);
}
// the zone whose settings are live now: the one being built (zoneWith), else the one being edited
function zoneLive() {
  return zoneBuilding != null ? zoneBuilding : zoneCur;
}
// the pattern of zone id, without copying its settings
function zoneFamily(id) {
  if (id === zoneLive()) return family;
  const rec = id ? zoneById(id) : zoneMain;
  return rec && rec.st ? rec.st.family : family;
}
// the settings of zone id, as a record (the live ones for the zone whose settings are live)
function zoneRec(id) {
  if (id === zoneLive()) return { st: zLiveSt(), an: zAnchors(anchors) };
  const rec = id ? zoneById(id) : zoneMain;
  return rec && rec.st ? { st: zCopy(rec.st), an: zAnchors(rec.an) } : { st: zLiveSt(), an: [] };
}
// run fn with zone id's settings live (and its sections for zoneList, and its extent for the flow); whatever fn changes
// in them (a Blend's first anchors, a new generated palette) is kept in that zone's record
function zoneWith(id, fn) {
  const was = zoneBuilding,
    wasBox = zBox;
  if (id !== zoneCur) {
    zStash(zoneCur);
    zLoad(id);
  }
  zoneBuilding = id;
  zBox = zoneBoxOf(zoneSecs(id));
  try {
    return fn();
  } finally {
    zoneBuilding = was;
    zBox = wasBox;
    if (id !== zoneCur) {
      zStash(id);
      zLoad(zoneCur);
    }
  }
}

// ---- building ----
// Build the zones in ids with build(cl) (which sets assignData for the sections cl, from the live settings), and put
// them together with the other zones' sections as they were. The zone being edited is built last, so what the
// controls show about the last build (the pool's size, the Photo pattern's figures) is about it. Without zones it's
// build(all sections). False when a build couldn't be made (no markers for it): that zone keeps what it had.
// Sections of other zones that touch the zone being built, with the markers they have (set by zoneRun): the builds
// that keep touching sections apart (Balance, No repeats, Random's clearly different) keep clear of them too, so a
// zone's border is no place for two touching sections to share a marker. A zone being built later in the same run
// isn't counted (its markers are about to change; it keeps clear of this one instead). v298
let zoneNb = null;
function nbOf(assign, q) {
  return assign[q] || (zoneNb && zoneNb[q]) || null;
}
function zoneRun(ids, build) {
  if (!zones.length) return build(countedList()) !== false;
  const prev = assignData,
    all = countedList(),
    order = ids
      .filter(function (id) {
        return id !== zoneCur;
      })
      .concat(ids.indexOf(zoneCur) >= 0 ? [zoneCur] : []),
    parts = {};
  let ok = true;
  order.forEach(function (id) {
    // (as it was before this run while zoneWith finds the zone's extent from its sections: the zone laid before left
    // only its own in assignData, so every zone after the first was laid over the whole picture, v304)
    assignData = prev;
    zoneWith(id, function () {
      const cl = zoneSecs(id, all);
      if (!cl.length) {
        parts[id] = { assign: {}, order: [], base: {} };
        return;
      }
      assignData = prev;
      zoneNb = {};
      all.forEach(function (l) {
        const z = zoneOf(l);
        if (z === id) return;
        const src = parts[z] ? parts[z].assign : ids.indexOf(z) >= 0 ? null : prev && prev.assign;
        if (src && src[l]) zoneNb[l] = src[l];
      });
      let r;
      try {
        r = build(cl);
      } finally {
        zoneNb = null;
      }
      if (r === false) {
        ok = false;
        return;
      }
      parts[id] = assignData;
    });
  });
  assignData = zoneMerge(prev, parts, all);
  applyLocks();
  return ok;
}
// one assignment from the zones' parts (built now) and the rest of prev (the other zones' sections as they were)
function zoneMerge(prev, parts, all) {
  const assign = {},
    base = {},
    paper = {},
    lits = {},
    shps = {},
    order = [];
  let hasPaper = false;
  zoneIds().forEach(function (id) {
    const p = parts[id];
    if (p) {
      p.order.forEach(function (l) {
        if (!p.assign[l]) return;
        assign[l] = p.assign[l];
        base[l] = (p.base && p.base[l]) || p.assign[l];
        order.push(l);
      });
      if (p.paper)
        for (const l in p.paper) {
          paper[l] = 1;
          hasPaper = true;
        }
      if (p.lit) lits[id] = p.lit;
      else if (p.lits && p.lits[id]) lits[id] = p.lits[id];
      // (its markers picked with shading in mind, v306: gradShpOf)
      if (p.shp || (p.shps && p.shps[id])) shps[id] = 1;
    } else if (prev) {
      prev.order.forEach(function (l) {
        if (zoneOf(l) !== id || !prev.assign[l]) return;
        assign[l] = prev.assign[l];
        base[l] = (prev.base && prev.base[l]) || prev.assign[l];
        order.push(l);
      });
      if (prev.paper)
        for (const l in prev.paper)
          if (zoneOf(+l) === id) {
            paper[l] = 1;
            hasPaper = true;
          }
      if (prev.lits && prev.lits[id]) lits[id] = prev.lits[id];
      else if (!id && prev.lit) lits[0] = prev.lit;
      if (prev.shps ? prev.shps[id] : !id && prev.shp) shps[id] = 1;
    }
  });
  // sections counted but in no part yet (brought in since the last build): the pattern of their zone comes next time;
  // meanwhile they keep what they had
  const d = { assign: assign, order: order, N: order.length, base: base };
  if (hasPaper) d.paper = paper;
  if (Object.keys(lits).length) d.lits = lits;
  if (Object.keys(shps).length) d.shps = shps;
  void all;
  return d;
}
// every zone built again (a new guide, the markers you own changed): all of them, each from its own settings
function zoneAll() {
  return zoneIds();
}
// sections that stay in a Random zone among ids while the sections moved come and go: their markers as they are now,
// to put back after the zone is laid again (a roll isn't taken again because a section left or joined)
function zoneStayRandom(ids, moved) {
  if (!assignData || !zones.length) return null;
  const A = assignData.assign,
    B = assignData.base || {},
    stay = {};
  let any = false;
  ids.forEach(function (id) {
    if (zoneRec(id).st.family !== 'random') return;
    zoneSecs(id).forEach(function (l) {
      if (moved[l] || !A[l]) return;
      stay[l] = { m: A[l], b: B[l] || A[l] };
      any = true;
    });
  });
  return any ? stay : null;
}
function zoneStayPut(stay) {
  const A = assignData.assign,
    B = assignData.base || (assignData.base = {});
  for (const l in stay)
    if (A[l]) {
      A[l] = stay[l].m;
      B[l] = stay[l].b;
    }
  applyLocks();
}

// ---- membership ----
// sections moved into zone id (0: back to Main); returns the zones whose sections changed
function zoneMove(secs, id) {
  const touched = {};
  secs.forEach(function (l) {
    const from = zoneOf(l);
    if (from === id) return;
    touched[from] = 1;
    touched[id] = 1;
    if (from) delete zoneById(from).secs[l];
    if (id) zoneById(id).secs[l] = 1;
    zoneDirty();
  });
  return Object.keys(touched).map(Number);
}
// a new zone (empty; it starts with the settings of the zone being edited, so it looks the same until you change it)
function zoneNew() {
  if (zones.length >= ZONE_MAX) return null;
  zStash(zoneCur);
  const rec = zoneRec(zoneCur);
  let n = zones.length + 1,
    name = 'Zone ' + n;
  const used = {};
  zones.forEach(function (z) {
    used[z.name] = 1;
  });
  while (used[name]) name = 'Zone ' + ++n;
  // (its shading too, flat or shaded, as the zone it was made from: 45-shading; but Radial's rings start in its own
  // middle, as a place on the picture moved for another zone would likely be outside it)
  const z = {
    id: zoneNext++,
    name: name,
    secs: {},
    st: Object.assign({}, rec.st, { radC: null }),
    an: [],
    sh: zshCopy(zsh(zoneCur)),
  };
  zones.push(z);
  zoneDirty();
  return z;
}
// zone id goes (its sections back to Main); the zones become just Main again when it was the last
function zoneDelete(id) {
  const z = zoneById(id);
  if (!z) return;
  if (zoneCur === id) zoneSelect(0);
  zones = zones.filter(function (x) {
    return x.id !== id;
  });
  zoneDirty();
  if (!zones.length) zoneNoneLeft();
}
// the last zone went: Main is the whole guide again, which the shading's Off and on govern ("Shade Main" had no
// control left to turn it back)
function zoneNoneLeft() {
  zoneMain = null;
  shadeMain = true;
}
// the Pattern and Colours tabs edit zone id from now on
function zoneSelect(id) {
  if (id === zoneCur || (id && !zoneById(id))) return;
  // (the one being left keeps its settings in its record)
  zStash(zoneCur);
  zoneCur = id;
  zLoad(id);
}
// back to no zones at all (a new picture, a guide without them)
function zoneReset() {
  zones = [];
  zoneCur = 0;
  zoneMain = null;
  zoneNext = 1;
  zoneBuilding = null;
  zBox = null;
  zoneDirty();
}

// ---- Undo (87-undo) ----
// the zones as an Undo step keeps them (null without zones): which is edited, each one's sections, name and settings
// (the edited one's are the step's own style settings)
function zoneSnap() {
  if (!zones.length) return null;
  return {
    cur: zoneCur,
    main: zoneCur ? zoneRec(0) : null,
    list: zones.map(function (z) {
      const own = z.id === zoneCur;
      return {
        id: z.id,
        name: z.name,
        secs: Object.keys(z.secs)
          .map(Number)
          .sort(function (a, b) {
            return a - b;
          }),
        st: own ? null : zCopy(z.st),
        an: own ? null : zAnchors(z.an),
        sh: zshCopy(z.sh || zshMain()),
      };
    }),
    next: zoneNext,
  };
}
// the zones back as a step had them (the live settings are then set from the step's style, and stashed)
function zoneRestore(zs) {
  if (!zs) {
    zoneReset();
    return;
  }
  zones = zs.list.map(function (x) {
    const secs = {};
    x.secs.forEach(function (l) {
      secs[l] = 1;
    });
    return {
      id: x.id,
      name: x.name,
      secs: secs,
      st: zCopy(x.st),
      an: zAnchors(x.an),
      sh: zshCopy(x.sh || zshMain()),
    };
  });
  zoneCur = zoneById(zs.cur) ? zs.cur : 0;
  if (zs.main) zoneMain = { st: zCopy(zs.main.st), an: zAnchors(zs.main.an) };
  zoneNext = Math.max(zs.next || 1, zoneNext);
  zoneDirty();
}
function zoneNameIn(zs, id) {
  if (!id) return 'Main';
  for (let i = 0; i < zs.list.length; i++) if (zs.list[i].id === id) return zs.list[i].name;
  return 'Main';
}
// did the zone being edited change its own settings (not the whole guide's) between two steps?
function zoneKeysDiffer(a, b) {
  return (
    ZONE_KEYS.some(function (k) {
      return JSON.stringify(a[k]) !== JSON.stringify(b[k]);
    }) || JSON.stringify(a.anchors) !== JSON.stringify(b.anchors)
  );
}
// a step that changed the zones themselves: made, deleted, renamed, or sections moved into or out of one
function zoneStepLabel(za, zb) {
  const la = za ? za.list : [],
    lb = zb ? zb.list : [],
    ia = {},
    ib = {};
  la.forEach(function (x) {
    ia[x.id] = x;
  });
  lb.forEach(function (x) {
    ib[x.id] = x;
  });
  const n = function (k, one) {
    return k + ' section' + (k === 1 ? '' : 's') + one;
  };
  for (let i = 0; i < lb.length; i++) {
    const x = lb[i];
    if (!ia[x.id]) return 'New zone: ' + x.name + (x.secs.length ? ' (' + n(x.secs.length, '') + ')' : '');
  }
  for (let i = 0; i < la.length; i++) if (!ib[la[i].id]) return 'Zone deleted: ' + la[i].name;
  for (let i = 0; i < lb.length; i++) {
    const x = lb[i],
      y = ia[x.id];
    if (x.name !== y.name) return 'Zone renamed: ' + x.name;
  }
  // (the zone being edited first: a section it takes from another zone is "added" to it, not "taken out" of that one)
  const byCur = lb.slice().sort(function (p, q) {
    return (q.id === zb.cur) - (p.id === zb.cur);
  });
  for (let i = 0; i < byCur.length; i++) {
    const x = byCur[i],
      y = ia[x.id],
      had = {};
    y.secs.forEach(function (l) {
      had[l] = 1;
    });
    let add = 0,
      out = 0;
    x.secs.forEach(function (l) {
      if (!had[l]) add++;
      else delete had[l];
    });
    out = Object.keys(had).length;
    if (add && !out) return x.name + ': ' + n(add, ' added');
    if (out && !add) return x.name + ': ' + n(out, ' taken out');
    if (add || out) return x.name + ': sections changed';
  }
  return '';
}

// ---- saving and opening (60-persist, 97-open) ----
// does any zone (or the guide, without zones) use the Photo pattern? (a shared guide file keeps the photo only then)
function zoneUsesPhoto() {
  if (!zones.length) return family === 'photo';
  return zoneIds().some(function (id) {
    return zoneFamily(id) === 'photo';
  });
}
// the zones besides Main, as saved with the guide: name, sections, their settings (as STYLE_FIELDS saves them) and
// Blend's anchors; undefined without zones. With sections found afresh and not built yet (section edits kept when the
// page is hidden), the zones' sections are where Build guide will place them on the new ones (none if it can't).
function zoneSave() {
  if (!zones.length) return undefined;
  const at = _segFresh ? zonePlace(_zPix) : null;
  if (_segFresh && !at) return undefined;
  return zones.map(function (z) {
    const st = zoneWith(z.id, function () {
        return styleSave('style');
      }),
      style = {};
    ZONE_KEYS.forEach(function (k) {
      if (k in st) style[k] = st[k];
    });
    if ('blendVivid' in st) style.blendVivid = st.blendVivid;
    return {
      name: z.name,
      secs: Object.keys(at ? at[z.id] : z.secs)
        .map(Number)
        .sort(function (a, b) {
          return a - b;
        }),
      style: style,
      anchors: zoneRec(z.id).an,
      shade: zshCopy(z.sh || zshMain()),
    };
  });
}
// a zone's settings from a saved guide, each checked as a guide's are (STYLE_FIELDS), or its default
function zoneStOpen(src) {
  const keep = zLiveSt();
  STYLE_FIELDS.forEach(function (f) {
    if (f.in === 'style' && f.check && ZONE_KEYS.indexOf(f.key) >= 0)
      STYLE_VAR[f.key] = f.check(src[f.key], f.def, src);
  });
  const st = zLiveSt();
  zSetSt(keep);
  return st;
}
// saved anchors, checked (as 97-open checks Main's)
function zoneAnchorsOpen(a) {
  return Array.isArray(a)
    ? a
        .filter(function (x) {
          return (
            x &&
            typeof x.x === 'number' &&
            typeof x.y === 'number' &&
            isFinite(x.x) &&
            isFinite(x.y) &&
            typeof x.mkey === 'string'
          );
        })
        .slice(0, 64)
        .map(function (x) {
          return { x: Math.max(0, Math.min(W, x.x)), y: Math.max(0, Math.min(H, x.y)), mkey: x.mkey };
        })
    : [];
}
// a saved guide's zones (after its Main settings and anchors are live): map turns its section numbers into this
// picture's. Zones with no sections left, or more than ZONE_MAX, are dropped.
function zoneOpen(list, map) {
  zoneReset();
  zoneMain = { st: zLiveSt(), an: zAnchors(anchors) };
  if (!Array.isArray(list)) return;
  const taken = {};
  list.forEach(function (o) {
    if (zones.length >= ZONE_MAX || !o || typeof o !== 'object' || !Array.isArray(o.secs)) return;
    const secs = {};
    let n = 0;
    o.secs.forEach(function (ol) {
      // (only whole section numbers the map has: not "__proto__" or the like from a file made by hand)
      const nl = Number.isInteger(ol) && Object.prototype.hasOwnProperty.call(map, ol) ? map[ol] : 0;
      if (Number.isInteger(nl) && nl > 0 && !taken[nl]) {
        secs[nl] = 1;
        taken[nl] = 1;
        n++;
      }
    });
    if (!n) return;
    const name =
      typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 24) : 'Zone ' + (zones.length + 1);
    zones.push({
      id: zoneNext++,
      name: name,
      secs: secs,
      st: zoneStOpen(o.style && typeof o.style === 'object' ? o.style : {}),
      an: zoneAnchorsOpen(o.anchors),
      sh: zshOpen(o.shade),
    });
  });
  zoneDirty();
  // (none of them left: Main is the whole guide, shaded or not by the shading's Off and on alone)
  if (!zones.length) zoneNoneLeft();
}

// ---- section edits (Edit sections, then Build guide) ----
// Sections found again (segment(): a new sensitivity, or Enhance) are new shapes with new numbers: each new section
// joins the zone most of its pixels were in. Where the zones were is captured once, before the first re-detection
// since the guide was built (the zones' section numbers are that map's until Build guide places them again, however
// many re-detections come between), and kept until a build succeeds. After a turn, crop or straightening the pixels
// no longer line up, so the zones can't be placed again and are cleared (zoneAfterFresh says so).
let _zPix = null;
function zonePixCapture() {
  if (_segFresh || (_zPix && (_zPix.lost || _zPix.lab === labels))) return;
  _zPix = null;
  if (!zones.length || !labels || !W || !H || labels.length !== W * H) return;
  const ids = zoneIds(),
    ix = {},
    n = W * H,
    zp = new Uint8Array(n);
  ids.forEach(function (id, i) {
    ix[id] = i;
  });
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l > 0) zp[i] = ix[zoneOf(l)] || 0;
  }
  _zPix = { W: W, H: H, ids: ids, z: zp, lab: labels };
}
// the picture itself is about to change (turned, cropped, straightened: processSrc): the zones can't be placed on the
// sections found from it
function zoneGeoLost() {
  if (zones.length) _zPix = { lost: true };
}
// where the zones go on sections found afresh ({ zone id: { section: 1 } }, from capture p), without changing them;
// null when they can't be placed
function zonePlace(p) {
  if (!p || p.lost || p.W !== W || p.H !== H || !labels || !comps) return null;
  const Z = p.ids.length,
    K = comps.length,
    cnt = new Int32Array(K * Z),
    n = W * H,
    at = {};
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l > 0 && l < K) cnt[l * Z + p.z[i]]++;
  }
  zones.forEach(function (z) {
    at[z.id] = {};
  });
  for (let l = 1; l < K; l++) {
    let best = 0,
      bn = 0;
    for (let k = 0; k < Z; k++)
      if (cnt[l * Z + k] > bn) {
        bn = cnt[l * Z + k];
        best = k;
      }
    const id = p.ids[best];
    if (id && at[id]) at[id][l] = 1;
  }
  return at;
}
// after sections were found again: each joins the zone most of its pixels were in; false when they couldn't be placed
// (the zones are cleared then). The capture stays until the build succeeds (zoneBuilt), in case it doesn't.
function zoneAfterFresh() {
  if (!zones.length) return true;
  const at = zonePlace(_zPix);
  if (!at) {
    if (zoneCur) zoneSelect(0);
    zoneReset();
    zoneNoneLeft();
    return false;
  }
  zones.forEach(function (z) {
    z.secs = at[z.id] || {};
  });
  zoneDirty();
  return true;
}
// the guide was built: the zones' section numbers are the sections' own again
function zoneBuilt() {
  _zPix = null;
}
// ---- Undo in Edit sections (20-image-input keepSnap, 65-edit doUndo) ----
// the zones before the sections were found afresh or the picture changed: who's in which, each zone's settings (for
// zones cleared since) and where they were on the picture
function zoneKeep() {
  return { zs: zoneSnap(), live: zLiveSt(), an: zAnchors(anchors), pix: _zPix, main: shadeMain };
}
// the zones back as zoneKeep had them; zones still here keep their settings as they are now
function zoneUnkeep(k) {
  if (!k) return;
  _zPix = k.pix;
  if (!k.zs) {
    if (zones.length) {
      if (zoneCur) zoneSelect(0);
      zoneReset();
      zoneNoneLeft();
    }
    return;
  }
  zStash(zoneCur);
  const now = {};
  zones.forEach(function (z) {
    now[z.id] = z;
  });
  zones = k.zs.list.map(function (x) {
    const z = now[x.id],
      secs = {};
    x.secs.forEach(function (l) {
      secs[l] = 1;
    });
    if (z) return { id: z.id, name: z.name, secs: secs, st: z.st, an: z.an, sh: z.sh };
    // (the zone that was being edited then kept its settings in the live ones)
    const own = !x.st;
    return {
      id: x.id,
      name: x.name,
      secs: secs,
      st: zCopy(own ? k.live : x.st),
      an: zAnchors(own ? k.an : x.an),
      sh: zshCopy(x.sh || zshMain()),
    };
  });
  zoneNext = Math.max(zoneNext, k.zs.next || 1);
  // (Main's "Shade Main" goes with the zones: back as it was with them)
  if (typeof k.main === 'boolean') shadeMain = k.main;
  zoneDirty();
  if (zoneCur && !zoneById(zoneCur)) {
    zoneCur = 0;
    zLoad(0);
  }
}
// after section edits that keep the numbers (in or out, merge, split, add): sections merged away leave their zone; a
// section new to the guide (split off, or added) joins the zone most of the sections it touches are in (Main if none)
function zoneAfterEdit(cl, prev) {
  if (!zones.length) return;
  zones.forEach(function (z) {
    for (const k in z.secs) {
      const c = comps[+k];
      if (!c || c.merged) delete z.secs[k];
    }
  });
  zoneDirty();
  const known = {};
  // (in the guide before: with a marker, white, or a marker not found when it was opened; or left out for now)
  if (prev) {
    for (const l in prev.assign) known[l] = 1;
    for (const l in prev.paper || {}) known[l] = 1;
  }
  for (const l in _lostKeys) known[l] = 1;
  for (const l in _gone) known[l] = 1;
  const fresh = cl.filter(function (l) {
    return !known[l] && zoneOf(l) === 0;
  });
  if (!fresh.length) return;
  const a = adj || (adj = buildAdj()),
    moves = {};
  fresh.forEach(function (l) {
    // (a part split off a section: in that section's zone, whatever surrounds it, v299)
    const f = splitFrom(l);
    if (f >= 0) {
      if (zoneOf(f)) moves[l] = zoneOf(f);
      return;
    }
    const n = {};
    let best = 0,
      bn = 0;
    (a[l] || new Set()).forEach(function (o) {
      if (!known[o]) return;
      const id = zoneOf(o);
      n[id] = (n[id] || 0) + 1;
      if (n[id] > bn || (n[id] === bn && id === 0)) {
        bn = n[id];
        best = id;
      }
    });
    if (best) moves[l] = best;
  });
  for (const l in moves) zoneById(moves[l]).secs[l] = 1;
  zoneDirty();
}
