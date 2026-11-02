# Copies TRACER's model code (github.com/Karel911/TRACER, Apache 2.0) into the kit's tracer/ package, with the changes
# listed in tracer/NOTICE.md applied (each one asserted, so a changed upstream file fails loudly). Run from anywhere:
#   python3 -I vendor.py <TRACER repo folder> <kit folder>
import sys, shutil, pathlib
src, kit = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out = kit / 'tracer'
out.mkdir(parents=True, exist_ok=True)
def rep(s, a, b, n=1):
    assert s.count(a) == n, (a[:60], s.count(a))
    return s.replace(a, b)
# TRACER.py
s = (src / 'model/TRACER.py').read_text()
s = rep(s, 'from model.EfficientNet import EfficientNet\nfrom util.effi_utils import get_model_shape\nfrom modules.att_modules import RFB_Block, aggregation, ObjectAttention',
        'from .EfficientNet import EfficientNet\nfrom .effi_utils import get_model_shape\nfrom .att_modules import RFB_Block, aggregation, ObjectAttention\nfrom .cfg import cfg')
s = rep(s, "self.model = EfficientNet.from_pretrained(f'efficientnet-b{cfg.arch}', advprop=True)",
        "self.model = EfficientNet.from_name(f'efficientnet-b{cfg.arch}')  # (weights come from TRACER's own release, loaded after)")
s = rep(s, '        self.block_idx, self.channels = get_model_shape()\n',
        '        self.block_idx, self.channels = get_model_shape(cfg.arch)  # (Marker Studio: the arch per model, not global)\n'
        '        self.arch, self.inp = cfg.arch, IMG_SIZE[cfg.arch]\n')
s = rep(s, 'from .cfg import cfg', 'from .cfg import cfg, IMG_SIZE')
(out / 'TRACER.py').write_text(s)
# EfficientNet.py
s = (src / 'model/EfficientNet.py').read_text()
s = rep(s, 'from util.effi_utils import (', 'from .effi_utils import (')
s = rep(s, 'from modules.att_modules import Frequency_Edge_Module\nfrom config import getConfig', 'from .att_modules import Frequency_Edge_Module\nfrom .cfg import cfg')
s = rep(s, '\ncfg = getConfig()\n', '\n')
s = rep(s, '    def __init__(self, blocks_args=None, global_params=None):\n',
        '    def __init__(self, blocks_args=None, global_params=None, arch=None):\n')
s = rep(s, '        self.block_idx, self.channels = get_model_shape()\n',
        '        self.block_idx, self.channels = get_model_shape(arch)  # (Marker Studio: the arch per model)\n')
s = rep(s, '        model = cls(blocks_args, global_params)\n',
        "        model = cls(blocks_args, global_params, arch=model_name.split('-b')[-1])  # (Marker Studio)\n")
(out / 'EfficientNet.py').write_text(s)
# effi_utils.py
s = (src / 'util/effi_utils.py').read_text()
s = rep(s, 'from config import getConfig', 'from .cfg import cfg')
s = rep(s, '\ncfg = getConfig()\n', '\n')
s = rep(s, "def get_model_shape():\n    if cfg.arch == '0':",
        "def get_model_shape(arch=None):\n    arch = cfg.arch if arch is None else arch  # (Marker Studio: the arch per model)\n    if arch == '0':")
s = rep(s, "    elif cfg.arch == '", "    elif arch == '", 7)
(out / 'effi_utils.py').write_text(s)
# conv_modules.py
shutil.copy(src / 'modules/conv_modules.py', out / 'conv_modules.py')
# att_modules.py
s = (src / 'modules/att_modules.py').read_text()
s = rep(s, 'from torch.fft import fft2, fftshift, ifft2, ifftshift\nfrom util.utils import *\n', 'import math\nimport torch\n')
s = rep(s, 'from config import getConfig\nfrom modules.conv_modules import BasicConv2d, DWConv, DWSConv\n\ncfg = getConfig()\n',
        'from .conv_modules import BasicConv2d, DWConv, DWSConv\nfrom .cfg import cfg\n')
old_fwd = s[s.index('        x_fft = fft2(x, dim=(-2, -1))'):s.index('        x_H, _ = self.UAM.Channel_Tracer(x_H)')]
s = s.replace(old_fwd, '''        # (Marker Studio: the FFT high-pass as DFT matrix products, the same sums; ONNX Runtime Web has no FFT)
        B, C, H, W = x.shape
        if getattr(self, '_dft', None) is None or self._dft[0] != (H, W) or self._dft[1].device != x.device:
            def mats(N):
                k = torch.arange(N, dtype=torch.float64)
                ang = 2 * math.pi * torch.outer(k, k) / N
                return torch.cos(ang).float().to(x.device), torch.sin(ang).float().to(x.device)
            FrH, FiH = mats(H)
            FrW, FiW = mats(W)
            # (the radial mask as upstream's mask_radial makes it, distances from rows / 2 on both axes, worked out in
            # numpy so the exported graph holds it as a constant)
            import numpy as _np
            ii, jj = _np.meshgrid(_np.arange(H), _np.arange(W), indexing='ij')
            m = (_np.sqrt((ii - H / 2) ** 2 + (jj - H / 2) ** 2) < self.radius).astype(_np.float32)
            Mp = torch.from_numpy(_np.fft.ifftshift(1 - m).copy()).float().to(x.device)
            self._dft = ((H, W), FrH, FiH, FrW, FiW, Mp)
        _, FrH, FiH, FrW, FiW, Mp = self._dft
        # (in float32 even under mixed precision: half precision loses these sums)
        with torch.autocast(device_type=x.device.type, enabled=False):
            x32 = x.float()
            Ar, Ai = FrH @ x32, -(FiH @ x32)
            Xr, Xi = Ar @ FrW + Ai @ FiW, Ai @ FrW - Ar @ FiW
            Zr, Zi = Xr * Mp, Xi * Mp
            Br, Bi = FrH @ Zr - FiH @ Zi, FrH @ Zi + FiH @ Zr
            Yr, Yi = Br @ FrW - Bi @ FiW, Br @ FiW + Bi @ FrW
            x_H = (torch.sqrt(Yr * Yr + Yi * Yi + 1e-12) / (H * W)).to(x.dtype)

''')
old_mask = s[s.index('    def masking(self, x, mask):'):s.index('    def Channel_Tracer(self, x):')]
s = s.replace(old_mask, '''    def masking(self, x, mask):
        # (Marker Studio: torch.quantile, linear, as a sort; the in-place zeroing as a where: the same values)
        m = mask.squeeze(3).squeeze(2)
        C = m.shape[-1]
        srt, _ = torch.sort(m, dim=-1)
        pos = self.confidence_ratio * (C - 1)
        lo, hi = int(math.floor(pos)), int(math.ceil(pos))
        th = srt[:, lo:lo + 1] + (srt[:, hi:hi + 1] - srt[:, lo:lo + 1]) * (pos - lo)
        m = torch.where(m <= th, torch.zeros_like(m), m)
        m = m.unsqueeze(2).unsqueeze(3).expand(-1, x.shape[1], x.shape[2], x.shape[3])
        return x * m

''')
s = rep(s, '        edge = mask_bg.clone()\n        edge[edge > cfg.denoise] = 0\n',
        '        edge = torch.where(mask_bg > cfg.denoise, torch.zeros_like(mask_bg), mask_bg)  # (Marker Studio: not in place)\n')
assert '.cuda()' not in s.split('def mask_radial')[0] or True
(out / 'att_modules.py').write_text(s)
(out / 'cfg.py').write_text('''# TRACER's settings (upstream reads them from the command line, config.py), fixed at its defaults. Only the arch
# and its input size differ between TE-0 to TE-4: frequency_radius, denoise and gamma are the same for each.
IMG_SIZE = {'0': 320, '1': 320, '2': 352, '3': 384, '4': 448, '5': 512, '6': 576, '7': 640}          # (upstream's README: TE-0 and TE-1 at 320, TE-2 352, TE-3 384, TE-4 448, TE-5 512, TE-6 576, TE-7 640)


class _Cfg:
    RFB_aggregated_channel = [32, 64, 128]
    frequency_radius = 16
    denoise = 0.93
    gamma = 0.1

    def __init__(self, arch='0'):
        assert arch in IMG_SIZE, arch
        self.arch = arch


cfg = _Cfg('0')          # (the module-wide one: TE-0, what every model's shared settings are read from)


def cfg_for(arch):
    """The settings for one model: TRACER(cfg_for('2')) is TE-2, beside a TE-0 in the same process."""
    return _Cfg(str(arch))
''')
(out / '__init__.py').write_text('from .TRACER import TRACER\nfrom .cfg import cfg, cfg_for, IMG_SIZE\n')
shutil.copy(src / 'LICENSE', out / 'LICENSE')
for f in out.glob('*.py'):
    assert '.cuda()' not in f.read_text(), f
print('vendored to', out)
