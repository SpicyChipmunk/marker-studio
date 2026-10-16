/* ===== Scan: which markers of a set weren't read (scan.js 1360–1498 until v318.8) ===== */
// After a photo (Done's card), a list pasted (its card) or a sweep (Add's toast): when the list and your collection
// cover nearly all of a set, the set is named with the few of it that are missing, "Honolulu 120: all but 2 are
// here — B64 and G1. Not read, or not yours?", with Add these 2 (to the list, to check before Add) and I don't have
// them (remembered for the set, under an ms- key, so Delete all my data clears it). The set: of the sets of 24 or more
// with a marker in this session's list (not All Copic markers), leaving out those complete (listed or yours, a question
// waiting's answers counted as there) and any set nine-tenths of which is in a complete set (an owner of Honolulu 216
// isn't told "48 Mid-tone Set: all but 3"), the largest with nine-tenths of it here; shown only when it misses 12 or
// fewer (never a smaller set instead). A brand's blender (0) is never missing; the answers of a question waiting are
// neither here nor missing ("2 waiting as questions below"). One card per set per visit; nothing is added by itself
const SCAN_NOTHAVE_KEY = 'ms-scan-nothave',
  scanGapsSaid = new Set();
let scanGapPending = null;
function scanNotHave() {
  try {
    const a = JSON.parse(localStorage.getItem(SCAN_NOTHAVE_KEY) || '[]');
    return new Set(Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
  } catch (_) {
    return new Set();
  }
}
function scanNotHaveAdd(name) {
  const a = scanNotHave();
  a.add(name);
  try {
    localStorage.setItem(SCAN_NOTHAVE_KEY, JSON.stringify([...a]));
  } catch (_) {}
}
const scanSetName = (p) => p.b + '|' + p.n,
  scanIsBlender = (k) => /\|0$/.test(k);
// the set nearly all here, with what's missing: { name, p, miss: [{ k, i, code }], waiting } or null. again: one
// named already this visit may be again (Add's toast after a list's card named it)
function scanSetGaps(again) {
  if (scanFind || typeof MARKER_SETS === 'undefined') return null;
  const listed = new Set(scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
  if (!listed.size) return null;
  const pend = new Set();
  scanList.forEach((e) => e.ask && e.opts.forEach((o) => pend.add(mkey(o.i))));
  const have = (k) => listed.has(k) || state.owned.has(k),
    no = scanNotHave(),
    complete = [],
    cands = [];
  MARKER_SETS.forEach(function (p) {
    if (p.allbrand) return;
    const keys = presetMkeys(p);
    if (setKeys(keys).length < 24) return;
    const colours = keys.filter((k) => !scanIsBlender(k)),
      real = colours.filter((k) => !pend.has(k)),
      miss = real.filter((k) => !have(k)),
      done = colours.every((k) => have(k) || pend.has(k));
    if (done) {
      complete.push(new Set(keys));
      return;
    }
    if (!keys.some((k) => listed.has(k))) return;
    if (real.length && (real.length - miss.length) / real.length < 0.9) return;
    if (!miss.length) return;
    cands.push({
      name: scanSetName(p),
      p: p,
      keys: keys,
      size: keys.length,
      miss: miss,
      waiting: keys.filter((k) => pend.has(k)).length,
    });
  });
  const left = cands.filter(
    (c) =>
      !no.has(c.name) &&
      (again || !scanGapsSaid.has(c.name)) &&
      !complete.some((X) => c.keys.filter((k) => X.has(k)).length / c.keys.length >= 0.9),
  );
  left.sort((a, b) => b.size - a.size || a.miss.length - b.miss.length);
  if (!left.length) return null;
  const top = left[0];
  if (top.miss.length > 12) return null;
  return {
    name: top.name,
    p: top.p,
    miss: top.miss.map((k) => ({ k: k, i: keyIdx(k), code: COLORS[keyIdx(k)].code })),
    waiting: top.waiting,
  };
}
// the codes missing, said: "B64 and G1", "B64, G1 and Y13"
function scanGapCodes(g) {
  const c = g.miss.map((m) => m.code);
  return c.length === 1 ? c[0] : c.slice(0, -1).join(', ') + ' and ' + c[c.length - 1];
}
// the card's choices for the set (scanSay), said once per set per visit: null when there's no set to name
function scanGapChoices(g) {
  g = g || scanSetGaps();
  if (!g) return null;
  scanGapsSaid.add(g.name);
  const n = g.miss.length;
  return [
    {
      head:
        g.p.n +
        ': all but ' +
        n +
        (n === 1 ? ' is' : ' are') +
        ' here \u2014 ' +
        scanGapCodes(g) +
        (g.waiting
          ? ', and ' + g.waiting + ' waiting as ' + (g.waiting === 1 ? 'a question' : 'questions') + ' below'
          : '') +
        '. Not read, or not yours?',
    },
    {
      label: 'Add ' + (n === 1 ? 'it' : 'these ' + n),
      go: function () {
        let took = 0;
        g.miss.forEach(function (m) {
          if (scanTake(m.i, '', true, true)) took++;
        });
        scanSay(
          took ? 'ok' : 'same',
          took ? took + ' added to the list' : 'All already in the list',
          g.p.n + ' \u00b7 Check them below, then Add',
          -1,
        );
        scanBeep(took ? 'ok' : 'same');
        scanRender();
      },
    },
    {
      label: n === 1 ? 'I don\u2019t have it' : 'I don\u2019t have them',
      go: function () {
        scanNotHaveAdd(g.name);
        scanSay(
          'same',
          'Not yours, then',
          g.p.n + '\u2019s missing markers aren\u2019t asked about again',
          -1,
        );
      },
    },
  ];
}
