/* ---- zones on the screen (34-zones is the model) ----
    With no zones, the Pattern tab's first line has "＋ Zone" beside "Colour pattern". Once there are zones, the
    Pattern and Colours tabs start with a row of chips, Main then each zone and ＋: the chip that's on is the zone those
    tabs edit, and tapping another switches to it (its sections flash on the picture). Tapping the chip that's on (it
    shows ✎) opens the zone editor, as ＋ does for a new zone. Shading and Share are the whole guide's, so they have no
    chips.

    The zone editor takes the Pattern tab's place: the zone's name, how many sections it has, Done and Delete zone.
    Meanwhile the picture shows the zone's sections in their colours and fades the rest, and a tap on a section, or a
    drag across several, adds them to the zone; starting on a section already in it takes sections out instead (back
    to Main). Two fingers still move and zoom the picture. Each tap or drag is one Undo step, and the zone's pattern is
    laid again over its sections as they change. Done (or another tab, Colour along, Escape) closes the editor; a new
    zone that got no sections is dropped. */
let zoneEdit = false,
  zoneS = null,
  zoneRaf = 0,
  _zFlashT = 0;
function zoneEditOn() {
  return zoneEdit && sfmode === 'guide' && !!assignData && !!labels && !!zoneCur;
}
// open the editor for zone id (a new one when id is null). kb: opened from the keyboard, so the name field takes
// the focus (by touch it doesn't: a phone's keyboard would come up over the picture that's to be tapped)
function zoneEditStart(id, kb) {
  if (!assignData || sfmode !== 'guide') return;
  if (id == null) {
    const z = zoneNew();
    if (!z) {
      toast('A guide can have ' + ZONE_MAX + ' zones besides Main.', 2200);
      return;
    }
    id = z.id;
  }
  if (paintOn) setPaint(false);
  photoEndAlign();
  shadeFlatMode = false;
  lockMode = false;
  hideTip();
  if (popOpen()) closeSwatchPop(false);
  zoneSelect(id);
  zoneEdit = true;
  outlineSecs(null);
  // (making or opening a zone isn't a change to the guide yet: adding sections to it is)
  planSync();
  if (gTab !== 'pattern') planTab('pattern');
  renderControls();
  renderGuide();
  zoneKbSync();
  sayLive('Editing zone ' + zoneName(id) + '. Tap or drag across sections to add them.');
  const n = document.getElementById('sfZoneName');
  if (n && kb)
    try {
      n.focus({ preventScroll: true });
      if (!zoneSecs(id).length) n.select();
    } catch (_) {}
}
// close the editor (a zone that got no sections goes); quiet: leave the screen to whoever called (a new picture)
function zoneEditEnd(quiet) {
  if (!zoneEdit) return;
  // (v309.1) the keyboard on one of the editor's own controls (Done, Delete zone, its name), or on nothing (Escape in
  // the name field lets go of it): those are drawn again as it closes, so it goes to the zone's chip, or ＋ Zone
  const _ae = document.activeElement,
    _kbBack = !_ae || _ae === document.body || !!(_ae.closest && _ae.closest('#sfPanel-pattern'));
  zoneEdit = false;
  if (zoneS) zoneStrokeEnd(false);
  const z = zoneById(zoneCur);
  let dropped = false;
  if (z && !zoneSecs(z.id).length && !Object.keys(z.secs).length) {
    zoneDelete(z.id);
    planSync();
    dropped = true;
  }
  if (quiet) {
    zoneKbSync();
    return;
  }
  if (dropped) toast('No sections were added, so the zone wasn\u2019t kept.', 2200);
  renderControls();
  renderGuide();
  zoneKbSync();
  const _now = document.activeElement;
  // (not when another tab closed it: that tab is where the person went)
  if (_kbBack && gTab === 'pattern' && (!_now || _now === document.body)) {
    const b = zoneChipEl(zoneCur) || document.getElementById('sfZoneAdd');
    if (b)
      try {
        b.focus({ preventScroll: true });
      } catch (_) {}
  }
}

// ---- the chips ----
function zoneChipsHTML() {
  if (!zones.length) return '';
  const chip = function (id) {
    const on = id === zoneCur,
      n = zoneSecs(id).length,
      nm = zoneName(id);
    return (
      '<button type="button" class="sfzchip' +
      (on ? ' on' : '') +
      '" data-z="' +
      id +
      '" aria-pressed="' +
      on +
      '" aria-label="' +
      esc(
        nm + ', ' + n + ' section' + (n === 1 ? '' : 's') + (on && id ? ': edit its sections and name' : ''),
      ) +
      '">' +
      esc(nm) +
      (on && id ? '<span class="sfzpen" aria-hidden="true">' + ic('pencil') + '</span>' : '') +
      '</button>'
    );
  };
  return (
    '<div class="sfzrow" role="group" aria-label="Zones">' +
    zoneIds().map(chip).join('') +
    '<button type="button" class="sfzchip sfzadd" data-z="new" aria-label="Add a zone"' +
    (zones.length >= ZONE_MAX ? ' disabled' : '') +
    '>' +
    ic('plus') +
    '</button></div>' +
    zoneEmptyNote()
  );
}
// the zone the tabs edit has no sections (Main, when every section is in a zone; or a zone whose sections all
// went to another one), so its settings change nothing for now: say so, and how to give it some
function zoneEmptyNote() {
  if (zoneSecs(zoneCur).length) return '';
  return (
    '<p class="sfznone" role="note">' +
    (zoneCur
      ? 'No sections in ' + esc(zoneName(zoneCur)) + ' now: tap its chip to add some.'
      : 'Every section is in a zone, so Main has none to colour.') +
    '</p>'
  );
}
// the Pattern tab's first line without zones: its label and ＋ Zone
function zoneAddHTML() {
  return (
    '<div class="sfglbl sfpatlbl sfzlbl"><span role="heading" aria-level="3">Colour pattern</span><button type="button" id="sfZoneAdd" class="sfzfirst" aria-label="Add a zone: give part of the picture its own pattern and colours">' +
    ic('plus') +
    ' Zone</button></div>'
  );
}
// the zone editor, in the Pattern tab's place: the name with Done beside it, so Done is in sight without scrolling,
// then how many sections, how to add them, and Delete zone last
function zoneEditorHTML() {
  const z = zoneById(zoneCur),
    n = zoneSecs(zoneCur).length;
  return (
    '<div class="sfzed"><label class="sfsublbl" for="sfZoneName">Zone name</label><div class="sfzhead"><input type="text" id="sfZoneName" class="sfzname" maxlength="24" autocomplete="off" spellcheck="false" value="' +
    esc(z ? z.name : '') +
    '"><button type="button" id="sfZoneDone" class="sfprimary sfzdone">Done</button></div><button type="button" id="sfZoneKb" class="sfghost sfzkb">Choose sections with the keys</button><div id="sfZoneN" class="sfzn" role="status">' +
    zoneCountText(n) +
    '</div>' +
    infoLine(
      'zone',
      'Tap or drag across sections to add them',
      'Tap or drag across sections to add them to this zone; start on one already in it to take sections out again. Two fingers still move and zoom the picture. The zone gets its own pattern and colours in the Pattern and Colours tabs.',
    ) +
    '<button type="button" id="sfZoneDel" class="sfghost sfzdel">Delete zone</button></div>'
  );
}
function zoneCountText(n) {
  return n
    ? '<b>' + n + '</b> section' + (n === 1 ? '' : 's') + ' in ' + esc(zoneName(zoneCur))
    : 'No sections yet: tap the picture';
}
// wire the chips, ＋ Zone and the editor (ctlPlanWire)
function zoneWire() {
  ctlEl.querySelectorAll('.sfzrow').forEach(function (g) {
    g.addEventListener('click', function (e) {
      const b = e.target.closest('.sfzchip');
      if (!b || b.disabled) return;
      const v = b.dataset.z;
      // (a click with no pointer behind it, detail 0, is Enter or Space)
      if (v === 'new') {
        zoneEditStart(null, !e.detail);
        return;
      }
      const id = +v;
      if (id === zoneCur) {
        if (id) zoneEditStart(id, !e.detail);
        return;
      }
      zoneSwitch(id);
    });
  });
  const add = document.getElementById('sfZoneAdd');
  if (add)
    add.addEventListener('click', function (e) {
      zoneEditStart(null, !e.detail);
    });
  const done = document.getElementById('sfZoneDone');
  if (done)
    done.addEventListener('click', function () {
      zoneNameCommit();
      zoneEditEnd();
      const b = zoneChipEl(zoneCur);
      if (b)
        try {
          b.focus({ preventScroll: true });
        } catch (_) {}
    });
  const kb = document.getElementById('sfZoneKb');
  if (kb)
    kb.addEventListener('click', function () {
      zoneKbSync();
      try {
        cv.focus({ preventScroll: true });
      } catch (_) {}
    });
  const del = document.getElementById('sfZoneDel');
  if (del)
    del.addEventListener('click', function () {
      const id = zoneCur,
        nm = zoneName(id),
        had = zoneSecs(id).length;
      zoneEdit = false;
      zoneDelete(id);
      zoneKbSync();
      if (had) {
        planWhy = 'Zone deleted: ' + nm;
        reassign([0]);
      } else {
        planSync();
        renderControls();
        renderGuide();
      }
      sayLive('Zone ' + nm + ' deleted' + (had ? ': its sections are back in Main' : ''));
    });
  const nm = document.getElementById('sfZoneName');
  if (nm) {
    nm.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        nm.blur();
      } else if (e.key === 'Escape') {
        // (Escape in the field puts the name back, as it does in the guide's name)
        const z = zoneById(zoneCur);
        if (z) nm.value = z.name;
        nm.blur();
      }
    });
    nm.addEventListener('change', zoneNameCommit);
  }
}
// the name field's text becomes the zone's name (empty: it keeps the one it had)
function zoneNameCommit() {
  const el = document.getElementById('sfZoneName'),
    z = zoneById(zoneCur);
  if (!el || !z) return;
  const v = el.value.replace(/\s+/g, ' ').trim().slice(0, 24);
  if (!v) {
    el.value = z.name;
    return;
  }
  if (v === z.name) return;
  z.name = v;
  guideDirty = true;
  const cnt = document.getElementById('sfZoneN'),
    n = zoneSecs(zoneCur).length;
  ctlEl.querySelectorAll('.sfzchip.on').forEach(function (b) {
    b.firstChild.textContent = v;
    // (its name for a screen reader too)
    const al = b.getAttribute('aria-label');
    if (al)
      b.setAttribute(
        'aria-label',
        v + ', ' + n + ' section' + (n === 1 ? '' : 's') + al.replace(/^.*?, \d+ sections?/, ''),
      );
  });
  if (cnt) cnt.innerHTML = zoneCountText(n);
  // (a zone with no sections yet isn't a change to the guide, nor its name: Done drops it if it stays empty)
  zoneKbSync();
  if (n) planCommit('Zone renamed: ' + v);
  else planSync();
}
// zone id's chip in the tab that's showing (Pattern and Colours each have the row)
function zoneChipEl(id) {
  const p = document.getElementById('sfPanel-' + gTab);
  return p ? p.querySelector('.sfzchip[data-z="' + id + '"]') : null;
}
// the Pattern and Colours tabs edit zone id now: its sections flash on the picture
function zoneSwitch(id) {
  zoneEditEnd(true);
  zoneSelect(id);
  planSync();
  selAnchor = -1;
  hideTip();
  if (paintOn && family !== 'manual') setPaint(false);
  renderControls();
  renderGuide();
  positionPhoto();
  zoneFlash(id);
  const _zn = zoneSecs(id).length;
  sayLive(
    'Editing ' + (id ? 'zone ' + zoneName(id) : 'Main') + ': ' + _zn + ' section' + (_zn === 1 ? '' : 's'),
  );
  const b = zoneChipEl(id);
  if (b)
    try {
      b.focus({ preventScroll: true });
    } catch (_) {}
}
// a zone's sections outlined for a moment
function zoneFlash(id) {
  clearTimeout(_zFlashT);
  const s = zoneSecs(id);
  if (!s.length || s.length === countedList().length) return;
  outlineSecs(s);
  _zFlashT = setTimeout(function () {
    if (olSet && olSet.length === s.length && olSet[0] === s[0]) outlineSecs(null);
  }, 1400);
}
// a tapped section's tip says which zone it's in, with a way to it (40-render)
function zoneTipHTML(l) {
  if (!zones.length || sfmode !== 'guide') return '';
  const id = zoneOf(l);
  return (
    '<div class="sftipzone"><span>Zone: <b>' +
    esc(zoneName(id)) +
    '</b></span>' +
    (id !== zoneCur
      ? ' <button type="button" class="sftipzb" data-a="zone" data-z="' + id + '">Edit this zone</button>'
      : '') +
    '</div>'
  );
}

// ---- adding and taking out sections: taps and drags on the picture (80-input), as Paint's strokes go ----
function zoneStrokeStart(e) {
  const P = evPt(e);
  zoneS = {
    id: e.pointerId,
    p0: P,
    last: P,
    sx: e.clientX,
    sy: e.clientY,
    pend: true,
    t: 0,
    mode: null,
    n: 0,
    seen: {},
    touched: {},
    moved: {},
  };
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') zoneGo(zoneS);
  else {
    const s = zoneS;
    s.t = setTimeout(function () {
      if (zoneS === s) zoneGo(s);
    }, 110);
  }
}
function zoneGo(s) {
  if (!s.pend) return;
  clearTimeout(s.t);
  s.pend = false;
  zoneDot(s, s.p0);
  zoneQueue();
}
function zoneStrokeMove(e) {
  const s = zoneS;
  if (!s) return;
  const P = evPt(e);
  if (s.pend) {
    if (Math.abs(e.clientX - s.sx) + Math.abs(e.clientY - s.sy) <= 6) return;
    zoneGo(s);
  }
  const dx = P.x - s.last.x,
    dy = P.y - s.last.y,
    n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let i = 1; i <= n; i++)
    zoneDot(s, { x: Math.round(s.last.x + (dx * i) / n), y: Math.round(s.last.y + (dy * i) / n) });
  s.last = P;
  zoneQueue();
}
// one section under the stroke: the first one decides whether it adds (not in the zone yet) or takes out (in it)
function zoneDot(s, P) {
  if (P.x < 0 || P.y < 0 || P.x >= W || P.y >= H) return;
  const l = labels[P.y * W + P.x];
  if (!(l > 0) || s.seen[l]) return;
  s.seen[l] = 1;
  if (!(assignData.assign[l] || (assignData.paper && assignData.paper[l]))) return;
  const inZ = zoneOf(l) === zoneCur;
  if (s.mode == null) s.mode = inZ ? 'out' : 'in';
  if ((s.mode === 'in') === inZ) return;
  zoneMove([l], s.mode === 'in' ? zoneCur : 0).forEach(function (id) {
    s.touched[id] = 1;
  });
  s.moved[l] = 1;
  s.n++;
}
function zoneQueue() {
  if (!zoneRaf)
    zoneRaf = requestAnimationFrame(function () {
      zoneRaf = 0;
      renderGuide();
    });
}
// the stroke is over: a touch that never moved is a tap on its section; the zones it changed are laid again, as one
// Undo step
function zoneStrokeEnd(tap) {
  const s = zoneS;
  if (!s) return;
  zoneS = null;
  clearTimeout(s.t);
  if (tap && s.pend) {
    s.pend = false;
    zoneDot(s, s.p0);
  }
  if (zoneRaf) {
    cancelAnimationFrame(zoneRaf);
    zoneRaf = 0;
  }
  if (!s.n) {
    renderGuide();
    return;
  }
  const ids = Object.keys(s.touched).map(Number),
    nm = zoneName(zoneCur);
  reassign(ids, s.moved);
  const cnt = document.getElementById('sfZoneN');
  if (cnt) cnt.innerHTML = zoneCountText(zoneSecs(zoneCur).length);
  sayLive(
    nm + ': ' + s.n + ' section' + (s.n === 1 ? '' : 's') + (s.mode === 'in' ? ' added' : ' taken out'),
  );
}
// is picture point P on a section of another zone than the one being edited?
function zoneTapElsewhere(P) {
  if (P.x < 0 || P.y < 0 || P.x >= W || P.y >= H) return false;
  const l = labels[P.y * W + P.x];
  return l > 0 && !!assignData && !!assignData.assign[l] && zoneOf(l) !== zoneCur;
}

/* ---- choosing sections by keyboard (v282) ----
    While the editor is open the picture can take the focus (Tab, or the "Choose sections with the keys" button that
    shows when it's reached by Tab). A ring then marks one section: the arrow keys move it to the nearest section that
    way, Space or Enter adds it to the zone or takes it out (one Undo step each), and what's under the ring is said. */
let zKbL = -1,
  zKbWired = false;
function zoneKbSync() {
  if (!cv) return;
  if (!zKbWired) {
    zKbWired = true;
    cv.addEventListener('keydown', zoneKbKey);
    cv.addEventListener('focus', function () {
      if (!zoneEditOn()) return;
      // (a tap or click focuses the picture too: the ring is for the keyboard only)
      let kb = true;
      try {
        kb = cv.matches(':focus-visible');
      } catch (_) {}
      if (!kb) return;
      if (!zoneKbOk(zKbL)) zKbL = zoneKbFirst();
      zoneKbShow(true);
    });
    cv.addEventListener('pointerdown', function () {
      if (olSet && olSet.length === 1 && olSet[0] === zKbL) outlineSecs(null);
    });
    cv.addEventListener('blur', function () {
      if (olSet && olSet.length === 1 && olSet[0] === zKbL) outlineSecs(null);
    });
  }
  if (zoneEditOn()) {
    cv.tabIndex = 0;
    // (application: a screen reader passes the arrow keys through to it)
    cv.setAttribute('role', 'application');
    cv.setAttribute(
      'aria-label',
      'Picture: the arrow keys go from section to section, Space adds one to ' +
        zoneName(zoneCur) +
        ' or takes it out',
    );
    return;
  }
  const had = document.activeElement === cv;
  if (zKbL >= 0 && olSet && olSet.length === 1 && olSet[0] === zKbL) outlineSecs(null);
  zKbL = -1;
  if (cv.hasAttribute('tabindex')) {
    cv.removeAttribute('tabindex');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Colouring page');
  }
  if (had) {
    const b = zoneChipEl(zoneCur) || document.getElementById('sfZoneAdd');
    if (b)
      try {
        b.focus({ preventScroll: true });
      } catch (_) {}
  }
}
// a section the editor can add or take out (as a tap: coloured, or left as paper)
function zoneKbOk(l) {
  return l > 0 && !!assignData && !!(assignData.assign[l] || (assignData.paper && assignData.paper[l]));
}
function zoneKbAll() {
  const out = [];
  for (let l = 1; l < comps.length; l++) if (zoneKbOk(l)) out.push(l);
  return out;
}
// where the ring starts: in the zone (its section nearest its middle), or the one nearest the picture's middle
function zoneKbFirst() {
  const mine = zoneSecs(zoneCur).filter(zoneKbOk),
    set = mine.length ? mine : zoneKbAll();
  let x = W / 2,
    y = H / 2;
  if (mine.length) {
    const b = zoneBoxOf(mine);
    x = (b.x0 + b.x1) / 2;
    y = (b.y0 + b.y1) / 2;
  }
  let best = -1,
    bd = Infinity;
  set.forEach(function (l) {
    const ex = comps[l].cx - x,
      ey = comps[l].cy - y,
      d = ex * ex + ey * ey;
    if (d < bd) {
      bd = d;
      best = l;
    }
  });
  return best;
}
// the nearest section from the ring's in direction (dx, dy): ahead of it, favouring those more in line
function zoneKbStep(dx, dy) {
  const c = comps[zKbL];
  let best = -1,
    bs = Infinity;
  zoneKbAll().forEach(function (l) {
    if (l === zKbL) return;
    const vx = comps[l].cx - c.cx,
      vy = comps[l].cy - c.cy,
      along = vx * dx + vy * dy;
    if (along <= 0.5) return;
    const sc = along + 2 * Math.abs(vx * dy - vy * dx);
    if (sc < bs) {
      bs = sc;
      best = l;
    }
  });
  return best;
}
function zoneKbSay(l) {
  const m = assignData.assign[l];
  return (m ? m.code + (m.name ? ' ' + m.name : '') : 'Left white') + ', in ' + zoneName(zoneOf(l));
}
// the ring on the section (in sight when zoomed in), and what it is said
function zoneKbShow(say) {
  if (!zoneKbOk(zKbL)) return;
  outlineSecs([zKbL]);
  if (zoom > 1) {
    const r = cv.getBoundingClientRect(),
      v = picHost().getBoundingClientRect(),
      x = r.left + (comps[zKbL].cx / W) * r.width,
      y = r.top + (comps[zKbL].cy / H) * r.height;
    if (x < v.left + 24 || x > v.right - 24 || y < v.top + 24 || y > v.bottom - 24) {
      centerOn(comps[zKbL].cx, comps[zKbL].cy, zoom);
      positionOutline();
    }
  }
  if (say) sayLive(zoneKbSay(zKbL));
}
function zoneKbKey(e) {
  if (!zoneEditOn() || e.altKey || e.ctrlKey || e.metaKey) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (d) {
    e.preventDefault();
    if (!zoneKbOk(zKbL)) zKbL = zoneKbFirst();
    else {
      const n = zoneKbStep(d[0], d[1]);
      if (n < 0) {
        sayLive('No more sections that way');
        return;
      }
      zKbL = n;
    }
    zoneKbShow(true);
    return;
  }
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  if (!zoneKbOk(zKbL)) return;
  const l = zKbL,
    inZ = zoneOf(l) === zoneCur,
    nm = zoneName(zoneCur),
    moved = {};
  moved[l] = 1;
  reassign(zoneMove([l], inZ ? 0 : zoneCur), moved);
  const n = zoneSecs(zoneCur).length,
    cnt = document.getElementById('sfZoneN');
  if (cnt) cnt.innerHTML = zoneCountText(n);
  zoneKbShow(false);
  sayLive((inZ ? 'Taken out of ' : 'Added to ') + nm + ': ' + n + ' section' + (n === 1 ? '' : 's'));
}
