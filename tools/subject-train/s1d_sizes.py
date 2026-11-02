# Round 5's third check (decision 98): stock TRACER-TE2, TE3 and TE4 (the models under Ben's 0.50 s limit on his iPad)
# against stock TE0, to pick round 5's candidates by a rule fixed before the run. It changes nothing in work\ (it adds
# TE3's and TE4's release weights, checked against their known fingerprints, and work\probe5\full, a cache of the
# full-size photos), and writes results\sizes-round5.txt.
#
# Photos (all chosen without stock): round 2's seen subjects (after the check detector) and seen people, and round 3's
# validation small subjects. Each model sees them as step 6 will: the kit's 384-px photos squashed to its own input size
# (TE4: enlarged to 448). Reported beside it: the same photos downloaded again full size and squashed straight to each
# model's size, as the app does.
#
# The rule (decision 98b, fixed before the run):
#   lead = a model's seen-subjects overlap minus stock TE0's (384-px photos).
#   A model is out if its validation small found is below TE0's, or its seen-people overlap is more than 0.010 below.
#   C1 = the biggest eligible model that leads every smaller eligible model by at least +0.005; else the smallest.
#   C2 = the eligible runner-up with the highest lead (a tie goes to the smaller), only if that lead is at least +0.010.
#   Full size (decision 98d): the same rule on the full-size photos; if it picks TE4 as C1 there (TE4 leading every
#   smaller eligible model by at least +0.005), or TE4 is already C1 or C2, decision 98c goes to Ben with the full-size
#   numbers (prepare every photo again at 448, and with the trigger, make TE4 C1); otherwise the result stands.
import csv, io, json, time
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import torch
import data
from common import (CFG, WORK, RESULTS, log, fail, load_tracer, device, download, sha256, R2, R3DIR, read_r2_list, read_r3_list,
                    MEAN, STD)

REF = {'subjects': {'n': 1885, 'iou': 0.8351, 'bf': 0.6721}, 'people': {'n': 400, 'iou': 0.7702, 'bf': 0.6554}}
TOL = 0.0015
ORDER = ['TE2', 'TE3', 'TE4']          # (smallest first; TE5 and TE6 are over the 0.50 s limit, decision 98a)
ARCH = {'TE0': '0', 'TE2': '2', 'TE3': '3', 'TE4': '4'}
MARGIN, C2_MIN, PEOPLE_MIN = 0.005, 0.010, -0.010
NB = 4000
FULL = WORK / 'probe5' / 'full'
FULL_SIDE = 512          # (the full-size cache: each photo squashed once to 512, then to each model's size)


def weights():
    for a in ('3', '4'):
        w = WORK / ('TRACER-Efficient-%s.pth' % a)
        if not w.exists():
            log('Downloading TRACER-TE%s weights (%d MB) from the authors\' GitHub release' % (a, CFG['tracer%s_bytes' % a] // 1000000))
            download(CFG['urls']['tracer' + a], w)
        if sha256(w) != CFG['tracer%s_sha256' % a]:
            w.unlink()
            fail('the TRACER-TE%s weights did not match their known fingerprint (deleted). Run this again.' % a)
    log('TRACER-TE3 and TE4 weights OK (SHA-256 matches)')


def ci(d, seed):
    rng = np.random.default_rng(seed)
    bs = d[rng.integers(0, len(d), (NB, len(d)))].mean(axis=1)
    return float(d.mean()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def full_img(iid):
    return np.asarray(Image.open(FULL / (iid + '.jpg')).convert('RGB'))


def maps_full(net, imgs, dev):
    """Full-size photos (FULL_SIDE) squashed straight to the model's size (bicubic, as the photo's own prep does), the
    map on the 320 grid: the same measure as data.maps."""
    n = net.inp
    x = np.stack([np.asarray(Image.fromarray(im).resize((n, n), Image.BICUBIC)) for im in imgs])
    x = torch.as_tensor(x, device=dev).permute(0, 3, 1, 2).float() / 255
    m = torch.tensor(MEAN, device=dev).view(1, 3, 1, 1)
    s = torch.tensor(STD, device=dev).view(1, 3, 1, 1)
    with torch.no_grad(), torch.autocast(device_type=dev.type, enabled=dev.type == 'cuda'):
        y = net((x - m) / s)[0]
    y = y.float()
    if n != data.INP:
        y = torch.nn.functional.interpolate(y, size=(data.INP, data.INP), mode='bilinear', align_corners=False)
    return y[:, 0].cpu().numpy()


def measure(net, sets, dev, full=False):
    """{set: {'iou', 'bf', 'found'}} per photo; the label is the stored outline on the 320 grid either way."""
    out = {}
    for k, ids in sets.items():
        io_, bf_ = [], []
        for s in range(0, len(ids), 16):
            b = ids[s:s + 16]
            ys = maps_full(net, [full_img(i) for i in b], dev) if full else data.maps(net, [data.load_prep(i)[0] for i in b], dev)
            for iid, y in zip(b, ys):
                L = data.down(data.load_label(iid))
                P = data.strays(y >= 0.5)
                io_.append(data.iou(P, L))
                bf_.append(data.boundary_f(P, L) if k != 'small' else 0.0)
        io_ = np.array(io_)
        out[k] = {'iou': io_, 'bf': np.array(bf_), 'found': (io_ >= 0.5).astype(float)}
    return out


def fetch_full(ids):
    """The photos again, full size, from Open Images (as step 3 fetches them; the pixels as stored, no EXIF turning),
    each squashed once to FULL_SIDE and kept; the full-size file deleted at once. Photos that fail are left out of the
    full-size report (and said so)."""
    FULL.mkdir(parents=True, exist_ok=True)
    split = {}
    with open(WORK / 'candidates.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            split[r['id']] = r['split']
    tmp = WORK / 'probe5' / 'tmp'
    tmp.mkdir(parents=True, exist_ok=True)

    def one(iid):
        out = FULL / (iid + '.jpg')
        if out.exists():
            return True
        for sp in ([split[iid]] if iid in split else ['validation', 'test', 'train']):
            jpg = tmp / (iid + '.jpg')
            try:
                download(CFG['urls']['photo'].format(split=sp, id=iid), jpg, tries=3, quiet=True)
                with Image.open(jpg) as im0:          # (closed at once: Windows keeps an open file locked)
                    im0.load()
                    W, H = im0.size
                    im = im0.convert('RGB')
                with np.load(data.PREP / (iid + '.npz')) as z:
                    sz = z['size']
                if abs(W / H - sz[0] / sz[1]) > 0.02 * (sz[0] / sz[1]):
                    return False          # (not the photo step 3 prepared)
                im.resize((FULL_SIDE, FULL_SIDE), Image.BICUBIC).save(out.with_suffix('.tmp.jpg'), 'JPEG', quality=95)
                out.with_suffix('.tmp.jpg').replace(out)
                return True
            except Exception:
                continue
            finally:
                try:
                    jpg.unlink()
                except OSError:          # (gone, or still locked by Windows: the tmp folder is cleared at the end)
                    pass
        return False
    t0 = time.time()
    def safe(iid):
        try:
            return one(iid)
        except Exception:          # (a photo that can't be fetched is left out of the full-size report, never a stop)
            return False
    with ThreadPoolExecutor(16) as ex:
        ok = list(ex.map(safe, ids))
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)
    got = {i for i, o in zip(ids, ok) if o}
    log('Full-size photos: %d of %d (%.0f min)' % (len(got), len(ids), (time.time() - t0) / 60))
    return got


def pick(lead, elig):
    """Decision 98b's rule on {model: lead} and the eligible models."""
    el = [m for m in ORDER if m in elig]
    if not el:
        return None, None
    c1 = el[0]
    for m in reversed(el):
        smaller = el[:el.index(m)]
        if all(lead[m] - lead[s] >= MARGIN for s in smaller):
            c1 = m
            break
    rest = [m for m in el if m != c1]
    c2 = None
    if rest:
        best = max(rest, key=lambda m: (lead[m], -ORDER.index(m)))
        c2 = best if lead[best] >= C2_MIN else None
    return c1, c2


if __name__ == '__main__':
    miss = [p for p in (R3DIR / 'done', R3DIR / 'labels', R3DIR / 'lists' / 'val_small.txt', R2 / 'lists' / 'test_subjects.txt',
                        R2 / 'lists' / 'test_people.txt', WORK / 'TRACER-Efficient-2.pth', WORK / 'candidates.csv') if not p.exists()]
    if miss:
        fail('missing: %s. Run 1-check first. Nothing has been changed. Send Claude this message.' % ', '.join(map(str, miss)))
    t0 = time.time()
    dev = device()
    data.LABELS = R3DIR / 'labels'
    weights()
    log('Round 5\'s third check: stock TE2, TE3 and TE4 against stock TE0 (seen subjects and people, validation small subjects)')
    subj, people, small = read_r2_list('test_subjects'), read_r2_list('test_people'), read_r3_list('val_small')
    import s6_detect
    flagged, _ = s6_detect.flags(subj, [])
    subj = [i for i in subj if i not in flagged]
    sets = {'subjects': subj, 'people': people, 'small': small}
    log('Photos: seen subjects %d (the detector set apart %d), seen people %d, validation small %d' % (
        len(subj), len(flagged), len(people), len(small)))
    R = {}
    for m, a in ARCH.items():
        net = load_tracer(arch=a).to(dev).eval()
        R[m] = measure(net, sets, dev)
        log('%s (input %d): subjects overlap %.4f outline %.4f | people overlap %.4f outline %.4f | small found %.4f (overlap %.4f)' % (
            m, net.inp, R[m]['subjects']['iou'].mean(), R[m]['subjects']['bf'].mean(), R[m]['people']['iou'].mean(),
            R[m]['people']['bf'].mean(), R[m]['small']['found'].mean(), R[m]['small']['iou'].mean()))
        del net
        if dev.type == 'cuda':
            torch.cuda.empty_cache()
    # stock TE0 as round 3 measured it
    h3 = json.load(open(R3DIR / 'A3-history.json'))[0] if (R3DIR / 'A3-history.json').exists() else {}
    chk = [(k, a, R['TE0'][k][a].mean(), REF[k][a]) for k in REF for a in ('iou', 'bf')]
    chk += [('small', 'found', R['TE0']['small']['found'].mean(), h3.get('found', np.nan)),
            ('small', 'iou', R['TE0']['small']['iou'].mean(), h3.get('small_iou', np.nan))]
    repro = (all(abs(len(sets[k]) - REF[k]['n']) <= 3 for k in REF) and
             all(abs(v - r) <= (TOL if a != 'found' else 0.006) for k, a, v, r in chk))
    log('Stock TE0 against round 3\'s measurement: %s (%s)' % ('the same' if repro else 'NOT THE SAME',
                                                              ', '.join('%s %s %+.4f' % (k, a, v - r) for k, a, v, r in chk)))
    lead = {m: float((R[m]['subjects']['iou'] - R['TE0']['subjects']['iou']).mean()) for m in ORDER}
    plead = {m: float((R[m]['people']['iou'] - R['TE0']['people']['iou']).mean()) for m in ORDER}
    sfound = {m: float(R[m]['small']['found'].mean()) for m in ['TE0'] + ORDER}
    elig = [m for m in ORDER if sfound[m] >= sfound['TE0'] and plead[m] >= PEOPLE_MIN]
    c1, c2 = pick(lead, elig)
    rows = []
    for j, m in enumerate(ORDER):
        d = {}
        for i, (k, a) in enumerate((('subjects', 'iou'), ('subjects', 'bf'), ('people', 'iou'), ('people', 'bf'), ('small', 'found'))):
            d[k + a] = ci(R[m][k][a] - R['TE0'][k][a], 400 + 10 * j + i)
        rows.append('| %s | %s | %s | %s | %s | %s | %s |' % (m, *('%+.4f (%+.4f to %+.4f)' % d[x] for x in (
            'subjectsiou', 'subjectsbf', 'peopleiou', 'peoplebf', 'smallfound')), 'yes' if m in elig else 'no'))
    # full size (reported; the trigger for 98c)
    full = fetch_full(sorted(set(subj) | set(people) | set(small)))
    fsets = {k: [i for i in v if i in full] for k, v in sets.items()}
    F = {}
    for m, a in ARCH.items():
        net = load_tracer(arch=a).to(dev).eval()
        F[m] = measure(net, fsets, dev, full=True)
        log('%s on the full-size photos: subjects overlap %.4f outline %.4f | small found %.4f' % (
            m, F[m]['subjects']['iou'].mean(), F[m]['subjects']['bf'].mean(), F[m]['small']['found'].mean()))
        del net
        if dev.type == 'cuda':
            torch.cuda.empty_cache()
    flead = {m: float((F[m]['subjects']['iou'] - F['TE0']['subjects']['iou']).mean()) for m in ORDER}
    fplead = {m: float((F[m]['people']['iou'] - F['TE0']['people']['iou']).mean()) for m in ORDER}
    ffound = {m: float(F[m]['small']['found'].mean()) for m in ['TE0'] + ORDER}
    frows = ['| %s | %+.4f | %+.4f | %+.4f | %+.4f | %+.4f |' % (
        m, flead[m], float((F[m]['subjects']['bf'] - F['TE0']['subjects']['bf']).mean()), fplead[m],
        float((F[m]['people']['bf'] - F['TE0']['people']['bf']).mean()), ffound[m] - ffound['TE0']) for m in ORDER]
    felig = [m for m in ORDER if ffound[m] >= ffound['TE0'] and fplead[m] >= PEOPLE_MIN]
    fc1, fc2 = pick(flead, felig)
    trigger = bool(repro and c1 and c1 != 'TE4' and fc1 == 'TE4')
    te4_cand = bool(repro and 'TE4' in (c1, c2))
    if not repro:
        verdict = 'NO DECISION: stock TE0 did not come out as round 3 measured it. Send Claude this file.'
    elif c1 is None:
        verdict = 'NO CANDIDATE: no model is eligible. Send Claude this file.'
    else:
        verdict = 'C1 = %s%s.' % (c1, '; C2 = %s' % c2 if c2 else '; no C2')
        if trigger:
            verdict += (' FULL-SIZE TRIGGER: on full-size photos the same rule picks TE4 as C1: decision 98c (photos again at '
                        '448, TE4 as C1) goes to Ben.')
        elif te4_cand:
            verdict += ' TE4 is a candidate: decision 98c (photos again at 448) goes to Ben with the full-size numbers.'
    log(verdict)
    txt = ['# Round 5, third check: stock TE2 / TE3 / TE4 vs stock TE0 (decision 98b)', '', '**%s**' % verdict, '',
           'Rule fixed before the run: lead = seen-subjects overlap minus TE0\'s; a model is out if its validation small found '
           'is below TE0\'s or its seen-people overlap is more than 0.010 below; C1 = the biggest eligible model leading every '
           'smaller eligible one by at least +0.005, else the smallest; C2 = the eligible runner-up if its lead is at least '
           '+0.010; full-size trigger: the same rule on the full-size photos picks TE4 as C1.', '',
           'Stock TE0 against round 3\'s measurement: %s' % ('the same' if repro else 'NOT THE SAME'), '',
           'Means (384-px photos, as step 6): ' + '; '.join('%s subjects %.4f/%.4f, people %.4f/%.4f, small found %.4f' % (
               m, R[m]['subjects']['iou'].mean(), R[m]['subjects']['bf'].mean(), R[m]['people']['iou'].mean(),
               R[m]['people']['bf'].mean(), R[m]['small']['found'].mean()) for m in ARCH), '',
           '## Each model minus stock TE0, on the 384-px photos (this decides)', '',
           '| Model | Subjects overlap (seen, n %d) | Subjects outline | People overlap (seen, n %d) | People outline | Small found (val, n %d) | Eligible |' % (
               len(subj), len(people), len(small)), '|---|---|---|---|---|---|---|'] + rows + [
           '', '## Full-size photos, squashed straight to each model\'s size (reported; the 98d trigger)', '',
           'Photos: subjects %d, people %d, small %d (of %d / %d / %d).' % (len(fsets['subjects']), len(fsets['people']),
                                                                         len(fsets['small']), len(subj), len(people), len(small)), '',
           '| Model | Subjects overlap | Subjects outline | People overlap | People outline | Small found |', '|---|---|---|---|---|---|'] + frows + [
           '', 'Full-size TE0: subjects overlap %.4f, small found %.4f. The rule on full-size photos: eligible %s; C1 %s, C2 %s.' % (
               F['TE0']['subjects']['iou'].mean(), ffound['TE0'], ', '.join(felig) or 'none', fc1, fc2),
           '', 'Device: %s; %.0f min' % (dev, (time.time() - t0) / 60)]
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / 'sizes-round5.txt').write_text('\n'.join(txt) + '\n', encoding='utf-8')
    json.dump({'verdict': verdict, 'repro': repro, 'c1': c1, 'c2': c2, 'trigger': trigger, 'te4_candidate': te4_cand,
               'full_c1': fc1, 'full_c2': fc2, 'lead': lead, 'people_lead': plead,
               'small_found': sfound, 'eligible': elig, 'full_lead': flead, 'full_people_lead': fplead, 'full_small_found': ffound},
              open(RESULTS / 'sizes-round5.json', 'w'), indent=1)
    log('Written: results\\sizes-round5.txt. Send it to Claude.')
