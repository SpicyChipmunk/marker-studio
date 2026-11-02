# Round 4's stand-in (never shipped): turns a finished round-3 stand-in run (mock.py, then steps 1-6) into one round 4
# can exercise. Usage: mock_round4.py <kit> <work> <results> [--after-safe]
#   before step 4: round 3's report says A3 shipped (the mock run's own decision is often "stock")
#   --after-safe (after step 4's first run kept round 3 in work/round3): the free one-outline training photos are given
#   sort rows, classes and boxes for every case step 4 must handle (each photo's expected fate printed), then run step
#   4 again and compare with work/disagree-pool.csv and step4-counts.
# Also checks round 4's classify() and box_checks() on hand-made rows and boxes.
import csv, json, sys, pathlib
kit, work, results = (pathlib.Path(a) for a in sys.argv[1:4])
sys.path.insert(0, str(kit))
rep = results / 'report.json'
r = json.load(open(rep))
if r.get('decision') != 'A3':
    r['decision'] = 'A3'
    json.dump(r, open(rep, 'w'), indent=1)
    print('report.json: decision set to A3')
# step 6's routes (s6_routes.route4): every outcome
from s6_routes import route4
for res, want in (({'B1': (1, 1), 'B1-early': (1, 1), 'B1-wide': (1, 1)}, ('B1', ['B1'])),
                  ({'B1': (1, 0), 'B1-early': (1, 1), 'B1-wide': (1, 1)}, ('B1-early', ['B1', 'B1-early'])),
                  ({'B1': (0, 1), 'B1-early': (1, 1), 'B1-wide': (1, 1)}, ('B1-wide', ['B1', 'B1-wide'])),
                  ({'B1': (0, 0), 'B1-early': (1, 1), 'B1-wide': (1, 1)}, ('B1-early', ['B1', 'B1-early'])),
                  ({'B1': (0, 1), 'B1-early': (1, 1), 'B1-wide': (0, 1)}, ('A3', ['B1', 'B1-wide'])),
                  ({'B1': (1, 0)}, ('A3', ['B1'])), ({}, ('A3', []))):
    assert route4(res, 'A3')[:2] == want, (res, route4(res, 'A3'))
print('step 6 routes: every outcome as decided')
if '--after-safe' not in sys.argv:
    sys.exit(0)

import s4_round4 as R4
# classify(): one row per group, and the boundaries
row = lambda S, L, i, err='1.0': {'share': str(S), 'all_share': str(L), 'stock_iou': str(i), 'err': err}
assert R4.classify(row(0.005, 0.1, 0.0))[0] == 'M-little'          # (stock found nothing much)
assert R4.classify(row(0.2, 0.1, 0.03))[0] == 'M-else'             # (stock marked something else)
assert R4.classify(row(0.1, 0.1, 0.8, '0.3'))[0] == 'B'            # (the edge differs)
assert R4.classify(row(0.5, 0.1, 0.19))[0] == 'O'                  # (stock's subject too big)
assert R4.classify(row(0.1, 0.1, 0.95, '0.1'))[0] is None          # (agrees after all)
# box_checks(): (x0, x1, y0, y1, class, group-of, inside), the outline's box (0.3-0.7 square)
mb, back, excl = (0.3, 0.7, 0.3, 0.7), {'/m/tree', '/m/table', '/m/plant'}, {'/m/person'}
B = lambda x0, x1, y0, y1, c, g=False, i=False: (x0, x1, y0, y1, c, g, i)
own = B(0.3, 0.7, 0.3, 0.7, '/m/cat')
chk = lambda bx, cls='/m/cat': R4.box_checks(bx, mb, cls, '/m/plant', back, excl)
assert chk([]) == 'not in the box table'
assert chk([own]) is None
assert chk([own, B(0, 0.2, 0, 0.2, '/m/person')]) == 'a person box'
assert chk([own, B(0.75, 0.95, 0.75, 0.95, '/m/horse', g=True)]) == 'a group-of box'
assert chk([own, B(0.38, 0.62, 0.38, 0.62, '/m/ball')]) == 'another box a quarter of the subject or more'      # (inside it)
assert chk([own, B(0.45, 0.5, 0.45, 0.5, '/m/ball')]) is None                                              # (small)
assert chk([own, B(0.0, 1.0, 0.0, 1.0, '/m/car', i=True)]) is None                                         # (holds it)
assert chk([own, B(0.0, 1.0, 0.2, 0.9, '/m/table')]) is None                                               # (background)
assert chk([own, B(0.75, 0.95, 0.1, 0.4, '/m/plant')]) is None                                             # (background)
assert chk([B(0.3, 0.7, 0.3, 0.7, '/m/plant'), B(0.75, 0.95, 0.1, 0.4, '/m/plant')], '/m/plant') == \
    'another box a quarter of the subject or more'                                                          # (67)
assert chk([own, B(0.31, 0.71, 0.29, 0.69, '/m/animal')]) is None                                          # (a parent class)
# det_reason() (decision 83): the outline a 0.3-0.7 square (as fractions); detections [class, score, x0, y0, x1, y1]
import numpy as np
from data import SIDE as _S
M = np.zeros((_S, _S), bool)
M[int(0.3 * _S):int(0.7 * _S), int(0.3 * _S):int(0.7 * _S)] = True
dr = lambda d: R4.det_reason(d, M, {'bed', 'couch', 'potted plant'}, 0.6)
assert dr([]) == ''
assert dr([['dog', 0.9, 0.31, 0.29, 0.69, 0.71]]) == ''                                      # (the subject itself)
assert dr([['bird', 0.9, 0.35, 0.35, 0.6, 0.6]]) == ''                                       # (a part, misnamed)
assert dr([['person', 0.9, 0.0, 0.0, 0.1, 0.2]]) == 'a person the detector found'
assert dr([['person', 0.9, 0.55, 0.1, 0.8, 0.5]]) == 'a person the detector found'         # (the rider: partly over it)
assert dr([['person', 0.5, 0.0, 0.0, 0.1, 0.2]]) == ''                                       # (under the score)
assert dr([['cat', 0.9, 0.72, 0.6, 0.95, 0.85]]) == 'another object the detector found'    # (a second animal)
assert dr([['cup', 0.9, 0.72, 0.6, 0.75, 0.63]]) == ''                                       # (small)
assert dr([['bed', 0.9, 0.0, 0.5, 1.0, 1.0]]) == ''                                          # (scenery)
assert dr([['motorcycle', 0.9, 0.1, 0.1, 0.95, 0.95]]) == 'another object the detector found'  # (a whole round a part)
print('classify(), box_checks() and det_reason(): every case as expected')

# the free one-outline photos: each given a case
R3 = work / 'round3'
rows = list(csv.DictReader(open(R3 / 'sort.csv', encoding='utf-8')))
used = set()
for p in list((R3 / 'lists').glob('*.txt')) + list((work / 'round2' / 'lists').glob('*.txt')):
    used |= {l.strip() for l in open(p) if l.strip()}
cands = list(csv.DictReader(open(work / 'candidates.csv', encoding='utf-8')))
C = {c['id']: c for c in cands}
free = [x for x in rows if x['kind'] == 'train' and not x['set'] and x['nmasks'] == '1' and x['id'] not in used
        and C[x['id']]['loose'] != '1']
CASES = [  # (name, label, share S, all_share L, stock_iou, err, extra box, expected group or None)
    ('M-little 1', 'Cat', 0.002, 0.12, 0.0, '1.0', None, 'M-little'),
    ('M-little 2 (holds-it IsInside box: kept)', 'Cat', 0.004, 0.2, 0.01, '1.0', 'inside-all', 'M-little'),
    ('M-little 3 (background box under it: kept)', 'Horse', 0.003, 0.03, 0.0, '1.0', 'tree-under', 'M-little'),
    ('M-little 4 small', 'Horse', 0.003, 0.02, 0.0, '1.0', None, 'M-little'),
    ('M-else 1', 'Horse', 0.25, 0.15, 0.02, '1.0', None, 'M-else'),
    ('M-else 2 small', 'Car', 0.2, 0.03, 0.01, '1.0', None, 'M-else'),
    ('B 1', 'Car', 0.15, 0.15, 0.8, '0.3', None, 'B'),
    ('B 2', 'Cat', 0.1, 0.1, 0.75, '0.4', None, 'B'),
    ('B 3', 'Motorcycle', 0.2, 0.2, 0.7, '0.5', None, 'B'),
    ('O (dropped)', 'Cat', 0.5, 0.1, 0.19, '1.0', None, None),
    ('Plant 2% (kept, 67)', 'Plant', 0.002, 0.02, 0.0, '1.0', None, 'M-little'),
    ('Plant 8% (dropped)', 'Plant', 0.002, 0.08, 0.0, '1.0', None, None),
    ('Tree 2% (dropped)', 'Tree', 0.002, 0.02, 0.0, '1.0', None, None),
    ('Houseplant 2% (kept: not on the list)', 'Houseplant', 0.002, 0.02, 0.0, '1.0', None, 'M-little'),
    ('Table 40% (dropped)', 'Table', 0.002, 0.4, 0.0, '1.0', None, None),
    ('group-of box (dropped)', 'Cat', 0.002, 0.1, 0.0, '1.0', 'group', None),
    ('person box (dropped)', 'Cat', 0.002, 0.1, 0.0, '1.0', 'person', None),
    ('inside sub-object (dropped)', 'Car', 0.002, 0.2, 0.0, '1.0', 'inside-sub', None),
    ('no box rows (dropped)', 'Cat', 0.002, 0.1, 0.0, '1.0', 'nobox', None),
    ('agrees after all (dropped)', 'Cat', 0.1, 0.1, 0.95, '0.1', None, None),
]
if len(free) < len(CASES):
    sys.exit('only %d free photos for %d cases' % (len(free), len(CASES)))
names = json.load(open(work / 'classes.json'))['names']
mid = {v: k for k, v in names.items()}
from data import load_prep
from s4_lib import bbox
from data import SIDE
bx_rows = list(csv.reader(open(work / 'lists-oi' / 'train-bbox.csv', encoding='utf-8')))
hd = bx_rows[0]
expect = {}
for (name, lab, S, L, i, err, extra, exp), x in zip(CASES, free):
    iid = x['id']
    x.update({'share': S, 'all_share': L, 'lshare': L if i > 0.5 else 0.0, 'stock_iou': i, 'err': err, 'agree': '0'})
    C[iid]['label'] = lab
    C[iid]['loose'] = '0'
    expect[iid] = (name, exp)
    m = load_prep(iid)[1][0]
    b = bbox(m)
    ob = [b[0] / SIDE, b[1] / SIDE, b[2] / SIDE, b[3] / SIDE]
    bx_rows = [r_ for r_ in bx_rows if r_[0] != iid]
    if extra == 'nobox':
        continue
    mk = lambda c, x0, x1, y0, y1, g='0', ins='0': dict(zip(hd, [iid, 'x', c, '1', str(x0), str(x1), str(y0), str(y1), '0', '0', g, '0', ins]))
    new = [mk(mid.get(lab, '/m/0000a'), *ob)]
    w, h = ob[1] - ob[0], ob[3] - ob[2]
    if extra == 'inside-all':
        new.append(mk(mid['Car'], 0, 1, 0, 1, ins='1'))
    elif extra == 'tree-under':
        new.append(mk(mid['Tree'], 0, 1, ob[2], 1))
    elif extra == 'group':
        new.append(mk(mid['Horse'], 0.0, 0.25, 0.0, 0.25, g='1'))
    elif extra == 'person':
        new.append(mk(mid['Person'], 0.0, 0.1, 0.0, 0.1))
    elif extra == 'inside-sub':
        new.append(mk(mid['Ball'], ob[0] + 0.2 * w, ob[0] + 0.8 * w, ob[2] + 0.2 * h, ob[2] + 0.8 * h))
    bx_rows += [[d[k] for k in hd] for d in new]
with open(R3 / 'sort.csv', 'w', newline='', encoding='utf-8') as f:
    w_ = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w_.writeheader()
    w_.writerows(rows)
with open(work / 'candidates.csv', 'w', newline='', encoding='utf-8') as f:
    w_ = csv.DictWriter(f, fieldnames=list(cands[0].keys()))
    w_.writeheader()
    w_.writerows(cands)
with open(work / 'lists-oi' / 'train-bbox.csv', 'w', newline='', encoding='utf-8') as f:
    csv.writer(f).writerows(bx_rows)
json.dump(expect, open(work / 'mock4-expect.json', 'w'), indent=1)
print('%d cases written; expected kept: %d' % (len(expect), sum(1 for v in expect.values() if v[1])))
