/* ===== Scan: the list and its keeping (scan.js 859–996 until v318.8) =====
   The list, newest first, the brand chosen, when each cap was last read; saved to localStorage (SCAN_LIST_KEY) at
   every draw and read back on load (scanLoadList) and when another tab saved it (scanReread, 35-waiting.js). */
// The list, newest first, kept while the app is open: { i: colour index, how: '' | 'upside' | 'name' | 'chosen' }, or a
// question to answer before it counts: { ask: key, title, opts: [{ i, how }] } (two brands' B04, a code that could be
// either way up). Questions wait in the list, so sweeping on from cap to cap loses none.
const SCAN_BRAND_KEY = 'ms-scan-brand';
let scanList = [],
  scanBrand = '',
  scanOpener = null,
  scanAudio = null,
  scanLast = { i: -1, at: 0 },
  scanLastMany = { key: '', at: 0 },
  // the box's wait for Scan Text's text to hold still, and the text last read from it
  scanStill = null,
  scanText = '';
// (v303) when each marker was last read (the same cap held in view, read again and again), and when each question was
// last answered or let go by: a cap still in view isn't asked about again
const scanTookAt = new Map(),
  scanAnsweredAt = new Map();
// (v303) the list is kept through a reload (Safari can reload a tab put away mid-sweep): markers by their keys
const SCAN_LIST_KEY = 'ms-scan-list';
// (v305) whether a brand was ever tapped here (Either brand counts): until then, a collection all of one brand starts
// on it (scanBrandAuto)
let scanBrandChosen = false;
try {
  const sb = localStorage.getItem(SCAN_BRAND_KEY);
  scanBrand = sb || '';
  scanBrandChosen = sb != null;
} catch (_) {}
// (v309) the welcome's two ways in. find: "I'm not sure which set" — Scan reads a few caps into a list of its own (the
// list kept for Add waits in scanKept), the brand fixed to the one chosen, and Find my set in Add's place hands the
// caps back ({ brand, bucket, done(keys) }). added: after Add, the welcome goes on ("one by one").
let scanFind = null,
  scanKept = null,
  scanAfter = null,
  // (v309.1) and after the toast's Undo of that Add: the welcome goes back
  scanUndone = null,
  // (v318.29) opened from the welcome: Add's Undo is a link on "Anything else?" (after's 4th argument), as the chart's
  // and a set's are since v318.26, not a toast over the step's choices
  scanWelcome = false,
  // (v318.30) opened from the welcome's Type or paste codes: Scan Text's steps folded into one line and the box
  // scrolled into view (the card's .sctyped); kept for the step's Open
  scanTyped = false;
// (v318.7) the list as last saved or read here, to tell another tab's save from this one's own (scanReread)
let scanListRaw = null;
function scanSaveList() {
  if (scanFind) return;
  // (v318.4 e2e) not what a photo still being read added at once: its end checks it, and a reload meanwhile ends the
  // read, as closing Scan does (ocrClose)
  const kept = scanList.filter(
    (e) => !(typeof ocrRun !== 'undefined' && ocrRun && !ocrRun.done && e.photo === ocrRun.n),
  );
  try {
    if (!scanList.length) {
      localStorage.removeItem(SCAN_LIST_KEY);
      scanListRaw = null;
    } else {
      const raw = JSON.stringify(
        kept.map((e) =>
          Object.assign(
            e.ask
              ? {
                  ask: e.ask,
                  title: e.title,
                  opts: e.opts.map((o) => ({ k: mkey(o.i), how: o.how })),
                  // (all its answers, when the brand chosen has narrowed them: Either brand brings them back)
                  opts0: e.opts0 ? e.opts0.map((o) => ({ k: mkey(o.i), how: o.how })) : undefined,
                }
              : // (v318.21: a code put right by its name, as it was read: "read as “5110”" on its row)
                Object.assign(
                  { k: mkey(e.i), how: e.how },
                  e.as ? { as: e.as } : null,
                  e.cv ? { cv: e.cv } : null,
                  // (v318.22 debug: a list's, not a cap's, after a reload too: no caps offer from it, scanAsk's 'again')
                  e.pasted ? { pa: 1 } : null,
                ),
            // (v318.7: its photo, for the headings over each photo's markers after a reload)
            e.photo ? { p: e.photo } : null,
          ),
        ),
      );
      localStorage.setItem(SCAN_LIST_KEY, raw);
      scanListRaw = raw;
    }
  } catch (_) {}
  // (v318.7) and the pictures of its questions, what's changed of them (scanPics)
  try {
    scanPics.sync(kept);
  } catch (_) {}
  scanWaitSync();
}
// the list as saved (SCAN_LIST_KEY's JSON), read back: markers by their keys, questions with their answers, and
// (v318.7) each entry's photo, the photos numbered 1.. in turn (no gaps: "Photo 3" and "Photo 5" after a reload had
// been read as photos 1 and 2 of the list)
function scanParseList(raw) {
  let list = [];
  try {
    const a = JSON.parse(raw || '[]');
    if (!Array.isArray(a)) return [];
    const idx = (k) => (typeof k === 'string' ? keyIdx(k) : null),
      photo = (e) => (Number.isInteger(e.p) && e.p > 0 ? { photo: e.p } : null);
    list = a
      .map(function (e) {
        if (!e || typeof e !== 'object') return null;
        if (typeof e.ask === 'string' && Array.isArray(e.opts)) {
          const opts = e.opts
            .map((o) => o && { i: idx(o.k), how: typeof o.how === 'string' ? o.how : '' })
            .filter((o) => o && o.i != null);
          const all = Array.isArray(e.opts0)
            ? e.opts0
                .map((o) => o && { i: idx(o.k), how: typeof o.how === 'string' ? o.how : '' })
                .filter((o) => o && o.i != null)
            : null;
          return opts.length
            ? Object.assign(
                {
                  ask: e.ask,
                  title: String(e.title || ''),
                  opts: opts,
                  opts0: all && all.length ? all : undefined,
                  at: 0,
                },
                photo(e),
              )
            : null;
        }
        const i = idx(e.k);
        return i == null
          ? null
          : Object.assign(
              { i: i, how: typeof e.how === 'string' ? e.how : '' },
              typeof e.as === 'string' && e.as ? { as: e.as.slice(0, 12) } : null,
              e.cv === 'old' || e.cv === 'new' ? { cv: e.cv } : null,
              e.pa === 1 ? { pasted: true } : null,
              photo(e),
            );
      })
      .filter(Boolean);
  } catch (_) {
    list = [];
  }
  // (the photos numbered 1..k in turn)
  const ns = [...new Set(list.filter((e) => e.photo).map((e) => e.photo))].sort((a, b) => a - b),
    map = new Map(ns.map((n, k) => [n, k + 1]));
  list.forEach((e) => {
    if (e.photo) e.photo = map.get(e.photo);
  });
  return list;
}
// (v318.7) the number of the last photo in the list: the next photo read is numbered after it (photo-read.js ocrPhotos)
const scanPhotoMax = () => scanList.reduce((m, e) => Math.max(m, e.photo || 0), 0);
(function scanLoadList() {
  try {
    scanListRaw = localStorage.getItem(SCAN_LIST_KEY);
  } catch (_) {}
  scanList = scanParseList(scanListRaw);
})();
