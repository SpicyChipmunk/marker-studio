# The kit's vendored TRACER against TRACER's ORIGINAL code (an unchanged clone of github.com/Karel911/TRACER: torch.fft,
# torch.quantile, the in-place zeroing), both in PyTorch on the processor, same weights, same input:
#   python3 -I equiv_upstream.py <kit folder> <TRACER repo folder> <weights .pth> <arch 0|2> [photo folder]
# The input size is the arch's own (TE-0 320, TE-2 352). Upstream's from_pretrained (an ImageNet download) is replaced
# by from_name, as the kit does (the release weights replace every backbone weight); its .cuda() is a no-op here.
import sys, glob
import numpy as np, torch
kit, repo, w, arch = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
photos = sys.argv[5] if len(sys.argv) > 5 else None
torch.set_grad_enabled(False)
sd = {k.replace('module.', '', 1): v for k, v in torch.load(w, map_location='cpu', weights_only=True).items()}

sys.path.insert(0, kit)
from tracer import TRACER as KitTRACER, cfg_for, IMG_SIZE
size = IMG_SIZE[arch]
kn = KitTRACER(cfg_for(arch))
kn.load_state_dict(sd, strict=True)
kn.eval()
assert kn.inp == size and kn.arch == arch
sys.path.remove(kit)
for m in [m for m in sys.modules if m == 'tracer' or m.startswith('tracer.')]:
    del sys.modules[m]

sys.path.insert(0, repo)
sys.argv = ['equiv', 'test', '--arch', arch, '--img_size', str(size)]
torch.Tensor.cuda = lambda self, *a, **k: self          # (upstream's mask_radial(...).cuda(): stay on the processor)
from model.EfficientNet import EfficientNet
EfficientNet.from_pretrained = classmethod(lambda cls, name, advprop=False, **k: cls.from_name(name))
from config import getConfig
from model.TRACER import TRACER as UpTRACER
ucfg = getConfig()
un = UpTRACER(ucfg)
un.load_state_dict(sd, strict=True)
un.eval()
print('arch', arch, 'size', size, '| upstream settings: radius', ucfg.frequency_radius, 'denoise', ucfg.denoise,
      'gamma', ucfg.gamma, 'block_idx', un.block_idx, 'channels', un.channels, '| kit', kn.block_idx, kn.channels)
assert list(un.block_idx) == list(kn.block_idx) and list(un.channels) == list(kn.channels)
nparams = sum(p.numel() for p in kn.parameters())
print('parameters %.2fM, blocks %d' % (nparams / 1e6, len(kn.model._blocks)))

g = torch.Generator().manual_seed(3)
x = (torch.rand(2, 3, size, size, generator=g) - 0.45) / 0.226
a, b = kn(x)[0], un(x)[0]
print('noise: max diff %.2e, map %s' % (float((a - b).abs().max()), tuple(a.shape)))
worst = 0.0
from PIL import Image
for f in sorted(glob.glob(photos + '/*.jpg'))[:8] if photos else []:
    im = np.asarray(Image.open(f).convert('RGB').resize((size, size), Image.BILINEAR), np.float32) / 255
    xx = torch.from_numpy(((im - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).astype(np.float32).transpose(2, 0, 1)[None])
    a, b = kn(xx)[0], un(xx)[0]
    d = float((a - b).abs().max())
    flips = int(((a >= 0.5) != (b >= 0.5)).sum())
    worst = max(worst, d)
    print('%s subject %.3f max diff %.2e, pixels on the other side of 0.5: %d of %d' % (
        f.split('/')[-1], float((a >= 0.5).float().mean()), d, flips, size * size))
print('worst on photos %.2e' % worst)
