/* ===== One shopping list, and ink (running low / dry) =====
   state.wish: markers to buy, [{k:'Brand|code', why:'blend for R16', ts}], one entry per marker.
   state.ink: {'Brand|code':'low'|'dry'} for markers you own. A dry marker counts as not owned for planning
   (palettes, Random, Match and guides, via inPool and sfCollection); a running-low one is still used, with a badge.
   Every add-to-list button in the app (Match, the marker sheet, the guide's blend plan, shading and photo notes)
   is drawn by wishBtnHTML / wishChipHTML / wishAllHTML and handled by the one click handler below. The guide
   reaches these through its api (addWish, isWished, wishChip, wishAll), wired in at the end of this file. */
var _wishValid = null;
function wishValidKey(k) {
  if (!_wishValid)
    _wishValid = new Set(
      COLORS.map(function (c) {
        return c.brand + '|' + c.code;
      }),
    );
  return typeof k === 'string' && _wishValid.has(k);
}
function cleanWish(a) {
  const seen = {},
    out = [];
  (Array.isArray(a) ? a : []).forEach(function (w) {
    if (!w || !wishValidKey(w.k) || seen[w.k]) return;
    seen[w.k] = 1;
    out.push({ k: w.k, why: typeof w.why === 'string' ? w.why.slice(0, 60) : '', ts: +w.ts || 0 });
  });
  return out;
}
function cleanInk(o) {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o))
    Object.keys(o).forEach(function (k) {
      if (wishValidKey(k) && (o[k] === 'low' || o[k] === 'dry')) out[k] = o[k];
    });
  return out;
}
function isWished(k) {
  return state.wish.some(function (w) {
    return w.k === k;
  });
}
function isDry(i) {
  return state.ink[mkey(i)] === 'dry';
}
function wishName(k) {
  const i = keyIdx(k);
  return i == null ? k : COLORS[i].brand + ' ' + COLORS[i].code;
}
function addWish(k, why, quiet) {
  if (!wishValidKey(k) || isWished(k)) return false;
  state.wish.push({ k: k, why: String(why || '').slice(0, 60), ts: Date.now() });
  if (!quiet) {
    if (
      !keep(function () {
        state.wish.pop();
      })
    )
      return false;
    wishChanged();
  }
  return true;
}
function removeWish(k, quiet) {
  const j = state.wish.findIndex(function (w) {
    return w.k === k;
  });
  if (j < 0) return null;
  const w = state.wish.splice(j, 1)[0];
  if (!quiet) {
    if (
      !keep(function () {
        state.wish.splice(j, 0, w);
      })
    )
      return null;
    wishChanged();
  }
  return { w: w, j: j };
}
// Markers that have just become yours leave To buy (one with its ink marked stays: it's the replacement), v305.
// Returns what came off, for wishPutBack (Undo, or storage full). (v308.3: the hand actions that call this take a
// marker's mark off first, inkAddedOff, so for them every added marker leaves To buy.)
function wishOwnedOff(keys) {
  const out = [];
  keys.forEach(function (k) {
    if (state.ink[k]) return;
    const r = removeWish(k, true);
    if (r) out.push(r);
  });
  return out;
}
// (v308.3) A marker added back by hand (ticked in Markers or its details, Tick all shown, Add a set, Scan's Add) is
// a fresh one: its Running low or Dry mark goes, so it's in palettes and guides again (a dry one had been left out
// without a word). Call it before wishOwnedOff, so the marker leaves To buy as any other added one does. Returns the
// marks taken, {k: 'low'|'dry'}, for inkPutBack (Undo, or storage full). Undo of an untick, a restore and Bought
// don't come here.
function inkAddedOff(keys) {
  const out = {};
  keys.forEach(function (k) {
    if (!state.ink[k]) return;
    out[k] = state.ink[k];
    delete state.ink[k];
  });
  return out;
}
function inkPutBack(m) {
  if (m)
    Object.keys(m).forEach(function (k) {
      state.ink[k] = m[k];
    });
}
function wishPutBack(rs) {
  for (let q = rs.length - 1; q >= 0; q--)
    if (!isWished(rs[q].w.k)) state.wish.splice(Math.min(rs[q].j, state.wish.length), 0, rs[q].w);
}
// a backup's list and ink: replacing (the person chose the backup's markers) takes the backup's; otherwise the two lists
// merge. The caller saves (and puts everything back if that fails), then calls wishChanged.
// mine (v305): your markers, when they stay (Keep mine, or the backup has the same ones). The backup's ink marks come
// in only for markers in it, and yours win; its To buy entries come in, once each, for markers not in it, or in it and
// now marked Running low or dry. Returns what came in: { wish, low, dry } (how many entries and marks of each).
function wishRestore(o, replace, mine) {
  const got = { wish: 0, low: 0, dry: 0 };
  if (!o || Array.isArray(o)) return got;
  const w = Array.isArray(o.wish) ? cleanWish(o.wish) : null,
    ink = o.ink && typeof o.ink === 'object' ? cleanInk(o.ink) : null;
  if (replace) {
    if (w) state.wish = w;
    if (ink) state.ink = ink;
    return got;
  }
  if (ink)
    Object.keys(ink).forEach(function (k) {
      if (state.ink[k] || (mine && !mine.has(k))) return;
      state.ink[k] = ink[k];
      got[ink[k]]++;
    });
  if (w)
    w.forEach(function (x) {
      if (isWished(x.k) || (mine && mine.has(x.k) && !state.ink[x.k])) return;
      state.wish.push(x);
      got.wish++;
    });
  return got;
}

/* ---- the buttons ---- */
function wishLabel(on) {
  return on ? '✓ To buy' : '+ To buy';
}
function wishAria(k, on) {
  return (on ? 'On your To buy list: ' : 'Add to your To buy list: ') + wishName(k);
}
function wishBtnHTML(k, why, short) {
  const on = isWished(k);
  return (
    '<button type="button" class="wishbtn' +
    (short ? ' short' : '') +
    (on ? ' on' : '') +
    '" data-wk="' +
    esc(k) +
    '" data-why="' +
    esc(why || '') +
    '" aria-pressed="' +
    on +
    '" aria-label="' +
    esc(wishAria(k, on)) +
    '">' +
    wishLabel(on) +
    '</button>'
  );
}
function wishChipHTML(k, why, inner, cls) {
  const on = isWished(k);
  return (
    '<button type="button" class="wishchip wishbtn' +
    (cls ? ' ' + cls : '') +
    (on ? ' on' : '') +
    '" data-wk="' +
    esc(k) +
    '" data-why="' +
    esc(why || '') +
    '" data-wv="chip" aria-pressed="' +
    on +
    '" aria-label="' +
    esc(wishAria(k, on)) +
    '" title="' +
    (on ? 'On your To buy list' : 'Add to your To buy list') +
    '">' +
    inner +
    '<b class="wmk" aria-hidden="true">' +
    (on ? '✓' : '+') +
    '</b></button>'
  );
}
function wishAllLabel(pairs) {
  return pairs.every(function (p) {
    return isWished(p[0]);
  })
    ? '✓ All on your To buy list'
    : 'Add all to To buy';
}
function wishAllHTML(pairs) {
  if (!pairs || pairs.length < 2) return '';
  return (
    ' <button type="button" class="wishall" data-wall="' +
    esc(JSON.stringify(pairs)) +
    '">' +
    wishAllLabel(pairs) +
    '</button>'
  );
}
function wishPairs(b) {
  try {
    const a = JSON.parse(b.getAttribute('data-wall'));
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}
// bring every button on the page, the To buy count and the list itself up to date
function wishChanged() {
  document.querySelectorAll('[data-wk]').forEach(function (b) {
    const on = isWished(b.getAttribute('data-wk'));
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', wishAria(b.getAttribute('data-wk'), on));
    if (b.getAttribute('data-wv') === 'chip') {
      const m = b.querySelector('.wmk');
      if (m) m.textContent = on ? '✓' : '+';
      b.title = on ? 'On your To buy list' : 'Add to your To buy list';
    } else b.textContent = wishLabel(on);
  });
  document.querySelectorAll('.wishall').forEach(function (b) {
    b.textContent = wishAllLabel(wishPairs(b));
  });
  wishChrome(state.mode === 'collection');
}
document.addEventListener(
  'click',
  function (e) {
    const b = e.target && e.target.closest ? e.target.closest('.wishbtn,.wishall') : null;
    if (!b) return;
    e.stopPropagation();
    e.preventDefault();
    // (v328 review: in To buy, drawn again by the change, the keyboard back on this button or the one in its place)
    wishFocusLater(b);
    if (b.classList.contains('wishall')) {
      const pairs = wishPairs(b),
        added = [];
      pairs.forEach(function (p) {
        if (addWish(p[0], p[1], true)) added.push(p[0]);
      });
      if (!added.length) {
        toast('They’re all on your To buy list already.', 2200);
        return;
      }
      if (
        !keep(function () {
          added.forEach(function (k) {
            removeWish(k, true);
          });
        })
      )
        return;
      wishChanged();
      toastAction(
        'Added ' + added.length + ' marker' + (added.length === 1 ? '' : 's') + ' to your To buy list.',
        'Undo',
        function () {
          added.forEach(function (k) {
            removeWish(k, true);
          });
          save();
          wishChanged();
        },
      );
      return;
    }
    const k = b.getAttribute('data-wk');
    if (isWished(k)) {
      if (removeWish(k)) toast('Took ' + wishName(k) + ' off To buy.', 2200);
    } else if (addWish(k, b.getAttribute('data-why')))
      toastHTML(
        esc(wishName(k)) + ' added to your To buy list <span class="wishwhere">(Markers › To buy)</span>',
        2600,
      );
  },
  true,
);

/* ---- the To buy view on the Markers screen ---- */
function wishChrome(col) {
  const b = typeof ownView !== 'undefined' && ownView ? ownView.querySelector('[data-v="wish"]') : null;
  if (b) {
    const t = 'To buy' + (state.wish.length ? ' (' + state.wish.length + ')' : '');
    if (b.textContent !== t) b.textContent = t;
  }
  const v = document.getElementById('wishView');
  if (!v) return;
  const on = !!col && state.collView === 'wish';
  v.style.display = on ? '' : 'none';
  if (!on) {
    v.innerHTML = '';
    return;
  }
  [
    'findWrap',
    'filterBar',
    'filters',
    'findResults',
    'ownStateWrap',
    'findActions',
    'gapWrap',
    'presetWrap',
    'mkDraw',
  ].forEach(function (id) {
    const e = document.getElementById(id);
    if (e) e.style.display = 'none';
  });
  if (typeof ownHint !== 'undefined' && ownHint)
    ownHint.textContent = state.wish.length
      ? 'Markers to pick up next time you shop. Tap Bought ✓ when you have one and it joins your collection.'
      : '';
  renderWish();
}
function wishText() {
  const by = {};
  state.wish.forEach(function (w) {
    const i = keyIdx(w.k);
    if (i == null) return;
    (by[COLORS[i].brand] = by[COLORS[i].brand] || []).push(COLORS[i].code);
  });
  const order = BRAND_DEFS.map(function (b) {
    return b.k;
  }).concat(
    Object.keys(by).filter(function (b) {
      return !BRAND_DEFS.some(function (d) {
        return d.k === b;
      });
    }),
  );
  return order
    .filter(function (b) {
      return by[b];
    })
    .map(function (b) {
      return b + ': ' + by[b].join(', ');
    })
    .join(' · ');
}
/* ---- (v316) Buy next, from your guides ----
   On To buy, after your own list: the markers your saved guides' blend plans would ask you to buy ("To complete every blend, add
   …", 88-coverage-blend), across every guide in the Library without opening one, from each Library row's markers
   (SF.guideWants), ranked by how many guides want each; and the markers your guides were planned with that are dry or
   no longer yours (their sections show stand-ins). Nothing with no guides, or with no markers of your own (guides then
   use every marker). A tap adds one to To buy with the plan's own reason ("blend for G315"); Add all adds the lot.
   Worked out when To buy shows, and kept until your markers, your ink, Brands I'd buy or the Library change (guideBuys'
   signature): about 5 ms for 16 guides, 15 ms for 50, as most guides share markers (the memo). */
let _gbuy = null;
const GBUY_SHOW = 8;
function guideBuysSig() {
  const gs = state.saved.filter((s) => s.type === 'guide');
  return (
    gs.map((g) => g.id + ':' + (g.ts || 0) + ':' + (g.keys || []).length).join(',') +
    '|' +
    state.owned.size +
    ':' +
    [...state.owned].join(',') +
    '|' +
    JSON.stringify(state.ink) +
    '|' +
    JSON.stringify(state.buyBrands || null) +
    // (fourth pass: and what your caps say, as its lines name your markers by them: "Lighter than R6")
    '|' +
    JSON.stringify([state.cap, state.capDef])
  );
}
function guideBuys() {
  const sig = guideBuysSig();
  if (_gbuy && _gbuy.sig === sig) return _gbuy;
  const gs = state.saved.filter((s) => s.type === 'guide' && Array.isArray(s.keys) && s.keys.length),
    out = { sig: sig, n: gs.length, want: [], gone: [], ms: 0 };
  _gbuy = out;
  if (!gs.length || !state.owned.size || !(window.SF && SF.guideWants)) return out;
  const t0 = performance.now(),
    list = sfCollection(),
    memo = {},
    want = {},
    gone = {};
  gs.forEach(function (g) {
    let w;
    try {
      // (a row saved before v316 has no rule: v315's, 2)
      w = SF.guideWants(g.keys, [0, 1, 2, 3, 4].indexOf(g.fr) >= 0 ? g.fr : 2, list, memo);
    } catch (_) {
      return;
    }
    Object.keys(w.want).forEach(function (k) {
      const x = w.want[k];
      if (!want[k]) want[k] = { k: k, m: x.m, gs: [], for: [], side: x.side };
      want[k].gs.push(g.name || '');
      x.for.forEach(function (c) {
        if (want[k].for.indexOf(c) < 0) want[k].for.push(c);
      });
    });
    Object.keys(w.gone).forEach(function (k) {
      if (!gone[k]) gone[k] = { k: k, m: w.gone[k].m, dry: w.gone[k].dry, gs: [] };
      gone[k].gs.push(g.name || '');
    });
  });
  const byUse = (a, b) => b.gs.length - a.gs.length || b.for.length - a.for.length || b.m.lab[0] - a.m.lab[0];
  out.want = Object.values(want).sort(byUse);
  out.gone = Object.values(gone).sort((a, b) => b.gs.length - a.gs.length || b.m.lab[0] - a.m.lab[0]);
  out.ms = performance.now() - t0;
  return out;
}
let _gbuyAll = false;
// (the brand letter where the list mixes brands, as the plan's chips show it: an Ohuhu owner sees Copic B37 as "C B37")
function guideBuysRow(x, why, reason, tags) {
  const c = x.m,
    inner = '<i style="background:' + esc(c.hex) + '"></i>' + (tags ? bTag(c.brand) + ' ' : '') + esc(c.code);
  return (
    '<div class="gbrow"><span class="gbwho">' +
    wishChipHTML(x.k, why, inner, '') +
    '</span><span class="gbwhy">' +
    reason +
    '</span></div>'
  );
}
function guideBuysHTML() {
  const g = guideBuys();
  if (!g.n || !state.owned.size) return '';
  const nG = g.n,
    inN = (x) => (nG === 1 ? 'your guide' : x.gs.length + ' of your ' + nG + ' guides'),
    // (every one of your guides: "your guide", "both your guides", "all 5 of your guides")
    allG = nG === 1 ? 'your guide' : nG === 2 ? 'both your guides' : 'all ' + nG + ' of your guides',
    // (a marker you unticked yourself isn't offered back: only one marked dry is)
    gone = g.gone.filter((x) => x.dry),
    all = g.want.length + gone.length;
  if (!all)
    return (
      '<div class="gbuy ok"><b>✓ Every blend in ' + allG + ' is complete</b> — nothing to buy for them.</div>'
    );
  // (one already on the list is in the list above, with its reason: not shown twice)
  // (how many of the markers the line counts are on the list already: the blends' markers, or with none the dry ones)
  const counted = g.want.length ? g.want : gone,
    listed = counted.filter((x) => isWished(x.k)).length,
    rows = [],
    bs = {};
  gone.concat(g.want).forEach(function (x) {
    bs[x.m.brand] = 1;
  });
  state.owned.forEach(function (k) {
    bs[k.slice(0, k.indexOf('|'))] = 1;
  });
  const tags = Object.keys(bs).length > 1,
    pairs = [];
  gone.forEach(function (x) {
    const why = 'dry · ' + nWord(x.gs.length, 'guide') + (x.gs.length === 1 ? ' uses it' : ' use it');
    pairs.push([x.k, why]);
    if (isWished(x.k)) return;
    rows.push(
      guideBuysRow(
        x,
        why,
        '<b>Dry</b> · ' +
          (nG === 1 ? 'your guide uses it' : x.gs.length + ' of your ' + nG + ' guides use it'),
        tags,
      ),
    );
  });
  g.want.forEach(function (x) {
    const fors = x.for.slice(0, 3).join(', ') + (x.for.length > 3 ? ' +' + (x.for.length - 3) : ''),
      why = 'blend for ' + x.for[0];
    pairs.push([x.k, why]);
    if (isWished(x.k)) return;
    rows.push(
      guideBuysRow(
        x,
        why,
        '<b>' + (x.side === 'lighter' ? 'Lighter' : 'Darker') + ' than ' + esc(fors) + '</b> · ' + inN(x),
        tags,
      ),
    );
  });
  const sum =
    (g.want.length
      ? nWord(g.want.length, 'marker') + ' would complete every blend in ' + allG
      : nWord(gone.length, 'marker') +
        (nG === 1 ? ' your guide uses ' : ' your guides use ') +
        (gone.length === 1 ? 'is' : 'are') +
        ' dry') +
    (listed ? ' · ' + (listed === counted.length ? 'all' : listed) + ' on your list' : '') +
    '.';
  if (!rows.length) return '<div class="gbuy ok"><b>✓ From your guides:</b> ' + sum + '</div>';
  const shown = _gbuyAll ? rows : rows.slice(0, GBUY_SHOW);
  return (
    '<div class="gbuy"><div class="gbhead"><b>From your guides</b><span class="gbsum">' +
    sum +
    '</span></div>' +
    shown.join('') +
    (rows.length > shown.length
      ? '<button type="button" class="gbmore" id="gbMore">Show all ' + rows.length + '</button>'
      : '') +
    '<div class="gbacts">' +
    wishAllHTML(pairs) +
    '</div></div>'
  );
}
document.addEventListener('click', function (e) {
  const b = e.target.closest ? e.target.closest('#gbMore') : null;
  if (!b) return;
  wishFocusLater(b);
  _gbuyAll = true;
  renderWish();
});
// (v328 review) a control in To buy that its own change draws again: the keyboard, if it was on it, back on the same
// one (by its marker), else the button now where it was
function wishFocusLater(b) {
  const v = document.getElementById('wishView');
  if (!v || !v.contains(b) || document.activeElement !== b) return;
  const sel = 'button',
    at = [...v.querySelectorAll(sel)].indexOf(b),
    wk = b.getAttribute('data-wk'),
    wall = b.classList.contains('wishall'),
    // (v328 review 2: a "From your guides" chip, whose row goes once it's added: the chip now in its place)
    chips = function () {
      return [...v.querySelectorAll('.gbuy .wishchip')];
    },
    chipAt = chips().indexOf(b);
  setTimeout(function () {
    if (b.isConnected && document.activeElement === b) return;
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    const same = wk
      ? v.querySelector('[data-wk="' + (window.CSS && CSS.escape ? CSS.escape(wk) : wk) + '"]')
      : wall
        ? v.querySelector('.wishall')
        : null;
    if (same && same.getClientRects().length) same.focus({ preventScroll: true });
    else if (chipAt >= 0 && chips().length)
      chips()[Math.min(chipAt, chips().length - 1)].focus({ preventScroll: true });
    else focusKept(true, v, sel, at, []);
  }, 0);
}
function renderWish() {
  const v = document.getElementById('wishView');
  if (!v) return;
  const n = state.wish.length;
  if (!n) {
    v.innerHTML =
      '<div class="wishempty"><b>Your To buy list is empty.</b> Wherever Marker Studio suggests a marker you don’t have, tap <b>+ To buy</b> to add it here: in <b>Match a colour</b>, a marker’s details (press and hold one), and a guide’s blend plan, shading and photo notes. Mark a marker as <b>Running low</b> in its details, then tap <b>+ To buy</b> for a replacement.</div>' +
      guideBuysHTML() +
      buyRowHTML();
    return;
  }
  const by = {};
  state.wish.forEach(function (w) {
    const i = keyIdx(w.k);
    if (i != null) (by[COLORS[i].brand] = by[COLORS[i].brand] || []).push({ w: w, i: i });
  });
  let h = '<div class="pile-head"><span class="lbl">To buy</span><span class="n">(' + n + ')</span></div>';
  BRAND_DEFS.map(function (b) {
    return b.k;
  })
    .concat(
      Object.keys(by).filter(function (b) {
        return !BRAND_DEFS.some(function (d) {
          return d.k === b;
        });
      }),
    )
    .forEach(function (br) {
      const list = by[br];
      if (!list) return;
      h +=
        '<div class="rghead">' +
        esc(br) +
        ' <span class="rgn">' +
        list.length +
        '</span></div>' +
        list
          .map(function (o) {
            const c = COLORS[o.i],
              own = isOwned(o.i),
              ink = state.ink[o.w.k];
            return (
              '<div class="wrow" data-k="' +
              esc(o.w.k) +
              '"><button type="button" class="wsw" data-open="' +
              o.i +
              '" style="background:' +
              c.hex +
              '" aria-label="' +
              esc(c.brand + ' ' + c.code + ' details') +
              '"></button><div class="wtx" data-open="' +
              o.i +
              '"><div class="wcode"><b>' +
              esc(c.code) +
              '</b> ' +
              esc(c.name || '') +
              '</div><div class="wwhy">' +
              esc(o.w.why || 'added by you') +
              (own && ink && !/low|dry/.test(o.w.why || '')
                ? ' · yours is ' + (ink === 'dry' ? 'dry' : 'running low')
                : // (v305: one you own with no ink mark, from before ticking took it off, or from a backup)
                  own && !ink
                  ? ' · already yours'
                  : '') +
              // (v318.21: sold now by its code as it is; your older cap says another, caps.js)
              (capIsOld(o.i) ? ' · your cap: ' + capCode(o.i) : '') +
              '</div></div><button type="button" class="wbought" data-bought="' +
              esc(o.w.k) +
              '">Bought ✓</button><button type="button" class="wrm" data-rm="' +
              esc(o.w.k) +
              '" aria-label="' +
              esc('Remove ' + c.brand + ' ' + c.code + ' from your To buy list') +
              '">' +
              ic('x') +
              '</button></div>'
            );
          })
          .join('');
    });
  h +=
    '<div class="wishacts"><button type="button" id="wishCopy">Copy list</button>' +
    (navigator.share ? '<button type="button" id="wishShare">Share list</button>' : '') +
    '</div>' +
    // (v316: what your guides would have you buy, after your own list: on a phone it had pushed the list off the first
    // screen; just above Brands I'd buy, which changes what it suggests)
    guideBuysHTML() +
    // (which brands the suggestions to buy come from, v304)
    buyRowHTML();
  v.innerHTML = h;
}
function wishRefresh() {
  if (state.mode === 'collection') fullRender();
  else wishChanged();
  if (
    typeof mkOpenIdx !== 'undefined' &&
    mkOpenIdx != null &&
    document.getElementById('mkOverlay').classList.contains('on')
  )
    mkFill(mkOpenIdx);
}
// Bought: it joins your collection (a running-low or dry one is fresh again) and leaves the list, with Undo
function wishBought(k) {
  const i = keyIdx(k);
  if (i == null) return;
  const had = state.owned.has(k),
    ink = state.ink[k],
    r = removeWish(k, true),
    // (v318.21: a pen bought now has the cap of now, R213 not R6: caps.js)
    cap = state.cap[k],
    capNew = capHasOld(COLORS[i]);
  state.owned.add(k);
  delete state.ink[k];
  if (capNew) state.cap[k] = 'new';
  const capBack = function () {
    if (!capNew) return;
    if (cap) state.cap[k] = cap;
    else delete state.cap[k];
  };
  if (
    !keep(function () {
      if (!had) state.owned.delete(k);
      if (ink) state.ink[k] = ink;
      if (r) state.wish.splice(r.j, 0, r.w);
      capBack();
    })
  )
    return;
  // (v318.21 debug: everything that shows its code, not only an open guide: Markers, palettes)
  if (capNew) capRedraw();
  wishRefresh();
  toastAction(
    had && ink
      ? wishName(k) + ' is fresh again — ink set back to OK.'
      : had
        ? 'Removed ' + wishName(k) + ' from To buy.'
        : 'Added ' + wishName(k) + ' to your collection.',
    'Undo',
    function () {
      if (!had) state.owned.delete(k);
      if (ink) state.ink[k] = ink;
      if (r && !isWished(k)) state.wish.splice(Math.min(r.j, state.wish.length), 0, r.w);
      capBack();
      save();
      if (capNew) capRedraw();
      wishRefresh();
    },
  );
}
(function () {
  const v = document.getElementById('wishView');
  if (!v) return;
  v.addEventListener('click', function (e) {
    const t = e.target.closest('button,[data-open]');
    if (!t) return;
    // (v318.22 debug: the keyboard on the next row's same button once its row has gone, else the list's first)
    const kept = function (sel) {
      const at = [...v.querySelectorAll(sel)].indexOf(t),
        had = document.activeElement === t;
      return function () {
        focusKept(had, v, sel, at, v.querySelector('button'));
      };
    };
    if (t.dataset.bought) {
      const k = kept('[data-bought]');
      wishBought(t.dataset.bought);
      k();
      return;
    }
    if (t.dataset.rm) {
      const kr = kept('[data-rm]');
      const k = t.dataset.rm,
        r = removeWish(k, true);
      if (
        r &&
        !keep(function () {
          state.wish.splice(r.j, 0, r.w);
        })
      )
        return;
      wishRefresh();
      kr();
      if (r)
        toastAction('Removed ' + wishName(k) + ' from your To buy list.', 'Undo', function () {
          if (!isWished(k)) state.wish.splice(Math.min(r.j, state.wish.length), 0, r.w);
          save();
          wishRefresh();
        });
      return;
    }
    if (t.id === 'wishCopy') {
      copyText(wishText()).then(function (ok) {
        const b = document.getElementById('wishCopy');
        if (b) {
          b.textContent = ok ? 'Copied ✓' : 'Couldn\u2019t copy';
          setTimeout(function () {
            const x = document.getElementById('wishCopy');
            if (x) x.textContent = 'Copy list';
          }, 1500);
        }
      });
      return;
    }
    if (t.id === 'wishShare') {
      try {
        const p = navigator.share({ title: 'Markers to buy', text: 'Markers to buy — ' + wishText() });
        if (p && p.catch) p.catch(function () {});
      } catch (_) {}
      return;
    }
    if (t.dataset.open != null) openMarkerSheet(+t.dataset.open);
  });
})();

/* ---- ink: the marker sheet's OK / Running low / Dry control, and the grid badge ---- */
function inkBadge(i) {
  if (!isOwned(i)) return '';
  const v = state.ink[mkey(i)];
  return v
    ? '<span class="inkb ' +
        v +
        '" title="' +
        (v === 'dry' ? 'Dry: left out of palettes and guides' : 'Running low') +
        '">' +
        (v === 'dry' ? 'dry' : 'low') +
        '</span>'
    : '';
}
function mkWishFill(i) {
  const k = mkey(i),
    own = isOwned(i),
    ink = state.ink[k] || '',
    ik = document.getElementById('mkInk'),
    wb = document.getElementById('mkWish');
  if (ik) {
    ik.style.display = own ? '' : 'none';
    ik.innerHTML = own
      ? '<div class="mkinkrow"><span class="mkinkl" id="mkInkL">Ink</span><div class="segs" role="group" aria-labelledby="mkInkL">' +
        [
          ['', 'OK'],
          ['low', 'Running low'],
          ['dry', 'Dry'],
        ]
          .map(function (p) {
            const on = ink === p[0];
            return (
              // (pressed buttons, as every other one-of-these row in the app, v287)
              '<button type="button" data-ink="' +
              p[0] +
              '" class="' +
              (on ? 'on' : '') +
              '" aria-pressed="' +
              on +
              '">' +
              p[1] +
              '</button>'
            );
          })
          .join('') +
        '</div></div>' +
        (ink === 'dry'
          ? '<div class="mkinknote">Left out of new palettes and guides until you replace it.</div>'
          : ink === 'low'
            ? '<div class="mkinknote">Still used in palettes and guides. Add a replacement to your To buy list:</div>'
            : '')
      : '';
  }
  if (wb) {
    const show = !own || !!ink;
    wb.style.display = show ? '' : 'none';
    wb.innerHTML = show
      ? wishBtnHTML(k, !own ? 'from Markers' : ink === 'dry' ? 'ran dry' : 'running low')
      : '';
  }
}
// returns false when storage is full (the ink is left as it was)
function setInk(i, v) {
  const k = mkey(i),
    was = state.ink[k];
  if (v === 'low' || v === 'dry') state.ink[k] = v;
  else delete state.ink[k];
  if (
    !keep(function () {
      if (was) state.ink[k] = was;
      else delete state.ink[k];
    })
  )
    return false;
  inkCell(i);
  if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
  if (state.mode === 'collection') {
    wishChrome(true);
    lowChipSync(true);
  }
  return true;
}
// the marker's cell on the Markers screen, drawn again with its ink badge
function inkCell(i) {
  const el =
    typeof results !== 'undefined' && results ? results.querySelector('.cell[data-i="' + i + '"]') : null;
  if (el) {
    const rb = el.querySelector('.rankb'),
      t = document.createElement('div');
    t.innerHTML = cellHtml(i, rb ? +rb.textContent : 0);
    el.replaceWith(t.firstChild);
  }
}
/* (v306) "Did any run low?" after a page is finished (the guide's 88-coverage-blend.js): one tap marks a marker
   Running low and puts it on To buy, in one save. */
// its ink for that row: null when it isn't yours (or lays no colour, the Colorless Blender), else '', 'low' or 'dry'
function lowInk(k) {
  const i = keyIdx(k);
  if (i == null || NOINK.has(i) || !isOwned(i)) return null;
  return state.ink[k] || '';
}
// Running low and on To buy (if it wasn't), in one save: storage full puts both back and returns null. Else
// { k, added }: added, whether this put it on To buy (Undo takes it off again only then)
function lowMark(k) {
  if (lowInk(k) !== '') return null;
  const added = !isWished(k);
  state.ink[k] = 'low';
  if (added) state.wish.push({ k: k, why: 'running low', ts: Date.now() });
  if (
    !keep(function () {
      delete state.ink[k];
      if (added) removeWish(k, true);
    })
  )
    return null;
  inkCell(keyIdx(k));
  wishChanged();
  return { k: k, added: added };
}
// back to OK (Undo, or its chip tapped again), and off To buy when dropWish (the tap that marked it put it there)
function lowUnmark(k, dropWish) {
  if (lowInk(k) !== 'low') return false;
  const r = dropWish ? removeWish(k, true) : null;
  delete state.ink[k];
  if (
    !keep(function () {
      state.ink[k] = 'low';
      if (r) wishPutBack([r]);
    })
  )
    return false;
  inkCell(keyIdx(k));
  wishChanged();
  return true;
}
(function () {
  const ik = document.getElementById('mkInk');
  if (!ik) return;
  ik.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-ink]');
    if (!b || typeof mkOpenIdx === 'undefined' || mkOpenIdx == null) return;
    const i = mkOpenIdx,
      v = b.getAttribute('data-ink');
    if ((state.ink[mkey(i)] || '') === v) return;
    const kb = document.activeElement === b,
      ok = setInk(i, v);
    mkFill(i);
    // (v328 review 2: the buttons are drawn again: the keyboard on the one pressed, not lost under the sheet)
    if (kb) {
      const nb = ik.querySelector('button[data-ink="' + v + '"]');
      if (nb) nb.focus({ preventScroll: true });
    }
    if (!ok) return;
    toast(
      v === 'dry'
        ? capCode(i) + ' marked dry — left out of new palettes and guides.'
        : v === 'low'
          ? capCode(i) + ' marked running low.'
          : capCode(i) + ' ink set back to OK.',
      2400,
    );
  });
})();

// the guide's side of the list: its api gains addWish / isWished and the button builders
(function () {
  if (!window.SF || typeof SF.configure !== 'function') return;
  const cf = SF.configure;
  SF.configure = function (a) {
    a = a || {};
    a.addWish = addWish;
    a.isWished = isWished;
    a.wishChip = wishChipHTML;
    a.wishAll = wishAllHTML;
    a.wishBtn = wishBtnHTML;
    // (v306: Did any run low?)
    a.lowInk = lowInk;
    a.lowMark = lowMark;
    a.lowUnmark = lowUnmark;
    a.ownsAny = function () {
      return state.owned.size > 0;
    };
    return cf(a);
  };
})();

/* ---- Brands I'd buy (v304) ----
   Which brands a marker to buy is suggested from, in Match, a guide's shading and blend plan and the Photo pattern:
   automatic (your brands first; another brand only when it's clearly closer: matchNearest), or only the brands ticked
   (state.buyBrands). Kept with the collection, and in backups. */
// your brands as Match has them: those of the markers you own that lay down colour (not a Colorless Blender alone)
function buyOwnBrands() {
  const s = new Set();
  for (let i = 0; i < COLORS.length; i++) if (!NOINK.has(i) && isOwned(i)) s.add(COLORS[i].brand);
  return allBrands().filter((b) => s.has(b));
}
const buyAnd = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '');
function buySummary() {
  const b = state.buyBrands;
  if (!b) return 'Your brands first';
  return b.length >= allBrands().length ? 'All brands' : b.join(', ');
}
function buyRowHTML() {
  return (
    '<button type="button" class="presethdr scanopen buyopen" id="wishBuyOpen"><span>Brands I’d buy</span><span class="buysum">' +
    esc(buySummary()) +
    '</span>' +
    '<span class="presetcar" aria-hidden="true"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-chevron-right"/></svg></span>' +
    '</button>'
  );
}
function buySumSync() {
  document.querySelectorAll('.buyopen .buysum').forEach(function (e) {
    e.textContent = buySummary();
  });
}
let _buyFrom = null,
  _buyPick = null;
function buyRender() {
  const pick = !!_buyPick;
  document.querySelectorAll('#buyMode button').forEach(function (b) {
    const on = (b.dataset.m === 'pick') === pick;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const ch = document.getElementById('buyChips');
  ch.hidden = !pick;
  ch.innerHTML = allBrands()
    .map(function (b) {
      const on = pick && _buyPick.indexOf(b) >= 0;
      return (
        '<button type="button" class="chip" data-b="' +
        esc(b) +
        '" data-sel="' +
        (on ? 1 : 0) +
        '" aria-pressed="' +
        on +
        '">' +
        esc(b) +
        '</button>'
      );
    })
    .join('');
  const own = buyOwnBrands();
  document.getElementById('buyNote').textContent = pick
    ? _buyPick.length
      ? 'Only ' + buyAnd(_buyPick) + ' markers are suggested to buy.'
      : 'Tick at least one brand.'
    : own.length
      ? buyAnd(own) +
        ' first, as you have ' +
        (own.length > 1 ? 'those' : 'that brand') +
        '. Another brand’s marker only when it’s clearly closer, or nothing of yours fits.'
      : 'With no markers in your collection yet, every brand.';
  document.getElementById('buyDone').disabled = pick && !_buyPick.length;
}
function openBuy(from) {
  const ov = document.getElementById('buyOverlay');
  if (!ov) return;
  _buyFrom = from || null;
  _buyPick = state.buyBrands ? state.buyBrands.slice() : null;
  buyRender();
  openDialog(ov);
  const f = ov.querySelector('#buyMode button.on');
  if (f) f.focus();
}
// what's chosen is kept on Done (or the box's close, Escape, Back: the same; with no brand ticked, what was kept
// before stays)
function closeBuy() {
  const ov = document.getElementById('buyOverlay');
  if (!ov || !ov.classList.contains('on')) return;
  const nb = !_buyPick ? null : _buyPick.length ? _buyPick.slice() : state.buyBrands,
    was = JSON.stringify(state.buyBrands);
  closeDialog(ov);
  if (JSON.stringify(nb) !== was) {
    const old = state.buyBrands;
    state.buyBrands = nb;
    if (!save()) state.buyBrands = old;
    else {
      if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
      // (v328 review: Markers' orders and To buy's suggestions go by these brands: drawn again)
      wishRefresh();
    }
  }
  buySumSync();
  // (the opener, or the one drawn again in its place: by its id, or the first shown)
  const again =
      _buyFrom && !_buyFrom.isConnected && _buyFrom.id ? document.getElementById(_buyFrom.id) : null,
    r =
      _buyFrom && _buyFrom.isConnected
        ? _buyFrom
        : again && again.offsetParent
          ? again
          : Array.prototype.find.call(document.querySelectorAll('.buyopen'), function (b) {
              return !!b.offsetParent;
            });
  if (r) r.focus();
  _buyFrom = null;
}
(function () {
  const ov = document.getElementById('buyOverlay');
  if (!ov) return;
  ov.addEventListener('click', function (e) {
    if (e.target === ov) return closeBuy();
    const t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.id === 'buyClose' || t.id === 'buyDone') return closeBuy();
    if (t.dataset.m) {
      // (Only these: starting from your brands, or every brand with none)
      if (t.dataset.m === 'pick' && !_buyPick) {
        const own = buyOwnBrands();
        _buyPick = own.length ? own : allBrands();
      } else if (t.dataset.m === 'auto') _buyPick = null;
      buyRender();
      return;
    }
    if (t.dataset.b && _buyPick) {
      const b = t.dataset.b,
        k = _buyPick.indexOf(b);
      if (k >= 0) _buyPick.splice(k, 1);
      else _buyPick = allBrands().filter((x) => x === b || _buyPick.indexOf(x) >= 0);
      buyRender();
      const again = document.querySelector('#buyChips [data-b="' + b + '"]');
      if (again) again.focus();
    }
  });
  document.addEventListener('click', function (e) {
    const t = e.target.closest ? e.target.closest('.buyopen') : null;
    if (t) openBuy(t);
  });
  buySumSync();
})();
