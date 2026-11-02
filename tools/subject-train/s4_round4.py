# Step 4, round 4 (config round 4; decisions 55–68, docs: tools/subject-train/dev/PLAN-round4.md): round 3's lists,
# crops and outlines are kept as they were (common.round3_safe, then loaded, never chosen again), and four lists are
# added:
#   disagree        training-pool photos where round 3's stock run disagreed with the photo's ONE drawn outline, the
#                   outline as the label: "missed" (stock found little or none of it: M-little; or picked something
#                   else: M-else) and "wrong edge" (stock found it, its edge differs: B); stock's "too big" left out.
#                   Classified from round 3's sort table (stock is not run again), then box checks: in the box table,
#                   no person box, no group-of box of a possible subject, no other box a quarter of the subject's size
#                   or more (inside the outline too), the outline not a background class (a 1–5% Plant allowed).
#                   All missed photos first, then wrong edge, to the cap: a quarter of round 3's training list.
#   small_agree     round 3's training photos with one outline of 1–5% (shown twice in step 5, as the disagree photos)
#   val_hard        400 held-out subjects photos (validation part, chosen without stock) that stock got wrong
#   val_hard_small  300 small (1–5%) missed photos, set apart before the disagree photos are chosen
# Then 72 preview photos (24 a group) with stock's subject beside the outline, for Ben's check: a group stays if 20
# or more of its 24 look right. A failing group is named in config disagree.drop and the lists made again with
# `4-label.bat --lists-only` (no stock, no previews: a minute or two).
import csv, hashlib, json, shutil, sys, time
from collections import Counter, defaultdict
import numpy as np
from PIL import Image
from common import (CFG, WORK, RESULTS, log, fail, mark_done, load_tracer, device, R2, R3DIR, round3_safe, read_r3_list,
                    read_r2_list, read_r2_crops, benchmark)
from data import load_prep, maps, LABELS, LISTS, CROPS, SIDE
from s4_lib import bbox

H = CFG['held']
DG = CFG['disagree']
hkey = lambda i: hashlib.sha1(i.encode()).hexdigest()
POOL = WORK / 'disagree-pool.csv'
GROUPS = ('M-little', 'M-else', 'B')


def save_label(iid, m):
    Image.fromarray((m * 255).astype(np.uint8)).save(LABELS / (iid + '.png'))


def write_list(name, ids):
    with open(LISTS / (name + '.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(ids) + ('\n' if ids else ''))


def read_boxes4(path, keep, box):
    """A box table's rows for the photos in `keep` → box[id] = [(x0, x1, y0, y1, class, group-of, inside)]."""
    n = 0
    with open(path, encoding='utf-8') as f:
        rd = csv.reader(f)
        hd = next(rd)
        ix = {c: hd.index(c) for c in ('ImageID', 'LabelName', 'XMin', 'XMax', 'YMin', 'YMax')}
        ig, ii = (hd.index(c) if c in hd else None for c in ('IsGroupOf', 'IsInside'))
        for r in rd:
            i = r[ix['ImageID']]
            if i not in keep:
                continue
            try:
                box[i].append((float(r[ix['XMin']]), float(r[ix['XMax']]), float(r[ix['YMin']]), float(r[ix['YMax']]),
                               r[ix['LabelName']], ig is not None and r[ig] == '1', ii is not None and r[ii] == '1'))
                n += 1
            except (ValueError, IndexError):
                pass
    return n


def classify(r):
    """Round 3's stock answer for a one-outline photo, from its sort row: recall r and precision p of stock's subject
    against the outline (exact for one outline: share = |S|, all_share = |L|, stock_iou = IoU(S, L), at the same size),
    and err (round 3's agree_err of S and the outline, when r ≥ 0.5). → (group or None, r, p, near a boundary)."""
    S, L, i = float(r['share']), float(r['all_share']), float(r['stock_iou'])
    inter = i * (S + L) / (1 + i)
    rc = inter / L if L > 0 else 0.0
    pc = inter / S if S > 0 else 0.0
    err = float(r['err'])
    near = abs(rc - 0.5) < 0.005 or abs(pc - 0.5) < 0.005 or (rc >= 0.5 and abs(err - 0.15) < 0.005)
    if rc < 0.5:
        g = 'M-little' if (pc >= 0.5 or S < 0.01) else 'M-else'
    elif pc < 0.5:
        g = 'O'
    elif err > 0.15:
        g = 'B'
    else:
        g = None
    return g, rc, pc, near


def box_checks(bx, mb, own_cls, plant, back, excl):
    """The box checks for a one-outline photo (mb: the outline's box, as fractions of the photo). → None if it passes,
    else the reason. Another box counts as a rival at a quarter of the outline's box or more, inside the outline too;
    the outline's own box (IoU ≥ 0.5) and a box holding it (≥ 90% of it inside, and bigger) never count; a background
    class never counts, except a Plant box when the subject is a Plant."""
    if not bx:
        return 'not in the box table'
    if any(b[4] in excl for b in bx):
        return 'a person box'
    x0, x1, y0, y1 = mb
    own = max(1e-9, (x1 - x0) * (y1 - y0))
    for b in bx:
        a = max(1e-9, (b[1] - b[0]) * (b[3] - b[2]))
        ix = max(0.0, min(b[1], x1) - max(b[0], x0))
        iy = max(0.0, min(b[3], y1) - max(b[2], y0))
        inter = ix * iy
        if inter / (a + own - inter) >= 0.5 or (inter >= 0.9 * own and a >= own):
            continue          # (the outline's own box, or one that holds it: a parent class, a car the dog sits in)
        if b[4] in back and not (own_cls == plant and b[4] == plant):
            continue
        if b[5]:
            return 'a group-of box'
        if a >= DG['rival_frac'] * own:
            return 'another box a quarter of the subject or more'
    return None


def det_reason(dets, mask, scene, thr):
    """(decision 83) Why the detector leaves a one-outline photo out ('' if it doesn't). A detection is the outlined
    subject (or a part of it, whatever the detector calls it) if its box matches the outline's (IoU ≥ 0.5) or the outline
    covers half of it or more; any other person counts, and any other object, not a scene class, a quarter of the
    subject's box or more. (Unlike step 6's photo_flag, a detection inside the outline's box still counts when the outline
    doesn't cover it: the rider on the motorcycle.)"""
    b = bbox(mask)
    if b is None:
        return 'empty outline'
    ox0, ox1, oy0, oy1 = b[0] / SIDE, b[1] / SIDE, b[2] / SIDE, b[3] / SIDE
    own = max(1e-9, (ox1 - ox0) * (oy1 - oy0))
    for cls, sc, x0, y0, x1, y1 in dets:
        if sc < thr:
            continue
        a = max(1e-9, (x1 - x0) * (y1 - y0))
        ix = max(0.0, min(x1, ox1) - max(x0, ox0))
        iy = max(0.0, min(y1, oy1) - max(y0, oy0))
        if ix * iy / (a + own - ix * iy) >= DG.get('det_own_iou', 0.5):
            continue
        px0, px1 = int(x0 * SIDE), max(int(x0 * SIDE) + 1, int(round(x1 * SIDE)))
        py0, py1 = int(y0 * SIDE), max(int(y0 * SIDE) + 1, int(round(y1 * SIDE)))
        if mask[py0:py1, px0:px1].mean() >= DG.get('det_own_cover', 0.5):
            continue
        if cls == 'person':
            return 'a person the detector found'
        if cls in scene:
            continue
        if a >= DG['rival_frac'] * own:
            return 'another object the detector found'
    return ''


def main4():
    lists_only = '--lists-only' in sys.argv
    t_start = time.time()
    if lists_only:
        if not POOL.exists() or not (R3DIR / 'done').exists():
            fail('--lists-only needs a full round-4 step 4 first (work\\disagree-pool.csv). Run 4-label without it.')
        log('Round 4, step 4 --lists-only: the disagree photos chosen again from the kept pool (config disagree.drop: %s); '
            'no stock run, no previews.' % (', '.join(DG.get('drop') or []) or 'none'))
        for p in list(WORK.glob('.done-s5*')) + list(WORK.glob('.done-s6')) + list(WORK.glob('.done-s4')):
            p.unlink()
        pool = read_pool()
        build(pool, lists_only=True, t_start=t_start)
        return
    log('Round 4, step 4: round 3\'s lists kept; the disagree photos chosen from round 3\'s sort table (stock is not run '
        'again, but for the 72 preview photos).')
    round3_safe()
    bm = benchmark()
    log('Round 3 shipped %s: round 4 starts from it and is judged against it.' % bm)
    # clear, then put round 3's outlines, lists, crops and sort table back as they were
    shutil.rmtree(LABELS, ignore_errors=True)
    shutil.copytree(R3DIR / 'labels', LABELS)
    LISTS.mkdir(exist_ok=True)
    for p in LISTS.glob('*.txt'):
        p.unlink()
    for p in (R3DIR / 'lists').glob('*.txt'):
        shutil.copy2(p, LISTS / p.name)
    shutil.copy2(R3DIR / 'crops.csv', CROPS)
    shutil.copy2(R3DIR / 'sort.csv', WORK / 'sort.csv')
    for p in list(WORK.glob('.done-s5*')) + list(WORK.glob('.done-s6')) + list(WORK.glob('.done-s4')):
        p.unlink()
    for p in (WORK / 'runs').glob('baseline-*.json'):
        p.unlink()
    for name in CFG['train']['runs']:
        if (WORK / 'runs' / name).exists():
            shutil.rmtree(WORK / 'runs' / name, ignore_errors=True)

    cls = json.load(open(WORK / 'classes.json', encoding='utf-8'))
    EXCL, NAMES = set(cls['exclude']), cls['names']
    low = defaultdict(list)
    for m, d in NAMES.items():
        low[d.lower()].append(m)
    BACK = {m for n in CFG['background'] for m in low.get(n.lower(), [])}
    BACKN = {n.lower() for n in CFG['background']}
    PLANT = (low.get('plant') or [None])[0]
    with open(WORK / 'candidates.csv', encoding='utf-8') as f:
        cands = {c['id']: c for c in csv.DictReader(f)}
    with open(R3DIR / 'sort.csv', encoding='utf-8') as f:
        sort = {r['id']: r for r in csv.DictReader(f)}

    # every photo round 3 or round 2 used, or set apart: never a disagree photo
    used = set()
    for p in (R3DIR / 'lists').glob('*.txt'):
        used.update(read_r3_list(p.stem))
    for p in (R2 / 'lists').glob('*.txt'):
        used.update(read_r2_list(p.stem))
    with open(R3DIR / 'crops.csv', encoding='utf-8') as f:
        crop_rows = list(csv.DictReader(f))
    held_crop_ids = {r['id'] for r in crop_rows if r['role'] in ('val', 'test')}
    train_crop_ids = {r['id'] for r in crop_rows if r['role'] == 'train'}
    for role in ('val', 'test'):
        held_crop_ids.update(c[0] for c in read_r2_crops(role))
    used |= held_crop_ids

    # 1. classify (no stock run): one outline, 1% or more, not agreeing, in no list, outlines all of good quality
    cnt, near, pool = Counter(), 0, []
    for i, r in sort.items():
        if r['kind'] != 'train' or r['agree'] == '1' or r.get('set'):
            continue
        cnt['training-pool photos not agreeing with stock'] += 1
        if i in used:
            cnt['left out: in a round-2 or round-3 list'] += 1
            continue
        if int(r['nmasks']) != 1:
            cnt['left out: more than one outline'] += 1
            continue
        if float(r['all_share']) < 0.01:
            cnt['left out: outline under 1%'] += 1
            continue
        c = cands.get(i)
        if c is None or c.get('loose') == '1':
            cnt['left out: an outline dropped for its quality score'] += 1
            continue
        g, rc, pc, nr = classify(r)
        if g is None:
            cnt['left out: agrees after all'] += 1
            continue
        if g == 'O':
            cnt['left out: stock\'s subject too big (O)'] += 1
            continue
        near += nr
        lab = c.get('label', '')
        L = float(r['all_share'])
        if lab.lower() in BACKN and not (lab.lower() == 'plant' and 0.01 <= L < 0.05):
            cnt['left out: a background class (%s)' % lab] += 1
            continue
        pool.append({'id': i, 'group': g, 'kind': r['group'], 'cls': lab, 'all_share': L, 'r': round(rc, 4),
                     'p': round(pc, 4), 'err': r['err'], 'share': r['share']})
    log('Classified from round 3\'s sort table: %d candidates (%s); %d within 0.005 of a boundary.' % (
        len(pool), ', '.join('%s %d' % (g, sum(1 for x in pool if x['group'] == g)) for g in GROUPS), near))

    # 2. the box checks (the train box table, only these photos' rows; a minute or two)
    tb = WORK / 'lists-oi' / 'train-bbox.csv'
    if not tb.exists():
        fail('the training box table (work\\lists-oi\\train-bbox.csv) is missing: round 4 needs it. Send Claude this message.')
    box = defaultdict(list)
    log('Reading the training box table for %d photos (a minute or two)...' % len(pool))
    read_boxes4(tb, {x['id'] for x in pool}, box)
    kept = []
    for k, x in enumerate(pool):
        img, masks, labs = load_prep(x['id'])
        if len(masks) != 1:
            cnt['left out: outline count differs from the sort table'] += 1
            continue
        b = bbox(masks[0])
        if b is None:
            cnt['left out: empty outline'] += 1
            continue
        mb = (b[0] / SIDE, b[1] / SIDE, b[2] / SIDE, b[3] / SIDE)
        why = box_checks(box.get(x['id'], []), mb, labs[0] if labs else None, PLANT, BACK, EXCL)
        if why:
            cnt['left out: ' + why] += 1
            continue
        kept.append(x)
        if (k + 1) % 2000 == 0:
            log('   %d of %d checked' % (k + 1, len(pool)))
    pool = kept
    # 2b. (decision 83) the check detector (s6_detect, COCO Faster R-CNN, never shipped) over the photos left: a person, or
    # another object a quarter of the subject's size or more, that isn't the outlined subject → left out (Open Images'
    # box tables miss people and second subjects: the boy with the camel, the motorcycle's rider). Groups in
    # disagree.drop are left out first (no detector time spent on them).
    drop0 = set(DG.get('drop') or [])
    for x in [x for x in pool if x['group'] in drop0]:
        cnt['left out: group dropped (%s)' % x['group']] += 1
    pool = [x for x in pool if x['group'] not in drop0]
    if DG.get('detector', True):
        import s6_detect
        dev = device()
        dnet, dnames = s6_detect.detector()
        dnet = dnet.to(dev)
        log('Check detector over %d photos (once; cached in work\\detector\\disagree.json; about 10-15 minutes)...' % len(pool))
        dets = s6_detect.run([x['id'] for x in pool], lambda i: load_prep(i)[0], dev, dnet, dnames, 'disagree')
        del dnet
        kept = []
        for x in pool:
            why = det_reason(dets.get(x['id'], []), load_prep(x['id'])[1][0], s6_detect.SCENE, s6_detect.THR)
            if why:
                cnt['left out: ' + why] += 1
            else:
                kept.append(x)
        pool = kept
    with open(POOL, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['id', 'group', 'kind', 'cls', 'all_share', 'r', 'p', 'err', 'share'])
        w.writeheader()
        w.writerows(pool)
    (WORK / 'disagree-pool-counts.json').write_text(json.dumps({'cnt': cnt, 'near': near}, indent=1), encoding='utf-8')

    # 3. val_hard: held-out subjects photos (validation part, chosen without stock) that stock got wrong
    SEEN = set()
    for p in (R2 / 'lists').glob('*.txt'):
        SEEN.update(read_r2_list(p.stem))
    vh = sorted([i for i, r in sort.items() if r['kind'] == 'held' and r.get('set') == 'subjects' and r.get('part') == 'hv'
                 and float(r['stock_iou']) < 0.85 and i not in SEEN and i not in used], key=hkey)[:DG['val_hard_n']]
    for i in vh:
        save_label(i, np.any(load_prep(i)[1], axis=0))
    write_list('val_hard', vh)
    log('val_hard: %d held-out subjects photos stock got wrong (validation part).' % len(vh))
    build(pool, lists_only=False, t_start=t_start, cands=cands, train_crop_ids=train_crop_ids, held_crop_ids=held_crop_ids,
          SEEN=SEEN)


def read_pool():
    with open(POOL, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    for x in rows:
        x['all_share'] = float(x['all_share'])
    return rows


def build(pool, lists_only, t_start, cands=None, train_crop_ids=None, held_crop_ids=None, SEEN=None):
    """The lists from the checked pool: val_hard_small set apart, the drop list applied, all missed photos then wrong
    edge to the cap, the floor, the overlap checks, the labels, the counts, the previews (not with --lists-only)."""
    if cands is None:
        with open(WORK / 'candidates.csv', encoding='utf-8') as f:
            cands = {c['id']: c for c in csv.DictReader(f)}
    if held_crop_ids is None:
        with open(R3DIR / 'crops.csv', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
        held_crop_ids = {r['id'] for r in rows if r['role'] in ('val', 'test')}
        train_crop_ids = {r['id'] for r in rows if r['role'] == 'train'}
        for role in ('val', 'test'):
            held_crop_ids.update(c[0] for c in read_r2_crops(role))
    if SEEN is None:
        SEEN = set()
        for p in (R2 / 'lists').glob('*.txt'):
            SEEN.update(read_r2_list(p.stem))
    drop = set(DG.get('drop') or [])
    bad = drop - set(GROUPS)
    if bad:
        fail('config disagree.drop names %s: the groups are %s.' % (', '.join(sorted(bad)), ', '.join(GROUPS)))
    train = read_r3_list('train')
    sort = {}
    with open(R3DIR / 'sort.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            sort[r['id']] = r
    # small_agree (64): round 3's training photos with one outline, its share in [1%, 5%)
    small_agree = [i for i in train if i in sort and sort[i]['nmasks'] == '1' and 0.01 <= float(sort[i]['lshare']) < 0.05]
    write_list('small_agree', small_agree)
    # val_hard_small: small missed photos, set apart before the disagree photos are chosen (from groups kept)
    live = [x for x in pool if x['group'] not in drop]
    vhs = sorted([x for x in live if x['group'] in ('M-little', 'M-else') and 0.01 <= x['all_share'] < 0.05],
                 key=lambda x: hkey('vhs' + x['id']))[:DG['val_hard_small_n']]
    vhs_ids = {x['id'] for x in vhs}
    cap = round(DG['cap_of_train'] * len(train))
    miss = sorted([x for x in live if x['group'] in ('M-little', 'M-else') and x['id'] not in vhs_ids], key=lambda x: hkey(x['id']))
    edge = sorted([x for x in live if x['group'] == 'B' and x['id'] not in vhs_ids], key=lambda x: hkey(x['id']))
    chosen = (miss + edge)[:cap]
    if len(chosen) < DG['floor']:
        fail('only %d disagree photos are left (at least %d): round 4 isn\'t worth training. Send Claude results\\step4-counts.txt.'
             % (len(chosen), DG['floor']))
    dis = [x['id'] for x in chosen]
    # the overlap checks (D4): none of these may share a photo
    lists3 = {p.stem: set(read_r3_list(p.stem)) for p in (R3DIR / 'lists').glob('*.txt')}
    vh = set(l.strip() for l in open(LISTS / 'val_hard.txt', encoding='utf-8') if l.strip()) if (LISTS / 'val_hard.txt').exists() else set()
    against = dict(lists3)
    against.update({'held-out crops\' photos': held_crop_ids, 'round 2\'s photos': SEEN, 'val_hard': vh,
                    'val_hard_small': vhs_ids})
    clash = {k: len(set(dis) & v) for k, v in against.items() if set(dis) & v}
    trainsets = set(train) | set(dis)
    clash.update({'val_hard ∩ training': len(vh & trainsets), 'val_hard_small ∩ training': len(vhs_ids & trainsets)})
    clash = {k: v for k, v in clash.items() if v}
    if clash:
        fail('photos in two lists that must not share any (%s). Nothing is trained. Send Claude this message.' % ', '.join(
            '%s %d' % kv for kv in clash.items()))
    # the labels: the one outline at full size
    for i in dis + sorted(vhs_ids):
        save_label(i, load_prep(i)[1][0])
    write_list('disagree', dis)
    write_list('val_hard_small', sorted(vhs_ids, key=hkey))
    # the counts
    pc = json.loads((WORK / 'disagree-pool-counts.json').read_text(encoding='utf-8'))
    cnt, near = Counter(pc['cnt']), pc['near']
    band = lambda a: '1-5%' if a < 0.05 else '5-10%' if a < 0.1 else '10-30%' if a < 0.3 else '30%+'
    G = Counter(x['group'] for x in chosen)
    steps = len(train) + len(small_agree) + 2 * len(dis) + len(read_crops3())
    lines = ['Round 4: round 3\'s lists, crops and outlines kept as they were; round 3 shipped %s (the start and the '
             'benchmark).' % benchmark(),
             'Disagree photos chosen: %d (cap %d = a quarter of round 3\'s %d training photos; floor %d): %s; dropped groups: %s.' % (
                 len(dis), cap, len(train), DG['floor'], ', '.join('%s %d' % (g, G.get(g, 0)) for g in GROUPS),
                 ', '.join(sorted(drop)) or 'none'),
             'The checked pool before the cap: %s (val_hard_small %d set apart first).' % (
                 ', '.join('%s %d' % (g, sum(1 for x in pool if x['group'] == g)) for g in GROUPS), len(vhs_ids)),
             'Chosen by outline size: ' + '; '.join('%s %s' % (g, ', '.join('%s %d' % (b, sum(1 for x in chosen if x['group'] == g and band(x['all_share']) == b))
                                                                         for b in ('1-5%', '5-10%', '10-30%', '30%+'))) for g in GROUPS),
             'Chosen by kind: ' + ', '.join('%s %d' % kv for kv in sorted(Counter(x['kind'] for x in chosen).items())),
             'Chosen by class (top 20): ' + ', '.join('%s %d' % kv for kv in Counter(x['cls'] for x in chosen).most_common(20)),
             'Small (1-5%%) Plant outlines kept (decision 67): %d' % sum(1 for x in chosen if x['cls'].lower() == 'plant'),
             'Left out on the way: ' + ', '.join('%s %d' % kv for kv in sorted(cnt.items())),
             'Rows within 0.005 of a group boundary: %d' % near,
             'small_agree (round 3\'s one-outline 1-5%% training photos, shown twice): %d' % len(small_agree),
             'val_hard %d, val_hard_small %d' % (len(vh), len(vhs_ids)),
             'Step 5 sees each pass: %d photos (round 3\'s %d training + %d small_agree again + %d disagree twice + %d empty '
             'crops): disagree photos %.0f%% of it' % (steps, len(train), len(small_agree), len(dis), len(read_crops3()),
                                                         100 * 2 * len(dis) / max(1, steps)),
             'Disagree photos that also gave round 3 a training crop (reported; those crops are clear of every outline and box): %d'
             % len(set(dis) & (train_crop_ids or set())),
             'Time %.0f min' % ((time.time() - t_start) / 60)]
    for l in lines:
        log(l)
    old = (R3DIR / 'step4-counts.txt').read_text(encoding='utf-8') if (R3DIR / 'step4-counts.txt').exists() else ''
    (RESULTS / 'step4-counts.txt').write_text('\n'.join(lines) + '\n\nRound 3\'s step 4 (kept as it was):\n' + old,
                                              encoding='utf-8')
    # the attribution list: every photo a round-4 model learns from (round 3's, crops' photos included, and the new ones)
    learn = set(train) | set(read_r3_list('val')) | set(dis) | {c[0] for c in read_crops3()}
    with open(RESULTS / 'attribution.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['ImageID', 'Title', 'Author', 'AuthorProfileURL', 'License', 'OriginalLandingURL', 'OriginalURL'])
        for i in sorted(learn):
            c = cands.get(i)
            if c:
                w.writerow([i, c['Title'], c['Author'], c['AuthorProfileURL'], c['License'], c['OriginalLandingURL'], c['OriginalURL']])
    if not lists_only:
        previews(chosen)
    mark_done('s4')
    log('Step 4 done. Send Claude results\\step4-counts.txt and the results\\preview\\round4-*.jpg sheets (one a group kept), and wait for '
        'the go-ahead before step 5.' if not lists_only else
        'Step 4 (--lists-only) done. Send Claude results\\step4-counts.txt, and wait for the go-ahead before step 5.')


def read_crops3():
    with open(CROPS, encoding='utf-8') as f:
        return [(r['id'], int(r['x']), int(r['y']), int(r['s'])) for r in csv.DictReader(f) if r['role'] == 'train']


def previews(chosen):
    """72 photos, 24 a group (missed: 12 outlines of 10% or more, 12 under), each the photo, then the photo with the
    drawn outline (green) and stock's subject (magenta) over it; wrong-edge photos zoomed to the subject, 320 px."""
    pv = RESULTS / 'preview'
    pv.mkdir(exist_ok=True)
    for p in pv.glob('round4-*.jpg'):
        try:
            p.unlink()
        except OSError:
            pass
    dev = device()
    net = load_tracer().to(dev).eval()
    pick = {}
    for g in ('M-little', 'M-else'):
        xs = sorted([x for x in chosen if x['group'] == g], key=lambda x: hkey(DG.get('preview_salt', 'pv') + x['id']))
        big = [x for x in xs if x['all_share'] >= 0.1][:DG['preview_n'] // 2]
        small = [x for x in xs if x['all_share'] < 0.1][:DG['preview_n'] - len(big)]
        pick[g] = big + small
    pick['B'] = sorted([x for x in chosen if x['group'] == 'B'],
                       key=lambda x: hkey(DG.get('preview_salt', 'pv') + x['id']))[:DG['preview_n']]

    def overlay(img, L, S):
        o = img.astype(np.float32).copy()
        o[L & ~S] = 0.45 * o[L & ~S] + 0.55 * np.array([40, 200, 60])
        o[S & ~L] = 0.45 * o[S & ~L] + 0.55 * np.array([230, 40, 200])
        o[L & S] = 0.6 * o[L & S] + 0.4 * np.array([255, 255, 255])
        return o.astype(np.uint8)

    for g, xs in pick.items():
        if not xs:
            continue
        imgs = [load_prep(x['id']) for x in xs]
        ys = maps(net, [im for im, _, _ in imgs], dev)
        cells = []
        n = 320 if g == 'B' else 200
        for (img, masks, _), y in zip(imgs, ys):
            L = masks[0]
            S = np.asarray(Image.fromarray((y * 255).astype(np.uint8)).resize((SIDE, SIDE), Image.BILINEAR)) >= 128
            if g == 'B':
                b = bbox(L | S) if (L | S).any() else (0, SIDE, 0, SIDE)
                cx, cy = (b[0] + b[1]) / 2, (b[2] + b[3]) / 2
                h = max(b[1] - b[0], b[3] - b[2]) * 0.65 + 8
                x0, y0 = int(max(0, min(SIDE - 2 * h, cx - h))), int(max(0, min(SIDE - 2 * h, cy - h)))
                s = int(min(SIDE, 2 * h))
                img, L, S = img[y0:y0 + s, x0:x0 + s], L[y0:y0 + s, x0:x0 + s], S[y0:y0 + s, x0:x0 + s]
            a = np.asarray(Image.fromarray(img).resize((n, n), Image.BILINEAR))
            o = np.asarray(Image.fromarray(overlay(img, L, S)).resize((n, n), Image.BILINEAR))
            cells.append(np.pad(np.concatenate([a, o], axis=1), ((3, 3), (3, 3), (0, 0)), constant_values=180))
        per = 3 if g == 'B' else 4
        while len(cells) % per:
            cells.append(np.full_like(cells[0], 230))
        rows_ = [np.concatenate(cells[k:k + per], axis=1) for k in range(0, len(cells), per)]
        Image.fromarray(np.concatenate(rows_, axis=0)).save(pv / ('round4-%s.jpg' % g), quality=88)
    log('Previews: results\\preview\\round4-M-little.jpg, round4-M-else.jpg (the first 12 outlines of 10% or more, then 12 '
        'under), round4-B.jpg (zoomed to the subject). Green: the drawn outline only; magenta: stock\'s subject only; '
        'pale: both. A group stays if 20 or more of its 24 outlines look right.')
