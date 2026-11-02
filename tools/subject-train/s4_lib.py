# Step 4's per-photo work, in its own file so the helper processes Windows starts can load it (a process reads this
# file, not s4_label.py). Everything here is done without stock's map; step 4 itself runs stock and does the rest.
import random
import numpy as np
import torch
from common import CFG
from data import load_prep, down, dilate, SIDE

H, CR = CFG['held'], CFG['crops']


def bbox(m):
    ys, xs = np.nonzero(m)
    return (xs.min(), xs.max() + 1, ys.min(), ys.max() + 1) if len(xs) else None


def one_subject(masks):
    """The outlines make one subject: one outline, or all inside a 1.5× box of the largest one's."""
    if len(masks) == 1:
        return True
    big = max(masks, key=lambda m: m.sum())
    b = bbox(big)
    if b is None:
        return False
    cx, cy, w, h = (b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[1] - b[0]) * H['one_subject_box'], (b[3] - b[2]) * H['one_subject_box']
    for m in masks:
        o = bbox(m)
        if o is not None and (o[0] < cx - w / 2 or o[1] > cx + w / 2 or o[2] < cy - h / 2 or o[3] > cy + h / 2):
            return False
    return True


def mboxes(masks):
    """Each outline's box, as fractions of the photo (x0, x1, y0, y1)."""
    out = []
    for m in masks:
        b = bbox(m)
        if b is not None:
            out.append((b[0] / SIDE, b[1] / SIDE, b[2] / SIDE, b[3] / SIDE))
    return out


def outside(b, mb):
    """A box mostly outside every outline's box (so not the outlined object itself, a part of it, or its parent class)?"""
    a = max(1e-9, (b[1] - b[0]) * (b[3] - b[2]))
    for o in mb:
        ix = max(0, min(b[1], o[1]) - max(b[0], o[0]))
        iy = max(0, min(b[3], o[3]) - max(b[2], o[2]))
        if ix * iy >= 0.5 * a:
            return False
    return True


class Boxes:
    """A photo's boxes: (x0, x1, y0, y1, class, group-of or inside), and the class lists that decide what counts."""

    def __init__(self, box, back, scene, excl):
        self.box, self.back, self.scene, self.excl = box, back, scene, excl

    def has(self, iid):
        return iid in self.box

    def people(self, iid):
        return any(b[4] in self.excl for b in self.box.get(iid, ()))

    def rival(self, iid, masks):
        """An un-outlined possible subject (not a background class; not a group-of or inside box) at least half the
        outlined subject's size (by box)."""
        mb = mboxes(masks)
        if not mb:
            return False
        own = (max(o[1] for o in mb) - min(o[0] for o in mb)) * (max(o[3] for o in mb) - min(o[2] for o in mb))
        return any(not b[5] and b[4] not in self.back and outside(b, mb) and (b[1] - b[0]) * (b[3] - b[2]) >= H['rival'] * own
                   for b in self.box.get(iid, ()))

    def boxed(self, iid, masks, min_area):
        """Any un-outlined object (anything but true scenery: trees, buildings, plants …) of at least min_area?"""
        mb = mboxes(masks)
        return any(b[4] not in self.scene and outside(b, mb) and (b[1] - b[0]) * (b[3] - b[2]) >= min_area
                   for b in self.box.get(iid, ()))

    def crop_clear(self, iid, x, y, s):
        """A crop (x, y, s at SIDE) with no boxed object (anything but true scenery) overlapping it by config crop_box."""
        x, y, s = x / SIDE, y / SIDE, s / SIDE
        for b in self.box.get(iid, ()):
            if b[4] in self.scene:
                continue
            ix = max(0, min(b[1], x + s) - max(b[0], x))
            iy = max(0, min(b[3], y + s) - max(b[2], y))
            # (a box mostly inside the crop counts whatever its size; a bigger one when its part inside is crop_box of the CROP)
            if ix * iy >= min(0.5 * (b[1] - b[0]) * (b[3] - b[2]), H['crop_box'] * s * s):
                return False
        return True


def crop_tries(iid, allm, sizes, n, rng, boxes, keep=99):
    """Up to n random square crops (sizes: fractions of the photo's side) with no pixel of any drawn outline (grown)
    and, where the photo has a box table, no boxed object; at most `keep` of them."""
    out = []
    for _ in range(n):
        s = int(SIDE * rng.uniform(*sizes))
        x, y = rng.randint(0, SIDE - s), rng.randint(0, SIDE - s)
        if not allm[y:y + s, x:x + s].any() and boxes.crop_clear(iid, x, y, s):
            out.append((iid, x, y, s))
            if len(out) >= keep:
                break
    return out


def sq_iou(a, b):
    """How much two square crops (id, x, y, s) overlap."""
    ix = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    iy = max(0, min(a[2] + a[3], b[2] + b[3]) - max(a[2], b[2]))
    i = ix * iy
    return i / (a[3] * a[3] + b[3] * b[3] - i)


class Prep(torch.utils.data.Dataset):
    """One photo's stock-free work: its outlines at the model's size, the boxes' verdicts, and candidate crops."""

    def __init__(self, ids, kinds, excl, person, boxes):
        self.ids, self.kinds, self.excl, self.person, self.boxes = ids, kinds, excl, person, boxes

    def __len__(self):
        return len(self.ids)

    def __getitem__(self, i):
        try:
            return self.one(i)
        except Exception as e:        # (an unreadable photo file is counted and skipped, not the end of the step)
            return {'id': self.ids[i], 'error': str(e)}

    def one(self, i):
        iid = self.ids[i]
        kind = self.kinds[iid]
        img, masks, labs = load_prep(iid)
        rng = random.Random(iid)
        ms = [down(m) for m in masks]
        L = np.any(masks, axis=0) if len(masks) else np.zeros((SIDE, SIDE), bool)
        allm = dilate(L, CR['dilate'])
        bx = self.boxes
        o = {'id': iid, 'img': img, 'masks': masks, 'labs': labs, 'ms': ms, 'L3': down(L), 'one': one_subject(list(masks)),
             'excl': any(l in self.excl for l in labs), 'hasbox': bx.has(iid), 'pbox': bx.people(iid)}
        if kind == 'train':
            o['rival'] = bx.rival(iid, masks)
            # (training empties: crops at two sizes, the smaller only used if the larger fall short)
            o['tries'] = [(lv, t) for lv, (sz, n) in enumerate(CR['levels'])
                          for t in crop_tries(iid, allm, sz, n, rng, bx)]
        else:
            pm = [k for k, l in enumerate(labs) if l in self.person]
            o['pm'] = pm
            o['rival'] = bx.rival(iid, masks)
            o['rival_person'] = bx.rival(iid, masks[pm]) if pm else False
            o['boxed'] = bx.boxed(iid, masks, H['scenery_box'])
            # (held-out crops for the checks: up to two, the larger size first)
            got = []
            for sz, n in H['crop_levels']:
                for t in crop_tries(iid, allm, sz, n, rng, bx):
                    if not got or sq_iou(got[0], t) < 0.3:     # (a second crop only where it shows another part)
                        got.append(t)
                    if len(got) >= 2:
                        break
                if len(got) >= 2:
                    break
            o['crops'] = got
        return o


def as_is(o):
    """The loader hands each photo's results back unchanged (not turned into tensors)."""
    return o
