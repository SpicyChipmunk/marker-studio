# The app's stock subject finder, made exactly as the kit's step 6 makes each candidate: TRACER's own release
# weights through the kit's model code, ONNX (opset 17), onnxslim, weights stored int8 (6_check int8_store), at the
# arch's own input size (TE-0 320, TE-2 352; MS_SIZE overrides it, for timing only).
#   python3 export_stock.py <kit folder> <out.onnx> <weights .pth> [arch 0|2]
import sys, os, re
kit, out = sys.argv[1], sys.argv[2]
os.environ.setdefault('MS_KIT_WORK', os.path.join(os.path.dirname(out), '_work'))
sys.path.insert(0, kit)
import torch, onnxslim
from common import load_tracer, WORK
src = open(os.path.join(kit, 's6_check.py')).read()
ns = {}
exec(compile(src[src.index('def int8_store'):src.index('import onnxruntime as ort')], 's6_check.py', 'exec'), {'np': __import__('numpy')}, ns)
net = load_tracer(sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else '0').eval()
N = int(os.environ.get('MS_SIZE', net.inp))
x = torch.zeros(1, 3, N, N)
with torch.no_grad():
    net(x)
class Out(torch.nn.Module):
    def __init__(s, n): super().__init__(); s.n = n
    def forward(s, x): return s.n(x)[0]
fp = out + '.fp32.onnx'
torch.onnx.export(Out(net).eval(), x, fp, input_names=['input'], output_names=['map'], opset_version=17, dynamo=False)
onnxslim.slim(fp, fp + '.slim.onnx')
ns['int8_store'](fp + '.slim.onnx', out)
os.remove(fp); os.remove(fp + '.slim.onnx')
print(out, os.path.getsize(out))
