if (typeof globalThis !== 'undefined' && globalThis.__MS_TEST) {
  globalThis.__mstest = {
    segment: segment,
    labelCells: labelCells,
    applyBg: applyBg,
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
    set labels(v) {
      labels = v;
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
    get focusOrd() {
      return focusOrd;
    },
    get focusPos() {
      return focusPos;
    },
    get focusFin() {
      return focusFin;
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
    codeNorm: codeNorm,
    openSectionPop: openSectionPop,
    // (v306: the marker strokes when a page is finished in Focus mode)
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
    // (v304 tests: the tone lines drawn into a buffer; a held shading put back as Undo does; the brand letters in print)
    shadeLinesDraw: shadeLinesDraw,
    heldSet: heldSet,
    guideMixed: guideMixed,
    shadePick: shadePick,
    shadeStylePick: shadeStylePick,
    shadeGeom: shadeGeom,
    shadeable: shadeable,
    shadeZone: shadeZone,
    setCollection: setCollection,
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
      okGeom(function () {
        // (q: the page's corners in the photo as taken, straightened)
        if (o.q) {
          srcImg = pgOrig;
          pgApply(o.q, false);
          return;
        }
        if ('rot90' in o) rot90 = o.rot90;
        if ('tilt' in o) tilt = o.tilt;
        if ('crop' in o) cropRect = o.crop;
        reprocessImg();
      });
    },
    autoCrop: autoCrop,
    buildGuide: buildGuide,
    photoMove: photoMove,
    photoFit: photoFit,
    photoPrepDist: _photoPrepDist,
    photoStatsHTML: photoStatsHTML,
    zoneNew: zoneNew,
    zoneSelect: zoneSelect,
    get pgOrig() {
      return pgOrig;
    },
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
    get locks() {
      return locks;
    },
    get undoBytes() {
      return undoBytes;
    },
    get undoCount() {
      return undoStack.length;
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
    shadeFromPhoto: shadeFromPhoto,
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
    shadeHowto: shadeHowto,
    shadeTipHTML: shadeTipHTML,
    shT2: shT2,
    minPx: minPx,
    grayUp: grayUp,
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
      get planStack() {
        return planStack;
      },
      get balStat() {
        return balStat;
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
  // (the welcome's picture, v306)
  samplePics: samplePics,
  // (v306: Palette's Rainbow scheme picks as the Gradient does; Home's latest piece opens a guide and acts)
  rainbowPick: rainbowPick,
  openThen: openThen,
  startPic: startPic,
  pickPhoto: pickPhoto,
  pickPhotoHome: pickPhotoHome,
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
  maybeResume: maybeShowResume,
  renamed: renamed,
  pdfKit: pdfKit,
  libChanged: libChanged,
  flushSave: flushNow,
  checkGuide: guideCheck,
  focusOnOpen: focusOnOpen,
};
