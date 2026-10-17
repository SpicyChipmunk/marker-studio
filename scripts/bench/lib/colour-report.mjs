// The colouring report (markdown): per family, per collection, TUNE and HELD side by side (scripts/bench).
const table = (head, body) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const f = (v, d = 1) => (isNaN(v) ? '–' : v.toFixed(d));
const pc = (v, d = 1) => (isNaN(v) ? '–' : (100 * v).toFixed(d) + '%');

export function colourReport(o) {
  const { rows, splits, drops, e2e, gates } = o,
    L = [];
  const sets = ['TUNE', 'HELD'].filter((s) => rows.some((r) => r.set === s));
  const of = (set, coll, row) => rows.filter((r) => r.set === set && r.coll === coll && r.row === row);
  L.push(`# Guide benchmark, stage B step 3: colouring on the true sections${o.quick ? ' (quick)' : ''}`, '');
  L.push(
    `${rows.length} builds, ${o.secs} s; digest ${o.digest}. Touching = seen across at most a line's width (+1 px); pair shares are weighted by the shared border's length. Rough = ΔE00 over 30, twin = under 2.5, close = under 10.`,
    '',
  );
  // gates
  L.push("## Gates (each should be 0; on the app's own adjacency, the pairs it promises about)", '');
  const byGate = {};
  for (const g of gates) {
    const k = g.gate.replace(/\(.*\)|\d+/g, '').trim();
    byGate[k] = (byGate[k] || 0) + 1;
  }
  L.push(
    Object.keys(byGate).length
      ? table(
          ['gate', 'failures'],
          Object.entries(byGate).map(([k, v]) => [k, v]),
        )
      : 'All pass: every build deterministic; Random never gives touching sections the same marker or twins; with "keep touching sections clearly different" no touching pair is under ΔE 10; the Gradient makes no twins at the neutral mood.',
    '',
  );
  if (gates.length)
    L.push(
      'First failures: ' +
        gates
          .slice(0, 8)
          .map((g) => `${g.set} ${g.id} ${g.coll} ${g.row} s${g.seed}: ${g.gate}`)
          .join('; ') +
        '.',
      '',
    );
  for (const coll of o.colls) {
    const gradRows = [
      ...new Set(rows.filter((r) => r.coll === coll && r.fam === 'gradient').map((r) => r.row)),
    ];
    L.push(`## Gradient on ${coll}`, '');
    L.push(
      "Rough share (border-weighted) · rough pairs a page (the app's own count, on its adjacency) · mean ΔE between consecutive sections of the build's order where the marker changes · markers used / the limit (the pool it chose from) · evenness (Gini of sections per marker; 0 = even).",
      '',
    );
    L.push(
      table(
        ['setting', ...sets],
        gradRows.map((row) => [
          row,
          ...sets.map((s) => {
            const q = of(s, coll, row);
            return q.length
              ? `${pc(mean(q.map((r) => r.strict.wRough)))} · ${f(mean(q.map((r) => r.strict.rough)), 0)} (${f(mean(q.map((r) => r.appRough || 0)), 0)}) · ${f(mean(q.map((r) => r.flow.meanDE)))} · ${f(mean(q.map((r) => r.used)), 1)}/${q[0].limitN} (${f(mean(q.map((r) => r.poolN || 0)), 0)}) · ${f(mean(q.map((r) => r.giniN)), 2)}`
              : '–';
          }),
        ]),
      ),
      '',
    );
    const randRows = [
      ...new Set(rows.filter((r) => r.coll === coll && r.fam === 'random').map((r) => r.row)),
    ];
    L.push(`## Random on ${coll}`, '');
    L.push(
      'Close pairs (under ΔE 10) a page · rough share (lively, not a fault) · markers used / the limit (the pool it chose from; No repeats ignores the limit by design) · evenness · Balance: largest miss against its 60/30/10 aim.',
      '',
    );
    L.push(
      table(
        ['setting', ...sets],
        randRows.map((row) => [
          row,
          ...sets.map((s) => {
            const q = of(s, coll, row);
            if (!q.length) return '–';
            const bal = q.filter((r) => r.balance);
            return `${f(mean(q.map((r) => r.strict.low)), 1)} · ${pc(mean(q.map((r) => r.strict.wRough)))} · ${f(mean(q.map((r) => r.used)), 1)}/${q[0].limitN} (${f(mean(q.map((r) => r.poolN || 0)), 0)}) · ${f(mean(q.map((r) => r.giniN)), 2)}${bal.length ? ` · miss ${pc(mean(bal.map((r) => r.balance.miss)), 0)}` : ''}`;
          }),
        ]),
      ),
      '',
    );
    const blendRows = [
      ...new Set(rows.filter((r) => r.coll === coll && r.fam === 'blend').map((r) => r.row)),
    ];
    L.push(`## Blend on ${coll}`, '');
    L.push(
      table(
        ['setting', ...sets.map((s) => `${s}: rough share · used · evenness (uneven by design)`)],
        blendRows.map((row) => [
          row,
          ...sets.map((s) => {
            const q = of(s, coll, row);
            return q.length
              ? `${pc(mean(q.map((r) => r.strict.wRough)))} · ${f(mean(q.map((r) => r.used)), 1)} · ${f(mean(q.map((r) => r.giniN)), 2)}`
              : '–';
          }),
        ]),
      ),
      '',
    );
  }
  // moods
  const moodRows = rows.filter((r) => r.mood);
  if (moodRows.length) {
    L.push('## Moods: share of the markers used inside the mood, against what the pool allows', '');
    const keys = [...new Set(moodRows.map((r) => r.coll + '|' + r.row))];
    L.push(
      table(
        ['collection', 'setting', ...sets],
        keys.map((k) => {
          const [coll, row] = k.split('|');
          return [
            coll,
            row,
            ...sets.map((s) => {
              const q = of(s, coll, row).filter((r) => r.mood);
              return q.length
                ? `${pc(mean(q.map((r) => r.mood.adherence)), 0)} of ${pc(mean(q.map((r) => r.mood.achievable)), 0)} (pool ${f(mean(q.map((r) => r.mood.poolIn)), 0)})`
                : '–';
            }),
          ];
        }),
      ),
      '',
    );
    const tw = moodRows.filter((r) => r.fam === 'gradient' && r.strict.twin);
    L.push(
      `Gradient twins at a mood (not gated; the mood's pool can hold near-identical markers): ${tw.length} of ${moodRows.filter((r) => r.fam === 'gradient').length} builds, ${tw.reduce((s, r) => s + r.strict.twin, 0)} touching pairs; near-identical pairs among the markers picked: ${moodRows.filter((r) => r.fam === 'gradient').reduce((s, r) => s + (r.usedTwins || 0), 0)}.`,
      '',
    );
  }
  // stability
  L.push('## Stability', '');
  const dk = [...new Set(drops.map((d) => d.row))];
  L.push(
    'A fresh lay after one mid-sized section is left out: share of the other sections whose marker changes (a property of each family, not a fault).',
    '',
  );
  L.push(
    table(
      ['family', ...sets],
      dk.map((row) => [
        row,
        ...sets.map((s) => {
          const q = drops.filter((d) => d.set === s && d.row === row);
          return q.length ? pc(mean(q.map((d) => d.changed / Math.max(1, d.of))), 0) : '–';
        }),
      ]),
    ),
    '',
  );
  const sk = [...new Set(splits.map((d) => d.row))];
  L.push(
    "Splitting a section and building with the guide kept (Edit sections, then Build): other sections changed and the old half keeping its marker (gates), then the new parts against their kept neighbours (on the app's own adjacency).",
    '',
  );
  L.push(
    table(
      ['family', ...sets],
      sk.map((row) => [
        row,
        ...sets.map((s) => {
          const q = splits.filter((d) => d.set === s && d.row === row && d.divided);
          if (!q.length) return '–';
          const nb = q.reduce((a, d) => a + d.nb, 0);
          return `${q.length} splits · others changed ${q.reduce((a, d) => a + d.othersChanged, 0)} · old kept ${q.filter((d) => d.oldKept).length}/${q.length} · vs ${nb} neighbours: same ${q.reduce((a, d) => a + d.same, 0)}, twin ${q.reduce((a, d) => a + d.twin, 0)}, rough ${q.reduce((a, d) => a + d.rough, 0)}`;
        }),
      ]),
    ),
    '',
  );
  // end to end
  if (e2e.length) {
    L.push(
      "## End to end: the same build on the app's own sections (clean 1200, Honolulu 24) against the true ones",
      '',
    );
    const ek = [...new Set(e2e.map((d) => d.row))];
    L.push(
      table(
        ['family', ...sets],
        ek.map((row) => [
          row,
          ...sets.map((s) => {
            const q = e2e.filter((d) => d.set === s && d.row === row && d.truth);
            return q.length
              ? `sections ${f(mean(q.map((d) => d.app.N)), 0)} vs ${f(mean(q.map((d) => d.truth.N)), 0)} · rough ${pc(mean(q.map((d) => d.app.strict.wRough)))} vs ${pc(mean(q.map((d) => d.truth.strict.wRough)))} · same ${pc(mean(q.map((d) => d.app.strict.wSame)))} vs ${pc(mean(q.map((d) => d.truth.strict.wSame)))}`
              : '–';
          }),
        ]),
      ),
      '',
    );
  }
  // what the app's adjacency misses: Random's promise kept on the app's pairs, broken on the eye's
  {
    const rr = rows.filter((r) => r.fam === 'random');
    const miss = (s) => rr.filter((r) => r.set === s && r.strict.same6 > r.app.same);
    L.push("## Touching sections the app doesn't know touch", '');
    L.push(
      "Random builds where sections touching along 6 px or more (the app's own floor: it looks across every other row and column and needs 3 sightings) share a marker though the app's adjacency has none. Shorter touches are below what its look across is built to see (review B1: all the 3-5 px ones on the dense pages), so they aren't counted here.",
      '',
    );
    L.push(
      table(
        ['', ...sets],
        [
          [
            'builds with such a pair',
            ...sets.map((s) => `${miss(s).length} of ${rr.filter((r) => r.set === s).length}`),
          ],
          ['pairs', ...sets.map((s) => miss(s).reduce((a, r) => a + r.strict.same6 - r.app.same, 0))],
          [
            'pages (most first)',
            ...sets.map((s) => {
              const c = {};
              for (const r of miss(s)) c[r.id] = (c[r.id] || 0) + 1;
              return (
                Object.entries(c)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(', ') || '–'
              );
            }),
          ],
        ],
      ),
      '',
    );
  }
  // adjacency: the app's vs the eye's
  L.push("## The app's idea of touching against the eye's", '');
  L.push(
    table(
      ['', ...sets],
      [
        [
          'touching pairs a page (app / strict)',
          ...sets.map((s) => {
            const q = rows.filter((r) => r.set === s && r.row === 'random mixed');
            return q.length
              ? `${f(mean(q.map((r) => r.app.pairs)), 0)} / ${f(mean(q.map((r) => r.strict.pairs)), 0)}`
              : '–';
          }),
        ],
        [
          '"keep touching sections clearly different": close pairs left, strict (the app doesn\'t see them)',
          ...sets.map((s) => {
            const q = rows.filter((r) => r.set === s && r.row === 'random noAdj');
            return q.length
              ? `${f(
                  q.reduce((a, r) => a + r.strict.low, 0),
                  0,
                )} in ${q.length} builds`
              : '–';
          }),
        ],
      ],
    ),
    '',
  );
  L.push(`A/B pairs written for session 1 (Gradient rough steps): ${o.abPairs}.`, '');
  return L.join('\n') + '\n';
}
