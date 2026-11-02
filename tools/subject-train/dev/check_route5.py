# Round 5's routes (s6_routes.route5) on every outcome that matters: python3 -I check_route5.py <kit folder>
import sys
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else '..')
from s6_routes import route5
P = [['C1', 'C1-early', 'C1-wide'], ['C2', 'C2-early', 'C2-wide']]
base = {'C1': (True, True, set()), 'C1-early': (False, True, set()), 'C2': (True, True, set()), 'C2-early': (True, True, set())}
cases = [
    (base, (), ('C1', ['C1'], None)),
    (base, ('C1',), ('C2', ['C1', 'C2'], None)),
    ({**base, 'C1': (True, False, {'worse', 'short'})}, (), ('C2', ['C1', 'C1-early', 'C2'], None)),
    ({**base, 'C1': (True, False, {'short'})}, (), (None, ['C1'], 'C1-wide')),
    ({**base, 'C1': (False, True, set())}, (), (None, ['C1'], 'C1-wide')),
    ({**base, 'C1': (False, True, set()), 'C1-wide': (True, True, set())}, (), ('C1-wide', ['C1', 'C1-wide'], None)),
    ({**base, 'C1': (False, True, set()), 'C1-wide': (False, True, set()), 'C2': (False, False, {'worse'}),
      'C2-early': (True, True, set())}, (), ('C2-early', ['C1', 'C1-wide', 'C2', 'C2-early'], None)),
    ({**base, 'C1': (False, True, set()), 'C1-wide': (False, True, set()), 'C2': (False, False, {'short'})}, (),
     (None, ['C1', 'C1-wide', 'C2'], 'C2-wide')),
    ({'C2': (True, True, set()), 'C2-early': (True, True, set())}, (), ('C2', ['C2'], None)),
    ({**base, 'C1': (True, False, {'worse'}), 'C1-early': (True, True, set())}, ('C1',), ('C2', ['C1', 'C1-early', 'C2'], None)),
    ({**base, 'C1': (True, False, {'worse'}), 'C1-early': (True, True, set())}, ('C1', 'C2'), (None, ['C1', 'C1-early', 'C2'], None)),
]
bad = 0
for res, veto, want in cases:
    d, j, n, w = route5(P, res, veto)
    ok = (d, j, w) == want
    bad += not ok
    print('ok ' if ok else 'BAD', (d, j, w))
sys.exit(1 if bad else 0)
