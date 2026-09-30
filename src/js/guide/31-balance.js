/* ---- Random's Balance (v283) ----
    Random lays its markers one of two ways (Pattern › Random › Balance):
    Mixed ('mixed'): as Random always has, a random marker of the pool for each section (buildRandom); with No
      repeats (noRep) every marker is used once before any is used twice, repeats as far apart as they can be
      (buildNoRep), from as many markers as there are sections.
    Main colour ('main'): three roles, each a colour family of the markers you can use: a main colour over about
      60% of the picture, a second over 30% and an accent over 10% (by area, so big sections count for more). The
      marker count is shared about half, a third and one or two accents, each role's markers spread from light to
      dark (and nearer the middle with shading on, so there are lighter and darker companions for its tones). The
      accents go on middling sections spread over the picture, never the biggest nor slivers too small to colour.
    Colour families go by how a marker looks (BAL_FAM: its hue as the eye sees it; browns and beiges, and greys, by
    their own), not by its code. A role's family with too few markers borrows the nearest in hue from next to it;
    one role that can't be filled leaves two (70/30); a picture with no family of three markers is laid Mixed.
    Auto picks the roles: the main colour a family of the Temperature's (any, once a role is chosen by hand), the
    accent the one most across the colour wheel from it with bright markers (by lightness with the Pastel mood), the
    second one next to the main one (or browns with a warm one). balSeed (Other pairings) picks among the good
    choices. From a saved or generated palette the roles are its own families, biggest first.
    Pinned sections keep their marker, and count towards its role's share. Keep touching sections clearly different
    holds within each role, among its markers. */
const BAL_FAM = {
  pink: { n: 'Pinks', w: 'pink', h: 350 },
  red: { n: 'Reds', w: 'red', h: 18 },
  orange: { n: 'Oranges', w: 'orange', h: 53 },
  yellow: { n: 'Yellows', w: 'yellow', h: 89 },
  ygreen: { n: 'Yellow-greens', w: 'yellow-green', h: 121 },
  green: { n: 'Greens', w: 'green', h: 150 },
  teal: { n: 'Teals', w: 'teal', h: 192 },
  blue: { n: 'Blues', w: 'blue', h: 250 },
  violet: { n: 'Violets', w: 'violet', h: 305 },
  brown: { n: 'Browns', w: 'brown', h: 50 },
  grey: { n: 'Greys', w: 'grey', h: -1 },
};
// the order they're offered in (round the colour wheel, then browns and greys); the hue (Oklab's, balHue) each
// family starts at
const BAL_ORDER = [
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
  ],
  BAL_BINS = [
    [3, 'red'],
    [38, 'orange'],
    [68, 'yellow'],
    [113, 'ygreen'],
    [130, 'green'],
    [170, 'teal'],
    [215, 'blue'],
    [282, 'violet'],
    [330, 'pink'],
  ],
  BAL_COOL = { ygreen: 1, green: 1, teal: 1, blue: 1, violet: 1 },
  // the least of each role's markers (main, second, accent)
  BAL_MIN = { m: 3, s: 2, a: 1 },
  BAL_ROLE = { m: 'Main colour', s: 'Second colour', a: 'Accent' };
// a marker's hue as Oklab has it: the families go by it, as it keeps blues and violets apart where CIELAB's hue
// runs saturated blues (Copic B29, 298° in CIELAB) in among the violets (V09, 310°); in Oklab they're 264° and 296°
const _balHue = new WeakMap();
function balHue(m) {
  let h = _balHue.get(m);
  if (h !== undefined) return h;
  const c = hexRgb(m.hex).map(function (v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
    l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]),
    q = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]),
    s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]),
    A = 1.9779984951 * l - 2.428592205 * q + 0.4505937099 * s,
    B = 0.0259040371 * l + 0.7827717662 * q - 0.808675766 * s;
  h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  _balHue.set(m, h);
  return h;
}
const _balFam = new WeakMap();
// a marker's colour family, by how it looks
function balFamOf(m) {
  let f = _balFam.get(m);
  if (f) return f;
  // (browns and beiges by CIELAB's lightness and chroma, dull warm ones; the rest by their Oklab hue)
  const x = mLch(m),
    L = x[0],
    C = x[1],
    h = x[2],
    oh = balHue(m);
  if (thinGreyM(m)) f = 'grey';
  else if (h >= 15 && h < 100 && ((L < 72 && C < 52) || (L < 95 && C < 30 && h >= 40))) f = 'brown';
  else {
    f = 'pink';
    for (let i = 0; i < BAL_BINS.length; i++) if (oh >= BAL_BINS[i][0]) f = BAL_BINS[i][1];
    if (oh < BAL_BINS[0][0]) f = 'pink';
  }
  _balFam.set(m, f);
  return f;
}
// how far apart two families are round the colour wheel (greys are near everything)
function balDist(a, b) {
  if (a === 'grey' || b === 'grey') return 60;
  return hueDiff(BAL_FAM[a].h, BAL_FAM[b].h);
}
function balWarm(k) {
  return !BAL_COOL[k] && k !== 'grey';
}
// the markers Balance chooses from: a saved or generated palette's (with nearby ones when Expand is on), else every
// marker you can use (your filters); the Temperature only steers Auto, so an accent can be the other temperature
function balBase() {
  if (paletteSource === 'saved' || paletteSource === 'generate') {
    const s = poolSource(limitN, true);
    if (s.seeded) return { items: s.items, seeded: true };
  }
  return { items: poolFor('all'), seeded: false };
}
function balGroups(items) {
  const g = {};
  items.forEach(function (m) {
    const f = balFamOf(m);
    (g[f] = g[f] || []).push(m);
  });
  return g;
}
// pick one of `list` ([key, weight]) with rnd, heavier ones likelier; null for an empty list
function balWeighted(list, rnd) {
  let t = 0;
  list.forEach(function (x) {
    t += x[1];
  });
  if (!(t > 0)) return list.length ? list[0][0] : null;
  let r = rnd() * t;
  for (let i = 0; i < list.length; i++) {
    r -= list[i][1];
    if (r <= 0) return list[i][0];
  }
  return list[list.length - 1][0];
}
// a role's markers from family k: its own, and (with fewer than min) the nearest in hue from next to it, never
// ones another role has (used). { list, borrowed: { family: count } }, or null when even that is too few
function balTake(k, min, groups, used) {
  const own = (groups[k] || []).filter(function (m) {
      return !used[m.mkey];
    }),
    borrowed = {};
  if (own.length >= min || k === 'grey') return own.length >= min ? { list: own, borrowed: borrowed } : null;
  const h = BAL_FAM[k].h,
    near = [];
  for (const f in groups) {
    if (f === k || f === 'grey') continue;
    groups[f].forEach(function (m) {
      if (used[m.mkey]) return;
      const x = mLch(m),
        d = hueDiff(balHue(m), h);
      // (browns borrow dull warm ones; the rest the nearest in hue, within half a family either side)
      if (k === 'brown' ? x[1] < 60 && d < 40 : f !== 'brown' && d < 48) near.push([d, m, f]);
    });
  }
  near.sort(function (a, b) {
    return a[0] - b[0];
  });
  const list = own.slice();
  for (let i = 0; i < near.length && list.length < min; i++) {
    list.push(near[i][1]);
    borrowed[near[i][2]] = (borrowed[near[i][2]] || 0) + 1;
  }
  return list.length >= min ? { list: list, borrowed: borrowed } : null;
}
// how many markers each role gets from the marker count n (roles: which of m, s, a there are)
function balCounts(n, roles) {
  const c = { m: 0, s: 0, a: 0 };
  if (roles.a) c.a = n >= 10 ? 2 : 1;
  if (roles.s) c.s = Math.max(BAL_MIN.s, Math.round((n - c.a) * (roles.a ? 0.38 : 0.3)));
  c.m = Math.max(BAL_MIN.m, n - c.a - c.s);
  return c;
}
// k markers of a role, spread from light to dark: the Mood's first (widened to the nearest when too few), nearer the
// middle with shading on; an accent's the brightest (with the Pastel mood, the ones whose lightness stands out most
// from the main colour's)
function balPick(list, k, accent, mainL) {
  let l = moodPick(list, emphasis, k, mLch).items;
  if (accent) {
    l = l.slice().sort(function (a, b) {
      return emphasis === 'pastel'
        ? Math.abs(mLch(b)[0] - mainL) - Math.abs(mLch(a)[0] - mainL)
        : mLch(b)[1] - mLch(a)[1];
    });
    l = l.slice(0, Math.max(k, Math.min(l.length, k * 3)));
  } else if (shadeMode !== 'off') {
    const mid = l.filter(function (m) {
      const L = mLch(m)[0];
      return L >= 30 && L <= 85;
    });
    if (mid.length >= k) l = mid;
  }
  return evenPick(
    l.slice().sort(function (a, b) {
      return mLch(a)[0] - mLch(b)[0];
    }),
    k,
  );
}
/* The roles for the live settings: { ok, roles: { m, s, a } each { k, list (the markers it may use), markers (the
   ones it uses), borrowed, share } or null, used (markers in all), want (the count asked), seeded, min (each role's
   least), small (too few sections for an accent), tempMiss (no family of the Temperature's could be the main colour),
   crossTemp, groups, why }. ok false (why says) when there's no family for a main colour. */
function balPlan() {
  const base = balBase(),
    // (a palette is used whole, so its colours need fewer markers of their own: the rest join them)
    MIN = base.seeded ? { m: 2, s: 1, a: 1 } : BAL_MIN,
    groups = balGroups(base.items),
    rnd = seededRandom((balSeed || 0) * 0.999 + 0.0005),
    hand = {
      m: balM !== 'auto' ? balM : null,
      s: balS !== 'auto' ? balS : null,
      a: balA !== 'auto' ? balA : null,
    },
    anyHand = !!(hand.m || hand.s || hand.a),
    size = function (k) {
      return groups[k] ? groups[k].length : 0;
    },
    fams = BAL_ORDER.filter(function (k) {
      return size(k) > 0;
    }),
    // (a zone of fewer than 10 sections has no room for an accent of its own)
    small = !!comps && zoneList().length < 10,
    want = limitN,
    taken = {},
    _via = {},
    // can family k fill a role of `min` markers (borrowing if it must)?
    viable = function (k, min) {
      const key = k + min;
      if (!(key in _via)) _via[key] = !!balTake(k, min, groups, {});
      return _via[key];
    };
  // (a family chosen for two roles, as a zone copied from another can have: the later one goes back to Auto)
  ['m', 'a', 's'].forEach(function (r) {
    if (hand[r] && (taken[hand[r]] || (r === 'a' && hand[r] === 'grey'))) hand[r] = null;
    if (hand[r]) taken[hand[r]] = 1;
  });
  // the main colour: a family of the Temperature's (any, when none of those can be), those with three of their own
  // likelier than those that borrow; from a palette its biggest colour
  let m = hand.m,
    tempMiss = false;
  if (!m) {
    const temp = !base.seeded && !anyHand && (palette === 'cool' || palette === 'warm') ? palette : null,
      cands = function (t) {
        let c = fams.filter(function (k) {
          return (
            k !== 'grey' &&
            !taken[k] &&
            viable(k, MIN.m) &&
            (!t || (t === 'cool' ? !!BAL_COOL[k] : balWarm(k)))
          );
        });
        if (base.seeded) {
          const top = Math.max.apply(null, c.map(size).concat([0]));
          c = c.filter(function (k) {
            return size(k) === top;
          });
        }
        return c.map(function (k) {
          return [k, base.seeded ? 1 : Math.sqrt(size(k)) * (size(k) >= MIN.m ? 3 : 1)];
        });
      };
    let c = cands(temp);
    if (!c.length && temp) {
      c = cands(null);
      tempMiss = c.length > 0;
    }
    m = balWeighted(c, rnd);
  }
  if (!m)
    return { ok: false, why: 'none', want: want, seeded: base.seeded, roles: {}, groups: groups, min: MIN };
  // the accent: across the colour wheel from the main colour (at least 120° if any is, else 100°; any colour at all
  // for greys), with bright markers
  let a = hand.a;
  if (!a && !small) {
    const bright = function (k) {
        return groups[k].filter(function (x) {
          return emphasis === 'pastel' || mLch(x)[1] >= 35;
        }).length;
      },
      opts = function (far) {
        return fams
          .filter(function (k) {
            return (
              k !== 'grey' &&
              k !== 'brown' &&
              k !== m &&
              !taken[k] &&
              (m === 'grey' || balDist(k, m) >= far) &&
              bright(k) > 0
            );
          })
          .map(function (k) {
            const d = m === 'grey' ? 40 : balDist(k, m) - far + 20;
            return [k, d * d * Math.sqrt(bright(k))];
          });
      },
      far = opts(120);
    a = balWeighted(far.length ? far : opts(100), rnd);
  }
  if (small) a = null;
  // the second: next to the main colour (browns with a warm one; any with greys), else any left
  let s = hand.s;
  if (!s) {
    const cands = fams
      .filter(function (k) {
        return k !== 'grey' && k !== m && k !== a && !taken[k] && viable(k, MIN.s);
      })
      .map(function (k) {
        const d = balDist(k, m);
        return [
          k,
          (base.seeded ? size(k) : 1) *
            (m === 'grey'
              ? Math.sqrt(size(k))
              : k === 'brown'
                ? balWarm(m)
                  ? 3
                  : 0.1
                : d <= 40
                  ? 6
                  : d <= 75
                    ? 4
                    : d < 110
                      ? 0.15
                      : 0.02),
        ];
      });
    s = balWeighted(cands, rnd);
  }
  // each role's markers, the main colour's first
  const used = {},
    roles = { m: null, s: null, a: null },
    mt = balTake(m, MIN.m, groups, used);
  if (!mt)
    return {
      ok: false,
      why: 'thin',
      fam: m,
      want: want,
      seeded: base.seeded,
      roles: {},
      groups: groups,
      min: MIN,
    };
  const has = { a: false, s: false },
    tk = { m: mt };
  mt.list.forEach(function (x) {
    used[x.mkey] = 1;
  });
  if (a) {
    const t = balTake(a, MIN.a, groups, used);
    if (t) {
      tk.a = t;
      has.a = true;
      t.list.forEach(function (x) {
        used[x.mkey] = 1;
      });
    }
  }
  if (s) {
    const t = balTake(s, MIN.s, groups, used);
    if (t) {
      tk.s = t;
      has.s = true;
    }
  }
  const n = Math.max(want, MIN.m + (has.s ? MIN.s : 0) + (has.a ? MIN.a : 0)),
    cnt = balCounts(n, has),
    two = !(has.s && has.a),
    share = two ? { m: 0.7, s: has.s ? 0.3 : 0, a: has.a ? 0.3 : 0 } : { m: 0.6, s: 0.3, a: 0.1 };
  // (a palette's markers are all used: those of other colours join the role nearest them in hue)
  if (base.seeded) {
    const inR = {};
    ['m', 's', 'a'].forEach(function (r) {
      if (tk[r])
        tk[r].list.forEach(function (x) {
          inR[x.mkey] = 1;
        });
    });
    base.items.forEach(function (x) {
      if (inR[x.mkey]) return;
      const f = balFamOf(x);
      let best = 'm',
        bd = Infinity;
      ['m', 's', 'a'].forEach(function (r) {
        if (!tk[r]) return;
        const d = balDist(f, { m: m, s: s, a: a }[r]) + (r === 'a' ? 30 : 0);
        if (d < bd) {
          bd = d;
          best = r;
        }
      });
      tk[best].list.push(x);
    });
    ['m', 's', 'a'].forEach(function (r) {
      if (tk[r]) cnt[r] = tk[r].list.length;
    });
  }
  const mMark = balPick(mt.list, cnt.m, false, 0),
    mainL = mMark.length
      ? mMark.reduce(function (t, x) {
          return t + mLch(x)[0];
        }, 0) / mMark.length
      : 50;
  roles.m = { k: m, list: mt.list, markers: mMark, borrowed: mt.borrowed, share: share.m };
  if (has.s)
    roles.s = {
      k: s,
      list: tk.s.list,
      markers: balPick(tk.s.list, cnt.s, false, mainL),
      borrowed: tk.s.borrowed,
      share: share.s,
    };
  if (has.a)
    roles.a = {
      k: a,
      list: tk.a.list,
      markers: balPick(tk.a.list, cnt.a, true, mainL),
      borrowed: tk.a.borrowed,
      share: share.a,
    };
  const all = [];
  ['m', 's', 'a'].forEach(function (r) {
    if (roles[r])
      roles[r].markers.forEach(function (x) {
        all.push(x);
      });
  });
  return {
    ok: true,
    roles: roles,
    markers: all,
    used: all.length,
    want: want,
    seeded: base.seeded,
    min: MIN,
    small: small,
    tempMiss: tempMiss,
    viable: viable,
    // (an Auto accent of the other temperature than the one asked for)
    crossTemp:
      !!roles.a &&
      !hand.a &&
      !base.seeded &&
      !anyHand &&
      (palette === 'cool' ? balWarm(roles.a.k) : palette === 'warm' ? !!BAL_COOL[roles.a.k] : false),
    groups: groups,
  };
}
// lay the sections cl by the plan p (Main colour); pinned sections keep their markers
function buildBalance(cl, p) {
  const order = cl.slice(),
    assign = {},
    area = function (l) {
      return comps[l].area || 0;
    },
    bk = {},
    roleOf = {},
    want = { m: 0, s: 0, a: 0 },
    got = { m: 0, s: 0, a: 0 },
    role = {};
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  ['m', 's', 'a'].forEach(function (r) {
    if (p.roles[r])
      p.roles[r].markers.forEach(function (m) {
        roleOf[m.mkey] = r;
      });
  });
  // pinned sections first: their marker's role takes their area (a pin in none of the roles is left out)
  let total = 0;
  const free = [];
  order.forEach(function (l) {
    const pin = locks[l] !== undefined ? bk[locks[l]] : null;
    if (pin) {
      assign[l] = pin;
      let r = roleOf[pin.mkey];
      if (!r) {
        const f = balFamOf(pin);
        ['m', 's', 'a'].forEach(function (q) {
          if (!r && p.roles[q] && p.roles[q].k === f) r = q;
        });
      }
      if (r) {
        got[r] += area(l);
        total += area(l);
      }
    } else {
      free.push(l);
      total += area(l);
    }
  });
  // (a zone of fewer than 10 sections has no accent: balPlan leaves it out)
  const acc = !!p.roles.a && order.length >= 10;
  let sh = { m: p.roles.m.share, s: p.roles.s ? p.roles.s.share : 0, a: acc ? p.roles.a.share : 0 };
  const st = sh.m + sh.s + sh.a;
  ['m', 's', 'a'].forEach(function (r) {
    want[r] = (total * sh[r]) / st;
  });
  // the accents: middling sections (not the biggest tenth, nor slivers too small to colour), spread out: each as far
  // from those chosen as it can be, give or take (one of the four furthest)
  if (acc) {
    const sizes = free.map(area).sort(function (a, b) {
        return a - b;
      }),
      floor = Math.min(W * H * 0.0003, (W * H * 0.3) / Math.max(1, free.length)),
      hi = sizes[Math.floor(sizes.length * 0.9)] || Infinity,
      pick = function (lo) {
        return free.filter(function (l) {
          return area(l) >= lo && area(l) <= hi;
        });
      };
    let cand = pick(Math.max(sizes[Math.floor(sizes.length * 0.3)] || 0, floor));
    if (!cand.length) cand = pick(0);
    // (each candidate's distance to the nearest accent so far, brought up to date as each is chosen)
    const near = new Float64Array(cand.length).fill(Infinity),
      out = new Uint8Array(cand.length),
      top = [0, 0, 0, 0],
      topD = [0, 0, 0, 0];
    let left = cand.length,
      first = true;
    while (got.a < want.a && left) {
      let i;
      if (first) {
        i = Math.floor(Math.random() * cand.length);
        first = false;
      } else {
        let k = 0;
        for (let j = 0; j < cand.length; j++) {
          if (out[j]) continue;
          const d = near[j];
          if (k < 4) {
            top[k] = j;
            topD[k] = d;
            k++;
          } else {
            let w = 0;
            for (let q = 1; q < 4; q++) if (topD[q] < topD[w]) w = q;
            if (d > topD[w]) {
              top[w] = j;
              topD[w] = d;
            }
          }
        }
        i = top[Math.floor(Math.random() * k)];
      }
      const l = cand[i];
      out[i] = 1;
      left--;
      role[l] = 'a';
      got.a += area(l);
      for (let j = 0; j < cand.length; j++)
        if (!out[j]) {
          const q = cand[j],
            d = Math.hypot(comps[q].cx - comps[l].cx, comps[q].cy - comps[l].cy);
          if (d < near[j]) near[j] = d;
        }
    }
  }
  // the main colour and the second, biggest sections first, each to whichever is furthest short of its share
  const rest = free
    .filter(function (l) {
      return !role[l];
    })
    .sort(function (a, b) {
      return area(b) - area(a);
    });
  rest.forEach(function (l) {
    const r =
      !p.roles.s || (want.s <= 0 ? true : got.m / Math.max(1, want.m) <= got.s / Math.max(1, want.s))
        ? 'm'
        : 's';
    role[l] = r;
    got[r] += area(l);
  });
  // the markers within each role: not a neighbour's (nor, with Keep touching sections clearly different, one that
  // looks like it), the least used first; when none of the role's will do, one of another role's that will (so a role
  // of two markers doesn't put the same one side by side)
  const a = adj || (adj = buildAdj()),
    uses = {},
    alike = balAlike(),
    all = p.markers,
    shuffled = free.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)),
      t = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = t;
  }
  shuffled.forEach(function (l) {
    const list = p.roles[role[l]].markers,
      nbs = [];
    if (a && a[l])
      a[l].forEach(function (q) {
        if (assign[q]) nbs.push(assign[q]);
      });
    const notSame = function (m) {
        return !nbs.some(function (x) {
          return x.mkey === m.mkey;
        });
      },
      clear = function (m) {
        return !nbs.some(function (x) {
          return alike(m, x);
        });
      };
    // (Keep touching sections clearly different is kept even when it takes another role's marker: a family's own
    // markers often look alike side by side)
    let ok = noAdj ? list.filter(clear) : [];
    if (!ok.length && noAdj) ok = all.filter(clear);
    if (!ok.length) ok = list.filter(notSame);
    if (!ok.length) ok = all.filter(notSame);
    if (!ok.length) ok = list;
    let lo = Infinity;
    ok.forEach(function (m) {
      lo = Math.min(lo, uses[m.mkey] || 0);
    });
    const least = ok.filter(function (m) {
      return (uses[m.mkey] || 0) <= lo + 1;
    });
    const m = least[Math.floor(Math.random() * least.length)];
    assign[l] = m;
    uses[m.mkey] = (uses[m.mkey] || 0) + 1;
  });
  assignData = { assign: assign, order: order, N: order.length, base: Object.assign({}, assign) };
  applyLocks();
}
// do two markers look alike (CIEDE2000 under ADJ_DE, as Keep touching sections clearly different has it)? Worked out
// once per pair while a pattern is laid
function balAlike() {
  const memo = new Map();
  return function (m, x) {
    if (m.mkey === x.mkey) return true;
    const k = m.mkey < x.mkey ? m.mkey + '\u0000' + x.mkey : x.mkey + '\u0000' + m.mkey;
    let v = memo.get(k);
    if (v === undefined) {
      v = !!(m.lab && x.lab && de2000(m.lab, x.lab) < ADJ_DE);
      memo.set(k, v);
    }
    return v;
  };
}
// Mixed's No repeats: the markers for as many sections as there are (as few as you can use, if fewer)
// (peek: for what the controls say, which mustn't make a generated palette: seedPool)
function noRepPool(cl, peek) {
  const src = poolSource(cl.length, peek);
  return src.seeded ? src.items : thinPool(src.items, cl.length);
}
// every marker once before any twice; a repeat goes where its marker is furthest from where it's used already.
// Touching sections never share a marker while any other would do: the least used that's clear of the neighbours
// (with Keep touching sections clearly different, clear of look-alikes too), then the least used that isn't a
// neighbour's, then the next least used, before a neighbour's own
function buildNoRep(cl, pool) {
  const order = cl.slice(),
    assign = {},
    bk = {},
    uses = {},
    at = {},
    alike = balAlike(),
    a = adj || (adj = buildAdj());
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  const put = function (l, m) {
    assign[l] = m;
    uses[m.mkey] = (uses[m.mkey] || 0) + 1;
    (at[m.mkey] = at[m.mkey] || []).push(l);
  };
  const free = [];
  order.forEach(function (l) {
    const pin = locks[l] !== undefined ? bk[locks[l]] : null;
    if (pin) put(l, pin);
    else free.push(l);
  });
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)),
      t = free[i];
    free[i] = free[j];
    free[j] = t;
  }
  // the markers by how often they're used so far (lists kept as they change: no scan of the pool per section)
  const byUse = [
    pool.filter(function (m) {
      return !uses[m.mkey];
    }),
  ];
  pool.forEach(function (m) {
    const u = uses[m.mkey] || 0;
    if (u) (byUse[u] = byUse[u] || []).push(m);
  });
  let low = 0;
  const lowUp = function () {
    while (low < byUse.length && !(byUse[low] && byUse[low].length)) low++;
  };
  free.forEach(function (l) {
    lowUp();
    const nbs = [];
    if (a && a[l])
      a[l].forEach(function (q) {
        if (assign[q]) nbs.push(assign[q]);
      });
    const notSame = function (m) {
        return !nbs.some(function (x) {
          return x.mkey === m.mkey;
        });
      },
      clear = function (m) {
        return !nbs.some(function (x) {
          return alike(m, x);
        });
      };
    // (a few of the least used that fit, looked at from a random place in the list: enough to choose among without
    // testing hundreds of markers against the neighbours for every section)
    const some = function (g, ok, k) {
      const out = [],
        n = g.length,
        s0 = Math.floor(Math.random() * n);
      for (let i = 0; i < n && out.length < k; i++) {
        const m = g[(s0 + i) % n];
        if (ok(m)) out.push(m);
      }
      return out;
    };
    let cand = null,
      u = low;
    const K = low > 0 ? 24 : 8;
    for (let tries = 0; tries < 3 && !cand; tries++, u++) {
      const g = byUse[u];
      if (!g || !g.length) continue;
      const c = noAdj
        ? some(
            g,
            function (m) {
              return notSame(m) && clear(m);
            },
            K,
          )
        : [];
      const ns = c.length ? c : some(g, notSame, K);
      if (ns.length) cand = ns;
    }
    if (!cand) cand = byUse[low] || pool;
    if (low > 0 && cand.length > 1) {
      // (a repeat: of those, the ones whose other sections are furthest away)
      const far = cand
        .map(function (m) {
          let d = Infinity;
          (at[m.mkey] || []).forEach(function (q) {
            d = Math.min(d, Math.hypot(comps[l].cx - comps[q].cx, comps[l].cy - comps[q].cy));
          });
          return [d, m];
        })
        .sort(function (x, y) {
          return y[0] - x[0];
        });
      cand = far.slice(0, Math.max(1, Math.ceil(far.length / 4))).map(function (x) {
        return x[1];
      });
    }
    const m = cand[Math.floor(Math.random() * cand.length)],
      was = uses[m.mkey] || 0,
      g = byUse[was];
    g.splice(g.indexOf(m), 1);
    (byUse[was + 1] = byUse[was + 1] || []).push(m);
    put(l, m);
  });
  assignData = { assign: assign, order: order, N: order.length, base: Object.assign({}, assign) };
  applyLocks();
}
// Random over the sections cl, by its Balance
function buildRandomBal(cl, pool) {
  if (balance === 'main') {
    const p = balPlan();
    if (p.ok) {
      buildBalance(cl, p);
      lastPoolN = p.used;
      return;
    }
  } else if (noRep) {
    const np = noRepPool(cl);
    if (np.length) {
      buildNoRep(cl, np);
      lastPoolN = np.length;
      return;
    }
  }
  buildRandom(cl, pool);
}

/* ---- Balance on the screen: Pattern › Random ----
    Balance (Mixed | Main colour) under the pattern's row. With Main colour, a bar in three parts, each a role in its
    markers' colours and about as wide as its share ("Blues · 60%"); a tap on one opens a sheet of your colour
    families (as strips of your markers, with how many) and Auto, to choose that role's. ↻ Other pairings rolls the
    roles left on Auto. A line under it says what's used ("6 blues, 4 greens and 2 oranges of yours"). With Mixed,
    No repeats sits under Keep touching sections clearly different. */
function balPct(r, p) {
  return Math.round((p.roles[r] ? p.roles[r].share : 0) * 100);
}
// a role's colours as a strip, light to dark (the label sits over the light end)
function balLight(list) {
  return list.slice().sort(function (a, b) {
    return mLch(b)[0] - mLch(a)[0];
  });
}
function balStrip(list) {
  const s = balLight(list);
  if (s.length === 1) return s[0].hex + ',' + s[0].hex;
  return s
    .map(function (m) {
      return m.hex;
    })
    .join(',');
}
function balWord(k, n) {
  return n + ' ' + BAL_FAM[k].w + (n === 1 ? '' : 's');
}
// "6 blues, 4 greens and 2 oranges of yours", a borrowed marker by its own colour ("1 red, with 1 pink and 1 orange");
// a palette's by role, as its other colours join them ("The palette's 8 markers: violets the main colour, …")
function balNote(p) {
  const rs = ['m', 's', 'a'].filter(function (r) {
      return !!p.roles[r];
    }),
    join = function (parts) {
      return parts.length > 2
        ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
        : parts.join(' and ');
    };
  let t;
  if (p.seeded)
    t =
      'The palette’s ' +
      p.used +
      ' markers: ' +
      join(
        rs.map(function (r) {
          return BAL_FAM[p.roles[r].k].w + 's ' + { m: 'the main colour', s: 'second', a: 'the accent' }[r];
        }),
      ) +
      ', with its other colours alongside.';
  else
    t =
      join(
        rs.map(function (r) {
          const x = p.roles[r],
            by = {};
          x.markers.forEach(function (m) {
            const f = balFamOf(m);
            by[f] = (by[f] || 0) + 1;
          });
          const own = by[x.k] || 0,
            other = Object.keys(by)
              .filter(function (f) {
                return f !== x.k;
              })
              .map(function (f) {
                return balWord(f, by[f]);
              });
          return (own ? balWord(x.k, own) : BAL_FAM[x.k].n) + (other.length ? ', with ' + join(other) : '');
        }),
      ) + (isDemo() ? ' from the catalogue.' : ' of yours.');
  const nSec = zoneList().length;
  if (!p.seeded && p.used < p.want && nSec >= p.want)
    t += ' That’s all there are of these colours, so ' + p.used + ' markers, not ' + p.want + '.';
  if (!p.seeded && p.used > p.want) t += ' Main colour needs at least ' + p.used + ' markers.';
  if (p.small) t += ' Too few sections for an accent of their own.';
  else if (!p.roles.a && !p.roles.s) t += ' No other colour to go with it, so it’s all the main colour.';
  else if (!p.roles.a) t += ' No colour across the wheel for an accent, so two colours.';
  else if (!p.roles.s) t += ' No colour to go second, so the main colour and an accent.';
  if (p.tempMiss)
    t += ' No ' + palette + ' colour has markers enough to be the main one, so it can be any colour.';
  if (p.crossTemp) t += ' The accent is ' + (palette === 'cool' ? 'warm' : 'cool') + ', to stand out.';
  return t;
}
function balHTML() {
  let h =
    '<div class="sfsublbl">Balance</div><div id="sfBal" role="group" aria-label="Balance" class="sfc-segs">' +
    ctlSeg('mixed', 'Mixed', balance === 'mixed') +
    ctlSeg('main', 'Main colour', balance === 'main') +
    '</div>';
  if (balance === 'main') {
    const p = balPlan(),
      byHand = balM !== 'auto' || balS !== 'auto' || balA !== 'auto';
    if (!p.ok)
      h +=
        '<div class="sfc-note sfc-mt8">' +
        (p.why === 'thin'
          ? esc(BAL_FAM[p.fam].n) + ': too few markers, even with the colours next to them'
          : 'No colour has markers enough to be the main one') +
        ', so it’s laid Mixed for now.' +
        (byHand ? ' <button type="button" id="sfBalAuto" class="sflink">Back to Auto</button>' : '') +
        '</div>';
    else {
      h += '<div id="sfBalBar" class="sfbalbar">';
      ['m', 's', 'a'].forEach(function (r) {
        const x = p.roles[r];
        if (!x) return;
        const pc = balPct(r, p),
          nm = BAL_FAM[x.k].n,
          auto = { m: balM, s: balS, a: balA }[r] === 'auto';
        h +=
          '<button type="button" id="sfBal' +
          r.toUpperCase() +
          '" class="sfbalseg" data-r="' +
          r +
          '" style="flex:' +
          pc +
          ' 1 0;background:linear-gradient(90deg,' +
          balStrip(x.markers) +
          ');color:' +
          // (the label's over the light end of the strip)
          txt(balLight(x.markers)[0].hex) +
          '" aria-label="' +
          esc(
            BAL_ROLE[r] +
              ': ' +
              nm +
              (auto ? ', chosen for you' : '') +
              ', about ' +
              pc +
              '% of the picture. Change',
          ) +
          '"><span aria-hidden="true" class="sfbalsn">' +
          (pc > 12 ? esc(nm) : '') +
          '</span><span aria-hidden="true" class="sfbalsp">' +
          (pc > 12 ? ' \u00b7 ' : '') +
          pc +
          '%</span></button>';
      });
      const handAll = ['m', 's', 'a'].every(function (r) {
        return !p.roles[r] || { m: balM, s: balS, a: balA }[r] !== 'auto';
      });
      h +=
        '</div><div class="sfbalrow"><span class="sfc-note">Tap a colour to change it</span><button type="button" id="sfBalPair" class="sfghost"' +
        (handAll ? ' disabled' : '') +
        '><span aria-hidden="true">↻</span> Other pairings</button></div><div id="sfBalNote" class="sfc-note sfc-mt6">' +
        esc(balNote(p)) +
        '</div>';
    }
  }
  h +=
    '<label class="sfchk sfc-check sfc-inline sfc-mt10"><input type="checkbox" id="sfNoAdj"' +
    (noAdj ? ' checked' : '') +
    '> Keep touching sections clearly different</label>';
  if (balance === 'mixed') {
    h +=
      '<label class="sfchk sfc-check sfc-inline sfc-mt8"><input type="checkbox" id="sfNoRep"' +
      (noRep ? ' checked' : '') +
      '> No repeats: every section a different marker</label>';
    if (noRep) {
      const n = zoneList().length,
        k = noRepPool(zoneList(), true).length,
        per = k ? Math.round(n / k) : 0;
      h +=
        '<div id="sfNoRepNote" class="sfc-note sfc-mt6">' +
        (k >= n
          ? 'Every section has its own marker: ' + n + '.'
          : n +
            ' sections, ' +
            k +
            ' markers: ' +
            (per >= 2 ? 'each used about ' + per + ' times' : n - k + ' used twice') +
            ', every one before any again, kept apart.') +
        (k >= n * 0.8 ? ' Slow to colour: nearly every section is a new marker.' : '') +
        '</div>';
    }
  }
  return h;
}
// the sheet a part of the bar opens: Auto, then each colour family there is (a strip of the markers and how many);
// one that can't fill the role even borrowing from next to it is shown, greyed
function balChoose(r) {
  const p = balPlan();
  if (!p.ok) return;
  const cur = { m: balM, s: balS, a: balA }[r],
    groups = p.groups,
    min = p.min[r],
    usedBy = {},
    otherHand = ['m', 's', 'a'].some(function (q) {
      return q !== r && { m: balM, s: balS, a: balA }[q] !== 'auto';
    });
  ['m', 's', 'a'].forEach(function (q) {
    if (q !== r && p.roles[q]) usedBy[p.roles[q].k] = q;
  });
  let b =
    '<div class="sfbalopts" role="group" aria-label="' +
    esc(BAL_ROLE[r]) +
    '"><button type="button" class="sfbalopt" data-k="auto" aria-pressed="' +
    (cur === 'auto') +
    '"><span class="sfbalnm"><span class="sfbaltt">Auto</span></span><span class="sfbalsub">' +
    (r === 'm'
      ? p.seeded
        ? 'the palette’s biggest colour'
        : palette !== 'all' && !otherHand
          ? 'a ' + palette + ' colour, as Temperature says'
          : 'chosen for you'
      : r === 'a'
        ? 'across the colour wheel, bright'
        : 'next to the main colour') +
    '</span></button>';
  BAL_ORDER.forEach(function (k) {
    const list = groups[k];
    if (!list || !list.length || (r === 'a' && k === 'grey')) return;
    const n = list.length,
      can = !!usedBy[k] || p.viable(k, min),
      sub = !can
        ? 'too few, even with the colours next to them'
        : usedBy[k]
          ? 'now the ' + BAL_ROLE[usedBy[k]].toLowerCase() + ': they swap'
          : n < min
            ? 'only ' + n + ': borrows from the colours next to it'
            : '';
    b +=
      '<button type="button" class="sfbalopt" data-k="' +
      k +
      '" aria-pressed="' +
      (cur === k) +
      '"' +
      (can ? '' : ' disabled') +
      '><span class="sfbalnm"><span class="sfbaltt">' +
      BAL_FAM[k].n +
      '</span>' +
      (sub ? '<span class="sfbalsub">' + sub + '</span>' : '') +
      '</span><span class="sfbalsw" aria-hidden="true" style="background:linear-gradient(90deg,' +
      balStrip(list.slice(0, 40)) +
      ')"></span><span class="sfbaln">' +
      n +
      '</span></button>';
  });
  b += '</div>';
  const el = openSheet({ title: BAL_ROLE[r] + ' · about ' + balPct(r, p) + '%', body: b, fit: true });
  el.classList.add('sfbalsh');
  const on = el.querySelector('.sfbalopt[aria-pressed="true"]');
  if (on)
    try {
      on.focus({ preventScroll: true });
    } catch (_) {}
  el.addEventListener('click', function (e) {
    const o = e.target.closest('.sfbalopt');
    if (!o || o.disabled) return;
    const k = o.dataset.k;
    closeSheet(true);
    if (k === cur) return;
    // (a family another role has: they swap, that role taking this one's colour)
    const q = usedBy[k],
      prev = p.roles[r] ? p.roles[r].k : 'auto';
    if (q) balSet(q, prev === 'grey' && q === 'a' ? 'auto' : prev);
    balSet(r, k);
    reassign();
    ctlRefocus('#sfBal' + r.toUpperCase());
  });
}
// a plan's families, to tell one pairing from another
function balKeys(p) {
  return p.ok
    ? ['m', 's', 'a']
        .map(function (r) {
          return p.roles[r] ? p.roles[r].k : '-';
        })
        .join('/')
    : '';
}
function balSet(r, v) {
  if (r === 'm') balM = v;
  else if (r === 's') balS = v;
  else balA = v;
}
// wire Balance's controls (ctlPlanWire)
function balWire() {
  const g = document.getElementById('sfBal');
  if (g)
    g.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || b.dataset.v === balance) return;
      balance = b.dataset.v;
      reassign();
      ctlRefocus('#sfBal [data-v="' + balance + '"]');
    });
  const bar = document.getElementById('sfBalBar');
  if (bar)
    bar.addEventListener('click', function (e) {
      const b = e.target.closest('.sfbalseg');
      if (b) balChoose(b.dataset.r);
    });
  const pr = document.getElementById('sfBalPair');
  if (pr)
    pr.addEventListener('click', function () {
      // (a pairing other than the one there is; none to be had says so, and changes nothing)
      const was = balKeys(balPlan()),
        s0 = balSeed;
      let found = false;
      for (let i = 0; i < 16 && !found; i++) {
        balSeed = (((s0 || 0) % 1) + 0.13 + Math.random() * 0.74) % 1;
        found = balKeys(balPlan()) !== was;
      }
      if (!found) {
        balSeed = s0;
        toast('No other pairing of these colours to be had.', 2200);
        return;
      }
      reassign();
      ctlRefocus('#sfBalPair');
    });
  const ba = document.getElementById('sfBalAuto');
  if (ba)
    ba.addEventListener('click', function () {
      balM = balS = balA = 'auto';
      reassign();
      ctlRefocus('#sfBal [data-v="main"]');
    });
  const nr = document.getElementById('sfNoRep');
  if (nr)
    nr.addEventListener('change', function (e) {
      noRep = e.target.checked;
      reassign();
      ctlRefocus('#sfNoRep');
    });
}
// what Surprise's note says of Random's roles: "blues, with greens and an orange accent"
function surpriseRoles() {
  const p = balPlan();
  if (!p.ok) return '';
  const w = function (r) {
    return BAL_FAM[p.roles[r].k].w;
  };
  return (
    w('m') +
    's' +
    (p.roles.s ? ', with ' + w('s') + 's' : '') +
    (p.roles.a
      ? (p.roles.s ? ' and ' : ', with ') + 'a' + (/^[aeiou]/.test(w('a')) ? 'n ' : ' ') + w('a') + ' accent'
      : '')
  );
}
