import json, sys, os

# PLAN 7.62. usage (from this folder): python cmp.py before- after-  (each a file prefix)
# per seed: bursts, civilians over 10 x men, strikes back, first strikes on an empty capital: per seed bursts, civ>10x, strikes back, empty-capital first strikes
def civ(r):
    t = r.get('toll')
    if not t: return False
    c = t['dead'] - t['men']
    return (t['men'] == 0 and c > 0) or c > 10 * t['men']

def read(d):
    out = {}
    for s in range(781, 791):
        p = f'{d}toll-{s}.json'
        if not os.path.exists(p): out[s] = None; continue
        out[s] = json.load(open(p, encoding='utf-8'))
    return out

for d in sys.argv[1:]:
    print('==', d)
    print('seed decided bursts civ>10x back(dec) back(burst) emptyCapFirst(dec) emptyFirst(burst) emptyFirstDead dead men')
    T = [0] * 10
    for s, j in read(d).items():
        if j is None: print(s, 'missing'); continue
        rows = j['rows']
        b = [r for r in rows if r.get('toll')]
        cv = sum(1 for r in b if civ(r))
        backd = sum(1 for r in rows if r.get('retaliating'))
        backb = sum(1 for r in b if r.get('retaliating'))
        ecap = sum(1 for r in rows if not r.get('retaliating') and 'place' in r and r['place']['capital'] > 0 and r['place']['menShare'] < 0.01)
        ef = [r for r in b if not r.get('retaliating') and 'place' in r and r['place']['menShare'] < 0.01]
        efd = sum(r['toll']['dead'] for r in ef)
        dead = sum(r['toll']['dead'] for r in b)
        men = sum(r['toll']['men'] for r in b)
        v = [len(rows), len(b), cv, backd, backb, ecap, len(ef), efd, dead, men]
        T = [a + c for a, c in zip(T, v)]
        print(s, *v, 'noparts', sum(1 for r in rows if 'place' not in r))
    print('all', *T)
