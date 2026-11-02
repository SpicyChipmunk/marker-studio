# Round 4's routes (decisions 57, 63, 65), fixed before the run, in a file of their own so the kit's test can check
# every outcome: B1 is judged first; if it fails a guard (with or without a gain), B1-early is judged; if it holds every
# guard but isn't shown better than the benchmark, B1-wide is judged; nothing else decides.


def route4(res, base):
    """res: {model: (better, guards_ok)} for the candidates step 6 has (a missing one wasn't trained).
    → (decision, [models judged], [sentences for the report])."""
    notes, judged = [], []
    if 'B1' not in res:
        return base, judged, ['B1 was not trained (step 5 did not finish): %s stays.' % base]
    better, g_ok = res['B1']
    judged.append('B1')
    if better and g_ok:
        return 'B1', judged, ['B1 is better than %s and holds every guard: it ships.' % base]
    nxt = 'B1-early' if not g_ok else 'B1-wide'
    notes.append('B1 %s, so %s is judged (decided before the run).' % (
        ('does not hold every guard' + ('' if better else ' and is not shown better')) if not g_ok else
        'holds every guard but is not shown better than %s' % base, nxt))
    if nxt not in res:
        return base, judged, notes + ['%s was not trained: %s stays.' % (nxt, base)]
    judged.append(nxt)
    b2, g2 = res[nxt]
    if b2 and g2:
        return nxt, judged, notes + ['%s is better than %s and holds every guard: it ships.' % (nxt, base)]
    return base, judged, notes + ['%s %s: %s stays.' % (nxt, 'is not shown better' if not b2 else 'does not hold every guard', base)]


# Round 5's routes (decisions 95, 97, 98e), fixed before the run. Paths in order, each [candidate, -early, -wide]: the
# candidate is judged; if it fails and any failing guard line is one training clearly made worse than the candidate's
# own stock model, its -early is judged; otherwise (lines short of the guard, or every guard held but not better) its
# -wide, which is trained only when named: then the report is NOT FINAL and nothing after it is judged. A path that ends
# with nothing shipping, or whose shipping model Ben vetoed on the iPad, hands over to the next path.
def route5(paths, res, veto=()):
    """paths: [[cand, early, wide], ...]; res: {model: (better, guards_ok, kinds)} for the models step 6 has (kinds: the
    set of 'worse' / 'short' over the failing guard lines); veto: path heads Ben vetoed.
    -> (decision or None (the benchmark stays), [models judged], [sentences], wide run to train or None)."""
    judged, notes = [], []
    for head, early, wide in paths:
        if head not in res:
            notes.append('%s was not trained: its path is skipped.' % head)
            continue
        judged.append(head)
        better, g_ok, kinds = res[head]
        cand = head if (better and g_ok) else None
        if cand:
            notes.append('%s is better than the benchmark and holds every guard.' % head)
        else:
            worse = (not g_ok) and 'worse' in kinds
            nxt = early if worse else wide
            notes.append('%s %s, so %s is judged (decided before the run).' % (
                head, 'fails a guard on a line training made clearly worse than its stock model' if worse else (
                    'falls short of a guard on lines training improved but not enough' if not g_ok else
                    'holds every guard but is not shown better'), nxt))
            if nxt not in res:
                if nxt == wide:
                    return None, judged, notes + ['NOT FINAL: %s has not been trained. Run 5b-train-wide, then 6-results again.' % wide], wide
                notes.append('%s is missing: this path ends.' % nxt)
            else:
                judged.append(nxt)
                b2, g2, _ = res[nxt]
                cand = nxt if (b2 and g2) else None
                notes.append('%s %s.' % (nxt, 'is better than the benchmark and holds every guard' if cand else
                                        ('is not shown better' if g2 else 'does not hold every guard')))
        if cand and head in veto:
            notes.append('Ben vetoed %s\'s path on the iPad: the next path is judged.' % head)
            continue
        if cand:
            return cand, judged, notes + ['%s ships.' % cand], None
        notes.append('%s\'s path ends: nothing from it ships.' % head)
    return None, judged, notes, None
