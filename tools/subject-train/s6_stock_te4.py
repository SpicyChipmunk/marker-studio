# (Ben, 3 Nov) Stock TE4, untrained (TRACER's own release weights, C1's start), as the app's file, for the photo-to-page
# bench's control: does C1's training show on the pages at all? Exported exactly as round 5 exported C1 (s6_export:
# opset 17, onnxslim, int8 per output channel), then checked against PyTorch on a few bench photos.
#
#   python s6_stock_te4.py <out folder> <bench-cache>
import json, os, sys
from pathlib import Path
import numpy as np
import torch
from common import load_tracer, log, MEAN, STD
from s6_export import export


def main():
    out, cache = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    dst = out / 'subject-TE4stock-448-w8.onnx'
    if dst.exists():
        print('s6_stock_te4: %s is there already' % dst.name)
        return
    net = load_tracer(arch='4').eval()
    if net.inp != 448:
        sys.exit('REFUSED: stock TE4 takes %d, not 448: tell Claude' % net.inp)
    r = export('TE4stock', net, out, [])
    # (the check s6_export makes on the kit's photos, here on four bench photos, sampled as the bench samples them)
    import onnxruntime as ort
    s = ort.InferenceSession(str(dst), providers=['CPUExecutionProvider'])
    pdir = cache / 'prep'
    ids = sorted(f[:-5] for f in os.listdir(pdir) if f.endswith('.json') and not f.startswith('_'))[:4]
    mx, flips = 0.0, 0
    for iid in ids:
        meta = json.load(open(pdir / (iid + '.json')))
        rgb = np.fromfile(pdir / (iid + '.rgb'), np.uint8).reshape(meta['h'], meta['w'], 3)
        from PIL import Image
        x = np.asarray(Image.fromarray(rgb).resize((448, 448), Image.BILINEAR), np.float32) / 255
        x = ((x - np.array(MEAN, np.float32)) / np.array(STD, np.float32)).transpose(2, 0, 1)[None]
        a = s.run(None, {'input': x})[0][0, 0]
        with torch.no_grad():
            b = net(torch.from_numpy(x))[0][0, 0].numpy()
        mx = max(mx, float(np.abs(a - b).max()))
        flips += int(((a >= 0.5) != (b >= 0.5)).sum())
    pct = 100 * flips / max(1, len(ids) * 448 * 448)
    log('stock TE4 exported: %.2f MB; vs PyTorch on %d bench photos: max diff %.4f, %.3f%% of pixels change side'
        % (r['mb'], len(ids), mx, pct))
    if pct > 0.5:
        sys.exit('REFUSED: the exported stock TE4 differs from PyTorch on %.2f%% of pixels: tell Claude' % pct)


if __name__ == '__main__':
    main()
