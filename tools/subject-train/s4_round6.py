# Round 6's new photos (PLAN-round6 draft 2, decisions 116, 123, 130, 131, 134-136), into work\round6. It changes nothing
# that rounds 2-5 made (their lists, outlines, prepared photos and trained models stay as they are); it adds:
#   people set      decision 116: Open Images TRAIN-split photos of people (IDs starting 0, 1 or 2, the training pool's
#                   own prefixes, so nothing leaks into the fresh slice), every outline's quality score >= 0.7, the
#                   held-out people rule (round 3's step 4: the people outlined, nothing else outlined outside them, at
#                   least 5% of the photo, no rival in the box table) and no un-outlined person in the box table. The
#                   24-photo sheet comes FIRST (results\round6-people-sheet.jpg): Ben checks it while the rest downloads.
#   fresh slice     decision 123: train-split photos never used (IDs starting 3; then 4 and 5, only until enough small
#                   subjects stay after the check detector): small subjects (one outline, 1-5% of the photo, quality
#                   >= 0.7, no people box, no rival), a reported people set (the rule above) and empty crops.
#   full size       decision 136: every new photo also kept squashed to 640 x 640 (work\round6\full640), as 1e-bigger's
#                   cache; and decision 134: round 3's fresh subjects, small subjects and people fetched again at 640.
#   lists           decision 130: round 3's 800 people with the bench's photos left out (people_judge); decision 135:
#                   round 3's small_agree photos, checked against every check list (the step stops if one is shared).
# Restartable: a photo already prepared is skipped, the detector's answers are cached, and every list is made again
# the same way. Writes work\round6\..., results\round6-prep.txt, results\round6-people-sheet.jpg and
# results\attribution-round6.csv.
import csv, hashlib, io, json, random, shutil, statistics, threading, time, zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont
from common import (CFG, KIT, WORK, RESULTS, log, download, head_size, mark_done, gb_free, R2, R3DIR, SEEN_SETS,
                    read_r2_list, read_r2_crops, read_r3_list)
from common import fail as _fail
import data
from data import down, dilate, SIDE
from s4_lib import Boxes, crop_tries, mboxes, outside, sq_iou

csv.field_size_limit(1 << 30)
C6 = CFG['round6']
CP, CS = C6['people'], C6['slice']
Q, FULL_SIDE = C6['quality'], C6['full_side']
H, CR = CFG['held'], CFG['crops']
U = CFG['urls']
R6 = WORK / 'round6'
PREP6, LAB6, FULL6, LIST6, TMP6 = data.PREP6, R6 / 'labels', R6 / 'full640', R6 / 'lists', R6 / 'tmp'
ZDIR = WORK / 'masks'
hkey = lambda i: hashlib.sha1(i.encode()).hexdigest()
OUT = []          # the counts, written to results\round6-prep.txt


def say(*a):
    msg = ' '.join(str(x) for x in a)
    OUT.append(msg)
    log(msg)


def fail(msg):
    """common.fail, with the counts so far written first (results\\round6-prep.txt)."""
    try:
        (RESULTS / 'round6-prep.txt').write_text('\n'.join(OUT + ['', 'STOPPED: ' + msg]) + '\n', encoding='utf-8')
    except OSError:
        pass
    _fail(msg)


# ---- Open Images' tables (s2_lists.py's fetch and read_split, COPIED: s2 runs its whole step when imported) ----
def fetch(url, name):
    for d in (WORK / 'lists-oi', WORK / 'lists'):
        if (d / name).exists():
            return d / name
    dest = WORK / 'lists-oi' / name
    dest.parent.mkdir(exist_ok=True)
    try:
        n = head_size(url)
    except Exception as e:
        fail('cannot reach %s (%s)' % (url, e))
    log('Downloading %s (%s MB, once)' % (name, round(n / 1e6) if n else '?'))
    download(url, dest)
    return dest


def read_train(prefixes):
    """The train split's outlines and info rows for photo IDs starting with one of `prefixes`: {id: {'masks': [(path,
    class, quality or None, box area, box)], 'meta': info row}} for the photos with an info row, upright and CC BY 2.0;
    every outline's quality score printed (all of them: no cap)."""
    seg = fetch(U['seg_csv'].format(split='train'), 'train-seg.csv')
    info = fetch(U['info_csv']['train'], 'train-info.csv')
    masks = defaultdict(list)
    with open(seg, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['ImageID'][0] not in prefixes:
                continue
            try:
                pv = float(r.get('PredictedIoU') or '')
                pv = None if pv != pv else pv
            except ValueError:
                pv = None
            try:
                bx = (float(r['BoxXMin']), float(r['BoxXMax']), float(r['BoxYMin']), float(r['BoxYMax']))
            except ValueError:
                bx = (0, 0, 0, 0)
            masks[r['ImageID']].append((r['MaskPath'], r['LabelName'], pv, (bx[1] - bx[0]) * (bx[3] - bx[2]), bx))
    pv = [x[2] for v in masks.values() for x in v]
    sc = sorted(x for x in pv if x is not None)
    say('Train split, IDs starting %s: %d outlines on %d photos; a quality score on %d (%.0f%%; median %.2f); at least %.1f: %d '
        '(%.0f%% of all outlines)' % (', '.join(sorted(prefixes)), len(pv), len(masks), len(sc), 100 * len(sc) / max(1, len(pv)),
                                      statistics.median(sc) if sc else float('nan'), Q, sum(1 for x in sc if x >= Q),
                                      100 * sum(1 for x in sc if x >= Q) / max(1, len(pv))))
    need = ('ImageID', 'OriginalURL', 'OriginalLandingURL', 'License', 'Author', 'AuthorProfileURL', 'Title', 'Rotation')
    out, cnt = {}, Counter()
    with open(info, encoding='utf-8-sig') as f:
        rd = csv.DictReader(f)
        miss = [c for c in need if c not in (rd.fieldnames or [])]
        if miss:
            fail('%s has no %s columns (it has: %s).' % (info.name, ', '.join(miss), ', '.join(rd.fieldnames or [])))
        for r in rd:
            if r['ImageID'] not in masks:
                continue
            if r['Rotation'] not in ('', 'nan', '0', '0.0'):
                cnt['turned'] += 1
            elif 'creativecommons.org/licenses/by/2.0' not in r['License']:
                cnt['not CC BY 2.0'] += 1
            else:
                out[r['ImageID']] = {'masks': masks[r['ImageID']], 'meta': {k: r.get(k, '') for k in need}}
    cnt['no info row'] = len(masks) - len(out) - cnt['turned'] - cnt['not CC BY 2.0']
    say('   usable (upright, CC BY 2.0, an info row): %d; left out: %s' % (len(out), ', '.join('%s %d' % kv for kv in sorted(cnt.items()))))
    return out


# ---- one photo prepared as step 3 does (s3_photos.py's one(), COPIED), plus its 640 copy (decision 136) ----
_local = threading.local()


def zfile(ch):
    zs = getattr(_local, 'zs', None)
    if zs is None:
        zs = _local.zs = {}
    if ch not in zs:
        zf = zipfile.ZipFile(ZDIR / ('train-masks-%s.zip' % ch))
        zs[ch] = (zf, {n.rsplit('/', 1)[-1]: n for n in zf.namelist()})
    return zs[ch]


def prep_one(c):
    iid = c['id']
    out, skip, full = PREP6 / (iid + '.npz'), PREP6 / (iid + '.skip'), FULL6 / (iid + '.jpg')
    if out.exists() and full.exists():
        return 'ok'
    if skip.exists():
        return 'skipped'
    jpg = TMP6 / (iid + '.jpg')
    try:
        download(U['photo'].format(split='train', id=iid), jpg, tries=4, quiet=True)
    except Exception as e:
        skip.write_text('photo: %s' % e)
        return 'nophoto'
    try:
        with Image.open(jpg) as im0:          # (closed at once: Windows keeps an open file locked)
            im0.load()
            im = im0.convert('RGB')          # (pixels as stored: the masks are drawn on them; EXIF turning not applied)
        W, Hh = im.size
        z, where = zfile(iid[0])
        ms, labs = [], []
        for path, lab in c['masks']:
            with z.open(where[path]) as f:
                m = Image.open(io.BytesIO(f.read()))
                m.load()
            mw, mh = m.size
            if abs(mw / mh - W / Hh) > 0.02 * (W / Hh):
                skip.write_text('mask shape %dx%d vs photo %dx%d' % (mw, mh, W, Hh))
                return 'shape'
            m = np.asarray(m.convert('L').resize((SIDE, SIDE), Image.BILINEAR)) >= 128
            ms.append(np.packbits(m))
            labs.append(lab)
        im.resize((FULL_SIDE, FULL_SIDE), Image.BICUBIC).save(full.with_suffix('.tmp.jpg'), 'JPEG', quality=95)
        full.with_suffix('.tmp.jpg').replace(full)
        if not out.exists():
            b = io.BytesIO()
            im.resize((SIDE, SIDE), Image.BICUBIC).save(b, 'JPEG', quality=95)
            np.savez(out.with_suffix('.tmp.npz'), jpg=np.frombuffer(b.getvalue(), np.uint8), masks=np.stack(ms),
                     labels=np.array(labs), size=np.array([W, Hh]))
            out.with_suffix('.tmp.npz').replace(out)
        return 'ok'
    except KeyError:
        skip.write_text('mask not in zip')
        return 'nomask'
    except Exception as e:
        skip.write_text('error: %s' % e)
        return 'error'
    finally:
        try:
            jpg.unlink()
        except OSError:
            pass


def prep_all(cands, what):
    """Prepares the photos (16 at a time); returns the IDs prepared."""
    todo = [c for c in cands if not (PREP6 / (c['id'] + '.npz')).exists() or not (FULL6 / (c['id'] + '.jpg')).exists()]
    todo = [c for c in todo if not (PREP6 / (c['id'] + '.skip')).exists()]
    if todo:
        t0, res, n = time.time(), Counter(), 0
        log('%s: downloading and preparing %d photos...' % (what, len(todo)))
        with ThreadPoolExecutor(C6.get('threads', 16)) as ex:
            for r in ex.map(prep_one, todo):
                res[r] += 1
                n += 1
                if n % 500 == 0:
                    log('   %d of %d (%s), about %.0f min left' % (n, len(todo), ', '.join('%s %d' % kv for kv in sorted(res.items())),
                                                                  (time.time() - t0) / n * (len(todo) - n) / 60))
        log('   %s: %s (%.0f min)' % (what, ', '.join('%s %d' % kv for kv in sorted(res.items())), (time.time() - t0) / 60))
    return [c['id'] for c in cands if (PREP6 / (c['id'] + '.npz')).exists()]


def zips(prefixes):
    """The train split's mask zip files for these ID prefixes (work\\masks, as step 3: no question asked)."""
    ZDIR.mkdir(exist_ok=True)
    for ch in prefixes:
        z = ZDIR / ('train-masks-%s.zip' % ch)
        if z.exists():
            continue
        url = U['seg_zip'].format(split='train', c=ch)
        try:
            n = head_size(url)
        except Exception as e:
            fail('cannot reach the masks for train/%s (%s)' % (ch, e))
        log('Downloading train-masks-%s.zip (%s MB)' % (ch, round(n / 1e6) if n else '?'))
        download(url, z)


# ---- the rules ----
def people_rule(iid, masks, labs, boxes, PERSON):
    """Round 3's held-out people rule (s4_label.py, COPIED) plus no un-outlined person in the box table. -> (label, why)."""
    pm = [k for k, l in enumerate(labs) if l in PERSON]
    if not pm:
        return None, 'no person outline'
    P = np.any(masks[pm], axis=0)
    Pg = torch.nn.functional.max_pool2d(torch.as_tensor(P, dtype=torch.float32)[None, None], 9, 1, 4)[0, 0].numpy() > 0
    if any(k not in pm and (masks[k] & ~Pg).sum() > 0.1 * max(1, masks[k].sum()) for k in range(len(labs))):
        return None, 'another outline outside the people'
    if np.any([down(masks[k]) for k in pm], axis=0).mean() < CP['min_share']:
        return None, 'people under %g%% of the photo' % (100 * CP['min_share'])
    if boxes.rival(iid, masks[pm]):
        return None, 'a rival in the box table'
    mb = mboxes(masks[pm])
    if any(b[4] in PERSON and outside(b, mb) and (b[1] - b[0]) * (b[3] - b[2]) >= CP['stray_person_box'] for b in boxes.box.get(iid, ())):
        return None, 'an un-outlined person in the box table'
    return P, ''


def small_rule(iid, masks, labs, boxes, EXCL):
    if len(masks) != 1 or labs[0] in EXCL:
        return None, 'not one outline'
    sh = float(down(masks[0]).mean())
    if not 0.01 <= sh < 0.05:
        return None, 'outline not 1-5% of the photo'
    if boxes.people(iid):
        return None, 'a person or clothing box'
    if boxes.rival(iid, masks):
        return None, 'a rival in the box table'
    return masks[0], ''


def held_crops(iid, masks, boxes):
    """Up to two empty crops of a photo, as round 3's step 4 cut the held-out ones (s4_lib.Prep, COPIED)."""
    L = np.any(masks, axis=0) if len(masks) else np.zeros((SIDE, SIDE), bool)
    allm, rng, got = dilate(L, CR['dilate']), random.Random(iid), []
    for sz, n in H['crop_levels']:
        for t in crop_tries(iid, allm, sz, n, rng, boxes):
            if not got or sq_iou(got[0], t) < 0.3:
                got.append(t)
            if len(got) >= 2:
                break
        if len(got) >= 2:
            break
    return got


def save_label(iid, m):
    Image.fromarray((m * 255).astype(np.uint8)).save(LAB6 / (iid + '.png'))


def load6(iid):
    with np.load(PREP6 / (iid + '.npz')) as z:
        img = np.asarray(Image.open(io.BytesIO(z['jpg'].tobytes())).convert('RGB'))
        masks = np.unpackbits(z['masks'], axis=1)[:, :SIDE * SIDE].reshape(-1, SIDE, SIDE).astype(bool)
        return img, masks, [str(x) for x in z['labels']], tuple(int(v) for v in z['size'])


# ---- the people sheet (decision 116: Ben checks 24 photos; at least 20 good) ----
def sheet(ids, path):
    T = 300
    font = ImageFont.load_default(size=26)

    def cell(iid):
        img, _, _, (W, Hh) = load6(iid)
        L = np.asarray(Image.open(LAB6 / (iid + '.png'))) >= 128
        k = T / max(W, Hh)
        tw, th = max(1, round(W * k)), max(1, round(Hh * k))
        a = np.asarray(Image.fromarray(img).resize((tw, th), Image.BICUBIC)).astype(np.float32)
        m = np.asarray(Image.fromarray(L.astype(np.uint8) * 255).resize((tw, th), Image.BILINEAR)) >= 128
        b = np.where(m[..., None], a, 0.35 * a + 0.65 * 255)
        edge = dilate(m, 2) & ~m
        b[edge] = (230, 20, 20)
        c = np.full((T + 8, 2 * T + 16, 3), 255, np.uint8)
        c[4 + (T - th) // 2:4 + (T - th) // 2 + th, 4 + (T - tw) // 2:4 + (T - tw) // 2 + tw] = a.astype(np.uint8)
        c[4 + (T - th) // 2:4 + (T - th) // 2 + th, T + 12 + (T - tw) // 2:T + 12 + (T - tw) // 2 + tw] = b.astype(np.uint8)
        return c

    cells = [cell(i) for i in ids]
    cols = 3
    rows = (len(cells) + cols - 1) // cols
    ch, cw = cells[0].shape[:2]
    big = Image.new('RGB', (cols * cw, rows * (ch + 36)), (255, 255, 255))
    d = ImageDraw.Draw(big)
    for n, c in enumerate(cells):
        x, y = (n % cols) * cw, (n // cols) * (ch + 36)
        big.paste(Image.fromarray(c), (x, y + 36))
        d.text((x + 8, y + 4), '%d' % (n + 1), fill=(0, 0, 0), font=font)
        d.line([(x, y), (x + cw, y)], fill=(200, 200, 200))
    try:
        big.save(path, quality=90)
    except OSError:          # (the sheet open in Photos: written beside it)
        big.save(path.with_name(path.stem + '-new.jpg'), quality=90)


SHEET_RULE = ('Each pair: the photo, then its outline (everything outside it faded, the edge in red). A photo is BAD if the '
              'outline leaves out a person who is clearly part of the subject, or a clear part of one (more than a little '
              'at the edge), or takes in something that is neither a person nor what they wear (a chair, a dog, a wall). '
              'Small people in the background or cut off at the edge may be left out; a held thing (a bag, a phone) in '
              'or out is fine. At least %d of the %d good: the sheet passes (decision 116). Tell Claude the numbers of '
              'the bad ones.')


def write_list(name, ids):
    with open(LIST6 / (name + '.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(ids) + ('\n' if ids else ''))


def ids_in_lists(folder):
    out = set()
    for p in folder.glob('*.txt'):
        out.update(l.strip() for l in open(p, encoding='utf-8') if l.strip())
    return out


def crop_ids(p, roles=None):
    if not p.exists():
        return set()
    with open(p, encoding='utf-8') as f:
        return {r['id'] for r in csv.DictReader(f) if roles is None or r['role'] in roles}


def bench_ids():
    """The photo-to-page bench's 903 photos (bench_photos.py): from its index if it is here, else the kit's copy."""
    out = {l.strip() for l in open(KIT / 'bench_ids.txt', encoding='utf-8') if l.strip()}
    p = KIT / 'bench-photos' / 'index.csv'
    if p.exists():
        with open(p, encoding='utf-8') as f:
            out |= {r['id'] for r in csv.DictReader(f)}
    return out


def main():
    t_start = time.time()
    for d in (PREP6, LAB6, FULL6, LIST6, TMP6):
        d.mkdir(parents=True, exist_ok=True)
    miss = [str(p) for p in (R2 / 'done', R3DIR / 'done', R3DIR / 'sort.csv', R3DIR / 'lists' / 'train.txt', WORK / 'classes.json',
                             WORK / 'candidates.csv') if not p.exists()]
    if miss:
        fail('missing: %s. Nothing has been changed. Send Claude this message.' % ', '.join(miss))
    if gb_free() < C6['min_free_gb'] and not (R6 / 'done').exists():
        fail('only %.0f GB free on this drive: this step needs at least %d GB (its photos and the mask zip files; the zip '
             'files can be deleted afterwards for the training runs). Free some space and run this again.' % (gb_free(), C6['min_free_gb']))
    cls = json.load(open(WORK / 'classes.json', encoding='utf-8'))
    EXCL, PERSON, NAMES = set(cls['exclude']), set(cls['person']), cls['names']
    low = defaultdict(list)
    for m, dn in NAMES.items():
        low[dn.lower()].append(m)
    mids = lambda key: {m for n in CFG[key] for m in low.get(n.lower(), [])}
    BACK, SCENE = mids('background'), mids('scenery_classes')

    # every photo an earlier round or the bench used: never one of round 6's new photos
    with open(WORK / 'candidates.csv', encoding='utf-8') as f:
        used = {r['id'] for r in csv.DictReader(f)}
    used |= ids_in_lists(R2 / 'lists') | ids_in_lists(R3DIR / 'lists') | ids_in_lists(WORK / 'lists')
    used |= crop_ids(R2 / 'crops.csv') | crop_ids(R3DIR / 'crops.csv') | crop_ids(WORK / 'crops.csv')
    BENCH = bench_ids()
    used |= BENCH
    say('Photos earlier rounds or the bench used (none of them is a round-6 photo): %d (bench %d)' % (len(used), len(BENCH)))

    # ---- the tables ----
    # decision 135: round 3's small_agree photos by their rule (s4_round4.py), checked against the list round 5 made
    sort = {}
    with open(R3DIR / 'sort.csv', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            sort[r['id']] = r
    train3 = read_r3_list('train')
    sa = [i for i in train3 if i in sort and sort[i]['nmasks'] == '1' and 0.01 <= float(sort[i]['lshare']) < 0.05]
    have = data.read_list('small_agree')
    if have and set(have) != set(sa):
        fail('work\\lists\\small_agree.txt (%d photos) differs from its rule on round 3\'s lists (%d). Nothing has been changed. '
             'Send Claude this message.' % (len(have), len(sa)))

    pp, sp = CP['prefixes'], CS['prefixes']
    log('Reading Open Images\' train tables (5-10 minutes; nothing is shown meanwhile)...')
    T = read_train(set(pp) | set(sp))
    good = lambda v: all(x[2] is not None and x[2] >= Q for x in v['masks'])
    people_c, slice_c = defaultdict(list), defaultdict(lambda: {'small': [], 'people': [], 'other': []})
    cnt = Counter()
    for iid, v in T.items():
        if iid in used:
            cnt['used before'] += 1
            continue
        if not good(v):
            cnt['an outline under quality %.1f or unscored' % Q] += 1
            continue
        labs = {x[1] for x in v['masks']}
        c = {'id': iid, 'masks': [(x[0], x[1]) for x in v['masks']]}
        ch = iid[0]
        if ch in pp:
            if labs & PERSON:
                people_c[ch].append(c)
        elif labs & PERSON:
            slice_c[ch]['people'].append(c)
        elif not labs & EXCL:
            big = max(v['masks'], key=lambda x: x[3])
            if len(v['masks']) == 1 and 0.01 <= big[3] < 0.08:
                slice_c[ch]['small'].append(c)
            else:
                slice_c[ch]['other'].append(c)
    order = lambda cs: sorted(cs, key=lambda c: hkey(c['id']))
    PC = order([c for ch in pp for c in people_c[ch]])
    say('Left out before downloading: %s' % ', '.join('%s %d' % kv for kv in sorted(cnt.items())))
    say('People-set candidates (IDs %s, a person outlined, every outline good): %d' % (', '.join(pp), len(PC)))
    for ch in sp:
        s = slice_c[ch]
        say('Fresh slice, IDs %s: small-subject candidates (one outline, its box 1-8%%) %d, people %d, other photos %d' % (
            ch, len(s['small']), len(s['people']), len(s['other'])))

    # the train box table (round 3's step 4 downloaded it once; read for these photos only)
    tb = WORK / 'lists-oi' / 'train-bbox.csv'
    if not tb.exists():
        url = U['bbox_csv'].get('train')
        if not url:
            fail('no address for the training box table in config.json. Send Claude this message.')
        log('Downloading the training photos\' box table (once, ~1.2 GB)...')
        download(url, tb)
    from s4_label import read_boxes          # (s4_label runs nothing when imported)
    keep = {c['id'] for c in PC} | {c['id'] for ch in sp for k in ('small', 'people', 'other') for c in slice_c[ch][k]}
    box = defaultdict(list)
    log('Reading the training box table for %d photos (a few minutes)...' % len(keep))
    say('Train box rows for these photos: %d' % read_boxes(tb, keep, box))
    boxes = Boxes(dict(box), BACK, SCENE, EXCL)

    # ---- 1. the people set, its sheet first ----
    zips(pp)
    why, people, at, sheet_done = Counter(), [], 0, False
    sheet_path = RESULTS / 'round6-people-sheet.jpg'
    while len(people) < CP['n'] and at < len(PC):
        # (the next round sized by the pass rate seen so far, with a fifth spare)
        rate = max(0.05, len(people) / max(1, at))
        k = max(200, int(1.2 * (CP['n'] - len(people)) / rate)) if sheet_done else 160
        chunk = PC[at:at + k]
        at += len(chunk)
        ok = set(prep_all(chunk, 'People set'))
        if len(chunk) > 500:
            log('   checking them against the people rule (a few minutes; nothing is shown meanwhile)...')
        for c in chunk:
            if len(people) >= CP['n']:
                break
            if c['id'] not in ok:
                why['could not be prepared'] += 1
                continue
            _, masks, labs, _ = load6(c['id'])
            L, w = people_rule(c['id'], masks, labs, boxes, PERSON)
            if L is None:
                why[w] += 1
                continue
            save_label(c['id'], L)
            people.append(c['id'])
        if not sheet_done and len(people) >= CP['sheet']:
            sheet(people[:CP['sheet']], sheet_path)
            sheet_done = True
            log('')
            log('*** THE PEOPLE SHEET IS READY: results\\round6-people-sheet.jpg. Please check it now (the rest carries on). ***')
            log(SHEET_RULE % (CP['sheet_pass'], CP['sheet']))
            log('')
    write_list('people_train', people)
    say('People set: %d (of %d candidates looked at; left out: %s)' % (len(people), at, ', '.join('%s %d' % kv for kv in sorted(why.items()))))
    if not sheet_done:
        fail('fewer than %d people photos passed the rule (%d). Send Claude results\\round6-prep.txt.' % (CP['sheet'], len(people)))
    if len(people) < CP['min']:
        fail('only %d people photos passed the rule (at least %d needed). Send Claude this window\'s last lines.' % (len(people), CP['min']))
    if len(people) < CP['n']:
        say('NOTE: the people set has %d photos, fewer than the %d planned (every candidate was looked at).' % (len(people), CP['n']))

    # ---- 2. the fresh slice: small subjects until enough stay after the check detector; reported people; crops ----
    import s6_detect
    small, p3, crop_src, used_pref = [], [], [], []
    swhy, pwhy = Counter(), Counter()
    kept = 0
    for ch in sp:
        used_pref.append(ch)
        zips(ch)
        s = slice_c[ch]
        cand = order(s['small'])[:max(0, CS['small_max'] - len(small))]
        ok = set(prep_all(cand, 'Fresh slice %s, small subjects' % ch))
        for c in cand:
            if c['id'] not in ok:
                swhy['could not be prepared'] += 1
                continue
            _, masks, labs, _ = load6(c['id'])
            crop_src.append(c['id'])
            L, w = small_rule(c['id'], masks, labs, boxes, EXCL)
            if L is None:
                swhy[w] += 1
                continue
            save_label(c['id'], L)
            small.append(c['id'])
        if len(used_pref) == 1:          # (the reported people set: the first slice prefix only)
            pc, pat = order(s['people']), 0
            while len(p3) < CS['people_n'] and pat < len(pc):
                rate = max(0.05, len(p3) / pat) if pat else 0.25
                chunk = pc[pat:pat + max(200, int(1.2 * (CS['people_n'] - len(p3)) / rate))]
                pat += len(chunk)
                okp = set(prep_all(chunk, 'Fresh slice %s, people (reported)' % ch))
                for c in chunk:
                    if len(p3) >= CS['people_n']:
                        break
                    if c['id'] not in okp:
                        pwhy['could not be prepared'] += 1
                        continue
                    _, masks, labs, _ = load6(c['id'])
                    L, w = people_rule(c['id'], masks, labs, boxes, PERSON)
                    if L is None:
                        pwhy[w] += 1
                        continue
                    save_label(c['id'], L)
                    p3.append(c['id'])
        flagged, _ = s6_detect.flags(small, [])
        kept = sum(1 for i in small if i not in flagged)
        say('Fresh small subjects after IDs %s: %d (%s); the check detector sets apart %d, leaving %d (wanted at least %d)' % (
            ', '.join(used_pref), len(small), ', '.join('%s %d' % kv for kv in sorted(swhy.items())), len(small) - kept, kept,
            CS['small_after_detector']))
        if kept >= CS['small_after_detector'] or len(small) >= CS['small_max']:
            break
    if kept < CS['small_after_detector']:
        say('NOTE: %d fresh small subjects after the detector, fewer than the %d planned: its margins of error are wider.' % (
            kept, CS['small_after_detector']))
    write_list('small', small)
    write_list('people_p3', p3)
    say('Fresh people (IDs %s, reported only): %d (%s)' % (used_pref[0], len(p3), ', '.join('%s %d' % kv for kv in sorted(pwhy.items()))))

    # empty crops: one a photo (a second only if short), from the slice's photos, then more slice photos if needed
    def crops_of(ids):
        out = []
        for i in ids:
            _, masks, _, _ = load6(i)
            for k, t in enumerate(held_crops(i, masks, boxes)):
                out.append((k, t))
        return out

    tries = crops_of(crop_src)
    if sum(1 for k, _ in tries if k == 0) < CS['crops_n']:
        extra = order([c for ch in used_pref for c in slice_c[ch]['other']])
        n_x = 0
        while sum(1 for k, _ in tries if k == 0) < CS['crops_n'] and n_x < min(len(extra), CS['crop_photos_max']):
            chunk = extra[n_x:n_x + min(CS['crop_photos_max'] - n_x, max(200, int(1.5 * (CS['crops_n'] - sum(1 for k, _ in tries if k == 0)))))]
            n_x += len(chunk)
            got = prep_all(chunk, 'Fresh slice, more photos for empty crops')
            tries += crops_of(got)
            crop_src += got
    firsts = sorted([t for k, t in tries if k == 0], key=lambda t: hkey(t[0]))
    crops = firsts[:CS['crops_n']]
    if len(crops) < CS['crops_n']:
        crops += sorted([t for k, t in tries if k == 1], key=lambda t: hkey(t[0]))[:CS['crops_n'] - len(crops)]
    with open(R6 / 'crops.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['role', 'id', 'x', 'y', 's'])
        for t in crops:
            w.writerow(('test',) + tuple(t))
    _, cflag = s6_detect.flags([], crops)
    say('Fresh empty crops: %d from %d photos; the check detector sets apart %d, leaving %d' % (
        len(crops), len({t[0] for t in crops}), len(cflag), len(crops) - len(cflag)))

    # ---- 3. round 3's fresh checks again at 640 (decision 134) ----
    import s1d_sizes as S
    S.FULL, S.FULL_SIDE = FULL6, FULL_SIDE
    r3 = sorted(set(read_r3_list('test_subjects')) | set(read_r3_list('test_small')) | set(read_r3_list('test_people')))
    old = WORK / 'probe6' / 'full'          # (1e-bigger's 640 cache: copied, not fetched again)
    n_cp = 0
    for i in r3:
        if not (FULL6 / (i + '.jpg')).exists() and (old / (i + '.jpg')).exists():
            shutil.copy2(old / (i + '.jpg'), FULL6 / (i + '.jpg'))
            n_cp += 1
    log('Round 3\'s fresh subjects, small subjects and people at %d (%d copied from 1e-bigger\'s cache)...' % (FULL_SIDE, n_cp))
    got = S.fetch_full(r3)
    say('Round 3\'s fresh checks at %d: %d of %d photos' % (FULL_SIDE, len(got), len(r3)))
    new = people + small + p3 + sorted(set(crop_src))
    say('New photos at %d: %d of %d' % (FULL_SIDE, sum(1 for i in new if (FULL6 / (i + '.jpg')).exists()), len(new)))

    # ---- 4. lists: round 3's people without the bench's photos (130); small_agree checked (135) ----
    pj = [i for i in read_r3_list('test_people') if i not in BENCH]
    write_list('people_judge', pj)
    say('People judged (round 3\'s %d, the bench\'s photos left out): %d' % (len(read_r3_list('test_people')), len(pj)))
    write_list('small_agree', sa)
    check = set()
    for k in SEEN_SETS + ('val_small',):
        check |= set(read_r2_list(k))
    for p in (R3DIR / 'lists').glob('*.txt'):
        if p.stem != 'train':
            check |= set(read_r3_list(p.stem))
    for p in (WORK / 'lists').glob('*.txt'):
        if p.stem.startswith('val') or p.stem.startswith('test'):
            check |= set(data.read_list(p.stem))
    for role in ('val', 'test'):
        check |= {c[0] for c in read_r2_crops(role)}
    check |= crop_ids(R3DIR / 'crops.csv', ('val', 'test'))
    check |= BENCH | set(small) | set(p3) | {t[0] for t in crops}
    bad = set(sa) & check
    say('small_agree (round 3\'s one-outline 1-5%% training photos, shown twice a pass, decision 135): %d; in a check list: %d' % (len(sa), len(bad)))
    if bad:
        fail('%d small_agree photos are also check photos (e.g. %s). Nothing is lost. Send Claude this message.' % (len(bad), sorted(bad)[0]))
    bad = set(people) & (check | used | set(train3))
    if bad:
        fail('%d people-set photos are also used elsewhere (e.g. %s). Send Claude this message.' % (len(bad), sorted(bad)[0]))

    # ---- the record ----
    with open(R6 / 'photos.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['id', 'role'])
        for role, ids in (('people_train', people), ('small', small), ('people_p3', p3), ('crop_photo', sorted({t[0] for t in crops}))):
            for i in ids:
                w.writerow([i, role])
    with open(RESULTS / 'attribution-round6.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['ImageID', 'Title', 'Author', 'AuthorProfileURL', 'License', 'OriginalLandingURL', 'OriginalURL'])
        for i in sorted(people):
            m = T[i]['meta']
            w.writerow([i, m['Title'], m['Author'], m['AuthorProfileURL'], m['License'], m['OriginalLandingURL'], m['OriginalURL']])
    sk = Counter()
    for p in PREP6.glob('*.skip'):
        sk[p.read_text(encoding='utf-8', errors='replace').split(':')[0].split(' ')[0]] += 1
    say('Photos that could not be prepared (left out for good, so a rerun gives the same sets): %s' % (
        ', '.join('%s %d' % kv for kv in sorted(sk.items())) or 'none'))
    shutil.rmtree(TMP6, ignore_errors=True)
    sz = sum(p.stat().st_size for p in R6.rglob('*') if p.is_file()) / 1e9
    say('work\\round6: %.1f GB; %.0f GB free; time %.0f min' % (sz, gb_free(), (time.time() - t_start) / 60))
    say('The people sheet: results\\round6-people-sheet.jpg. ' + SHEET_RULE % (CP['sheet_pass'], CP['sheet']))
    (RESULTS / 'round6-prep.txt').write_text('\n'.join(OUT) + '\n', encoding='utf-8')
    (R6 / 'done').write_text(time.strftime('%Y-%m-%d %H:%M:%S'))
    mark_done('s4r6')
    log('Round 6\'s photos done. Send Claude results\\round6-prep.txt and the bad sheet numbers (if any). The mask zip files in '
        'work\\masks can be deleted now if you need the space.')


if __name__ == '__main__':
    main()
