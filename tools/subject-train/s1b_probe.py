# Round 5's probe (decision 94), before the round is built: TRACER-TE2 as its authors released it, against TRACER-TE0
# as released, on round 3's VALIDATION photos (work\round3: never the check sets, which decide what ships). TE-2 runs
# at its own 352 px, its map measured on the same 320 grid as TE-0's. Nothing in work\ is changed: it only reads round
# 3's lists, outlines and crops, and writes results\probe-round5.txt (plus the two exported files in work\probe5).
#
# The rule, fixed before the run: round 5 goes ahead if stock TE-2 is ahead of stock TE-0 on the validation outline
# OR on small subjects found (the averages); ahead on neither, round 5 stops. Stock TE-0's numbers must first come out
# as round 3 measured them (A3's history, before its first pass), or nothing is decided.
import json, sys, time
import numpy as np
import data
from common import CFG, WORK, RESULTS, log, fail, load_tracer, device, R3DIR, read_r3_list

TOL = {'iou': 0.002, 'bf': 0.002, 'small_iou': 0.002, 'found': 0.006, 'false': 0.006}
NB = 4000


def need():
    miss = [p for p in (R3DIR / 'done', R3DIR / 'lists' / 'val.txt', R3DIR / 'crops.csv', R3DIR / 'labels',
                        WORK / 'TRACER-Efficient-0.pth', WORK / 'TRACER-Efficient-2.pth') if not p.exists()]
    if miss:
        fail('missing: %s. Run 1-check first (it fetches TE-2\'s weights); round 3\'s copy in work\\round3 should be '
             'there from round 4. Nothing has been changed. Send Claude this message.' % ', '.join(str(p) for p in miss))


def build():
    """Round 3's validation photos exactly as round 3's step 5 checked on them (s5_train.evaluate's sets)."""
    data.LABELS, data.CROPS = R3DIR / 'labels', R3DIR / 'crops.csv'          # (round 3's own outlines and crops)
    import s5_train as s5
    train = read_r3_list('train')
    crops = data.read_crops('train')
    V = {'subj': [(data.load_prep(i)[0], data.down(data.load_label(i))) for i in read_r3_list('val')],
         'small': [(data.load_prep(i)[0], data.down(data.load_label(i))) for i in read_r3_list('val_small')],
         'crops': [data.crop_img(data.load_prep(c[0])[0], *c[1:]) for c in data.read_crops('val')],
         'paste': s5.pastes(train, crops, CFG['train'].get('paste_sources', 8))}
    return V, s5


def per_photo(net, V, dev, s5, mapf=None):
    """evaluate()'s measures photo by photo (mapf: another way to make the maps, e.g. the exported file)."""
    mp = mapf or (lambda imgs: data.maps(net, imgs, dev))
    r = {k: [] for k in ('iou', 'bf', 'small_iou', 'found', 'false')}
    for s in range(0, len(V['subj']), 32):
        b = V['subj'][s:s + 32]
        for (img, g), y in zip(b, mp([x[0] for x in b])):
            p = s5.clean(y)
            r['iou'].append(data.iou(p, g))
            r['bf'].append(data.boundary_f(p, g))
    for s in range(0, len(V['small']), 32):
        b = V['small'][s:s + 32]
        for (img, g), y in zip(b, mp([x[0] for x in b])):
            v = data.iou(s5.clean(y), g)
            r['small_iou'].append(v)
            r['found'].append(float(v >= 0.5))
    for s in range(0, len(V['crops']), 32):
        for y in mp(V['crops'][s:s + 32]):
            r['false'].append(float(s5.clean(y).mean() >= 0.01))
    pf = {}
    for s in range(0, len(V['paste']), 32):
        b = V['paste'][s:s + 32]
        for (sh, img, g), y in zip(b, mp([x[1] for x in b])):
            pf.setdefault(sh, []).append(data.iou(s5.clean(y), data.down(g)) >= 0.5)
    r = {k: np.array(v, np.float64) for k, v in r.items()}
    r['paste'] = {str(k): round(float(np.mean(v)), 3) for k, v in sorted(pf.items())}
    return r


def ci(d, seed):
    if len(d) == 0:
        return (float('nan'),) * 3
    rng = np.random.default_rng(seed)
    bs = d[rng.integers(0, len(d), (NB, len(d)))].mean(axis=1)
    return float(d.mean()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def onnx_maps(name, net, dev):
    """The model as the app would run it: exported as step 6 exports (ONNX opset 17, onnxslim, weights stored int8),
    run with ONNX Runtime on the processor, its map put on the 320 grid like PyTorch's."""
    import os, torch, onnxslim, onnxruntime as ort
    import torch.nn.functional as F
    src = open(data.__file__.replace('data.py', 's6_check.py'), encoding='utf-8').read()
    ns = {}
    exec(compile(src[src.index('def int8_store'):src.index('import onnxruntime as ort')], 's6_check.py', 'exec'),
         {'np': np}, ns)
    out = WORK / 'probe5'
    out.mkdir(exist_ok=True)
    cpu = net.to('cpu').eval()
    n = cpu.inp
    x = torch.zeros(1, 3, n, n)
    with torch.no_grad():
        cpu(x)

    class Out(torch.nn.Module):
        def __init__(s, m):
            super().__init__()
            s.m = m

        def forward(s, x):
            return s.m(x)[0]
    fp = out / ('%s-fp32.onnx' % name)
    torch.onnx.export(Out(cpu).eval(), x, str(fp), input_names=['input'], output_names=['map'], opset_version=17, dynamo=False)
    import contextlib, io
    with contextlib.redirect_stdout(io.StringIO()):          # (onnxslim prints a long table)
        onnxslim.slim(str(fp), str(fp) + '.slim.onnx')
    dst = out / ('subject-%s-%d-w8.onnx' % (name, n))
    ns['int8_store'](str(fp) + '.slim.onnx', str(dst))
    os.remove(fp)
    os.remove(str(fp) + '.slim.onnx')
    net.to(dev)
    s = ort.InferenceSession(str(dst), providers=['CPUExecutionProvider'])

    def mapf(imgs):
        xx = data.to_input(imgs, torch.device('cpu'), n).numpy()
        y = np.concatenate([s.run(None, {'input': xx[i:i + 1]})[0] for i in range(len(xx))])
        y = torch.from_numpy(y)
        if n != data.INP:
            y = F.interpolate(y, size=(data.INP, data.INP), mode='bilinear', align_corners=False)
        return y[:, 0].numpy()
    return mapf, os.path.getsize(dst) / 1e6


if __name__ == '__main__':
    need()
    dev = device()
    t0 = time.time()
    log('Round 5\'s probe: stock TRACER-TE2 against stock TRACER-TE0 on round 3\'s validation photos')
    V, s5 = build()
    log('Validation photos: %d subjects, %d small subjects, %d empty crops, %d pasted subjects' % (
        len(V['subj']), len(V['small']), len(V['crops']), len(V['paste'])))
    nets = {'TE0': load_tracer(arch='0').to(dev).eval(), 'TE2': load_tracer(arch='2').to(dev).eval()}
    R = {k: per_photo(n, V, dev, s5) for k, n in nets.items()}
    M = {k: {a: float(np.mean(v[a])) if len(v[a]) else float('nan') for a in TOL} for k, v in R.items()}
    for k in R:
        log('%s (input %d): overlap %.4f, outline %.4f, small found %.4f (overlap %.4f), false on crops %.4f, pasted found %s'
            % (k, nets[k].inp, M[k]['iou'], M[k]['bf'], M[k]['found'], M[k]['small_iou'], M[k]['false'], R[k]['paste']))
    # stock TE-0 as round 3 measured it: A3's history before its first pass (A3 started from stock)
    hp = R3DIR / 'A3-history.json'
    ref = json.load(open(hp))[0] if hp.exists() else None
    repro = None
    if ref is None or ref.get('epoch') != 0:
        log('WARNING: round 3\'s A3 history is not in work\\round3: stock TE-0\'s numbers cannot be checked against it.')
    else:
        same = lambda a, b, t: (np.isnan(a) and np.isnan(b)) or abs(a - b) <= t          # (an empty set: nan both times)
        off = {a: M['TE0'][a] - ref[a] for a in TOL}
        pr, p0 = ref.get('paste', {}), R['TE0']['paste']
        repro = (all(same(M['TE0'][a], ref[a], TOL[a]) for a in TOL) and
                 all(same(p0.get(k, np.nan), pr.get(k, np.nan), 0.02) for k in set(pr) | set(p0)))
        log('Stock TE-0 against round 3\'s own measurement: %s (%s; pasted found then %s, now %s)' % (
            'the same' if repro else 'NOT THE SAME', ', '.join('%s %+.4f' % (a, off[a]) for a in TOL), pr, p0))
    lines = []
    D = {}
    for i, (a, label) in enumerate((('bf', 'Subjects: outline'), ('iou', 'Subjects: overlap'),
                                    ('found', 'Small subjects: found'), ('small_iou', 'Small subjects: overlap'),
                                    ('false', 'Empty crops: false subjects'))):
        d = R['TE2'][a] - R['TE0'][a]
        D[a] = ci(d, 101 + i)
        lines.append('| %s (n %d) | %.4f | %.4f | %+.4f (%+.4f to %+.4f) |' % (label, len(d), M['TE0'][a], M['TE2'][a], *D[a]))
    ahead = {'outline': D['bf'][0] > 0, 'small found': D['found'][0] > 0}
    if repro is False:
        verdict = 'NO DECISION: stock TE-0 did not come out as round 3 measured it. Send Claude this file.'
    else:
        verdict = ('GO: stock TE-2 is ahead on %s.' % ' and '.join(k for k, v in ahead.items() if v) if any(ahead.values())
                   else 'STOP: stock TE-2 is ahead on neither the outline nor small subjects found.')
    log(verdict)
    # reported only: both as the app would run them (the exported int8 file, ONNX Runtime)
    rep = []
    try:
        Q = {}
        for k, n in nets.items():
            mf, mb = onnx_maps(k, n, dev)
            q = per_photo(None, {**V, 'crops': [], 'paste': []}, dev, s5, mapf=mf)
            Q[k] = q
            rep.append('- %s as the app\'s file (%.1f MB): outline %.4f, small found %.4f' % (k, mb, q['bf'].mean(), q['found'].mean()))
            log(rep[-1][2:])
        for i, (a, label) in enumerate((('bf', 'outline'), ('found', 'small found'))):
            m, lo, hi = ci(Q['TE2'][a] - Q['TE0'][a], 201 + i)
            rep.append('- TE-2 minus TE-0 as the app\'s files, %s: %+.4f (%+.4f to %+.4f)' % (label, m, lo, hi))
            log(rep[-1][2:])
    except Exception as e:          # (reported only: a failure here changes nothing above)
        rep.append('- the exported files could not be checked: %s' % e)
        log(rep[-1][2:])
    txt = ['# Round 5 probe: stock TRACER-TE2 vs stock TRACER-TE0 (round 3\'s validation photos)', '',
           '**%s**' % verdict, '',
           'Rule fixed before the run (decision 94): go if TE-2 is ahead on the outline or on small subjects found; '
           'stop if on neither. TE-2 at 352, measured on the 320 grid.', '',
           'Stock TE-0 against round 3\'s own measurement: %s' % ({True: 'the same', False: 'NOT THE SAME',
                                                                 None: 'not checked (no history)'}[repro]), '',
           '| Line | TE-0 | TE-2 | TE-2 − TE-0 (95% interval) |', '|---|---|---|---|'] + lines + [
           '', 'Pasted subjects found: TE-0 %s; TE-2 %s' % (R['TE0']['paste'], R['TE2']['paste']), '',
           'Reported only (not the rule):'] + rep + ['', 'Device: %s; %.0f min' % (dev, (time.time() - t0) / 60)]
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / 'probe-round5.txt').write_text('\n'.join(txt) + '\n', encoding='utf-8')
    json.dump({'verdict': verdict, 'repro': repro, 'means': M, 'diff': D, 'paste': {k: R[k]['paste'] for k in R}},
              open(RESULTS / 'probe-round5.json', 'w'), indent=1)
    log('Written: results\\probe-round5.txt. Send it to Claude.')
