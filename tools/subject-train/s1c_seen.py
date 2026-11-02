# Round 5's second check (decision 95), run while round 5 is built: stock TRACER-TE2 against stock TRACER-TE0 on
# round 2's "seen" check photos, which were chosen WITHOUT stock (unlike the validation subjects, chosen where stock TE-0
# already agreed with the outline) and which decide nothing in step 6: the 1,885 subjects (after the check detector,
# as step 6 sets photos apart) and the 400 people. The seen small subjects (which hold the 442 hand-checked guard) are
# not touched. Nothing in work\ is changed; it writes results\seen-round5.txt.
#
# Fixed before the run: if stock TE-2's people overlap is more than 0.010 below stock TE-0's, round 5 shows its people
# set twice a pass instead of once. The rest is reported only. Stock TE-0 must first come out as round 3 measured it.
import json, time
import numpy as np
import data
from common import CFG, WORK, RESULTS, log, fail, load_tracer, device, R2, R3DIR, read_r2_list

# round 3's report (results-round3, "Round 2's checks"): stock on the seen checks
REF = {'subjects': {'n': 1885, 'iou': 0.8351, 'bf': 0.6721}, 'people': {'n': 400, 'iou': 0.7702, 'bf': 0.6554}}
TOL = 0.0015
PEOPLE_LINE = -0.010
NB = 4000


def ci(d, seed):
    rng = np.random.default_rng(seed)
    bs = d[rng.integers(0, len(d), (NB, len(d)))].mean(axis=1)
    return float(d.mean()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def measure(net, ids, dev, k):
    io, bf = [], []
    for s in range(0, len(ids), 32):
        b = ids[s:s + 32]
        for iid, y in zip(b, data.maps(net, [data.load_prep(i)[0] for i in b], dev)):
            L = data.down(data.load_label(iid))
            P = data.strays(y >= 0.5)
            io.append(data.iou(P, L))
            bf.append(data.boundary_f(P, L))
    log('   %s: %d %s photos measured' % (k, len(ids), 'subjects' if k == 'subjects' else 'people'))
    return {'iou': np.array(io), 'bf': np.array(bf)}


if __name__ == '__main__':
    miss = [p for p in (R3DIR / 'done', R3DIR / 'labels', R2 / 'lists' / 'test_subjects.txt', R2 / 'lists' / 'test_people.txt',
                        WORK / 'TRACER-Efficient-2.pth') if not p.exists()]
    if miss:
        fail('missing: %s. Run 1-check first. Nothing has been changed. Send Claude this message.' % ', '.join(map(str, miss)))
    t0 = time.time()
    dev = device()
    data.LABELS = R3DIR / 'labels'          # (round 3's copy of every outline, round 2's seen checks' too)
    log('Round 5\'s second check: stock TE-2 against stock TE-0 on round 2\'s seen subjects and people')
    subj, people = read_r2_list('test_subjects'), read_r2_list('test_people')
    import s6_detect
    flagged, _ = s6_detect.flags(subj, [])
    subj = [i for i in subj if i not in flagged]
    log('Seen subjects after the check detector: %d (set apart %d); people %d' % (len(subj), len(flagged), len(people)))
    nets = {'TE0': load_tracer(arch='0').to(dev).eval(), 'TE2': load_tracer(arch='2').to(dev).eval()}
    sets = {'subjects': subj, 'people': people}
    R = {m: {k: measure(n, ids, dev, k) for k, ids in sets.items()} for m, n in nets.items()}
    repro = all(len(sets[k]) == REF[k]['n'] or abs(len(sets[k]) - REF[k]['n']) <= 3 for k in REF) and all(
        abs(R['TE0'][k][a].mean() - REF[k][a]) <= TOL for k in REF for a in ('iou', 'bf'))
    log('Stock TE-0 against round 3\'s measurement: %s (%s)' % ('the same' if repro else 'NOT THE SAME', '; '.join(
        '%s n %d (then %d), overlap %+.4f, outline %+.4f' % (k, len(sets[k]), REF[k]['n'], R['TE0'][k]['iou'].mean() - REF[k]['iou'],
                                                             R['TE0'][k]['bf'].mean() - REF[k]['bf']) for k in REF)))
    rows, D = [], {}
    for j, (k, a, label) in enumerate((('subjects', 'iou', 'Seen subjects: overlap'), ('subjects', 'bf', 'Seen subjects: outline'),
                                       ('people', 'iou', 'Seen people: overlap'), ('people', 'bf', 'Seen people: outline'))):
        d = R['TE2'][k][a] - R['TE0'][k][a]
        D[k + '_' + a] = ci(d, 301 + j)
        rows.append('| %s (n %d) | %.4f | %.4f | %+.4f (%+.4f to %+.4f) |' % (
            label, len(d), R['TE0'][k][a].mean(), R['TE2'][k][a].mean(), *D[k + '_' + a]))
        log(rows[-1])
    if not repro:
        verdict = 'NO DECISION: stock TE-0 did not come out as round 3 measured it. Send Claude this file.'
        twice = None
    else:
        twice = D['people_iou'][0] < PEOPLE_LINE
        verdict = ('People set shown TWICE a pass: stock TE-2\'s people overlap is %+.4f against TE-0 (below %+.3f).' if twice else
                   'People set shown ONCE a pass: stock TE-2\'s people overlap is %+.4f against TE-0 (not below %+.3f).') % (
            D['people_iou'][0], PEOPLE_LINE)
    log(verdict)
    txt = ['# Round 5, second check: stock TRACER-TE2 vs stock TRACER-TE0 on round 2\'s seen checks', '',
           '**%s**' % verdict, '',
           'Rule fixed before the run (decision 95): people set twice a pass if TE-2\'s people overlap is more than 0.010 '
           'below TE-0\'s; everything else reported only. Photos chosen without stock; TE-2 at 352 on the 320 grid.', '',
           'Stock TE-0 against round 3\'s measurement: %s' % ('the same' if repro else 'NOT THE SAME'), '',
           '| Line | TE-0 | TE-2 | TE-2 − TE-0 (95% interval) |', '|---|---|---|---|'] + rows + [
           '', 'Device: %s; %.0f min' % (dev, (time.time() - t0) / 60)]
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / 'seen-round5.txt').write_text('\n'.join(txt) + '\n', encoding='utf-8')
    json.dump({'verdict': verdict, 'repro': repro, 'people_twice': twice, 'diff': D,
               'means': {m: {k: {a: float(v.mean()) for a, v in R[m][k].items()} for k in sets} for m in R}},
              open(RESULTS / 'seen-round5.json', 'w'), indent=1)
    log('Written: results\\seen-round5.txt. Send it to Claude.')
