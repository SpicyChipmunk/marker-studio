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
// a backup's list and ink: replacing (the person chose the backup's markers) takes the backup's; otherwise the two lists
// merge. The caller saves (and puts everything back if that fails), then calls wishChanged.
function wishRestore(o, replace) {
  if (!o || Array.isArray(o)) return;
  const w = Array.isArray(o.wish) ? cleanWish(o.wish) : null,
    ink = o.ink && typeof o.ink === 'object' ? cleanInk(o.ink) : null;
  if (replace) {
    if (w) state.wish = w;
    if (ink) state.ink = ink;
  } else {
    if (w)
      w.forEach(function (x) {
        if (!isWished(x.k)) state.wish.push(x);
      });
    if (ink)
      Object.keys(ink).forEach(function (k) {
        if (!state.ink[k]) state.ink[k] = ink[k];
      });
  }
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
      if (removeWish(k)) toast('Took ' + esc(wishName(k)) + ' off your To buy list.', 2200);
    } else if (addWish(k, b.getAttribute('data-why')))
      toast(
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
function renderWish() {
  const v = document.getElementById('wishView');
  if (!v) return;
  const n = state.wish.length;
  if (!n) {
    v.innerHTML =
      '<div class="wishempty"><b>Your To buy list is empty.</b> Wherever Marker Studio suggests a marker you don’t have, tap <b>+ To buy</b> to add it here: in <b>Match a colour</b>, a marker’s details (press and hold one), and a guide’s blend plan, shading and photo notes. Mark a marker as <b>Running low</b> in its details to add a replacement.</div>';
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
                : '') +
              '</div></div><button type="button" class="wbought" data-bought="' +
              esc(o.w.k) +
              '">Bought ✓</button><button type="button" class="wrm" data-rm="' +
              esc(o.w.k) +
              '" aria-label="' +
              esc('Remove ' + c.brand + ' ' + c.code + ' from your To buy list') +
              '">✕</button></div>'
            );
          })
          .join('');
    });
  h +=
    '<div class="wishacts"><button type="button" id="wishCopy">Copy list</button>' +
    (navigator.share ? '<button type="button" id="wishShare">Share list</button>' : '') +
    '</div>';
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
    r = removeWish(k, true);
  state.owned.add(k);
  delete state.ink[k];
  if (
    !keep(function () {
      if (!had) state.owned.delete(k);
      if (ink) state.ink[k] = ink;
      if (r) state.wish.splice(r.j, 0, r.w);
    })
  )
    return;
  wishRefresh();
  toastAction(
    had && ink
      ? esc(wishName(k)) + ' is fresh again — ink set back to OK.'
      : had
        ? 'Removed ' + esc(wishName(k)) + ' from To buy.'
        : 'Added ' + esc(wishName(k)) + ' to your collection.',
    'Undo',
    function () {
      if (!had) state.owned.delete(k);
      if (ink) state.ink[k] = ink;
      if (r && !isWished(k)) state.wish.splice(Math.min(r.j, state.wish.length), 0, r.w);
      save();
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
    if (t.dataset.bought) {
      wishBought(t.dataset.bought);
      return;
    }
    if (t.dataset.rm) {
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
      if (r)
        toastAction('Removed ' + esc(wishName(k)) + ' from your To buy list.', 'Undo', function () {
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
          b.textContent = ok ? 'Copied ✓' : 'Copy failed';
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
      ? '<div class="mkinkrow"><span class="mkinkl" id="mkInkL">Ink</span><div class="segs" role="radiogroup" aria-labelledby="mkInkL">' +
        [
          ['', 'OK'],
          ['low', 'Running low'],
          ['dry', 'Dry'],
        ]
          .map(function (p) {
            const on = ink === p[0];
            return (
              '<button type="button" role="radio" data-ink="' +
              p[0] +
              '" class="' +
              (on ? 'on' : '') +
              '" aria-checked="' +
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
  const el =
    typeof results !== 'undefined' && results ? results.querySelector('.cell[data-i="' + i + '"]') : null;
  if (el) {
    const rb = el.querySelector('.rankb'),
      t = document.createElement('div');
    t.innerHTML = cellHtml(i, rb ? +rb.textContent : 0);
    el.replaceWith(t.firstChild);
  }
  if (window.SF && SF.setCollection) SF.setCollection(sfCollection());
  if (state.mode === 'collection') wishChrome(true);
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
    const ok = setInk(i, v);
    mkFill(i);
    if (!ok) return;
    toast(
      v === 'dry'
        ? esc(COLORS[i].code) + ' marked dry — left out of new palettes and guides.'
        : v === 'low'
          ? esc(COLORS[i].code) + ' marked running low.'
          : esc(COLORS[i].code) + ' ink set back to OK.',
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
    return cf(a);
  };
})();
