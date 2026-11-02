# A one-off check for decision 34 (safe to run while step 5 trains: no graphics card, little processor): would Open
# Images' human-verified image labels catch the people and other things nobody boxed in the small-subject top-ups?
# Downloads the training photos' image-label table once (a few hundred MB, kept in work\lists-oi), then writes
# results\label-check.txt: how many top-ups have a confirmed people/clothing label, which classes, and every confirmed
# label of the 12 top-ups shown on the small-topup preview sheet.
import csv, json
from collections import Counter
from common import CFG, WORK, RESULTS, log, fail, download, head_size
from data import read_list, load_prep

import os
URLS = ['https://storage.googleapis.com/openimages/v5/train-annotations-human-imagelabels-boxable.csv',
        'https://storage.googleapis.com/openimages/2018_04/train/train-annotations-human-imagelabels-boxable.csv']
if os.environ.get('MS_KIT_BASE'):          # (the kit's own test: a local copy)
    URLS = [u.replace('https://storage.googleapis.com', os.environ['MS_KIT_BASE'].rstrip('/')) for u in URLS]
dest = WORK / 'lists-oi' / 'train-imagelabels.csv'
dest.parent.mkdir(exist_ok=True)
if not dest.exists():
    errs = []
    for u in URLS:
        try:
            n = head_size(u)
            log('Downloading the training photos\' image labels (%s MB, once) from %s' % (round(n / 1e6) if n else '?', u))
            download(u, dest)
            break
        except Exception as e:
            errs.append('%s: %s' % (u, e))
    if not dest.exists():
        fail('the image-label table could not be downloaded (%s). Run this again; a download carries on where it stopped.' % '; '.join(errs))
cls = json.load(open(WORK / 'classes.json', encoding='utf-8'))
EXCL, NAMES = set(cls['exclude']), cls['names']
kind = {}
with open(WORK / 'sort.csv', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        kind[r['id']] = r['kind']
sets = {k: [i for i in read_list(k) if kind.get(i) == 'train'] for k in ('test_small', 'val_small', 'test_subjects')}
want = set(i for v in sets.values() for i in v)
log('Top-ups to check: ' + ', '.join('%s %d' % (k, len(v)) for k, v in sets.items()))
pos = {i: set() for i in want}
log('Reading the image labels (a minute or two)...')
with open(dest, encoding='utf-8') as f:
    rd = csv.reader(f)
    hd = next(rd)
    ii, il, ic = hd.index('ImageID'), hd.index('LabelName'), hd.index('Confidence')
    for r in rd:
        if r[ii] in pos and r[ic] in ('1', '1.0'):
            pos[r[ii]].add(r[il])
nm = lambda m: NAMES.get(m, m)
own = {i: set(load_prep(i)[2]) for i in want}
out = []
for k, v in sets.items():
    if not v:
        continue
    flagged = [i for i in v if (pos[i] - own[i]) & EXCL]
    labelled = sum(1 for i in v if pos[i])
    c = Counter(nm(m) for i in flagged for m in (pos[i] - own[i]) & EXCL)
    out.append('%s: %d top-ups, %d with any confirmed label, %d (%.0f%%) with a confirmed people/clothing label not their own '
               'outline; classes: %s' % (k, len(v), labelled, len(flagged), 100 * len(flagged) / len(v),
                                        ', '.join('%s %d' % kv for kv in c.most_common(12)) or '-'))
    other = Counter(nm(m) for i in v for m in pos[i] - own[i] - EXCL)
    out.append('   other confirmed labels on them (not their own outline), most common: ' +
               (', '.join('%s %d' % kv for kv in other.most_common(25)) or '-'))
out.append('')
out.append('The 12 top-ups on the small-topup preview sheet (left to right, top to bottom): outlined | confirmed labels')
for n, i in enumerate(sets['test_small'][:12], 1):
    out.append('%2d. %s | outlined: %s | confirmed: %s' % (n, i, ', '.join(sorted(nm(m) for m in own[i])),
                                                           ', '.join(sorted(nm(m) for m in pos[i])) or '(none)'))
for l in out:
    log(l)
(RESULTS / 'label-check.txt').write_text('\n'.join(out) + '\n', encoding='utf-8')
log('Done. Send Claude results\\label-check.txt.')
