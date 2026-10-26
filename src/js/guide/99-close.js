if (typeof globalThis !== 'undefined' && globalThis.__MS_TEST) {
  globalThis.__mstest = {
    // (v310: the Mood pictures, 32-mood-pics)
    mpLay: mpLay,
    mpKey: mpKey,
    mpShow: mpShow,
    mpSave: mpSave,
    mpDiff: mpDiff,
    mpSigNow: mpSigNow,
    mpSig: mpSig,
    planSnap: planSnap,
    layPlan: layPlan,
    get mp() {
      return _mp;
    },
    get mpPtrs() {
      return _mpPtrs;
    },
    get emphasis() {
      return emphasis;
    },
    get planStack() {
      return planStack;
    },
    segment: segment,
    labelCells: labelCells,
    applyBg: applyBg,
    bgByEdge: bgByEdge,
    // (the paper inside a drawn frame, v305)
    frameLeft: frameLeft,
    frameColour: frameColour,
    otsu: otsu,
    splitAt: splitAt,
    counted: counted,
    countedList: countedList,
    render: render,
    snapshotSeg: snapshotSeg,
    restoreSnap: restoreSnap,
    currentDesignObj: currentDesignObj,
    lmapURL: lmapURL,
    openDesignObj: openDesignObj,
    get gray() {
      return gray;
    },
    set gray(v) {
      gray = v;
    },
    get chroma() {
      return chroma;
    },
    set chroma(v) {
      chroma = v;
    },
    get W() {
      return W;
    },
    set W(v) {
      W = v;
    },
    get H() {
      return H;
    },
    set H(v) {
      H = v;
    },
    get labels() {
      return labels;
    },
    get labelsSigN() {
      return _lsN;
    },
    set labels(v) {
      labels = v;
      labelsEdited();
    },
    get comps() {
      return comps;
    },
    set comps(v) {
      comps = v;
    },
    get secState() {
      return secState;
    },
    set secState(v) {
      secState = v;
    },
    get secColor() {
      return secColor;
    },
    set secColor(v) {
      secColor = v;
    },
    get colored() {
      return colored;
    },
    set colored(v) {
      colored = v;
    },
    get bgTrim() {
      return bgTrim;
    },
    set bgTrim(v) {
      bgTrim = v;
    },
    get minPos() {
      return minPos;
    },
    set minPos(v) {
      minPos = v;
    },
    get enhance() {
      return enhance;
    },
    set enhance(v) {
      enhance = v;
    },
    get assignData() {
      return assignData;
    },
    set assignData(v) {
      assignData = v;
    },
    get addAutoClose() {
      return addAutoClose;
    },
    set addAutoClose(v) {
      addAutoClose = v;
    },
    get curName() {
      return curName;
    },
    set curName(v) {
      curName = v;
    },
    get genPal() {
      return genPal;
    },
    set genPal(v) {
      genPal = v;
    },
    labelPos: labelPos,
    get labelPts() {
      return labelPts;
    },
    set labelPts(v) {
      labelPts = v;
    },
    segQuality: segQuality,
    // (v304: very dense pages, a stroke begun on a line, a merge picked before the sections were found again)
    foldSet: foldSet,
    denseCount: denseCount,
    strokeSection: strokeSection,
    get mergeSel() {
      return mergeSel;
    },
    set mergeSel(v) {
      mergeSel = v;
    },
    get segWarn() {
      return segWarn;
    },
    set segWarn(v) {
      segWarn = v;
    },
    // (v313: the hand-off card's zoom, against a section's own)
    focusZoomFor: focusZoomFor,
    get focusOrd() {
      return focusOrd;
    },
    get focusPos() {
      return focusPos;
    },
    get focusFin() {
      return focusFin;
    },
    // (v323) the outline on the picture, a partly coloured page's offer, the section Focus mode was left on
    get olSet() {
      return olSet;
    },
    // (v323) the sharp outlines (77-sharp): drawn now, and their field worked out afresh
    sharpDraw: sharpDraw,
    sharpField: function (fresh) {
      if (fresh) _shF = null;
      return !!sharpField();
    },
    sharpPaint: sharpPaint,
    get colOffer() {
      return colOffer;
    },
    get focusAt() {
      return focusAt;
    },
    get focus() {
      return focus;
    },
    // (v308.3: Focus mode's colour chips drawn again, for the halo test)
    focusChips: renderFocusMarkers,
    get zoom() {
      return zoom;
    },
    get panX() {
      return panX;
    },
    get panY() {
      return panY;
    },
    get hlKey() {
      return hlKey;
    },
    buildFocusOrder: buildFocusOrder,
    goFocus: goFocus,
    renderGuide: renderGuide,
    normalizeTones: normalizeTones,
    // (v306: the same code in both brands, worked out from the guide as shown)
    sameCodeScan: sameCodeScan,
    sameName: sameName,
    // (v318.21 tests: the code on your cap, its * and a key's name)
    capLabel: capLabel,
    capPair: capPair,
    capStar: capStar,
    capKeyName: capKeyName,
    mcode: mcode,
    codeNorm: codeNorm,
    openSectionPop: openSectionPop,
    // (v306: the marker strokes when a page is finished in Focus mode)
    // (v320: the finished card's strokes, the list's finish)
    get finishStrokesN() {
      return finishStrokes.n || 0;
    },
    get finishStrokesRuns() {
      return finishStrokes.runs || 0;
    },
    get markerStrokesN() {
      return markerStrokes.n || 0;
    },
    // (v306: find by code, and the iPad's keyboard over the code box)
    codeFind: codeFind,
    findLine: findLine,
    findPartLine: findPartLine,
    get kbdSim() {
      return _kbdSim;
    },
    set kbdSim(v) {
      _kbdSim = v;
      findKbd();
    },
    // (v306: Did any run low?)
    lowCover: lowCover,
    lowTop: lowTop,
    get guideDirty() {
      return guideDirty;
    },
    set guideDirty(v) {
      guideDirty = v;
    },
    get curId() {
      return curId;
    },
    flushSave: function () {
      return doAutosave();
    },
    // (put the open guide in the Library now, as Save did: the tests' saveGuide)
    saveNow: function () {
      saveGuide();
      return _firstP || Promise.resolve();
    },
    get inLibrary() {
      return !!libEntry();
    },
    get saveErr() {
      return _saveErr;
    },
    // (which sections touch: the builds' own idea of it)
    get adj() {
      return adj || (adj = buildAdj());
    },
    mergeCellsSnap: function (a, b) {
      snapshotSeg();
      const r = mergeCells(a, b);
      // (as a merge with the tool does: an edit to build)
      hasEdits = true;
      return r;
    },
    doUndoSeg: doUndo,
    stepSet: stepSet,
    stepDone: stepDone,
    shadeReq: shadeReq,
    get focusStep() {
      return focusStep;
    },
    set toneSteps(v) {
      toneSteps = v;
    },
    get tonePart() {
      return tp();
    },
    buildPDFPages: buildPDFPages,
    // (v307: the speed work)
    canvasesToPDF: canvasesToPDF,
    rgbPack: rgbPack,
    jobs: JOBS,
    pngBlob: pngBlob,
    lmapWarm: lmapWarm,
    lmapLabels: lmapLabels,
    labelPtsCore: labelPtsCore,
    // (the section map encoded here, whatever is kept; and what lmapWarm left for the next save)
    lmapHere: function () {
      return _lmapURL(foldSet());
    },
    get lmapKept() {
      return _lmC && _lmC.url;
    },
    lmapForget: function () {
      _lmC = null;
    },
    lptsKept: function () {
      return _lpts.length;
    },
    buildExportCanvas: buildExportCanvas,
    // (v308: the photo's debris left out of what's printed and saved, and the least code size on Save image)
    outDebris: outDebris,
    outDebrisReset: function () {
      _dbC = null;
    },
    exportMinPx: exportMinPx,
    pdfSunAt: pdfSunAt,
    shadeZoneLabels: shadeZoneLabels,
    shadePrep: shadePrep,
    get shadeMode() {
      return shadeMode;
    },
    set shadeMode(v) {
      shadeMode = v;
    },
    get shadeSun() {
      return shadeSun;
    },
    set shadeSun(v) {
      shadeSun = v;
    },
    set shadeRound(v) {
      shadeRound = v;
    },
    get shadeV() {
      return shadeV;
    },
    shadeField: shadeField,
    shadeTones: shadeTones,
    // (v327 photo tones and tidying)
    secTones: secTones,
    ptGet: ptGet,
    ptFlat: ptFlat,
    ptFlatN: ptFlatN,
    ptToneN: ptToneN,
    ptSet2: ptSet2,
    ptAvail: ptAvail,
    ptStyleApply: ptStyleApply,
    ptAuto: ptAuto,
    ptSamples: ptSamples,
    ptChoose: ptChoose,
    ptLightOK: ptLightOK,
    shadeTidy: shadeTidy,
    shadeTune: shadeTune,
    toneRowName: toneRowName,
    // (the field as made, untidied; whether the tidying's thin rule is on)
    shadeFieldRaw: function () {
      return shadeField(1);
    },
    shadeTidyThin: function () {
      return ppOn() && shadeFromPhoto();
    },
    shadeHas: shadeHas,
    shadeWaitsPhoto: shadeWaitsPhoto,
    get ptHeld() {
      return _ptHeld;
    },
    get ptX() {
      return _ptX;
    },
    get shadeSets() {
      return shadeSets;
    },
    set shadeSets(v) {
      shadeSets = v;
    },
    hiOn: hiOn,
    shAnyHi: shAnyHi,
    shZonesNone: shZonesNone,
    zoneDelete: zoneDelete,
    blenderFor: blenderFor,
    // (v318.18: the guide's own theme in its Lean towards temperature, or the one asked for)
    get themeWide() {
      return THEMES[theme] ? themeEntry(palette, theme).wide : null;
    },
    themeEntry: themeEntry,
    themeStrip: themeStrip,
    themeSplit: themeSplit,
    poolBase: poolBase,
    get themeDrop() {
      return themeDrop;
    },
    THEMES: THEMES,
    THEME_KEYS: THEME_KEYS,
    themeNote: themeNote,
    balAutoSub: balAutoSub,
    morePatternSum: morePatternSum,
    // (v304 tests: the tone lines drawn into a buffer; a held shading put back as Undo does; the brand letters in print)
    shadeLinesDraw: shadeLinesDraw,
    heldSet: heldSet,
    get heldSh() {
      return heldSh;
    },
    guideMixed: guideMixed,
    shadePick: shadePick,
    shadeStylePick: shadeStylePick,
    shadeGeom: shadeGeom,
    shadeable: shadeable,
    shadeZone: shadeZone,
    setCollection: setCollection,
    capChanged: capChanged,
    nextUndone: nextUndone,
    set focusPos(v) {
      focusPos = v;
    },
    forceFullRender: function () {
      _rg = null;
    },
    get srcSize() {
      return srcImg ? [srcImg.width, srcImg.height] : null;
    },
    set hlKey(v) {
      hlKey = v;
    },
    set texAmt(v) {
      texAmt = v;
    },
    shadeZoneLabelsAll: shadeZoneLabelsAll,
    get shadeHi() {
      return shadeHi;
    },
    set shadeHi(v) {
      shadeHi = v;
    },
    get shadeLo() {
      return shadeLo;
    },
    set shadeLo(v) {
      shadeLo = v;
    },
    get shadeFlat() {
      return shadeFlat;
    },
    shadeFromPhoto: shadeFromPhoto,
    labelsSig: labelsSig,
    stepFaint: stepFaint,
    pgFind: pgFind,
    // (v318.36: the same in the JOBS worker)
    pgFindOff: pgFindOff,
    pgKeystone: pgKeystone,
    pgJudge: pgJudge,
    get bgEdgeAll() {
      return bgEdgeAll;
    },
    get cropMode() {
      return cropMode;
    },
    get anchors() {
      return anchors;
    },
    set anchors(v) {
      anchors = v;
    },
    // (Blend's first three anchors and one added by a tap, v306)
    seedAnchors: seedAnchors,
    addAnchor: addAnchor,
    pickPhotoRef: pickPhotoRef,
    get photoChecking() {
      return photoChecking;
    },
    get pgEd() {
      return pgEd;
    },
    get pgQ() {
      return pgQ;
    },
    pgShapeOf: pgShapeOf,
    // (the guide benchmark straightens its synthetic photos with the app's own warp: scripts/bench)
    pgWarp: pgWarp,
    pgExifFocal: pgExifFocal,
    pgHomog: pgHomog,
    packLabels: packLabels,
    unpackLabels: unpackLabels,
    photoPick: photoPick,
    photoSuggest: photoSuggest,
    get photoSug() {
      return _phSug && { n: _phSug.n, pending: _phSug.n == null };
    },
    photoTryAutoAlign: photoTryAutoAlign,
    photoFromImage: photoFromImage,
    setPhotoRef: setPhotoRef,
    // (v304: the Photo pattern through a change to the picture, its size limits, a photo with no colour)
    geoSet: function (o) {
      // (v318.14: in one go, as before, so a test can read the picture straight after: segSync)
      segSync = true;
      try {
        geoSet0(o);
      } finally {
        segSync = false;
      }
    },
    set segSync(v) {
      segSync = v;
    },
    autoCrop: function () {
      segSync = true;
      try {
        autoCrop();
      } finally {
        segSync = false;
      }
    },
    buildGuide: buildGuide,
    photoMove: photoMove,
    photoFit: photoFit,
    photoPrepDist: _photoPrepDist,
    photoStatsHTML: photoStatsHTML,
    zoneNew: zoneNew,
    zoneSelect: zoneSelect,
    pgStartQ: pgStartQ,
    PG_BUSY: PG_BUSY,
    get pgSteep() {
      return pgSteep;
    },
    set pgSteep(v) {
      pgSteep = v;
    },
    get pgOrig() {
      return pgOrig;
    },
    set pgOrig(v) {
      pgOrig = v;
    },
    // (v318.34: the source picture kept with the guide, 25-source-photo)
    get srcFrom() {
      return srcFrom;
    },
    get srcSet() {
      return _srcSet;
    },
    srcSettings: srcSettings,
    srcLoading: srcLoading,
    srcCheck: srcCheck,
    // (v319: the fit allowance for a rebuilt picture, test/v319-src-fit; the note when a picture can't be kept, for
    // its wording, e2e/v319-src-fit)
    srcFit: srcFit,
    srcFail: srcFail,
    get phRefit() {
      return _phRefit;
    },
    get phNone() {
      return _phNone;
    },
    get photoGreys() {
      return photoGreys;
    },
    get phStats() {
      return _phStats;
    },
    photoPageCheck: photoPageCheck,
    photoLitToggle: photoLitToggle,
    photoIsWhite: photoIsWhite,
    photoColours: photoColours,
    codeLayout: codeLayout,
    drawCode: drawCode,
    photoRecolour: photoRecolour,
    get photoRef() {
      return photoRef;
    },
    get photoXf() {
      return photoXf;
    },
    set photoXf(v) {
      photoXf = v;
    },
    get photoAlign() {
      return photoAlign;
    },
    get family() {
      return family;
    },
    get limitN() {
      return limitN;
    },
    set limitN(v) {
      limitN = v;
    },
    // (v325: a photo-made page, 47-photo-page)
    get pp() {
      return pp;
    },
    ppSave: ppSave,
    ppCheck: ppCheck,
    ppBuildCore: ppBuildCore,
    ppPickCore: ppPickCore,
    ppDe: ppDe,
    ppMmPx: ppMmPx,
    ppWorkerSrc: ppWorkerSrc,
    ppRemakeFor: ppRemakeFor,
    get ppBusy() {
      return _ppBusy;
    },
    get ppPrep() {
      return _ppPrep;
    },
    subMissing: subMissing,
    // (v326: the markers to add, the step's colours, Subject only, the pages kept)
    ppFillCore: ppFillCore,
    ppFillGet: ppFillGet,
    get ppFill() {
      return _ppFill;
    },
    ppHelpBody: ppHelpBody,
    ppAsMade: ppAsMade,
    ppPool: ppPool,
    ppStepColours: ppStepColours,
    ppStepWhy: ppStepWhy,
    ppMadeAssign: ppMadeAssign,
    ppSubjectBox: ppSubjectBox,
    ppSubjectShare: ppSubjectShare,
    ppSubjectTargets: ppSubjectTargets,
    ppCropSubject: ppCropSubject,
    get ppMemN() {
      return _ppMem.size;
    },
    get ppTools() {
      return _ppTools;
    },
    get subKeep() {
      return _subKeep;
    },
    photoRoughAt: photoRoughAt,
    get photoPeek() {
      return photoPeek;
    },
    get locks() {
      return locks;
    },
    // (v318.26) Leave white
    get whitePins() {
      return whitePins;
    },
    set whitePins(v) {
      whitePins = v;
    },
    whiteApply: whiteApply,
    whiteOpen: whiteOpen,
    leaveWhite: leaveWhite,
    colourWhite: colourWhite,
    get undoBytes() {
      return undoBytes;
    },
    // (v318.37: a step's share of the budget, for the test of what it counts)
    snapBytes: snapBytes,
    get undoCount() {
      return undoStack.length;
    },
    get redoCount() {
      return secFwd.length;
    },
    get planCount() {
      return planStack.length;
    },
    get planLabel() {
      return planStack.length ? planStack[planStack.length - 1].label : null;
    },
    get paintOn() {
      return paintOn;
    },
    get zKbL() {
      return zKbL;
    },
    get paintKey() {
      return paintKey;
    },
    sideBySide: sideBySide,
    get geo() {
      return geo;
    },
    get picScale() {
      return picS;
    },
    sheetOpen: sheetOpen,
    checkComplete: checkComplete,
    get pdfKinds() {
      return _pdfKinds;
    },
    get pdfCloseN() {
      return _pdfCloseN;
    },
    // (set a Print option as its button would: pwhat, plabels, paper; blend: the lighter and darker columns)
    pdfOpt: function (k, v) {
      if (k === 'blend') pdfBlend = !!v;
      else printOptSet(k, v);
    },
    // (how many kept sections the line under the tabs has told of on this visit)
    get heldTold() {
      return _heldTold;
    },
    set heldTold(v) {
      _heldTold = v;
    },
    get pdfCloseP() {
      return _pdfCloseP;
    },
    // (each close-up: its crop, its own sections, and what its placing labelled and left with a dot)
    get pdfCU() {
      return _pdfCU.map(function (c) {
        return {
          crop: c.crop,
          kc: c.k,
          target: c.ids,
          lays: c.pl ? Object.keys(c.pl.lays).map(Number) : [],
          boxes: c.pl
            ? Object.values(c.pl.lays).map(function (x) {
                return x.box;
              })
            : [],
          dropped: c.pl ? c.pl.dropped : [],
        };
      });
    },
    get pdfCloseL() {
      return _pdfCloseL;
    },
    get pdfLeft() {
      return _pdfLeft;
    },
    get pdfSun() {
      return _pdfSun;
    },
    get pdfP1() {
      return _pdfP1;
    },
    // (the saved image's codes as placed, and its key's columns, v304)
    get exPlaced() {
      return _exPlaced;
    },
    exportKeyLayout: exportKeyLayout,
    renderControls: renderControls,
    get pgHint() {
      return pgHint;
    },
    set pgHint(v) {
      pgHint = v;
    },
    // (v318.37: the photo's lens, which hatchUnsure reads; and Edit sections' hatching note)
    get pgF35() {
      return pgF35;
    },
    set pgF35(v) {
      pgF35 = v;
    },
    hatchUnsure: hatchUnsure,
    hatchNoteText: hatchNoteText,
    updateProgress: updateProgress,
    get labMin() {
      return _labMin;
    },
    get progAt() {
      return progAt;
    },
    get exCodes() {
      return exCodes;
    },
    get hideLabels() {
      return hideLabels;
    },
    infoLine: infoLine,
    get genHarmony() {
      return genHarmony;
    },
    set genHarmony(v) {
      genHarmony = v;
    },
    get expand() {
      return expand;
    },
    set expand(v) {
      expand = v;
    },
    get paletteSource() {
      return paletteSource;
    },
    set paletteSource(v) {
      paletteSource = v;
    },
    GEN_HARMS: GEN_HARMS,
    generatePalette: generatePalette,
    // (v319: Greys + accent's fallback, for test/v319-palettes)
    get genNote() {
      return genNote;
    },
    get genFell() {
      return genFell;
    },
    genHarmUsed: genHarmUsed,
    genNeutralWhy: genNeutralWhy,
    genNeutralShort: genNeutralShort,
    genNeutralChipOff: genNeutralChipOff,
    inclExclude: inclExclude,
    activePool: activePool,
    thinGreyM: thinGreyM,
    balPlan: balPlan,
    balFamOf: balFamOf,
    buildNoRep: buildNoRep,
    buildBalance: buildBalance,
    balMeasure: balMeasure,
    balName: balName,
    noRepPool: noRepPool,
    poolMsg: poolMsg,
    balShort: balShort,
    lookNote: lookNote,
    // the Gradient's parts (30-palette-assign), for the unit tests
    grad: {
      groupSize: gradGroupSize,
      hueGap: hueGap,
      isLoop: gradIsLoop,
      tierPool: gradTierPool,
      pickSpread: gradPickSpread,
      // (v308: the Include row, the vivid markers, lightness following hue, the shared picks)
      pickSet: gradPickSet,
      inclGroup: inclGroup,
      inclOn: inclOn,
      inclPick: inclPick,
      inclPool: inclPool,
      vivid: gradVividM,
      // (v308.3: the eight colour families the vivid set keeps)
      fam8: gradFam8,
      lt: gradLt,
      ltTarget: gradLtTarget,
      hueWarp: gradHueWarp,
      v8: gradV8,
      sliderMax: sliderMax,
      mandala: gradMandala,
      fixPool: gradFixPool,
      rc: gradRc,
      inclStatus: inclStatus,
      mkCap: mkCap,
      rainbow: rainbowPick,
      mandalaScore: gradMandalaScore,
      pickField: gradPickField,
      deMatrix: deMatrix,
      tour: gradTour,
      sequence: gradSequence,
      splitByArea: splitByArea,
      pinZero: gradPinZero,
      lightSign: gradLightSign,
      plan: gradPlan,
      poolSource: poolSource,
      build: buildGradient,
      order: orderSections,
      outAndBack: outAndBack,
      get smoothed() {
        return gradSmoothLast;
      },
      get scattered() {
        return gradScatLast;
      },
      centre: radCentre,
      // (v306: Scatter, U6's count, U7's picks and rough spots)
      get fixed() {
        return gradFixLast;
      },
      // (v307: touching sections sharing a marker, split up after the smoothing)
      get same() {
        return gradSameLast;
      },
      fixHeld: gradFixHeld,
      count: gradCount,
      countNow: gradCountNow,
      scatAt: gradScatAt,
      shadeOK: gradShadeOK,
      shadeOffer: gradShadeOffer,
      shadePick: gradShadePick,
      rough: gradRough,
      fixRun: gradFixRun,
      roughNow: roughNow,
      roughPts: roughPts,
      roughSmooth: roughSmooth,
      mkCountLabel: mkCountLabel,
    },
    // the lookups and pattern parts shared by several patterns (30-palette-assign, 88-coverage-blend), for the tests
    colour: {
      nearest: nearestInPool,
      temp: markerTemp,
      poolFor: poolFor,
      mixer: blendMixer,
      adj: buildAdj,
      random: buildRandom,
      companion: _findComp,
      famVal: famVal,
      companions: blendCompanions,
      lch: mLch,
    },
    get coll() {
      return coll;
    },
    set coll(v) {
      coll = v;
    },
    get gradTourWork() {
      return [gradTourWork, GRAD_TOUR_WORK];
    },
    surprise: surprise,
    // (v305: the share card is Reveal's layout, 89-show.js)
    buildShareCard: function () {
      return buildShowCard(cv);
    },
    buildShowCard: buildShowCard,
    // (v314: the photo of the finished page, 24-page-photo)
    fin: {
      get id() {
        return _fin.id;
      },
      get rec() {
        return _fin.rec;
      },
      get read() {
        return _fin.read;
      },
      get decoded() {
        return !!_fin.img || !!_fin.dec;
      },
      get last() {
        return _finLast ? { id: _finLast.id, q: _finLast.q, tier: _finLast.tier } : null;
      },
      get editing() {
        return _finEd ? { id: _finEd.id, q: _finEd.q, k: _finEd.k, pad: _finEd.pad } : null;
      },
      get: finGet,
      card: function () {
        if (!_fin.img) finDecode();
        return _fin.img ? buildFinCard(_fin.img) : null;
      },
      // (v315) the card for any picture as the photo
      cardOf: function (im, side) {
        return buildFinCard(im, 0, 0, side);
      },
      refresh: finRefresh,
      // (v315) a photo as the finished-page path takes it: found and flattened ({ tier, c, aspect }), and which way up
      flatten: function (img) {
        const f = pgFind(img, { coloured: true });
        if (f.tier !== 'sure') return { tier: f.tier };
        const a = finAspect(f.q, img.width, img.height, 0);
        return { tier: f.tier, aspect: a, c: pgWarp(img, f.q, a) };
      },
      orient: function (id, c) {
        return finOrient(id, c).then(function (o) {
          return { turns: o.turns, sc: finOrient.last || null };
        });
      },
    },
    get bloomOn() {
      return !!_bloom;
    },
    get bloomCount() {
      return bloomCount;
    },
    get bloomLast() {
      return bloomLast;
    },
    showModel: showModel,
    showLayout: showLayout,
    showTitleFit: showTitleFit,
    get showOn() {
      return !!_show;
    },
    get showBlob() {
      return _show ? _show.blob : null;
    },
    exCodesNow: function () {
      return exCodesNow();
    },
    set exCodes(v) {
      exCodes = v;
    },
    showBands: showBands,
    showMarkers: showMarkers,
    famCmp: famCmp,
    alongResume: alongResume,
    alongSort: alongSort,
    // (a ✓ still showing on the art in Colour along, v305)
    tkFresh: tkFresh,
    reassign: reassign,
    secEdPending: secEdPending,
    get phPend() {
      return _phPend;
    },
    get gone() {
      return _gone;
    },
    get tabId() {
      return TAB_ID;
    },
    guideCheck: guideCheck,
    makeThumb: makeThumb,
    get sfmode() {
      return sfmode;
    },
    get rot90() {
      return rot90;
    },
    get cropRect() {
      return cropRect;
    },
    set cropRect(v) {
      cropRect = v;
    },
    openFillPop: openFillPop,
    gradStartInfo: gradStartInfo,
    get zones() {
      return zones;
    },
    get zoneCur() {
      return zoneCur;
    },
    get zoneEdit() {
      return zoneEdit;
    },
    zoneOf: zoneOf,
    zoneSecs: zoneSecs,
    zoneBoxOf: zoneBoxOf,
    zoneMove: zoneMove,
    zsh: zsh,
    zshOf: zshOf,
    zshSet: zshSet,
    zshOpen: zshOpen,
    shadeWhy: function (l) {
      const g = shadeGeom();
      return g ? shadeWhy(l, g) : null;
    },
    shadeSec: shadeSec,
    shadeUse: shadeUse,
    photoLightOK: photoLightOK,
    shadeHowto: shadeHowto,
    toneRows: toneRows,
    zoneShadeLabel: zoneShadeLabel,
    shadeLabel: shadeLabel,
    zoneRec: zoneRec,
    zoneStepLabel: zoneStepLabel,
    zoneStOpen: zoneStOpen,
    zoneOpen: zoneOpen,
    zoneSave: zoneSave,
    ZONE_KEYS: ZONE_KEYS,
    alongList: alongList,
    get hlZone() {
      return hlZone;
    },
    hlPath: hlPath,
    // (v308) a section's box, in picture pixels: [x0, y0, x1, y1]
    secBox: function (l) {
      const b = secBoxes();
      return [b.x0[l], b.y0[l], b.x1[l], b.y1[l]];
    },
    // a section's size on screen now, in CSS px (the zoom rule's test: at least ~44px, or as far as it may go)
    secOnScreen: function (l) {
      const b = secBoxes(),
        DW = (cv && cv.offsetWidth) || 1,
        DH = (cv && cv.offsetHeight) || 1;
      return {
        w: ((b.x1[l] - b.x0[l] + 1) / W) * DW * zoom * picK(),
        h: ((b.y1[l] - b.y0[l] + 1) / H) * DH * zoom * picK(),
      };
    },
    get fnLast() {
      return _fnLast;
    },
    shadeGlaze: shadeGlaze,
    stepText: stepText,
    shadeTipHTML: shadeTipHTML,
    shT2: shT2,
    minPx: minPx,
    minPosAuto: minPosAuto,
    minMmText: minMmText,
    get minAuto() {
      return minAuto;
    },
    get srcDims() {
      return srcDims;
    },
    set srcDims(v) {
      srcDims = v;
    },
    grayUp: grayUp,
    // (v313: Edit sections' drawing, read back; a stand-in canvas context, to time it without one)
    get rgbOut() {
      return rgbOut;
    },
    set ctx(v) {
      ctx = v;
    },
    boxBlur: boxBlur,
    focusCur: focusCur,
    get srcK() {
      return srcK;
    },
    set srcK(v) {
      srcK = v;
    },
    minPosOld: minPosOld,
    MIN_DEF: MIN_DEF,
    gradStartSay: gradStartSay,
    styleSave: styleSave,
    styleFields: STYLE_FIELDS,
    plCarry: plCarry,
    inkPasses: function () {
      return inkPrep().passes;
    },
    plKnown: plKnown,
    // laying a guide out and changing it, for test/v304-assign.test.mjs
    assign: {
      buildGuide: buildGuide,
      blendNow: blendNow,
      zoneNew: zoneNew,
      zoneSelect: zoneSelect,
      planCommit: planCommit,
      // (v308: the marker an anchor gives; the shading's own markers)
      anchorOut: anchorOut,
      anchorDot: anchorDot,
      blendChoose: blendChoose,
      blendAllN: blendAllN,
      shadeExtra: shadeExtra,
      planUndo: planUndo,
      planRedo: planRedo,
      // (v307: the tool row's status, Colour along, and the line under the tabs)
      planBar: ctlPlanBar,
      planHead: ctlPlanHead,
      guideWhite: guideWhite,
      resetForNewPicture: resetForNewPicture,
      colours: ctlPlanColours,
      // (v318.27: the Pattern tab's, as Colours')
      pattern: ctlPlanPattern,
      get planStack() {
        return planStack;
      },
      get balStat() {
        return balStat;
      },
      get adjLeft() {
        return adjLeft;
      },
      get lastPoolN() {
        return lastPoolN;
      },
      set sfmode(v) {
        sfmode = v;
      },
      set segFresh(v) {
        _segFresh = v;
      },
      set adj(v) {
        adj = v;
      },
      // (no screen in the unit tests: drawing and the controls left out)
      quiet: function () {
        renderGuide =
          renderControls =
          render =
          saveStatus =
          markBuilt =
          positionPhoto =
          showTip =
            function () {};
      },
    },
    // every style setting (and the section settings saved beside it) by its variable's name, to read and set, for
    // e2e/style-fields.test.mjs and test/style-fields.test.mjs
    styleVars: {
      get family() {
        return family;
      },
      set family(v) {
        family = v;
      },
      get palette() {
        return palette;
      },
      set palette(v) {
        palette = v;
      },
      get theme() {
        return theme;
      },
      set theme(v) {
        theme = v;
      },
      get gradShape() {
        return gradShape;
      },
      set gradShape(v) {
        gradShape = v;
      },
      get dir() {
        return dir;
      },
      set dir(v) {
        dir = v;
      },
      get look() {
        return look;
      },
      set look(v) {
        look = v;
      },
      get emphasis() {
        return emphasis;
      },
      set emphasis(v) {
        emphasis = v;
      },
      get limitN() {
        return limitN;
      },
      set limitN(v) {
        limitN = v;
      },
      get gradIncl() {
        return gradIncl;
      },
      set gradIncl(v) {
        gradIncl = v;
      },
      get noAdj() {
        return noAdj;
      },
      set noAdj(v) {
        noAdj = v;
      },
      get balance() {
        return balance;
      },
      set balance(v) {
        balance = v;
      },
      get balM() {
        return balM;
      },
      set balM(v) {
        balM = v;
      },
      get balS() {
        return balS;
      },
      set balS(v) {
        balS = v;
      },
      get balA() {
        return balA;
      },
      set balA(v) {
        balA = v;
      },
      get balSeed() {
        return balSeed;
      },
      set balSeed(v) {
        balSeed = v;
      },
      get noRep() {
        return noRep;
      },
      set noRep(v) {
        noRep = v;
      },
      get matchAlike() {
        return matchAlike;
      },
      set matchAlike(v) {
        matchAlike = v;
      },
      get gradSeed() {
        return gradSeed;
      },
      get radC() {
        return radC;
      },
      set radC(v) {
        radC = v;
      },
      set gradSeed(v) {
        gradSeed = v;
      },
      get gradScat() {
        return gradScat;
      },
      set gradScat(v) {
        gradScat = v;
      },
      get gradJit() {
        return gradJit;
      },
      set gradJit(v) {
        gradJit = v;
      },
      get gradFix() {
        return gradFix;
      },
      set gradFix(v) {
        gradFix = v;
      },
      get blendFall() {
        return blendFall;
      },
      set blendFall(v) {
        blendFall = v;
      },
      get blendMix() {
        return blendMix;
      },
      set blendMix(v) {
        blendMix = v;
      },
      get texAmt() {
        return texAmt;
      },
      set texAmt(v) {
        texAmt = v;
      },
      get shadeMode() {
        return shadeMode;
      },
      set shadeMode(v) {
        shadeMode = v;
      },
      get shadeSun() {
        return shadeSun;
      },
      set shadeSun(v) {
        shadeSun = v;
      },
      get shadeRound() {
        return shadeRound;
      },
      set shadeRound(v) {
        shadeRound = v;
      },
      get shadeShadow() {
        return shadeShadow;
      },
      set shadeShadow(v) {
        shadeShadow = v;
      },
      get shadeHilite() {
        return shadeHilite;
      },
      set shadeHilite(v) {
        shadeHilite = v;
      },
      // (v327)
      get shadeSets() {
        return shadeSets;
      },
      set shadeSets(v) {
        shadeSets = v;
      },
      get shadePStyle() {
        return shadePStyle;
      },
      set shadePStyle(v) {
        shadePStyle = v;
      },
      get shadeLines() {
        return shadeLines;
      },
      set shadeLines(v) {
        shadeLines = v;
      },
      get shadeHi() {
        return shadeHi;
      },
      set shadeHi(v) {
        shadeHi = v;
      },
      get shadeLo() {
        return shadeLo;
      },
      set shadeLo(v) {
        shadeLo = v;
      },
      get shadeLight() {
        return shadeLight;
      },
      set shadeLight(v) {
        shadeLight = v;
      },
      get shadeMain() {
        return shadeMain;
      },
      set shadeMain(v) {
        shadeMain = v;
      },
      get shadeFlat() {
        return shadeFlat;
      },
      set shadeFlat(v) {
        shadeFlat = v;
      },
      get photoXf() {
        return photoXf;
      },
      set photoXf(v) {
        photoXf = v;
      },
      get photoOp() {
        return photoOp;
      },
      set photoOp(v) {
        photoOp = v;
      },
      get photoPaper() {
        return photoPaper;
      },
      set photoPaper(v) {
        photoPaper = v;
      },
      get expand() {
        return expand;
      },
      set expand(v) {
        expand = v;
      },
      get expandChar() {
        return expandChar;
      },
      set expandChar(v) {
        expandChar = v;
      },
      get paletteSource() {
        return paletteSource;
      },
      set paletteSource(v) {
        paletteSource = v;
      },
      get savedPalId() {
        return savedPalId;
      },
      set savedPalId(v) {
        savedPalId = v;
      },
      get genHarmony() {
        return genHarmony;
      },
      set genHarmony(v) {
        genHarmony = v;
      },
      get genPal() {
        return genPal;
      },
      set genPal(v) {
        genPal = v;
      },
      get fromPal() {
        return fromPal;
      },
      set fromPal(v) {
        fromPal = v;
      },
      get minPos() {
        return minPos;
      },
      set minPos(v) {
        minPos = v;
      },
      get bgTrim() {
        return bgTrim;
      },
      set bgTrim(v) {
        bgTrim = v;
      },
      get addAutoClose() {
        return addAutoClose;
      },
      set addAutoClose(v) {
        addAutoClose = v;
      },
      get famRule() {
        return famRule;
      },
      set famRule(v) {
        famRule = v;
      },
      get lowX() {
        return lowX;
      },
      set lowX(v) {
        lowX = v;
      },
      get colOffer() {
        return colOffer;
      },
      set colOffer(v) {
        colOffer = v;
      },
      get focusAt() {
        return focusAt;
      },
      set focusAt(v) {
        focusAt = v;
      },
      get smpTry() {
        return smpTry;
      },
      set smpTry(v) {
        smpTry = v;
      },
      get gradArea() {
        return gradArea;
      },
      set gradArea(v) {
        gradArea = v;
      },
      get bgRule() {
        return bgRule;
      },
      set bgRule(v) {
        bgRule = v;
      },
      // (v318.35) Treat hatching as one section
      get hatchOne() {
        return hatchOne;
      },
      set hatchOne(v) {
        hatchOne = v;
      },
    },
    get undoTop() {
      const t = undoStack[undoStack.length - 1];
      return t ? { geo: !!(t.keep && t.keep.geo), sealed: !!t.sealed } : null;
    },
    // (v308: getting a picture in: faint grey marks, a coloured-in page, frames, Auto crop, a tilt's corners,
    // a straightened photo's Sensitivity)
    faintSplit: faintSplit,
    paperGains: paperGains,
    colourShare: colourShare,
    chromaOf: chromaOf,
    colourSecs: colourSecs,
    ruledBox: ruledBox,
    autoCropBox: autoCropBox,
    edgePadded: edgePadded,
    get faintOffer() {
      return faintOffer;
    },
    set faintOffer(v) {
      faintOffer = v;
    },
    get faintCut() {
      return faintCut;
    },
    set faintCut(v) {
      faintCut = v;
    },
    get srcColour() {
      return srcColour;
    },
    set srcColour(v) {
      srcColour = v;
    },
    resegment: resegment,
    // (v318.37: the detection settings kept for Undo before a change to them, as the controls do)
    reFrom: reFrom,
    get speckGone() {
      return speckGone;
    },
    // (v318.32: read off the sections, as segQuality does: the Undo tests compare them)
    get crumbGone() {
      return crumbCount();
    },
    crumbCount: crumbCount,
    // (v318.35) hatching as one section: the merger, and how many patches the last detection merged
    hatchMerge: hatchMerge,
    get hatchMade() {
      return hatchMade;
    },
    get hatchWould() {
      return hatchWould;
    },
    get hatchOne() {
      return hatchOne;
    },
    set hatchOne(v) {
      hatchOne = v;
    },
    mmPx: mmPx,
    speckCap: speckCap,
    trimOffer: trimOffer,
    mandalaGroups: mandalaGroups,
    matchUnify: matchUnify,
    ringDepths: ringDepths,
    shPresetApply: shPresetApply,
    shStyleCur: shStyleCur,
    moreOpen: moreOpen,
    moreFold: moreFold,
    // (v318.16) shading turned to a mode as its old row's buttons did (Off, Shadows, Light & shadow): the tests' way
    // to shade with the amounts as they are, one Undo step
    shadeTo: function (mode) {
      if (mode === shadeMode) return;
      shadeMode = mode;
      if (mode === 'off') shadeFlatMode = false;
      guideDirty = true;
      gradFollowLight();
      normalizeTones();
      renderControls();
      renderGuide();
      planCommit();
    },
    shPresetOn: shPresetOn,
    SH_PRESETS: SH_PRESETS,
    edgeShadeField: edgeShadeField,
    edgeBandsOf: edgeBandsOf,
    get edgeBands() {
      return edgeBands;
    },
    set edgeBands(v) {
      edgeBands = v;
    },
    processSrcAsync: processSrcAsync,
    get segBusy() {
      return segBusy;
    },
    // (v318.36: how many runs found their sections in the worker, segOff)
    get segOffCount() {
      return segOffCount;
    },
    get adaptC() {
      return adaptC;
    },
    set adaptC(v) {
      adaptC = v;
    },
    get tilt() {
      return tilt;
    },
  };
}
return {
  setCollection,
  // (v318.21) what a marker's cap says changed (caps.js): the open guide shows the codes again
  capChanged,
  collRefresh,
  configure,
  enter,
  leave,
  openDesign,
  continueGuide,
  importFile: importFromHome,
  // (v308: a photo picked in Import a guide)
  photoFile: photoFromHome,
  askBox: askBox,
  guideBrief: guideBrief,
  loadSample: sampleFromAnywhere,
  // (the sample page and its guide, for Home's start card, v300)
  sampleBA: sampleBA,
  sampleSrc: sampleSrc,
  // (the welcome's picture, v306)
  samplePics: samplePics,
  // (v306: Palette's Rainbow scheme picks as the Gradient does; Home's latest piece opens a guide and acts)
  rainbowPick: rainbowPick,
  openThen: openThen,
  startPic: startPic,
  pickPhoto: pickPhoto,
  pickPhotoHome: pickPhotoHome,
  pickPdfHome: pickPdfHome,
  // (v325: a colouring page from any photo, Home's link: 47-photo-page)
  ppPick: ppPick,
  // (v314: the photo of a finished page, from Home and the Library: 24-page-photo)
  finPick: finPick,
  finGet: finGet,
  finOk: finOk,
  finDrop: finDrop,
  // (v318.34: a copy's source picture, library.js libDuplicate)
  srcCopy: srcCopy,
  // (v315: read again after a restore)
  finRefresh: finRefresh,
  edToPlan: edToPlan,
  secEdPending: secEdPending,
  palNote: palNote,
  clearPal: clearPal,
  setNextPal: setNextPal,
  recolourWith: recolourWith,
  reassign,
  setSavedSource,
  showHome,
  hasGuide,
  thumbFor,
  plCarry,
  maybeResume: maybeShowResume,
  renamed: renamed,
  pdfKit: pdfKit,
  libChanged: libChanged,
  flushSave: flushNow,
  checkGuide: guideCheck,
  focusOnOpen: focusOnOpen,
  // (v316: Buy next, from your guides: what a saved guide's markers want, from its Library row)
  guideWants: guideWants,
  // (v318.26: Blends with, in a marker's details)
  blendFor: blendFor,
  // (v318 review: where a toast goes in the Plan, toastShow in core.js)
  toastSpot: toastSpot,
};
