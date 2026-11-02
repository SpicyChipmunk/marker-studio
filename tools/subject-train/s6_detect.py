# Decision 35 (prototype for step 6): a COCO-trained detector (torchvision Faster R-CNN ResNet-50 FPN v2) run once over the
# check photos and the held crops, to set apart photos with un-outlined people or rival objects (which the Open Images box
# tables miss). Stock's map is not used, so the flags are neutral between the models. Nothing here is shipped.
# Flags: photo -> a detected person (score >= THR) whose box is mostly outside the outlines' boxes; or any other detected
# object, not of a scene class, mostly outside the outlines' boxes and at least `rival` (config, 0.5) of the outlined
# subject's box. Crop -> anything (score >= THR) but a scene class. The own subject is often mislabelled (a frog as "bird",
# a lighthouse as "traffic light", a bear as "dog"), so classes are never compared: a box mostly inside the outlines' box is
# the subject or a part of it, whatever the detector calls it.
import json, time
import numpy as np
import torch
from common import CFG, WORK, log, fail, download, sha256, device
from data import load_prep, crop_img, SIDE

DET_URL = 'https://download.pytorch.org/models/fasterrcnn_resnet50_fpn_v2_coco-dd69338a.pth'
DET_SHA = 'dd69338a24b8d7381807e247652bdc356325bcbaf1cd3e092e00e0a1a58706bf'
THR = CFG.get('detector', {}).get('score', 0.6)
MIN_SIZE = CFG.get('detector', {}).get('min_size', 800)
# COCO classes that are scenery or furniture in the kit's sense (config "background"/"scenery_classes" equivalents): never a
# rival, never a flag in a crop. Everything else (vehicles, animals, food, household objects, sports gear) can be a subject.
SCENE = {'dining table', 'bed', 'couch', 'potted plant', 'sink', 'refrigerator', 'oven', 'microwave', 'toaster', 'toilet'}
PERSON = 'person'


def detector():
    import torchvision
    from torchvision.models.detection import fasterrcnn_resnet50_fpn_v2
    ddir = WORK / 'detector'
    ddir.mkdir(exist_ok=True)
    w = ddir / DET_URL.rsplit('/', 1)[1]
    if not w.exists():
        log('Downloading the check detector\'s weights (once, 175 MB, into work/detector)...')
        try:
            download(DET_URL, w)
        except Exception as e:
            fail('the detector weights could not be downloaded (%s). Run 6-results again; if it fails twice, tell Claude.' % e)
    if sha256(w) != DET_SHA:
        w.unlink()
        fail('the detector weights file was damaged (checksum): run 6-results again to download it afresh.')
    net = fasterrcnn_resnet50_fpn_v2(weights=None, weights_backbone=None, min_size=MIN_SIZE, max_size=2 * MIN_SIZE, box_score_thresh=THR)
    net.load_state_dict(torch.load(w, map_location='cpu', weights_only=True))
    names = torchvision.models.detection.FasterRCNN_ResNet50_FPN_V2_Weights.COCO_V1.meta['categories']
    return net.eval(), names


def run(items, make, dev, net, names, what, limit=None):
    """items: keys; make(key) -> uint8 photo (SIDE x SIDE x 3). Detections cached in work/detector/<what>.json as
    {key: [[class, score, x0, y0, x1, y1 (fractions)], ...]} so a re-run of step 6 does not repeat the GPU pass."""
    cf = WORK / 'detector' / (what + '.json')
    dets = json.load(open(cf)) if cf.exists() else {}
    todo = [k for k in items if str(k) not in dets]
    if limit is not None:
        todo = todo[:limit]
    t0 = time.time()
    B = 8 if dev.type == 'cuda' else 2
    with torch.no_grad():
        for s in range(0, len(todo), B):
            b = todo[s:s + B]
            xs = [torch.from_numpy(np.array(make(k))).permute(2, 0, 1).float().div_(255).to(dev) for k in b]
            with torch.autocast(dev.type, enabled=dev.type == 'cuda'):
                out = net(xs)
            for k, o in zip(b, out):
                dets[str(k)] = [[names[int(l)], round(float(sc), 3)] + [round(float(v) / SIDE, 4) for v in bx]
                                for bx, l, sc in zip(o['boxes'].float().cpu(), o['labels'].cpu(), o['scores'].float().cpu())]
            if (s // B) % 50 == 0 and s:
                log('   detector: %s %d/%d (%.0f s)' % (what, s, len(todo), time.time() - t0))
    if todo:
        with open(cf.with_suffix('.tmp'), 'w') as f:          # (written whole, then swapped in: never left half-written)
            json.dump(dets, f)
        cf.with_suffix('.tmp').replace(cf)
        log('   detector: %s, %d photos, %.0f s' % (what, len(todo), time.time() - t0))
    return dets


def _box(m):
    ys, xs = np.nonzero(m)
    return (xs.min() / SIDE, ys.min() / SIDE, (xs.max() + 1) / SIDE, (ys.max() + 1) / SIDE) if len(xs) else None


def _inside(b, boxes, part=0.5):
    """Is `part` or more of box b inside one of `boxes`? (b, boxes: x0, y0, x1, y1 fractions)"""
    a = max(1e-9, (b[2] - b[0]) * (b[3] - b[1]))
    for o in boxes:
        ix = max(0, min(b[2], o[2]) - max(b[0], o[0]))
        iy = max(0, min(b[3], o[3]) - max(b[1], o[1]))
        if ix * iy >= part * a:
            return True
    return False


def photo_flag(dets, masks):
    """Why a check photo is set apart ('' if it is not): 'person' or 'rival <class>'."""
    ob = [b for b in (_box(m) for m in masks) if b]
    if not ob:
        return ''
    own = (max(o[2] for o in ob) - min(o[0] for o in ob)) * (max(o[3] for o in ob) - min(o[1] for o in ob))
    rival = ''
    for cls, sc, *b in dets:
        if sc < THR or _inside(b, ob):
            continue
        if cls == PERSON:
            return 'person'
        if cls not in SCENE and (b[2] - b[0]) * (b[3] - b[1]) >= CFG['held']['rival'] * own and not rival:
            rival = 'rival ' + cls
    return rival


def crop_flag(dets):
    hits = [cls for cls, sc, *b in dets if sc >= THR and cls not in SCENE]
    return hits[0] if hits else ''


def flags(ids, crops, limit=None):
    """ids: check photo ids (not the people set); crops: [(id, x, y, s)]. Returns ({id: reason}, {crop: reason})."""
    dev = device()
    net, names = detector()
    net = net.to(dev)
    log('Check detector (COCO Faster R-CNN v2) on %d photos and %d crops, on %s...' % (len(ids), len(crops), dev))
    pd = run(ids, lambda i: load_prep(i)[0], dev, net, names, 'photos', limit=limit)
    cd = run(crops, lambda c: crop_img(load_prep(c[0])[0], *c[1:]), dev, net, names, 'crops', limit=limit)
    pf = {i: photo_flag(pd[i], load_prep(i)[1]) for i in ids if i in pd}
    cf = {c: crop_flag(cd[str(c)]) for c in crops if str(c) in cd}
    del net
    if dev.type == 'cuda':
        torch.cuda.empty_cache()
    return {i: r for i, r in pf.items() if r}, {c: r for c, r in cf.items() if r}
