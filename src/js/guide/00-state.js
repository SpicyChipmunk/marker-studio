/* Guide module (window.SF). The files in js/guide/ are concatenated in order into one function
   scope, so they share its variables; they are not standalone modules. The function's opening and
   closing lines live in src/index.template.html, around the js/guide includes.

   The guide's shared state is declared here, one variable per line, grouped by what it is for. Each
   variable says which files assign it ("written by", file names without .js), found by resolving every
   assignment in the guide closure to its variable, so a same-named local or an object property
   (o.x = ...) doesn't count. Changes made in place (a push, a property set) aren't listed. "99-close
   (test)" is the __mstest seam, used only by the tests. The style settings are also set by opening a
   guide (97-open) and by Undo (87-undo), through STYLE_VAR's setters, so those show as 05-style-fields. Other state lives with the code that owns it
   (shading in 45-shading, the photo in 46-photo, Undo in 87-undo, saving in 60-persist...). */

// ---- the module's links to the rest of the app ----
let coll = []; // written by: 97-open (setCollection), 99-close (test): the markers the guide may use
let api = {}; // written by: 97-open (configure): the shell's callbacks
const root = document.getElementById('sfRoot');

// ---- fixed values ----
const LINE = [38, 48, 46];
const TEAL = [15, 90, 91];
const MAG = [230, 59, 201];
const HILITE = [255, 224, 84];
const PAPER = [247, 244, 238];
const MAXSIDE = 2400;
const LFONT = '"Hanken Grotesk",system-ui,-apple-system,sans-serif';

// ---- loading a picture ----
let loadGen = 0; // written by: 20-image-input, 97-open
let srcImg = null; // written by: 20-image-input, 22-straighten, 65-edit, 97-open
let enhance = true; // written by: 20-image-input, 50-controls, 99-close (test)
let adaptC = 9; // written by: 20-image-input, 50-controls
let reTimer = null; // written by: 20-image-input, 50-controls
let guideSig = null; // written by: 20-image-input, 30-palette-assign, 65-edit, 97-open
let hasEdits = false; // written by: 20-image-input, 22-straighten, 65-edit, 80-input

// ---- straightening a photo of a page ----
let pgOrig = null; // written by: 20-image-input, 22-straighten, 97-open
let pgQ = null; // written by: 22-straighten, 65-edit
let pgF35 = 0; // written by: 22-straighten
let pgShape = null; // written by: 22-straighten, 65-edit
let pgMode = false; // written by: 22-straighten
let pgEd = null; // written by: 22-straighten

// ---- rotating and cropping ----
let rot90 = 0; // written by: 20-image-input, 22-straighten, 50-controls, 65-edit
let tilt = 0; // written by: 20-image-input, 22-straighten, 50-controls, 65-edit
let cropRect = null; // written by: 20-image-input, 22-straighten, 50-controls, 65-edit
let cropMode = false; // written by: 20-image-input
let cropStart = null; // written by: 20-image-input, 80-input
let cropPx = null; // written by: 20-image-input, 50-controls, 80-input
let cropFull = null; // written by: 20-image-input
let cropFullW = 0; // written by: 20-image-input
let cropFullH = 0; // written by: 20-image-input
let cropDrag = null; // written by: 20-image-input, 80-input
let cropAnchor = null; // written by: 20-image-input, 80-input

// ---- the picture and its sections (replaced when the sections are built or a guide opens) ----
let W; // written by: 20-image-input, 65-edit, 97-open, 99-close (test)
let H; // written by: 20-image-input, 65-edit, 97-open, 99-close (test)
let gray; // written by: 20-image-input, 65-edit, 97-open, 99-close (test)
let labels; // written by: 10-segment, 22-straighten, 65-edit, 97-open, 99-close (test)
let comps; // written by: 10-segment, 65-edit, 97-open, 99-close (test)
let secState; // written by: 10-segment, 65-edit, 97-open, 99-close (test)
// written by: 10-segment, 30-palette-assign, 45-shading, 82-colour-mode, 97-open, 99-close (test)
let colored;
let secColor; // written by: 10-segment, 65-edit, 97-open, 99-close (test)
let rgbOut; // written by: 10-segment, 65-edit, 97-open
let imgData; // written by: 10-segment, 65-edit, 97-open
let adj = null; // written by: 10-segment, 30-palette-assign, 65-edit, 97-open
let edgeDist = null; // written by: 10-segment, 40-render, 65-edit, 97-open
let texField = null; // written by: 10-segment, 40-render, 65-edit, 97-open
let labelPts = null; // written by: 10-segment, 40-render, 65-edit, 97-open, 99-close (test)
let bgMaxB = 0; // written by: 10-segment, 65-edit
let segWarn = null; // written by: 10-segment, 20-image-input, 99-close (test)
let _segFresh = false; // written by: 10-segment, 20-image-input, 30-palette-assign, 65-edit

// ---- editing the sections ----
let editMode = 'toggle'; // written by: 20-image-input, 22-straighten, 65-edit
let mergeSel = -1; // written by: 20-image-input, 65-edit, 80-input
let drawing = false; // written by: 80-input
let strokePts = []; // written by: 80-input
let drawStartL = -1; // written by: 80-input
// (these three are saved with the guide and listed in STYLE_FIELDS, which sets them when a guide opens)
let addAutoClose = false; // written by: 05-style-fields, 50-controls, 99-close (test)
// the smallest section's slider: its first place and the sizes its ends stand for (minPx, 30-palette-assign)
const MIN_DEF = 30,
  MIN_LO = 2,
  MIN_HI = 400;
let minPos = MIN_DEF; // (the slider's place, 0-100; minPx gives the size) written by: 05-style-fields, 50-controls, 99-close (test)
let bgTrim = 50; // written by: 05-style-fields, 50-controls, 99-close (test)
let undoStack = []; // never reassigned (65-edit pushes, pops and empties it)
let undoBytes = 0; // written by: 65-edit
const MAXUNDO = 25;
const UNDOBUDGET = 64 * 1048576;

// ---- the guide's elements on the page (found once, when it is mounted) ----
let cv; // written by: 95-mount
let ctx; // written by: 95-mount
let minEl; // written by: 50-controls
let countEl; // written by: 50-controls
let workEl; // written by: 95-mount
let metaEl; // written by: 95-mount
let fileEl; // written by: 95-mount
let ctlEl; // written by: 95-mount
let sfView; // written by: 95-mount

// ---- zoom, pan and pointers ----
let zoom = 1; // written by: 70-view, 75-focus, 80-input, 95-mount
let panX = 0; // written by: 70-view, 72-frame, 75-focus, 80-input, 95-mount
let panY = 0; // written by: 70-view, 72-frame, 75-focus, 80-input, 95-mount
let ptrs = new Map(); // never reassigned (80-input adds and removes pointers)
let pinchD = 1; // written by: 80-input
let pinchZ = 1; // written by: 80-input
let pinchM = null; // written by: 80-input
let pinchPX = 0; // written by: 80-input
let pinchPY = 0; // written by: 80-input
let ptMoved = false; // written by: 80-input
let pStart = null; // written by: 80-input
let multi = false; // written by: 80-input

// ---- the guide that is open ----
// written by: 20-image-input, 30-palette-assign, 46-photo, 65-edit, 87-undo, 97-open, 99-close (test)
let assignData = null;
// written by: 20-image-input, 22-straighten, 30-palette-assign, 82-colour-mode, 97-open
let sfmode = 'review';
let curId = null; // written by: 20-image-input, 30-palette-assign, 60-persist, 97-open
// written by: 20-image-input, 30-palette-assign, 50-controls, 60-persist, 72-frame, 97-open, 99-close (test)
let curName = null;
// written by: 20-image-input, 30-palette-assign, 45-shading, 46-photo, 50-controls, 60-persist, 72-frame,
// 75-focus, 80-input, 81-paint, 82-colour-mode, 84-popovers, 87-undo, 97-open, 99-close (test)
let guideDirty = false;
let autoT = null; // written by: 20-image-input, 60-persist, 84-popovers
// written by: 20-image-input, 30-palette-assign, 75-focus, 82-colour-mode, 83-along, 97-open, 99-close (test)
let hlKey = null;
// with zones and Colour along going zone by zone: the zone of the open row (null: the marker everywhere)
let hlZone = null; // written by: 83-along, 75-focus, 82-colour-mode, 20-image-input
let gTab = 'colours'; // written by: 50-controls, 72-frame, 75-focus
let showAdjust = false; // written by: 50-controls
let surpriseNote = false; // written by: 30-palette-assign, 50-controls
let lastPoolN = 0; // written by: 30-palette-assign, 46-photo

// ---- the guide's style (saved with it as payload.style; the shading settings are in 45-shading) ----
// They are listed in STYLE_FIELDS (05-style-fields), which saves them, sets them when a guide opens and
// keeps them in each Undo step. The first values here are the defaults a guide opens with (unit-tested).
// written by: 05-style-fields, 30-palette-assign, 46-photo, 50-controls, 99-close (test)
let family = 'gradient';
let palette = 'all'; // written by: 05-style-fields, 50-controls, 99-close (test)
let gradShape = 'serpentine'; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
let dir = 1; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
// the Gradient's Look: 'auto', 'smooth' or 'ltd' (Light to dark)
let look = 'auto'; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
// the Mood (MOODS, colour.js: neutral is Any, vivid Bright, muted Soft, then pastel, deep, earthy)
let emphasis = 'neutral'; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
// written by: 05-style-fields, 30-palette-assign, 46-photo, 50-controls, 99-close (test)
let limitN = 16;
let noAdj = false; // written by: 05-style-fields, 50-controls, 99-close (test)
let gradSeed = 0; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
// Radial's centre ({ x, y } as parts of the picture's width and height), or null: the middle of what the flow runs
// over (the zone's own, or the picture). v282. Written by: 05-style-fields, 30-palette-assign, 99-close (test)
let radC = null;
let blendFall = 2; // written by: 05-style-fields, 50-controls, 99-close (test)
// Blend's Mix: 'soft', 'vivid' or 'paint' (BLEND_MIXES, 30-palette-assign)
let blendMix = 'soft'; // written by: 05-style-fields, 50-controls, 99-close (test)
let texAmt = 0.5; // written by: 05-style-fields, 50-controls, 99-close (test)
let expand = false; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
let expandChar = 0.5; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
// written by: 05-style-fields, 30-palette-assign, 50-controls, 95-mount, 99-close (test)
let paletteSource = 'owned';
// written by: 05-style-fields, 30-palette-assign, 50-controls, 95-mount, 99-close (test)
let savedPalId = null;
let genHarmony = 'analogous'; // written by: 05-style-fields, 30-palette-assign, 50-controls, 99-close (test)
let genPal = []; // written by: 05-style-fields, 30-palette-assign, 99-close (test)

// ---- blend anchors ----
let anchors = []; // written by: 20-image-input, 30-palette-assign, 50-controls, 87-undo, 97-open
let selAnchor = -1; // written by: 20-image-input, 30-palette-assign, 80-input, 84-popovers, 87-undo
let blendHit = -1; // written by: 80-input
let blendMoved = false; // written by: 80-input
let blendStart = null; // written by: 80-input
let blendRaf = 0; // written by: 30-palette-assign

// ---- pinned sections ----
let locks = {}; // written by: 10-segment, 20-image-input, 30-palette-assign, 65-edit, 87-undo, 97-open
let lockMode = false; // written by: 20-image-input, 30-palette-assign, 50-controls, 87-undo, 97-open

// ---- colouring along and Focus ----
let celebrated = false; // written by: 10-segment, 30-palette-assign, 82-colour-mode, 90-export, 97-open
let blendOpen = {}; // written by: 20-image-input, 82-colour-mode, 83-along
let wakeLock = null; // written by: 82-colour-mode
let hideLabels = false; // written by: 72-frame
// Values: the picture shown in greys, to judge its light and dark (a view only: not saved, not in exports)
let valuesOn = false; // written by: 72-frame
let focus = false; // written by: 20-image-input, 30-palette-assign, 82-colour-mode, 95-mount, 97-open
let focusStep = []; // written by: 75-focus
let focusOrd = []; // written by: 75-focus
let focusPos = -1; // written by: 50-controls, 75-focus, 82-colour-mode, 99-close (test)
let focusZ = 1; // written by: 75-focus, 95-mount
let focusFin = false; // written by: 75-focus, 82-colour-mode
let focusSheet = false; // written by: 50-controls, 75-focus, 80-input, 82-colour-mode, 95-mount
let focusBox = null; // written by: 75-focus
let focusHist = []; // written by: 50-controls, 82-colour-mode

// ---- the marker popover ----
let popCtx = null; // written by: 84-popovers

// ---- drawing: caches and pending frames ----
// written by: 10-segment, 20-image-input, 22-straighten, 40-render, 65-edit, 87-undo, 95-mount, 97-open,
// 99-close (test)
let _rg = null;
let _sb = null; // written by: 40-render
let _fontGen = 0; // written by: 40-render
let _ldq = null; // written by: 40-render
let texRaf = 0; // written by: 50-controls
let dragPreview = false; // written by: 45-shading, 50-controls
let pvCanvas = null; // written by: 40-render

// ---- the reveal video (Share) ----
let revealF = null; // written by: 20-image-input, 86-reveal-share
let revOrder = null; // written by: 20-image-input, 86-reveal-share
let revRAF = 0; // written by: 86-reveal-share
let revRec = null; // written by: 86-reveal-share
let revChunks = []; // written by: 86-reveal-share
let revBlob = null; // written by: 86-reveal-share
let revMime = ''; // written by: 86-reveal-share
let revCv = null; // written by: 86-reveal-share
let revCtx = null; // written by: 86-reveal-share

// ---- printing ----
let paper = 'letter'; // written by: 90-export
let pdfBlend = false; // written by: 00-state (just below), 90-export
try {
  pdfBlend = localStorage.getItem('ms-pdf-blend') === '1';
} catch (_) {}
