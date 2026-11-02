# Step 5: train from TRACER's own weights the versions in config train.runs. Round 2 trained A2-decoder (only the part
# that draws the map) and A2plus (that, plus the backbone's last five blocks at a fifth of the rate); round 3 trains A3
# (A2plus's recipe on more photos, with zoomed-out photos, more empty crops, the passes set by the list's size and the
# last passes' averaged weights kept), and checks round 2's A2plus on the same validation photos for comparison.
# TRACER's own loss (with round 2's fix for empty labels), mixed precision, a cosine schedule to a tenth, weights
# averaged as it goes (EMA). The training list mixes the agreeing photos, empty background crops (~12%) and photo
# grids (one photo shrunk into a 2×2 or 3×3 grid of background crops, so subjects of 1–5% are seen with exact
# outlines). After each pass the averaged weights are checked on real validation photos (subjects, small subjects,
# empty crops) and on pasted subjects (an early warning); the best pass is kept. Restartable. Stops if the loss blows up.
# Round 4 (config round 4): B1 and B1-wide start from round 3's winner (A3) instead of TRACER's weights, with round 3's
# list plus its one-outline 1–5% photos again and the disagree photos twice a pass (config train.repeat), each run's own
# passes (8) and a 100-step warm-up; every pass's averaged weights are saved (B1's pass 5 is B1-early, decision 63), and
# the checks add val_hard and val_hard_small (stock's failures), reported beside the old lines, never in the score.
# Round 5 (config round 5, decisions 88-98e): C1 (stock TRACER-TE4, input 448) and C2 (stock TE2, 352) with A3's recipe
# on round 3's exact lists, read from work\round3 (round 4 changed work\lists); each model trains at its own input
# size; the batch steps down if the card can't hold it; checkpoints record the arch; a wide run (C1-wide, C2-wide)
# trains only when step 6 names it (5b-train-wide, --wide). Each pass also reports a stock-free line: 400 of round 2's
# seen subjects and its 400 seen people (round 3's validation subjects were chosen where stock TE0 agreed: they favour
# TE0).
import csv, gc, itertools, json, math, os, random, shutil, time, sys, traceback
import numpy as np
import torch
import torch.nn.functional as F
from torch.optim.swa_utils import AveragedModel, get_ema_multi_avg_fn
from PIL import Image, ImageFilter
from common import (CFG, WORK, RESULTS, log, fail, mark_done, done, load_tracer, device, MEAN, STD, R2, benchmark,
                    benchmark_weights, R3DIR, read_r3_list, read_r2_list, download, sha256)
import data as _data
from data import (load_prep, load_label, read_list, read_crops, crop_img, maps, down, iou, boundary_f, api_loss, strays,
                  dilate, SIDE, INP, api_loss_each)

T, GR, GD = CFG['train'], CFG['grid'], CFG['guards']
R5 = CFG.get('round', 2) >= 5
R6 = CFG.get('round', 2) >= 6
R6T = CFG.get('round6_train', {})
LAB6 = WORK / 'round6' / 'labels'
if R5:          # (round 3's own outlines and crops, here and in every data-loading worker, which imports this module)
    _data.LABELS, _data.CROPS = R3DIR / 'labels', R3DIR / 'crops.csv'
with open(WORK / 'candidates.csv', encoding='utf-8') as f:
    GROUP = {c['id']: c['group'] for c in csv.DictReader(f)}
THIN = set(CFG['thin_groups'])


def to_x(img, lab, n=INP):
    """A photo and its label at the model's input size n (round 5: 448 for TE4, 352 for TE2; else INP)."""
    t = torch.from_numpy(np.array(img)).permute(2, 0, 1)[None].float() / 255
    x = F.interpolate(t, size=(n, n), mode='bilinear', align_corners=False)[0].permute(1, 2, 0).numpy()
    lt = torch.from_numpy(np.ascontiguousarray(lab).astype(np.float32))[None, None]
    y = (F.interpolate(lt, size=(n, n), mode='area')[0, 0] >= 0.5).numpy().astype(np.float32)
    return x, y


def shrink_label(lab, n):
    """A label made n × n for a grid cell: bilinear ≥ 0.3, which keeps thin parts better than area ≥ 0.5."""
    m = Image.fromarray((lab * 255).astype(np.uint8)).resize((n, n), Image.BILINEAR)
    return np.asarray(m) >= 0.3 * 255


def load_label6(iid):
    return np.asarray(Image.open(LAB6 / (iid + '.png'))) >= 128


def seed_worker(_):
    """(round 6) Each loading process's own random numbers from the run's seed (the loader's generator), so a run is
    repeatable and E4b's second seed is a real second seed."""
    random.seed(torch.initial_seed() % (1 << 32))
    np.random.seed(torch.initial_seed() % (1 << 32))


class Photos(torch.utils.data.Dataset):
    def __init__(self, ids, crops, bgs, n=INP, people=(), paste=None, n_paste=0):
        """Round 6 adds people photos ('h': their own outlines in work\\round6\\labels, at their own scale: no grid,
        no zoom-out) and pasted small subjects ('s': made afresh each time from paste = (sources, backgrounds)); each
        item then also says whether it is a people photo (for the soft-target fallback, decision 116)."""
        self.items = ([('p', i) for i in ids] + [('h', i) for i in people] + [('s', k) for k in range(n_paste)] +
                      [('c',) + tuple(c) for c in crops])
        self.bgs = bgs
        self.n = n
        self.paste = paste
        self.r6 = R6

    def __len__(self):
        return len(self.items)

    def grid(self, img, lab, iid, rng):
        for g in ((3, 2) if (GROUP.get(iid) not in THIN and rng.random() < GR['share3']) else (2,)):
            n = SIDE // g
            small = shrink_label(lab, n)
            if small.sum() < GR['min_share'] * SIDE * SIDE:
                continue
            if g == 3 and small.sum() * g * g < GR['keep3'] * lab.sum():
                continue
            canvas = np.zeros((SIDE, SIDE, 3), np.uint8)
            L = np.zeros((SIDE, SIDE), bool)
            cell = rng.randrange(g * g)
            for k in range(g * g):
                y0, x0 = (k // g) * n, (k % g) * n
                if k == cell:
                    canvas[y0:y0 + n, x0:x0 + n] = np.asarray(Image.fromarray(img).resize((n, n), Image.BILINEAR))
                    L[y0:y0 + n, x0:x0 + n] = small
                else:
                    b = self.bgs[rng.randrange(len(self.bgs))]
                    canvas[y0:y0 + n, x0:x0 + n] = crop_img(load_prep(b[0])[0], b[1], b[2], b[3], n)
            return canvas, L
        return None

    def zoom_out(self, img, lab, rng):
        """(round 3) The photo shrunk so its subject fills 5–25% of the frame, at a random place on a 2×2 mosaic of
        background crops (made at half size, as the grids' are, so the photo is no sharper than what is around it)."""
        share = lab.mean()
        if share < GR.get('zoom_min_share', 0.1):
            return None
        lo, hi = GR.get('zoom_to', [0.05, 0.25])
        k = math.sqrt(rng.uniform(lo, hi) / share)
        n = int(SIDE * k)
        if n < 48 or n > int(0.9 * SIDE):
            return None
        h = SIDE // 2
        canvas = np.zeros((SIDE, SIDE, 3), np.uint8)
        for q in range(4):
            b = self.bgs[rng.randrange(len(self.bgs))]
            canvas[(q // 2) * h:(q // 2 + 1) * h, (q % 2) * h:(q % 2 + 1) * h] = crop_img(load_prep(b[0])[0], b[1], b[2], b[3], h)
        y0, x0 = rng.randint(0, SIDE - n), rng.randint(0, SIDE - n)
        canvas[y0:y0 + n, x0:x0 + n] = np.asarray(Image.fromarray(img).resize((n, n), Image.BILINEAR))
        L = np.zeros((SIDE, SIDE), bool)
        L[y0:y0 + n, x0:x0 + n] = shrink_label(lab, n)
        return canvas, L

    def pasted(self, rng):
        """(round 6, decision 117) A real subject cut by its outline, 0.7-4% of the frame, edges feathered, on an empty
        crop; labelled subject."""
        src, bgs = self.paste
        lo, hi = R6T.get('paste_range', [0.007, 0.04])
        for _ in range(10):
            i = src[rng.randrange(len(src))]
            img, lab = load_prep(i)[0], load_label(i)
            ys, xs = np.nonzero(lab)
            if not len(ys):
                continue
            cut, cm = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], lab[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            k = math.sqrt(rng.uniform(lo, hi) * SIDE * SIDE / cm.sum())
            h, w = int(cm.shape[0] * k), int(cm.shape[1] * k)
            if h < 4 or w < 4 or h >= SIDE or w >= SIDE:
                continue
            b = bgs[rng.randrange(len(bgs))]
            bg = crop_img(load_prep(b[0])[0], *b[1:]).astype(np.float32)
            c2 = np.asarray(Image.fromarray(cut).resize((w, h), Image.BILINEAR), np.float32)
            mi = Image.fromarray((cm * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
            m2 = np.asarray(mi) >= 128
            a = np.asarray(mi.filter(ImageFilter.GaussianBlur(R6T.get('paste_feather', 0.8))), np.float32)[..., None] / 255
            y0, x0 = rng.randint(0, SIDE - h), rng.randint(0, SIDE - w)
            bg[y0:y0 + h, x0:x0 + w] = bg[y0:y0 + h, x0:x0 + w] * (1 - a) + c2 * a
            L = np.zeros((SIDE, SIDE), bool)
            L[y0:y0 + h, x0:x0 + w] = m2
            return bg.astype(np.uint8), L
        b = bgs[rng.randrange(len(bgs))]
        return crop_img(load_prep(b[0])[0], *b[1:]), np.zeros((SIDE, SIDE), bool)

    def __getitem__(self, i):
        it = self.items[i]
        rng = random.Random(random.getrandbits(64)) if self.r6 else random.Random()
        if it[0] == 'c':
            img = crop_img(load_prep(it[1])[0], *it[2:])
            lab = np.zeros((SIDE, SIDE), bool)
        elif it[0] == 's':
            img, lab = self.pasted(rng)
        elif it[0] == 'h':          # (people: their own scale, a crop and a flip as any photo)
            img, lab = load_prep(it[1])[0], load_label6(it[1])
            s = int(SIDE * rng.uniform(0.8, 1.0))
            x0, y0 = rng.randint(0, SIDE - s), rng.randint(0, SIDE - s)
            img, lab = img[y0:y0 + s, x0:x0 + s], lab[y0:y0 + s, x0:x0 + s]
        else:
            img, lab = load_prep(it[1])[0], load_label(it[1])
            u = rng.random()
            gr = None
            if self.bgs and u < GR['share']:
                gr = self.grid(img, lab, it[1], rng)
            elif self.bgs and u < GR['share'] + GR.get('zoom_out', 0):
                gr = self.zoom_out(img, lab, rng)
            if gr is not None:
                img, lab = gr
            else:
                s = int(SIDE * rng.uniform(0.8, 1.0))
                x0, y0 = rng.randint(0, SIDE - s), rng.randint(0, SIDE - s)
                img, lab = img[y0:y0 + s, x0:x0 + s], lab[y0:y0 + s, x0:x0 + s]
        if rng.random() < 0.5:
            img, lab = img[:, ::-1], lab[:, ::-1]
        x, y = to_x(img, lab, self.n)
        x = np.clip((x - 0.5) * rng.uniform(0.9, 1.1) + 0.5 + rng.uniform(-0.06, 0.06), 0, 1)
        x = (x - np.array(MEAN, np.float32)) / np.array(STD, np.float32)
        if self.r6:
            return torch.from_numpy(x.transpose(2, 0, 1).copy()), torch.from_numpy(y[None]), torch.tensor(it[0] == 'h')
        return torch.from_numpy(x.transpose(2, 0, 1).copy()), torch.from_numpy(y[None])


def clean(y):
    return strays(y >= 0.5)


def pastes(train_ids, bgs, n_src=8):
    """A fixed set of pasted subjects (training photos' outlines on background crops) at 0.5–5% of the frame."""
    rng = random.Random(7)
    src = list(itertools.islice((i for i in train_ids if 0.08 <= load_label(i).mean() <= 0.4), n_src))
    out = []
    for i in src:
        img, lab = load_prep(i)[0], load_label(i)
        ys, xs = np.nonzero(lab)
        cut, cm = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1], lab[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        for b in bgs[:4]:
            bg = crop_img(load_prep(b[0])[0], *b[1:])
            for sh in (0.005, 0.01, 0.02, 0.03, 0.05):
                k = math.sqrt(sh * SIDE * SIDE / cm.sum())
                h, w = max(2, int(cm.shape[0] * k)), max(2, int(cm.shape[1] * k))
                if h >= SIDE or w >= SIDE:
                    continue
                c2 = np.asarray(Image.fromarray(cut).resize((w, h), Image.BILINEAR))
                m2 = np.asarray(Image.fromarray((cm * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)) >= 128
                y0, x0 = rng.randint(0, SIDE - h), rng.randint(0, SIDE - w)
                im = bg.copy()
                im[y0:y0 + h, x0:x0 + w][m2] = c2[m2]
                L = np.zeros((SIDE, SIDE), bool)
                L[y0:y0 + h, x0:x0 + w] = m2
                out.append((sh, im, L))
    return out


def evaluate(net, V, dev):
    """The validation scores: subjects (overlap, outline), small subjects (found, overlap), empty crops (false
    subjects after the stray-parts rule), pasted subjects (found by size); score = overlap + outline + found − 2 × false."""
    net.eval()
    r = {}
    io, bf = [], []
    for s in range(0, len(V['subj']), 32):
        b = V['subj'][s:s + 32]
        for (img, g), y in zip(b, maps(net, [x[0] for x in b], dev)):
            p = clean(y)
            io.append(iou(p, g))
            bf.append(boundary_f(p, g))
    r['iou'], r['bf'] = float(np.mean(io)), float(np.mean(bf))
    fnd, sio = [], []
    for s in range(0, len(V['small']), 32):
        b = V['small'][s:s + 32]
        for (img, g), y in zip(b, maps(net, [x[0] for x in b], dev)):
            v = iou(clean(y), g)
            sio.append(v)
            fnd.append(v >= 0.5)
    r['found'] = float(np.mean(fnd)) if fnd else float('nan')
    r['small_iou'] = float(np.mean(sio)) if sio else float('nan')
    fl = []
    for s in range(0, len(V['crops']), 32):
        b = V['crops'][s:s + 32]
        for y in maps(net, b, dev):
            fl.append(clean(y).mean() >= 0.01)
    r['false'] = float(np.mean(fl)) if fl else float('nan')
    pf = {}
    for s in range(0, len(V['paste']), 32):
        b = V['paste'][s:s + 32]
        for (sh, img, g), y in zip(b, maps(net, [x[1] for x in b], dev)):
            pf.setdefault(sh, []).append(iou(clean(y), down(g)) >= 0.5)
    r['paste'] = {str(k): round(float(np.mean(v)), 3) for k, v in sorted(pf.items())}
    # (round 4) stock's failures: held-out subjects stock got wrong, and small missed photos (reported, not in the score)
    if V.get('hard'):
        hi, hb = [], []
        for s in range(0, len(V['hard']), 32):
            b = V['hard'][s:s + 32]
            for (img, g), y in zip(b, maps(net, [x[0] for x in b], dev)):
                p = clean(y)
                hi.append(iou(p, g))
                hb.append(boundary_f(p, g))
        r['hard_iou'], r['hard_bf'] = float(np.mean(hi)), float(np.mean(hb))
    if V.get('hard_small'):
        hf = []
        for s in range(0, len(V['hard_small']), 32):
            b = V['hard_small'][s:s + 32]
            for (img, g), y in zip(b, maps(net, [x[0] for x in b], dev)):
                hf.append(iou(clean(y), g) >= 0.5)
        r['hard_found'] = float(np.mean(hf))
    for key in ('seen_subj', 'seen_people', 'people6'):          # (round 5: stock-free, reported, never in the score)
        if V.get(key):
            a, b = [], []
            for s in range(0, len(V[key]), 32):
                bb = V[key][s:s + 32]
                for (img, g), y in zip(bb, maps(net, [x[0] for x in bb], dev)):
                    p = clean(y)
                    a.append(iou(p, g))
                    b.append(boundary_f(p, g))
            r[key + '_iou'], r[key + '_bf'] = float(np.mean(a)), float(np.mean(b))
    r['score'] = r['iou'] + r['bf'] + (0 if fnd == [] else r['found']) - 2 * (0 if fl == [] else r['false'])
    return r


def n_passes(n):
    """(round 3) Passes set by the list's size, so that the run sees config passes.factor × round 2's photo-passes
    (12 × 20,000), between passes.min and passes.max; without passes in config, train.epochs."""
    P = T.get('passes')
    if not P:
        return T['epochs']
    return int(min(P['max'], max(P['min'], round(P['ref_passes'] * P['ref_photos'] * P['factor'] / max(1, n)))))


def hard_line(r):
    return ((' | stock\'s failures: overlap %.4f, outline %.4f, small found %.3f' % (r['hard_iou'], r['hard_bf'], r['hard_found'])
             if 'hard_found' in r else '') +
            (' | stock-free (seen): subjects overlap %.4f, outline %.4f; people overlap %.4f, outline %.4f' % (
                r['seen_subj_iou'], r['seen_subj_bf'], r['seen_people_iou'], r['seen_people_bf']) if 'seen_subj_iou' in r else '') +
            (' | round 6\'s fresh people: overlap %.4f, outline %.4f' % (r['people6_iou'], r['people6_bf']) if 'people6_iou' in r else ''))


def baseline5(V, dev, bench=None, tag='baseline5-'):
    """(round 5) Stock TE0 and A3 on the same validation and stock-free photos, once (reported); for the bigger models
    (5c-train-bigger, decision 106: nothing earlier than C1 needed), C1 alone; round 6: C1 on round 6's lines too."""
    for name, w in (bench or (('stock TE0', None), ('A3', R3DIR / 'A3-best.pt'))):
        p = WORK / 'runs' / (tag + name.replace(' ', '-') + '.json')
        if p.exists():
            r = json.load(open(p))
        else:
            r = evaluate(load_tracer(w).to(dev), V, dev)
            jsave(r, p, indent=1)
        log('%s on the same photos: overlap %.4f, outline %.4f, small found %.3f (overlap %.3f), false on crops %.3f, pasted '
            'found %s%s' % (name, r['iou'], r['bf'], r['found'], r['small_iou'], r['false'], r['paste'], hard_line(r)))


STEPS = (16, 12, 8, 6, 4, 2)          # (4 and 2: TE6 at 576 on an 8 GB card, decision 106)


def is_oom(e):
    """A graphics-card memory failure, however PyTorch words it (cuDNN and cuBLAS report it as their own errors)."""
    m = str(e)
    return isinstance(e, torch.cuda.OutOfMemoryError) or 'out of memory' in m or 'CUDNN_STATUS' in m or 'CUBLAS_STATUS' in m


def fit_batch(net, n, dev, want, params):
    """(round 5) The largest batch (want, then 12, 8, 6) whose forward and backward pass at input n fits in what the card
    has free (Windows and the desktop hold some of it), with Adam's state added and a fifth kept spare. On the
    processor: want."""
    if dev.type != 'cuda':
        return want
    adam = 2 * 4 * sum(p.numel() for p in params)          # (Adam's two float32 moments, made at the first step)
    for b in [want] + [x for x in STEPS if x < want]:
        x = y = o = e = ds = loss = None
        try:
            torch.cuda.empty_cache()
            free0, total = torch.cuda.mem_get_info()
            r0 = torch.cuda.memory_reserved()
            torch.cuda.reset_peak_memory_stats()
            x = torch.randn(b, 3, n, n, device=dev)
            y = (torch.rand(b, 1, n, n, device=dev) > 0.5).float()
            with torch.autocast(device_type='cuda'):
                o, e, ds = net(x)
            loss = api_loss(o, y) + api_loss(ds[0], y) + api_loss(ds[1], y) + api_loss(ds[2], y)
            loss.backward()
            peak = torch.cuda.max_memory_reserved() - r0 + adam
            ok = peak < 0.8 * (free0 + r0)
        except RuntimeError as err:
            if not is_oom(err):
                raise
            ok, peak, free0, r0 = False, float('nan'), float('nan'), 0
        for p in params:
            p.grad = None
        del x, y, o, e, ds, loss
        torch.cuda.empty_cache()
        log('   memory test, batch %d at %d px: %s' % (b, n, 'fits (needs %.1f GB of %.1f GB free)' % (peak / 1e9, (free0 + r0) / 1e9)
                                                       if ok else 'too big for this card'))
        if ok:
            return b
    fail('even batch %d does not fit this graphics card at %d px. Send Claude this window\'s last lines.' % (STEPS[-1], n))


def oom_stop(name, out, bs, n, arch):
    """(round 5) The card ran out of memory mid-run: this run starts again at the next smaller batch (its partial passes
    are set aside: a changed batch changes every step after), and step 5 stops with what to do."""
    nxt = [x for x in STEPS if x < bs]
    if not nxt:
        fail('%s ran out of graphics-card memory even at batch %d. Send Claude this window\'s last lines.' % (name, bs))
    for p in list(out.glob('ema-*.pt')) + [out / 'last.pt', out / 'best.pt']:
        try:
            p.unlink()
        except FileNotFoundError:
            pass
    jsave({'batch': nxt[0], 'planned': T['batch'], 'arch': arch, 'input': n, 'oom': True}, out / 'batch.json')
    fail('%s ran out of graphics-card memory at batch %d. Nothing is wrong with your PC: run 5-train again; this run starts '
         'again at batch %d (a finished run is kept).' % (name, bs, nxt[0]))


def baseline4(V, dev):
    """(round 4) Stock and the benchmark on every validation set, once (reported); stock's pasted line is what the
    pasted-subjects warning compares with."""
    out = {}
    for name, w in (('stock', None), (benchmark(), benchmark_weights())):
        p = WORK / 'runs' / ('baseline-' + name + '.json')
        if p.exists():
            r = json.load(open(p))
        else:
            r = evaluate(load_tracer(w).to(dev), V, dev)
            jsave(r, p, indent=1)
        out[name] = r
        log('%s on the validation photos: overlap %.4f, outline %.4f, small found %.3f (overlap %.3f), false on crops %.3f, '
            'pasted found %s%s' % (name, r['iou'], r['bf'], r['found'], r['small_iou'], r['false'], r['paste'], hard_line(r)))
    return out['stock']['paste']


def baseline(V, dev):
    """(round 3) Round 2's model on the same validation photos and pasted subjects, for comparison (reported)."""
    b = T.get('baseline')
    p = R2 / 'A2plus-best.pt'
    if not b or not p.exists():
        return
    out = WORK / 'runs' / ('baseline-' + b + '.json')
    if out.exists():
        return
    r = evaluate(load_tracer(p).to(dev), V, dev)
    jsave(r, out, indent=1)
    log('%s (round 2) on the same validation photos: overlap %.4f, outline %.4f, small found %.3f (overlap %.3f), false on crops '
        '%.3f, pasted found %s' % (b, r['iou'], r['bf'], r['found'], r['small_iou'], r['false'], r['paste']))


class BlowUp(Exception):
    pass


def _put(tmp, p):
    """The finished .tmp put in the file's place. Windows refuses while another program has either file open for a
    moment (the virus scanner looking at a file just written, a search index, an Explorer preview): tried again for up
    to a minute before giving up."""
    for i in range(30):
        try:
            os.replace(tmp, p)
            return
        except PermissionError:
            if i == 29:
                raise
            time.sleep(2)


def tsave(obj, p):
    """(round 6) torch.save written beside the file, then put in its place: a power cut or a restart mid-save leaves the
    old file whole (and a .tmp to be overwritten), never one that won't load."""
    tmp = p.with_name(p.name + '.tmp')
    torch.save(obj, tmp)
    _put(tmp, p)


def jsave(obj, p, **kw):
    """(round 6) The same for a small JSON file (batch.json, restarts.json, history.json, the soup's decision)."""
    tmp = p.with_name(p.name + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, **kw)
    _put(tmp, p)


def to_cpu(o):
    """A copy of a state (tensors on the processor), for a pass to start again from."""
    if torch.is_tensor(o):
        return o.detach().to('cpu', copy=True)
    if isinstance(o, dict):
        return {k: to_cpu(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return type(o)(to_cpu(v) for v in o)
    return o


def start_weights(rc):
    """stock, round 3's winner (round 4), or another run's kept weights ("run:C1", round 6's C1+)."""
    st = str(rc.get('start', 'stock'))
    if st == 'benchmark':
        return benchmark_weights()
    if st.startswith('run:'):
        w = WORK / 'runs' / st[4:] / 'best.pt'
        if not w.exists():
            fail('%s starts from %s, which is not here (%s). Send Claude this message.' % (rc.get('name', '?'), st[4:], w))
        return w
    return None


def run(name, rc, train_ids, crops, V, dev, stock_paste=None, people=(), paste=None, n_paste=0):
    out = WORK / 'runs' / name
    out.mkdir(parents=True, exist_ok=True)
    if done('s5-' + name):
        log(name, 'already trained: skipped')
        return
    warm = rc.get('start') == 'benchmark'
    arch = str(rc.get('arch', '0'))
    sw = start_weights(dict(rc, name=name))
    net = load_tracer(sw, None if sw else arch).to(dev)
    if str(getattr(net, 'arch', arch)) != arch:
        fail('%s: its start is TRACER-TE%s, not TE%s. Send Claude this message.' % (name, net.arch, arch))
    seed = rc.get('seed')
    if R6:          # (round 6: each run's own seed, decided before the run)
        seed = int(seed or 1)
        torch.manual_seed(seed)
        random.seed(seed)
        np.random.seed(seed)
    # (round 6) soft targets: the 116 fallback (people photos taught by the run's own starting model's maps) or, for a
    # run that names one, another model's maps (E4-kd, decision 126); none otherwise
    kd = rc.get('kd') or ({'teacher': 'start', 'items': 'people', 'w': 1.0} if (R6 and people and R6T.get('people_soft')) else None)
    teacher = None
    if kd:
        tw = sw if kd['teacher'] == 'start' else start_weights({'start': kd['teacher'], 'name': name})
        teacher = load_tracer(tw, None if tw else arch).to(dev).eval()
        for p_ in teacher.parameters():
            p_.requires_grad_(False)
        log('%s: soft targets from %s on %s photos (weight %.2f)' % (name, 'its own starting weights' if kd['teacher'] == 'start'
                                                                    else kd['teacher'], kd['items'], kd['w']))
    NIN = net.inp
    nb = len(net.model._blocks)
    if any(k >= nb for k in rc.get('late_blocks', [])):
        fail('%s: late blocks %s go past TRACER-TE%s\'s %d blocks. Send Claude this message.' % (name, rc['late_blocks'], arch, nb))
    late = tuple('model._blocks.%d.' % k for k in rc.get('late_blocks', []))
    dec, bb = [], []
    for n, p in net.named_parameters():
        if not n.startswith('model.'):
            dec.append(p)
        elif rc['train'] == 'decoder+late' and n.startswith(late):
            bb.append(p)
        else:
            p.requires_grad_(False)
    groups = [{'params': dec, 'lr': rc['lr']}] + ([{'params': bb, 'lr': rc['lr_backbone']}] if bb else [])
    opt = torch.optim.Adam(groups, weight_decay=0)
    scaler = torch.amp.GradScaler('cuda', enabled=dev.type == 'cuda')
    ema = AveragedModel(net, multi_avg_fn=get_ema_multi_avg_fn(T['ema']))
    BS = T['batch']
    if R5:
        net.train()
        for m in net.modules():
            if isinstance(m, torch.nn.BatchNorm2d):
                m.eval()
        bj = out / 'batch.json'
        bjd = json.load(open(bj)) if bj.exists() else {}
        # (a run carried on keeps its batch; after a memory failure, the smaller batch written then, without a new test)
        BS = bjd['batch'] if bjd and ((out / 'last.pt').exists() or bjd.get('oom')) else fit_batch(net, NIN, dev, T['batch'], dec + bb)
        if BS != T['batch']:
            log('%s: batch %d instead of %d (the card\'s memory): %d steps a pass instead of %d, a somewhat stronger fine-tune '
                'than planned (reported in step 6).' % (name, BS, T['batch'], (len(train_ids) + len(crops)) // BS,
                                                         (len(train_ids) + len(crops)) // T['batch']))
        jsave({'batch': BS, 'planned': T['batch'], 'arch': arch, 'input': NIN, 'oom': bjd.get('oom', False)}, out / 'batch.json')
    ds_ = Photos(train_ids, crops, crops, NIN, people, paste, n_paste)
    dl = torch.utils.data.DataLoader(ds_, batch_size=BS, shuffle=True, drop_last=True,
                                     num_workers=T['workers'], persistent_workers=T['workers'] > 0, pin_memory=dev.type == 'cuda',
                                     **({'generator': torch.Generator().manual_seed(seed), 'worker_init_fn': seed_worker} if R6 else {}))
    EP = rc.get('passes') or n_passes(len(train_ids))
    if T.get('quick'):
        EP = min(EP, 2)
    last = out / 'last.pt'
    if last.exists():          # (a run carried on keeps the number of passes it started with)
        EP = torch.load(last, map_location='cpu', weights_only=True).get('epochs', EP)
    total = EP * len(dl)
    WU = rc.get('warmup', 0)
    lam = lambda st: (min(1.0, (st + 1) / WU) if WU else 1.0) * (
        T['lr_end'] + (1 - T['lr_end']) * 0.5 * (1 + math.cos(math.pi * min(st, total) / total)))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lam)
    start, best, hist, step = 0, -1e9, [], 0
    if last.exists():
        ck = torch.load(last, map_location='cpu', weights_only=True)
        net.load_state_dict(ck['model'])
        opt.load_state_dict(ck['opt'])
        sched.load_state_dict(ck['sched'])
        ema.load_state_dict(ck['ema'])
        start, best, hist, step = ck['epoch'] + 1, ck['best'], ck['hist'], ck['step']
        log(name, 'carrying on from pass', start + 1)
    if start == 0:
        r0 = evaluate(net, V, dev)
        hist.append({'epoch': 0, **r0})
        log('%s: %s on the validation photos: overlap %.4f, outline %.4f, small found %.3f, false on crops %.3f, pasted found %s%s' % (
            name, '%s (warm start)' % benchmark() if warm else ('%s (its start)' % rc['start'][4:] if sw else 'stock TRACER-TE%s' % arch),
            r0['iou'], r0['bf'], r0['found'], r0['false'],
            r0['paste'], hard_line(r0)))
    stock_paste = stock_paste or hist[0]['paste']
    log('%s: %d passes over %d photos and %d empty crops; kept: %s' % (
        name, EP, len(train_ids), len(crops), 'the last %d passes\' averaged weights, averaged' % T['avg_last'] if T.get('avg_last') else 'the best pass'))
    def loss_of(x, y, hf):
        with torch.autocast(device_type=dev.type, enabled=dev.type == 'cuda'):
            o, e, ds = net(x)
        if teacher is None:
            return api_loss(o, y) + api_loss(ds[0], y) + api_loss(ds[1], y) + api_loss(ds[2], y)
        sel = hf if kd['items'] == 'people' else torch.ones_like(hf)
        if not bool(sel.any()):
            return api_loss(o, y) + api_loss(ds[0], y) + api_loss(ds[1], y) + api_loss(ds[2], y)
        with torch.no_grad(), torch.autocast(device_type=dev.type, enabled=dev.type == 'cuda'):
            xt = x[sel] if teacher.inp == NIN else F.interpolate(x[sel], size=(teacher.inp, teacher.inp), mode='bilinear', align_corners=False)
            t = teacher(xt)[0].float()
        if t.shape[-1] != NIN:
            t = F.interpolate(t, size=(NIN, NIN), mode='bilinear', align_corners=False)
        tt = y.clone()
        tt[sel] = t.clamp(0, 1)
        wv = sel.float() * float(kd['w'])
        return sum(((1 - wv) * api_loss_each(z, y) + wv * api_loss_each(z, tt)).mean() for z in (o, ds[0], ds[1], ds[2]))

    def pass_once(ep, stop_at, attempt=1):
        """One pass over the photos; a loss blow-up raises BlowUp (round 6) or stops (earlier rounds)."""
        nonlocal step
        net.train()
        for m in net.modules():        # (frozen parts, and every batch-norm layer, keep TRACER's statistics)
            if isinstance(m, torch.nn.BatchNorm2d):
                m.eval()
        tot, n, hot = 0.0, 0, 0
        for bt in dl:
            x, y = bt[0].to(dev, non_blocking=True), bt[1].to(dev, non_blocking=True)
            hf = bt[2].to(dev) if len(bt) > 2 else None
            opt.zero_grad(set_to_none=True)
            try:
                loss = loss_of(x, y, hf)
            except RuntimeError as err:
                if not (R5 and is_oom(err)):
                    raise
                oom_stop(name, out, BS, NIN, arch)
            lv = float(loss.detach())
            if n == 1 and os.environ.get('MS_KIT_TEST_BLOWUP') in ('%s:%d:%d' % (name, ep + 1, attempt), '%s:%d:*' % (name, ep + 1)):
                lv = float('inf')          # (the kit's own test: a blow-up on demand)
            hot = hot + 1 if lv > stop_at else 0
            if lv > GD['loss_hard'] or hot >= GD['loss_stop_n'] or not math.isfinite(lv):
                if R6:
                    raise BlowUp('%.1f at pass %d, batch %d' % (lv, ep + 1, n + 1))
                fail('%s: the training loss blew up (%.1f at pass %d, batch %d). Nothing is wrong with your PC: send Claude this '
                     'window\'s last lines and work\\s5_train.log.' % (name, lv, ep + 1, n + 1))
            try:
                scaler.scale(loss).backward()
            except RuntimeError as err:
                if not (R5 and is_oom(err)):
                    raise
                oom_stop(name, out, BS, NIN, arch)
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_([p for g in groups for p in g['params']], 2.0)
            scaler.step(opt)
            scaler.update()
            sched.step()
            ema.update_parameters(net)
            step += 1
            tot += lv
            n += 1
            if n % 200 == 0:
                log('%s pass %d: %d of %d batches, loss %.4f' % (name, ep + 1, n, len(dl), tot / n))
        return tot, n

    for ep in range(start, EP):
        t0 = time.time()
        # (round 6: a blow-up starts the pass again once from its own start, with a new shuffle; a second one stops. The
        # line it stops at is 3x the run's own pass-1 mean loss once there is one, never below the fixed one: v4, after
        # D6's false alarm at 50.9 in round 5 (pass-1 mean 19.9), a bigger model's line rises with its own loss;
        # loss_hard and a loss that isn't a number still stop a real blow-up at once)
        p1 = [h['loss'] for h in hist if h.get('epoch') == 1 and 'loss' in h]
        stop_at = max(GD['loss_stop'], R6T.get('restart_factor', 3) * p1[0]) if (R6 and p1) else GD['loss_stop']
        snap = to_cpu({'net': net.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'ema': ema.state_dict(),
                       'scaler': scaler.state_dict(), 'step': step}) if R6 else None
        for attempt in (1, 2):
            try:
                tot, n = pass_once(ep, stop_at, attempt)
                break
            except BlowUp as bu:
                if attempt == 2:
                    fail('%s: the training loss blew up twice in pass %d (%s). Nothing is wrong with your PC: send Claude this '
                         'window\'s last lines and work\\s5_train.log.' % (name, ep + 1, bu))
                log('%s: the loss blew up (%s): pass %d starts again from its own start, with a new shuffle (once).' % (name, bu, ep + 1))
                net.load_state_dict(snap['net'])
                opt.load_state_dict(snap['opt'])
                sched.load_state_dict(snap['sched'])
                ema.load_state_dict(snap['ema'])
                scaler.load_state_dict(snap['scaler'])
                step = snap['step']
                rj = out / 'restarts.json'
                jsave((json.load(open(rj)) if rj.exists() else []) + [{'pass': ep + 1, 'why': str(bu)}], rj)
        r = evaluate(ema.module, V, dev)
        hist.append({'epoch': ep + 1, 'loss': tot / max(1, n), **r})
        log('%s pass %d of %d: loss %.4f | averaged weights: overlap %.4f, outline %.4f, small found %.3f (overlap %.3f), '
            'false on crops %.3f, pasted found %s%s (%.1f min)' % (name, ep + 1, EP, tot / max(1, n), r['iou'], r['bf'],
                                                                   r['found'], r['small_iou'], r['false'], r['paste'], hard_line(r),
                                                                   (time.time() - t0) / 60))
        for k in ('0.01', '0.02'):
            if k in r['paste'] and k in stock_paste and r['paste'][k] < stock_paste[k] - GD['paste_warn']:
                log('WARNING: %s finds fewer pasted %s%% subjects than stock (%.2f vs %.2f): it may be losing small subjects.' % (
                    name, float(k) * 100, r['paste'][k], stock_paste[k]))
        K = min(T.get('avg_last', 0), EP)
        if (K and ep + 1 > EP - K) or T.get('save_every_pass'):
            tsave({'model': ema.module.state_dict(), 'epoch': ep + 1, 'arch': arch}, out / ('ema-%02d.pt' % (ep + 1)))
        if not K and r['score'] > best:
            best = r['score']
            tsave({'model': ema.module.state_dict(), 'epoch': ep + 1, 'arch': arch, **{k: v for k, v in r.items() if k != 'paste'}}, out / 'best.pt')
            log(name, 'best so far: kept')
        tsave({'model': net.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'ema': ema.state_dict(),
                    'epoch': ep, 'best': best, 'hist': hist, 'step': step, 'epochs': EP, 'arch': arch}, last)
    K = min(T.get('avg_last', 0), EP)
    if K:          # (the last K passes' averaged weights, averaged again: decided before the run, not picked by the score)
        snaps = [torch.load(out / ('ema-%02d.pt' % e), map_location='cpu', weights_only=True)['model'] for e in range(EP - K + 1, EP + 1)]
        avg = {}
        for k, v in snaps[-1].items():
            avg[k] = torch.stack([sd[k].float() for sd in snaps]).mean(0).to(v.dtype) if v.is_floating_point() else v
        net.load_state_dict(avg)
        r = evaluate(net, V, dev)
        hist.append({'epoch': 'avg', **r})
        log('%s, the last %d passes averaged: overlap %.4f, outline %.4f, small found %.3f (overlap %.3f), false on crops %.3f, '
            'pasted found %s%s' % (name, K, r['iou'], r['bf'], r['found'], r['small_iou'], r['false'], r['paste'], hard_line(r)))
        tsave({'model': avg, 'epoch': 'avg-%d' % K, 'arch': arch, **{k: v for k, v in r.items() if k != 'paste'}}, out / 'best.pt')
        log(name, 'kept: the averaged weights')
    jsave(hist, out / 'history.json', indent=1)
    mark_done('s5-' + name)


def main5(dev):
    """Round 5: round 3's exact lists from work\\round3; C1 then C2 (config train.runs without on_demand); with --wide, only
    the wide run step 6 named (results\\next-train.txt)."""
    if not (R3DIR / 'done').exists() or not (R3DIR / 'lists' / 'train.txt').exists():
        fail('round 3\'s lists are not in work\\round3 (round 4\'s step 4 keeps them there). Nothing has been changed. Send '
             'Claude this message.')
    # (5c-train-bigger: --run D5,D6 trains those named runs only, after C1, measured beside C1 alone)
    named = [x for x in (sys.argv[sys.argv.index('--run') + 1].split(',') if '--run' in sys.argv else []) if x]
    for x in named:
        if x not in T['runs'] or not T['runs'][x].get('on_demand'):
            fail('%s is not a run this kit trains on request. Send Claude this message.' % x)
    if named and not (WORK / 'runs' / 'C1' / 'best.pt').exists():
        fail('C1 (work\\runs\\C1\\best.pt) is not here: the bigger models are measured beside it. Send Claude this message.')
    want_archs = {str(T['runs'][x].get('arch', '0')) for x in named} if named else {
        str(rc.get('arch', '0')) for rc in T['runs'].values() if not rc.get('on_demand')}
    for a in sorted(want_archs):
        w = WORK / ('TRACER-Efficient-%s.pth' % a)
        if named and not w.exists():
            # (5c-train-bigger fetches the bigger models' release weights itself, as 1e-bigger does: fingerprint checked)
            log('Downloading TRACER-TE%s weights (%d MB) from the authors\' GitHub release' % (a, CFG['tracer%s_bytes' % a] // 1000000))
            download(CFG['urls']['tracer' + a], w)
            if sha256(w) != CFG['tracer%s_sha256' % a]:
                w.unlink()
                fail('the TRACER-TE%s weights did not match their known fingerprint (deleted). Run this again.' % a)
        if not w.exists():
            fail('TRACER-TE%s\'s weights are not in work: run 1-check first.' % a)
    train_ids = read_r3_list('train')
    crops = read_crops('train')
    if '--quick' in sys.argv:          # (the kit's own test)
        T['quick'] = True
    if named:
        runs = {x: T['runs'][x] for x in named}
    elif '--wide' in sys.argv:
        nt = RESULTS / 'next-train.txt'
        want = nt.read_text(encoding='utf-8').strip() if nt.exists() else ''
        if want not in T['runs'] or not T['runs'][want].get('on_demand'):
            log('Step 6 has not named a wide run to train (results\\next-train.txt: %s): nothing to do.' % (want or 'none'))
            return
        runs = {want: T['runs'][want]}
    else:
        runs = {k: v for k, v in T['runs'].items() if not v.get('on_demand')}
    sees = read_r2_list('test_subjects')[:400], read_r2_list('test_people')[:400]
    V = {'subj': [(load_prep(i)[0], down(load_label(i))) for i in read_r3_list('val')],
         'small': [(load_prep(i)[0], down(load_label(i))) for i in read_r3_list('val_small')],
         'crops': [crop_img(load_prep(c[0])[0], *c[1:]) for c in read_crops('val')],
         'paste': pastes(train_ids, crops, T.get('paste_sources', 8)),
         'seen_subj': [(load_prep(i)[0], down(load_label(i))) for i in sees[0]],
         'seen_people': [(load_prep(i)[0], down(load_label(i))) for i in sees[1]]}
    log('Round 5: training on round 3\'s %d photos and %d empty crops; checking on %d subjects, %d small subjects, %d crops, '
        '%d pasted subjects (round 3\'s validation: its subjects were chosen where stock TE0 already agreed, so they favour '
        'TE0-based models and are no verdict), and, stock-free, %d of round 2\'s seen subjects and %d seen people; on %s' % (
            len(train_ids), len(crops), len(V['subj']), len(V['small']), len(V['crops']), len(V['paste']), len(V['seen_subj']),
            len(V['seen_people']), dev))
    torch.manual_seed(42)
    random.seed(42)
    baseline5(V, dev, (('C1', WORK / 'runs' / 'C1' / 'best.pt'),) if named else None)
    for name, rc in runs.items():
        run(name, rc, train_ids, crops, V, dev)
    if named:
        (RESULTS / 'logs').mkdir(parents=True, exist_ok=True)
        for x in named:
            h = WORK / 'runs' / x / 'history.json'
            if h.exists():
                shutil.copy2(h, RESULTS / 'logs' / ('history-%s.json' % x))
        log('%s trained (work\\runs). Copy the results folder to the Mac and tell Claude (results\\logs has each pass).' % (
            ', '.join(named)))
        return
    if '--wide' not in sys.argv:
        mark_done('s5')
    log('Step 5 done. Next: 6-results.')


def soup(V, dev):
    """(round 6, decision 126) E4 and E4b (a second seed) averaged into one: kept as E4 if the average is at least as good
    as each on round 3's validation overlap and outline; else E4 alone (pre-registered). Written to work\\runs\\E4soup."""
    out = WORK / 'runs' / 'E4soup'
    if (out / 'decision.json').exists():
        return json.load(open(out / 'decision.json'))
    out.mkdir(parents=True, exist_ok=True)
    a, b = WORK / 'runs' / 'E4' / 'best.pt', WORK / 'runs' / 'E4b' / 'best.pt'
    if not (a.exists() and b.exists()):
        d = {'used': 'E4', 'why': 'E4b was not trained'}
        shutil.copy2(a, out / 'best.pt')
    else:
        A, B = (torch.load(p, map_location='cpu', weights_only=True) for p in (a, b))
        avg = {k: ((v.float() + B['model'][k].float()) / 2).to(v.dtype) if v.is_floating_point() else v for k, v in A['model'].items()}
        r = {}
        for nm, sd in (('E4', A['model']), ('E4b', B['model']), ('soup', avg)):
            net = load_tracer(None, '4')
            net.load_state_dict(sd)
            r[nm] = evaluate(net.to(dev), V, dev)
        ok = all(r['soup'][k] >= r[m][k] for m in ('E4', 'E4b') for k in ('iou', 'bf'))
        d = {'used': 'soup' if ok else 'E4', 'scores': {m: {k: r[m][k] for k in ('iou', 'bf', 'found', 'false')} for m in r}}
        tsave({'model': avg if ok else A['model'], 'epoch': 'soup' if ok else A.get('epoch'), 'arch': '4'}, out / 'best.pt')
        log('E4 soup (E4 and E4b averaged): overlap %.4f, outline %.4f against E4 %.4f/%.4f and E4b %.4f/%.4f: %s' % (
            r['soup']['iou'], r['soup']['bf'], r['E4']['iou'], r['E4']['bf'], r['E4b']['iou'], r['E4b']['bf'],
            'the average is kept as E4' if ok else 'not better than both: E4 is seed 1 alone'))
    jsave(d, out / 'decision.json', indent=1)
    return d


def main6(dev):
    """Round 6 (decisions 114-136): E4, E6, E4b, C1+ in that order, on round 3's photos plus round 6's people set, pasted
    small subjects and round 3's small_agree photos once more; each pass measured beside C1."""
    r6 = WORK / 'round6'
    if '--run' not in sys.argv and (WORK / '.done-s5').exists():
        (WORK / '.done-s5').unlink()          # (round 5's mark: 6-results waits for this round's runs)
    miss = [str(p) for p in (r6 / 'done', r6 / 'lists' / 'people_train.txt', r6 / 'lists' / 'small_agree.txt',
                             r6 / 'lists' / 'people_p3.txt', R3DIR / 'done', WORK / 'runs' / 'C1' / 'best.pt') if not p.exists()]
    if miss:
        fail('missing: %s (4c-prep-round6 makes work\\round6). Nothing has been changed. Send Claude this message.' % ', '.join(miss))
    rd6 = lambda n: [l.strip() for l in open(r6 / 'lists' / (n + '.txt'), encoding='utf-8') if l.strip()]
    named = [x for x in (sys.argv[sys.argv.index('--run') + 1].split(',') if '--run' in sys.argv else []) if x]
    order = R6T['order']
    for x in named:
        if x not in T['runs'] or not (T['runs'][x].get('on_demand') or x in order):
            fail('%s is not a round-6 run. Send Claude this message.' % x)
    runs = named or order
    for a in sorted({str(T['runs'][x].get('arch', '0')) for x in runs}):
        w = WORK / ('TRACER-Efficient-%s.pth' % a)
        if not w.exists():
            log('Downloading TRACER-TE%s weights (%d MB) from the authors\' GitHub release' % (a, CFG['tracer%s_bytes' % a] // 1000000))
            download(CFG['urls']['tracer' + a], w)
        if sha256(w) != CFG['tracer%s_sha256' % a]:
            w.unlink()
            fail('the TRACER-TE%s weights did not match their known fingerprint (deleted). Run this again.' % a)
    if '--quick' in sys.argv:          # (the kit's own test)
        T['quick'] = True
    # (round 6) room on the drive for what the runs still to train write: every pass's averaged weights, the run's
    # carry-on file (about 3 models' worth) and its kept weights, at each model's own size, less what a run carried on
    # already has on the drive; and 1 GB spare
    left_ = [x for x in runs if not done('s5-' + x)]

    def still(x):
        full = CFG['tracer%s_bytes' % str(T['runs'][x].get('arch', '0'))] * (int(T['runs'][x].get('passes') or 9) + 4)
        d = WORK / 'runs' / x
        have = sum(f.stat().st_size for f in d.glob('*.pt')) if d.exists() else 0
        return max(0, full - have)
    need = sum(still(x) for x in left_) + (CFG['tracer4_bytes'] if 'E4b' in left_ else 0) + 1e9
    free = shutil.disk_usage(WORK).free
    if left_ and free < need:
        fail('training %s needs about %.1f GB free on this drive, and it has %.1f GB: free about %.1f GB more. Nothing has '
             'been started. Make room (the mask zip files in work\\masks can be deleted, and the Recycle Bin emptied) and '
             'run 5-train again.' % (', '.join(left_), need / 1e9, free / 1e9, (need - free) / 1e9 + 0.05))
    log('Room on the drive: %.1f GB free, about %.1f GB needed for %s' % (free / 1e9, need / 1e9, ', '.join(left_) or 'nothing'))
    train_ids, crops = read_r3_list('train'), read_crops('train')
    sa, people = rd6('small_agree'), rd6('people_train')
    items = train_ids + sa * (R6T.get('small_agree_times', 2) - 1)
    # pasted small subjects (decision 117): sources and backgrounds never those of the pasted-subjects check
    check_src = set(itertools.islice((i for i in train_ids if 0.08 <= load_label(i).mean() <= 0.4), T.get('paste_sources', 8)))
    sort3 = {}
    with open(R3DIR / 'sort.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            sort3[r['id']] = r
    src = [i for i in train_ids if i not in check_src and i in sort3 and 0.08 <= float(sort3[i].get('lshare') or 0) <= 0.4]
    bgs = crops[4:]
    n_paste = int(round(R6T.get('paste_share', 0.05) * (len(train_ids) + len(crops))))
    if n_paste and (not src or not bgs):
        fail('no photos to paste subjects from (%d sources, %d backgrounds). Nothing has been changed. Send Claude this message.' % (
            len(src), len(bgs)))
    sees = read_r2_list('test_subjects')[:400], read_r2_list('test_people')[:400]
    p3 = rd6('people_p3')[:400]
    V = {'subj': [(load_prep(i)[0], down(load_label(i))) for i in read_r3_list('val')],
         'small': [(load_prep(i)[0], down(load_label(i))) for i in read_r3_list('val_small')],
         'crops': [crop_img(load_prep(c[0])[0], *c[1:]) for c in read_crops('val')],
         'paste': pastes(train_ids, crops, T.get('paste_sources', 8)),
         'seen_subj': [(load_prep(i)[0], down(load_label(i))) for i in sees[0]],
         'seen_people': [(load_prep(i)[0], down(load_label(i))) for i in sees[1]],
         'people6': [(load_prep(i)[0], down(load_label6(i))) for i in p3]}
    log('Round 6: each pass %d items: round 3\'s %d photos, its %d small_agree photos %d times in all, %d people photos%s, %d pasted '
        'small subjects (from %d sources), %d empty crops; checking on round 3\'s validation (%d subjects, %d small, %d crops), '
        '%d pasted subjects, stock-free %d seen subjects and %d seen people, and %d of round 6\'s fresh people; on %s' % (
            len(items) + len(people) + n_paste + len(crops), len(train_ids), len(sa), R6T.get('small_agree_times', 2), len(people),
            ' (soft targets: decision 116\'s fallback)' if R6T.get('people_soft') else '', n_paste, len(src), len(crops),
            len(V['subj']), len(V['small']), len(V['crops']), len(V['paste']), len(V['seen_subj']), len(V['seen_people']),
            len(V['people6']), dev))
    baseline5(V, dev, (('C1', WORK / 'runs' / 'C1' / 'best.pt'),), tag='baseline6-')
    stopped, full_, soup_bad = [], False, False
    for name in runs:
        try:
            run(name, T['runs'][name], items, crops, V, dev, people=people, paste=(src, bgs), n_paste=n_paste)
        except SystemExit:          # (one run stopping never ends the night: the next run starts; this one is redone next time)
            stopped.append(name)
            log('%s STOPPED (the message above says why). Carrying on with the next run; running 5-train again later redoes '
                '%s from where it stopped.' % (name, name))
        except Exception:          # (and any other error in one run: written to the log in full, the next run starts)
            stopped.append(name)
            for ln in traceback.format_exc().rstrip().splitlines():
                log('   ' + ln)
            log('%s STOPPED by an error (above). Carrying on with the next run; running 5-train again later redoes %s from '
                'where it stopped. Send Claude work\\s5_train.log in the morning.' % (name, name))
        # (a save half-written when the run stopped: let go, it is never read)
        for t_ in (WORK / 'runs' / name).glob('*.tmp'):
            try:
                t_.unlink()
            except OSError:
                pass
        gc.collect()          # (the stopped run's model and its loading processes let go before the next one's memory test)
        try:
            if dev.type == 'cuda':
                torch.cuda.empty_cache()
        except Exception:          # (a graphics card that has failed: the next run says so itself; the summary still comes)
            pass
        # (v4: a full drive stops the night here: every later run would train a pass and fail at its first save)
        if name in stopped and shutil.disk_usage(WORK).free < 0.5e9:
            full_ = True
            log('The drive is full (%.1f GB free): the night stops here. Make room (the mask zip files in work\\masks can '
                'be deleted, and the Recycle Bin emptied) and run 5-train again: it carries on where it stopped.' % (
                    shutil.disk_usage(WORK).free / 1e9))
            break
    if done('s5-E4') and done('s5-E4b') and not named and not full_:
        try:
            soup(V, dev)
        except Exception:          # (no soup: step 5 isn't done, and 6-results waits for it, v4)
            soup_bad = True
            for ln in traceback.format_exc().rstrip().splitlines():
                log('   ' + ln)
    (RESULTS / 'logs').mkdir(parents=True, exist_ok=True)
    for x in set(order) | set(named):
        for f_ in ('history.json', 'restarts.json'):
            h = WORK / 'runs' / x / f_
            if h.exists():
                shutil.copy2(h, RESULTS / 'logs' / ('%s-%s' % (f_.split('.')[0], x) + '.json'))
    if not named:
        left = [x for x in order if not done('s5-' + x)]
        if not left and soup_bad:
            log('Step 5 NOT finished: every run is trained, but averaging E4 with E4b failed (above). Run 5-train again (about '
                '15 minutes) before 6-results; if it fails again, send Claude work\\s5_train.log.')
        elif not left:
            mark_done('s5')
            log('Step 5 done (round 6: %s). Next: 6-results.' % ', '.join(order))
        elif full_:
            log('Step 5 NOT finished: %s not trained, the drive being full (above).' % ', '.join(left))
        else:
            log('Step 5 NOT finished: %s %s. %s' % (', '.join(left), 'stopped' if stopped else 'not trained', (
                'E4 and E6 are done, so 6-results can run now (it says what is missing); or run 5-train again first to finish '
                'the rest. Tell Claude either way.') if done('s5-E4') and done('s5-E6') else
                'Send Claude this window\'s last lines and work\\s5_train.log.'))


if __name__ == '__main__':
    dev = device()
    if R6:
        main6(dev)
        sys.exit(0)
    if R5:
        main5(dev)
        sys.exit(0)
    if not done('s4'):
        fail('step 4 has not finished (or was run again): run 4-label first.')
    train_ids = read_list('train')
    if not train_ids:
        fail('no training list: run step 4 first.')
    crops = read_crops('train')
    if '--quick' in sys.argv:          # (the kit's own test)
        T['quick'] = True
        T['epochs'] = 2
        if T.get('passes'):
            T['passes'] = dict(T['passes'], min=2, max=2)
    R4 = CFG.get('round', 2) >= 4
    V = {'subj': [(load_prep(i)[0], down(load_label(i))) for i in read_list('val')],
         'small': [(load_prep(i)[0], down(load_label(i))) for i in read_list('val_small')],
         'crops': [crop_img(load_prep(c[0])[0], *c[1:]) for c in read_crops('val')],
         'paste': pastes(train_ids, crops, T.get('paste_sources', 8))}          # (pasted sources: round 3's list alone)
    items = train_ids
    if R4:
        V['hard'] = [(load_prep(i)[0], down(load_label(i))) for i in read_list('val_hard')]
        V['hard_small'] = [(load_prep(i)[0], down(load_label(i))) for i in read_list('val_hard_small')]
        rp = T.get('repeat', {})
        sa, dis = read_list('small_agree'), read_list('disagree')
        if not dis:
            fail('no disagree list: run step 4 (round 4) first.')
        items = train_ids + sa * (rp.get('small_agree', 1) - 1) + dis * rp.get('disagree', 1)
        log('Round 4: each pass %d photos: round 3\'s %d training photos, its %d one-outline 1-5%% photos %d times in all, '
            '%d disagree photos %d times (%.0f%% of the photos), and %d empty crops; checking also on %d of stock\'s '
            'failures and %d small missed photos' % (len(items) + len(crops), len(train_ids), len(sa), rp.get('small_agree', 1),
                                                    len(dis), rp.get('disagree', 1), 100 * len(dis) * rp.get('disagree', 1) / max(1, len(items) + len(crops)),
                                                    len(crops), len(V['hard']), len(V['hard_small'])))
    log('Training on %d photos and %d empty crops (grids from %d crops), checking on %d subjects, %d small subjects, %d crops, '
        '%d pasted subjects, on %s' % (len(items), len(crops), len(crops), len(V['subj']), len(V['small']), len(V['crops']),
                                      len(V['paste']), dev))
    torch.manual_seed(42)
    random.seed(42)
    sp = baseline4(V, dev) if R4 else (baseline(V, dev) or None)
    for name, rc in T['runs'].items():
        run(name, rc, items, crops, V, dev, stock_paste=sp)
    mark_done('s5')
    log('Step 5 done. Next: 6-results.')
