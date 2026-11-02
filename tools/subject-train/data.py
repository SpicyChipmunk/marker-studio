# Photos, labels, crops, the model's maps and the measures, shared by steps 4–6.
import csv, io
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from common import CFG, WORK, MEAN, STD

SIDE, INP = CFG['side'], CFG['input']
PREP, LABELS, LISTS = WORK / 'prep', WORK / 'labels', WORK / 'lists'
PREP6 = WORK / 'round6' / 'prep'          # (round 6's new photos, kept apart: 4c-prep-round6)
CROPS = WORK / 'crops.csv'


def prep_path(iid):
    p = PREP / (iid + '.npz')
    return p if p.exists() or not (PREP6 / (iid + '.npz')).exists() else PREP6 / (iid + '.npz')


def load_prep(iid):
    z = np.load(prep_path(iid))
    img = np.asarray(Image.open(io.BytesIO(z['jpg'].tobytes())).convert('RGB'))
    masks = np.unpackbits(z['masks'], axis=1)[:, :SIDE * SIDE].reshape(-1, SIDE, SIDE).astype(bool)
    return img, masks, [str(x) for x in z['labels']]


def load_label(iid):
    return np.asarray(Image.open(LABELS / (iid + '.png'))) >= 128


def read_list(name):
    p = LISTS / (name + '.txt')
    return [l.strip() for l in open(p, encoding='utf-8') if l.strip()] if p.exists() else []


def read_crops(role):
    """The background crops (step 4) for one use: 'train', 'val' or 'test' → [(id, x, y, s)] at SIDE."""
    if not CROPS.exists():
        return []
    with open(CROPS, encoding='utf-8') as f:
        return [(r['id'], int(r['x']), int(r['y']), int(r['s'])) for r in csv.DictReader(f) if r['role'] == role]


def crop_img(img, x, y, s, n=SIDE):
    """A square crop of a SIDE photo, made n × n (bilinear)."""
    return np.asarray(Image.fromarray(img[y:y + s, x:x + s]).resize((n, n), Image.BILINEAR))


def to_input(imgs, dev, n=INP):
    """uint8 photos (B, SIDE, SIDE, 3) → the model's input (B, 3, n, n), squashed as the app does, normalised."""
    x = torch.as_tensor(np.stack(imgs), device=dev).permute(0, 3, 1, 2).float() / 255
    x = F.interpolate(x, size=(n, n), mode='bilinear', align_corners=False)
    m = torch.tensor(MEAN, device=dev).view(1, 3, 1, 1)
    s = torch.tensor(STD, device=dev).view(1, 3, 1, 1)
    return (x - m) / s


def down(mask, n=INP):
    """A boolean mask at n × n (area-averaged, then 0.5)."""
    t = torch.as_tensor(np.ascontiguousarray(mask), dtype=torch.float32)[None, None]
    return (F.interpolate(t, size=(n, n), mode='area')[0, 0] >= 0.5).numpy()


def maps(net, imgs, dev, amp=True, grid=INP):
    """The model's map (sigmoid) for each photo, on one measuring grid for every model: the photo at the model's own
    input size (net.inp: 320 for TE-0, 352 for TE-2), its map resized to grid × grid (bilinear) before anything cuts
    it at 0.5. A TE-0 map at 320 is untouched, so every earlier number stays the same."""
    n = getattr(net, 'inp', INP)
    x = to_input(imgs, dev, n)
    with torch.no_grad(), torch.autocast(device_type=dev.type, enabled=amp and dev.type == 'cuda'):
        y = net(x)[0]
    y = y.float()
    if n != grid:
        y = F.interpolate(y, size=(grid, grid), mode='bilinear', align_corners=False)
    return y[:, 0].cpu().numpy()


def dilate(mask, r):
    """A boolean mask grown by r pixels (a square)."""
    if r <= 0:
        return mask.copy()
    t = torch.as_tensor(np.ascontiguousarray(mask), dtype=torch.float32)[None, None]
    t = F.max_pool2d(t, (2 * r + 1, 1), 1, (r, 0))          # (a square grown in two passes: the same, 5× quicker)
    t = F.max_pool2d(t, (1, 2 * r + 1), 1, (0, r))
    return (t[0, 0] > 0).numpy()


def agree_err(S, U):
    """How far a subject S is from the drawn outline U, allowing a pixel either way: the pixels of each outside the
    other grown by one pixel, as a share of U (0: the same to a pixel). A boundary-tolerant version of IoU ≥ 0.85."""
    n = U.sum()
    if n == 0:
        return 1.0
    return float((S & ~dilate(U, 1)).sum() + (U & ~dilate(S, 1)).sum()) / float(n)


def strays(P):
    """The app's stray-parts rule (48-subject subStrays): a separate part under 10% of the largest part and under 1%
    of the picture is dropped. P: boolean map; returns a new one."""
    from scipy import ndimage
    lab, n = ndimage.label(P)
    if n <= 1:
        return P.copy()
    a = np.bincount(lab.ravel())[1:]
    big = a.max()
    drop = np.nonzero((a < 0.1 * big) & (a < 0.01 * P.size))[0] + 1
    if not len(drop):
        return P.copy()
    return P & ~np.isin(lab, drop)


def band(share):
    """What the app decides from the subject's share: 0 no clear subject (< 1%), 1 the crop offer (1–5%), 2 a subject."""
    return 0 if share < 0.01 else (1 if share < 0.05 else 2)


def _boundary(b):
    t = torch.as_tensor(np.ascontiguousarray(b), dtype=torch.float32)[None, None]
    er = -F.max_pool2d(-t, 3, 1, 1)
    return (t - er)[0, 0] > 0


def boundary_f(pred, gt, tol=2):
    """How well the outline follows the drawn one: F-measure of outline pixels within tol px of each other."""
    pb, gb = _boundary(pred), _boundary(gt)
    if not gb.any() and not pb.any():
        return 1.0
    if not gb.any() or not pb.any():
        return 0.0
    k = 2 * tol + 1
    gd = F.max_pool2d(gb.float()[None, None], k, 1, tol)[0, 0] > 0
    pd = F.max_pool2d(pb.float()[None, None], k, 1, tol)[0, 0] > 0
    p = float((pb & gd).sum()) / float(pb.sum())
    r = float((gb & pd).sum()) / float(gb.sum())
    return 0.0 if p + r == 0 else 2 * p * r / (p + r)


def iou(a, b):
    u = np.logical_or(a, b).sum()
    return 1.0 if u == 0 else float(np.logical_and(a, b).sum()) / float(u)


def api_loss(pred, mask):
    return api_loss_each(pred, mask).mean()


def api_loss_each(pred, mask):
    """TRACER's own training loss (adaptive pixel intensity: BCE, IoU and MAE weighted towards edges), in float32.
    Round 2: the MAE term's divisor is the edge weight's sum, at least 1,000 (run 1's clamp at 1 made an empty label
    the SUM of |pred| over every pixel, ~10,000× a normal photo's weight, and gave small subjects 3–4× the weight);
    an empty label's MAE is a plain mean."""
    pred, mask = pred.float().clamp(1e-6, 1 - 1e-6), mask.float()
    w1 = torch.abs(F.avg_pool2d(mask, 3, 1, 1) - mask)
    w2 = torch.abs(F.avg_pool2d(mask, 15, 1, 7) - mask)
    w3 = torch.abs(F.avg_pool2d(mask, 31, 1, 15) - mask)
    omega = 1 + 0.5 * (w1 + w2 + w3) * mask
    bce = F.binary_cross_entropy(pred, mask, reduction='none')
    abce = (omega * bce).sum(dim=(2, 3)) / (omega + 0.5).sum(dim=(2, 3))
    inter = ((pred * mask) * omega).sum(dim=(2, 3))
    union = ((pred + mask) * omega).sum(dim=(2, 3))
    aiou = 1 - (inter + 1) / (union - inter + 1)
    mae = F.l1_loss(pred, mask, reduction='none')
    den = (omega - 1).sum(dim=(2, 3))
    amae = torch.where(den > 0, (omega * mae).sum(dim=(2, 3)) / den.clamp(min=1000), mae.mean(dim=(2, 3)))
    return (0.7 * abce + 0.7 * aiou + 0.7 * amae).mean(dim=1)          # (one value a photo: api_loss is their mean)


def edges_of(mask):
    """TRACER's edge target: where the mask changes (its edge_generator.py, on the label)."""
    m = mask.float()
    gx = torch.zeros_like(m)
    gy = torch.zeros_like(m)
    gx[..., :, 1:-1] = (m[..., :, 2:] - m[..., :, :-2]) / 2
    gy[..., 1:-1, :] = (m[..., 2:, :] - m[..., :-2, :]) / 2
    gx[..., :, 0], gx[..., :, -1] = m[..., :, 1] - m[..., :, 0], m[..., :, -1] - m[..., :, -2]
    gy[..., 0, :], gy[..., -1, :] = m[..., 1, :] - m[..., 0, :], m[..., -1, :] - m[..., -2, :]
    return ((gx * gx + gy * gy) > 0).float()
