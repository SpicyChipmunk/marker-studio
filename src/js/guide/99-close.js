if (typeof globalThis !== 'undefined' && globalThis.__MS_TEST) {
  globalThis.__mstest = {
    segment: segment,
    labelCells: labelCells,
    applyBg: applyBg,
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
    get saveErr() {
      return _saveErr;
    },
    mergeCellsSnap: function (a, b) {
      snapshotSeg();
      return mergeCells(a, b);
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
    buildExportCanvas: buildExportCanvas,
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
    get geo() {
      return geo;
    },
    get picScale() {
      return picS;
    },
    sheetOpen: sheetOpen,
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
    noRepPool: noRepPool,
    poolMsg: poolMsg,
    lookNote: lookNote,
    // the Gradient's parts (30-palette-assign), for the unit tests
    grad: {
      groupSize: gradGroupSize,
      hueGap: hueGap,
      isLoop: gradIsLoop,
      tierPool: gradTierPool,
      pickSpread: gradPickSpread,
      pickField: gradPickField,
      deMatrix: deMatrix,
      tour: gradTour,
      sequence: gradSequence,
      splitByArea: splitByArea,
      lightSign: gradLightSign,
      plan: gradPlan,
      poolSource: poolSource,
      build: buildGradient,
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
    },
    get coll() {
      return coll;
    },
    set coll(v) {
      coll = v;
    },
    get gradTourMs() {
      return GRAD_TOUR_MS;
    },
    surprise: surprise,
    buildShareCard: buildShareCard,
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
    get fnLast() {
      return _fnLast;
    },
    shadeGlaze: shadeGlaze,
    stepText: stepText,
    shadeHowto: shadeHowto,
    shadeTipHTML: shadeTipHTML,
    shT2: shT2,
    minPx: minPx,
    minPosOld: minPosOld,
    MIN_DEF: MIN_DEF,
    gradStartSay: gradStartSay,
    styleSave: styleSave,
    styleFields: STYLE_FIELDS,
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
  };
}
return {
  setCollection,
  configure,
  enter,
  leave,
  openDesign,
  importFile: importFromHome,
  loadSample: sampleFromAnywhere,
  pickPhoto: pickPhoto,
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
