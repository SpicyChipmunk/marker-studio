// The benchmark's report (markdown): TUNE and HELD side by side, never pooled (scripts/bench).
const pct = (v, d = 1) => (v == null || isNaN(v) ? '–' : (100 * v).toFixed(d) + '%');
const sum = (a, f) => a.reduce((s, r) => s + f(r), 0);
const top = (obj, n = 3) =>
  Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ') || '–';
const merge = (rows, f) => {
  const o = {};
  for (const r of rows) for (const [k, v] of Object.entries(f(r) || {})) o[k] = (o[k] || 0) + v;
  return o;
};
const table = (head, body) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');

export function report(rows, o) {
  const L = [];
  const by = (f) => rows.filter(f);
  const sets = ['TUNE', 'HELD'].filter((s) => rows.some((r) => r.set === s));
  const cell = (rs) => {
    if (!rs.length) return '–';
    const d = sum(rs, (r) => r.defects),
      a =
        sum(rs, (r) => r.defectArea * r.allArea) /
        Math.max(
          1,
          sum(rs, (r) => r.allArea),
        );
    // (matched: the mean of the pages' shares, so a 2,800-cell mosaic doesn't outvote a neurographic page)
    return `${pct(sum(rs, (r) => r.matchedShare) / rs.length)} · ${d} (${pct(a)}) · ${sum(rs, (r) => r.spurious)}`;
  };
  L.push(
    `# Guide benchmark, stage A${o.quick ? ' (quick)' : ''}`,
    '',
    `${rows.length} runs, ${o.secs} s; digest ${o.digest} (the same numbers give the same digest).`,
    '',
  );
  L.push(
    "Cells read **matched share of drawing sections (the mean over pages; info classes count neither way) · defects (their share of the page area) · spurious counted sections**. Defects are classes wrong by Ben's answers (merged, split, shattered, an edge region lost to the background, missed, a coloured section lost); a frame's paper left out is expected; near-tangent regions (and found sections inside them), sections just under Min section size and margin pieces given a marker (a question for Ben) are info; a coloured section kept but not marked done is a missing feature, on its own row.",
    '',
  );

  // 1. clean 1200, page by page, paired by number
  const c12 = by((r) => r.kind === 'clean' && r.size === 1200);
  if (c12.length) {
    L.push('## 1. Clean pages at 1200 px (as downloaded or scanned; Sensitivity 9)', '');
    const n = Math.max(...c12.map((r) => +r.id.slice(1, 3)));
    const body = [];
    for (let i = 1; i <= n; i++) {
      const pair = sets.map((s) => c12.find((r) => r.set === s && +r.id.slice(1, 3) === i));
      if (!pair.some(Boolean)) continue;
      body.push([
        pair.find(Boolean).family,
        ...pair.flatMap((r) =>
          r
            ? [r.id.slice(4), cell([r]), top(r.counts.defect), r.warn.code === 'ok' ? '' : r.warn.code]
            : ['–', '–', '–', ''],
        ),
      ]);
    }
    body.push([
      '**all**',
      ...sets.flatMap((s) => [
        '',
        cell(c12.filter((r) => r.set === s)),
        top(
          merge(
            c12.filter((r) => r.set === s),
            (r) => r.counts.defect,
          ),
          4,
        ),
        '',
      ]),
    ]);
    L.push(
      table(
        ['family', ...sets.flatMap((s) => [s, 'matched · defects · spurious', 'main defects', 'warning'])],
        body,
      ),
      '',
    );
  }
  // 2. sizes
  const clean = by((r) => r.kind === 'clean');
  const sizes = [...new Set(clean.map((r) => r.size))].sort((a, b) => a - b);
  if (sizes.length > 1) {
    L.push(
      '## 2. By size (every page, clean, Sensitivity 9; 400–800 are enlarged by the app to 1600 on the long side; 2400 is held at 1800 × 2400)',
      '',
    );
    const body = sizes.map((s) => [
      s,
      ...sets.flatMap((st) => {
        const rs = clean.filter((r) => r.set === st && r.size === s);
        return [
          cell(rs),
          pct(sum(rs, (r) => r.inkBloat) / Math.max(1, rs.length)),
          sum(rs, (r) => r.counts.info.tinyDropped || 0),
          top(
            merge(rs, (r) => r.counts.defect),
            3,
          ),
        ];
      }),
    ]);
    L.push(
      table(
        [
          'width',
          ...sets.flatMap((s) => [`${s}`, 'ink bloat', 'just under Min size (info)', 'main defects']),
        ],
        body,
      ),
      '',
    );
    // style x size below 90 % matched, or ambiguity over 2 %
    const flag = clean
      .filter((r) => r.matchedShare < 0.9)
      .map((r) => `${r.set} ${r.id} @${r.size}: ${pct(r.matchedShare)}`);
    L.push(`Style × size under 90% matched (to show Ben): ${flag.length ? flag.join('; ') : 'none'}.`, '');
  }
  const amb = [
    ...new Map(
      clean
        .filter((r) => r.ambiguousTruth > 0.02 * r.nTruth)
        .map((r) => [r.set + r.id + r.size, `${r.id} @${r.size}: ${r.ambiguousTruth} of ${r.nTruth}`]),
    ).values(),
  ];
  L.push(
    `Truth regions flagged ambiguous (near-tangent or pockets) over 2% of a page's: ${amb.length ? amb.join('; ') : 'none'}.`,
    '',
  );
  // 3. defect classes and causes
  const scope = clean.length ? clean : rows;
  L.push('## 3. Classes and causes (every clean run, all sizes)', '');
  const classes = [
    ...new Set(
      scope.flatMap((r) =>
        Object.keys(r.counts.defect)
          .map((k) => 'defect:' + k)
          .concat(
            Object.keys(r.counts.expected).map((k) => 'expected:' + k),
            Object.keys(r.counts.feature || {}).map((k) => 'feature:' + k),
            Object.keys(r.counts.info).map((k) => 'info:' + k),
          ),
      ),
    ),
  ].sort();
  L.push(
    table(
      ['class', ...sets],
      classes.map((c) => {
        const [b, ...k] = c.split(':'),
          kk = k.join(':');
        return [
          c,
          ...sets.map((s) =>
            sum(
              scope.filter((r) => r.set === s),
              (r) => (r.counts[b] || {})[kk] || 0,
            ),
          ),
        ];
      }),
    ),
    '',
  );
  L.push(
    table(
      ['', ...sets],
      [
        [
          'merge joins by cause (a group of n merged sections is n − 1 joins)',
          ...sets.map((s) =>
            top(
              merge(
                scope.filter((r) => r.set === s),
                (r) => r.mergedBy,
              ),
              6,
            ),
          ),
        ],
        [
          'spurious by cause',
          ...sets.map((s) =>
            top(
              merge(
                scope.filter((r) => r.set === s),
                (r) => r.spuriousBy,
              ),
              7,
            ),
          ),
        ],
        [
          'shattered by cause',
          ...sets.map((s) =>
            top(
              merge(
                scope.filter((r) => r.set === s),
                (r) => r.shatteredBy,
              ),
              3,
            ),
          ),
        ],
      ],
    ),
    '',
  );
  // 4. warnings next to the hazards they are meant to catch
  L.push('## 4. Do the warnings fire where they should? (clean runs)', '');
  const w = (hz, f) =>
    sets.map((s) => {
      const rs = scope.filter((r) => r.set === s && r.hazards.includes(hz));
      return rs.length ? `${rs.filter(f).length} of ${rs.length}` : '–';
    });
  L.push(
    table(
      ['hazard', 'warning', ...sets],
      [
        ['faint lines / marks', 'Ignore faint offer', ...w('faintLine', (r) => r.warn.faintOffer)],
        ['hatching', '"hatched"', ...w('hatch', (r) => r.warn.hatched)],
        ['partly coloured', '"coloured"', ...w('coloured', (r) => r.warn.coloured)],
      ],
    ),
    '',
  );
  // 5. Sensitivity 6 and JPEG'd downloads
  const s6 = by((r) => r.kind === 'sens6'),
    dj = by((r) => r.kind === 'dljpeg');
  if (s6.length || dj.length) {
    L.push('## 5. Sensitivity 6, and downloads saved as JPEG', '');
    const body = [];
    for (const s of [...new Set(s6.map((r) => r.size))])
      body.push(
        [`Sensitivity 9 @${s}`, ...sets.map((st) => cell(clean.filter((r) => r.set === st && r.size === s)))],
        [`Sensitivity 6 @${s}`, ...sets.map((st) => cell(s6.filter((r) => r.set === st && r.size === s)))],
      );
    for (const q of [...new Set(dj.map((r) => r.size + '@' + r.q))]) {
      const [s, qq] = q.split('@');
      const ids = new Set(dj.filter((r) => r.size === +s && r.q === +qq).map((r) => r.id));
      body.push(
        [
          `${s} lossless (same pages)`,
          ...sets.map((st) => cell(clean.filter((r) => r.set === st && r.size === +s && ids.has(r.id)))),
        ],
        [
          `${s} JPEG q ${qq}`,
          ...sets.map((st) => cell(dj.filter((r) => r.set === st && r.size === +s && r.q === +qq))),
        ],
      );
    }
    L.push(table(['', ...sets], body), '');
  }
  // 6. photos: the finder, then classes photo vs clean
  const ph = by((r) => r.kind === 'photo');
  if (ph.length) {
    L.push(
      '## 6. Photos (1800 × 2400 on a table, JPEG q 0.9): the page finder',
      '',
      "Aspect error with the lens known is near zero by construction (the photos are made with the same pinhole and the same 25 mm convention the app assumes); the no-lens column is the honest one. A curled edge pins its corners in this model and bows the edge in, so the curl rows' corner error is partly the model's.",
      '',
    );
    const f25 = ph.filter((r) => r.variant === 'f35-25');
    L.push(
      table(
        [
          'set',
          'page',
          'level',
          'table',
          'tier',
          'corner error (% diag)',
          'aspect error, lens known',
          'aspect error, no lens (shape)',
          'working size',
        ],
        f25.map((r) => {
          const z = ph.find(
            (x) => x.set === r.set && x.id === r.id && x.level === r.level && x.variant === 'f35-0',
          );
          return [
            r.set,
            r.id,
            r.level,
            r.bg || '–',
            r.finder.tier + (r.finder.why ? ` (${r.finder.why})` : ''),
            r.finder.cornerErr == null ? '–' : r.finder.cornerErr + '%',
            r.finder.aspectErr == null ? '–' : r.finder.aspectErr + '%',
            z && z.finder.aspectErr != null ? `${z.finder.aspectErr}% (${z.finder.shape})` : '–',
            `${r.W} × ${r.H}`,
          ];
        }),
      ),
      '',
    );
    L.push(
      "## 7. Photos: sections as the app goes (lens known: straightened when sure; unsure rows use the finder's corners as the corner editor offers them; none = as taken), and as taken, against the same page clean at 1200",
      '',
    );
    L.push(
      table(
        [
          'set',
          'page',
          'level',
          'clean 1200',
          'path',
          'photo',
          'photo defects',
          'photo spurious by cause',
          'as taken (findPage)',
          'as taken: table under counted sections (pieces)',
        ],
        f25.map((r) => {
          const c = c12.find((x) => x.set === r.set && x.id === r.id),
            nn = ph.find(
              (x) => x.set === r.set && x.id === r.id && x.level === r.level && x.variant === 'none',
            );
          return [
            r.set,
            r.id,
            r.level,
            c ? cell([c]) : '–',
            r.path,
            cell([r]),
            top(r.counts.defect, 4),
            top(r.spuriousBy, 4),
            nn ? cell([nn]) : '–',
            nn && nn.surround ? `${pct(nn.surround.countedShare)} (${nn.surround.pieces})` : '–',
          ];
        }),
      ),
      '',
    );
  }
  // 8. adjacency
  const adjRows = [
    ['clean 1200', c12],
    ['photos (straightened)', ph.filter((r) => r.variant === 'f35-25')],
  ].filter(([, rs]) => rs.length);
  if (adjRows.length) {
    L.push(
      "## 8. Which sections touch: truth at a line width (reach A) vs the app's own reach (max(W, H)/40)",
      '',
    );
    L.push(
      table(
        [
          '',
          ...sets.flatMap((s) => [`${s} recall at A`, `${s} pairs the app adds beyond its reach in truth`]),
        ],
        adjRows.map(([n, rs]) => [
          n,
          ...sets.flatMap((s) => {
            const q = rs.filter((r) => r.set === s);
            const tp = sum(q, (r) => r.adj.tp),
              fn = sum(q, (r) => r.adj.fn),
              fp = sum(q, (r) => r.adj.falsePairs),
              pr = sum(q, (r) => r.adj.pairs);
            return [pct(tp / Math.max(1, tp + fn)), `${fp} of ${pr}`];
          }),
        ]),
      ),
      '',
    );
  }
  return L.join('\n') + '\n';
}
