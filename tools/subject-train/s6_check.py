# Step 6 (rounds 2 and 3): check stock TRACER and the trained versions on held-out photos, each difference with a
# paired-bootstrap 95% interval; apply the rule; export each model as the app needs it (ONNX, int8-stored weights,
# ~8 MB); write results/:
#   report.md / report.json   the numbers, the rule, the decision
#   models/*.onnx             stock and each version
#   sheets/*.jpg              photo | drawn outline | stock | each version (cut-outs)
#   attribution.csv           (from step 4) the training photos' credits
# Round 3 (decisions 41-43): two groups of checks. "Fresh": drawn by step 4 from photos round 2 never used; they decide.
# "Seen": round 2's own checks, reported only (they were looked at once already). Models: stock, round 2's A2plus (from
# work/round2) and A3. The rule, fixed before the run (config round3_rule): (1) A2plus must replicate on the fresh checks
# (round 2's rule vs stock; a miss of only the +0.020 outline bar is forgiven if its 95% low end is at least +0.010 and
# every other line holds), else neither ships; (2) A3 replaces A2plus only if it passes round 2's rule vs stock on the
# fresh checks AND beats A2plus, paired, by +0.005 outline or +2 points small found (low end above 0) AND is no worse
# than A2plus beyond the guards; ties go to A2plus.
# Round 4 (decisions 55-68, config round4_rule): the checks are round 3's (its fresh sets decide; round 2's stay "seen",
# reported). Models: stock, A2plus, A3 (round 3's), B1, B1-early (B1's pass-5 averaged weights) and B1-wide. The
# benchmark is round 3's winner (work/round3/report.json). Judged by routes, named before the run: B1 first; if it fails
# a guard (with or without a gain), B1-early is judged; if it holds every guard but isn't shown better, B1-wide is judged;
# nothing else decides. A model ships if it is better than the benchmark, paired, on outline or small subjects found
# (95% low end above 0), passes round 2's rule vs stock, holds round 3's guards against the benchmark, keeps false
# subjects on empty crops within A2plus + 1 point, and its pasted 1% subjects found at least 0.9 on validation.
# Round 5 (decisions 88-98e, config round5_rule): the same checks. Models: stock TE0, A2plus, A3 (the benchmark), stock
# TE4 and stock TE2 (each candidate's own start), C1 (TE4) and C1-early (its pass 5), C2 (TE2) and C2-early, and C1-wide /
# C2-wide once trained. Routes (s6_routes.route5): C1 first; a failing guard line training made clearly worse than stock
# TE4 -> C1-early, else C1-wide (trained only when named: the report is then NOT FINAL); C1's path ending with A3 staying,
# or Ben's veto of it on the iPad (work\veto.txt) -> C2's path, the same with stock TE2. Every model is measured at its
# own input size on the 320 grid; each model's per-photo numbers are kept (work\cache6, by weights fingerprint) so a
# second run is quick and identical. Reported only: C1 after pass 3, C1 blended back toward stock TE4, flip-averaged and
# A3+C1-averaged maps, and the shipping candidate as the app's file and on full-size photos.
# Every map is measured as the app uses it: cut at 0.5, then the stray-parts rule.
print('Step 6: starting (loading PyTorch, about half a minute)...', flush=True)
from common import CFG as _CFG
if _CFG.get('round', 2) >= 6:          # (round 6: its own step, s6_round6.py)
    import s6_round6
    s6_round6.main()
    raise SystemExit(0)
import csv, hashlib, json, os, shutil, time, zlib
import numpy as np
import torch
from PIL import Image
from common import (CFG, WORK, RESULTS, log, fail, mark_done, done, load_tracer, device, MEAN, STD, R2, read_r2_list, read_r2_crops,
                    R3DIR, round3_safe, benchmark, read_r3_list)
from data import (load_prep, load_label, read_list, read_crops, crop_img, maps, down, iou, boundary_f, strays, band, dilate,
                  INP)
import s6_detect
import s6_routes
from common import sha256, STOCK


class FlipNet(torch.nn.Module):
    """(round 5, reported) A model's map averaged with its map of the mirrored photo, mirrored back."""
    def __init__(s, m):
        super().__init__()
        s.m, s.inp = m, m.inp

    def forward(s, x):
        return ((s.m(x)[0] + s.m(x.flip(-1))[0].flip(-1)) / 2,)


class EnsNet(torch.nn.Module):
    """(round 5, reported) Two models' maps averaged, each at its own input size, at the larger size."""
    def __init__(s, a, b):
        super().__init__()
        s.a, s.b, s.inp = a, b, max(a.inp, b.inp)

    def forward(s, x):
        ys = []
        for m in (s.a, s.b):
            xi = x if m.inp == s.inp else torch.nn.functional.interpolate(x, size=(m.inp, m.inp), mode='bilinear', align_corners=False)
            y = m(xi)[0]
            ys.append(y if m.inp == s.inp else torch.nn.functional.interpolate(y, size=(s.inp, s.inp), mode='bilinear', align_corners=False))
        return ((ys[0] + ys[1]) / 2,)


def build_net(v):
    """A model from its spec: None (stock TE0), a checkpoint path, ('stock', arch), ('mix', trained, arch, back) = the trained
    weights blended back toward the arch's stock weights by `back`, ('flip', spec) or ('ens', spec, spec)."""
    if v is None or not isinstance(v, tuple):
        return load_tracer(v) if v else load_tracer()
    if v[0] == 'stock':
        return load_tracer(arch=v[1])
    if v[0] == 'mix':
        net = load_tracer(v[1])
        st = load_tracer(arch=v[2]).state_dict()
        sd = net.state_dict()
        net.load_state_dict({k: ((1 - v[3]) * t.float() + v[3] * st[k].float()).to(t.dtype) if t.is_floating_point() else t
                             for k, t in sd.items()})
        return net
    if v[0] == 'flip':
        return FlipNet(build_net(v[1]))
    if v[0] == 'ens':
        return EnsNet(build_net(v[1]), build_net(v[2]))
    raise ValueError(v)


_FP = {}


def fingerprint(v):
    """What a model's numbers depend on: its weights files' SHA-256 (and how they are combined)."""
    if v is None:
        v = ('stock', '0')
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

RULE, H = CFG['ship_rule'], CFG['held']
R3 = CFG.get('round', 2) >= 3
R3R = CFG.get('round3_rule', {})
R4 = CFG.get('round', 2) >= 4
R4R = CFG.get('round4_rule', {})
R5 = CFG.get('round', 2) >= 5
R5R = CFG.get('round5_rule', {})
if R5:          # (round 3's own lists, outlines, crops and sort table, kept in work\round3: round 4 changed work\lists)
    import data as _data
    _data.LABELS, _data.CROPS = R3DIR / 'labels', R3DIR / 'crops.csv'
if R4:
    round3_safe()          # (no-op once step 4 has kept round 3 apart; this step writes over results\report.json)
dev = device()
sort = {}
with open((R3DIR if R5 else WORK) / 'sort.csv', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        sort[r['id']] = r
KINDS = ('subjects', 'small', 'people', 'scenery')
if not done('s4') and not R5:
    fail('step 4 has not finished: run 4-label (then 5-train) first.')
GROUPS = {'fresh': ({k: (read_r3_list if R5 else read_list)('test_' + k) for k in KINDS}, read_crops('test'))}
if R3:
    GROUPS['seen'] = ({k: read_r2_list('test_' + k) for k in KINDS}, read_r2_crops('test'))
if not GROUPS['fresh'][0]['subjects']:
    fail('no held-out lists: run step 4 first.')

# Decision 35: a COCO detector (stock not used) over the check photos (not the people set) and crops; a photo with an
# un-outlined person or a rival object, and a crop with anything in it, is set apart (reported, not in the rule).
allp = sorted({i for s_, _ in GROUPS.values() for k, v in s_.items() if k != 'people' for i in v})
allc = [c for _, cr in GROUPS.values() for c in cr]
DET_P, DET_C = s6_detect.flags(allp, allc)
REASON = dict(DET_P)
G = {}
for g, (s_, cr) in GROUPS.items():
    aside = {k: ([i for i in v if i in DET_P] if k != 'people' else []) for k, v in s_.items()}
    G[g] = {'all': s_, 'crops_all': cr,
            'sets': {k: ([i for i in v if i not in DET_P] if k != 'people' else v) for k, v in s_.items()},
            'aside': aside, 'crops': [c for c in cr if c not in DET_C], 'crops_aside': [c for c in cr if c in DET_C]}
    log('Detector, %s checks: set apart %s, crops %d' % (g, ', '.join('%s %d' % (k, len(v)) for k, v in aside.items()),
                                                        len(G[g]['crops_aside'])))
# the small-subjects "found" margin, fixed before the results, by the deciding (fresh) clean set's size
n_small = len(G['fresh']['sets']['small'])
RULE['small_found_lower'] = -0.02 if n_small >= 1600 else (-0.025 if n_small >= 1200 else -0.03)

models = {'stock': None}
EXTRA = {}
BASE = (benchmark() if R4 else CFG['train'].get('baseline')) if R3 else None
VETO = set()
if R5:
    if not done('s5'):
        fail('5-train has not finished (it ends with "Step 5 done"): run 5-train again, it carries on where it stopped.')
    if not (R2 / 'A2plus-best.pt').exists() or not (R3DIR / 'A3-best.pt').exists():
        fail('round 2\'s A2plus or round 3\'s A3 is missing (work\\round2\\A2plus-best.pt, work\\round3\\A3-best.pt): send Claude '
             'this message.')
    models.update({'A2plus': R2 / 'A2plus-best.pt', 'A3': R3DIR / 'A3-best.pt'})
    EP_ = R5R['early_pass']
    STOCKOF = {}
    for head, early, wide, arch in R5R['paths']:
        models['TE%s-stock' % arch] = ('stock', arch)
        for nm in (head, early, wide):
            STOCKOF[nm] = 'TE%s-stock' % arch
        hb = WORK / 'runs' / head / 'best.pt'
        if hb.exists() and done('s5-' + head):
            models[head] = hb
            pe = WORK / 'runs' / head / ('ema-%02d.pt' % EP_)
            if pe.exists():
                models[early] = pe
        else:
            log('(no finished %s from step 5: checking without it)' % head)
        wb = WORK / 'runs' / wide / 'best.pt'
        if wb.exists() and done('s5-' + wide):
            models[wide] = wb
    c1 = R5R['paths'][0][0]
    if c1 in models:          # (reported only, never judged)
        c1a = R5R['paths'][0][3]
        p3 = WORK / 'runs' / c1 / 'ema-03.pt'
        if p3.exists():
            EXTRA[c1 + '-p3'] = p3
        EXTRA[c1 + '-mix50'] = ('mix', models[c1], c1a, 0.5)
        EXTRA[c1 + '-mix25'] = ('mix', models[c1], c1a, 0.25)
        EXTRA['A3+' + c1] = ('ens', models['A3'], models[c1])
    for nm in ['A3'] + [pth[0] for pth in R5R['paths']]:
        if nm in models:
            EXTRA[nm + '-flip'] = ('flip', models[nm])
    vp = WORK / 'veto.txt'
    if vp.exists():
        VETO = {l.strip().upper() for l in vp.read_text(encoding='utf-8').splitlines() if l.strip()}
        log('Ben\'s veto (work\\veto.txt): %s' % ', '.join(sorted(VETO)))
elif R4:
    if not (R2 / 'A2plus-best.pt').exists() or not (R3DIR / 'A3-best.pt').exists():
        fail('round 2\'s A2plus or round 3\'s A3 is missing (work\\round2\\A2plus-best.pt, work\\round3\\A3-best.pt): send Claude '
             'this message.')
    models['A2plus'] = R2 / 'A2plus-best.pt'
    models['A3'] = R3DIR / 'A3-best.pt'
    ER, EP_ = R4R['early']['run'], R4R['early']['pass']
    for name in R4R['candidates']:
        if name == ER + '-early':
            p = WORK / 'runs' / ER / ('ema-%02d.pt' % EP_)
            ok_ = p.exists() and done('s5-' + ER)
        else:
            p = WORK / 'runs' / name / 'best.pt'
            ok_ = p.exists() and done('s5-' + name)
        if ok_:
            models[name] = p
        else:
            log('(no finished %s from step 5: checking without it)' % name)
elif BASE:
    if not (R2 / 'A2plus-best.pt').exists():
        fail('round 2\'s %s is not in work\\round2 (A2plus-best.pt): send Claude this message.' % BASE)
    models[BASE] = R2 / 'A2plus-best.pt'
for name in (CFG['train']['runs'] if not R5 else ()):
    p = WORK / 'runs' / name / 'best.pt'
    if p.exists() and done('s5-' + name):
        models[name] = p
    else:
        log('(no finished %s from step 5: checking without it%s)' % (name, '; the replication of %s still runs' % BASE if BASE else ''))
NEW = ([n for pth in R5R['paths'] for n in pth[:3] if n in models] if R5 else
       [n for n in models if n not in ('stock', BASE)] if not R4 else [n for n in R4R['candidates'] if n in models])
nets = {k: build_net(v).to(dev).eval() for k, v in models.items()}
log('Checking %s on: %s, on %s (a few minutes each, a line after each set)' % (', '.join(models), '; '.join(
    '%s %s, crops %d' % (g, ', '.join('%s %d' % (k, len(v)) for k, v in G[g]['sets'].items()), len(G[g]['crops'])) for g in G), dev))
CUTS = (0.3, 0.5, 0.7)
FD = H['false_dilate']


def per_photo(net, name, sets_, crops_, what):
    """Every check photo's numbers for one model: {set: {measure: array}}."""
    out = {}
    for k, ids in sets_.items():
        t0 = time.time()
        m = {'iou': [], 'bf': [], 'found': [], 'false': [], 'pband': [], 'lband': [], 'share': []}
        for c in CUTS:
            m['iou@%g' % c], m['found@%g' % c] = [], []
        for s in range(0, len(ids), 32):
            b = ids[s:s + 32]
            for iid, y in zip(b, maps(net, [load_prep(i)[0] for i in b], dev)):
                L = down(load_label(iid))
                P_ = strays(y >= 0.5)
                m['iou'].append(iou(P_, L))
                m['bf'].append(boundary_f(P_, L) if k in ('subjects', 'people') else 0.0)
                m['found'].append(m['iou'][-1] >= 0.5)
                m['false'].append((P_ & ~dilate(L, FD)).mean() >= 0.01)
                m['pband'].append(band(P_.mean()))
                m['lband'].append(band(L.mean()))
                m['share'].append(float(P_.mean()))
                for c in CUTS:
                    v = iou(strays(y >= c), L)
                    m['iou@%g' % c].append(v)
                    m['found@%g' % c].append(v >= 0.5)
        out[k] = {a: np.array(v, float) for a, v in m.items()}
        if ids:
            log('   %s: %s %s done (%d photos, %.0f s)' % (name, what, k, len(ids), time.time() - t0))
    fl, pb = [], []
    for s in range(0, len(crops_), 32):
        b = crops_[s:s + 32]
        for y in maps(net, [crop_img(load_prep(c[0])[0], *c[1:]) for c in b], dev):
            P_ = strays(y >= 0.5)
            fl.append(P_.mean() >= 0.01)
            pb.append(band(P_.mean()))
    out['crops'] = {'false': np.array(fl, float), 'pband': np.array(pb, float)}
    return out


CDIR = WORK / 'cache6'
CDIR.mkdir(exist_ok=True)


def cached(spec, net, name, sets_, crops_, what):
    """per_photo, kept by the model's weights fingerprint and the exact photos (round 5: a second step 6 is quick and gives
    identical numbers)."""
    if not R5:
        return per_photo(net, name, sets_, crops_, what)
    h = hashlib.sha256(json.dumps([fingerprint(spec), what, CFG['side'], INP, {k: list(v) for k, v in sets_.items()},
                                   [list(c) for c in crops_]]).encode()).hexdigest()[:24]
    cp = CDIR / (h + '.npz')
    if cp.exists():
        with np.load(cp) as z:
            out = {}
            for key in z.files:
                k, a = key.split('|', 1)
                out.setdefault(k, {})[a] = z[key]
        log('   %s: %s (kept from an earlier run)' % (name, what))
        return out
    out = per_photo(net, name, sets_, crops_, what)
    np.savez(CDIR / (h + '.tmp.npz'), **{'%s|%s' % (k, a): v for k, d in out.items() for a, v in d.items()})
    (CDIR / (h + '.tmp.npz')).replace(cp)
    return out


P = {g: {n: cached(models[n], net, n, G[g]['sets'], G[g]['crops'], g) for n, net in nets.items()} for g in G}
PA = {g: {n: cached(models[n], net, n, {k: v for k, v in G[g]['aside'].items() if v}, G[g]['crops_aside'], g + ' set-apart')
          for n, net in nets.items()} for g in G}
for e, spec in EXTRA.items():          # (round 5, reported only: one at a time, then let go)
    enet = build_net(spec).to(dev).eval()
    for g in G:
        P[g][e] = cached(spec, enet, e, G[g]['sets'], G[g]['crops'], g)
    del enet
    if dev.type == 'cuda':
        torch.cuda.empty_cache()
rng = np.random.default_rng(1)
NB = RULE['bootstrap']


def ci(d):
    """Mean of a paired difference and its 95% paired-bootstrap interval (round 5: the draws seeded by the differences
    themselves, so the same two models on the same photos always give the same interval)."""
    if len(d) == 0:
        return (float('nan'),) * 3
    r_ = np.random.default_rng(zlib.crc32(np.ascontiguousarray(d, dtype=np.float64).tobytes())) if R5 else rng
    idx = r_.integers(0, len(d), (NB, len(d)))
    bs = d[idx].mean(axis=1)
    return float(d.mean()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def diff(g, name, k, a, sel=None, base='stock'):
    d = P[g][name][k][a] - P[g][base][k][a]
    return ci(d if sel is None else d[sel])


def lines_for(g):
    """Round 2's rule, line by line: (set, measure, label, 'ge'/'le', threshold, mean or low end, text)."""
    S = G[g]['sets']
    L = [('subjects', 'bf', 'Subjects: outline', 'ge', RULE['outline_gain'], 'mean', '≥ +%.3f' % RULE['outline_gain']),
         ('subjects', 'iou', 'Subjects: overlap', 'ge', -RULE['overlap_loss'], 'mean', '≥ −%.3f' % RULE['overlap_loss']),
         ('small', 'found', 'Small subjects: found', 'ge', RULE['small_found_lower'], 'lo',
          '95%% interval\'s low end ≥ %+.1f points' % (100 * RULE['small_found_lower'])),
         ('small', 'iou', 'Small subjects: overlap', 'ge', -RULE['small_overlap_loss'], 'mean', '≥ −%.3f' % RULE['small_overlap_loss'])]
    rep = []
    (L if len(S['people']) >= H['people_rule_min'] else rep).append(
        ('people', 'iou', 'People: overlap', 'ge', -RULE['people_loss'], 'mean', '≥ −%.3f' % RULE['people_loss']))
    (L if len(G[g]['crops']) >= H['crops_rule_min'] else rep).append(
        ('crops', 'false', 'Empty crops: false subjects', 'le', RULE['crops_false_extra'], 'mean', '≤ stock + %.0f point' % (100 * RULE['crops_false_extra'])))
    if len(S['scenery']) >= H['scenery_rule_min']:
        L.append(('scenery', 'false', 'Scenery: false subjects', 'le', RULE['scenery_false_extra'], 'mean', '≤ stock + %.0f point' % (100 * RULE['scenery_false_extra'])))
    return L, rep


def vs_stock(g, title):
    """The vs-stock table for one group: report lines and {model: [(label, pass, mean, lo, hi)]}."""
    S = G[g]['sets']
    HAND = {k: np.array([sort.get(i, {}).get('kind') == 'held' for i in v]) for k, v in S.items()}
    LINES, REP = lines_for(g)
    out = ['## ' + title, '',
           'Photos (labelled with all their outlines, chosen without stock): ' + ', '.join(
               '%s %d (%d hand-checked)' % (k, len(v), int(HAND[k].sum())) for k, v in S.items()) + ', empty crops %d.' % len(G[g]['crops']),
           'Before the check detector set photos apart: ' + ', '.join('%s %d' % (k, len(v)) for k, v in G[g]['all'].items()) +
           ', empty crops %d.' % len(G[g]['crops_all']), '',
           '| Line | Stock | ' + ' | '.join('%s (difference, 95%% interval)' % n for n in models if n != 'stock') + ' | Rule |',
           '|---|---|' + '---|' * (len(models) - 1) + '---|']
    ver = {}
    for k, a, label, kind, thr, use, txt in LINES:
        st = float(P[g]['stock'][k][a].mean()) if len(P[g]['stock'][k][a]) else float('nan')
        hand = HAND.get(k)
        topped = hand is not None and len(hand) and not hand.all() and hand.any()
        cells = []
        for n in models:
            if n == 'stock':
                continue
            m, lo, hi = diff(g, n, k, a)
            v = m if use == 'mean' else lo
            good = len(P[g]['stock'][k][a]) > 0 and (v >= thr if kind == 'ge' else v <= thr)
            cell = '%+.4f (%+.4f to %+.4f) %s' % (m, lo, hi, 'pass' if good else '**fail**')
            if topped:
                hm, hlo, hhi = diff(g, n, k, a, hand)
                hgood = hhi >= thr if kind == 'ge' else hlo <= thr
                good = good and hgood
                worse = hhi < 0 if kind == 'ge' else hlo > 0
                cell += '; hand-checked %+.4f (%+.4f to %+.4f) %s' % (hm, hlo, hhi, 'reaches the line' if hgood else (
                    '**clearly worse than stock**' if worse else '**does not reach the line**'))
            ver.setdefault(n, []).append((label, bool(good), m, lo, hi))
            cells.append(cell)
        out.append('| %s (n %d) | %.4f | %s | %s |' % (label, len(P[g]['stock'][k][a]), st, ' | '.join(cells), txt))
    for k, a, label, kind, thr, use, txt in REP:
        n0 = len(P[g]['stock'][k][a])
        out += ['', '%s (%d photos, too few to be a rule: reported only): stock %.4f; %s.' % (
            label, n0, P[g]['stock'][k][a].mean() if n0 else float('nan'),
            '; '.join('%s %+.4f (%+.4f to %+.4f)' % ((n,) + diff(g, n, k, a)) for n in models if n != 'stock'))]
    if not S['scenery']:
        out += ['', 'Scenery: no photos in these checks (Open Images\' outlined photos have no true landscapes; empty crops '
                'stand in for them, and Ben\'s 24 photos include landscapes).']
    elif len(S['scenery']) < H['scenery_rule_min']:
        out += ['', 'Scenery (%d photos, under %d: reported, not a rule): false subjects stock %.3f; %s.' % (
            len(S['scenery']), H['scenery_rule_min'], P[g]['stock']['scenery']['false'].mean() if S['scenery'] else float('nan'),
            '; '.join('%s %+.3f (%+.3f to %+.3f)' % ((n,) + diff(g, n, 'scenery', 'false')) for n in models if n != 'stock'))]
    out += ['', '- People, outline (reported): stock %.4f; %s' % (
        P[g]['stock']['people']['bf'].mean() if S['people'] else float('nan'),
        '; '.join('%s %+.4f (%+.4f to %+.4f)' % ((n,) + diff(g, n, 'people', 'bf')) for n in models if n != 'stock'))]
    ag = np.array([float(sort.get(i, {}).get('stock_iou') or 0) >= 0.85 for i in S['subjects']], bool)
    for nm, sel in (('where stock already agrees with the outline', ag), ('where it does not', ~ag)):
        out.append('- Subjects %s (n %d): outline %s; overlap %s' % (nm, int(sel.sum()),
                   '; '.join('%s %+.4f' % (n, diff(g, n, 'subjects', 'bf', sel)[0]) for n in models if n != 'stock'),
                   '; '.join('%s %+.4f' % (n, diff(g, n, 'subjects', 'iou', sel)[0]) for n in models if n != 'stock')))
    sf = P[g]['stock']['small']['found'] > 0.5
    for nm, sel in (('where stock already finds it', sf), ('where it does not', ~sf)):
        out.append('- Small subjects %s (n %d): found %s' % (nm, int(sel.sum()), '; '.join(
            '%s %+.3f' % (n, diff(g, n, 'small', 'found', sel)[0]) for n in models if n != 'stock')))
    for n, v in ver.items():
        out.append('- **%s** vs stock: %s' % (n, 'passes every line' if all(x[1] for x in v) else 'does not pass: ' + '; '.join(
            l for l, ok, *_ in v if not ok)))
    return out, ver


def paired(g, a, b):
    """a minus b, photo by photo, on group g: {key: (mean, lo, hi)}."""
    return {'subjects_bf': diff(g, a, 'subjects', 'bf', base=b), 'subjects_iou': diff(g, a, 'subjects', 'iou', base=b),
            'small_found': diff(g, a, 'small', 'found', base=b), 'small_iou': diff(g, a, 'small', 'iou', base=b),
            'people_iou': diff(g, a, 'people', 'iou', base=b), 'people_bf': diff(g, a, 'people', 'bf', base=b),
            'crops_false': diff(g, a, 'crops', 'false', base=b)}


PNAMES = {'subjects_bf': 'Subjects: outline', 'subjects_iou': 'Subjects: overlap', 'small_found': 'Small subjects: found',
          'small_iou': 'Small subjects: overlap', 'people_iou': 'People: overlap', 'people_bf': 'People: outline',
          'crops_false': 'Empty crops: false subjects'}

RL = ['# Subject model, round %d: check report' % (5 if R5 else 4 if R4 else 3 if R3 else 2), '']
R = {'models': list(models)}
fresh_lines, fresh_ver = vs_stock('fresh', 'Fresh checks vs stock (photos round 2 never used: these decide)' if R3 else 'Checks vs stock')
decision, why = 'stock', []
NOT_FINAL, NEXT = False, None
if R5:
    decision = BASE
    gd = R5R['guards']
    few_people = len(G['fresh']['sets']['people']) < H['people_rule_min']
    HANDS = np.array([sort.get(i, {}).get('kind') == 'held' for i in G['seen']['sets']['small']], bool)
    KA = {'subjects_bf': ('subjects', 'bf', 'ge'), 'subjects_iou': ('subjects', 'iou', 'ge'), 'small_found': ('small', 'found', 'ge'),
          'small_iou': ('small', 'iou', 'ge'), 'people_iou': ('people', 'iou', 'ge'), 'people_bf': ('people', 'bf', 'ge'),
          'crops_false': ('crops', 'false', 'le')}
    V2 = {l[2]: (l[0], l[1], l[3]) for l in lines_for('fresh')[0]}          # (round 2's lines vs stock, by label)

    def hist_paste(n):
        """The pasted 1% line on validation: the model's own pass (early: its pass; else the kept weights) and its run's start."""
        run_, ep_ = (n[:-len('-early')], EP_) if n.endswith('-early') else (n, 'avg')
        hp = WORK / 'runs' / run_ / 'history.json'
        pa = p0 = None
        if hp.exists():
            for h_ in json.load(open(hp)):
                if h_.get('epoch') == ep_:
                    pa = (h_.get('paste') or {}).get('0.01')
                if h_.get('epoch') == 0:
                    p0 = (h_.get('paste') or {}).get('0.01')
        return pa, p0, ep_

    def worse_than_stock(n, g_, k, a, kind, sel=None):
        """A line training made clearly worse: the candidate minus its own stock model, paired, wholly on the worse side."""
        m, lo, hi = diff(g_, n, k, a, sel, base=STOCKOF[n])
        return (hi < 0) if kind == 'ge' else (lo > 0), (m, lo, hi)

    def judge5(n):
        d = paired('fresh', n, BASE)
        pr_o = d['subjects_bf'][0] >= R5R['beat_outline'] and d['subjects_bf'][1] > 0
        pr_s = d['small_found'][0] >= R5R['beat_small_found'] and d['small_found'][1] > 0
        G5 = []          # (label, ok, kind of failure or '', the line vs stock)
        def add(label, ok, g_, k, a, kind, sel=None):
            if ok:
                G5.append((label, True, '', None))
            else:
                w, v = worse_than_stock(n, g_, k, a, kind, sel)
                G5.append((label, False, 'worse' if w else 'short', v))
        add('Subjects: outline vs %s' % BASE, d['subjects_bf'][0] >= gd['subjects_bf'] or pr_o, 'fresh', 'subjects', 'bf', 'ge')
        add('Subjects: overlap vs %s' % BASE, d['subjects_iou'][0] >= gd['subjects_iou'], 'fresh', 'subjects', 'iou', 'ge')
        add('Small subjects: found vs %s (low end)' % BASE, d['small_found'][1] >= gd['small_found_lo'], 'fresh', 'small', 'found', 'ge')
        add('Small subjects: overlap vs %s' % BASE, d['small_iou'][0] >= gd['small_iou'], 'fresh', 'small', 'iou', 'ge')
        add('People: overlap vs %s' % BASE, d['people_iou'][0] >= gd['people_iou'] or few_people, 'fresh', 'people', 'iou', 'ge')
        add('People: outline vs %s' % BASE, d['people_bf'][0] >= gd['people_bf'] or few_people, 'fresh', 'people', 'bf', 'ge')
        add('Empty crops: false subjects vs %s' % BASE, d['crops_false'][0] <= gd['crops_false'], 'fresh', 'crops', 'false', 'le')
        ca = diff('fresh', n, 'crops', 'false', base='A2plus')
        add('Empty crops: false subjects vs A2plus ≤ +%.0f point (%+.4f)' % (100 * R5R['crops_false_vs_A2plus'], ca[0]),
            ca[0] <= R5R['crops_false_vs_A2plus'], 'fresh', 'crops', 'false', 'le')
        hs = diff('seen', n, 'small', 'found', HANDS, base=BASE) if HANDS.any() else (float('nan'),) * 3
        add('Round 2\'s %d hand-checked small subjects: found vs %s ≥ %+.0f points (%+.4f)' % (
            int(HANDS.sum()), BASE, 100 * R5R['hand_small_found_vs_benchmark'], hs[0]),
            bool(HANDS.any()) and hs[0] >= R5R['hand_small_found_vs_benchmark'], 'seen', 'small', 'found', 'ge', HANDS)
        pa, p0, ep_ = hist_paste(n)
        okp = pa is not None and pa >= R5R['paste_1pct_min']
        G5.append(('Pasted 1%% subjects found ≥ %.2f (validation, %s: %s; its run\'s start %s)' % (
            R5R['paste_1pct_min'], 'pass %s' % ep_ if ep_ != 'avg' else 'the kept weights', pa, p0), okp, '' if okp else (
            'worse' if (pa is not None and p0 is not None and pa < p0) else 'short'), None))
        for label, good, *_ in fresh_ver.get(n, []):
            k, a_, kind = V2[label]
            add('Round 2\'s rule vs stock TE0: %s' % label, good, 'fresh', k, a_, kind)
        return d, pr_o, pr_s, G5

    J = {n: judge5(n) for n in NEW}
    res = {n: (J[n][1] or J[n][2], all(x[1] for x in J[n][3]), {x[2] for x in J[n][3] if not x[1]}) for n in J}
    dec, judged, route, NEXT = s6_routes.route5([pth[:3] for pth in R5R['paths']], res, VETO)
    NOT_FINAL = NEXT is not None
    decision = dec or BASE
    why += route
    PT = []
    for n in NEW:
        d, pr_o, pr_s, guards = J[n]
        st = STOCKOF[n]
        PT += ['', '## %s minus %s, photo by photo, on the fresh checks (%s)' % (n, BASE, 'judged' if n in judged else
                                                                               'reported, not judged'), '',
               '| Line | %s | %s − %s (95%% interval) | %s − %s (its own start) | Needed |' % (BASE, n, BASE, n, st), '|---|---|---|---|---|']
        for key in ('subjects_iou', 'subjects_bf', 'small_found', 'small_iou', 'people_iou', 'people_bf', 'crops_false'):
            k_, a_, _ = KA[key]
            need = {'subjects_bf': 'low end > 0 (or the small line); else ≥ %+.3f' % gd['subjects_bf'],
                    'small_found': 'low end > 0 (or the outline line); low end ≥ %+.0f points' % (100 * gd['small_found_lo']),
                    'subjects_iou': '≥ %+.3f' % gd['subjects_iou'], 'small_iou': '≥ %+.3f' % gd['small_iou'],
                    'people_iou': '≥ %+.3f' % gd['people_iou'], 'people_bf': '≥ %+.3f' % gd['people_bf'],
                    'crops_false': '≤ %+.0f point' % (100 * gd['crops_false'])}[key]
            PT.append('| %s (n %d) | %.4f | %+.4f (%+.4f to %+.4f) | %+.4f (%+.4f to %+.4f) | %s |' % (
                PNAMES[key], len(P['fresh'][BASE][k_][a_]), P['fresh'][BASE][k_][a_].mean() if len(P['fresh'][BASE][k_][a_]) else float('nan'),
                *d[key], *diff('fresh', n, k_, a_, base=st), need))
        PT += ['', '- Better than %s: %s' % (BASE, 'yes, on %s' % ' and '.join(
                   x for x, y in (('the outline', pr_o), ('small subjects found', pr_s)) if y) if (pr_o or pr_s) else 'not shown'),
               '- Guards: ' + ('all hold' if all(x[1] for x in guards) else 'not held: ' + '; '.join(
                   '%s (%s)' % (x[0], 'training made it clearly worse than %s: %+.4f (%+.4f to %+.4f)' % ((st,) + x[3]) if x[2] == 'worse' and x[3]
                                 else 'worse than its run\'s start' if x[2] == 'worse' else
                                 'short, not clearly worse than %s%s' % (st, ': %+.4f (%+.4f to %+.4f)' % x[3] if x[3] else ''))
                   for x in guards if not x[1])) + (
                   ' (only %d fresh people photos, under %d: the people lines are reported, not guards)' % (
                       len(G['fresh']['sets']['people']), H['people_rule_min']) if few_people else '')]
        bj = WORK / 'runs' / (n[:-len('-early')] if n.endswith('-early') else n) / 'batch.json'
        if bj.exists():
            b_ = json.load(open(bj))
            if b_.get('batch') != b_.get('planned'):
                PT.append('- Trained with batch %s instead of %s (the card\'s memory): a somewhat stronger fine-tune than planned.' % (
                    b_.get('batch'), b_.get('planned')))
        R.setdefault('paired', {})[n] = {k: {'mean': v[0], 'lo': v[1], 'hi': v[2]} for k, v in d.items()}
        R.setdefault('guards', {})[n] = {x[0]: bool(x[1]) for x in guards}
    R['judged'], R['not_final'], R['next_train'] = judged, NOT_FINAL, NEXT
    nt = RESULTS / 'next-train.txt'
    if NOT_FINAL:
        nt.write_text(NEXT + '\n', encoding='utf-8')
    elif nt.exists():
        nt.unlink()
    seen_lines, _ = vs_stock('seen', 'Round 2\'s checks ("seen": reported only, except the hand-checked small guard)')
    ST = ['- Seen checks, %s minus %s (reported): ' % (n, BASE) + '; '.join(
        '%s %+.4f (%+.4f to %+.4f)' % ((PNAMES[k],) + v) for k, v in paired('seen', n, BASE).items()) for n in NEW]
    EX = ['## Reported only, never judged: C1 after pass 3, C1 blended back toward stock TE4, flip-averaged and averaged maps', '',
          '| Model | ' + ' | '.join(PNAMES[k] for k in ('subjects_iou', 'subjects_bf', 'small_found', 'people_iou', 'crops_false')) + ' |',
          '|---|---|---|---|---|---|']
    for e in EXTRA:
        dd = paired('fresh', e, BASE)
        EX.append('| %s − %s | %s |' % (e, BASE, ' | '.join('%+.4f (%+.4f to %+.4f)' % dd[k] for k in (
            'subjects_iou', 'subjects_bf', 'small_found', 'people_iou', 'crops_false'))))
    head = (['**NOT FINAL. %s must be trained first: run 5b-train-wide.bat, then 6-results.bat again** (the numbers above it '
             'stay the same; the second run takes about an hour: only the new model is measured, then the exports).' % NEXT, ''] if NOT_FINAL else [])
    RL += head + ['**Decision: %s.** %s' % ('not yet (see above)' if NOT_FINAL else
                                           '%s stays (no round-5 model ships)' % BASE if decision == BASE else decision + ' ships in the app',
                                           ' '.join(why)),
                  '(Decided by the routes fixed before the run; Ben has the final call after the sheets, his iPad and his 24 photos, '
                  'which can veto: a vetoed path hands over to the next one, work\\veto.txt.)', '',
                  'A model truly no better than %s passes one of the two "better" lines about 1 time in 20; with up to four models '
                  'judged, about 1 time in 10 at most (the guards make it rarer). Overlap first: a candidate can win the outline '
                  'line on its stock start alone.' % BASE, '']
    RL += PT + [''] + fresh_lines + [''] + seen_lines + ([''] + ST if ST else []) + [''] + EX + ['']
elif R4:
    decision = BASE
    rep_ok = BASE in fresh_ver and all(x[1] for x in fresh_ver[BASE])
    why.append('%s (the benchmark) vs stock on the fresh checks: %s (reported).' % (BASE, 'passes every line' if rep_ok else 'does not pass every line'))
    gd = R3R['guards']
    few_people = len(G['fresh']['sets']['people']) < H['people_rule_min']
    HANDS = np.array([sort.get(i, {}).get('kind') == 'held' for i in G['seen']['sets']['small']], bool)

    def judge(n):
        d = paired('fresh', n, BASE)
        pr_o = d['subjects_bf'][0] >= R4R['beat_outline'] and d['subjects_bf'][1] > 0
        pr_s = d['small_found'][0] >= R4R['beat_small_found'] and d['small_found'][1] > 0
        guards = [('Subjects: outline', d['subjects_bf'][0] >= gd['subjects_bf'] or pr_o),
                  ('Subjects: overlap', d['subjects_iou'][0] >= gd['subjects_iou']),
                  ('Small subjects: found (low end)', d['small_found'][1] >= gd['small_found_lo']),
                  ('Small subjects: overlap', d['small_iou'][0] >= gd['small_iou']),
                  ('People: overlap', d['people_iou'][0] >= gd['people_iou'] or few_people),
                  ('People: outline', d['people_bf'][0] >= gd['people_bf'] or few_people),
                  ('Empty crops: false subjects vs %s' % BASE, d['crops_false'][0] <= gd['crops_false'])]
        ca = diff('fresh', n, 'crops', 'false', base='A2plus')
        guards.append(('Empty crops: false subjects vs A2plus ≤ +%.0f point (%+.4f)' % (100 * R4R['crops_false_vs_A2plus'], ca[0]),
                       ca[0] <= R4R['crops_false_vs_A2plus']))
        run_, ep_ = (ER, EP_) if n == ER + '-early' else (n, 'avg')
        pa = None
        hp = WORK / 'runs' / run_ / 'history.json'
        if hp.exists():
            for h_ in json.load(open(hp)):
                if h_.get('epoch') == ep_:
                    pa = (h_.get('paste') or {}).get('0.01')
        guards.append(('Pasted 1%% subjects found ≥ %.2f (validation, %s: %s)' % (
            R4R['paste_1pct_min'], 'pass %s' % ep_ if ep_ != 'avg' else 'the kept weights', pa), pa is not None and pa >= R4R['paste_1pct_min']))
        vs_ok = n in fresh_ver and all(x[1] for x in fresh_ver[n])
        guards.append(('Round 2\'s rule vs stock on the fresh checks', vs_ok))
        return d, pr_o, pr_s, guards

    J = {n: judge(n) for n in NEW}
    decision, judged, route = s6_routes.route4({n: (J[n][1] or J[n][2], all(x[1] for x in J[n][3])) for n in J}, BASE)
    why += route
    PT = []
    for n in NEW:
        d, pr_o, pr_s, guards = J[n]
        PT += ['', '## %s minus %s, photo by photo, on the fresh checks (%s)' % (n, BASE, 'judged' if n in judged else
                                                                               'reported, not judged'), '',
               '| Line | %s | %s − %s (95%% interval) | Needed |' % (BASE, n, BASE), '|---|---|---|---|']
        for key, nm in PNAMES.items():
            k_, a_ = {'subjects_bf': ('subjects', 'bf'), 'subjects_iou': ('subjects', 'iou'), 'small_found': ('small', 'found'),
                      'small_iou': ('small', 'iou'), 'people_iou': ('people', 'iou'), 'people_bf': ('people', 'bf'),
                      'crops_false': ('crops', 'false')}[key]
            need = {'subjects_bf': 'low end > 0 (or the small line); else ≥ %+.3f' % gd['subjects_bf'],
                    'small_found': 'low end > 0 (or the outline line); low end ≥ %+.0f points' % (100 * gd['small_found_lo']),
                    'subjects_iou': '≥ %+.3f' % gd['subjects_iou'], 'small_iou': '≥ %+.3f' % gd['small_iou'],
                    'people_iou': '≥ %+.3f' % gd['people_iou'], 'people_bf': '≥ %+.3f' % gd['people_bf'],
                    'crops_false': '≤ %+.0f point' % (100 * gd['crops_false'])}[key]
            PT.append('| %s (n %d) | %.4f | %+.4f (%+.4f to %+.4f) | %s |' % (
                nm, len(P['fresh'][BASE][k_][a_]), P['fresh'][BASE][k_][a_].mean() if len(P['fresh'][BASE][k_][a_]) else float('nan'),
                *d[key], need))
        hs = diff('seen', n, 'small', 'found', HANDS, base=BASE) if HANDS.any() else (float('nan'),) * 3
        ag = np.array([float(sort.get(i, {}).get('stock_iou') or 0) >= 0.85 for i in G['fresh']['sets']['subjects']], bool)
        sf = P['fresh']['stock']['small']['found'] > 0.5
        PT += ['', '- Better than %s: %s' % (BASE, 'yes, on %s' % ' and '.join(
                   x for x, y in (('the outline', pr_o), ('small subjects found', pr_s)) if y) if (pr_o or pr_s) else 'not shown'),
               '- Guards: ' + ('all hold' if all(x[1] for x in guards) else 'not held: ' + '; '.join(x for x, y in guards if not y)) + (
                   ' (only %d fresh people photos, under %d: the people lines are reported, not guards)' % (
                       len(G['fresh']['sets']['people']), H['people_rule_min']) if few_people else ''),
               '- Beside the deciding small line (reported): round 2\'s hand-checked small subjects (n %d), found %+.4f (%+.4f to %+.4f): '
               'the fresh small set is all training-pool photos, the population the disagree photos come from.' % ((int(HANDS.sum()),) + hs),
               '- Where stock was right / wrong (reported): subjects outline %+.4f (%+.4f to %+.4f) / %+.4f (%+.4f to %+.4f); '
               'small found %+.4f (%+.4f to %+.4f) / %+.4f (%+.4f to %+.4f)' % (
                   diff('fresh', n, 'subjects', 'bf', ag, base=BASE) + diff('fresh', n, 'subjects', 'bf', ~ag, base=BASE) +
                   diff('fresh', n, 'small', 'found', sf, base=BASE) + diff('fresh', n, 'small', 'found', ~sf, base=BASE))]
        R.setdefault('paired', {})[n] = {k: {'mean': v[0], 'lo': v[1], 'hi': v[2]} for k, v in d.items()}
        R.setdefault('guards', {})[n] = {x: bool(y) for x, y in guards}
    R['judged'] = judged
    seen_lines, _ = vs_stock('seen', 'Round 2\'s checks ("seen": reported only, they decide nothing)')
    ST = ['- Seen checks, %s minus %s (reported): ' % (n, BASE) + '; '.join(
        '%s %+.4f (%+.4f to %+.4f)' % ((PNAMES[k],) + v) for k, v in paired('seen', n, BASE).items()) for n in NEW]
    RL += ['**Decision: %s.** %s' % ('%s stays (no round-4 model ships)' % BASE if decision == BASE else decision + ' ships in the app',
                                   ' '.join(why)),
           '(Decided by the routes fixed before the run; Ben has the final call after the sheets and his 24 photos, which can veto.)', '',
           'A model truly no better than %s passes one of the two "better" lines about 1 time in 20; with up to two models '
           'judged, about 1 time in 10 at most (the guards make it rarer).' % BASE, '']
    RL += PT + [''] + fresh_lines + [''] + seen_lines + ([''] + ST if ST else []) + ['']
elif R3:
    # (1) the replication
    rep_ok, rep_note = False, ''
    if BASE in fresh_ver:
        v = fresh_ver[BASE]
        fails = [x for x in v if not x[1]]
        if not fails:
            rep_ok = True
        elif len(fails) == 1 and fails[0][0] == 'Subjects: outline' and fails[0][3] >= R3R['replication_outline_low']:
            rep_ok, rep_note = True, ' (its outline gain is under +0.020, but its 95%% low end %+.4f is at least %+.3f: forgiven, as decided)' % (
                fails[0][3], R3R['replication_outline_low'])
    decision = BASE if rep_ok else 'stock'
    why.append('Replication: %s %s on the fresh checks%s.' % (
        BASE, 'holds up' if rep_ok else '**does not hold up**', rep_note) + ('' if rep_ok else ' Neither trained model ships; the app keeps today\'s model.'))
    # (2) A3 vs A2plus
    PT = []
    for n in NEW:
        d = paired('fresh', n, BASE)
        pr_o = d['subjects_bf'][0] >= R3R['beat_outline'] and d['subjects_bf'][1] > 0
        pr_s = d['small_found'][0] >= R3R['beat_small_found'] and d['small_found'][1] > 0
        gd = R3R['guards']
        few_people = len(G['fresh']['sets']['people']) < H['people_rule_min']
        guards = [('Subjects: outline', d['subjects_bf'][0] >= gd['subjects_bf'] or pr_o),
                  ('Subjects: overlap', d['subjects_iou'][0] >= gd['subjects_iou']),
                  ('Small subjects: found (low end)', d['small_found'][1] >= gd['small_found_lo']),
                  ('Small subjects: overlap', d['small_iou'][0] >= gd['small_iou']),
                  # (with too few people photos to tell a difference, as round 2's rule has it, the two people guards are
                  # reported, not guards: said in the report)
                  ('People: overlap', d['people_iou'][0] >= gd['people_iou'] or few_people),
                  ('People: outline', d['people_bf'][0] >= gd['people_bf'] or few_people),
                  ('Empty crops: false subjects', d['crops_false'][0] <= gd['crops_false'])]
        hp = WORK / 'runs' / n / 'history.json'
        pa = None
        if hp.exists():
            h = json.load(open(hp))
            pa = (h[-1].get('paste') or {}).get('0.01')
        guards.append(('Pasted 1%% subjects found ≥ %.2f (validation: %s)' % (R3R['paste_1pct_min'], pa), pa is not None and pa >= R3R['paste_1pct_min']))
        vs_ok = n in fresh_ver and all(x[1] for x in fresh_ver[n])
        beats = pr_o or pr_s
        ok = rep_ok and vs_ok and beats and all(x[1] for x in guards)
        PT += ['', '## %s minus %s, photo by photo, on the fresh checks (this decides)' % (n, BASE), '',
               '| Line | %s | %s − %s (95%% interval) | Needed |' % (BASE, n, BASE), '|---|---|---|---|']
        for key, nm in PNAMES.items():
            k_, a_ = {'subjects_bf': ('subjects', 'bf'), 'subjects_iou': ('subjects', 'iou'), 'small_found': ('small', 'found'),
                      'small_iou': ('small', 'iou'), 'people_iou': ('people', 'iou'), 'people_bf': ('people', 'bf'),
                      'crops_false': ('crops', 'false')}[key]
            need = {'subjects_bf': '≥ +%.3f, low end > 0 (or the small line); else ≥ %+.3f' % (R3R['beat_outline'], gd['subjects_bf']),
                    'small_found': '≥ +%.0f points, low end > 0 (or the outline line); low end ≥ %+.0f points' % (
                        100 * R3R['beat_small_found'], 100 * gd['small_found_lo']),
                    'subjects_iou': '≥ %+.3f' % gd['subjects_iou'], 'small_iou': '≥ %+.3f' % gd['small_iou'],
                    'people_iou': '≥ %+.3f' % gd['people_iou'], 'people_bf': '≥ %+.3f' % gd['people_bf'],
                    'crops_false': '≤ %+.0f point' % (100 * gd['crops_false'])}[key]
            PT.append('| %s (n %d) | %.4f | %+.4f (%+.4f to %+.4f) | %s |' % (
                nm, len(P['fresh'][BASE][k_][a_]), P['fresh'][BASE][k_][a_].mean() if len(P['fresh'][BASE][k_][a_]) else float('nan'),
                *d[key], need))
        PT += ['', '- Better than %s: %s' % (BASE, 'yes, on %s' % ' and '.join(
                   x for x, y in (('the outline', pr_o), ('small subjects found', pr_s)) if y) if beats else 'not shown'),
               '- Guards: ' + ('all hold' if all(x[1] for x in guards) else 'not held: ' + '; '.join(x for x, y in guards if not y)) + (
                   ' (only %d fresh people photos, under %d: the people lines are reported, not guards)' % (
                       len(G['fresh']['sets']['people']), H['people_rule_min']) if few_people else ''),
               '- Round 2\'s rule vs stock on the fresh checks: %s' % ('passes' if vs_ok else 'does not pass')]
        R.setdefault('paired', {})[n] = {k: {'mean': v[0], 'lo': v[1], 'hi': v[2]} for k, v in d.items()}
        R.setdefault('guards', {})[n] = {x: bool(y) for x, y in guards}
        if ok:
            decision = n
        why.append('%s: %s.' % (n, 'replaces %s' % BASE if ok else 'does not replace %s (%s)' % (BASE, '; '.join(
            x for x, y in (('the replication failed', not rep_ok), ('it does not pass round 2\'s rule vs stock', not vs_ok),
                           ('it is not shown better than %s' % BASE, not beats),
                           ('a guard did not hold', not all(g_[1] for g_ in guards))) if y))))
    if not NEW:
        why.append('A3 was not trained (step 5 did not finish): only the replication was checked.')
    seen_lines, _ = vs_stock('seen', 'Round 2\'s checks ("seen": reported only, they decide nothing)')
    ST = []
    for n in NEW:
        d = paired('seen', n, BASE)
        ST.append('- Seen checks, %s minus %s (reported): ' % (n, BASE) + '; '.join(
            '%s %+.4f (%+.4f to %+.4f)' % ((PNAMES[k],) + v) for k, v in d.items()))
    RL += ['**Decision: %s.** %s' % ({'stock': 'today\'s model stays (neither trained model ships)'}.get(decision, decision + ' ships in the app'),
                                   ' '.join(why)),
           '(Decided by the rule fixed before the run; Ben has the final call after the sheets and his 24 photos, which can veto.)', '',
           'A model that is truly no better than %s passes this less than 1 time in 10 even with a lucky run; one truly better by '
           '+0.004 outline still loses about 3 times in 4: "not better" means "not shown better".' % BASE, '']
    RL += PT + [''] + fresh_lines + [''] + seen_lines + ([''] + ST if ST else []) + ['']
else:
    passing = [n for n, v in fresh_ver.items() if all(x[1] for x in v)]
    decision = max(passing, key=lambda n: diff('fresh', n, 'subjects', 'bf')[0]) if passing else 'stock'
    RL += fresh_lines + ['', '**Winner by the rule: %s** (Ben has the final call, after the sheets and his 24 photos).' % decision, '']

# reported, not rules (fresh checks)
g = 'fresh'
S = G[g]['sets']
RL += ['## Also measured on the fresh checks (reported, not rules)', '']
RL.append('- Small subjects, false subjects (map outside the outline ≥ 1%%): stock %.3f; %s' % (
    P[g]['stock']['small']['false'].mean(), '; '.join('%s %+.3f (%+.3f to %+.3f)' % ((n,) + diff(g, n, 'small', 'false')) for n in models if n != 'stock')))
na = {k: len(v) for k, v in G[g]['aside'].items()}
RL += ['- Set apart by the check detector (COCO Faster R-CNN, score ≥ %.1f; stock not used): small %d, subjects %d, scenery %d, empty crops %d.' % (
    s6_detect.THR, na['small'], na['subjects'], na['scenery'], len(G[g]['crops_aside']))]
for k, a, what in (('small', 'found', 'the outlined small subject found'), ('small', 'false', 'something beyond the outline marked'),
                   ('subjects', 'iou', 'overlap'), ('crops', 'false', 'a subject marked in the crop')):
    n0 = len(PA[g]['stock'][k][a]) if k in PA[g]['stock'] else 0
    if n0:
        RL.append('   - set apart, %s, %s (n %d): stock %.3f; %s' % (k, what, n0, PA[g]['stock'][k][a].mean(), '; '.join(
            '%s %+.3f (%+.3f to %+.3f)' % ((n,) + ci(PA[g][n][k][a] - PA[g]['stock'][k][a])) for n in models if n != 'stock')))
grp = np.array([sort.get(i, {}).get('group', 'other') for i in S['subjects']])
RL += ['', '| Subjects by kind | n | stock overlap | ' + ' | '.join('%s outline / overlap' % n for n in models if n != 'stock') + ' |',
       '|---|---|---|' + '---|' * (len(models) - 1)]
for gg in sorted(set(grp)):
    sel = grp == gg
    RL.append('| %s | %d | %.3f | %s |' % (gg, int(sel.sum()), P[g]['stock']['subjects']['iou'][sel].mean(),
              ' | '.join('%+.3f / %+.3f' % (diff(g, n, 'subjects', 'bf', sel)[0], diff(g, n, 'subjects', 'iou', sel)[0]) for n in models if n != 'stock')))
RL += ['', '| Cut-off (app: 0.5) | ' + ' | '.join('%s small found / subjects overlap' % n for n in models) + ' |', '|---|' + '---|' * len(models)]
for c in CUTS:
    RL.append('| %g | %s |' % (c, ' | '.join('%.3f / %.4f' % (P[g][n]['small']['found@%g' % c].mean(), P[g][n]['subjects']['iou@%g' % c].mean()) for n in models)))
RL += ['', 'The app\'s decision (no clear subject < 1%, crop offer 1-5%, subject): photos where it differs from the outline\'s, and from stock\'s:', '']
for n in models:
    wrong = sum(int((P[g][n][k]['pband'] != P[g][n][k]['lband']).sum()) for k in ('subjects', 'small', 'scenery'))
    ch = sum(int((P[g][n][k]['pband'] != P[g]['stock'][k]['pband']).sum()) for k in KINDS) + int((P[g][n]['crops']['pband'] != P[g]['stock']['crops']['pband']).sum())
    RL.append('- %s: differs from the outline\'s on %d of %d; from stock\'s on %d' % (n, wrong, sum(len(S[k]) for k in ('subjects', 'small', 'scenery')), ch))
log('\n'.join(RL[2:]))

# exports, as the app needs them
for d in ('models', 'sheets'):
    for p in (RESULTS / d).glob('*') if (RESULTS / d).exists() else ():
        try:
            p.unlink()
        except OSError:      # (a file open elsewhere is written over, or left)
            pass
mdir = RESULTS / 'models'
mdir.mkdir(exist_ok=True)


class Out(torch.nn.Module):
    def __init__(s, n):
        super().__init__()
        s.n = n

    def forward(s, x):
        return s.n(x)[0]


def int8_store(src, dst):
    """Weights of 3 or more dims stored int8 per output channel (Cast + Mul back to float32 at load); 2-D ones (the
    DFT step's matrices) kept float32; the rest (biases, batch-norm) float16. The arithmetic stays float32."""
    import onnx
    from onnx import numpy_helper, helper, TensorProto
    m = onnx.load(src)
    g_ = m.graph
    new, pre = [], []
    for t in g_.initializer:
        a = numpy_helper.to_array(t)
        if a.dtype == np.float32 and a.ndim >= 3 and a.size >= 1024:
            flat = a.reshape(a.shape[0], -1)
            sc = np.maximum(np.abs(flat).max(axis=1), 1e-12) / 127.0
            q = np.clip(np.rint(flat / sc[:, None]), -127, 127).astype(np.int8).reshape(a.shape)
            new.append(numpy_helper.from_array(q, t.name + '_q8'))
            new.append(numpy_helper.from_array(sc.astype(np.float32).reshape([-1] + [1] * (a.ndim - 1)), t.name + '_sc'))
            pre.append(helper.make_node('Cast', [t.name + '_q8'], [t.name + '_f'], to=TensorProto.FLOAT))
            pre.append(helper.make_node('Mul', [t.name + '_f', t.name + '_sc'], [t.name]))
        elif a.dtype == np.float32 and a.ndim != 2 and a.size >= 16:
            h = numpy_helper.from_array(np.where(np.abs(a) < 1e-15, 0, a).astype(np.float16), t.name + '_f16')
            new.append(h)
            pre.append(helper.make_node('Cast', [h.name], [t.name], to=TensorProto.FLOAT))
        else:
            new.append(t)
    del g_.initializer[:]
    g_.initializer.extend(new)
    nodes = list(g_.node)
    del g_.node[:]
    g_.node.extend(pre + nodes)
    onnx.checker.check_model(m)
    onnx.save(m, dst)


import onnxruntime as ort
log('Exporting each model as the app needs it, then the sheets...')
chk = S['subjects'][:16]
R['export'] = {}
for name in nets:
    cpu = build_net(models[name]).eval()
    NI = cpu.inp          # (each model at its own input size: TE0 320, TE2 352, TE4 448)
    fp = WORK / ('export-%s-fp32.onnx' % name)
    x = torch.zeros(1, 3, NI, NI)
    with torch.no_grad():
        cpu(x)     # (one run first, so the edge step's constants are made before the export traces it)
    torch.onnx.export(Out(cpu).eval(), x, str(fp), input_names=['input'], output_names=['map'], opset_version=17, dynamo=False)
    try:
        import onnxslim
        slim = WORK / ('export-%s-slim.onnx' % name)
        onnxslim.slim(str(fp), str(slim))
        fp = slim
    except Exception as e:
        log('(onnxslim skipped for %s: %s)' % (name, e))
    dst = mdir / ('subject-%s-%d-w8.onnx' % (name, NI))
    int8_store(str(fp), str(dst))
    s = ort.InferenceSession(str(dst), providers=['CPUExecutionProvider'])
    flips, mx = 0, 0.0
    for iid in chk:
        img = load_prep(iid)[0]
        xx = np.asarray(Image.fromarray(img).resize((NI, NI), Image.BILINEAR), np.float32) / 255
        xx = ((xx - np.array(MEAN, np.float32)) / np.array(STD, np.float32)).transpose(2, 0, 1)[None]
        a = s.run(None, {'input': xx})[0][0, 0]
        with torch.no_grad():
            b = cpu(torch.from_numpy(xx))[0][0, 0].numpy()
        mx = max(mx, float(np.abs(a - b).max()))
        flips += int(((a >= 0.5) != (b >= 0.5)).sum())
    log('%s exported: %.2f MB; vs PyTorch on %d photos: max diff %.4f, %.3f%% of pixels change side' %
        (name, os.path.getsize(dst) / 1e6, len(chk), mx, 100 * flips / max(1, len(chk) * NI * NI)))
    R['export'][name] = {'mb': round(os.path.getsize(dst) / 1e6, 2), 'max_diff': mx, 'input': NI, 'file': dst.name}

if R5 and decision != BASE and not NOT_FINAL:
    # (reported) the shipping candidate and A3 as the app runs them: the exported files, ONNX Runtime, on the fresh
    # subjects and small subjects; then, for a TE4 candidate, the fresh photos downloaded again full size (as the app
    # squashes them), against A3 the same way
    log('Measuring %s and %s as the app\'s files on the fresh checks (on the processor: about 30-45 minutes)...' % (decision, BASE))
    OX = {}
    for name in (BASE, decision):
        sess = ort.InferenceSession(str(mdir / R['export'][name]['file']), providers=['CPUExecutionProvider'])
        NI = R['export'][name]['input']

        def omaps(imgs, sess=sess, NI=NI):
            xx = np.stack([np.asarray(Image.fromarray(im).resize((NI, NI), Image.BILINEAR), np.float32) / 255 for im in imgs])
            xx = ((xx - np.array(MEAN, np.float32)) / np.array(STD, np.float32)).transpose(0, 3, 1, 2)
            y = torch.from_numpy(np.concatenate([sess.run(None, {'input': xx[i:i + 1]})[0] for i in range(len(xx))]))
            if NI != INP:
                y = torch.nn.functional.interpolate(y, size=(INP, INP), mode='bilinear', align_corners=False)
            return y[:, 0].numpy()
        o = {}
        for k in ('subjects', 'small'):
            io_, bf_ = [], []
            for iid in G['fresh']['sets'][k]:
                L = down(load_label(iid))
                P_ = strays(omaps([load_prep(iid)[0]])[0] >= 0.5)
                io_.append(iou(P_, L))
                bf_.append(boundary_f(P_, L) if k == 'subjects' else 0.0)
            o[k] = {'iou': np.array(io_), 'bf': np.array(bf_), 'found': (np.array(io_) >= 0.5).astype(float)}
        OX[name] = o
    RL += ['', '## %s as the app\'s file (reported)' % decision, '',
           '- %s minus %s, both as exported files: subjects overlap %+.4f (%+.4f to %+.4f), outline %+.4f (%+.4f to %+.4f), small '
           'found %+.4f (%+.4f to %+.4f); in PyTorch the same lines were %+.4f, %+.4f, %+.4f.' % (
               decision, BASE, *ci(OX[decision]['subjects']['iou'] - OX[BASE]['subjects']['iou']),
               *ci(OX[decision]['subjects']['bf'] - OX[BASE]['subjects']['bf']), *ci(OX[decision]['small']['found'] - OX[BASE]['small']['found']),
               diff('fresh', decision, 'subjects', 'iou', base=BASE)[0], diff('fresh', decision, 'subjects', 'bf', base=BASE)[0],
               diff('fresh', decision, 'small', 'found', base=BASE)[0])]
    if nets[decision].inp > CFG['side']:
        try:
            import s1d_sizes
            fs = {k: G['fresh']['sets'][k] for k in ('subjects', 'small', 'people')}
            got = s1d_sizes.fetch_full(sorted({i for v in fs.values() for i in v}))
            fs = {k: [i for i in v if i in got] for k, v in fs.items()}
            FM = {nm: s1d_sizes.measure(nets[nm], fs, dev, full=True) for nm in (BASE, decision)}
            RL += ['- %s minus %s on the fresh photos downloaded again full size (%d / %d / %d), as the app squashes them: subjects '
                   'overlap %+.4f, outline %+.4f; people overlap %+.4f, outline %+.4f; small found %+.4f.' % (
                       decision, BASE, len(fs['subjects']), len(fs['small']), len(fs['people']),
                       *(float((FM[decision][k][a] - FM[BASE][k][a]).mean()) for k, a in (
                           ('subjects', 'iou'), ('subjects', 'bf'), ('people', 'iou'), ('people', 'bf'), ('small', 'found'))))]
        except Exception as e:          # (reported only: a failure here changes nothing)
            RL.append('- The full-size check could not be made: %s' % e)

# sheets (fresh checks): photo | drawn outline | each model's cut-out
sdir = RESULTS / 'sheets'
sdir.mkdir(exist_ok=True)
TH = 200


def row(img, L, cuts):
    small = np.asarray(Image.fromarray(img).resize((TH, TH), Image.BILINEAR))
    tiles = [small]
    if L is None:
        tiles.append(np.full_like(small, 230))
    else:
        gm = np.asarray(Image.fromarray(L.astype(np.uint8) * 255).resize((TH, TH))) >= 128
        tiles.append(np.where(gm[..., None], small, 255).astype(np.uint8))
    for m in cuts:
        mm = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((TH, TH))) >= 128
        tiles.append(np.where(mm[..., None], small, 255).astype(np.uint8))
    return np.concatenate([np.pad(t, ((3, 3), (3, 3), (0, 0)), constant_values=180) for t in tiles], axis=1)


def sheet(name, items):
    rows = [row(img, L, [strays(maps(n, [img], dev)[0] >= 0.5) for n in nets.values()]) for img, L in items]
    for k in range(0, len(rows), 6):
        Image.fromarray(np.concatenate(rows[k:k + 6], axis=0)).save(sdir / ('%s-%02d.jpg' % (name, k // 6 + 1)), quality=88)


ph = lambda i: (load_prep(i)[0], load_label(i))
cr = lambda c: (crop_img(load_prep(c[0])[0], *c[1:]), None)
sheet('subjects', [ph(i) for i in S['subjects'][:6]])
sheet('small', [ph(i) for i in S['small'][:6]])
sheet('people', [ph(i) for i in S['people'][:12]])
sheet('scenery', [ph(i) for i in S['scenery'][:3]] + [cr(c) for c in G[g]['crops'][:3]])
trained = [n for n in models if n != 'stock']
chg, worst, vsb = [], [], []
for k in ('subjects', 'small', 'scenery', 'people'):
    for j, i in enumerate(S[k]):
        if any(P[g][n][k]['pband'][j] != P[g]['stock'][k]['pband'][j] for n in trained):
            chg.append(i)
        if trained:
            worst.append((min(P[g][n][k]['iou'][j] - P[g]['stock'][k]['iou'][j] for n in trained), i))
        for n in NEW:
            vsb.append((P[g][n][k]['iou'][j] - P[g][BASE][k]['iou'][j], i))
sheet('decision-changed', [ph(i) for i in chg[:24]])
sheet('worst', [ph(i) for _, i in sorted(worst)[:12]])
if vsb:
    sheet('new-worse-than-%s' % BASE, [ph(i) for _, i in sorted(vsb)[:12]])
    sheet('new-better-than-%s' % BASE, [ph(i) for _, i in sorted(vsb, reverse=True)[:12]])
flagged = [i for k in ('small', 'subjects') for i in G[g]['aside'][k]]
sheet('detector-flagged', [ph(i) for i in flagged[:24]] + [cr(c) for c in G[g]['crops_aside'][:6]])
RL += ['', 'Sheet detector-flagged: ' + '; '.join('%s: %s' % (i[:6], REASON.get(i, '')) for i in flagged[:24]), '',
       'Sheets (fresh checks): columns are the photo, the drawn outline, then %s.' % ', '.join(models)]
R.update({'decision': decision, 'why': why, 'aside': {**na, 'crops': len(G[g]['crops_aside'])}, 'margin': RULE['small_found_lower'],
          'verdict': {n: [{'line': l, 'pass': ok, 'diff': m, 'lo': lo, 'hi': hi} for l, ok, m, lo, hi in v] for n, v in fresh_ver.items()},
          'stock_means': {k: {a: float(v.mean()) for a, v in P[g]['stock'][k].items() if len(v)} for k in P[g]['stock']}})
json.dump(R, open(RESULTS / 'report.json', 'w'), indent=1)
(RESULTS / 'report.md').write_text('\n'.join(RL) + '\n', encoding='utf-8')
(RESULTS / 'logs').mkdir(exist_ok=True)
for f in WORK.glob('*.log'):
    shutil.copy(f, RESULTS / 'logs' / f.name)
for f in WORK.glob('runs/*/history.json'):
    shutil.copy(f, RESULTS / 'logs' / ('history-%s.json' % f.parent.name))
for f in WORK.glob('runs/baseline*.json'):
    shutil.copy(f, RESULTS / 'logs' / f.name)
mark_done('s6')
if R5 and NOT_FINAL:
    log('Step 6 done, but NOT FINAL: %s must be trained first. Run 5b-train-wide.bat, then 6-results.bat again (no need to '
        'copy anything yet).' % NEXT)
else:
    log('Step 6 done. Copy the whole "results" folder to your Mac (Documents/Claude outputs), as results-round%d, and tell Claude.' % (
    5 if R5 else 4 if R4 else 3 if R3 else 2))
