# Step 1: check this PC is ready — Python, PyTorch, the graphics card, disk space, the web addresses — and fetch
# TRACER's own weights (checked against their known SHA-256).
import sys, platform
from common import CFG, WORK, log, fail, download, sha256, gb_free, head_size, mark_done

log('Python', sys.version.split()[0], 'on', platform.platform())
if sys.version_info < (3, 10):
    fail('Python 3.10 or newer is needed (the README says 3.12).')
try:
    import torch, numpy, PIL, onnx, onnxruntime  # noqa: F401 (each one checked here)
except ImportError as e:
    fail('a package is missing (%s): run 0-setup again.' % e)
log('PyTorch', torch.__version__, '| numpy', numpy.__version__, '| onnx', onnx.__version__, '| onnxruntime', onnxruntime.__version__)
if torch.cuda.is_available():
    p = torch.cuda.get_device_properties(0)
    log('Graphics card:', p.name, '| memory %.1f GB' % (p.total_memory / 1e9), '| CUDA', torch.version.cuda)
    x = torch.randn(256, 256, device='cuda')
    log('A test sum on the card:', round(float((x @ x).sum().abs().log()), 2), '(any number means it works)')
else:
    import os
    if not os.environ.get('MS_KIT_CPU'):
        fail('PyTorch cannot see an NVIDIA graphics card. Update the NVIDIA driver (README, step 1) and run 0-setup again.')
    log('No graphics card: running on the processor (the kit test only).')
free = gb_free()
log('Free disk space here: %.0f GB' % free)
if free < CFG.get('min_free_gb', 25):
    fail('at least 25 GB free is needed on this drive (photos are deleted as soon as they are prepared, but downloads need room).')
# the web addresses
for k in ('classes',):
    try:
        n = head_size(CFG['urls'][k])
        log('Reachable:', CFG['urls'][k], '(%s MB)' % (round(n / 1e6, 1) if n else '?'))
    except Exception as e:
        fail('cannot reach %s (%s). Is the PC online?' % (CFG['urls'][k], e))
# TRACER's weights
w = WORK / 'TRACER-Efficient-0.pth'
if not w.exists():
    log('Downloading TRACER-TE0 weights (30 MB) from the authors\' GitHub release')
    download(CFG['urls']['tracer'], w)
h = sha256(w)
if h != CFG['tracer_sha256']:
    w.unlink()
    fail('the TRACER weights did not match their known fingerprint (deleted). Run this step again.')
log('TRACER weights OK (SHA-256 matches)')
# (round 5) the bigger TRACER models' weights, from the same release (config stock_arches: TE2 and TE4)
ARCHES = [str(a) for a in CFG.get('stock_arches', ['2'])]
for a in ARCHES:
    w2 = WORK / ('TRACER-Efficient-%s.pth' % a)
    if not w2.exists():
        log('Downloading TRACER-TE%s weights (%d MB) from the authors\' GitHub release' % (a, CFG.get('tracer%s_bytes' % a, 0) // 1000000))
        download(CFG['urls']['tracer' + a], w2)
    if sha256(w2) != CFG['tracer%s_sha256' % a]:
        w2.unlink()
        fail('the TRACER-TE%s weights did not match their known fingerprint (deleted). Run this step again.' % a)
    log('TRACER-TE%s weights OK (SHA-256 matches)' % a)
from common import load_tracer, device
for arch in ['0'] + ARCHES:
    net = load_tracer(arch=arch).to(device()).eval()
    with torch.no_grad():
        y = net(torch.zeros(1, 3, net.inp, net.inp, device=device()))[0]
    if tuple(y.shape) != (1, 1, net.inp, net.inp):
        fail('TRACER-TE%s gave a map of the wrong size %s. Send Claude this message.' % (arch, tuple(y.shape)))
    log('TRACER-TE%s runs here: input %d, output %s' % (arch, net.inp, tuple(y.shape)))
    del net
mark_done('s1')
log('Step 1 done. Next: 2-lists.')
