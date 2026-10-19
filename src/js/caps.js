/* ===== The code on your cap (v318.21) =====
   In June 2025 Ohuhu gave 362 of its 364 markers new codes and many new names: R6 Rose Red is R213 Pomegranate now.
   Caps made before then still say R6 Rose Red, and a collection can hold both kinds. The app keeps each marker by its
   code as it is now (saved collections, guides, backups and the colour engine never change), and remembers, marker by
   marker, which its cap says, from how it came in: a code read by Scan (photo, typed or pasted), Bought ✓ on the
   shopping list (a new pen: the current cap), or the switch in the marker's details. What it knows nothing about follows
   one setting, "Other Ohuhu markers show: current codes / older codes". Then the code and name you're shown, in guides,
   keys, Colour along, Markers and Scan, are your cap's, with "now R213" beside an older one; the shopping list leads
   with the code sold now.
   state.cap: {'Ohuhu|R213': 'old'|'new'} (only markers with an older code; kept when unticked: the cap's still the cap);
   state.capDef: 'old' when markers with nothing known show their older code (Ohuhu's; Copic's eight renamed
   fluorescents go by what's known only); state.capQ: the one-time question answered or closed; state.capOffer: Scan's
   offer to switch the setting made. */

// a marker with an older code of its own (not one where the old and the new are the same)
function capHasOld(c) {
  return !!(c && c.old && c.old !== c.code);
}
// (from COLORS alone: state.js cleans the saved state with it before mkey and keyIdx exist)
var _capKeys = null;
function cleanCap(o) {
  if (!_capKeys)
    _capKeys = new Set(
      COLORS.filter(capHasOld).map(function (c) {
        return c.brand + '|' + c.code;
      }),
    );
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o))
    Object.keys(o).forEach(function (k) {
      if (_capKeys.has(k) && (o[k] === 'old' || o[k] === 'new')) out[k] = o[k];
    });
  return out;
}
// x: a COLORS index, a key ('Ohuhu|R213'), or a marker as the guide holds it ({mkey} or {brand, code})
function capIdx(x) {
  if (x == null) return null;
  if (typeof x === 'number') return COLORS[x] ? x : null;
  if (typeof x === 'string') return keyIdx(x);
  return keyIdx(x.mkey || x.brand + '|' + x.code);
}
// whether the marker's cap is an older one: yours (a marker you don't have shows the code sold now), with an older
// code, and known to be older, or nothing known and the setting says older
function capIsOld(x) {
  const i = capIdx(x);
  if (i == null) return false;
  const c = COLORS[i];
  if (!capHasOld(c)) return false;
  const k = c.brand + '|' + c.code;
  if (!state.owned.has(k)) return false;
  const v = state.cap[k];
  if (v) return v === 'old';
  return state.capDef === 'old' && c.brand === 'Ohuhu';
}
// (v318.22 debug) the same where you say what you have — Tick colours on a chart, and a search by a cap's name — for a
// marker not yours yet too: its cap as known (kept when unticked), else as the setting says. With older codes set, the
// chart had shown the markers you hadn't ticked by the codes sold now, so an older cap's R23 was ticked as today's R23
// (RV270 on older caps), not as the R38 it is
function capIsOldAny(x) {
  const i = capIdx(x);
  if (i == null) return false;
  const c = COLORS[i];
  if (!capHasOld(c)) return false;
  const k = c.brand + '|' + c.code;
  if (state.owned.has(k)) return capIsOld(i);
  const v = state.cap[k];
  if (v) return v === 'old';
  return state.capDef === 'old' && c.brand === 'Ohuhu';
}
function capCodeAny(x) {
  const i = capIdx(x);
  if (i == null) return '';
  return capIsOldAny(i) ? oldCode(COLORS[i]) : COLORS[i].code;
}
function capNameAny(x) {
  const i = capIdx(x);
  if (i == null) return '';
  return capIsOldAny(i) ? capOldName(COLORS[i]) : COLORS[i].name || '';
}
// the marker's name on an older cap: the one printed with its old code (cap-names.json; a short one the reader leaves
// out, "Teal", from cap-shown.json), else the same as now
function capOldName(c) {
  return (c.cap && c.cap[0]) || c.capN || c.name || '';
}
// the code and name to show for a marker: your cap's
function capCode(x) {
  const i = capIdx(x);
  if (i == null) return x && typeof x === 'object' ? x.code : '';
  return capIsOld(i) ? oldCode(COLORS[i]) : COLORS[i].code;
}
function capName(x) {
  const i = capIdx(x);
  if (i == null) return x && typeof x === 'object' ? x.name || '' : '';
  return capIsOld(i) ? capOldName(COLORS[i]) : COLORS[i].name || '';
}
// "now R213" for an older cap, else ''
function capNow(x) {
  const i = capIdx(x);
  return i != null && capIsOld(i) ? 'now ' + COLORS[i].code : '';
}
// what's shown changed (a cap's version, the setting, a marker ticked or not): the guide's labels and marks are worked
// out again where it keeps them
function capChanged() {
  if (window.SF && SF.capChanged) SF.capChanged();
}

/* ---- what a marker's cap says, from how it came in ---- */
// the version a Scan entry tells, worked out when it's read: e.cv ('old'|'new'|''), kept with the list
// (a code that's one marker's now and another's old code, R22, tells only with its name read: then it's settled)
function capCvRead(i, readOld, named) {
  const c = COLORS[i];
  if (!capHasOld(c)) return '';
  const ix = scanIndex(),
    k = scanKey(readOld ? c.old : c.code),
    clash = readOld
      ? (ix.byCode.get(k) || []).some((j) => j !== i)
      : (ix.byOld.get(k) || []).some((j) => j !== i);
  if (clash && !named) return '';
  return readOld ? 'old' : 'new';
}
// the versions an Add sets: each entry's, on markers yours after it. → {k: [was, now]} of those that change
function capFromList(list) {
  const ch = {};
  list.forEach(function (e) {
    if (e.ask || !e.cv) return;
    const k = mkey(e.i);
    if (!capHasOld(COLORS[e.i]) || !state.owned.has(k)) return;
    const was = state.cap[k] || '';
    if (was !== e.cv) ch[k] = [was, e.cv];
  });
  return ch;
}
function capApply(ch, back) {
  Object.keys(ch).forEach(function (k) {
    const v = ch[k][back ? 0 : 1];
    if (v) state.cap[k] = v;
    else delete state.cap[k];
  });
}
// whether the list would tell a cap's version not yet known for a marker that's yours already (Add is then worth
// pressing, with nothing new to add)
function capPending() {
  return scanList.some(function (e) {
    if (e.ask || !e.cv || !capHasOld(COLORS[e.i])) return false;
    const k = mkey(e.i);
    return state.owned.has(k) && (state.cap[k] || '') !== e.cv;
  });
}
// Scan's offer, once, after an Add: most of the Ohuhu caps read (not a list pasted: it may be an old list) show the
// other version than the setting gives markers with nothing known, five at least. → 'old'|'new'|''
function capOfferFor(list) {
  if (state.capOffer) return '';
  let o = 0,
    n = 0;
  list.forEach(function (e) {
    if (e.ask || !e.cv || e.pasted || COLORS[e.i].brand !== 'Ohuhu') return;
    if (e.cv === 'old') o++;
    else n++;
  });
  if (state.capDef !== 'old' && o >= 5 && o * 2 >= o + n) return 'old';
  if (state.capDef === 'old' && n >= 5 && n * 2 >= o + n) return 'new';
  return '';
}
// the setting, with Undo (from Scan's offer, the question in Colour along, or Markers)
function capSetDef(v, how) {
  const was = { d: state.capDef, q: state.capQ, o: state.capOffer };
  state.capDef = v === 'old' ? 'old' : '';
  if (how === 'offer') state.capOffer = 1;
  state.capQ = 1;
  if (
    !keep(function () {
      state.capDef = was.d;
      state.capQ = was.q;
      state.capOffer = was.o;
    })
  )
    return false;
  capRedraw();
  return function undo() {
    state.capDef = was.d;
    state.capQ = was.q;
    state.capOffer = was.o;
    save(true);
    capRedraw();
  };
}
// one marker's cap, from its own switch
function capSetOne(k, v) {
  const was = state.cap[k];
  if (v === 'old' || v === 'new') state.cap[k] = v;
  else delete state.cap[k];
  if (
    !keep(function () {
      if (was) state.cap[k] = was;
      else delete state.cap[k];
    })
  )
    return false;
  capRedraw();
  return true;
}
// "Forget what my caps say": every marker back to the setting
function capForget() {
  const was = state.cap;
  if (!Object.keys(was).length) return false;
  state.cap = {};
  if (
    !keep(function () {
      state.cap = was;
    })
  )
    return false;
  capRedraw();
  toastActions(
    'Forgot what ' + nWord(Object.keys(was).length, 'cap') + ' say',
    [
      {
        label: 'Undo',
        fn: function () {
          state.cap = was;
          save(true);
          capRedraw();
        },
      },
    ],
    8000,
  );
  return true;
}
// everything that shows codes, drawn again
function capRedraw() {
  capChanged();
  if (typeof fullRender === 'function') fullRender();
}
// the toast's button for Scan's offer: "Older codes for the rest" (or "Current codes for the rest")
function capOfferAction(v) {
  return {
    label: v === 'old' ? 'Show older codes for the rest' : 'Show current codes for the rest',
    fn: function () {
      const undo = capSetDef(v, 'offer');
      if (!undo) return;
      toastActions(
        v === 'old'
          ? 'Ohuhu markers whose caps aren’t known show the codes on older caps (R6, not R213)'
          : 'Ohuhu markers whose caps aren’t known show the codes as they are now',
        [{ label: 'Undo', fn: undo }],
        8000,
      );
    },
  };
}
function capOfferSay(v) {
  return v === 'old'
    ? ' · Most caps read have Ohuhu’s older codes'
    : ' · Most caps read have the codes as they are now';
}
// a backup's caps: replacing your markers takes its caps and its setting (a backup from before v318.21 has none:
// yours stay); otherwise its caps come in for markers you've nothing known for, yours win. → how many came in
function capRestore(o, replace) {
  if (!o || Array.isArray(o) || !o.cap || typeof o.cap !== 'object') return 0;
  const c = cleanCap(o.cap);
  if (replace) {
    state.cap = c;
    state.capDef = o.capDef === 'old' ? 'old' : '';
    if (o.capQ) state.capQ = 1;
    if (o.capOffer) state.capOffer = 1;
    return Object.keys(c).length || 1;
  }
  let n = 0;
  Object.keys(c).forEach(function (k) {
    if (state.cap[k]) return;
    state.cap[k] = c[k];
    n++;
  });
  return n;
}

/* ---- the marker's own switch, in its details (Markers) ---- */
// "My cap says  R213 Pomegranate | R6 Rose Red": for a marker of yours with an older code
function mkCapFill(i) {
  const el = document.getElementById('mkCap');
  if (!el) return;
  const c = COLORS[i],
    show = capHasOld(c) && isOwned(i);
  el.hidden = !show;
  if (!show) {
    el.innerHTML = '';
    return;
  }
  const old = capIsOld(i);
  el.innerHTML =
    '<div class="mkinkrow"><span class="mkinkl" id="mkCapL">My cap says</span><div class="segs" role="group" aria-labelledby="mkCapL">' +
    [
      ['new', c.code + ' ' + (c.name || ''), !old],
      ['old', oldCode(c) + ' ' + capOldName(c), old],
    ]
      .map(function (p) {
        return (
          '<button type="button" data-cap="' +
          p[0] +
          '" class="' +
          (p[2] ? 'on' : '') +
          '" aria-pressed="' +
          p[2] +
          '">' +
          esc(p[1].trim()) +
          '</button>'
        );
      })
      .join('') +
    '</div></div>';
}
(function () {
  const el = document.getElementById('mkCap');
  if (!el) return;
  el.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-cap]');
    if (!b || mkOpenIdx == null) return;
    const i = mkOpenIdx;
    if (!capSetOne(mkey(i), b.dataset.cap)) return;
    mkFill(i);
    const nb = el.querySelector('button[data-cap="' + b.dataset.cap + '"]');
    if (nb) nb.focus({ preventScroll: true });
  });
})();

/* ---- the one-time question, at the top of Colour along (guide/83-along.js) ---- */
// the marker to ask about: Ohuhu, yours, with an older code that isn't another Ohuhu marker's code now (R22 would be
// no help), nothing known of its cap, in the guide (the person is colouring with it: likely in hand). null: don't ask
// (answered or closed; Scan has told five caps already; the tests, unless one asks for it)
function capQPick(keys) {
  if (state.capQ) return null;
  if (window.__MS_TEST && !window.__MS_CAPQ) return null;
  if (
    Object.keys(state.cap).filter(function (k) {
      return k.indexOf('Ohuhu|') === 0;
    }).length >= 5
  )
    return null;
  const ix = scanIndex(),
    skip = capQSkips();
  for (const k of keys) {
    const i = keyIdx(k),
      c = i != null ? COLORS[i] : null;
    if (
      !c ||
      c.brand !== 'Ohuhu' ||
      !capHasOld(c) ||
      !state.owned.has(k) ||
      state.cap[k] ||
      skip.indexOf(k) >= 0
    )
      continue;
    if ((ix.byCode.get(scanKey(c.old)) || []).some((j) => COLORS[j].brand === 'Ohuhu')) continue;
    return i;
  }
  return null;
}
// (v318.21 debug) "I don't have it": that marker isn't asked about again on this device, another is; three such and the
// question goes for good (a per-viewer convenience, kept in this browser's storage only)
const CAPQ_SKIP = 'ms-capq-skip';
function capQSkips() {
  try {
    const a = JSON.parse(localStorage.getItem(CAPQ_SKIP) || '[]');
    return Array.isArray(a) ? a.filter((k) => typeof k === 'string') : [];
  } catch (_) {
    return [];
  }
}
// an answer: 'new' (R213), 'old' (R6), 'mix' (some of each), 'none' (I don't have it), 'close'. → its Undo, or null
function capAnswer(i, a) {
  const k = mkey(i),
    was = { c: state.cap[k], d: state.capDef, q: state.capQ },
    skips = capQSkips();
  if (a === 'new' || a === 'old') state.cap[k] = a;
  state.capDef = a === 'old' ? 'old' : a === 'new' || a === 'mix' ? '' : state.capDef;
  if (a === 'none' && skips.length < 2) {
    try {
      localStorage.setItem(CAPQ_SKIP, JSON.stringify(skips.concat([k])));
    } catch (_) {}
  } else state.capQ = 1;
  const back = function () {
    if (was.c) state.cap[k] = was.c;
    else delete state.cap[k];
    state.capDef = was.d;
    state.capQ = was.q;
    if (a === 'none')
      try {
        localStorage.setItem(CAPQ_SKIP, JSON.stringify(skips));
      } catch (_) {}
  };
  if (!keep(back)) return null;
  capRedraw();
  return function () {
    back();
    save(true);
    capRedraw();
  };
}
