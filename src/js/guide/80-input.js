// Find next: zoom in on the next section of the highlighted colour still to do, one after another
let _fnLast = -1;
// the open marker's sections in the order focus mode goes through them (markerPath: topmost, then the nearest)
function hlPath() {
  const secs = assignData.order.filter(hlMatch);
  return markerPath(secs, secBoxes());
}
// Find next: the next section not yet ticked along that path, after the one it showed last (round again at the end)
function findNext() {
  if (!hlKey || !assignData) return;
  const path = hlPath(),
    n = path.length;
  if (
    !path.some(function (l) {
      return !colored[l];
    })
  ) {
    note('Every section of this marker is coloured.');
    return;
  }
  const from = path.indexOf(_fnLast);
  let l = -1;
  for (let k = 1; k <= n; k++) {
    const c = path[(from + k + n) % n];
    if (!colored[c]) {
      l = c;
      break;
    }
  }
  _fnLast = l;
  // (to its label's point, which is always inside it, zoomed only as far as it needs, as focus mode does: v288, the
  // outline's pulse shows the tap did something; a screen reader hears it)
  const d = viewDims(),
    p = labelPos(l),
    left = path.filter(function (q) {
      return !colored[q];
    }).length;
  // (the room is the picture's frame, not the picture: a tall narrow page has room on either side of it)
  const hst = picHost();
  centerOn(
    p.x,
    p.y,
    fitZoom(secBoxes(), l, (hst && hst.clientWidth) || d.vw, (hst && hst.clientHeight) || d.dh, true),
  );
  _fnOl = true;
  _fnKey = hlKey;
  outlineSecs([l], true);
  sayLive('Next section to colour: ' + left + ' of ' + n + ' left.');
}
function jumpToNext() {
  if (!hlKey || !assignData || zoom <= 1) return;
  const l = hlPath().filter(function (x) {
    return !colored[x];
  })[0];
  if (l === undefined) return;
  centerOn(comps[l].cx, comps[l].cy, zoom);
}
function midView(a, b) {
  const q = picLocal((a.x + b.x) / 2, (a.y + b.y) / 2);
  return { x: q.x - cv.offsetLeft, y: q.y - cv.offsetTop };
}
function editTapAt(P) {
  const l = labels[P.y * W + P.x];
  // an open marker picker sheet: a tap on another section moves it there, keeping the choice (see pickTap)
  if (sfmode === 'guide' && popOpen()) {
    pickTap(l);
    return;
  }
  if (sfmode === 'guide' && shadeFlatMode) {
    if (l > 0 && assignData && assignData.assign[l]) {
      // (a section of a flat zone is flat already: say so, rather than a tap that seems to do nothing)
      if (!shadeFlat[l] && !zshOf(l).on) {
        toast(esc(zoneName(zoneOf(l))) + ' is flat, so its sections already are.', 2600);
        return;
      }
      if (shadeFlat[l]) delete shadeFlat[l];
      else shadeFlat[l] = 1;
      _flatVer++;
      guideDirty = true;
      normalizeTones();
      renderGuide();
      renderControls();
      planCommit();
    }
    return;
  }
  if (sfmode === 'guide' && lockMode) {
    if (l > 0 && assignData && assignData.assign[l]) {
      togglePin(l);
      popAt(l);
    }
    return;
  }
  // (Manual is the pattern of the zone being edited: a section of another zone gets the usual tip, which says whose
  // it is and goes there)
  if (sfmode === 'guide' && family === 'manual' && !(zones.length && l > 0 && zoneOf(l) !== zoneCur)) {
    if (l > 0 && assignData && assignData.assign[l]) {
      openSectionPop(l, { manual: true });
      renderGuide();
    }
    return;
  }
  if (sfmode === 'color') {
    if (l > 0 && assignData && assignData.assign[l]) {
      if (focus) {
        if (focusFin) return;
        if (focusSheet) {
          focusSheetSet(false);
          return;
        }
        if (l === focusCur()) focusDone();
        else {
          var _ix = -1;
          for (var _j = 0; _j < focusOrd.length; _j++) {
            if (focusOrd[_j] !== l) continue;
            if (_ix < 0) _ix = _j;
            if (!stepDone(l, stepBits(_j))) {
              _ix = _j;
              break;
            }
          }
          if (_ix >= 0) goFocus(_ix, true);
        }
      } else {
        colored[l] ^= 1;
        tp()[l] = 0;
        guideDirty = true;
        if (colored[l]) {
          popAt(l);
          if (navigator.vibrate)
            try {
              navigator.vibrate(12);
            } catch (_) {}
        }
        checkComplete();
        renderGuide();
        updateProgress();
        jumpToNext();
      }
    }
    return;
  }
  if (sfmode === 'guide') {
    if (l > 0 && assignData && assignData.assign[l]) showTip(l, true);
    else if (l > 0 && assignData && assignData.paper && assignData.paper[l])
      toast('Leave this section white \u2014 the photo is white there.', 2200);
    return;
  }
  if (sfmode !== 'review') return;
  if (editMode === 'merge') {
    if (l > 0) {
      if (mergeSel < 0) mergeSel = l;
      else if (mergeSel === l) mergeSel = -1;
      else {
        snapshotSeg();
        mergeCells(mergeSel, l);
        mergeSel = -1;
        hasEdits = true;
      }
      render();
    }
    return;
  }
  if (l > 0 && editMode === 'toggle') {
    pushUndo({ t: 'ov', d: secState.slice() });
    secState[l] = counted(l) ? 2 : 1;
    hasEdits = true;
    render();
  }
}
// the section a Split or Add stroke is for: the one it runs through furthest, lines not counted (v304: the section it
// started in, so a stroke begun on the outline did nothing, and one begun just over it tried to cut the neighbour)
function strokeSection(pts) {
  const n = {};
  let best = 0,
    bn = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i].x,
      y0 = pts[i].y,
      x1 = pts[i + 1].x,
      y1 = pts[i + 1].y,
      steps = Math.max(1, Math.hypot(x1 - x0, y1 - y0) | 0);
    for (let s = i ? 1 : 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps),
        y = Math.round(y0 + ((y1 - y0) * s) / steps);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const l = labels[y * W + x];
      if (l < 1) continue;
      const k = (n[l] || 0) + 1;
      n[l] = k;
      if (k > bn) {
        bn = k;
        best = l;
      }
    }
  }
  return best;
}
function onDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (sfmode === 'guide' && tipL >= 0) hideTip();
  if (pgMode) {
    pgPtr(e, 'down');
    return;
  }
  if (!labels) return;
  if (cv.style.transition) cv.style.transition = '';
  if (cropMode) {
    try {
      cv.setPointerCapture(e.pointerId);
    } catch (_) {}
    const P = evCanvas(e);
    cropDrag = cropPx ? cropHit(P) : 'new';
    cropStart = P;
    if (cropDrag === 'new') {
      cropPx = { x: P.x, y: P.y, w: 0, h: 0 };
    } else if (cropDrag === 'move') {
      cropAnchor = { x: cropPx.x, y: cropPx.y, w: cropPx.w, h: cropPx.h };
    } else {
      cropAnchor = { x0: cropPx.x, y0: cropPx.y, x1: cropPx.x + cropPx.w, y1: cropPx.y + cropPx.h };
    }
    drawCropOverlay();
    return;
  }
  if (photoAlign && sfmode === 'guide' && family === 'photo' && photoRef) {
    photoPtr(e, 'down');
    return;
  }
  try {
    cv.setPointerCapture(e.pointerId);
  } catch (_) {}
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    const p = [...ptrs.values()];
    pinchD = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
    pinchZ = zoom;
    pinchM = midView(p[0], p[1]);
    pinchPX = panX;
    pinchPY = panY;
    if (drawing) {
      drawing = false;
      strokePts = [];
      render();
    }
    if (paintS) paintEnd(false);
    if (zoneS) zoneStrokeEnd(false);
    multi = true;
    return;
  }
  // the zone editor: one pointer adds sections to the zone, or takes them out (85-zones-ui)
  if (zoneEditOn()) {
    ptMoved = false;
    pStart = null;
    clearTimeout(lpT);
    lpFired = false;
    if (ptrs.size === 1 && !multi) {
      if (popOpen()) closeSwatchPop();
      else zoneStrokeStart(e);
    }
    return;
  }
  // Paint: one pointer paints (a picker still open is closed by it instead)
  if (paintActive()) {
    ptMoved = false;
    pStart = null;
    clearTimeout(lpT);
    lpFired = false;
    if (ptrs.size === 1 && !multi) {
      if (popOpen()) closeSwatchPop();
      else paintStart(e);
    }
    return;
  }
  ptMoved = false;
  pStart = { x: e.clientX, y: e.clientY, panX: panX, panY: panY };
  lpFired = false;
  clearTimeout(lpT);
  if (sfmode === 'color' && !focus) {
    const P0 = evPt(e);
    lpT = setTimeout(function () {
      if (ptMoved || multi || ptrs.size !== 1) return;
      if (P0.x < 0 || P0.y < 0 || P0.x >= W || P0.y >= H) return;
      const l = labels[P0.y * W + P0.x];
      if (l > 0 && assignData && assignData.assign[l]) {
        lpFired = true;
        _holdAt = Date.now();
        findInList(l);
      }
    }, 480);
  }
  if (sfmode === 'guide' && family === 'blend' && !shadeFlatMode) {
    const P = evPt(e);
    blendHit = anchorAt(P);
    blendMoved = false;
    blendStart = P;
    // Blend: a tap adds an anchor, so the section's tip (Change colour, Pin) is a press and hold. With a picker sheet
    // open, a tap (or a hold) moves the picker instead: to that anchor, or to that section
    if (blendHit < 0 && ptrs.size === 1)
      lpT = setTimeout(function () {
        if (ptMoved || multi || blendMoved || ptrs.size !== 1 || sfmode !== 'guide' || family !== 'blend')
          return;
        if (P.x < 0 || P.y < 0 || P.x >= W || P.y >= H) return;
        const l = labels[P.y * W + P.x];
        if (l > 0 && assignData && assignData.assign[l]) {
          lpFired = true;
          if (navigator.vibrate)
            try {
              navigator.vibrate(18);
            } catch (_) {}
          holdSec(l);
        }
      }, 480);
    return;
  }
  if (sfmode === 'review' && (editMode === 'split' || editMode === 'add')) {
    const P = evPt(e);
    // (v304: also from on a line, where a stroke drawn from edge to edge starts; which section it cuts is found when
    // it ends, strokeSection)
    if (P.x >= 0 && P.y >= 0 && P.x < W && P.y < H) {
      drawing = true;
      drawStartL = labels[P.y * W + P.x];
      strokePts = [P];
    }
  }
}
function onMove(e) {
  if (pgMode) {
    pgPtr(e, 'move');
    return;
  }
  if (cropMode) {
    if (!cropDrag) return;
    const P = evCanvas(e);
    if (cropDrag === 'new') {
      cropPx = {
        x: Math.min(cropStart.x, P.x),
        y: Math.min(cropStart.y, P.y),
        w: Math.abs(P.x - cropStart.x),
        h: Math.abs(P.y - cropStart.y),
      };
    } else if (cropDrag === 'move') {
      let nx = cropAnchor.x + (P.x - cropStart.x),
        ny = cropAnchor.y + (P.y - cropStart.y);
      nx = Math.max(0, Math.min(cv.width - cropAnchor.w, nx));
      ny = Math.max(0, Math.min(cv.height - cropAnchor.h, ny));
      cropPx = { x: nx, y: ny, w: cropAnchor.w, h: cropAnchor.h };
    } else {
      let x0 = cropAnchor.x0,
        y0 = cropAnchor.y0,
        x1 = cropAnchor.x1,
        y1 = cropAnchor.y1;
      if (cropDrag.indexOf('w') >= 0) x0 = P.x;
      if (cropDrag.indexOf('e') >= 0) x1 = P.x;
      if (cropDrag.indexOf('n') >= 0) y0 = P.y;
      if (cropDrag.indexOf('s') >= 0) y1 = P.y;
      cropPx = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    }
    drawCropOverlay();
    return;
  }
  if (_phP.has(e.pointerId)) {
    photoPtr(e, 'move');
    return;
  }
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size >= 2) {
    const p = [...ptrs.values()],
      dd = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
      m = midView(p[0], p[1]);
    if (!pinchM) {
      pinchM = m;
      pinchPX = panX;
      pinchPY = panY;
    }
    const z = Math.max(1, Math.min(8, (pinchZ * dd) / pinchD)),
      ix = (pinchM.x - pinchPX) / pinchZ,
      iy = (pinchM.y - pinchPY) / pinchZ;
    zoom = z;
    panX = m.x - ix * z;
    panY = m.y - iy * z;
    clampPan();
    applyXform();
    return;
  }
  if (paintS && paintS.id === e.pointerId) {
    paintMove(e);
    return;
  }
  if (zoneS && zoneS.id === e.pointerId) {
    zoneStrokeMove(e);
    return;
  }
  if (sfmode === 'guide' && family === 'blend' && !shadeFlatMode && blendHit >= 0) {
    if (blendStart) {
      const P = evPt(e);
      if (Math.abs(P.x - blendStart.x) + Math.abs(P.y - blendStart.y) > Math.max(W, H) * 0.01)
        blendMoved = true;
      if (blendMoved) {
        anchors[blendHit].x = P.x;
        anchors[blendHit].y = P.y;
        blendRender();
      }
    }
    return;
  }
  if (!pStart) return;
  const dx = e.clientX - pStart.x,
    dy = e.clientY - pStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) ptMoved = true;
  if (drawing) {
    const P = evPt(e),
      last = strokePts[strokePts.length - 1];
    strokePts.push(P);
    ctx.strokeStyle = '#ff3b3b';
    // (as wide as the cut it makes, v304: on an enlarged picture the line drawn was far thinner than the cut)
    ctx.lineWidth = 2 * cutRad() + 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(P.x, P.y);
    ctx.stroke();
    return;
  }
  if ((zoom > 1 || focus) && ptMoved) {
    panX = pStart.panX + dx;
    panY = pStart.panY + dy;
    clampPan();
    applyXform();
  }
}
function onUp(e) {
  if (pgMode) {
    pgPtr(e, 'up');
    return;
  }
  if (cropMode) {
    if (cropDrag) {
      if (cropDrag === 'new' && (cropPx.w < 12 || cropPx.h < 12)) {
        cropPx = { x: 0, y: 0, w: cropFullW, h: cropFullH };
      }
      cropDrag = null;
      cropStart = null;
      cropAnchor = null;
      drawCropOverlay();
    }
    try {
      cv.releasePointerCapture(e.pointerId);
    } catch (_) {}
    return;
  }
  if (_phP.has(e.pointerId)) {
    photoPtr(e, 'up');
    return;
  }
  if (!ptrs.has(e.pointerId)) return;
  const before = ptrs.size;
  ptrs.delete(e.pointerId);
  try {
    cv.releasePointerCapture(e.pointerId);
  } catch (_) {}
  if (paintS && paintS.id === e.pointerId) paintEnd(e.type !== 'pointercancel');
  if (zoneS && zoneS.id === e.pointerId) zoneStrokeEnd(e.type !== 'pointercancel');
  if (paintActive() || zoneEditOn()) {
    if (ptrs.size === 1) {
      const rem = [...ptrs.values()][0];
      pStart = { x: rem.x, y: rem.y, panX: panX, panY: panY };
      ptMoved = false;
    } else if (ptrs.size === 0) {
      pStart = null;
      multi = false;
    }
    return;
  }
  if (sfmode === 'guide' && family === 'blend' && !shadeFlatMode) {
    clearTimeout(lpT);
    if (lpFired) {
      lpFired = false;
    } else if (before === 1 && !multi) {
      const P = evPt(e);
      if (blendHit >= 0 && !blendMoved) {
        openAnchorPop(blendHit);
        renderGuide();
      } else if (blendHit < 0 && !blendMoved && !ptMoved && e.type !== 'pointercancel') {
        if (popOpen()) {
          pickTap(P.x >= 0 && P.y >= 0 && P.x < W && P.y < H ? labels[P.y * W + P.x] : -1);
        } else if (zones.length && zoneTapElsewhere(P)) {
          // (anchors belong to the zone being edited: a tap in another zone says where it is)
          const _zo = zoneOf(labels[P.y * W + P.x]);
          toast(
            'That section is in ' +
              esc(zoneName(_zo)) +
              '. Choose ' +
              esc(zoneName(_zo)) +
              ' above to add anchors there.',
            2600,
          );
        } else {
          addAnchor(P);
          selAnchor = -1;
          blendNow();
          renderGuide();
          renderControls();
        }
      }
    }
    blendHit = -1;
    blendMoved = false;
    if (ptrs.size === 0) {
      pStart = null;
      multi = false;
    }
    planCommit();
    return;
  }
  if (drawing) {
    drawing = false;
    // (a stroke the system took over, v304: nothing is cut)
    if (e.type === 'pointercancel') strokePts = [];
    // (the section it runs through furthest; failing that, the one it started in, v304)
    const _s0 = drawStartL,
      _alt = function (l) {
        return _s0 > 0 && _s0 !== l ? _s0 : 0;
      };
    if (strokePts.length > 1) drawStartL = strokeSection(strokePts);
    if (strokePts.length > 1) {
      if (editMode === 'add') {
        if (drawStartL > 0) {
          const _ec = edgeCut(drawStartL, strokePts) || (_alt(drawStartL) > 0 && edgeCut(_s0, strokePts));
          const _hn = document.getElementById('sfHint');
          if (_hn)
            _hn.textContent = _ec
              ? 'Section added. Draw another, or switch tools.'
              : addAutoClose
                ? 'That loop didn\u2019t enclose anything \u2014 return near where you started.'
                : 'That stroke didn\u2019t divide anything \u2014 run it to a line or the page edge.';
        }
      } else if (
        drawStartL > 0 &&
        !splitAt(drawStartL, strokePts, _alt(drawStartL) > 0) &&
        _alt(drawStartL) > 0
      )
        splitAt(_s0, strokePts);
    }
    strokePts = [];
    render();
    pStart = null;
    return;
  }
  clearTimeout(lpT);
  if (lpFired) {
    lpFired = false;
    if (sfmode === 'color') _holdAt = Date.now();
  } else if (before === 1 && !ptMoved && !multi && e.type !== 'pointercancel') {
    const P = evPt(e);
    if (P.x >= 0 && P.y >= 0 && P.x < W && P.y < H) editTapAt(P);
  }
  if (ptrs.size === 1) {
    const rem = [...ptrs.values()][0];
    pStart = { x: rem.x, y: rem.y, panX: panX, panY: panY };
    ptMoved = false;
  } else if (ptrs.size === 0) {
    pStart = null;
    multi = false;
  }
}

// long-press (or right-click) a section while colouring along: open its marker in the list (findInList, 83-along.js);
// _holdAt: when the last one did (clicks on the list just after it are ignored, see frameInit)
let lpT = 0,
  lpFired = false,
  _holdAt = 0;
