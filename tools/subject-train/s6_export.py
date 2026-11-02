# The app's file for a model (round 5's step 6 export, as a function for round 6): ONNX opset 17, onnxslim, weights stored
# int8 per output channel; checked against PyTorch on a few photos.
import os
import numpy as np
import torch
from PIL import Image
from common import WORK, MEAN, STD, log
from data import load_prep


class Out(torch.nn.Module):
    def __init__(s, n):
        super().__init__()
        s.n = n

    def forward(s, x):
        return s.n(x)[0]


def int8_store(src, dst):
    """Weights of 3 or more dims stored int8 per output channel (Cast + Mul back to float32 at load); 2-D ones (the
    DFT step's matrices) kept float32; the rest (biases, batch-norm) float16. The arithmetic stays float32."""
    import onnx
    from onnx import numpy_helper, helper, TensorProto
    m = onnx.load(src)
    g_ = m.graph
    new, pre = [], []
    for t in g_.initializer:
        a = numpy_helper.to_array(t)
        if a.dtype == np.float32 and a.ndim >= 3 and a.size >= 1024:
            flat = a.reshape(a.shape[0], -1)
            sc = np.maximum(np.abs(flat).max(axis=1), 1e-12) / 127.0
            q = np.clip(np.rint(flat / sc[:, None]), -127, 127).astype(np.int8).reshape(a.shape)
            new.append(numpy_helper.from_array(q, t.name + '_q8'))
            new.append(numpy_helper.from_array(sc.astype(np.float32).reshape([-1] + [1] * (a.ndim - 1)), t.name + '_sc'))
            pre.append(helper.make_node('Cast', [t.name + '_q8'], [t.name + '_f'], to=TensorProto.FLOAT))
            pre.append(helper.make_node('Mul', [t.name + '_f', t.name + '_sc'], [t.name]))
        elif a.dtype == np.float32 and a.ndim != 2 and a.size >= 16:
            h = numpy_helper.from_array(np.where(np.abs(a) < 1e-15, 0, a).astype(np.float16), t.name + '_f16')
            new.append(h)
            pre.append(helper.make_node('Cast', [h.name], [t.name], to=TensorProto.FLOAT))
        else:
            new.append(t)
    del g_.initializer[:]
    g_.initializer.extend(new)
    nodes = list(g_.node)
    del g_.node[:]
    g_.node.extend(pre + nodes)
    onnx.checker.check_model(m)
    onnx.save(m, dst)



def export(name, cpu, mdir, chk):
    import onnxruntime as ort
    NI = cpu.inp
    fp = WORK / ('export-%s-fp32.onnx' % name)
    x = torch.zeros(1, 3, NI, NI)
    with torch.no_grad():
        cpu(x)     # (one run first, so the edge step's constants are made before the export traces it)
    torch.onnx.export(Out(cpu).eval(), x, str(fp), input_names=['input'], output_names=['map'], opset_version=17, dynamo=False)
    try:
        import onnxslim
        slim = WORK / ('export-%s-slim.onnx' % name)
        onnxslim.slim(str(fp), str(slim))
        fp = slim
    except Exception as e:
        log('(onnxslim skipped for %s: %s)' % (name, e))
    dst = mdir / ('subject-%s-%d-w8.onnx' % (name, NI))
    int8_store(str(fp), str(dst))
    s = ort.InferenceSession(str(dst), providers=['CPUExecutionProvider'])
    flips, mx = 0, 0.0
    for iid in chk:
        img = load_prep(iid)[0]
        xx = np.asarray(Image.fromarray(img).resize((NI, NI), Image.BILINEAR), np.float32) / 255
        xx = ((xx - np.array(MEAN, np.float32)) / np.array(STD, np.float32)).transpose(2, 0, 1)[None]
        a = s.run(None, {'input': xx})[0][0, 0]
        with torch.no_grad():
            b = cpu(torch.from_numpy(xx))[0][0, 0].numpy()
        mx = max(mx, float(np.abs(a - b).max()))
        flips += int(((a >= 0.5) != (b >= 0.5)).sum())
    log('%s exported: %.2f MB; vs PyTorch on %d photos: max diff %.4f, %.3f%% of pixels change side' %
        (name, os.path.getsize(dst) / 1e6, len(chk), mx, 100 * flips / max(1, len(chk) * NI * NI)))
    return {'mb': round(os.path.getsize(dst) / 1e6, 2), 'max_diff': mx, 'input': NI, 'file': dst.name}
