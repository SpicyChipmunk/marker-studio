// Scoring the app's sections against truth (scripts/bench). Ownership classes (the first pressure test's scorer) per
// truth section, then Ben's answers decide each class's bucket:
//   DEFECT   wrong by his answers (a merge, a lost edge region, a counted counter, a coloured section lost, ...)
//   CORRECT  right (matched; the paper margin left out as background)
//   EXPECTED by the app's design and his answer 5 (paper inside a frame left out)
//   INFO     neither (near-tangent splits, sections just under Min section size, a frame interior counted)
// plus attribution: merges by the hazard whose pair they are, spurious sections by where they sit (text, hatching,
// faint marks, specks, coloured specks, the table round a page), and adjacency at two reaches, ink bloat, warnings.
const key = (a, b) => (a < b ? a + ':' + b : b + ':' + a);

// truth: Int32 W*H (-1 ink / don't-care), meta: product meta (tags, areas...). app: {labels, comps, counted (Set),
// adj (object of Sets), segWarn, faintOffer, colored, minPx}. opts: {inPage(x,y) for the unstraightened path}
export function score(meta, truth, app, opts = {}) {
  const { W, H } = meta,
    n = W * H,
    nTruth = meta.nTruth,
    truthArea = meta.truthArea,
    found = app.labels,
    counted = app.counted,
    comps = app.comps;
  const minTruth = Math.max(10, app.minPx),
    splitShare = 0.15;
  const ambPairs = new Set((meta.ambPairs || []).map(([a, b]) => key(a, b)));
  const sliver = new Set(meta.slivers || []);
  const amb = new Set(meta.ambiguous || []),
    col = new Set(meta.coloured || []),
    tag = meta.tag || [];
  const tHist = new Map(),
    fHist = new Map(),
    tScored = new Int32Array(nTruth + 1),
    tInk = new Int32Array(nTruth + 1);
  let fMax = 0;
  for (let p = 0; p < n; p++) if (found[p] > fMax) fMax = found[p];
  const fArea = new Int32Array(fMax + 2);
  let paper = 0,
    bloat = 0,
    tInkPx = 0,
    fInkPx = 0;
  for (let p = 0; p < n; p++) {
    const t = truth[p],
      f = found[p];
    if (f >= 1) fArea[f]++;
    else fInkPx++;
    if (t < 1) {
      tInkPx++;
      continue;
    }
    tScored[t]++;
    paper++;
    if (f < 1) {
      tInk[t]++;
      bloat++;
      continue;
    }
    let h = tHist.get(t);
    if (!h) tHist.set(t, (h = new Map()));
    h.set(f, (h.get(f) || 0) + 1);
    let g = fHist.get(f);
    if (!g) fHist.set(f, (g = new Map()));
    g.set(t, (g.get(t) || 0) + 1);
  }
  const isBg = (f) => !!(comps[f] && comps[f].bg);
  const dom = new Map(),
    tList = [];
  let ignored = 0;
  // (a straightened photo: sections the app's corners left out of the flat page; the table round an unstraightened
  // photo is scored apart, below, not as a section)
  const cropped = new Map(meta.cropped || []);
  const surroundL = tag.indexOf('surroundings');
  for (let t = 1; t <= nTruth; t++) {
    if (t === surroundL || cropped.has(t)) continue;
    if (truthArea[t] < minTruth || tScored[t] === 0) {
      ignored++;
      continue;
    }
    tList.push(t);
    const h = tHist.get(t) || new Map();
    let best = 0,
      bestN = 0;
    for (const [f, c] of h)
      if (counted.has(f) && c > bestN) {
        bestN = c;
        best = f;
      }
    dom.set(t, best);
  }
  const byDom = new Map();
  for (const t of tList) {
    const d = dom.get(t);
    if (d) (byDom.get(d) || byDom.set(d, []).get(d)).push(t);
  }
  const per = new Map();
  for (const t of tList) {
    const d = dom.get(t),
      h = tHist.get(t) || new Map(),
      sc = tScored[t];
    let countedCover = 0,
      bgCover = 0,
      uncountedCover = 0;
    for (const [f, c] of h) {
      if (counted.has(f)) countedCover += c / sc;
      else if (isBg(f)) bgCover += c / sc;
      else uncountedCover += c / sc;
    }
    const dominantCover = d ? h.get(d) / sc : 0;
    let kind;
    if (countedCover < 0.5)
      kind = bgCover >= 0.5 ? 'bgDropped' : uncountedCover >= 0.3 ? 'tinyDropped' : 'missed';
    else if (dominantCover < 0.5) kind = 'shattered';
    else if (byDom.get(d).length > 1 && (amb.has(t) || byDom.get(d).filter((u) => !amb.has(u)).length > 1))
      kind = 'merged';
    else kind = countedCover - dominantCover >= splitShare ? 'split' : 'matched';
    let iou = 0;
    if (d) {
      const inter = h.get(d) || 0;
      iou = inter / (sc + fArea[d] - inter);
    }
    per.set(t, {
      t,
      kind,
      area: truthArea[t],
      iou,
      dominantCover,
      inkFrac: tInk[t] / sc,
      dom: d,
      tag: tag[t] || 'drawing',
      amb: amb.has(t),
      col: col.has(t),
    });
  }
  for (const [t, want] of cropped)
    if (want >= minTruth)
      per.set(t, {
        t,
        kind: 'cropped',
        area: want,
        iou: 0,
        dominantCover: 0,
        inkFrac: 0,
        dom: 0,
        tag: tag[t] || 'drawing',
        amb: amb.has(t),
        col: col.has(t),
      });
  // buckets by Ben's answers
  // (FEATURE: what the app has no way to do yet, answer 4's 'kept but not recognised': its own row, not a defect)
  const B = { defect: {}, correct: {}, expected: {}, info: {}, feature: {} };
  const add = (b, k, r) => {
    (B[b][k] = B[b][k] || []).push(r);
    r.cls = b + ':' + k;
  };
  for (const r of per.values()) {
    const { kind, tag: tg } = r;
    if (kind === 'cropped') {
      add('defect', 'cropped', r);
      continue;
    }
    if (tg === 'margin' || tg === 'surroundings') {
      if (kind === 'bgDropped') add('correct', 'bg:' + tg, r);
      else if (kind === 'tinyDropped' || kind === 'missed') add('info', tg + ':' + kind, r);
      else
        // (a margin piece given a marker: info until Ben says whether a corner cut off by a line running off the page is
        // margin or a shape; the table round an unstraightened photo given markers is a defect)
        add(
          tg === 'margin' ? 'info' : 'defect',
          tg === 'margin' ? (kind === 'shattered' ? 'margin:shattered' : 'marginCounted') : 'surroundCounted',
          r,
        );
    } else if (tg === 'frameInterior') {
      if (kind === 'bgDropped') add('expected', 'bg:frameInterior', r);
      else add('info', 'frameInterior:' + kind, r);
    } else if (r.col) {
      if (kind === 'matched' || (kind === 'split' && r.amb)) {
        if (app.colored && r.dom && app.colored[r.dom]) add('correct', 'coloured:keptDone', r);
        else add('feature', 'coloured:keptNotDone', r);
      } else add('defect', 'coloured:lost:' + kind, r);
    } else if (kind === 'matched') add('correct', 'matched', r);
    else if (
      r.amb &&
      (kind === 'split' ||
        kind === 'merged' ||
        kind === 'shattered' ||
        // (a sliver this size can't show, lost to ink or background, is a toss-up too)
        (sliver.has(r.t) && (kind === 'missed' || kind === 'bgDropped')))
    )
      add('info', kind + ':nearTangent', r);
    else if (
      kind === 'merged' &&
      byDom.get(r.dom).every((u) => u === r.t || amb.has(u) || ambPairs.has(key(r.t, u)))
    )
      add('info', 'merged:nearTangent', r);
    else if (kind === 'tinyDropped') add('info', 'tinyDropped', r);
    // (photos of the printed set, opts.pxPerMm: a section under 2 mm across on paper lost to the lines, which a photo
    // draws thicker: a sliver between strokes no one colours (Ben, the botanical page), counted apart as info)
    else if (kind === 'missed' && opts.pxPerMm && Math.sqrt(r.area) / opts.pxPerMm < 2)
      add('info', 'missed:under2mm', r);
    else if (kind === 'bgDropped')
      add('defect', (meta.edgeTouch || []).includes(r.t) ? 'bgDropped:edge' : 'bgDropped:inner', r);
    else add('defect', kind, r);
  }
  // merges attributed to hazards
  const hazOf = new Map();
  for (const h of meta.hazards || [])
    for (const [a, b] of h.pairs || [])
      hazOf.set(
        key(a, b),
        h.kind === 'gap'
          ? `gap ${h.px}px ${h.sub}`
          : h.kind === 'faintLine'
            ? `faint line grey ${h.grey}`
            : h.kind,
      );
  // (a group of n merged sections is n - 1 joins, explained along a spanning forest: a hazard's pairs first, then
  // near-tangent pairs, each only between the two sections it names; what's left is 'other'. mergedBy counts joins,
  // counts.defect.merged counts sections)
  const mergedBy = {};
  for (const [, ts] of byDom) {
    const m = ts.filter((t) => per.get(t) && per.get(t).kind === 'merged');
    if (m.length < 2) continue;
    const parent = new Map(m.map((t) => [t, t]));
    const find = (t) => (parent.get(t) === t ? t : (parent.set(t, find(parent.get(t))), parent.get(t)));
    const edges = [];
    for (let i = 0; i < m.length; i++)
      for (let j = i + 1; j < m.length; j++) {
        const k = key(m[i], m[j]);
        if (hazOf.has(k)) edges.push([0, hazOf.get(k), m[i], m[j]]);
        else if (ambPairs.has(k)) edges.push([1, 'near-tangent', m[i], m[j], 0]);
        // (an ambiguous section explains one join: its own, not the whole group's)
        else if (per.get(m[i]).amb || per.get(m[j]).amb)
          edges.push([2, 'near-tangent', m[i], m[j], per.get(m[i]).amb ? m[i] : m[j]]);
      }
    edges.sort((x, y) => x[0] - y[0]);
    let left = m.length - 1;
    const usedAmb = new Set();
    for (const [, c, a, b, by] of edges) {
      if (by && usedAmb.has(by)) continue;
      const ra = find(a),
        rb = find(b);
      if (ra === rb) continue;
      if (by) usedAmb.add(by);
      parent.set(ra, rb);
      mergedBy[c] = (mergedBy[c] || 0) + 1;
      left--;
    }
    if (left) mergedBy.other = (mergedBy.other || 0) + left;
  }
  // spurious: counted found sections that own no truth section (matched / merged / split / shattered) and cover no
  // more than splitShare of one
  const owned = new Set(
    [...per.values()]
      .filter((r) => r.dom && ['matched', 'merged', 'split', 'shattered'].includes(r.kind))
      .map((r) => r.dom),
  );
  const spurious = [];
  for (const f of counted) {
    if (owned.has(f)) continue;
    const g = fHist.get(f) || new Map();
    let sig = false;
    for (const [t, c] of g)
      if (
        tScored[t] &&
        c / tScored[t] >= splitShare &&
        truthArea[t] >= minTruth &&
        per.has(t) &&
        per.get(t).kind !== 'bgDropped'
      )
        sig = true;
    if (!sig) spurious.push(f);
  }
  const patch = (kind) =>
    new Set((meta.hazards || []).filter((h) => h.kind === kind).flatMap((h) => h.labels || []));
  const hatched = patch('hatch'),
    stippled = patch('stipple');
  const spuriousBy = {},
    spuriousAmb = [];
  const inDisc = (x, y, c, rad) => c && Math.hypot(x - c[0], y - c[1]) <= rad;
  for (const f of spurious) {
    const c = comps[f] || {},
      x = c.cx,
      y = c.cy,
      area = fArea[f];
    let k = 'other';
    // the truth section it mostly lies in (else the one under its middle)
    let tl = -1,
      tn = 0;
    for (const [tt, cc] of fHist.get(f) || [])
      if (cc > tn) {
        tn = cc;
        tl = tt;
      }
    if (tl < 1)
      tl =
        truth[Math.min(H - 1, Math.max(0, Math.round(y))) * W + Math.min(W - 1, Math.max(0, Math.round(x)))];
    // (a found section lying in a near-tangent region, one lobe of a pinched cell, is part of that don't-care)
    if (tl > 0 && amb.has(tl) && (!opts.inPage || opts.inPage(x, y))) {
      spuriousAmb.push(f);
      continue;
    }
    if (opts.inPage && !opts.inPage(x, y)) k = 'surround';
    else if ((meta.markBoxes || []).some((b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]))
      k = 'registration mark';
    else if (
      (meta.textBoxes || []).some((b) => x >= b.box[0] && x <= b.box[2] && y >= b.box[1] && y <= b.box[3])
    )
      k = 'text';
    else if (
      hatched.has(tl) ||
      (meta.hazards || []).some((h) => h.kind === 'hatch' && inDisc(x, y, h.at, h.rad + 4))
    )
      k = 'hatch sliver';
    else if (stippled.has(tl)) k = 'stipple';
    else if (
      (meta.hazards || []).some((h) => h.kind === 'faintMark' && inDisc(x, y, h.at, h.sizeW * 1.3 + 6))
    )
      k = 'faint mark';
    else if (tl > 0 && col.has(tl)) k = 'coloured speck';
    else if (
      opts.edgeBand &&
      (x < opts.edgeBand || y < opts.edgeBand || x > W - opts.edgeBand || y > H - opts.edgeBand)
    )
      k = 'page edge';
    else if (area < 3 * app.minPx) k = 'speck';
    spuriousBy[k] = (spuriousBy[k] || 0) + 1;
  }
  // shattered: inside a hatch?
  const shatteredBy = {};
  for (const r of per.values())
    if (r.cls === 'defect:shattered' || r.cls === 'defect:coloured:lost:shattered') {
      const c = comps[r.dom] || {},
        k =
          hatched.has(r.t) ||
          (meta.hazards || []).some((h) => h.kind === 'hatch' && inDisc(c.cx, c.cy, h.at, h.rad + 4))
            ? 'hatch'
            : stippled.has(r.t)
              ? 'stipple'
              : r.col
                ? 'coloured'
                : 'other';
      shatteredBy[k] = (shatteredBy[k] || 0) + 1;
    }
  // the table round an unstraightened photo: how much of it counted sections cover, in how many pieces
  let surround = null;
  if (surroundL > 0) {
    let n = 0,
      c = 0;
    for (let p = 0; p < truth.length; p++)
      if (truth[p] === surroundL) {
        n++;
        if (found[p] >= 1 && counted.has(found[p])) c++;
      }
    surround = { countedShare: +(c / Math.max(1, n)).toFixed(4), pieces: spuriousBy.surround || 0 };
  }
  // adjacency: truth pairs (both sections matched) at two reaches vs the app's own adj
  const reachA = Math.max(2, Math.round(meta.lwW + 2)),
    reachB = Math.max(3, Math.round(Math.max(W, H) / 40));
  const tPairsA = truthPairs(truth, W, H, reachA),
    tPairsB = truthPairs(truth, W, H, reachB);
  const tf = new Map();
  for (const r of per.values()) if (r.kind === 'matched' && r.tag === 'drawing') tf.set(r.t, r.dom);
  const ft = new Map([...tf].map(([t, f]) => [f, t]));
  let tp = 0,
    fn = 0,
    fp = 0,
    fpairs = 0;
  for (const k of tPairsA) {
    const [a, b] = k.split(':').map(Number),
      fa = tf.get(a),
      fb = tf.get(b);
    if (!fa || !fb) continue;
    if (app.adj && app.adj[fa] && app.adj[fa].has(fb)) tp++;
    else fn++;
  }
  if (app.adj)
    for (const ka in app.adj) {
      const a = +ka;
      if (!ft.has(a)) continue;
      for (const b of app.adj[ka]) {
        if (b <= a || !ft.has(b)) continue;
        fpairs++;
        if (!tPairsB.has(key(ft.get(a), ft.get(b)))) fp++;
      }
    }
  const cnt = (b) => Object.fromEntries(Object.entries(B[b]).map(([k, v]) => [k, v.length]));
  const areaOf = (b) =>
    Object.fromEntries(
      Object.entries(B[b]).map(([k, v]) => [k, +v.reduce((s, r) => s + r.area, 0).toFixed(0)]),
    );
  const allArea = [...per.values()].reduce((s, r) => s + r.area, 0);
  const ious = [...per.values()]
    .filter((r) => r.kind === 'matched')
    .map((r) => r.iou)
    .sort((a, b) => a - b);
  // (the matched share: drawing sections, coloured ones included (kept, done or not, counts as matched; lost counts
  // against); near-tangent and info sections count neither way)
  const drawing = [...per.values()].filter((r) => r.tag === 'drawing');
  const clear = drawing.filter((r) => !r.amb && !r.cls.startsWith('info:')),
    nDrawingClear = clear.length,
    okCls = new Set(['correct:matched', 'correct:coloured:keptDone', 'feature:coloured:keptNotDone']);
  return {
    nScored: per.size,
    ignored,
    nDrawing: nDrawingClear,
    allArea: +allArea.toFixed(0),
    // (near-tangent sections are a don't-care: not in the share either way)
    matchedShare: nDrawingClear ? clear.filter((r) => okCls.has(r.cls)).length / nDrawingClear : 1,
    counts: {
      defect: cnt('defect'),
      correct: cnt('correct'),
      expected: cnt('expected'),
      info: cnt('info'),
      feature: cnt('feature'),
    },
    areas: {
      defect: areaOf('defect'),
      correct: areaOf('correct'),
      expected: areaOf('expected'),
      info: areaOf('info'),
      feature: areaOf('feature'),
    },
    defects: Object.values(B.defect).reduce((s, v) => s + v.length, 0),
    defectArea: +(
      Object.values(B.defect).reduce((s, v) => s + v.reduce((q, r) => q + r.area, 0), 0) /
      Math.max(1, allArea)
    ).toFixed(4),
    // (page spurious only: the table's pieces are in surround)
    spurious:
      spurious.length -
      spuriousAmb.length -
      (spuriousBy.surround || 0) -
      (spuriousBy['registration mark'] || 0),
    surround,
    spuriousNearTangent: spuriousAmb.length,
    // (opts.list: each defect, its class, its truth area in px at the page's scale and how much of it the truth's ink
    // covers, for looking into what a page loses)
    ...(opts.list
      ? {
          defectList: [...per.values()]
            .filter((r) => r.cls && r.cls.startsWith('defect'))
            .map((r) => ({ t: r.t, cls: r.cls, area: r.area, ink: +r.inkFrac.toFixed(2) })),
        }
      : {}),
    spuriousBy,
    mergedBy,
    shatteredBy,
    ambiguous: amb.size,
    ambiguousScored: [...per.values()].filter((r) => r.amb).length,
    iouMedian: ious.length ? +ious[ious.length >> 1].toFixed(3) : null,
    iouP10: ious.length ? +ious[Math.floor(ious.length * 0.1)].toFixed(3) : null,
    inkBloat: +(bloat / Math.max(1, paper)).toFixed(4),
    inkTruth: +(tInkPx / n).toFixed(4),
    inkFound: +(fInkPx / n).toFixed(4),
    adj: {
      reachA,
      reachB,
      appReach: reachB,
      recallA: +(tp / Math.max(1, tp + fn)).toFixed(3),
      tp,
      fn,
      falsePairs: fp,
      pairs: fpairs,
      precisionB: +((fpairs - fp) / Math.max(1, fpairs)).toFixed(3),
    },
    warn: {
      code: app.segWarn && app.segWarn.code ? app.segWarn.code : 'ok',
      faintOffer: !!app.faintOffer,
      hatched: !!(app.segWarn && app.segWarn.code === 'hatched'),
      coloured: !!(app.segWarn && app.segWarn.code === 'coloured'),
    },
    counted: counted.size,
    comps: comps.length - 1,
    minPx: app.minPx,
    _per: per,
    _spurious: spurious.filter((f) => !spuriousAmb.includes(f)),
  };
}

// truth pairs: two sections seen across at most `reach` px of ink/don't-care along rows and columns, at least 3 times
function truthPairs(truth, W, H, reach) {
  const seen = new Map(),
    out = new Set();
  const saw = (a, b) => {
    const k = key(a, b);
    seen.set(k, (seen.get(k) || 0) + 1);
  };
  for (let y = 0; y < H; y += 2) {
    let last = 0,
      end = -1e9;
    for (let x = 0; x < W; x++) {
      const l = truth[y * W + x];
      if (l < 1) continue;
      if (l !== last) {
        if (last && x - end <= reach) saw(last, l);
        last = l;
      }
      end = x;
    }
  }
  for (let x = 0; x < W; x += 2) {
    let last = 0,
      end = -1e9;
    for (let y = 0; y < H; y++) {
      const l = truth[y * W + x];
      if (l < 1) continue;
      if (l !== last) {
        if (last && y - end <= reach) saw(last, l);
        last = l;
      }
      end = y;
    }
  }
  for (const [k, c] of seen) if (c >= 3) out.add(k);
  return out;
}
