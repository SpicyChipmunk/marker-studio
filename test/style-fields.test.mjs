// A guide's style settings in the saved guide: the exact form currentDesignObj() writes them in (names, nesting,
// order), and the value each setting starts with. The browser tests (e2e/style-fields.test.mjs) cover opening,
// Undo and the rest; these pin the saved text itself, so any change to how the style is listed shows up here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// every setting, by the name of the variable that holds it (as __mstest.styleVars reads them)
const NAMES = ['family', 'palette', 'gradShape', 'dir', 'look', 'emphasis', 'limitN', 'noAdj', 'balance', 'balM', 'balS', 'balA', 'balSeed', 'noRep', 'gradSeed', 'blendFall', 'blendMix',
  'texAmt', 'radC', 'shadeMode', 'shadeSun', 'shadeRound', 'shadeLines', 'shadeHi', 'shadeLo', 'shadeLight', 'shadeMain', 'shadeShadow', 'shadeHilite', 'shadeFlat', 'photoXf',
  'photoOp', 'photoPaper', 'expand', 'expandChar', 'paletteSource', 'savedPalId', 'genHarmony', 'genPal', 'minPos', 'bgTrim',
  'addAutoClose'];
const plain = (v) => JSON.parse(JSON.stringify(v));

test('each style setting’s first value (a guide that changes nothing is saved with these)', () => {
  const sv = createApp().__mstest.styleVars;
  const got = {};
  for (const k of NAMES) got[k] = plain(sv[k]);
  assert.deepEqual(got, {
    family: 'gradient', palette: 'all', gradShape: 'serpentine', dir: 1, look: 'auto', emphasis: 'neutral', limitN: 16,
    noAdj: false, balance: 'main', balM: 'auto', balS: 'auto', balA: 'auto', balSeed: 0, noRep: false, gradSeed: 0, blendFall: 2, blendMix: 'soft', texAmt: 0.5, radC: null, shadeMode: 'off', shadeSun: { x: 0.2, y: 0.12 },
    shadeRound: 0.5, shadeLines: true, shadeHi: 0.5, shadeLo: 0.5, shadeLight: 'auto', shadeMain: true, shadeShadow: 'same', shadeHilite: 'same',
    shadeFlat: {}, photoXf: null,
    photoOp: 0.65, photoPaper: true, expand: false, expandChar: 0.5, paletteSource: 'owned', savedPalId: null,
    genHarmony: 'analogous', genPal: [], minPos: 30, bgTrim: 50, addAutoClose: false,
  });
});

// a small guide with every setting away from its default
function scene() {
  const app = createApp(), core = app.__mstest, sv = core.styleVars;
  const W = 4, H = 4;
  core.W = W; core.H = H; core.labels = new Int32Array(W * H).fill(1);
  for (let i = 8; i < 16; i++) core.labels[i] = 3;
  core.secState = new Uint8Array(4); core.colored = new Uint8Array(4);
  core.curName = 'Styled';
  core.assignData = { order: [1, 3], assign: { 1: { mkey: 'Ohuhu|R16' }, 3: { mkey: 'Ohuhu|B06' } }, N: 2 };
  Object.assign(sv, {
    family: 'blend', palette: 'cool', gradShape: 'diagonal', dir: -1, look: 'ltd', emphasis: 'pastel', limitN: 7, noAdj: true,
    balance: 'mixed', balM: 'blue', balS: 'auto', balA: 'orange', balSeed: 0.5, noRep: true,
    gradSeed: 0.25, blendFall: 3.4, blendMix: 'vivid', texAmt: 0.75, radC: { x: 0.3, y: 0.7 }, shadeMode: 'shadow', shadeSun: { x: 0.9, y: 0.05 },
    shadeRound: 0.35, shadeLines: false, shadeHi: 0.6, shadeLo: 0.15, shadeLight: 'sun', shadeShadow: 'grey', shadeHilite: 'paper',
    shadeFlat: { 3: 1, 1: 1 },
    photoOp: 0.4, photoPaper: false, expand: true, expandChar: 0.1, paletteSource: 'saved', savedPalId: 99,
    // (a palette marker kept as a catalogue index is saved as its key)
    genHarmony: 'tetradic', genPal: ['Ohuhu|R16', 0, 'Ohuhu|B06'], minPos: 12, bgTrim: 64, addAutoClose: true,
  });
  return { app, core };
}

test('the saved style: its exact text, nesting and order', () => {
  const { app, core } = scene();
  const k0 = app.__eval('mkey(0)');
  const d = core.currentDesignObj();
  assert.equal(
    JSON.stringify(d.payload.style),
    '{"family":"blend","palette":"cool","gradShape":"diagonal","dir":-1,"look":"ltd","emphasis":"pastel","limitN":7,' +
      '"noAdj":true,"balance":"mixed","balM":"blue","balS":"auto","balA":"orange","balSeed":0.5,"noRep":true,' +
      '"gradSeed":0.25,"blendFall":3.4,"blendVivid":true,"blendMix":"vivid","texAmt":0.75,"radC":{"x":0.3,"y":0.7},' +
      '"shade":{"mode":"shadow","x":0.9,"y":0.05,"round":0.35,"lines":false,"hi":0.6,"lo":0.15,"lightSrc":"sun","light":"sun","main":true,"shadow":"grey","hilite":"paper","flat":[1,3]},' +
      '"photo":null,"expand":true,"expandChar":0.1,"paletteSource":"saved","savedPalId":99,"genHarmony":"tetradic",' +
      '"genPal":["Ohuhu|R16","' + k0 + '","Ohuhu|B06"]}',
  );
  // the section settings are saved beside the style, in this place among the rest
  assert.deepEqual(Object.keys(d.payload), ['lmap', 'ref', 'paper', 'assign', 'style', 'anchors', 'prog', 'tones', 'out',
    'edits', 'base', 'locks', 'minPos', 'minSize', 'bgTrim', 'addAutoClose', 'secStates']);
  // (the smallest section: minSize on the slider's scale since v277, minPos on the old one for older copies)
  assert.deepEqual([d.payload.minSize, d.payload.minPos, d.payload.bgTrim, d.payload.addAutoClose], [12, 3, 64, true]);
  // a guide file to share has the same style
  assert.equal(JSON.stringify(core.currentDesignObj(true).payload.style), JSON.stringify(d.payload.style));
});

test('the saved style with a photo: its placement, see-through, white areas and lighting correction', () => {
  const { core } = scene();
  core.photoXf = { cx: 1, cy: 2, sx: 0.5, sy: 0.75, r: 0.1 };
  // (no photo loaded: nothing is saved for it)
  assert.equal(core.currentDesignObj().payload.style.photo, null);
  // a photo in place (the rest of setPhotoRef, lining it up and recolouring, needs a page and stops here; the photo
  // is set first)
  try {
    core.setPhotoRef({ w: 4, h: 4, data: new Uint8ClampedArray(64), url: 'data:image/jpeg;base64,AAAA' }, true);
  } catch (_) {}
  core.photoXf = { cx: 1, cy: 2, sx: 0.5, sy: 0.75, r: 0.1 };
  core.styleVars.family = 'gradient';
  core.styleVars.photoOp = 0.4;
  core.styleVars.photoPaper = false;
  const d = core.currentDesignObj();
  // (a black 4 x 4 photo is no page: no lighting correction found, light: false)
  assert.equal(JSON.stringify(d.payload.style.photo), '{"xf":{"cx":1,"cy":2,"sx":0.5,"sy":0.75,"r":0.1},"op":0.4,"paper":false,"light":false}');
  assert.equal(d.payload.ref, 'data:image/jpeg;base64,AAAA');
  // a guide file to share leaves the photo out unless the pattern uses it, but keeps its settings
  const s = core.currentDesignObj(true);
  assert.equal(s.payload.ref, undefined);
  assert.equal(JSON.stringify(s.payload.style), JSON.stringify(d.payload.style));
  core.styleVars.family = 'photo';
  assert.equal(core.currentDesignObj(true).payload.ref, 'data:image/jpeg;base64,AAAA');
});

// ---- the list itself (STYLE_FIELDS, js/guide/05-style-fields.js) ----

test('STYLE_FIELDS: every default is its variable’s first value, and what a file that says nothing opens with', () => {
  const core = createApp().__mstest, sv = core.styleVars;
  const VAR = { mode: 'shadeMode', round: 'shadeRound', lines: 'shadeLines', hi: 'shadeHi', lo: 'shadeLo', lightSrc: 'shadeLight', main: 'shadeMain',
    shadow: 'shadeShadow', hilite: 'shadeHilite', minSize: 'minPos' };
  let n = 0;
  for (const f of core.styleFields) {
    if (!('def' in f)) continue;
    const first = f.key === 'x' ? sv.shadeSun.x : f.key === 'y' ? sv.shadeSun.y : sv[VAR[f.key] || f.key];
    assert.deepEqual(plain(f.def), plain(first), f.key);
    assert.deepEqual(plain(f.check(undefined, f.def)), plain(f.def), f.key + ' (missing)');
    n++;
  }
  assert.equal(n, 39);
});

test('STYLE_FIELDS: where each setting is saved (in the order written) and which ones Undo keeps', () => {
  const core = createApp().__mstest;
  assert.deepEqual([...core.styleFields].map((f) => f.in + '.' + f.key + (f.undo ? '' : ' (no undo)')), [
    'style.family', 'style.palette', 'style.gradShape', 'style.dir', 'style.look', 'style.emphasis', 'style.limitN',
    'style.noAdj', 'style.balance', 'style.balM', 'style.balS', 'style.balA', 'style.balSeed', 'style.noRep', 'style.gradSeed', 'style.blendFall', 'style.blendVivid (no undo)', 'style.blendMix', 'style.texAmt', 'style.radC',
    'shade.mode', 'shade.x', 'shade.y', 'shade.round', 'shade.lines', 'shade.hi', 'shade.lo', 'shade.lightSrc', 'shade.light (no undo)', 'shade.main', 'shade.shadow',
    'shade.hilite', 'shade.flat',
    'style.photo (no undo)', 'style.expand', 'style.expandChar', 'style.paletteSource', 'style.savedPalId',
    'style.genHarmony', 'style.genPal', 'payload.minPos (no undo)', 'payload.minSize (no undo)', 'payload.bgTrim (no undo)',
    'payload.addAutoClose (no undo)',
  ]);
});

test('STYLE_FIELDS: Mood takes all six (an old guide’s vivid and muted are Bright and Soft), Look its three', () => {
  const core = createApp().__mstest, f = (k) => [...core.styleFields].find((x) => x.key === k);
  const em = f('emphasis'), lk = f('look');
  for (const v of ['neutral', 'vivid', 'muted', 'pastel', 'deep', 'earthy']) assert.equal(em.check(v, em.def), v);
  assert.equal(em.check('loud', em.def), 'neutral');
  assert.equal(em.check(undefined, em.def), 'neutral');
  for (const v of ['auto', 'smooth', 'ltd']) assert.equal(lk.check(v, lk.def), v);
  assert.equal(lk.check('fancy', lk.def), 'auto');
  assert.equal(lk.check(undefined, lk.def), 'auto');
});

test('Blend’s Mix: its three; a guide saved before it (only blendVivid) opens as Vivid if that was ticked; blendVivid is still written, for older copies of the app', () => {
  const core = createApp().__mstest, sv = core.styleVars, f = [...core.styleFields].find((x) => x.key === 'blendMix');
  for (const v of ['soft', 'vivid', 'paint']) assert.equal(f.check(v, f.def, { blendMix: v }), v);
  // an older guide: no blendMix, the tick box as it was
  assert.equal(f.check(undefined, f.def, { blendVivid: true }), 'vivid');
  assert.equal(f.check(undefined, f.def, { blendVivid: false }), 'soft');
  assert.equal(f.check(undefined, f.def, {}), 'soft');
  // anything but true (a hand-edited file) is not ticked; a Mix that is saved wins over the old tick box
  assert.equal(f.check(undefined, f.def, { blendVivid: 1 }), 'soft');
  assert.equal(f.check('paint', f.def, { blendVivid: true }), 'paint');
  assert.equal(f.check('loud', f.def, { blendVivid: false }), 'soft');
  assert.equal(f.check('loud', f.def, { blendVivid: true }), 'vivid');
  // what is written: blendVivid true only for Vivid (Like paint opens as Soft in an older copy)
  const saved = (mix) => {
    sv.blendMix = mix;
    return core.styleFields.find((x) => x.key === 'blendVivid').save();
  };
  assert.deepEqual(['soft', 'vivid', 'paint'].map(saved), [false, true, false]);
});

test('the smallest section (v277): 2 to 400 px evenly by ratio, 10 px to begin with; a guide saved before keeps its size', () => {
  const core = createApp().__mstest;
  assert.deepEqual([core.minPx(0), core.minPx(core.MIN_DEF), core.minPx(100)], [2, 10, 400]);
  const f = (k) => [...core.styleFields].find((x) => x.key === k);
  // a guide from before v277 says only minPos, on the old scale (2 + t² × 1998 px): 26 was 137 px, now about 80
  assert.equal(f('minSize').check(undefined, 30, { minPos: 26 }), 80);
  assert.ok(Math.abs(core.minPx(80) - 137) <= 3);
  assert.equal(f('minSize').check(undefined, 30, { minPos: 0 }), 0);
  assert.equal(f('minSize').check(undefined, 30, {}), 30, 'nothing saved: the new first place');
  // minSize wins when both are there; out of range is kept in range
  assert.equal(f('minSize').check(45, 30, { minPos: 26 }), 45);
  assert.equal(f('minSize').check(140, 30, {}), 100);
  // and what older copies read back: the same size on their scale
  assert.equal(core.minPosOld(80), 26);
});

test('Light from (v281): auto, the sun or the photo; a guide saved before has only light, whose photo was its default (auto), and light is still written for older copies of the app', () => {
  const core = createApp().__mstest, f = (k) => [...core.styleFields].find((x) => x.key === k);
  const ls = f('lightSrc');
  for (const v of ['auto', 'sun', 'photo']) assert.equal(ls.check(v, ls.def, { light: 'sun' }), v);
  assert.equal(ls.check(undefined, ls.def, { light: 'photo' }), 'auto', 'the old default: the photo only with the Photo pattern');
  assert.equal(ls.check(undefined, ls.def, { light: 'sun' }), 'sun');
  assert.equal(ls.check(undefined, ls.def, {}), 'auto');
  assert.equal(ls.check('moon', ls.def, {}), 'auto');
  // (older copies are told the sun only when it's chosen; else their own default, the photo with the Photo pattern)
  assert.equal(f('light').save(), 'photo');
  core.styleVars.shadeLight = 'sun';
  assert.equal(f('light').save(), 'sun');
  core.styleVars.shadeLight = 'photo';
  assert.equal(f('light').save(), 'photo');
  assert.equal(f('light').check, undefined, 'only written');
});
