/* ---- a guide's style: one list of its settings ----
    STYLE_FIELDS lists every setting that makes up a guide's look (its "style") and the three section
    settings saved beside it, in the order payload.style is written. Saving a guide (currentDesignObj,
    60-persist), opening one (styleFrom and openDesignObj, 97-open), resetting the shading (shadeReset,
    45-shading) and each step of Undo (planSnap and planRestore, 87-undo) go through this list. A new
    setting is added here, in STYLE_VAR below, as a variable in 00-state, and in __mstest.styleVars
    (99-close), which the tests keep separate on purpose so they don't measure the code with itself.

    Each entry:
      key    its name where it is saved, and in an Undo step
      in     where it is saved: 'style' (payload.style[key]), 'shade' (payload.style.shade[key]) or
             'payload' (payload[key]: the Sections screen's settings, which aren't part of the plan's Undo)
      def    what a guide opens with when its file doesn't say, or says something that can't be used
      check  a value from a saved guide, checked and kept in range (or def): used as the guide opens;
             check(value, def, src), src being the whole object it was saved in (for a setting that replaced
             an older one, which it reads when it wasn't saved itself: blendMix)
      undo   kept in each Undo step
      save / snap / restore   for a setting not saved (or kept for Undo) as its variable's plain value
    The flat sections and the photo have no check: openDesignObj opens them itself, as the flat sections
    are numbered by the guide's own section map and the photo comes with its picture. The photo is kept
    for Undo in its own way (planSnap), beside the picture. blendVivid has no check or variable either:
    it is only written, for older copies of the app (blendMix is what is read).

    Nothing here is reset for a new picture or the sample but Scatter: a new picture keeps the style it had
    (resetForNewPicture clears only the flat sections, which belong to the old sections, and puts Scatter back to
    Polished with no rough spots smoothed: gradScat, gradJit, gradFix, v306). A guide that
    opens takes every setting from its file. The variables' first values (00-state, 45-shading) are the
    same as def, which the unit tests check. */

// a number, kept between lo and hi (anything that isn't a finite number gets the default)
function styleNum(lo, hi) {
  return function (v, d) {
    return typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  };
}
// a whole number, kept between lo and hi
function styleWhole(lo, hi) {
  const num = styleNum(lo, hi);
  return function (v, d) {
    return Math.round(num(v, d));
  };
}
// any finite number (a saved palette's id)
function styleFinite(v, d) {
  return typeof v === 'number' && isFinite(v) ? v : d;
}
// one of these choices
function styleOne(list) {
  return function (v, d) {
    return list.indexOf(v) >= 0 ? v : d;
  };
}
// true or false
function styleBool(v, d) {
  return typeof v === 'boolean' ? v : d;
}
// a harmony by name: any name HARM has, as before, including Custom and From photo, which Generate palette
// doesn't offer (generatePalette falls back to Analogous for those), and even a name HARM only inherits
// ("constructor"): kept as it was, since changing it would change how old files open
function styleHarmony(v, d) {
  return typeof v === 'string' && typeof HARM !== 'undefined' && HARM[v] ? v : d;
}
function shadeFlatList() {
  return Object.keys(shadeFlat).map(Number);
}
// Balance's colour families (their names and hues: BAL_FAM, 31-balance), or Auto
const BAL_CHOICES = [
  'auto',
  'pink',
  'red',
  'orange',
  'yellow',
  'ygreen',
  'green',
  'teal',
  'blue',
  'violet',
  'brown',
  'grey',
];
const STYLE_FIELDS = [
  {
    key: 'family',
    in: 'style',
    def: 'gradient',
    check: styleOne(['gradient', 'random', 'blend', 'manual', 'photo']),
    undo: true,
    // (Photo with its photo not picked yet is saved as the pattern still laid: photoWait, 46-photo)
    save: famSaved,
    snap: famSaved,
  },
  { key: 'palette', in: 'style', def: 'all', check: styleOne(['all', 'cool', 'warm']), undo: true },
  {
    key: 'gradShape',
    in: 'style',
    def: 'serpentine',
    check: styleOne(['serpentine', 'vertical', 'diagonal', 'radial', 'around']),
    undo: true,
  },
  { key: 'dir', in: 'style', def: 1, check: styleOne([1, -1]), undo: true },
  // the Gradient's Look (a guide saved before it had one opens as Auto)
  { key: 'look', in: 'style', def: 'auto', check: styleOne(['auto', 'smooth', 'ltd']), undo: true },
  // the Mood, by its key in MOODS (the first three were Intensity's Any, Vivid and Soft)
  { key: 'emphasis', in: 'style', def: 'neutral', check: styleOne(MOOD_KEYS), undo: true },
  { key: 'limitN', in: 'style', def: 16, check: styleWhole(2, 999), undo: true },
  { key: 'noAdj', in: 'style', def: false, check: styleBool, undo: true },
  // Random's Balance (v283): a guide saved before it that uses Random opens as Mixed, as it looked; any other opens on
  // Main colour, what Random starts with when chosen now
  {
    key: 'balance',
    in: 'style',
    def: 'main',
    check: function (v, d, src) {
      return v === 'main' || v === 'mixed' ? v : src && src.family === 'random' ? 'mixed' : d;
    },
    undo: true,
  },
  { key: 'balM', in: 'style', def: 'auto', check: styleOne(BAL_CHOICES), undo: true },
  { key: 'balS', in: 'style', def: 'auto', check: styleOne(BAL_CHOICES), undo: true },
  { key: 'balA', in: 'style', def: 'auto', check: styleOne(BAL_CHOICES), undo: true },
  { key: 'balSeed', in: 'style', def: 0, check: styleNum(0, 1), undo: true },
  { key: 'noRep', in: 'style', def: false, check: styleBool, undo: true },
  { key: 'gradSeed', in: 'style', def: 0, check: styleNum(0, 1), undo: true },
  // the Gradient's Scatter (v306): a guide saved before it re-lays as Polished (what it was laid with since v305).
  // Written only when it's used (gradJit only from Textured up, gradFix only when on), so a guide that doesn't use them
  // saves exactly as before.
  {
    key: 'gradScat',
    in: 'style',
    def: 0,
    check: styleWhole(0, 4),
    undo: true,
    save: function () {
      return gradScat ? gradScat : undefined;
    },
  },
  {
    key: 'gradJit',
    in: 'style',
    def: 0,
    check: styleNum(0, 1),
    undo: true,
    save: function () {
      return gradScat >= 2 ? gradJit : undefined;
    },
  },
  {
    key: 'gradFix',
    in: 'style',
    def: false,
    check: styleBool,
    undo: true,
    save: function () {
      return gradFix ? true : undefined;
    },
  },
  { key: 'blendFall', in: 'style', def: 2, check: styleNum(0.6, 4), undo: true },
  // Blend's Mix. Before it there was only a "Keep colours vivid" tick box, saved as blendVivid: a guide saved then
  // (no blendMix) opens with Vivid if it was ticked. blendVivid is still written (true for Vivid) so an older copy of
  // the app opens a guide saved now as near to it as it can (Like paint shows there as Soft); it isn't read when
  // blendMix is there, and Undo keeps blendMix.
  {
    key: 'blendVivid',
    in: 'style',
    undo: false,
    save: function () {
      return blendMix === 'vivid';
    },
  },
  {
    key: 'blendMix',
    in: 'style',
    def: 'soft',
    check: function (v, d, src) {
      return BLEND_MIXES.indexOf(v) >= 0 ? v : src && src.blendVivid === true ? 'vivid' : d;
    },
    undo: true,
  },
  { key: 'texAmt', in: 'style', def: 0.5, check: styleNum(0, 1), undo: true },
  // Radial's centre, where you put it (v282; null: the middle)
  {
    key: 'radC',
    in: 'style',
    def: null,
    check: function (v) {
      return v && typeof v.x === 'number' && typeof v.y === 'number' && isFinite(v.x) && isFinite(v.y)
        ? { x: Math.max(0, Math.min(1, v.x)), y: Math.max(0, Math.min(1, v.y)) }
        : null;
    },
    undo: true,
  },
  // shading (x and y are where the sun is)
  { key: 'mode', in: 'shade', def: 'off', check: styleOne(['off', 'shadow', 'full']), undo: true },
  { key: 'x', in: 'shade', def: 0.2, check: styleNum(0, 1), undo: true },
  { key: 'y', in: 'shade', def: 0.12, check: styleNum(0, 1), undo: true },
  { key: 'round', in: 'shade', def: 0.5, check: styleNum(0, 1), undo: true },
  { key: 'lines', in: 'shade', def: true, check: styleBool, undo: true },
  { key: 'hi', in: 'shade', def: 0.5, check: styleNum(0, 1), undo: true },
  { key: 'lo', in: 'shade', def: 0.5, check: styleNum(0, 1), undo: true },
  // where the light comes from, for the whole picture (v281): 'auto' (the photo when Main uses the Photo pattern, else
  // the sun) until Light from is tapped. A guide saved before v281 has only `light`, whose 'photo' was its default
  // and only ever meant "when the Photo pattern is chosen": read as auto ('sun' as the sun).
  {
    key: 'lightSrc',
    in: 'shade',
    def: 'auto',
    check: function (v, d, src) {
      if (v === 'auto' || v === 'sun' || v === 'photo') return v;
      return src && src.light === 'sun' ? 'sun' : d;
    },
    undo: true,
  },
  // for older copies of the app, which read only this ('photo': the photo when the Photo pattern is chosen, their
  // default): the sun when it's chosen, else the photo
  {
    key: 'light',
    in: 'shade',
    undo: false,
    save: function () {
      return shadeLight === 'sun' ? 'sun' : 'photo';
    },
  },
  // with zones, whether Main is shaded ("Shade Main"; each other zone has its own, in payload.zones)
  { key: 'main', in: 'shade', def: true, check: styleBool, undo: true },
  // what kind of shadow and highlight: the same colour, a cooler or grey shadow, a warmer highlight or the paper
  { key: 'shadow', in: 'shade', def: 'same', check: styleOne(['same', 'cool', 'grey']), undo: true },
  { key: 'hilite', in: 'shade', def: 'same', check: styleOne(['same', 'warm', 'paper']), undo: true },
  // sections left flat, by section number
  {
    key: 'flat',
    in: 'shade',
    undo: true,
    save: shadeFlatList,
    snap: shadeFlatList,
    restore: function (v) {
      shadeFlat = {};
      v.forEach(function (l) {
        shadeFlat[l] = 1;
      });
      _flatVer++;
    },
  },
  // the Photo pattern's placement, see-through, white areas and lighting correction (46-photo: photoLitSave; while
  // a reopened guide's photo is still decoding, as they were saved)
  {
    key: 'photo',
    in: 'style',
    undo: false,
    save: function () {
      // (v304: greys, Use grey markers for the grey parts; refit, still to be placed again after the picture was
      // straightened, which a reopened guide does when the Photo pattern is next laid: 46-photo)
      // (only when on, so a guide without them saves exactly as before)
      const o =
        photoRef && photoXf
          ? {
              xf: photoXf,
              op: photoOp,
              paper: photoPaper,
              light: photoLitSave(photoRef),
              g: photoGreys,
              r: _phRefit,
            }
          : _phPend
            ? {
                xf: _phPend.xf,
                op: _phPend.op,
                paper: _phPend.paper,
                light: _phPend.light,
                g: _phPend.greys,
                r: _phPend.refit,
              }
            : null;
      if (!o) return null;
      if (o.g) o.greys = true;
      if (o.r) o.refit = true;
      delete o.g;
      delete o.r;
      return o;
    },
  },
  { key: 'expand', in: 'style', def: false, check: styleBool, undo: true },
  { key: 'expandChar', in: 'style', def: 0.5, check: styleNum(0, 1), undo: true },
  {
    key: 'paletteSource',
    in: 'style',
    def: 'owned',
    check: styleOne(['owned', 'saved', 'generate']),
    undo: true,
  },
  { key: 'savedPalId', in: 'style', def: null, check: styleFinite, undo: true },
  { key: 'genHarmony', in: 'style', def: 'analogous', check: styleHarmony, undo: true },
  // the generated palette: saved as marker keys (a catalogue index from an older guide is read as its
  // key), at most 64 read; always a new array, never def itself
  {
    key: 'genPal',
    in: 'style',
    def: [],
    check: function (v) {
      return Array.isArray(v) ? genPalKeys(v.slice(0, 64)) : [];
    },
    undo: true,
    save: function () {
      return genPalKeys(genPal);
    },
    snap: function () {
      return genPal.slice();
    },
    restore: function (v) {
      genPal = v.slice();
    },
  },
  // the Sections screen's settings: smallest section, background trim, Add's autoclose. The smallest section's
  // slider changed scale in v277 (minPx, 30-palette-assign): it's saved as minSize, and as minPos on the old scale
  // for older copies of the app, which read only that; a guide saved before v277 has only minPos, read on its old
  // scale, so it keeps the same smallest section.
  {
    key: 'minPos',
    in: 'payload',
    undo: false,
    save: function () {
      return minPosOld(minPos);
    },
  },
  {
    key: 'minSize',
    in: 'payload',
    def: MIN_DEF,
    check: function (v, d, src) {
      if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.min(100, v));
      const o = src && src.minPos;
      return typeof o === 'number' && isFinite(o) ? minPosFromOld(Math.max(0, Math.min(100, o))) : d;
    },
    undo: false,
  },
  { key: 'bgTrim', in: 'payload', def: 50, check: styleNum(0, 100), undo: false },
  { key: 'addAutoClose', in: 'payload', def: false, check: styleBool, undo: false },
];
// each setting's variable, by its key (x and y are the sun's; setting one keeps the other)
const STYLE_VAR = {
  get family() {
    return family;
  },
  set family(v) {
    family = v;
  },
  get palette() {
    return palette;
  },
  set palette(v) {
    palette = v;
  },
  get gradShape() {
    return gradShape;
  },
  set gradShape(v) {
    gradShape = v;
  },
  get dir() {
    return dir;
  },
  set dir(v) {
    dir = v;
  },
  get look() {
    return look;
  },
  set look(v) {
    look = v;
  },
  get emphasis() {
    return emphasis;
  },
  set emphasis(v) {
    emphasis = v;
  },
  get limitN() {
    return limitN;
  },
  set limitN(v) {
    limitN = v;
  },
  get noAdj() {
    return noAdj;
  },
  set noAdj(v) {
    noAdj = v;
  },
  get balance() {
    return balance;
  },
  set balance(v) {
    balance = v;
  },
  get balM() {
    return balM;
  },
  set balM(v) {
    balM = v;
  },
  get balS() {
    return balS;
  },
  set balS(v) {
    balS = v;
  },
  get balA() {
    return balA;
  },
  set balA(v) {
    balA = v;
  },
  get balSeed() {
    return balSeed;
  },
  set balSeed(v) {
    balSeed = v;
  },
  get noRep() {
    return noRep;
  },
  set noRep(v) {
    noRep = v;
  },
  get gradSeed() {
    return gradSeed;
  },
  set gradSeed(v) {
    gradSeed = v;
  },
  get gradScat() {
    return gradScat;
  },
  set gradScat(v) {
    gradScat = v;
  },
  get gradJit() {
    return gradJit;
  },
  set gradJit(v) {
    gradJit = v;
  },
  get gradFix() {
    return gradFix;
  },
  set gradFix(v) {
    gradFix = v;
  },
  get blendFall() {
    return blendFall;
  },
  set blendFall(v) {
    blendFall = v;
  },
  get blendMix() {
    return blendMix;
  },
  set blendMix(v) {
    blendMix = v;
  },
  get radC() {
    return radC;
  },
  set radC(v) {
    radC = v ? { x: v.x, y: v.y } : null;
  },
  get texAmt() {
    return texAmt;
  },
  set texAmt(v) {
    texAmt = v;
  },
  get mode() {
    return shadeMode;
  },
  set mode(v) {
    shadeMode = v;
  },
  get x() {
    return shadeSun.x;
  },
  set x(v) {
    shadeSun = { x: v, y: shadeSun.y };
  },
  get y() {
    return shadeSun.y;
  },
  set y(v) {
    shadeSun = { x: shadeSun.x, y: v };
  },
  get round() {
    return shadeRound;
  },
  set round(v) {
    shadeRound = v;
  },
  get lines() {
    return shadeLines;
  },
  set lines(v) {
    shadeLines = v;
  },
  get shadow() {
    return shadeShadow;
  },
  set shadow(v) {
    shadeShadow = v;
  },
  get hilite() {
    return shadeHilite;
  },
  set hilite(v) {
    shadeHilite = v;
  },
  get hi() {
    return shadeHi;
  },
  set hi(v) {
    shadeHi = v;
  },
  get lo() {
    return shadeLo;
  },
  set lo(v) {
    shadeLo = v;
  },
  get lightSrc() {
    return shadeLight;
  },
  set lightSrc(v) {
    shadeLight = v;
  },
  get main() {
    return shadeMain;
  },
  set main(v) {
    shadeMain = v;
  },
  get expand() {
    return expand;
  },
  set expand(v) {
    expand = v;
  },
  get expandChar() {
    return expandChar;
  },
  set expandChar(v) {
    expandChar = v;
  },
  get paletteSource() {
    return paletteSource;
  },
  set paletteSource(v) {
    paletteSource = v;
  },
  get savedPalId() {
    return savedPalId;
  },
  set savedPalId(v) {
    savedPalId = v;
  },
  get genHarmony() {
    return genHarmony;
  },
  set genHarmony(v) {
    genHarmony = v;
  },
  get genPal() {
    return genPal;
  },
  set genPal(v) {
    genPal = v;
  },
  get minSize() {
    return minPos;
  },
  set minSize(v) {
    minPos = v;
  },
  get bgTrim() {
    return bgTrim;
  },
  set bgTrim(v) {
    bgTrim = v;
  },
  get addAutoClose() {
    return addAutoClose;
  },
  set addAutoClose(v) {
    addAutoClose = v;
  },
};
// what is saved in `where`: 'style' gives payload.style (with its shade), 'payload' the section settings
function styleSave(where) {
  const out = {};
  STYLE_FIELDS.forEach(function (f) {
    if ((f.in === 'payload') !== (where === 'payload')) return;
    const o = f.in === 'shade' ? out.shade || (out.shade = {}) : out,
      v = f.save ? f.save() : STYLE_VAR[f.key];
    // (a setting written only when it's used says nothing otherwise: Scatter's, v306)
    if (v !== undefined) o[f.key] = v;
  });
  return out;
}
// a saved guide's settings in `where` ('style', 'shade' or 'payload'), from src, the object saved there:
// each one checked and kept in range, or its default (so an empty src puts them all back to their
// defaults). Only settings with a check: the flat sections and the photo are opened by openDesignObj.
// Setting them has no other effect, so their order doesn't matter.
function styleOpen(src, where) {
  STYLE_FIELDS.forEach(function (f) {
    if (f.in === where && f.check) STYLE_VAR[f.key] = f.check(src[f.key], f.def, src);
  });
}
// the settings an Undo step keeps, added to its snapshot s (the shading's in s.shade); styleRestore puts
// them back
function famSaved() {
  const pw = family === 'photo' && !photoRef ? photoWait[pwKey()] : null;
  return pw || family;
}
function styleSnap(s) {
  STYLE_FIELDS.forEach(function (f) {
    if (!f.undo) return;
    const o = f.in === 'shade' ? s.shade || (s.shade = {}) : s;
    o[f.key] = f.snap ? f.snap() : STYLE_VAR[f.key];
  });
  return s;
}
function styleRestore(s) {
  STYLE_FIELDS.forEach(function (f) {
    if (!f.undo) return;
    const v = (f.in === 'shade' ? s.shade : s)[f.key];
    if (f.restore) f.restore(v);
    else STYLE_VAR[f.key] = v;
  });
}
