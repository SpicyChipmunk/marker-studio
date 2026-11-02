# Step 6, round 6 (decisions 114-136, config round6_rule; 6-results runs this when config round is 6). Every candidate
# against C1 (round 5's winner, in the app) on the fresh checks, each difference with a paired-bootstrap 95% interval:
#   subjects    round 3's fresh subjects (the check detector's set-apart photos left out, as round 5)
#   small       round 6's fresh slice (work\round6: never used before), set-apart photos left out
#   people      round 3's 800 people less the bench's photos (hand-drawn outlines; decision 130)
#   crops       round 6's fresh empty crops, set-apart crops left out
# Candidates: E4 (the E4/E4b average if step 5 kept it), E6, each one's blend toward its untrained weights if the alpha
# rule (decisions 125, 133) picks one, and E4kd if trained. BETTER: an interval wholly above 0 on subjects outline, small
# found or people outline; then every guard. Flags beside the verdict (never a fail): false subjects on empty crops, and
# stray people (decision 131). The full-size check (decision 134): each line that made a candidate BETTER, on the photos
# again at 640 squashed as the app does, mean above 0. Reported only: round 6's fresh people (machine-drawn outlines),
# round 3's fresh small subjects, round 2's seen checks, D5, D6, E6-p6, E6-avg5, C1-mix25, D6-mix25, E4's two seeds alone,
# stock TE4 and TE6, C1+. Each model's per-photo numbers are kept (work\cache6, by weights fingerprint): a second run is
# quick and identical. Exports (the app's 8-bit file) for passing candidates only. Writes results\report.md/.json,
# results\models, results\sheets.
import csv, hashlib, json, shutil, time, zlib
import numpy as np
import torch
from PIL import Image
import data
from common import (CFG, WORK, RESULTS, log, fail, mark_done, done, load_tracer, device, R3DIR, read_r2_list,
                    read_r2_crops, read_r3_list, sha256, STOCK)
from data import load_prep, crop_img, maps, down, iou, boundary_f, strays, dilate, INP
import s6_detect

RR = CFG['round6_rule']
H = CFG['held']
R6 = WORK / 'round6'
LAB6 = R6 / 'labels'
FD = H['false_dilate']
NB = CFG['ship_rule']['bootstrap']
dev = device()


def lab(iid):
    """An outline: round 6's own (work\\round6\\labels) or round 3's (work\\round3\\labels: round 2's and 3's)."""
    p = LAB6 / (iid + '.png')
    return np.asarray(Image.open(p if p.exists() else R3DIR / 'labels' / (iid + '.png'))) >= 128


data.load_label = lab          # (s1d_sizes' full-size measure reads outlines through data.load_label)
data.LABELS, data.CROPS = R3DIR / 'labels', R3DIR / 'crops.csv'


def rd6(n):
    return [l.strip() for l in open(R6 / 'lists' / (n + '.txt'), encoding='utf-8') if l.strip()]


def crops_csv(p, role='test'):
    with open(p, encoding='utf-8') as f:
        return [(r['id'], int(r['x']), int(r['y']), int(r['s'])) for r in csv.DictReader(f) if r['role'] == role]


# ---- models ----
def build_net(v):
    """A checkpoint path; ('stock', arch); ('mix', path, arch, back) = the weights blended back toward the arch's stock
    weights by `back`; ('avg', path, ...) = checkpoints' weights averaged."""
    if not isinstance(v, tuple):
        return load_tracer(v)
    if v[0] == 'stock':
        return load_tracer(arch=v[1])
    if v[0] == 'mix':
        net = load_tracer(v[1])
        st = load_tracer(arch=v[2]).state_dict()
        net.load_state_dict({k: ((1 - v[3]) * t.float() + v[3] * st[k].float()).to(t.dtype) if t.is_floating_point() else t
                             for k, t in net.state_dict().items()})
        return net
    if v[0] == 'avg':
        nets = [load_tracer(p) for p in v[1:]]
        sds = [n.state_dict() for n in nets]
        nets[0].load_state_dict({k: torch.stack([sd[k].float() for sd in sds]).mean(0).to(t.dtype) if t.is_floating_point() else t
                                 for k, t in sds[0].items()})
        return nets[0]
    raise ValueError(v)


_FP = {}


def fingerprint(v):
    if not isinstance(v, tuple):
        k = str(v)
        if k not in _FP:
            _FP[k] = sha256(v)
        return _FP[k]
    if v[0] == 'stock':
        return fingerprint(WORK / STOCK[v[1]])
    if v[0] == 'mix':
        return 'mix(%s,%s,%g)' % (fingerprint(v[1]), v[2], v[3])
    return '%s(%s)' % (v[0], ','.join(fingerprint(x) for x in v[1:]))


def arch_of(v):
    if isinstance(v, tuple):
        return v[1] if v[0] == 'stock' else (v[2] if v[0] == 'mix' else arch_of(v[1]))
    return str(torch.load(v, map_location='cpu', weights_only=True).get('arch', '0'))


# ---- per-photo numbers ----
def per_photo(net, name, sets_, crops_, what, boxes=None):
    """{set: {measure: array}}: overlap, outline (subjects, people), found, beyond (map outside the outline grown 7 px >= 1%
    of the frame); crops: false (>= 1% marked); 'stray' sets also: stray (>= 1% of the frame inside the detected person
    boxes, outside the outline grown 7 px) and stray25 (>= 25% of those boxes)."""
    out = {}
    for k, ids in sets_.items():
        t0 = time.time()
        m = {'iou': [], 'bf': [], 'found': [], 'beyond': [], 'stray': [], 'stray25': []}
        for s in range(0, len(ids), 32):
            b = ids[s:s + 32]
            for iid, y in zip(b, maps(net, [load_prep(i)[0] for i in b], dev)):
                L = down(lab(iid))
                P_ = strays(y >= 0.5)
                m['iou'].append(iou(P_, L))
                m['bf'].append(boundary_f(P_, L) if k in ('subjects', 'people', 'p3', 'seen_subjects', 'seen_people') else 0.0)
                m['found'].append(m['iou'][-1] >= 0.5)
                out_ = P_ & ~dilate(L, FD)
                m['beyond'].append(out_.mean() >= 0.01)
                if boxes is not None:
                    B = np.zeros_like(P_)
                    for x0, y0, x1, y1 in boxes.get(iid, ()):
                        B[int(y0 * INP):int(np.ceil(y1 * INP)), int(x0 * INP):int(np.ceil(x1 * INP))] = True
                    hit = (out_ & B).sum()
                    m['stray'].append(hit / out_.size >= RR['stray_frame_share'])
                    room = (B & ~dilate(L, FD)).sum()
                    m['stray25'].append(bool(room) and hit >= RR['stray_box_share'] * room)
        out[k] = {a: np.array(v, float) for a, v in m.items() if v}
        if ids:
            log('   %s: %s %s (%d photos, %.0f s)' % (name, what, k, len(ids), time.time() - t0))
    fl = []
    for s in range(0, len(crops_), 32):
        b = crops_[s:s + 32]
        for y in maps(net, [crop_img(load_prep(c[0])[0], *c[1:]) for c in b], dev):
            fl.append(strays(y >= 0.5).mean() >= 0.01)
    out['crops'] = {'false': np.array(fl, float)}
    return out


CDIR = WORK / 'cache6'


def cached(spec, net, name, sets_, crops_, what, boxes=None):
    CDIR.mkdir(exist_ok=True)
    h = hashlib.sha256(json.dumps([fingerprint(spec), 'r6', what, CFG['side'], INP, {k: list(v) for k, v in sets_.items()},
                                   [list(c) for c in crops_], sorted((k, v) for k, v in (boxes or {}).items())]).encode()).hexdigest()[:24]
    cp = CDIR / (h + '.npz')
    if cp.exists():
        with np.load(cp) as z:
            out = {}
            for key in z.files:
                k, a = key.split('|', 1)
                out.setdefault(k, {})[a] = z[key]
        return out
    out = per_photo(net, name, sets_, crops_, what, boxes)
    np.savez(CDIR / (h + '.tmp.npz'), **{'%s|%s' % (k, a): v for k, d in out.items() for a, v in d.items()})
    (CDIR / (h + '.tmp.npz')).replace(cp)
    return out


def ci(d):
    """Mean of a paired difference and its 95% paired-bootstrap interval (seeded by the differences: the same models on the
    same photos always give the same interval)."""
    if len(d) == 0:
        return (float('nan'),) * 3
    r_ = np.random.default_rng(zlib.crc32(np.ascontiguousarray(d, dtype=np.float64).tobytes()))
    bs = d[r_.integers(0, len(d), (NB, len(d)))].mean(axis=1)
    return float(d.mean()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def pasted_found(net, P1):
    """Pasted 1% subjects found (the kit's pasted check, step 5's own photos)."""
    f = []
    for s in range(0, len(P1), 32):
        b = P1[s:s + 32]
        for (sh, img, g), y in zip(b, maps(net, [x[1] for x in b], dev)):
            f.append(iou(strays(y >= 0.5), down(g)) >= 0.5)
    return float(np.mean(f)) if f else float('nan')


def main():
    if not (done('s5') or (done('s5-E4') and done('s5-E6'))):
        fail('5-train has not finished E4 and E6 (the judged models): run 5-train again, it carries on where it stopped.')
    MISSING = [x for x in CFG['round6_train']['order'] if not done('s5-' + x)]
    # (v4) E4 is judged as the average with E4b once E4b is trained (decision 126): never E4 alone in its place
    if done('s5-E4b') and not (WORK / 'runs' / 'E4soup' / 'decision.json').exists():
        fail('E4b is trained but not yet averaged into E4: run 5-train again (about 15 minutes; it skips what is trained), '
             'then 6-results.')
    if not (R6 / 'done').exists():
        fail('round 6\'s photos (work\\round6) are not complete: run 4c-prep-round6 first.')
    C1 = WORK / 'runs' / 'C1' / 'best.pt'
    if not C1.exists():
        fail('C1 (work\\runs\\C1\\best.pt) is missing: send Claude this message.')

    # ---- the checks ----
    sort3 = {}
    with open(R3DIR / 'sort.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            sort3[r['id']] = r
    SETS = {'subjects': read_r3_list('test_subjects'), 'small': rd6('small'), 'people': rd6('people_judge'),
            'r3small': read_r3_list('test_small'), 'p3': rd6('people_p3'),
            'seen_subjects': read_r2_list('test_subjects'), 'seen_small': read_r2_list('test_small'),
            'seen_people': read_r2_list('test_people')}
    CROPS = {'fresh': crops_csv(R6 / 'crops.csv'), 'seen': read_r2_crops('test')}
    det_ids = sorted({i for k in ('subjects', 'small', 'r3small', 'seen_subjects', 'seen_small') for i in SETS[k]})
    DP, DC = s6_detect.flags(det_ids, CROPS['fresh'] + CROPS['seen'])
    aside = {k: [i for i in SETS[k] if i in DP] for k in ('subjects', 'small', 'r3small', 'seen_subjects', 'seen_small')}
    for k in aside:
        SETS[k] = [i for i in SETS[k] if i not in DP]
    for g in CROPS:
        CROPS[g] = [c for c in CROPS[g] if c not in DC]
    # stray people (decision 131): the detector's 'person' set-apart photos and the person boxes that set them apart
    dets = json.load(open(WORK / 'detector' / 'photos.json'))
    stray_ids = sorted(i for k in ('subjects', 'small', 'r3small') for i in aside[k] if DP.get(i) == 'person')
    SBOX = {}
    for i in stray_ids:
        ob = [b for b in (s6_detect._box(m) for m in load_prep(i)[1]) if b]
        SBOX[i] = [tuple(b) for cls, sc, *b in dets.get(i, []) if cls == s6_detect.PERSON and sc >= s6_detect.THR and not s6_detect._inside(b, ob)]
    log('Checks: %s; empty crops fresh %d, seen %d; set apart by the detector: %s, crops %d; stray-people photos %d' % (
        ', '.join('%s %d' % (k, len(v)) for k, v in SETS.items()), len(CROPS['fresh']), len(CROPS['seen']),
        ', '.join('%s %d' % (k, len(v)) for k, v in aside.items()), len(DC), len(stray_ids)))
    empty = [k for k in ('subjects', 'small', 'people') if not SETS[k]] + (['crops'] if not CROPS['fresh'] else [])
    if empty:
        fail('no photos in the fresh %s checks (work\\round3 or work\\round6 lists): nothing is judged. Send Claude this message.' % ', '.join(empty))
    HANDS = np.array([sort3.get(i, {}).get('kind') == 'held' for i in SETS['seen_small']], bool)
    FRESH = {k: SETS[k] for k in ('subjects', 'small', 'people', 'r3small', 'p3')}
    SEEN = {k: SETS[k] for k in ('seen_subjects', 'seen_small', 'seen_people')}

    # ---- the models ----
    runs = WORK / 'runs'
    sp = json.load(open(runs / 'E4soup' / 'decision.json')) if (runs / 'E4soup' / 'decision.json').exists() else {'used': 'E4'}
    CAND = {}
    if (runs / 'E4soup' / 'best.pt').exists():
        CAND['E4'] = runs / 'E4soup' / 'best.pt'
    elif done('s5-E4'):
        CAND['E4'] = runs / 'E4' / 'best.pt'
    for n in ('E6', 'E4kd'):
        if done('s5-' + n) and (runs / n / 'best.pt').exists():
            CAND[n] = runs / n / 'best.pt'
    REP = {'TE4-stock': ('stock', '4'), 'TE6-stock': ('stock', '6'), 'C1-mix25': ('mix', C1, '4', 0.25)}
    for n in ('D5', 'D6', 'C1+'):
        if (runs / n / 'best.pt').exists():
            REP[n] = runs / n / 'best.pt'
    if 'D6' in REP:
        REP['D6-mix25'] = ('mix', REP['D6'], '6', 0.25)
    if sp.get('used') == 'soup':
        REP['E4-seed1'] = runs / 'E4' / 'best.pt'
    if (runs / 'E4b' / 'best.pt').exists():
        REP['E4b'] = runs / 'E4b' / 'best.pt'
    e6 = runs / 'E6'
    if (e6 / 'ema-06.pt').exists():
        REP['E6-p6'] = e6 / 'ema-06.pt'
    if all((e6 / ('ema-%02d.pt' % e)).exists() for e in range(5, 10)):
        REP['E6-avg5'] = ('avg',) + tuple(e6 / ('ema-%02d.pt' % e) for e in range(5, 10))
    REP = {k: v for k, v in REP.items() if not (isinstance(v, tuple) and v[0] == 'stock' and not (WORK / STOCK[v[1]]).exists())}
    log('Candidates: %s; reported: %s' % (', '.join(CAND) or 'none', ', '.join(REP)))

    # ---- measuring ----
    P, PS = {}, {}

    def measure(name, spec, fresh=True):
        """Every check for a model; fresh=False: round 2's seen checks only (the alpha search)."""
        if name in P and ('subjects' in P[name] or not fresh):
            return
        net = build_net(spec).to(dev).eval()
        seen = cached(spec, net, name, SEEN, CROPS['seen'], 'seen')
        P.setdefault(name, {}).update({k: v for k, v in seen.items() if k != 'crops'})
        P[name]['seen_crops'] = seen['crops']
        if fresh:
            P[name].update(cached(spec, net, name, FRESH, CROPS['fresh'], 'fresh'))
            PS[name] = cached(spec, net, name, {'stray': stray_ids}, [], 'stray people', SBOX)['stray'] if stray_ids else {}
        del net
        if dev.type == 'cuda':
            torch.cuda.empty_cache()
        log('%s measured' % name)

    measure('C1', C1)
    for n, v in CAND.items():
        measure(n, v)
    d = lambda a, b, k, m, sel=None: ci((P[a][k][m] - P[b][k][m]) if sel is None else (P[a][k][m] - P[b][k][m])[sel])

    # ---- the blends (decisions 125, 133): alpha on round 2's seen checks only ----
    ALPHA = {}
    for n in ('E4', 'E6'):
        if n not in CAND:
            continue
        arch = arch_of(CAND[n])
        rows = [(0.0, n)]
        for a in RR['alphas']:
            nm = '%s-a%02d' % (n, round(100 * a))
            measure(nm, ('mix', CAND[n], arch, a), fresh=False)
            rows.append((a, nm))
        ok = []
        for a, nm in rows:
            sf = P[nm]['seen_small']['found'].mean() - P[n]['seen_small']['found'].mean()
            cu = P[nm]['seen_crops']['false'].mean() - P[n]['seen_crops']['false'].mean()
            cc = P[nm]['seen_crops']['false'].mean() - P['C1']['seen_crops']['false'].mean()
            good = a == 0 or (sf >= RR['alpha_small_found'] and cu <= RR['alpha_crops_vs_unblended'] and cc <= RR['alpha_crops_vs_C1'])
            ok.append((a, nm, good, P[nm]['seen_people']['bf'].mean(), sf, cu, cc))
        best = max((r for r in ok if r[2]), key=lambda r: (r[3], -r[0]))
        ALPHA[n] = {'rows': ok, 'alpha': best[0]}
        if best[0] > 0:
            CAND[n + '-mix'] = ('mix', CAND[n], arch, best[0])
            measure(n + '-mix', CAND[n + '-mix'])
            log('%s-mix: alpha %.2f (seen people outline %.4f vs unblended %.4f)' % (n, best[0], best[3], ok[0][3]))
        else:
            log('%s: no blend (alpha 0 is best on seen people outline within the bounds)' % n)
    for n, v in REP.items():
        measure(n, v)

    # ---- the pasted 1% check (step 5's photos) ----
    import s5_train
    PA1 = [x for x in s5_train.pastes(read_r3_list('train'), data.read_crops('train'), CFG['train'].get('paste_sources', 8)) if x[0] == 0.01]
    PF = {}
    for n in ['C1'] + list(CAND):
        net = build_net(CAND.get(n, C1)).to(dev).eval()
        PF[n] = pasted_found(net, PA1)
        del net

    # ---- the rule ----
    gd = RR['guards']
    VER, FLAGS = {}, {}
    for n, spec in CAND.items():
        D = {'subjects_bf': d(n, 'C1', 'subjects', 'bf'), 'subjects_iou': d(n, 'C1', 'subjects', 'iou'),
             'small_found': d(n, 'C1', 'small', 'found'), 'small_iou': d(n, 'C1', 'small', 'iou'),
             'people_iou': d(n, 'C1', 'people', 'iou'), 'people_bf': d(n, 'C1', 'people', 'bf'),
             'crops_false': d(n, 'C1', 'crops', 'false')}
        better = [k for k in ('subjects_bf', 'small_found', 'people_bf') if D[k][1] > 0]
        hs = d(n, 'C1', 'seen_small', 'found', HANDS) if HANDS.any() else (float('nan'),) * 3
        arch = arch_of(spec)
        secs = RR['ipad_s'].get(arch)
        G = [('Subjects: outline ≥ %+.3f (or BETTER on it)' % gd['subjects_bf'], D['subjects_bf'][0] >= gd['subjects_bf'] or 'subjects_bf' in better),
             ('Subjects: overlap ≥ %+.3f' % gd['subjects_iou'], D['subjects_iou'][0] >= gd['subjects_iou']),
             ('Small subjects: found, low end ≥ %+.0f points' % (100 * gd['small_found_lo']), D['small_found'][1] >= gd['small_found_lo']),
             ('Small subjects: overlap ≥ %+.3f' % gd['small_iou'], D['small_iou'][0] >= gd['small_iou']),
             ('People: overlap ≥ %+.3f' % gd['people_iou'], D['people_iou'][0] >= gd['people_iou']),
             ('People: outline ≥ %+.3f' % gd['people_bf'], D['people_bf'][0] >= gd['people_bf']),
             ('Pasted 1%% subjects found ≥ %.2f (%.3f of %d; C1 %.3f)' % (RR['paste_1pct_min'], PF[n], len(PA1), PF['C1']),
              PF[n] >= RR['paste_1pct_min']),
             ('Round 2\'s %d hand-checked small subjects: found ≥ C1 %+.0f points (%+.4f)' % (
                 int(HANDS.sum()), 100 * RR['hand_small_found_vs_C1'], hs[0]), bool(HANDS.any()) and hs[0] >= RR['hand_small_found_vs_C1']),
             ('Under %.1f s a photo on Ben\'s iPad (TE%s: %s s, measured on his iPad with the timing page)' % (
                 RR['ipad_max_s'], arch, secs), secs is not None and secs < RR['ipad_max_s'])]
        sp_ = ci(PS[n]['stray'] - PS['C1']['stray']) if PS.get(n) else (float('nan'),) * 3
        s25 = ci(PS[n]['stray25'] - PS['C1']['stray25']) if PS.get(n) else (float('nan'),) * 3
        FLAGS[n] = {'crops': (D['crops_false'], D['crops_false'][0] > RR['flag_crops_false']),
                    'stray': (sp_, sp_[0] > RR['flag_stray_people']), 'stray25': (s25, False)}
        VER[n] = {'D': D, 'better': better, 'guards': G, 'hand': hs, 'arch': arch}

    # ---- the full-size check (decision 134), every candidate BETTER somewhere, and C1 ----
    import s1d_sizes as S
    S.FULL, S.FULL_SIDE = R6 / 'full640', CFG['round6']['full_side']
    need = [n for n in VER if VER[n]['better']]
    FS = {}
    if need:
        fsets = {'subjects': [i for i in SETS['subjects'] if (S.FULL / (i + '.jpg')).exists()],
                 'small': [i for i in SETS['small'] if (S.FULL / (i + '.jpg')).exists()],
                 'people': [i for i in SETS['people'] if (S.FULL / (i + '.jpg')).exists()]}
        log('Full size (640, squashed as the app does): subjects %d, small %d, people %d' % tuple(len(v) for v in fsets.values()))
        for n in ['C1'] + need:
            net = build_net(CAND.get(n, C1)).to(dev).eval()
            FS[n] = S.measure(net, fsets, dev, full=True)
            del net
        KM = {'subjects_bf': ('subjects', 'bf'), 'small_found': ('small', 'found'), 'people_bf': ('people', 'bf')}
        for n in need:
            for key in VER[n]['better']:
                k, a = KM[key]
                fd = ci(FS[n][k][a] - FS['C1'][k][a])
                VER[n].setdefault('full', {})[key] = fd
                VER[n]['guards'].append(('Full size: %s still above 0 (n %d of %d; mean %+.4f, interval %+.4f to %+.4f; kit photos %+.4f to %+.4f)' % (
                    key, len(fsets[k]), len(SETS[k]), fd[0], fd[1], fd[2], VER[n]['D'][key][1], VER[n]['D'][key][2]), fd[0] > 0 and fd[2] >= 0))
    passing = [n for n in VER if VER[n]['better'] and all(ok for _, ok in VER[n]['guards'])]

    # ---- the report ----
    PN = {'subjects_iou': 'Subjects: overlap', 'subjects_bf': 'Subjects: outline', 'small_found': 'Small subjects: found',
          'small_iou': 'Small subjects: overlap', 'people_iou': 'People: overlap', 'people_bf': 'People: outline',
          'crops_false': 'Empty crops: false subjects'}
    KA = {'subjects_iou': ('subjects', 'iou'), 'subjects_bf': ('subjects', 'bf'), 'small_found': ('small', 'found'),
          'small_iou': ('small', 'iou'), 'people_iou': ('people', 'iou'), 'people_bf': ('people', 'bf'), 'crops_false': ('crops', 'false')}
    c1f = P['C1']['crops']['false'].mean()
    RL = ['# Subject model, round 6: check report', '',
          '**%s** Ben decides between passing candidates with the data (decision 115), then the iPad build and his 24 photos '
          '(veto).' % ('Passing: %s.' % ', '.join(passing) if passing else 'No candidate passes: C1 stays.'), '',
          'Checks (fresh, judged): subjects %d (round 3\'s), small subjects %d (round 6\'s slice), people %d (round 3\'s, the bench\'s '
          'photos left out), empty crops %d (round 6\'s slice); the check detector set apart %s, crops %d.' % (
              len(SETS['subjects']), len(SETS['small']), len(SETS['people']), len(CROPS['fresh']),
              ', '.join('%s %d' % (k, len(v)) for k, v in aside.items()), len(DC)), '',
          'Small subjects found: the guard is the interval\'s low end at -2 points, fixed in the plan (round 5\'s sliding rule '
          'would have said -2.5 at this many photos): read a near miss with that in mind.', '',
          'iPad seconds are those measured on Ben\'s iPad (TE4 0.65 s, TE6 1.51 s a photo, as the app does it); an older iPad '
          'is slower (not measured).', ''] + (
          ['**Not trained: %s** (5-train stopped or was not finished; E4 and E6, the judged models, are done).' % ', '.join(MISSING), '']
          if MISSING else []) + [
          'A candidate truly no better than C1 shows one of the three "better" lines by luck about 1 time in 14; with E4, E6 and '
          'their blends judged (partly the same models), roughly 1 in 5 that at least one does. The full-size check, the sheets '
          'and Ben\'s 24 photos are the backstop.', '']
    for n in VER:
        V = VER[n]
        RL += ['## %s minus C1 (fresh checks)%s' % (n, ': PASSES' if n in passing else ''), '',
               '| Line | C1 | %s − C1 (95%% interval) |' % n, '|---|---|---|']
        for key in ('subjects_iou', 'subjects_bf', 'small_found', 'small_iou', 'people_iou', 'people_bf', 'crops_false'):
            k, a = KA[key]
            RL.append('| %s (n %d) | %.4f | %+.4f (%+.4f to %+.4f)%s |' % (PN[key], len(P['C1'][k][a]), P['C1'][k][a].mean(),
                                                                          *V['D'][key], ' **better**' if key in V['better'] else ''))
        fc, fs_ = FLAGS[n]['crops'], FLAGS[n]['stray']
        RL += ['', '- Better than C1: %s' % (', '.join(PN[k] for k in V['better']) if V['better'] else 'not shown'),
               '- Guards: ' + ('all hold' if all(ok for _, ok in V['guards']) else 'not held: ' + '; '.join(l for l, ok in V['guards'] if not ok)),
               '- Guard lines: ' + '; '.join('%s %s' % (l, 'holds' if ok else '**fails**') for l, ok in V['guards']),
               '- FLAG, empty crops: %+.4f (%+.4f to %+.4f)%s. C1 marks a subject in %.1f%% of empty scenes; +1 point is one more '
               'false subject in 100, +2 points one in 50.' % (*fc[0], ' **flagged** (more than C1 + %.0f point)' % (100 * RR['flag_crops_false'])
                                                                 if fc[1] else ' (within the line)', 100 * c1f),
               '- FLAG, stray people (%d photos with a detected person outside the outline): marked ≥ 1%% of the frame there '
               '%+.4f (%+.4f to %+.4f) vs C1%s (C1 %.1f%%); ≥ 25%% of the person boxes: %+.4f (%+.4f to %+.4f).' % (
                   len(stray_ids), *fs_[0], ' **flagged** (more than C1 + %.0f points)' % (100 * RR['flag_stray_people']) if fs_[1]
                   else ' (within the line)', 100 * PS['C1']['stray'].mean() if PS.get('C1') else float('nan'), *FLAGS[n]['stray25'][0]),
               '']
    RL += ['## Blends (alpha on round 2\'s seen checks only)', '']
    for n, A in ALPHA.items():
        RL.append('- %s: alpha %.2f chosen. ' % (n, A['alpha']) + '; '.join(
            '%.2f: seen people outline %.4f, seen small found %+.4f, seen crops %+.4f vs unblended, %+.4f vs C1%s' % (
                a, po, sf, cu, cc, '' if g_ else ' (out of bounds)') for a, nm, g_, po, sf, cu, cc in A['rows']))
    RL += ['', '## Reported only, never judged (minus C1, fresh checks)', '',
           '| Model | ' + ' | '.join(PN[k] for k in ('subjects_iou', 'subjects_bf', 'small_found', 'people_bf', 'crops_false')) +
           ' | round 6 people outline | round 3 small found |', '|---|---|---|---|---|---|---|---|']
    for n in list(CAND) + list(REP):
        if n not in P:
            continue
        cells = ['%+.4f (%+.4f to %+.4f)' % d(n, 'C1', *KA[k]) for k in ('subjects_iou', 'subjects_bf', 'small_found', 'people_bf', 'crops_false')]
        cells += ['%+.4f (%+.4f to %+.4f)' % d(n, 'C1', 'p3', 'bf'), '%+.4f (%+.4f to %+.4f)' % d(n, 'C1', 'r3small', 'found')]
        RL.append('| %s | %s |' % (n, ' | '.join(cells)))
    RL += ['', '- Seen checks (round 2), minus C1: ' + '; '.join('%s subjects outline %+.4f, small found %+.4f, people outline %+.4f' % (
        n, d(n, 'C1', 'seen_subjects', 'bf')[0], d(n, 'C1', 'seen_small', 'found')[0], d(n, 'C1', 'seen_people', 'bf')[0]) for n in CAND),
        '- E4: %s.%s' % ('the average of its two seeds' if sp.get('used') == 'soup' else 'seed 1 alone (%s)' % sp.get(
            'why', 'the average was not better on both lines' if 'scores' in sp else 'E4b not trained'),
            (' Round 3\'s validation (overlap / outline): ' + '; '.join('%s %.4f / %.4f' % (m, v['iou'], v['bf']) for m, v in sp['scores'].items()))
            if 'scores' in sp else ''),
        '- C1 on the fresh people: overlap %.4f, outline %.4f; round 6\'s people (machine-drawn, reported) outline %.4f; round 3\'s small '
        'found %.3f.' % (P['C1']['people']['iou'].mean(), P['C1']['people']['bf'].mean(), P['C1']['p3']['bf'].mean(),
                         P['C1']['r3small']['found'].mean()), '']
    rs = [(x, json.load(open(runs / x / 'restarts.json'))) for x in ('E4', 'E6', 'E4b', 'C1+') if (runs / x / 'restarts.json').exists()]
    if rs:
        RL.append('- Passes started again after a loss blow-up: ' + '; '.join('%s pass %s' % (x, ', '.join(str(r['pass']) for r in v)) for x, v in rs))
    for x in ('E4', 'E6', 'E4b'):
        bj = runs / x / 'batch.json'
        if bj.exists():
            b_ = json.load(open(bj))
            if b_.get('batch') != b_.get('planned'):
                RL.append('- %s trained with batch %s instead of %s (the card\'s memory).' % (x, b_.get('batch'), b_.get('planned')))

    # ---- exports (passing candidates), sheets ----
    mdir, sdir = RESULTS / 'models', RESULTS / 'sheets'
    for dd in (mdir, sdir):
        dd.mkdir(exist_ok=True)
        for p in dd.glob('*'):
            try:
                p.unlink()
            except OSError:
                pass
    R = {'passing': passing, 'candidates': list(CAND), 'reported': list(REP), 'soup': sp, 'export': {},
         'verdict': {n: {'better': V['better'], 'guards': {l: bool(ok) for l, ok in V['guards']},
                         'paired': {k: list(v) for k, v in V['D'].items()}, 'full': {k: list(v) for k, v in V.get('full', {}).items()},
                         'flags': {k: {'diff': list(v[0]), 'flagged': bool(v[1])} for k, v in FLAGS[n].items()}} for n, V in VER.items()},
         'alpha': {n: A['alpha'] for n, A in ALPHA.items()}}
    json.dump(R, open(RESULTS / 'report.json', 'w'), indent=1, default=float)
    (RESULTS / 'report.md').write_text('\n'.join(RL) + '\n', encoding='utf-8')          # (written before the exports)
    if passing:
        from s6_export import export          # (the app's file, as round 5 made C1's)
        for n in passing:
            try:
                R['export'][n] = export(n, build_net(CAND[n]).eval(), mdir, [i for i in SETS['subjects'][:16]])
                RL.append('- %s exported: %s (%.1f MB)' % (n, R['export'][n]['file'], R['export'][n]['mb']))
            except Exception as e:          # (the report stands; the file can be made again)
                RL.append('- %s could not be exported: %s' % (n, e))
                log('%s could not be exported: %s' % (n, e))
    TH = 180
    cols = ['C1'] + list(CAND)

    def row(iid):
        img, L = load_prep(iid)[0], lab(iid)
        small = np.asarray(Image.fromarray(img).resize((TH, TH), Image.BILINEAR))
        tiles = [small, np.where((np.asarray(Image.fromarray(L.astype(np.uint8) * 255).resize((TH, TH))) >= 128)[..., None], small, 255)]
        for n in cols:
            net = NETS[n]
            m = strays(maps(net, [img], dev)[0] >= 0.5)
            mm = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((TH, TH))) >= 128
            tiles.append(np.where(mm[..., None], small, 255))
        return np.concatenate([np.pad(t.astype(np.uint8), ((3, 3), (3, 3), (0, 0)), constant_values=180) for t in tiles], axis=1)

    NETS = {n: build_net(CAND.get(n, C1)).to(dev).eval() for n in cols}
    for name, ids in (('subjects', SETS['subjects'][:6]), ('small', SETS['small'][:6]), ('people', SETS['people'][:12]),
                      ('stray-people', stray_ids[:12])):
        if ids:
            rows_ = [row(i) for i in ids]
            for k in range(0, len(rows_), 6):
                Image.fromarray(np.concatenate(rows_[k:k + 6], axis=0)).save(sdir / ('%s-%02d.jpg' % (name, k // 6 + 1)), quality=88)
    RL += ['', 'Sheets (results\\sheets): the photo, its outline, then %s.' % ', '.join(cols)]
    json.dump(R, open(RESULTS / 'report.json', 'w'), indent=1, default=float)
    (RESULTS / 'report.md').write_text('\n'.join(RL) + '\n', encoding='utf-8')
    log('\n'.join(RL[:4]))
    (RESULTS / 'logs').mkdir(exist_ok=True)
    for f in WORK.glob('*.log'):
        shutil.copy(f, RESULTS / 'logs' / f.name)
    for f in WORK.glob('runs/*/history.json'):
        shutil.copy(f, RESULTS / 'logs' / ('history-%s.json' % f.parent.name))
    mark_done('s6')
    log('Step 6 done. Copy the whole "results" folder to your Mac (Documents/Claude outputs) as results-round6, and tell Claude.')


if __name__ == '__main__':
    main()
