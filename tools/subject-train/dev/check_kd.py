# The kd night's own checks (decisions 155-157), run on a stand-in work folder:
#   MS_KIT_WORK=<work> MS_KIT_RESULTS=<results> MS_KIT_CONFIG=<cfg> python check_kd.py <kit> [teacher run, default E6]
# - parse_teacher: start, run:X, mix:X:alpha, and what isn't one
# - kd_loss: the same number as round 6's inline kd loss (the step was only moved into a function)
# - a 'mix:' teacher's weights are exactly 6-results' -mix of the same run at the same alpha
# - fit_batch on the processor: one trial step with the teacher, then the planned batch
# - 6-results' verdict (pending iPad timing) and the kd gain share
import os, sys
sys.path.insert(0, os.path.abspath(sys.argv[1]))
import numpy as np
import torch
import torch.nn.functional as F
import s5_train as S5
from data import api_loss_each

ok = True


def check(name, cond):
    global ok
    ok &= bool(cond)
    print('%s %s' % ('ok  ' if cond else 'FAIL', name))


check('parse_teacher', S5.parse_teacher('start') == ('start',) and S5.parse_teacher('run:E6') == ('run', 'E6') and
      S5.parse_teacher('mix:E6:0.15') == ('mix', 'E6', 0.15) and
      all(S5.parse_teacher(x) is None for x in ('run:', 'mix:E6', 'mix:E6:x', 'mix:E6:1.5', 'mix:E6:0', 'E6', 'mix::0.2')))

# kd_loss against round 6's inline kd loss (s5_train v4, loss_of), on random maps
g = torch.Generator().manual_seed(0)
o, ds = torch.rand(4, 1, 32, 32, generator=g), [torch.rand(4, 1, 32, 32, generator=g) for _ in range(3)]
y = (torch.rand(4, 1, 32, 32, generator=g) > 0.5).float()
t = torch.rand(2, 1, 32, 32, generator=g)
sel = torch.tensor([True, False, True, False])
tt = y.clone()
tt[sel] = t.clamp(0, 1)
wv = sel.float() * 0.5
old = sum(((1 - wv) * api_loss_each(z, y) + wv * api_loss_each(z, tt)).mean() for z in (o, ds[0], ds[1], ds[2]))
check('kd_loss = round 6\'s inline loss (%.6f)' % float(old), torch.allclose(S5.kd_loss(o, ds, y, t.clamp(0, 1), sel, 0.5), old))

tr = sys.argv[2] if len(sys.argv) > 2 else 'E6'
w = S5.WORK / 'runs' / tr / 'best.pt'
if w.exists():
    import s6_round6 as S6
    net, which, rec = S5.teacher_of({'teacher': 'mix:%s:0.15' % tr}, None, '4', 'test')
    ref = S6.build_net(('mix', w, S6.arch_of(w), 0.15))
    a, b = net.state_dict(), ref.state_dict()
    check('mix teacher = 6-results\' %s-mix at 0.15, every tensor equal (%s)' % (tr, which),
          a.keys() == b.keys() and all(torch.equal(a[k], b[k]) for k in a))
    check('teacher.json fingerprint = 6-results\' fingerprint of %s-mix' % tr,
          rec['fingerprint'] == S6.fingerprint(('mix', w, S6.arch_of(w), 0.15)))
    st = S5.load_tracer(arch='4')
    params = [p for n, p in st.named_parameters() if not n.startswith('model.')]
    net.eval()
    for p in net.parameters():
        p.requires_grad_(False)
    b = S5.fit_batch(st, st.inp, torch.device('cpu'), 16, params, net, {'items': 'all', 'w': 0.5})
    check('fit_batch on the processor with a TE%s teacher at %d px for a TE4 at %d: batch %d' % (net.arch, net.inp, st.inp, b),
          b == 16 and all(p.grad is None for p in params))
    # the teacher's maps: its own input size, brought to the student's
    x = torch.randn(2, 3, st.inp, st.inp)
    m = S5.soft_maps(net, x, st.inp)
    check('soft_maps: %s, in [0, 1], no gradient' % (tuple(m.shape),), m.shape == (2, 1, st.inp, st.inp) and
          float(m.min()) >= 0 and float(m.max()) <= 1 and not m.requires_grad)
else:
    print('(no %s here: the weights checks skipped)' % w)

import importlib
S6 = importlib.import_module('s6_round6')
G = lambda *oks: [('g%d' % i, v) for i, v in enumerate(oks)]
check('verdict', S6.verdict(['people_bf'], G(True, True, True)) == 'passes' and
      S6.verdict(['people_bf'], G(True, None)) == 'pending' and S6.verdict(['people_bf'], G(False, None)) == 'fails' and
      S6.verdict([], G(True, None)) == 'fails' and S6.verdict(['x'], G(np.True_, True)) == 'passes' and
      S6.verdict(['x'], G(np.False_, True)) == 'fails')
rng = np.random.default_rng(1)
dr = rng.normal(0.05, 0.1, 800)
da = 0.6 * dr + rng.normal(0, 0.02, 800)
sh = S6.share_of(da, dr)
check('share_of: %.2f (%.2f to %.2f) for a model with 0.6 of the gain' % sh, abs(sh[0] - 0.6) < 0.05 and sh[1] < sh[0] < sh[2])
check('share_of: n/a when the reference has no gain', np.isnan(S6.share_of(da, -dr)[0]))
print('all checks pass' if ok else 'SOME CHECKS FAILED')
sys.exit(0 if ok else 1)
