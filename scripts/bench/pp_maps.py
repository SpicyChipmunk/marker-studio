# The photo-to-page bench, step 2 of 3: each working picture's subject map as the app makes it (48-subject.js subMap):
# the working picture sampled to the model's side with the app's own centre-aligned bilinear (a copy of subMap's loop,
# checked against the source by pp-bench.mjs's drift hashes), ImageNet's mean and spread, the app's ONNX file through
# ONNX Runtime (float32 arithmetic, one thread, every graph optimisation, as ORT Web is set up), the raw map kept.
# pp-bench.mjs then applies the app's own subMapUp to it (Node, the app's code).
#
#   python3 -I scripts/bench/pp_maps.py <cache folder> [<model.onnx>] [--tag name]
#
# Default model: vendor/subject/4/subject-te4.onnx (the shipped C1). Writes <cache>/maps/<tag>/<id>.y (float32, S x S)
# and <cache>/maps/<tag>/model.json (file, SHA-256, side). Restartable; refuses a tag made with another model (a new
# model under the same file name: give it its own --tag).
import hashlib, json, os, sys, time
import numpy as np
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MEAN = np.array([0.485, 0.456, 0.406], np.float64)          # (48-subject.js SUB_MEAN / SUB_STD, doubles as in JS)
STD = np.array([0.229, 0.224, 0.225], np.float64)


def sample(rgb, w0, h0, S):
    """subMap's loop (48-subject.js): fx = min(w0 - 1, (x + 0.5) * w0 / S - 0.5), 4-tap bilinear, no area averaging."""
    idx = np.arange(S, dtype=np.float64)
    fx = np.minimum(w0 - 1, (idx + 0.5) * w0 / S - 0.5)
    fy = np.minimum(h0 - 1, (idx + 0.5) * h0 / S - 0.5)
    ix = np.maximum(0, np.floor(fx)).astype(np.int64)
    iy = np.maximum(0, np.floor(fy)).astype(np.int64)
    tx = np.maximum(0, fx - ix)
    ty = np.maximum(0, fy - iy)
    ix1 = np.minimum(w0 - 1, ix + 1)
    iy1 = np.minimum(h0 - 1, iy + 1)
    im = rgb.reshape(h0, w0, 3).astype(np.float64)
    a = im[iy][:, ix]
    b = im[iy][:, ix1]
    c = im[iy1][:, ix]
    d = im[iy1][:, ix1]
    TX, TY = tx[None, :, None], ty[:, None, None]
    v = a * (1 - TX) * (1 - TY) + b * TX * (1 - TY) + c * (1 - TX) * TY + d * TX * TY
    # (the app computes in double and stores float32: (v / 255 - mean) / std)
    x = ((v / 255.0 - MEAN) / STD).astype(np.float32)
    return x.transpose(2, 0, 1)[None]


def main():
    av = sys.argv[1:]
    tag = None
    if '--tag' in av:
        i = av.index('--tag')
        tag = av[i + 1]
        av = av[:i] + av[i + 2:]
    args = av
    cache = args[0]
    model = args[1] if len(args) > 1 else os.path.join(REPO, 'vendor', 'subject', '4', 'subject-te4.onnx')
    tag = tag or os.path.splitext(os.path.basename(model))[0]
    so = ort.SessionOptions()
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    so.intra_op_num_threads = 1
    so.inter_op_num_threads = 1
    sess = ort.InferenceSession(model, so, providers=['CPUExecutionProvider'])
    inp = sess.get_inputs()[0]
    S = int(inp.shape[2])
    out = os.path.join(cache, 'maps', tag)
    os.makedirs(out, exist_ok=True)
    sha = hashlib.sha256(open(model, 'rb').read()).hexdigest()
    mj = os.path.join(out, 'model.json')
    if os.path.exists(mj):
        old = json.load(open(mj))
        if old.get('sha256') != sha:
            sys.exit('REFUSED: maps/%s was made with %s (%s), not this %s (%s): use --tag <another name>'
                     % (tag, old.get('file'), old.get('sha256', '')[:12], os.path.basename(model), sha[:12]))
    json.dump({'file': os.path.basename(model), 'sha256': sha, 'side': S, 'ort': ort.__version__},
              open(os.path.join(out, 'model.json'), 'w'))
    pdir = os.path.join(cache, 'prep')
    ids = sorted(f[:-5] for f in os.listdir(pdir) if f.endswith('.json') and not f.startswith('_'))
    t0, n = time.time(), 0
    for iid in ids:
        dst = os.path.join(out, iid + '.y')
        if os.path.exists(dst):
            continue
        meta = json.load(open(os.path.join(pdir, iid + '.json')))
        rgb = np.fromfile(os.path.join(pdir, iid + '.rgb'), np.uint8)
        y = sess.run(None, {inp.name: sample(rgb, meta['w'], meta['h'], S)})[0].astype(np.float32).reshape(S, S)
        y.tofile(dst + '.tmp')
        os.replace(dst + '.tmp', dst)
        n += 1
    print('pp_maps: %d maps made with %s (side %d, ORT %s), %.1f min' % (n, os.path.basename(model), S, ort.__version__,
                                                                      (time.time() - t0) / 60))


if __name__ == '__main__':
    main()
