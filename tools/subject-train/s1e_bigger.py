# Decision 104: is a bigger model better for our photos? Stock TRACER-TE5 (input 512), TE6 (576) and TE7 (640), and
# stock TE4 at larger inputs (512, 576), against stock TE4 at 448 (round 5's C1 started from it), by a rule fixed before
# the run. It changes nothing in work\ (it adds the three models' release weights, checked against their known
# fingerprints, and work\probe6\full, a cache of the photos again at 640), and writes results\bigger-round6.txt.
#
# Photos (all chosen without stock, none of round 3's fresh checks): round 2's seen subjects (after the check
# detector) and seen people, and round 3's validation small subjects, as round 5's size check (1d-sizes). Each model
# sees them two ways: the photos downloaded again and squashed straight to its input size, as the app does (this
# decides: the kit's own 384-px photos would be enlarged for a 576 or 640 model), and the kit's 384-px photos
# (reported: what training on them would give it).
#
# The rule (decision 104, fixed before the run), each line a model's mean minus stock TE4-448's on the same photos:
#   A bigger model (TE5, TE6) passes if: subjects outline >= +0.015, people outline >= +0.010, small found >= 0, and
#   subjects and people overlap each >= -0.005. If both pass, TE6 if it leads TE5 on subjects outline by >= +0.005,
#   else TE5. TE7 is reported only (about 70 MB to download and 2 s or more a map on one thread: out at any limit).
#   A larger input for TE4 (512, then 576) passes if: subjects outline >= +0.008, people outline >= 0, small found >= 0,
#   overlaps >= -0.005 (the smaller input that passes): reported as a route (the same model, a bigger input).
#   Stock TE0 must come out as round 3 measured it (as 1d-sizes), or there is no decision.
import json, time
import numpy as np
import torch
import data
import s1d_sizes as S
from common import CFG, WORK, RESULTS, log, fail, load_tracer, device, download, sha256, R2, R3DIR, read_r2_list, read_r3_list

BIG = ['TE5', 'TE6']
MODELS = [('TE0', '0', None), ('TE4', '4', None), ('TE4-512', '4', 512), ('TE4-576', '4', 576), ('TE5', '5', None),
          ('TE6', '6', None), ('TE7', '7', None)]
BAR = {'subjects_bf': 0.015, 'people_bf': 0.010, 'small_found': 0.0, 'subjects_iou': -0.005, 'people_iou': -0.005}
BAR_IN = {'subjects_bf': 0.008, 'people_bf': 0.0, 'small_found': 0.0, 'subjects_iou': -0.005, 'people_iou': -0.005}
LEAD = 0.005
LINES = (('subjects', 'iou'), ('subjects', 'bf'), ('people', 'iou'), ('people', 'bf'), ('small', 'found'))


def weights():
    for a in ('4', '5', '6', '7'):
        w = WORK / ('TRACER-Efficient-%s.pth' % a)
        if not w.exists():
            log('Downloading TRACER-TE%s weights (%d MB) from the authors\' GitHub release' % (a, CFG['tracer%s_bytes' % a] // 1000000))
            download(CFG['urls']['tracer' + a], w)
        if sha256(w) != CFG['tracer%s_sha256' % a]:
            w.unlink()
            fail('the TRACER-TE%s weights did not match their known fingerprint (deleted). Run this again.' % a)
    log('TRACER-TE4 to TE7 weights OK (SHA-256 matches)')


def net_for(arch, inp, dev):
    net = load_tracer(arch=arch).to(dev).eval()
    if inp:
        net.inp = inp          # (the same model fed a larger photo: TRACER's layers take any size; checked in the cloud)
    return net


def diffs(R, m, ref='TE4'):
    return {k + '_' + a: float((R[m][k][a] - R[ref][k][a]).mean()) for k, a in LINES}


def passes(d, bar):
    return all(d[k] >= v for k, v in bar.items())


if __name__ == '__main__':
    miss = [p for p in (R3DIR / 'done', R3DIR / 'labels', R3DIR / 'lists' / 'val_small.txt', R2 / 'lists' / 'test_subjects.txt',
                        R2 / 'lists' / 'test_people.txt', WORK / 'TRACER-Efficient-0.pth', WORK / 'candidates.csv') if not p.exists()]
    if miss:
        fail('missing: %s. Nothing has been changed. Send Claude this message.' % ', '.join(map(str, miss)))
    t0 = time.time()
    dev = device()
    data.LABELS = R3DIR / 'labels'
    weights()
    log('Decision 104: stock TE5, TE6, TE7 and TE4 at 512 and 576 against stock TE4 at 448 (seen subjects and people, '
        'validation small subjects; full-size photos decide)')
    subj, people, small = read_r2_list('test_subjects'), read_r2_list('test_people'), read_r3_list('val_small')
    import s6_detect
    flagged, _ = s6_detect.flags(subj, [])
    subj = [i for i in subj if i not in flagged]
    sets = {'subjects': subj, 'people': people, 'small': small}
    log('Photos: seen subjects %d (the detector set apart %d), seen people %d, validation small %d' % (
        len(subj), len(flagged), len(people), len(small)))
    # the photos again, squashed once to 640 (the biggest model's input) and kept
    S.FULL = WORK / 'probe6' / 'full'
    S.FULL_SIDE = 640
    full = S.fetch_full(sorted(set(subj) | set(people) | set(small)))
    fsets = {k: [i for i in v if i in full] for k, v in sets.items()}
    R, F = {}, {}
    for m, a, inp in MODELS:
        net = net_for(a, inp, dev)
        R[m] = S.measure(net, sets, dev)
        F[m] = S.measure(net, fsets, dev, full=True)
        log('%s (input %d): full size: subjects overlap %.4f outline %.4f | people overlap %.4f outline %.4f | small found %.4f;'
            ' 384-px photos: subjects outline %.4f, people outline %.4f, small found %.4f' % (
                m, net.inp, F[m]['subjects']['iou'].mean(), F[m]['subjects']['bf'].mean(), F[m]['people']['iou'].mean(),
                F[m]['people']['bf'].mean(), F[m]['small']['found'].mean(), R[m]['subjects']['bf'].mean(),
                R[m]['people']['bf'].mean(), R[m]['small']['found'].mean()))
        del net
        if dev.type == 'cuda':
            torch.cuda.empty_cache()
    # stock TE0 as round 3 measured it (the 384-px photos, as 1d-sizes)
    h3 = json.load(open(R3DIR / 'A3-history.json'))[0] if (R3DIR / 'A3-history.json').exists() else {}
    chk = [(k, a, R['TE0'][k][a].mean(), S.REF[k][a]) for k in S.REF for a in ('iou', 'bf')]
    chk += [('small', 'found', R['TE0']['small']['found'].mean(), h3.get('found', np.nan))]
    repro = (all(abs(len(sets[k]) - S.REF[k]['n']) <= 3 for k in S.REF) and
             all(abs(v - r) <= (S.TOL if a != 'found' else 0.006) for k, a, v, r in chk))
    log('Stock TE0 against round 3\'s measurement: %s' % ('the same' if repro else 'NOT THE SAME'))
    D = {m: diffs(F, m) for m, _, _ in MODELS if m != 'TE4'}
    Dp = {m: diffs(R, m) for m, _, _ in MODELS if m != 'TE4'}
    ok = [m for m in BIG if passes(D[m], BAR)]
    big = None
    if ok:
        big = 'TE6' if ('TE6' in ok and ('TE5' not in ok or D['TE6']['subjects_bf'] - D['TE5']['subjects_bf'] >= LEAD)) else 'TE5'
    bigger_in = next((m for m in ('TE4-512', 'TE4-576') if passes(D[m], BAR_IN)), None)
    if not repro:
        verdict = 'NO DECISION: stock TE0 did not come out as round 3 measured it. Send Claude this file.'
    elif big:
        verdict = 'BIGGER: %s is better for our photos (passes: %s).' % (big, ', '.join(ok))
    else:
        verdict = 'NOT BIGGER: neither TE5 nor TE6 clears the bar; TE4 stays.'
    if repro:
        verdict += (' Larger input: TE4 at %s clears its bar (a route: the same model, a bigger input).' % bigger_in[4:]
                    if bigger_in else ' Larger input: TE4 at 512 or 576 does not clear its bar.')
    log(verdict)

    def row(m, d, src):
        j = [x for x, _, _ in MODELS].index(m)
        cis = [S.ci(src[m][k][a] - src['TE4'][k][a], 600 + 10 * j + i) for i, (k, a) in enumerate(LINES)]
        tag = '' if src is R else (' pass' if (m in BIG and passes(d, BAR)) or (m.startswith('TE4-') and passes(d, BAR_IN)) else
                                   (' –' if m in ('TE0', 'TE7') else ' no'))
        return '| %s | %s |%s' % (m, ' | '.join('%+.4f (%+.4f to %+.4f)' % c for c in cis), tag)
    head = '| Model minus TE4-448 | Subjects overlap | Subjects outline | People overlap | People outline | Small found |'
    txt = ['# Decision 104: is a bigger model better for our photos? (stock models, minus stock TE4 at 448)', '',
           '**%s**' % verdict, '',
           'Rule fixed before the run (full-size photos decide): TE5 or TE6 passes with subjects outline >= +0.015, people '
           'outline >= +0.010, small found >= 0, subjects and people overlap >= -0.005; both passing: TE6 if it leads TE5 on '
           'subjects outline by >= +0.005, else TE5. TE7 reported only. TE4 at 512/576: subjects outline >= +0.008, people '
           'outline >= 0, small found >= 0, overlaps >= -0.005.', '',
           'Stock TE0 against round 3\'s measurement: %s' % ('the same' if repro else 'NOT THE SAME'), '',
           'Photos: full size subjects %d, people %d, small %d (of %d / %d / %d).' % (
               len(fsets['subjects']), len(fsets['people']), len(fsets['small']), len(subj), len(people), len(small)), '',
           '## Full-size photos, squashed straight to each model\'s input (this decides; 95% intervals)', '', head + ' Bar |',
           '|---|---|---|---|---|---|---|'] + [row(m, D[m], F) + ' |' for m, _, _ in MODELS if m != 'TE4'] + [
           '', '## The kit\'s 384-px photos, enlarged to each input (reported: what training on them would see)', '', head,
           '|---|---|---|---|---|---|'] + [row(m, Dp[m], R) for m, _, _ in MODELS if m != 'TE4'] + [
           '', 'Means, full size: ' + '; '.join('%s subjects %.4f/%.4f, people %.4f/%.4f, small found %.4f' % (
               m, F[m]['subjects']['iou'].mean(), F[m]['subjects']['bf'].mean(), F[m]['people']['iou'].mean(),
               F[m]['people']['bf'].mean(), F[m]['small']['found'].mean()) for m, _, _ in MODELS),
           '', 'iPad, one thread (Ben\'s timing page, stock, a map): TE4 0.48 s, TE5 0.81 s, TE6 1.30 s; decision 105\'s line '
           'is Copy diagnostics\' "Subject found in the background" under 2.0 s a photo.',
           '', 'Device: %s; %.0f min' % (dev, (time.time() - t0) / 60)]
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / 'bigger-round6.txt').write_text('\n'.join(txt) + '\n', encoding='utf-8')
    json.dump({'verdict': verdict, 'repro': repro, 'bigger': big, 'passing': ok, 'larger_input': bigger_in,
               'full': D, 'prep384': Dp}, open(RESULTS / 'bigger-round6.json', 'w'), indent=1)
    log('Written: results\\bigger-round6.txt. Send it to Claude.')
