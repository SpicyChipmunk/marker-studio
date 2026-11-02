# the kit's vendored TRACER against an ONNX export (made from the upstream code with the same rewrites), at the arch's
# own input size: MS_ARCH=2 for TE-2 (352), else TE-0 (320). dev/equiv_upstream.py checks against the original code.
import os, sys, torch, numpy as np, onnxruntime as ort
kit, w, onx = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, kit)
from tracer import TRACER, cfg_for, IMG_SIZE
arch = os.environ.get('MS_ARCH', '0')
N = IMG_SIZE[arch]
net = TRACER(cfg_for(arch))
sd = {k.replace('module.', '', 1): v for k, v in torch.load(w, map_location='cpu', weights_only=True).items()}
r = net.load_state_dict(sd, strict=True); net.eval()
g = torch.Generator().manual_seed(3)
x = (torch.rand(2, 3, N, N, generator=g) - 0.45) / 0.226
with torch.no_grad(): a = net(x)[0].numpy()
s = ort.InferenceSession(onx)
b = np.concatenate([s.run(None, {s.get_inputs()[0].name: x[i:i + 1].numpy()})[0] for i in range(2)])
print('max diff vs ONNX', float(np.abs(a - b).max()), 'outputs', a.shape)
# and on real photos (the kit test's public-domain ones), where the map is a real subject
import glob
from PIL import Image
for f in sorted(glob.glob(sys.argv[4] + '/*.jpg'))[:6] if len(sys.argv) > 4 else []:
    im = np.asarray(Image.open(f).convert('RGB').resize((N, N), Image.BILINEAR), np.float32) / 255
    xx = ((im - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).astype(np.float32).transpose(2, 0, 1)[None]
    with torch.no_grad(): a = net(torch.from_numpy(xx))[0].numpy()
    b = s.run(None, {s.get_inputs()[0].name: xx})[0]
    print(f.split('/')[-1], 'subject %.3f' % (a >= 0.5).mean(), 'max diff %.2e' % np.abs(a - b).max())
