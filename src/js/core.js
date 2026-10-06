const KEY = 'ohuhu-hb320-picker-v3',
  OLD = 'ohuhu-hb320-picker-v2';
const HARM = {
  complementary: 'Complementary',
  analogous: 'Analogous',
  triadic: 'Triadic',
  split: 'Split complementary',
  tetradic: 'Tetradic',
  mono: 'Monochrome',
  rainbow: 'Rainbow',
  custom: 'Custom',
  photo: 'From photo',
};
// most colours each scheme offers. The generator keeps every two colours clearly different (picker.js), so a size is
// offered while a full collection (the Ohuhu 320 set, a 322-marker one) still fills it that way in about nine rolls
// of ten, with each colour near its scheme hue: a scheme with more hues has room for more colours; Analogous keeps
// within 120° and Complementary to two hues, so they stop at 8. Monochrome's steps may be closer (blending ramps).
// A smaller collection gets the same sizes: its palettes relax closeness and say so. Photo keeps 4-16: bigger
// collections still gain up to 16, little after. (v306) Rainbow goes round the whole wheel, as the Gradient's markers
// do, so it starts at 6 and goes to 16 (in twos from 6, as Photo's: RAINBOW_SIZES); it stops at the clear markers in
// play.
const HARM_RANGE = {
  complementary: [2, 8],
  analogous: [2, 8],
  triadic: [3, 10],
  split: [3, 10],
  tetradic: [4, 12],
  mono: [2, 10],
  rainbow: [6, 16],
  custom: [2, 16],
  photo: [4, 16],
};
// Photo's Colours choices (the photoSize buttons): another scheme's size moves to the nearest of them (a tie to the smaller)
const PHOTO_SIZES = [4, 6, 8, 10, 12, 16];
function photoSnap(n) {
  return PHOTO_SIZES.reduce((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b), PHOTO_SIZES[0]);
}
// (v306) Rainbow's Colours choices, and another scheme's size moved to the nearest of them
const RAINBOW_SIZES = [6, 8, 10, 12, 14, 16];
function rainbowSnap(n) {
  return RAINBOW_SIZES.reduce((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b), RAINBOW_SIZES[0]);
}
// whether the Colours row offers this size for this scheme (its buttons go to 12; Rainbow's 14 and 16 are its own)
function sizeOffered(h, n) {
  if (h === 'rainbow') return RAINBOW_SIZES.indexOf(n) >= 0;
  const R = HARM_RANGE[h] || [2, 6];
  return n >= R[0] && n <= R[1] && n <= 12;
}
// (v308) a palette's entry in state.palH, beside it in the history: its scheme, with "+" after it when it was made by
// itself (a size, scheme or filter change: regenReplace). The next such change replaces only a palette made that way,
// so trying another size and going back with Undo finds the palette you had made.
function palHarm(x) {
  return typeof x === 'string' ? x.replace(/\+$/, '') : null;
}
function palAuto(x) {
  return typeof x === 'string' && x.slice(-1) === '+';
}
const LOCKSVG =
  '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>';
const $ = (id) => document.getElementById(id);
function esc(v) {
  return String(v == null ? '' : v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
// iPhone Safari counts canvas memory until garbage collection and refuses new canvases past a limit;
// shrinking a finished helper canvas hands its memory back straight away
// Copic 0, the Colorless Blender, lays down no colour: it can be owned (and is listed with your markers), but it's
// never picked as a colour — not for a palette, a guide, a match or a photo's colours. (Its #ffffff made it the
// "closest marker" to white paper, v298.)
const NOINK = new Set();
COLORS.forEach(function (c, i) {
  if (/colou?rless blender/i.test(c.name || '')) NOINK.add(i);
});
// any marker owned that lays down colour (not only the Colorless Blender)
function inkOwned() {
  return COLORS.some(function (c, i) {
    return !NOINK.has(i) && isOwned(i);
  });
}
function freeCanvas(c) {
  try {
    if (c) {
      c.width = 0;
      c.height = 0;
    }
  } catch (_) {}
}
// draws a picture much smaller (w × h) by halving it in steps first: Safari's engine shrinks in one go without
// averaging, so a photo's grain and camera noise would survive into the small copy (Chrome averages either way)
// (v304) no step larger than DRAW_CAP pixels: a canvas past Safari's 16.7-megapixel limit on iPad stays empty, so the
// first half of a photo over about 67 megapixels came out blank; each step's canvas is freed as soon as the next is
// drawn, not all at the end
const DRAW_CAP = 16e6;
function drawShrunk(g, img, w, h) {
  let src = img,
    sw = img.naturalWidth || img.width,
    sh = img.naturalHeight || img.height;
  try {
    while (sw >= 2 * w && sh >= 2 * h) {
      let nw = Math.ceil(sw / 2),
        nh = Math.ceil(sh / 2);
      if (nw * nh > DRAW_CAP) {
        const k = Math.sqrt(DRAW_CAP / (nw * nh));
        nw = Math.max(w, Math.floor(nw * k));
        nh = Math.max(h, Math.floor(nh * k));
      }
      const c = document.createElement('canvas');
      c.width = nw;
      c.height = nh;
      const cg = c.getContext('2d');
      cg.imageSmoothingEnabled = true;
      cg.imageSmoothingQuality = 'high';
      cg.drawImage(src, 0, 0, c.width, c.height);
      if (src !== img) freeCanvas(src);
      src = c;
      sw = c.width;
      sh = c.height;
    }
  } catch (_) {}
  g.drawImage(src, 0, 0, w, h);
  if (src !== img) freeCanvas(src);
}
function hideToast() {
  const t = document.getElementById('msToast');
  if (t) t.classList.remove('on');
  clearTimeout(toast._t);
}
// toasts sit just above whichever bar is docked at the bottom of the screen (the guide's action bar, focus mode's
// buttons, Reveal's bar), or near the bottom edge when there isn't one; only their buttons catch taps
function toastBottom() {
  let b = 0;
  const H = window.innerHeight;
  document.querySelectorAll('.sfbar,.sffocbot,.sfrevbar,.sfshft').forEach(function (el) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.width > 0 && r.bottom >= H - 4 && r.top < H) b = Math.max(b, H - r.top);
  });
  return b ? Math.round(b) + 10 + 'px' : 'calc(22px + env(safe-area-inset-bottom,0px))';
}
// An error shown where it happened: an amber card after `anchor`, until the next tap anywhere else (or its ✕). When
// that place isn't on screen (a closed dialog, a screen left behind) the message comes as a toast instead.
// The card goes once that tap is over (after its click): taking it away as the finger lands would move what's under
// the finger, and the tap could land on something else (a dialog's backdrop, closing it). A drag or scroll that
// doesn't end in a click leaves it for the next tap.
function errCard(anchor, msg) {
  if (!anchor || !anchor.parentNode || !anchor.isConnected || !anchor.getClientRects().length) {
    toastHTML(ic('triangle-alert', 'icw') + ' ' + msg, 8000);
    return null;
  }
  let c = anchor.nextElementSibling;
  if (!(c && c.classList.contains('mserr'))) {
    c = document.createElement('div');
    c.className = 'mserr';
    c.setAttribute('role', 'alert');
    anchor.parentNode.insertBefore(c, anchor.nextSibling);
  }
  c.innerHTML =
    '<span>' +
    ic('triangle-alert', 'icw') +
    ' ' +
    msg +
    '</span><button type="button" class="mserrx" aria-label="Dismiss">' +
    ic('x') +
    '</button>';
  c.querySelector('.mserrx').addEventListener('click', function () {
    c.remove();
  });
  // (a new message in the same card during that click keeps it)
  c._gen = (c._gen || 0) + 1;
  if (!c._armed) {
    let armed = false;
    const down = function (e) {
        armed = !c.contains(e.target);
      },
      click = function () {
        if (!armed) return;
        document.removeEventListener('pointerdown', down, true);
        document.removeEventListener('click', click, true);
        c._armed = false;
        const g = c._gen;
        setTimeout(function () {
          if (c._gen === g) c.remove();
        }, 0);
      };
    c._armed = true;
    setTimeout(function () {
      document.addEventListener('pointerdown', down, true);
      document.addEventListener('click', click, true);
    }, 0);
  }
  return c;
}
function clearErrs(scope) {
  (scope || document).querySelectorAll('.mserr').forEach(function (c) {
    c.remove();
  });
}
// How a guide shows how far along it is, the same on Home's Continue card and in Colour along (v288): what's coloured
// in its marker's colour, the rest pale over the paper (PROG_PALE of the colour); with a marker's row open (or in Focus
// mode), what's coloured is softened (PROG_SOFT) so the sections still to do stand out.
const PROG_PAPER = [247, 244, 238],
  PROG_PALE = 0.25,
  PROG_SOFT = 0.5;
function progMix(rgb, k) {
  return [
    Math.round(rgb[0] * k + PROG_PAPER[0] * (1 - k)),
    Math.round(rgb[1] * k + PROG_PAPER[1] * (1 - k)),
    Math.round(rgb[2] * k + PROG_PAPER[2] * (1 - k)),
  ];
}
// a line icon from the sprite (html/icons.html: Lucide's, and the tool row's own Codes and Values), sized to the text
// beside it; hidden from screen readers (the button or text it's in says what it does)
// A marker's old code as shown and searched: some of Ohuhu's are stored with the Roman numeral Ⅱ ("CGⅡ00", as they
// were printed), which most fonts draw like "ll"; shown with plain letters, "CGII00" (v302). The stored code stays as
// it is: saved work from before the rename is matched by it (state.js mkKnown).
function oldCode(c) {
  return String(c.old || '').normalize('NFKC');
}
// (v308) A name made safe for a file name: letters and digits in any script are kept (a Japanese, Greek or Cyrillic
// name used to become "guide.msguide.json", so several files shared one name), anything else becomes the separator;
// spaces too, unless keepSpaces. At most max letters; fallback when nothing is left.
function fileSlug(name, fallback, max, keepSpaces) {
  const sep = keepSpaces ? ' ' : '-';
  let s = String(name == null ? '' : name);
  try {
    s = s.normalize('NFC').replace(keepSpaces ? /[^\p{L}\p{M}\p{N}\- ]+/gu : /[^\p{L}\p{M}\p{N}]+/gu, sep);
  } catch (_) {
    s = s.replace(keepSpaces ? /[^\w\- ]+/g : /[^a-z0-9]+/gi, sep);
  }
  s = s
    .split(sep)
    .filter(Boolean)
    .join(sep)
    .replace(/^[-\s]+|[-\s]+$/g, '');
  s = Array.from(s)
    .slice(0, max || 80)
    .join('')
    .replace(/[-\s]+$/, '');
  return s || fallback || 'file';
}
function ic(n, cls) {
  return (
    '<svg class="ic' +
    (cls ? ' ' + cls : '') +
    '" aria-hidden="true" focusable="false"><use href="#i-' +
    n +
    '"/></svg>'
  );
}
// A toast stays while the pointer is over it or a button in it has the keyboard's focus (v284: an Undo can be read
// and reached), and goes a moment after that ends.
// (v308) The message is plain text: a name in it (a guide's, a zone's, a palette's) is shown as written and can never
// become markup. toastHTML is the explicit variant for a message built as HTML, its names escaped by the caller.
function toast(m, ms) {
  toastShow(m, ms, false);
}
function toastHTML(m, ms) {
  toastShow(m, ms, true);
}
function toastShow(m, ms, html) {
  let t = document.getElementById('msToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'msToast';
    t.className = 'mstoast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);
    const hold = function () {
        if (t.classList.contains('on')) clearTimeout(toast._t);
      },
      go = function () {
        if (!t.classList.contains('on') || t.matches(':hover') || t.contains(document.activeElement)) return;
        clearTimeout(toast._t);
        toast._t = setTimeout(function () {
          t.classList.remove('on');
        }, 2500);
      };
    t.addEventListener('pointerenter', hold);
    t.addEventListener('focusin', hold);
    t.addEventListener('pointerleave', go);
    t.addEventListener('focusout', function () {
      setTimeout(go, 0);
    });
  }
  if (html) t.innerHTML = m;
  else t.textContent = m == null ? '' : String(m);
  // (v288: on the guide's Share tab the buttons are at the bottom, so a toast sits just under the pinned picture)
  // (the Share panel itself showing: the Plan, not Colour along or Edit sections after it)
  const sh = document.querySelector('#sfCtl .sftab[data-tab="share"]');
  if (
    sh &&
    sh.offsetParent !== null &&
    !document.documentElement.classList.contains('sfsheeton') &&
    !document.querySelector('#sfRoot.sfrev,#sfRoot.sffoc,#sfRoot.sffull')
  ) {
    const pin = parseFloat(document.documentElement.style.getPropertyValue('--pinH')) || 0;
    t.style.top = Math.round(pin + 10) + 'px';
    t.style.bottom = 'auto';
  } else {
    t.style.top = '';
    t.style.bottom = toastBottom();
  }
  t.classList.add('on');
  toast._at = Date.now();
  clearTimeout(toast._t);
  toast._t = setTimeout(function () {
    t.classList.remove('on');
  }, ms || 3200);
}
function toastAction(m, label, fn, ms) {
  toastActions(m, [{ label: label, fn: fn }], ms);
}
// (v308) as toastAction, with a message built as HTML (its names escaped by the caller)
function toastActionHTML(m, label, fn, ms) {
  toastActions(m, [{ label: label, fn: fn }], ms, true);
}
// a toast with a button or more ([{ label, fn }]); the first is #toastAct. Long enough to read and reach: 8 s.
// The message is plain text unless html; the buttons' labels always are.
function toastActions(m, acts, ms, html) {
  toastShow(m, ms || 8000, !!html);
  const t = document.getElementById('msToast');
  if (!t) return;
  acts.forEach(function (a, i) {
    const b = document.createElement('button');
    b.className = 'sflink';
    b.id = 'toastAct' + (i ? i + 1 : '');
    b.textContent = a.label;
    t.appendChild(document.createTextNode(' '));
    t.appendChild(b);
    b.addEventListener(
      'click',
      function () {
        t.classList.remove('on');
        a.fn();
      },
      { once: true },
    );
  });
}
// A file for the person to keep. On a phone or tablet it goes to the share sheet (on an iPhone: Save to Files, iCloud
// Drive, AirDrop or Mail); on a computer, or where files can't be shared, it downloads. Phones only allow sharing
// straight after a tap, and preparing the file can take long enough that the tap no longer counts: then (retry) a toast
// says it is ready with a Share button to tap; any other failure downloads it instead. Resolves 'share' or 'download'
// once it was handed over, 'cancel' when the share sheet was closed, false when neither worked.
// o: title (and text) for the share sheet; what: its name in the toast ("Your backup is ready."); preferShare
// (default: shareFirst()); retry (default true); onWait: called when the toast with the Share button is shown.
function shareFirst() {
  try {
    return isIOSDevice() || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  } catch (e) {
    return false;
  }
}
function canShareFile(file) {
  try {
    return !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
  } catch (e) {
    return false;
  }
}
function downloadBlob(blob, fname) {
  try {
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // (a minute: Safari on an iPad asks before downloading, and the file has to be there when the answer comes, v304)
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 60000);
    return true;
  } catch (e) {
    return false;
  }
}
function handOver(blob, fname, o) {
  o = o || {};
  const dl = function () {
    return downloadBlob(blob, fname) ? 'download' : false;
  };
  let file = null;
  try {
    file = new File([blob], fname, { type: blob.type });
  } catch (e) {}
  if (!((o.preferShare === undefined ? shareFirst() : o.preferShare) && canShareFile(file)))
    return Promise.resolve(dl());
  const data = { files: [file], title: o.title };
  if (o.text) data.text = o.text;
  const share = function (again) {
    let p;
    try {
      p = navigator.share(data);
    } catch (e) {
      p = Promise.reject(e);
    }
    return p.then(
      function () {
        return 'share';
      },
      function (err) {
        const nm = err && err.name;
        // (InvalidStateError: a share sheet is already open, from a second tap: left alone, not downloaded, v304)
        if (nm === 'AbortError' || nm === 'InvalidStateError') return 'cancel';
        if (nm === 'NotAllowedError' && !again && o.retry !== false)
          return new Promise(function (res) {
            if (o.onWait) o.onWait();
            toastAction('Your ' + (o.what || 'file') + ' is ready.', 'Share', function () {
              res(share(true));
            });
          });
        return dl();
      },
    );
  };
  return share(false);
}
// One-time hints (the guide's ⓘ lines, Markers' tick hint): helper text in full the first time on this device, then
// as a one-line ⓘ that opens in place. What has been seen is one list in localStorage ('ms-seen-hints'), read once a
// visit; marking a hint keeps what is stored now (another tab's) rather than writing over it.
const HINTS_KEY = 'ms-seen-hints';
let _hSeen = null;
function hintSeen(id) {
  if (!_hSeen) {
    try {
      _hSeen = JSON.parse(localStorage.getItem(HINTS_KEY) || '[]');
    } catch (_) {
      _hSeen = null;
    }
    if (!Array.isArray(_hSeen)) _hSeen = [];
  }
  return _hSeen.indexOf(id) >= 0;
}
function markHint(id) {
  if (hintSeen(id)) return;
  _hSeen.push(id);
  let all = null;
  try {
    all = JSON.parse(localStorage.getItem(HINTS_KEY) || '[]');
  } catch (_) {}
  if (!Array.isArray(all)) all = [];
  _hSeen.forEach(function (x) {
    if (all.indexOf(x) < 0) all.push(x);
  });
  try {
    localStorage.setItem(HINTS_KEY, JSON.stringify(all));
  } catch (_) {}
}
// the ⓘ line: a button with the long text (open) or the short one, both HTML; info: its data-info id (the guide's)
function infoLineHTML(open, short, long, info) {
  return (
    '<button type="button" class="sfinfo' +
    (open ? ' open' : '') +
    '"' +
    (info != null ? ' data-info="' + esc(info) + '"' : '') +
    ' aria-expanded="' +
    open +
    '"><span class="sfi" aria-hidden="true">i</span><span class="sfit">' +
    (open ? long : short) +
    '</span></button>'
  );
}
// storage full: said at most every 10 seconds for background saves; `now` (a tap that didn't save) always says it
function saveFailNotice(now_) {
  if (STORE_BLOCKED) return;
  const now = Date.now();
  if (!now_ && saveFailNotice.t && now - saveFailNotice.t < 10000) return;
  saveFailNotice.t = now;
  toast(
    'Couldn\u2019t save \u2014 this browser\u2019s storage is full. Back up your guides and delete a few from the Library.',
    8000,
  );
}
function safeThumb(t) {
  return typeof t === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(t) ? t : '';
}
function cleanSaved(e) {
  if (!e || typeof e !== 'object') return null;
  const id = Number(e.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const o = Object.assign({}, e);
  o.id = id;
  o.type = typeof e.type === 'string' ? e.type : 'palette';
  o.name = typeof e.name === 'string' ? e.name.slice(0, 120) : '';
  o.keys = Array.isArray(e.keys) ? e.keys.filter((k) => typeof k === 'string') : [];
  if ('thumb' in o) o.thumb = safeThumb(o.thumb);
  if ('done' in o && !(Number.isInteger(o.done) && o.done >= 0)) delete o.done;
  // (v308) a palette's scheme, to open it as that again
  if ('h' in o && !(typeof o.h === 'string' && HARM[o.h])) delete o.h;
  // (when it was saved: a time, or none — a word there showed as "Invalid Date" in the Library, v298)
  if ('ts' in o) {
    const t = Number(o.ts);
    if (Number.isFinite(t) && t > 0 && t < 8.64e15) o.ts = t;
    else delete o.ts;
  }
  return o;
}
const stage = $('stage'),
  swatch = $('swatch'),
  code = $('code'),
  hint = $('hint'),
  readout = $('readout'),
  drawBtn = $('draw'),
  undoBtn = $('undo'),
  resetBtn = $('reset'),
  fill = $('fill'),
  statusEl = $('status'),
  famsEl = $('fams'),
  pile = $('pile'),
  pileEmpty = $('pileEmpty'),
  pilen = $('pilen'),
  tiptap = $('tiptap'),
  ambient = $('ambient'),
  halo = $('halo'),
  glare = $('glare'),
  shineEl = swatch.querySelector('.shine'),
  palette = $('palette'),
  bands = $('bands'),
  phint = $('phint'),
  trackWrap = $('trackWrap'),
  drawnWrap = $('drawnWrap'),
  mPalette = $('mPalette'),
  mCollection = $('mCollection'),
  mHome = $('mHome'),
  mSections = $('mSections'),
  sizeWrap = $('sizeWrap'),
  segs = $('segs'),
  harmWrap = $('harmWrap'),
  harm = $('harm'),
  tonesEl = $('tones'),
  satsEl = $('sats'),
  brandsEl = $('brands'),
  hero = $('hero'),
  ownWrap = $('ownWrap'),
  ownView = $('ownView'),
  ownAllBtn = $('ownAll'),
  ownNoneBtn = $('ownNone'),
  backupBtn = $('backupBtn'),
  backupOverlay = $('backupOverlay'),
  backupText = $('backupText'),
  backupCopy = $('backupCopy'),
  backupRestore = $('backupRestore'),
  backupClose = $('backupClose'),
  backupCap = $('backupCap'),
  ownHint = $('ownHint'),
  gapWrap = $('gapWrap'),
  gapSort = $('gapSort'),
  pickTitle = $('pickTitle'),
  pickCap = $('pickCap'),
  backupDownload = $('backupDownload'),
  backupImport = $('backupImport'),
  backupFile = $('backupFile'),
  seedWrap = $('seedWrap'),
  seedBtn = $('seedBtn'),
  seedOverlay = $('seedOverlay'),
  seedSearch = $('seedSearch'),
  seedGrid = $('seedGrid'),
  seedRandom = $('seedRandom'),
  seedClose = $('seedClose'),
  primaryRow = $('primaryRow'),
  secondaryRow = $('secondaryRow'),
  findWrap = $('findWrap'),
  searchInput = $('q'),
  findResults = $('findResults'),
  results = $('results'),
  matchn = $('matchn'),
  copyBtn = $('copyBtn'),
  filtersEl = $('filters'),
  filterBar = $('filterBar'),
  filterSum = $('filterSum'),
  findActions = $('findActions'),
  toPalette = $('toPalette'),
  poolBar = $('poolBar'),
  poolN = $('poolN'),
  poolClear = $('poolClear'),
  exportBtn = $('exportBtn'),
  saveBtn = $('saveBtn'),
  savedBtn = $('savedBtn'),
  savedOverlay = $('savedOverlay'),
  savedList = $('savedList'),
  savedClose = $('savedClose'),
  libRow = $('libRow'),
  swapBtn = $('swap'),
  poolGrid = $('poolGrid'),
  pooln = $('pooln'),
  imgOverlay = $('imgOverlay'),
  cardImg = $('cardImg'),
  dlLink = $('dlLink'),
  ovClose = $('ovClose'),
  root = document.documentElement;
// Reduced motion, from the system setting: reducedMotion() reads it afresh (a setting changed while the app is open
// counts at once: the finish's strokes, Reveal, the Build bloom, How it works); reduce is the same read once at
// startup, for the smooth scrolls (v306: one check, where four places had their own)
function reducedMotion() {
  try {
    return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {
    return false;
  }
}
const reduce = reducedMotion();
const buzz = (n) => {
  try {
    navigator.vibrate && navigator.vibrate(n);
  } catch (e) {}
};
