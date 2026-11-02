# Shared helpers for the Marker Studio subject-model kit: settings, folders, logging, downloads that resume.
import json, os, sys, time, hashlib, pathlib, shutil, ssl, urllib.request, urllib.error, threading

KIT = pathlib.Path(__file__).resolve().parent
WORK = pathlib.Path(os.environ.get('MS_KIT_WORK') or (KIT / 'work'))          # downloads and prepared photos (big; can be deleted after the run)
RESULTS = pathlib.Path(os.environ.get('MS_KIT_RESULTS') or (KIT / 'results'))  # what comes back to Ben's Mac (small)
for d in (WORK, RESULTS):
    d.mkdir(parents=True, exist_ok=True)

# (MS_KIT_CONFIG: another settings file, for the kit's own test)
with open(os.environ.get('MS_KIT_CONFIG') or (KIT / 'config.json'), encoding='utf-8') as f:
    CFG = json.load(f)
# (for the kit's own tests: every Open Images address can be pointed at a local copy)
if os.environ.get('MS_KIT_BASE'):
    _b = os.environ['MS_KIT_BASE'].rstrip('/')

    def _local(v):
        if isinstance(v, dict):
            return {k: _local(x) for k, x in v.items()}
        return (v.replace('https://storage.googleapis.com', _b).replace('https://open-images-dataset.s3.amazonaws.com', _b + '/s3')
                .replace('https://github.com', _b + '/gh'))
    CFG['urls'] = _local(CFG['urls'])

_log_lock = threading.Lock()


def log(*a, step=None):
    msg = ' '.join(str(x) for x in a)
    line = time.strftime('%H:%M:%S ') + msg
    with _log_lock:
        print(line, flush=True)
        # (v4: Windows refuses while another program holds the log for a moment, a virus scanner: tried again, then this
        # line is in the window only, never a reason to stop)
        for i in range(3):
            try:
                with open(WORK / ((step or STEP) + '.log'), 'a', encoding='utf-8') as f:
                    f.write(line + '\n')
                break
            except OSError:
                time.sleep(0.5)


STEP = pathlib.Path(sys.argv[0]).stem


def done(name):
    """A marker that a part of a step finished, so running the step again skips it."""
    return (WORK / ('.done-' + name)).exists()


def mark_done(name):
    (WORK / ('.done-' + name)).write_text(time.strftime('%Y-%m-%d %H:%M:%S'))


def fail(msg):
    log('STOPPED: ' + msg)
    print('\n*** ' + msg + '\n*** Nothing is lost: fix that and run this step again; it carries on where it stopped.')
    sys.exit(1)


_ctx = None     # (None: Windows' own certificate list; after a certificate failure, certifi's list as well)


def _urlopen(req, timeout):
    """urlopen that, if Windows' certificate list can't vouch for a site (Windows fetches some root certificates only
    when a browser first needs them), tries again with certifi's list as well. Checking is never switched off."""
    global _ctx
    try:
        return urllib.request.urlopen(req, timeout=timeout, context=_ctx)
    except urllib.error.URLError as e:
        if _ctx is not None or not isinstance(getattr(e, 'reason', None), ssl.SSLCertVerificationError):
            raise
        import certifi
        c = ssl.create_default_context()
        c.load_verify_locations(cafile=certifi.where())
        _ctx = c
        print('   (a site\'s certificate was not in Windows\' list: using certifi\'s list as well)', flush=True)
        return urllib.request.urlopen(req, timeout=timeout, context=_ctx)


def head_size(url, tries=3):
    """The size in bytes of a file on the web (None if the server doesn't say)."""
    for i in range(tries):
        try:
            req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'ms-subject-kit'})
            with _urlopen(req, 60) as r:
                n = r.headers.get('Content-Length')
                return int(n) if n else None
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                raise
            time.sleep(2 * (i + 1))
        except Exception:
            time.sleep(2 * (i + 1))
    return None


def download(url, dest, tries=5, quiet=False):
    """Download url to dest, resuming a partial download; atomic (dest appears only when complete)."""
    dest = pathlib.Path(dest)
    if dest.exists():
        return dest
    part = dest.with_name(dest.name + '.part')
    for i in range(tries):
        try:
            have = part.stat().st_size if part.exists() else 0
            headers = {'User-Agent': 'ms-subject-kit'}
            if have:
                headers['Range'] = 'bytes=%d-' % have
            req = urllib.request.Request(url, headers=headers)
            with _urlopen(req, 120) as r:
                if have and r.status != 206:      # (the server ignored the resume: start again)
                    have = 0
                mode = 'ab' if have else 'wb'
                total = r.headers.get('Content-Length')
                total = (int(total) + have) if total else None
                got, last = have, time.time()
                with open(part, mode) as f:
                    while True:
                        b = r.read(1 << 20)
                        if not b:
                            break
                        f.write(b)
                        got += len(b)
                        if not quiet and total and time.time() - last > 5:
                            last = time.time()
                            print('   %s: %d of %d MB' % (dest.name, got >> 20, total >> 20), flush=True)
            if total and part.stat().st_size < total:
                raise IOError('short download')
            part.replace(dest)
            return dest
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                raise
            time.sleep(3 * (i + 1))
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))
    raise IOError('could not download ' + url)


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def gb_free(path=KIT):
    import shutil
    return shutil.disk_usage(path).free / 1e9


def device():
    import torch
    return torch.device('cuda' if torch.cuda.is_available() else 'cpu')


STOCK = {a: 'TRACER-Efficient-%s.pth' % a for a in '01234567'}          # (TRACER's own release weights)


def load_tracer(weights=None, arch=None):
    """TRACER (the kit's copy, tracer/): TE-0 unless arch says otherwise or the checkpoint records its arch (round 5
    on), with TRACER's own release weights or a trained checkpoint. net.arch and net.inp (its own input size: 320 for
    TE-0, 352 for TE-2) go with it; a TE-0 and a TE-2 can be held in one process."""
    import torch
    sys.path.insert(0, str(KIT))
    from tracer import TRACER, cfg_for
    sd = torch.load(weights or (WORK / STOCK[str(arch or '0')]), map_location='cpu', weights_only=True)
    if arch is None:
        arch = sd.get('arch', '0') if 'model' in sd else '0'
    net = TRACER(cfg_for(arch))
    sd = sd.get('model', sd)
    sd = {k.replace('module.', '', 1): v for k, v in sd.items()}
    net.load_state_dict(sd, strict=True)
    return net


MEAN = (0.485, 0.456, 0.406)
STD = (0.229, 0.224, 0.225)


# ---- round 3: round 2's material, kept apart before anything is cleared ----
R2 = WORK / 'round2'
SEEN_SETS = ('test_subjects', 'test_small', 'test_people', 'test_scenery')


def round2_safe():
    """Copies round 2's lists, crop list, sort table, A2plus's trained weights and the check photos' outlines to
    work/round2, once (steps 2 and 4 call this first, before they change anything). A copy made in full or not at all:
    a second run finds it there and does nothing."""
    if (R2 / 'lists' / 'train.txt').exists() and (R2 / 'A2plus-best.pt').exists() and (R2 / 'done').exists():
        return
    base = CFG['train'].get('baseline', 'A2plus')
    pt, lists, labels = WORK / 'runs' / base / 'best.pt', WORK / 'lists', WORK / 'labels'
    if not pt.exists() or not (lists / 'train.txt').exists() or not (WORK / 'crops.csv').exists():
        fail('round 2\'s results are not where they should be (work\\runs\\%s\\best.pt, work\\lists\\train.txt, work\\crops.csv). '
             'Nothing has been changed or deleted. Send Claude this message.' % base)
    log('Keeping round 2 apart (once): its lists, crops, %s\'s weights and the check photos\' outlines, into work\\round2...' % base)
    tmp = WORK / 'round2.tmp'
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / 'lists').mkdir(parents=True)
    (tmp / 'labels').mkdir()
    for p in lists.glob('*.txt'):
        shutil.copy2(p, tmp / 'lists' / p.name)
    for n in ('crops.csv', 'sort.csv'):
        if (WORK / n).exists():
            shutil.copy2(WORK / n, tmp / n)
    shutil.copy2(pt, tmp / 'A2plus-best.pt')
    if (pt.parent / 'history.json').exists():
        shutil.copy2(pt.parent / 'history.json', tmp / 'A2plus-history.json')
    miss = 0
    for name in SEEN_SETS:
        p = lists / (name + '.txt')
        for i in (l.strip() for l in open(p, encoding='utf-8')) if p.exists() else ():
            if i and (labels / (i + '.png')).exists():
                shutil.copy2(labels / (i + '.png'), tmp / 'labels' / (i + '.png'))
            elif i:
                miss += 1
    if miss:
        shutil.rmtree(tmp, ignore_errors=True)
        fail('%d of round 2\'s check outlines are missing from work\\labels. Nothing has been changed or deleted. Send Claude this message.' % miss)
    (tmp / 'done').write_text(time.strftime('%Y-%m-%d %H:%M:%S'))
    shutil.rmtree(R2, ignore_errors=True)
    tmp.rename(R2)
    log('Round 2 kept in work\\round2.')


def read_r2_list(name):
    p = R2 / 'lists' / (name + '.txt')
    return [l.strip() for l in open(p, encoding='utf-8') if l.strip()] if p.exists() else []


def read_r2_crops(role):
    import csv
    p = R2 / 'crops.csv'
    if not p.exists():
        return []
    with open(p, encoding='utf-8') as f:
        return [(r['id'], int(r['x']), int(r['y']), int(r['s'])) for r in csv.DictReader(f) if r['role'] == role]


# ---- round 4: round 3's material, kept apart before anything is cleared ----
R3DIR = WORK / 'round3'


def round3_safe():
    """Copies round 3's lists, crop list, sort table, A3's trained weights and history, its report and counts, and EVERY
    outline in work/labels (its training, validation and check photos', round 2's seen sets' too) to work/round3, once
    (steps 4 and 6 call this first when config round is 4 or more). A copy made in full or not at all: a second run
    finds it there and does nothing."""
    if (R3DIR / 'done').exists():
        return
    pt, lists, labels = WORK / 'runs' / 'A3' / 'best.pt', WORK / 'lists', WORK / 'labels'
    rep = RESULTS / 'report.json'
    need = [pt, lists / 'train.txt', WORK / 'crops.csv', WORK / 'sort.csv', rep]
    miss = [p.parent.name + '\\' + p.name for p in need if not p.exists()] + ([] if labels.exists() else ['work\\labels'])
    if miss:
        fail('round 3\'s results are not where they should be (missing: %s). Nothing has been changed or deleted. Send '
             'Claude this message.' % ', '.join(miss))
    log('Keeping round 3 apart (once): its lists, crops, sort table, A3\'s weights, its report and every outline, into '
        'work\\round3 (a few minutes)...')
    tmp = WORK / 'round3.tmp'
    shutil.rmtree(tmp, ignore_errors=True)
    (tmp / 'lists').mkdir(parents=True)
    for p in lists.glob('*.txt'):
        shutil.copy2(p, tmp / 'lists' / p.name)
    for n in ('crops.csv', 'sort.csv'):
        shutil.copy2(WORK / n, tmp / n)
    shutil.copy2(pt, tmp / 'A3-best.pt')
    if (pt.parent / 'history.json').exists():
        shutil.copy2(pt.parent / 'history.json', tmp / 'A3-history.json')
    for n in ('report.json', 'report.md', 'step4-counts.txt'):
        if (RESULTS / n).exists():
            shutil.copy2(RESULTS / n, tmp / n)
    shutil.copytree(labels, tmp / 'labels')
    (tmp / 'done').write_text(time.strftime('%Y-%m-%d %H:%M:%S'))
    shutil.rmtree(R3DIR, ignore_errors=True)
    tmp.rename(R3DIR)
    log('Round 3 kept in work\\round3 (%d outlines).' % sum(1 for _ in (R3DIR / 'labels').glob('*.png')))


def read_r3_list(name):
    p = R3DIR / 'lists' / (name + '.txt')
    return [l.strip() for l in open(p, encoding='utf-8') if l.strip()] if p.exists() else []


def benchmark():
    """Round 3's decision (work/round3/report.json): the model round 4 starts from and is judged against."""
    p = R3DIR / 'report.json'
    d = json.load(open(p, encoding='utf-8')).get('decision') if p.exists() else None
    if d not in ('A3', 'A2plus'):
        fail('round 3\'s report says "%s" shipped: round 4 needs A3 or A2plus as its starting point. Send Claude this '
             'message.' % d)
    return d


def benchmark_weights():
    return R3DIR / 'A3-best.pt' if benchmark() == 'A3' else R2 / 'A2plus-best.pt'
