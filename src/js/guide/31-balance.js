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
  BAL_ROLE = { m: 'Main colour', s: 'Second colour', a: 'Accent' },
  // (a palette's marker of another colour joins a role only this close in hue to the role's own markers: past it, a
  // blue-violet would be one of the pinks; one further from them all is an accent)
  BAL_JOIN = 60;
// the circular mean of the markers' hues (h when there are none)
function balCentre(list, h) {
  let X = 0,
    Y = 0;
  list.forEach(function (q) {
    const r = (balHue(q) * Math.PI) / 180;
    X += Math.cos(r);
    Y += Math.sin(r);
  });
  return list.length ? ((Math.atan2(Y, X) * 180) / Math.PI + 360) % 360 : h;
}
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
    // (a palette is used whole, so its colours need fewer markers of their own: the rest join them; one marker can
    // be the main colour, touching sections sharing it, as a note says)
    MIN = base.seeded ? { m: 1, s: 1, a: 1 } : BAL_MIN,
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
    accFams = {};
  if (has.a) accFams[a] = 1;
  // (a palette's markers are all used: one of another colour joins the role whose own markers it's nearest in hue,
  // within BAL_JOIN, greys the main colour; one further from them all is an accent, the accent being a colour or
  // more; a zone too small for an accent has it join the nearest)
  if (base.seeded) {
    const inR = {},
      cen = {},
      fam = { m: m, s: s, a: a };
    ['m', 's', 'a'].forEach(function (r) {
      if (!tk[r]) return;
      tk[r].list.forEach(function (x) {
        inR[x.mkey] = 1;
      });
      cen[r] =
        fam[r] === 'grey'
          ? -1
          : balCentre(
              tk[r].list.filter(function (q) {
                return balFamOf(q) === fam[r];
              }),
              BAL_FAM[fam[r]].h,
            );
    });
    base.items.forEach(function (x) {
      if (inR[x.mkey]) return;
      const grey = balFamOf(x) === 'grey';
      let best = 'm',
        bd = Infinity;
      ['m', 's', 'a'].forEach(function (r) {
        if (!tk[r]) return;
        const d = grey ? (r === 'm' ? 0 : 1) : cen[r] < 0 ? Infinity : hueDiff(balHue(x), cen[r]);
        if (d < bd) {
          bd = d;
          best = r;
        }
      });
      if (!grey && bd > BAL_JOIN && !small) {
        if (!tk.a) {
          tk.a = { list: [], borrowed: {} };
          has.a = true;
          a = balFamOf(x);
        }
        tk.a.list.push(x);
        accFams[balFamOf(x)] = 1;
      } else tk[best].list.push(x);
    });
    ['m', 's', 'a'].forEach(function (r) {
      if (tk[r]) cnt[r] = tk[r].list.length;
    });
  }
  // (an accent of two colours or more has a little more room, so each shows more than once or twice)
  const many = Object.keys(accFams).length > 1,
    two = !(has.s && has.a),
    share = two
      ? { m: 0.7, s: has.s ? 0.3 : 0, a: has.a ? 0.3 : 0 }
      : many
        ? { m: (0.6 * 0.85) / 0.9, s: (0.3 * 0.85) / 0.9, a: 0.15 }
        : { m: 0.6, s: 0.3, a: 0.1 };
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
      // (its colours, round the wheel: more than one makes it "Accents")
      fams: BAL_ORDER.filter(function (k) {
        return !!accFams[k];
      }),
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
// what each role would have had by the sections' sizes alone, and what it has painted, the last time each zone was laid
// (for the note when the shares miss: the sizes, or too few markers to keep touching sections apart)
let balStat = {};
function balZoneKey() {
  return String(zoneBuilding != null ? zoneBuilding : zoneCur);
}
// a marker's role in plan p: one of its markers, else one of its colours (greys the main colour's); null for neither
function balRoleOf(p, m) {
  let r = null;
  ['m', 's', 'a'].forEach(function (q) {
    if (
      !r &&
      p.roles[q] &&
      p.roles[q].markers.some(function (x) {
        return x.mkey === m.mkey;
      })
    )
      r = q;
  });
  if (r) return r;
  const f = balFamOf(m);
  ['m', 's', 'a'].forEach(function (q) {
    const x = p.roles[q];
    if (!r && x && (x.k === f || (x.fams && x.fams.indexOf(f) >= 0))) r = q;
  });
  return r;
}
/* lay the sections cl by the plan p (Main colour); pinned sections keep their markers, and count towards their
   colour's role (a pin in none of the roles is left out).
   The accents first: middling sections (never the biggest tenth nor one bigger than the accent's whole share, nor
   slivers too small to colour), spread out: each as far from those chosen as it can be, give or take (one of the four
   furthest). Then every section, biggest first, takes a marker: an accent section the accent's, the rest whichever
   of the main colour and the second is further short of its share. Each role's share is counted by the marker
   actually painted, so when a role's own markers won't do (all a neighbour's, or with Keep touching sections clearly
   different all like one), the other of the main colour and the second gives one, then an accent's (only on a
   section no bigger than an accent), and only then a neighbour's own; the least used first. */
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
    plan = { m: 0, s: 0, a: 0 },
    accSec = {};
  coll.forEach(function (m) {
    bk[m.mkey] = m;
  });
  ['m', 's', 'a'].forEach(function (r) {
    if (p.roles[r])
      p.roles[r].markers.forEach(function (m) {
        roleOf[m.mkey] = r;
      });
  });
  let total = 0,
    big = 0;
  const free = [];
  order.forEach(function (l) {
    const pin = locks[l] !== undefined ? bk[locks[l]] : null;
    big = Math.max(big, area(l));
    if (pin) {
      assign[l] = pin;
      const r = roleOf[pin.mkey] || balRoleOf(p, pin);
      if (r) {
        got[r] += area(l);
        plan[r] += area(l);
        total += area(l);
      }
    } else {
      free.push(l);
      total += area(l);
    }
  });
  // (a zone of fewer than 10 sections has no accent: balPlan leaves it out)
  const acc = !!p.roles.a && order.length >= 10,
    sh = { m: p.roles.m.share, s: p.roles.s ? p.roles.s.share : 0, a: acc ? p.roles.a.share : 0 },
    st = sh.m + sh.s + sh.a;
  ['m', 's', 'a'].forEach(function (r) {
    want[r] = (total * sh[r]) / st;
  });
  let accHi = 0;
  if (acc) {
    const sizes = free.map(area).sort(function (a, b) {
        return a - b;
      }),
      floor = Math.min(W * H * 0.0003, (W * H * 0.3) / Math.max(1, free.length));
    // (not the biggest tenth: with ten sections, the nine smaller)
    accHi = Math.min(sizes[Math.max(0, Math.ceil(sizes.length * 0.9) - 1)] || Infinity, want.a);
    const pick = function (lo) {
      return free.filter(function (l) {
        return area(l) >= lo && area(l) <= accHi;
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
      first = true,
      ga = got.a;
    while (ga < want.a && left) {
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
      // (one that would take the accent past its share by more than half its own size is passed over)
      if (ga > 0 && ga + area(l) - want.a > area(l) / 2) continue;
      accSec[l] = 1;
      ga += area(l);
      for (let j = 0; j < cand.length; j++)
        if (!out[j]) {
          const q = cand[j],
            d = Math.hypot(comps[q].cx - comps[l].cx, comps[q].cy - comps[l].cy);
          if (d < near[j]) near[j] = d;
        }
    }
  }
  const a = adj || (adj = buildAdj()),
    uses = {},
    alike = balAlike(),
    seq = free.slice().sort(function (x, y) {
      return area(y) - area(x);
    });
  seq.forEach(function (l) {
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
      },
      ms = ['m', 's']
        .filter(function (r) {
          return !!p.roles[r] && want[r] > 0;
        })
        .sort(function (x, y) {
          return want[y] - got[y] - (want[x] - got[x]);
        });
    if (!ms.length) ms.push('m');
    // (the main colour and an accent, no second, in a zone too small for an accent section: the accent's markers too)
    if (!p.roles.s && !acc && p.roles.a) ms.push('a');
    const prefs = accSec[l] && got.a < want.a ? ['a'].concat(ms) : ms;
    plan[prefs[0]] += area(l);
    let m = null;
    const tryR = function (test) {
      for (let i = 0; i < prefs.length && !m; i++) {
        const ok = p.roles[prefs[i]].markers.filter(test);
        if (!ok.length) continue;
        let lo = Infinity;
        ok.forEach(function (x) {
          lo = Math.min(lo, uses[x.mkey] || 0);
        });
        const least = ok.filter(function (x) {
          return (uses[x.mkey] || 0) <= lo + 1;
        });
        m = least[Math.floor(Math.random() * least.length)];
      }
    };
    if (noAdj)
      tryR(function (x) {
        return notSame(x) && clear(x);
      });
    if (!m) tryR(notSame);
    if (!m && acc && prefs[0] !== 'a' && area(l) <= accHi) {
      prefs.push('a');
      tryR(notSame);
    }
    if (!m)
      tryR(function () {
        return true;
      });
    assign[l] = m;
    uses[m.mkey] = (uses[m.mkey] || 0) + 1;
    got[roleOf[m.mkey]] += area(l);
  });
  balStat[balZoneKey()] = { plan: plan, total: total, big: big, all: order.length };
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
/* What the guide has painted in each role now, over the zone's sections, by area: { f: { m, s, a } (fractions of
   the sections counted), aim: { m, s, a } (the shares asked, as laid: no accent in a zone under 10 sections), other
   (sections pinned or kept in another colour: not counted), miss (how far the worst role is from its aim) }; null
   before there's an assignment. */
function balMeasure(p) {
  const A = assignData && assignData.assign,
    cl = zoneList();
  if (!A || !cl.length || !comps) return null;
  const g = { m: 0, s: 0, a: 0 },
    aim = { m: 0, s: 0, a: 0 };
  let t = 0,
    other = 0;
  cl.forEach(function (l) {
    const m = A[l];
    if (!m) return;
    const r = balRoleOf(p, m),
      ar = comps[l].area || 0;
    if (r) {
      g[r] += ar;
      t += ar;
    } else other++;
  });
  if (!(t > 0)) return null;
  const acc = !!p.roles.a && cl.length >= 10;
  let st = 0;
  ['m', 's', 'a'].forEach(function (r) {
    aim[r] = p.roles[r] && (r !== 'a' || acc) ? p.roles[r].share : 0;
    st += aim[r];
  });
  let miss = 0;
  ['m', 's', 'a'].forEach(function (r) {
    g[r] /= t;
    aim[r] /= st || 1;
    if (p.roles[r]) miss = Math.max(miss, Math.abs(g[r] - aim[r]));
  });
  return { f: g, aim: aim, other: other, miss: miss, total: t };
}
// a role's share for the screen: measured (to the nearest 5) when there's an assignment, else the one asked
function balPct(r, p, ms) {
  if (!ms) return Math.round((p.roles[r] ? p.roles[r].share : 0) * 100);
  const f = ms.f[r];
  return f > 0 && f < 0.025 ? 1 : Math.round(f * 20) * 5;
}
// "15%", or "<5%" for a sliver
function balPctTxt(pc) {
  return (pc === 1 ? '<5' : pc) + '%';
}
// a role's word on the bar (v288): its role (Main, Second, Accent), as a family's name ("Browns") didn't always match
// the colours you saw; the family is in its label for screen readers, and in its sheet's title
const BAL_SHORT = { m: 'Main', s: 'Second', a: 'Accent' };
function balShort(r) {
  return BAL_SHORT[r];
}
// a role's colour family's name ("Blues"), "Accents" for an accent of more than one colour
function balName(r, p) {
  const x = p.roles[r];
  return r === 'a' && x.fams && x.fams.length > 1 ? 'Accents' : BAL_FAM[x.k].n;
}
// the families' words, joined: "oranges and pinks"
function balFamsWords(fams) {
  const w = fams.map(function (k) {
    return BAL_FAM[k].w + 's';
  });
  return w.length > 2 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w.join(' and ');
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
      (rs.length === 1
        ? 'All ' + BAL_FAM[p.roles.m.k].w + 's: no other colour to go with it'
        : 'The palette’s ' +
          p.used +
          ' marker' +
          (p.used === 1 ? '' : 's') +
          ': ' +
          join(
            rs.map(function (r) {
              const x = p.roles[r];
              // (with no second colour, the accent's part is the rest: a third of the picture, not a touch)
              if (r === 'a' && !p.roles.s)
                return balFamsWords(x.fams && x.fams.length ? x.fams : [x.k]) + ' the rest';
              if (r === 'a' && x.fams && x.fams.length > 1) return balFamsWords(x.fams) + ' as accents';
              return BAL_FAM[x.k].w + 's ' + { m: 'the main colour', s: 'second', a: 'the accent' }[r];
            }),
          )) + '.';
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
  else if (!p.roles.a && !p.roles.s) {
    if (!p.seeded) t += ' No other colour to go with it, so it’s all the main colour.';
  } else if (!p.roles.a) t += ' No colour across the wheel for an accent, so two colours.';
  else if (!p.roles.s && !p.seeded)
    t +=
      ' No colour to go second, so the main colour and ' +
      (p.roles.a.fams && p.roles.a.fams.length > 1 ? 'accents.' : 'an accent.');
  if (p.tempMiss)
    t += ' No ' + palette + ' colour has markers enough to be the main one, so it can be any colour.';
  if (p.crossTemp) t += ' The accent is ' + (palette === 'cool' ? 'warm' : 'cool') + ', to stand out.';
  return t;
}
// what the bar's figures can't say: one marker for the main colour (with Add shades, which turns Expand on); shares
// that miss what was asked by 8 points or more, and why; sections in other colours not counted
function balMore(p, ms) {
  let t = '';
  const main = p.roles.m;
  if (p.seeded && main.markers.length === 1)
    t +=
      '<div id="sfBalOne" class="sfc-note sfc-mt6">One ' +
      esc(BAL_FAM[main.k].w) +
      ' marker for the main colour, so touching ' +
      esc(BAL_FAM[main.k].w) +
      ' sections will merge.' +
      (expand ? '' : ' <button type="button" id="sfBalShades" class="sflink">Add shades</button>') +
      '</div>';
  if (ms && ms.miss >= 0.08) {
    const st = balStat[String(zoneCur)],
      aimTxt = ['m', 's', 'a']
        .filter(function (r) {
          return ms.aim[r] > 0;
        })
        .map(function (r) {
          return Math.round(ms.aim[r] * 100);
        })
        .join('/');
    let why = '';
    if (st && st.all === zoneList().length && st.total > 0) {
      let pm = 0;
      ['m', 's', 'a'].forEach(function (r) {
        if (ms.aim[r] > 0) pm = Math.max(pm, Math.abs(st.plan[r] / st.total - ms.aim[r]));
      });
      why =
        pm >= 0.08
          ? 'Its sections’ sizes don’t allow ' +
            aimTxt +
            ' exactly: the biggest covers ' +
            Math.round((st.big / st.total) * 100) +
            '% of the picture.'
          : 'Too few markers to keep touching sections apart in each colour, so some take another colour’s.';
    }
    if (why) t += '<div id="sfBalMiss" class="sfc-note sfc-mt6">' + esc(why) + '</div>';
  }
  if (ms && ms.other)
    t +=
      '<div class="sfc-note sfc-mt6">' +
      ms.other +
      (ms.other === 1
        ? ' pinned or coloured section in another colour isn’t'
        : ' pinned or coloured sections in other colours aren’t') +
      ' counted.</div>';
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
        ', so it’s Mixed for now.' +
        (byHand ? ' <button type="button" id="sfBalAuto" class="sflink">Back to Auto</button>' : '') +
        '</div>';
    else {
      const ms = balMeasure(p);
      h += '<div id="sfBalBar" class="sfbalbar">';
      ['m', 's', 'a'].forEach(function (r) {
        const x = p.roles[r];
        if (!x) return;
        const pc = balPct(r, p, ms),
          // (as wide as it's painted; its figure to the nearest 5)
          wd = ms ? +(ms.f[r] * 100).toFixed(2) : pc,
          nm = balName(r, p).toLowerCase(),
          auto = { m: balM, s: balS, a: balA }[r] === 'auto';
        h +=
          '<button type="button" id="sfBal' +
          r.toUpperCase() +
          '" class="sfbalseg" data-r="' +
          r +
          '" style="flex:' +
          wd +
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
              (pc === 1 ? ', under 5' : ', about ' + pc) +
              '% of the picture. Change',
          ) +
          // (the name goes when it doesn't fit whole: balFit)
          '"><span aria-hidden="true" class="sfbalsn">' +
          esc(balShort(r)) +
          '</span><span aria-hidden="true" class="sfbaldot"> \u00b7 </span><span aria-hidden="true" class="sfbalsp">' +
          balPctTxt(pc) +
          '</span></button>';
      });
      const handAll = ['m', 's', 'a'].every(function (r) {
        return !p.roles[r] || { m: balM, s: balS, a: balA }[r] !== 'auto';
      });
      h +=
        '</div><div class="sfbalrow"><span class="sfc-note">Tap a colour to change it</span><button type="button" id="sfBalPair" class="sfghost"' +
        (handAll ? ' disabled' : '') +
        '>' +
        ic('refresh-cw') +
        ' Other pairings</button></div><div id="sfBalNote" class="sfc-note sfc-mt6">' +
        esc(balNote(p)) +
        '</div>' +
        balMore(p, ms);
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
  const pc = balPct(r, p, balMeasure(p)),
    el = openSheet({
      title:
        BAL_ROLE[r] +
        ': ' +
        balName(r, p).toLowerCase() +
        (pc === 1 ? ' · under 5%' : ' · about ' + pc + '%'),
      body: b,
      fit: true,
    });
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
// the bar's parts show their colour's name only where it fits whole (else just the share); fitPairs calls it
function balFit(root) {
  const bar = root && root.querySelector('#sfBalBar');
  if (!bar || bar.offsetParent === null) return;
  bar.querySelectorAll('.sfbalseg').forEach(function (b) {
    b.classList.remove('sfbalnn');
    const sn = b.querySelector('.sfbalsn');
    if (sn && labelTooWide(sn)) b.classList.add('sfbalnn');
  });
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
  // (Add shades: Expand with nearby markers, three for each of the palette's, as far as your markers go)
  const sh = document.getElementById('sfBalShades');
  if (sh)
    sh.addEventListener('click', function () {
      expand = true;
      limitN = Math.max(limitN, Math.min(Math.max(2, poolFor(palette).length), curSeedLen() * 3));
      reassign();
      ctlRefocus('#sfExpand');
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
      ? (p.roles.s ? ' and ' : ', with ') +
        (p.roles.a.fams && p.roles.a.fams.length > 1
          ? p.roles.a.fams
              .map(function (k) {
                return BAL_FAM[k].w;
              })
              .join(' and ') + ' accents'
          : 'a' + (/^[aeiou]/.test(w('a')) ? 'n ' : ' ') + w('a') + ' accent')
      : '')
  );
}
