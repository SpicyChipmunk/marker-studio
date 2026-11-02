# Step 4 (rounds 2 and 3): run stock TRACER-TE0 on every prepared photo and make the lists:
#   train / val      training-pool photos whose drawn outlines (the objects mostly inside stock's subject) agree with
#                    stock's subject to a pixel (config agree_err), subjects down to 1% of the photo; val is kept apart
#   crops            background crops with no drawn outline and no boxed object in them: for training ("empty" photos,
#                    where stock is quiet too), and from held-out photos for the checks (stock is not asked)
#   test_*           held-out photos (validation and test splits) labelled with ALL their outlines, chosen without
#                    stock: subjects (≥ 5%), small subjects (one outline, 1–5%), people (a whole-person outline),
#                    scenery (outlines under 0.3%); val_small from a separate part of the held-out pool. A photo is
#                    left out if its box table shows an un-outlined rival (not a background class such as a tree or a
#                    building) at least half the subject's size. Sets short of their size are topped up from the
#                    training pool (chosen without stock, with the same box checks, set aside by ID, never trained on
#                    or cropped)
# The photos' own work runs in several processes at once (config s4_workers); stock runs on the graphics card.
# Old labels and lists are cleared first. Writes work/labels, work/lists/*.txt, work/crops.csv, work/sort.csv,
# results/attribution.csv, results/step4-counts.txt and results/preview/*.jpg (12 photos of each set, to check by eye).
# Stops, with the counts, if there are too few training photos, small subjects or crops.
import csv, hashlib, json, os, random, shutil, time
from collections import Counter, defaultdict
import numpy as np
import torch
from PIL import Image
from common import (CFG, WORK, RESULTS, log, fail, mark_done, load_tracer, device, download, head_size, round2_safe, R2,
                    read_r2_list, read_r2_crops, SEEN_SETS)
from data import load_prep, maps, iou, agree_err, crop_img, LABELS, LISTS, CROPS, SIDE, INP
from s4_lib import Boxes, Prep, as_is

H, CR, GD = CFG['held'], CFG['crops'], CFG['guards']
hkey = lambda i: hashlib.sha1(i.encode()).hexdigest()
part = lambda i: 'hv' if int(hkey(i)[:4], 16) < H['val_part'] * 65536 else 'ht'


def save_label(iid, m):
    Image.fromarray((m * 255).astype(np.uint8)).save(LABELS / (iid + '.png'))


def read_boxes(path, keep, box):
    """A box table's rows for the photos in `keep` → box[id] = [(x0, x1, y0, y1, class, group-of or inside)]."""
    n = 0
    with open(path, encoding='utf-8') as f:
        rd = csv.reader(f)
        hd = next(rd)
        ix = {c: hd.index(c) for c in ('ImageID', 'LabelName', 'XMin', 'XMax', 'YMin', 'YMax')}
        ig = [hd.index(c) for c in ('IsGroupOf', 'IsInside') if c in hd]
        for r in rd:
            i = r[ix['ImageID']]
            if i not in keep:
                continue
            try:
                box[i].append((float(r[ix['XMin']]), float(r[ix['XMax']]), float(r[ix['YMin']]), float(r[ix['YMax']]),
                               r[ix['LabelName']], any(r[k] == '1' for k in ig)))
                n += 1
            except (ValueError, IndexError):
                pass
    return n


def main():
    if CFG.get('round', 2) >= 5:
        # (FINDINGS-AR D3: from round 5 the lists are round 3's, kept in work\round3; this step would delete every
        # trained model in work\runs, C1 included, and every step's done mark)
        fail('4-label is not part of round %d: running it would delete the trained models (C1 included). Nothing has '
             'been changed. Close this window.' % CFG['round'])
    if CFG.get('round', 2) >= 4:          # (round 4: round 3's lists kept, the disagree photos added: s4_round4.py)
        from s4_round4 import main4
        return main4()
    t_start = time.time()
    R3 = CFG.get('round', 2) >= 3
    if R3:
        round2_safe()          # (round 2's lists, crops, A2plus and check outlines kept apart before anything is cleared)
    shutil.rmtree(LABELS, ignore_errors=True)          # (a label left behind is harmless: every one used is written again)
    LABELS.mkdir(parents=True, exist_ok=True)
    LISTS.mkdir(exist_ok=True)
    for p in LISTS.glob('*.txt'):
        p.unlink()
    # (new lists make any training and checks done since stale: they are started afresh)
    for p in list(WORK.glob('.done-s5*')) + list(WORK.glob('.done-s6')) + list(WORK.glob('.done-s4')):
        p.unlink()
    for p in (WORK / 'runs').glob('baseline-*.json'):          # (the baseline's validation scores: measured again in step 5)
        p.unlink()
    for name in CFG['train']['runs']:
        if name != CFG['train'].get('baseline') and (WORK / 'runs' / name).exists():
            shutil.rmtree(WORK / 'runs' / name, ignore_errors=True)
    cls = json.load(open(WORK / 'classes.json', encoding='utf-8'))
    EXCL, PERSON, NAMES = set(cls['exclude']), set(cls['person']), cls['names']
    low = defaultdict(list)
    for m, d in NAMES.items():
        low[d.lower()].append(m)

    def mids(key):
        unk = [n for n in CFG[key] if n.lower() not in low]
        if unk:
            log('(%s names not among Open Images classes, ignored: %s)' % (key, ', '.join(unk)))
        return {m for n in CFG[key] for m in low.get(n.lower(), [])}

    BACK, SCENE = mids('background'), mids('scenery_classes')
    with open(WORK / 'candidates.csv', encoding='utf-8') as f:
        cands = {c['id']: c for c in csv.DictReader(f)}
    ids = sorted(i for i in cands if (WORK / 'prep' / (i + '.npz')).exists())
    kinds = {i: cands[i]['kind'] for i in ids}

    # the box tables: validation and test (from step 2), and the train split's (downloaded here once, ~1.2 GB)
    box = defaultdict(list)
    have = set(ids)
    for sp in CFG['splits']:
        for d in (WORK / 'lists-oi', WORK / 'lists'):
            if (d / (sp + '-bbox.csv')).exists():
                log('%s boxes: %d' % (sp, read_boxes(d / (sp + '-bbox.csv'), have, box)))
                break
    tb = WORK / 'lists-oi' / 'train-bbox.csv'
    U_TRAIN_BBOX = CFG['urls']['bbox_csv'].get('train')
    if not tb.exists() and U_TRAIN_BBOX:
        try:
            n = head_size(U_TRAIN_BBOX)
            log('Downloading the training photos\' box table (%s MB, once)' % (round(n / 1e6) if n else '?'))
            download(U_TRAIN_BBOX, tb)
        except Exception as e:
            if not CFG.get('train_boxes_optional'):
                fail('the training box table could not be downloaded (%s). Run 4-label again: the download carries on where it '
                     'stopped.' % e)
            log('NOTE: no training box table (%s): the top-ups and training crops go without the box check.' % e)
    train_boxes = tb.exists()
    if train_boxes:
        log('Reading the training box table (a minute or two)...')
        log('train boxes: %d' % read_boxes(tb, {i for i in ids if kinds[i] == 'train'}, box))
    boxes = Boxes(dict(box), BACK, SCENE, EXCL)
    dev = device()
    net = load_tracer().to(dev).eval()
    W = max(0, min(CFG.get('s4_workers', 6), (os.cpu_count() or 2) - 1))
    log('Sorting %d photos with stock TRACER on %s, the photos\' own work in %d processes' % (len(ids), dev, W))
    dl = torch.utils.data.DataLoader(Prep(ids, kinds, EXCL, PERSON, boxes), batch_size=None, shuffle=False, num_workers=W, collate_fn=as_is,
                                     multiprocessing_context='spawn' if W else None, prefetch_factor=4 if W else None)
    RD = INP / SIDE
    rows, tries, held_crops = [], [], []
    cnt = Counter()
    B, buf, n_done, t0 = 32, [], 0, time.time()

    def process(batch):
        ys = maps(net, [o['img'] for o in batch], dev)
        for o, y in zip(batch, ys):
            iid = o['id']
            c = cands[iid]
            S = y >= 0.5
            masks, labs, ms, L3 = o['masks'], o['labs'], o['ms'], o['L3']
            r = {'id': iid, 'kind': c['kind'], 'group': c['group'], 'share': round(float(S.mean()), 4), 'set': '',
                 'all_share': round(float(L3.mean()), 4), 'nmasks': len(masks), 'one': int(o['one'])}
            if c['kind'] == 'train':
                if o['excl']:
                    continue          # (step 2 already leaves these out of the training pool)
                keep = [k for k, m in enumerate(ms) if m.sum() and (m & S).sum() / m.sum() >= 0.5]
                Ub = np.zeros_like(S)
                for k in keep:
                    Ub |= ms[k]
                r['lshare'] = round(float(Ub.mean()), 4)
                r['err'] = round(agree_err(S, Ub), 4) if keep else 1.0
                r['agree'] = int(bool(keep) and r['lshare'] >= CFG['subject_min_share'] and r['err'] <= CFG['agree_err'])
                r['stock_iou'] = round(iou(S, L3), 4)
                r['topup_ok'] = int(not o['pbox'] and not o['rival'])
                if r['agree']:
                    save_label(iid, np.any(masks[keep], axis=0))
                # (empty-crop candidates, quiet in stock's map of the whole photo; checked by stock on the crop itself below)
                for lv, t in o['tries']:
                    x, yy, ss = t[1:]
                    reg = y[int(yy * RD):int((yy + ss) * RD), int(x * RD):int((x + ss) * RD)]
                    if reg.size and reg.mean() < CR['gate_loose'][0] * 3:
                        tries.append((lv, t))
                rows.append(r)
                continue
            # held-out photos: all their outlines, chosen without stock
            p = part(iid)
            r['part'] = p
            if o['excl']:
                pm = o['pm']
                if not pm:
                    continue
                P = np.any(masks[pm], axis=0)
                Pg = torch.nn.functional.max_pool2d(torch.as_tensor(P, dtype=torch.float32)[None, None], 9, 1, 4)[0, 0].numpy() > 0
                out_of = [k for k in range(len(labs)) if k not in pm and (masks[k] & ~Pg).sum() > 0.1 * max(1, masks[k].sum())]
                P3 = np.any([ms[k] for k in pm], axis=0)
                if out_of or P3.mean() < 0.05:
                    cnt['people: clothing outside the person, or small'] += 1
                elif o['rival_person']:
                    cnt['people: a rival in the box table'] += 1
                else:
                    r['set'], r['lshare'], r['stock_iou'] = 'people', round(float(P3.mean()), 4), round(iou(S, P3), 4)
                    save_label(iid, P)
                    rows.append(r)
                continue
            sh = float(L3.mean())
            r['lshare'] = round(sh, 4)
            if sh < H['scenery_mask_max']:
                if o['boxed']:
                    cnt['scenery: a boxed object'] += 1
                else:
                    r['set'] = 'scenery'
            elif o['one']:
                want = 'small' if (len(masks) == 1 and 0.01 <= sh < 0.05) else ('subjects' if sh >= 0.05 else '')
                if want and o['rival']:
                    cnt['%s: a rival in the box table' % want] += 1
                elif want:
                    r['set'] = want
            if r['set']:
                save_label(iid, np.any(masks, axis=0))
                r['stock_iou'] = round(iou(S, L3), 4)
            for k, t in enumerate(o['crops']):
                held_crops.append((p, k) + t)
            rows.append(r)

    for o in dl:
        if 'error' in o:
            cnt['unreadable photo file (skipped)'] += 1
            continue
        buf.append(o)
        if len(buf) == B:
            process(buf)
            n_done += len(buf)
            buf = []
            if (n_done // B) % 100 == 0:
                el = time.time() - t0
                log('%d of %d (about %.0f min left)' % (n_done, len(ids), el / n_done * (len(ids) - n_done) / 60))
    if buf:
        process(buf)
    for k, v in sorted(cnt.items()):
        log('Left out, %s: %d' % (k, v))

    # round 3: every photo round 2 used (its training, validation and check photos, and its crops' photos) is left out of
    # the fresh checks; round 2's check photos from the training pool are never trained on (they stay "seen" checks)
    SEEN, SEEN_TOPUP = set(), set()
    if R3:
        for p in (R2 / 'lists').glob('*.txt'):
            SEEN.update(read_r2_list(p.stem))
        for role in ('train', 'val', 'test'):
            SEEN.update(c[0] for c in read_r2_crops(role))
        SEEN_TOPUP = {i for k in SEEN_SETS + ('val_small',) for i in read_r2_list(k) if kinds.get(i) == 'train'}
        log('Round 2\'s photos left out of the fresh checks: %d (its check photos from the training pool, never trained on: %d)' % (
            len(SEEN), len(SEEN_TOPUP)))
    LOOSE = {i for i in ids if cands[i].get('loose') == '1'}
    # the held-out sets, and what each is short of
    by = lambda name, p: sorted([r for r in rows if r.get('set') == name and r.get('part') == p and r['id'] not in SEEN],
                                key=lambda r: hkey(r['id']))
    held_sets = {'test_small': by('small', 'ht')[:H['small_n']], 'val_small': by('small', 'hv')[:H['val_small_n']],
                 'test_subjects_pool': by('subjects', 'ht'),
                 'test_people': (by('people', 'ht') + by('people', 'hv'))[:H['people_n']],
                 'test_scenery': (by('scenery', 'ht') + by('scenery', 'hv'))[:H['scenery_n']]}
    # top-ups from the training pool, chosen without stock (one outline 1–5%; or one subject ≥ 5%) and, where the box
    # table has the photo, with no people box and no rival, as the hand-checked photos; set aside by ID
    tp = sorted([r for r in rows if r['kind'] == 'train' and r['topup_ok'] and r['id'] not in SEEN and r['id'] not in LOOSE],
                key=lambda r: hkey('topup' + r['id']))
    tp_small = [r for r in tp if r['nmasks'] == 1 and 0.01 <= r['all_share'] < 0.05]
    tp_subj = [r for r in tp if r['one'] and r['all_share'] >= 0.05]
    reserved = set(SEEN_TOPUP)

    def top_up(have, want, pool, name, hand=None):
        need = max(0, want - len(have))
        add = []
        for r in pool:
            if len(add) >= need:
                break
            if r['id'] not in reserved:
                reserved.add(r['id'])
                add.append(dict(r, set=name, lshare=r['all_share']))
        if add:
            log('%s: %d hand-checked, topped up with %d from the training pool' % (name, len(have) if hand is None else hand, len(add)))
        return have + add

    held_sets['test_small'] = top_up(held_sets['test_small'], H['small_n'], tp_small, 'test_small')
    held_sets['val_small'] = top_up(held_sets['val_small'], H['val_small_n'], tp_small, 'val_small')
    # (the subjects set's top-up, if one is needed, is set aside here too, before training is chosen)
    subj_topup = top_up([], max(0, H['subjects_n'] - len(held_sets['test_subjects_pool'])), tp_subj, 'test_subjects',
                        len(held_sets['test_subjects_pool']))
    for r in held_sets['test_small'] + held_sets['val_small'] + subj_topup:
        save_label(r['id'], np.any(load_prep(r['id'])[1], axis=0))

    # training and validation (training-pool photos that agree with stock, none set aside for the checks)
    agree = sorted([r for r in rows if r['kind'] == 'train' and r.get('agree') and r['id'] not in reserved], key=lambda r: hkey(r['id']))
    trows = [r for r in rows if r['kind'] == 'train']
    EB = [0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0, float('inf')]          # (the measure has no top: 1 or more is one bin)
    ec = Counter(next(k for k, b in enumerate(EB) if r.get('err', 1.0) < b) for r in trows if r.get('lshare', 0) >= CFG['subject_min_share'])
    pool_line = ('Agreeing training photos: %d (of them kept by the looser quality rule: %d); training-pool photos sorted: %d; '
                 'their disagreement with stock (subject 1%% or more): %s' % (
                     len(agree), sum(1 for r in agree if r['id'] in LOOSE), len(trows),
                     ', '.join(('under %g: %d' % (EB[k], ec.get(k, 0))) if EB[k] < float('inf') else ('1 or more: %d' % ec.get(k, 0))
                               for k in range(len(EB)))))
    log(pool_line)
    val = agree[:CFG['val_n']]
    vset = {r['id'] for r in val}
    train = agree[CFG['val_n']:CFG['val_n'] + CFG['train_target']]

    # the empty training crops: stock run on each crop itself; quiet ones kept, one a photo, the larger size first
    tries2 = [(lv, t) for lv, t in tries if t[0] not in reserved and t[0] not in vset]
    # (in rounds of distinct photos, each photo's larger tries first, until enough pass or the budget is spent)
    per = defaultdict(list)
    for lv, t in tries2:
        per[t[0]].append((lv, t))
    for v in per.values():
        v.sort(key=lambda x: x[0])
    order = sorted(per, key=hkey)
    stats, kept, n_lv = [], set(), Counter()
    for rd in range(max([len(v) for v in per.values()] + [0])):
        if len(kept) >= CR['train_n'] or len(stats) >= CR['max_eval']:
            break
        todo = [per[i][rd] for i in order if len(per[i]) > rd and i not in kept][:CR['max_eval'] - len(stats)]
        for s in range(0, len(todo), B):
            b = todo[s:s + B]
            imgs = [crop_img(load_prep(t[0])[0], *t[1:]) for _, t in b]
            for (lv, t), y in zip(b, maps(net, imgs, dev)):
                m, f = float(y.mean()), float((y >= 0.5).mean())
                stats.append((lv, t, m, f))
                n_lv[lv] += 1
                if m < CR['gate'][0] and f < CR['gate'][1]:
                    kept.add(t[0])

    def pick(gate):
        seen, out = set(), []
        for lv in range(len(CR['levels'])):
            for l2, t, m, f in stats:
                if l2 == lv and m < gate[0] and f < gate[1] and t[0] not in seen and len(out) < CR['train_n']:
                    seen.add(t[0])
                    out.append(t)
        return out

    crops_train = pick(CR['gate'])
    log('Empty crops: %d tried in %d photos (no outline or boxed object in them, quiet in the whole photo\'s map), %d kept (one '
        'a photo); tried by size: %s' % (len(stats), len(per), len(crops_train), ', '.join(
            '%d-%d%% wide %d' % (100 * CR['levels'][lv][0][0], 100 * CR['levels'][lv][0][1], n_lv[lv]) for lv in range(len(CR['levels'])))))
    if len(crops_train) < CR['min']:
        crops_train = pick(CR['gate_loose'])
        log('   too few: loosened to mean < %g and < %g over 0.5: %d' % (CR['gate_loose'][0], CR['gate_loose'][1], len(crops_train)))
    small_train = sum(1 for r in train if r['lshare'] < 0.05)
    LV = {t: lv for lv, t, _, _ in stats}
    # the subjects set, drawn by kind in the training pool's proportions
    gtr = Counter(r['group'] for r in agree)
    subj_all = held_sets.pop('test_subjects_pool')
    subj, rest = [], []
    for g, n in gtr.items():
        pool = [r for r in subj_all if r['group'] == g]
        k = round(H['subjects_n'] * n / max(1, len(agree)))
        subj += pool[:k]
        rest += pool[k:]
    rest += [r for r in subj_all if r['group'] not in gtr]
    subj += sorted(rest, key=lambda r: hkey(r['id']))[:max(0, H['subjects_n'] - len(subj))]
    subj = subj[:H['subjects_n'] - len(subj_topup)] + subj_topup
    sets = {'train': train, 'val': val, 'test_subjects': subj, **held_sets}

    # held-out crops for the checks: one a photo; a photo's second crop only if the set is short
    def held_pick(p, n):
        hc = sorted([t for t in held_crops if t[0] == p], key=lambda t: hkey(t[2]))
        out = [t[2:] for t in hc if t[1] == 0][:n]
        if len(out) < n:
            out += [t[2:] for t in hc if t[1] == 1][:n - len(out)]
        return out

    held_crops = [t for t in held_crops if t[2] not in SEEN]
    crops_val, crops_test = held_pick('hv', H['val_crops_n']), held_pick('ht', H['crops_n'])
    for k, v in sets.items():
        with open(LISTS / (k + '.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(r['id'] for r in v) + ('\n' if v else ''))
    with open(CROPS, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['role', 'id', 'x', 'y', 's'])
        for role, ts in (('train', crops_train), ('val', crops_val), ('test', crops_test)):
            for t in ts:
                w.writerow((role,) + tuple(t))
    with open(WORK / 'sort.csv', 'w', newline='', encoding='utf-8') as f:
        keys = ['id', 'kind', 'part', 'set', 'group', 'share', 'lshare', 'all_share', 'nmasks', 'err', 'agree', 'stock_iou']
        w = csv.DictWriter(f, fieldnames=keys, extrasaction='ignore')
        w.writeheader()
        moved = {r['id']: r for k in ('test_small', 'val_small', 'test_subjects') for r in sets[k] if r['kind'] == 'train'}
        w.writerows([moved.get(r['id'], r) for r in rows])

    BIN = [0.005, 0.01, 0.02, 0.05, 0.1, 0.3, 1.01]

    def hist(v):
        c = Counter(next(i for i, b in enumerate(BIN) if a < b) for a in v)
        lo = [0] + BIN[:-1]
        return ', '.join('%g-%g%% %d' % (lo[i] * 100, min(BIN[i], 1) * 100, c.get(i, 0)) for i in range(len(BIN)))

    src = lambda v: '%d (%d hand-checked)' % (len(v), sum(1 for r in v if r['kind'] == 'held'))
    lines = ['Training: %d photos (small 1-5%%: %d), empty crops %d (%s); validation: %d subjects, small %s, crops %d' % (
                 len(train), small_train, len(crops_train),
                 ', '.join('%d-%d%% wide %d' % (100 * CR['levels'][lv][0][0], 100 * CR['levels'][lv][0][1],
                                               sum(1 for t in crops_train if LV.get(t) == lv))
                           for lv in range(len(CR['levels']))),
                 len(val), src(sets['val_small']), len(crops_val)),
             'Checks: subjects %s, small %s, people %d, scenery %d, empty crops %d' % (
                 src(subj), src(sets['test_small']), len(sets['test_people']), len(sets['test_scenery']), len(crops_test)),
             'Training labels by subject size: ' + hist([r['lshare'] for r in train]),
             'Training photos by kind: ' + ', '.join('%s %d' % kv for kv in sorted(gtr.items())),
             'Left out of the checks: ' + ', '.join('%s %d' % kv for kv in sorted(cnt.items())),
             'Held-out empty crops found: test part %d (second crops %d), validation part %d (second %d)' % tuple(
                 sum(1 for t in held_crops if t[0] == p and t[1] == k) for p in ('ht', 'hv') for k in (0, 1)),
             pool_line,
             'Training box table: %s; time %.0f min' % ('used' if train_boxes else 'NOT available', (time.time() - t_start) / 60)]
    if R3:
        lines.insert(2, 'Round 3: the checks above are fresh (none of round 2\'s photos); round 2\'s checks are kept as "seen" sets: '
                     + ', '.join('%s %d' % (k[5:], len(read_r2_list(k))) for k in SEEN_SETS) + ', empty crops %d' % len(read_r2_crops('test')))
    for l in lines:
        log(l)
    (RESULTS / 'step4-counts.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    if R3:          # (round 2's check outlines, for step 6's "seen" sets: put back after this step cleared them)
        for p in (R2 / 'labels').glob('*.png'):
            shutil.copy2(p, LABELS / p.name)
    # preview sheets: 12 photos of each set, the photo beside its outline (or the crop alone)
    pv = RESULTS / 'preview'
    pv.mkdir(exist_ok=True)
    for p in pv.glob('*.jpg'):
        try:
            p.unlink()
        except OSError:          # (a sheet open in Photos: it is written over below, or left)
            pass

    def tile(img, L=None):
        t = np.asarray(Image.fromarray(img).resize((160, 160), Image.BILINEAR))
        if L is None:
            return t
        g = np.asarray(Image.fromarray(L.astype(np.uint8) * 255).resize((160, 160))) >= 128
        return np.where(g[..., None], t, 255).astype(np.uint8)

    def preview(name, items):
        if not items:
            return
        cells = [np.pad(np.concatenate([tile(a), tile(a, b)] if b is not None else [tile(a), tile(a)], axis=1),
                        ((3, 3), (3, 3), (0, 0)), constant_values=180) for a, b in items[:12]]
        while len(cells) % 3:
            cells.append(np.full_like(cells[0], 230))
        rows_ = [np.concatenate(cells[k:k + 3], axis=1) for k in range(0, len(cells), 3)]
        try:
            Image.fromarray(np.concatenate(rows_, axis=0)).save(pv / (name + '.jpg'), quality=85)
        except OSError:
            Image.fromarray(np.concatenate(rows_, axis=0)).save(pv / (name + '-new.jpg'), quality=85)

    lab = lambda i: (load_prep(i)[0], np.asarray(Image.open(LABELS / (i + '.png'))) >= 128)
    for k in ('test_subjects', 'test_small', 'test_people', 'test_scenery'):
        hand = [r['id'] for r in sets[k] if r['kind'] == 'held']
        top = [r['id'] for r in sets[k] if r['kind'] == 'train']
        preview(k[5:], [lab(i) for i in hand[:12]])
        preview(k[5:] + '-topup', [lab(i) for i in top[:12]])
    preview('crops', [(crop_img(load_prep(c[0])[0], *c[1:]), None) for c in crops_test[:12]])
    preview('crops-small', [(crop_img(load_prep(c[0])[0], *c[1:]), None) for c in sorted(crops_test, key=lambda c: c[3])[:12]])
    preview('train-crops', [(crop_img(load_prep(c[0])[0], *c[1:]), None) for c in crops_train[:12]])

    bad = []
    if len(train) < GD['min_pool']:
        bad.append('only %d training photos (at least %d)' % (len(train), GD['min_pool']))
    if small_train < GD['min_small_train']:
        bad.append('only %d training photos with a 1-5%% subject (at least %d)' % (small_train, GD['min_small_train']))
    if len(crops_train) < CR['min']:
        bad.append('only %d empty crops (at least %d)' % (len(crops_train), CR['min']))
    for k, n in (('test_subjects', 1000), ('test_small', 1000), ('test_people', 150)):
        if len(sets[k]) < n:
            log('NOTE: %s has %d photos, fewer than planned: its margins of error are wider, so the rule is harder to pass.' % (k, len(sets[k])))
    if len(crops_test) < H['crops_rule_min']:
        log('NOTE: only %d held-out empty crops: the false-subject line will be reported, not a rule. Tell Claude.' % len(crops_test))
    # the attribution list: every photo the model learns from, crops' photos included (CC BY 2.0 asks for credit)
    with open(RESULTS / 'attribution.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['ImageID', 'Title', 'Author', 'AuthorProfileURL', 'License', 'OriginalLandingURL', 'OriginalURL'])
        for i in sorted({r['id'] for r in train + val} | {t[0] for t in crops_train}):
            c = cands[i]
            w.writerow([i, c['Title'], c['Author'], c['AuthorProfileURL'], c['License'], c['OriginalLandingURL'], c['OriginalURL']])
    if bad:
        fail('; '.join(bad) + '. Send Claude results\\step4-counts.txt and this window\'s last lines.')
    mark_done('s4')
    log('Step 4 done. Send Claude results\\step4-counts.txt and the results\\preview pictures, and wait for the go-ahead before step 5.')


if __name__ == '__main__':
    main()
